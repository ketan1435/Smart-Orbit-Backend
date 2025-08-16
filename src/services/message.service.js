import httpStatus from 'http-status';
import mongoose from 'mongoose';
import Message from '../models/message.model.js';
import ApiError from '../utils/ApiError.js';
import storage from '../factory/storage.factory.js';
import Project from '../models/project.model.js';
import User from '../models/user.model.js';
import Admin from '../models/admin.model.js';
import socketManager from '../config/socket.js';

/**
 * Query messages
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @param {string} [options.sortBy] - Sort option in the format: sortField:(desc|asc)
 * @param {number} [options.limit] - Maximum number of results per page (default = 10)
 * @param {number} [options.page] - Current page (default = 1)
 * @returns {Promise<QueryResult>}
 */
export const queryMessages = async (filter, options) => {
    const { limit = 10, page = 1, sortBy } = options;

    let sort;
    if (typeof sortBy === 'string') {
        const [field, order] = sortBy.split(':');
        sort = { [field]: order === 'desc' ? -1 : 1 };
    } else if (typeof sortBy === 'object' && sortBy !== null) {
        sort = sortBy;
    } else {
        sort = { createdAt: -1 };
    }

    // Build the filter object
    const mongoFilter = {};

    // Handle project filtering
    if (filter.project) {
        mongoFilter.project = filter.project;
    }

    // Handle sender filtering
    if (filter.sender) {
        mongoFilter.sender = filter.sender;
    }

    // Handle sender model filtering
    if (filter.senderModel) {
        mongoFilter.senderModel = filter.senderModel;
    }

    // Handle read status filtering
    if (filter.isRead !== undefined) {
        mongoFilter.isRead = filter.isRead;
    }

    // Handle date range filtering
    if (filter.startDate || filter.endDate) {
        mongoFilter.createdAt = {};
        if (filter.startDate) {
            mongoFilter.createdAt.$gte = new Date(filter.startDate);
        }
        if (filter.endDate) {
            mongoFilter.createdAt.$lte = new Date(filter.endDate);
        }
    }

    const messages = await Message.find(mongoFilter)
        .populate({
            path: 'project',
            select: 'projectName projectCode status'
        })
        .populate({
            path: 'sender',
            select: 'name email role'
        })
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

    const totalResults = await Message.countDocuments(mongoFilter);

    return {
        results: messages,
        page,
        limit,
        totalPages: Math.ceil(totalResults / limit),
        totalResults,
    };
};

/**
 * Get message by id
 * @param {ObjectId} id
 * @returns {Promise<Message>}
 */
export const getMessageById = async (id) => {
    const message = await Message.findById(id)
        .populate('project', 'projectName projectCode status')
        .populate('sender', 'name email role');

    if (!message) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Message not found');
    }
    return message;
};

/**
 * Create message
 * @param {Object} messageBody
 * @param {Object} req - Request object for user info
 * @returns {Promise<Message>}
 */
