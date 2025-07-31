import httpStatus from 'http-status';
import Message from '../models/message.model.js';
import ApiError from '../utils/ApiError.js';
import storage from '../factory/storage.factory.js';
import Project from '../models/project.model.js';
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

    // Create message using session
    const messageData = {
        project,
        content,
        sender: req.user.id,
        senderModel: req.user.constructor.modelName,
        files: []
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