export const createMessage = async (req, session) => {
    const { project, content, files } = req.body;

    // Verify project exists within session
    const projectExists = await Project.findById(project).session(session);
    if (!projectExists) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
    }

    // Process tags if present
    let processedTags = [];
    if (req.body.tags && Array.isArray(req.body.tags)) {
        processedTags = req.body.tags.map(tag => ({
            userId: tag.userId,
            userModel: tag.userModel,
            username: tag.username,
            tagPosition: tag.tagPosition
        }));
    }

    // Create message using session
    const messageData = {
        project,
        content,
        sender: req.user.id,
        senderModel: req.user.constructor.modelName,
        files: [],
        tags: processedTags
    };

    const createdMessages = await Message.create([messageData], { session });
    const message = createdMessages[0];

    // File handling is not transactional — do this outside the transaction phase
    if (files && files.length > 0) {
        const processedFiles = [];
        const filesToDelete = [];

        try {
            for (const file of files) {
                const tempKey = file.key;
                const permanentKey = `messages/${message._id}/${file.fileName}`;

                await storage.copyFile(tempKey, permanentKey);
                processedFiles.push({
                    key: permanentKey,
                    fileName: file.fileName,
                    fileType: file.fileType,
                    fileSize: file.fileSize,
                    uploadedAt: new Date()
                });
                filesToDelete.push(tempKey);
            }

            // Update message document with new files (also inside transaction)
            message.files = processedFiles;
            await message.save({ session });

            // Delete temporary files (cleanup, not transactional)
            for (const tempKey of filesToDelete) {
                try {
                    await storage.deleteFile(tempKey);
                } catch (deleteError) {
                    console.error(`Failed to delete temporary file ${tempKey}:`, deleteError);
                }
            }

        } catch (error) {
            // Cleanup on failure
            for (const file of processedFiles) {
                try {
                    await storage.deleteFile(file.key);
                } catch (cleanupError) {
                    console.error(`Failed to cleanup file ${file.key}:`, cleanupError);
                }
            }

            // Delete message (with session)
            await Message.deleteOne({ _id: message._id }).session(session);

            throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to process files');
        }
    }

    // Populate (optional: still use session for safety)
    const populatedMessage = await Message.findById(message._id)
        .populate('sender', 'name email role')
        .populate('project', 'projectName projectCode status')
        .session(session);

    // Emit real-time update (non-transactional)
    socketManager.emitToProject(project, 'new-message', {
        message: populatedMessage,
        timestamp: new Date()
    });

    return {
        status: 200,
        body: {
            status: 1,
            message: 'Message created successfully.',
            data: populatedMessage
        }
    };
};

/**
 * Delete message by id
 * @param {ObjectId} messageId
 * @param {Object} req - Request object for user info
 * @returns {Promise<Message>}
 */
export const deleteMessageById = async (messageId, req) => {
    const message = await getMessageById(messageId);

    // Check if user can delete this message (sender or admin)
    if (message.sender.toString() !== req.user.id && req.user.role !== 'admin') {
        throw new ApiError(httpStatus.FORBIDDEN, 'You can only delete your own messages');
    }

    // Delete associated files from S3
    if (message.files && message.files.length > 0) {
        for (const file of message.files) {
            try {
                await storage.deleteFile(file.key);
            } catch (deleteError) {
                console.error(`Failed to delete file ${file.key}:`, deleteError);
                // Continue with deletion even if file cleanup fails
            }
        }
    }

    // Delete the message
    await Message.deleteOne({ _id: messageId });
    return message;
};

/**
 * Get messages for a specific project
 * @param {ObjectId} projectId
 * @param {Object} options
 * @returns {Promise<QueryResult>}
 */
export const getProjectMessages = async (projectId, options) => {
    const filter = { project: projectId };
    return queryMessages(filter, options);
};

/**
 * Create message for socket-only approach (no transaction)
 * @param {Object} req - Mock request object with body and user
 * @returns {Promise<Object>}
 */
export const createMessageSocket = async (req) => {
    try {
        const { project, content, files } = req.body;

        // Verify project exists
        const projectExists = await Project.findById(project);
        if (!projectExists) {
            return { success: false, error: 'Project not found' };
        }

        // Create the message record first
        const messageData = {
            project,
            content,
            sender: req.user.id,
            senderModel: req.user.constructor.modelName,
            files: []
        };

        const message = await Message.create(messageData);

        // Process files if provided
        if (files && files.length > 0) {
            const processedFiles = [];
            const filesToDelete = [];

            try {
                // Copy files from temporary location to permanent location
                for (const file of files) {
                    const tempKey = file.key;
                    const permanentKey = `messages/${message._id}/${file.fileName}`;

                    // Copy file to permanent location
                    await storage.copyFile(tempKey, permanentKey);
                    processedFiles.push({
                        key: permanentKey,
                        fileName: file.fileName,
                        fileType: file.fileType,
                        fileSize: file.fileSize,
                        uploadedAt: new Date()
                    });
                    filesToDelete.push(tempKey);
                }

                // Update message with permanent file locations
                message.files = processedFiles;
                await message.save();

                // Delete temporary files
                for (const tempKey of filesToDelete) {
                    try {
                        await storage.deleteFile(tempKey);
                    } catch (deleteError) {
                        console.error(`Failed to delete temporary file ${tempKey}:`, deleteError);
                        // Don't throw error for cleanup failures
                    }
                }

            } catch (error) {
                // If file processing fails, clean up any successfully copied files
                for (const file of processedFiles) {
                    try {
                        await storage.deleteFile(file.key);
                    } catch (cleanupError) {
                        console.error(`Failed to cleanup file ${file.key}:`, cleanupError);
                    }
                }

                // Delete the message record
                await Message.deleteOne({ _id: message._id });

                return { success: false, error: 'Failed to process files' };
            }
        }

        // Populate sender information for socket emission
        const populatedMessage = await Message.findById(message._id)
            .populate('sender', 'name email role')
            .populate('project', 'projectName projectCode status');

        return { success: true, data: populatedMessage };

    } catch (error) {
        console.error('Socket message creation error:', error);
        return { success: false, error: error.message || 'Failed to create message' };
    }
};

/**
 * Update message by id
 * @param {ObjectId} messageId
 * @param {Object} updateData
 * @param {Object} req - Request object for user info
 * @returns {Promise<Message>}
 */
export const updateMessageById = async (messageId, updateData, req) => {
    const message = await getMessageById(messageId);

    // Check if user can update this message (sender or admin)
    if (message.sender.toString() !== req.user.id && req.user.role !== 'admin') {
        throw new ApiError(httpStatus.FORBIDDEN, 'You can only update your own messages');
    }

    const updatedMessage = await Message.findByIdAndUpdate(
        messageId,
        updateData,
        { new: true, runValidators: true }
    )
        .populate('project', 'projectName projectCode status')
        .populate('sender', 'name email role');

    return updatedMessage;
};

/**
 * Get messages by IDs
 * @param {Array} messageIds
 * @returns {Promise<Array>}
 */
export const getMessagesByIds = async (messageIds) => {
    const messages = await Message.find({
        _id: { $in: messageIds }
    }).populate('sender', 'name email role');

    return messages;
};

/**
 * Mark messages as read
 * @param {Array} messageIds
 * @param {ObjectId} userId
 * @returns {Promise<Object>}
 */
export const markMessagesAsRead = async (messageIds, userId) => {
    const result = await Message.updateMany(
        {
            _id: { $in: messageIds },
            sender: { $ne: new mongoose.Types.ObjectId(userId) } // Don't mark own messages as read - use ObjectId for comparison
        },
        { isRead: true }
    );

    return {
        modifiedCount: result.modifiedCount,
        totalMessages: messageIds.length
    };
};

/**
 * Mark message as read
 * @param {ObjectId} messageId
 * @param {ObjectId} userId
 * @returns {Promise<Message>}
 */
export const markMessageAsRead = async (messageId, userId) => {
    const message = await Message.findById(messageId);

    if (!message) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Message not found');
    }

    // Don't mark own messages as read
    if (message.sender.toString() === userId.toString()) {
        return message;
    }

    const updatedMessage = await Message.findByIdAndUpdate(
        messageId,
        { isRead: true },
        { new: true, runValidators: true }
    )
        .populate('project', 'projectName projectCode status')
        .populate('sender', 'name email role');

    return updatedMessage;
};

/**
 * Get unread message count for a user
 * @param {ObjectId} userId
 * @param {ObjectId} projectId - Optional project filter
 * @returns {Promise<Object>}
 */
export const getUnreadMessageCount = async (userId, projectId = null) => {
    console.log('getUnreadMessageCount called with userId:', userId, 'type:', typeof userId);

    const filter = {
        sender: { $ne: new mongoose.Types.ObjectId(userId) }, // Don't count own messages - use ObjectId for comparison
        isRead: false
    };

    if (projectId) {
        filter.project = projectId;
    }

    console.log('getUnreadMessageCount filter:', JSON.stringify(filter, null, 2));

    const count = await Message.countDocuments(filter);

    console.log('getUnreadMessageCount result:', count);

    // Debug: Check a few sample messages to see sender format
    const sampleMessages = await Message.find({ isRead: false }).limit(3);
    console.log('Sample unread messages:', sampleMessages.map(msg => ({
        id: msg._id,
        sender: msg.sender,
        senderType: typeof msg.sender,
        senderString: msg.sender.toString()
    })));

    return {
        unreadCount: count,
        projectId: projectId || 'all'
    };
};

/**
 * Get unread message counts for all projects
 * @param {ObjectId} userId
 * @returns {Promise<Array>}
 */
export const getUnreadMessageCountsByProject = async (userId) => {
    console.log('getUnreadMessageCountsByProject called with userId:', userId, 'type:', typeof userId);

    const pipeline = [
        {
            $match: {
                sender: { $ne: new mongoose.Types.ObjectId(userId) }, // Don't count own messages - use ObjectId for comparison
                isRead: false
            }
        },
        {
            $group: {
                _id: '$project',
                unreadCount: { $sum: 1 }
            }
        },
        {
            $lookup: {
                from: 'projects',
                localField: '_id',
                foreignField: '_id',
                as: 'project'
            }
        },
        {
            $unwind: '$project'
        },
        {
            $project: {
                projectId: '$_id',
                projectName: '$project.projectName',
                projectCode: '$project.projectCode',
                unreadCount: 1
            }
        },
        {
            $sort: { unreadCount: -1 }
        }
    ];

    console.log('getUnreadMessageCountsByProject pipeline:', JSON.stringify(pipeline, null, 2));

    const results = await Message.aggregate(pipeline);

    console.log('getUnreadMessageCountsByProject results:', results);

    return results;
};

/**
 * Get taggable users for a project
 * @param {ObjectId} projectId
 * @param {ObjectId} currentUserId
 * @returns {Promise<Array>}
 */
export const getTaggableUsers = async (projectId, currentUserId) => {
    console.log('getTaggableUsers service called with:', { projectId, currentUserId });

    if (!projectId) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Project ID is required');
    }

    if (!currentUserId) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Current user ID is required');
    }

    // Get the project to find the requirement
    const project = await Project.findById(projectId).populate('requirement');

    console.log('Project found:', project ? 'Yes' : 'No');

    if (!project) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
    }

    const taggableUsers = [];

    // Add admin users
    const adminUsers = await Admin.find({}, 'name email');
    taggableUsers.push(...adminUsers.filter(admin => admin && admin._id).map(admin => ({
        _id: admin._id,
        name: admin.name || admin.email || 'Admin User',
        email: admin.email,
        role: 'Admin',
        userModel: 'Admin'
    })));

    // Add shared users from requirement
    if (project.requirement && project.requirement.sharedWith) {
        for (const sharedUser of project.requirement.sharedWith) {
            if (sharedUser.user && sharedUser.user.toString() !== currentUserId.toString()) {
                // Get user details
                const user = await User.findById(sharedUser.user).select('name email role');
                if (user && user._id) {
                    taggableUsers.push({
                        _id: user._id,
                        name: user.name || user.email || 'User',
                        email: user.email,
                        role: user.role,
                        userModel: 'User'
                    });
                }
            }
        }
    }

    // Remove duplicates and sort by name
    const uniqueUsers = taggableUsers.filter((user, index, self) =>
        index === self.findIndex(u => u._id.toString() === user._id.toString())
    );

    // Sort by name, handling cases where name might be undefined or null
    try {
        return uniqueUsers.sort((a, b) => {
            const nameA = (a.name || a.email || '').toLowerCase();
            const nameB = (b.name || b.email || '').toLowerCase();
            return nameA.localeCompare(nameB);
        });
    } catch (error) {
        console.error('Error sorting taggable users:', error);
        return uniqueUsers; // Return unsorted if sorting fails
    }
}; 