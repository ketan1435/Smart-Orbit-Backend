import Sitework from '../models/sitework.model.js';
import ApiError from '../utils/ApiError.js';
import httpStatus from 'http-status';
import storage from '../factory/storage.factory.js';
import { v4 as uuidv4 } from 'uuid';
import Admin from '../models/admin.model.js';
import User from '../models/user.model.js';
import ProjectAssignmentPaymant from '../models/projectAssignmentPaymant.model.js';
import Project from '../models/project.model.js';


export const createSiteworkService = async (data, user) => {
    // Create the Sitework entry
    const sitework = await Sitework.create({
        name: data.name,
        description: data.description,
        project: data.project,
        startDate: data.startDate,
        endDate: data.endDate,
        status: data.status,
        assignedUsers: data.assignedUsers,
        createdBy: user.id,
        createdByModel: user.role === 'Admin' ? 'Admin' : 'User',
        isActive: true,
    });

    // Create payment records for each assigned user
    await Promise.all(data.assignedUsers.map(async (assigned) => {
        const existing = await ProjectAssignmentPaymant.findOne({
            user: assigned.user,
            project: data.project,
        });

        if (!existing) {
            await ProjectAssignmentPaymant.create({
                user: assigned.user,
                project: data.project,
                assignedAmount: assigned.assignmentAmount,
                perDayAmount: assigned.perDayAmount,
            });
        }
    }));

    return sitework;
};

export const updateSiteworkService = async (id, data, user) => {
    const sitework = await Sitework.findById(id);
    if (!sitework) throw new ApiError(httpStatus.NOT_FOUND, 'Sitework not found');

    // Update fields if provided
    if (data.description !== undefined) sitework.description = data.description;
    if (data.assignedUsers !== undefined) sitework.assignedUsers = data.assignedUsers;
    if (data.endDate !== undefined) sitework.endDate = data.endDate;
    if (data.status !== undefined) sitework.status = data.status;

    // Update assignment payment details
    if (data.assignedUsers && data.assignedUsers.length > 0) {
        await Promise.all(data.assignedUsers.map(async (assigned) => {
            await ProjectAssignmentPaymant.findOneAndUpdate(
                { user: assigned.user, project: sitework.project },
                {
                    assignedAmount: assigned.assignmentAmount,
                    perDayAmount: assigned.perDayAmount,
                },
                { new: true, upsert: true } // upsert ensures a record exists if missing
            );
        }));
    }

    await sitework.save();
    return sitework;
};

export const getSiteworksByProjectService = async (projectId, user) => {
    const filter = { project: projectId };
    // If not admin or site engineer, restrict to assignedUsers
    if (user.role !== 'Admin' && user.role !== 'site-engineer') {
        filter["assignedUsers.user"] = user._id;
    }
    const siteworks = await Sitework.find(filter)
        .sort({ sequence: 1, createdAt: 1 })
        .select('name description status startDate endDate assignedUsers sequence isActive siteworkDocuments')
        .populate('assignedUsers', 'name email role');

    if (user.role !== 'Admin' && user.role !== 'sales-admin' && user.role !== 'site-engineer') {
        // Only show documents uploaded by this user
        siteworks.forEach(sitework => {
            sitework.siteworkDocuments = sitework.siteworkDocuments.filter(
                doc => doc.createdByUser && doc.createdByUser.toString() === user.id
            );
        });
    }
    return siteworks;
};

export const addSiteworkDocumentService = async (siteworkId, data, user) => {
    const sitework = await Sitework.findById(siteworkId);
    if (!sitework) throw new ApiError(httpStatus.NOT_FOUND, 'Sitework not found');

    // Check permission: admin, sales-admin, site engineer, or assigned user
    const isAdmin = user.role === 'Admin' || user.role === 'sales-admin';
    const isSiteEngineer = user.role === 'site-engineer';
    const isAssignedUser = sitework.assignedUsers.map(id => id.user.toString()).includes(user._id.toString());
    if (!isAdmin && !isSiteEngineer && !isAssignedUser) {
        throw new ApiError(httpStatus.FORBIDDEN, 'Not authorized to add documents');
    }

    const { files, userNote } = data;
    const copiedFiles = [];
    try {
        for (const file of files) {
            const fileName = file.key.split('/').pop();
            const permanentKey = `siteworks/${siteworkId}/${uuidv4()}-${fileName}`;
            await storage.copyFile(file.key, permanentKey);
            copiedFiles.push({ ...file, key: permanentKey });
        }
    } catch (err) {
        // Cleanup any copied files
        await Promise.all(copiedFiles.map(f => storage.deleteFile(f.key)));
        throw err;
    }

    // Add document to siteworkDocuments
    const newDoc = {
        files: copiedFiles,
        createdByUser: user.id,
        createdByUserModel: user.role === 'Admin' ? 'Admin' : 'User',
        userNote: userNote || '',
    };
    sitework.siteworkDocuments.push(newDoc);
    await sitework.save();

    // Delete tmp files
    await Promise.all(files.map(f => storage.deleteFile(f.key)));

    // Return the newly added document (last in array)
    return sitework.siteworkDocuments[sitework.siteworkDocuments.length - 1];
};

export const approveOrRejectSiteworkDocumentService = async (siteworkId, docId, data, user) => {
    const sitework = await Sitework.findById(siteworkId);
    if (!sitework) throw new ApiError(httpStatus.NOT_FOUND, 'Sitework not found');
    const doc = sitework.siteworkDocuments.id(docId);
    if (!doc) throw new ApiError(httpStatus.NOT_FOUND, 'Document not found');

    const { status, feedback } = data;
    const now = new Date();

    if (user.role === 'Admin' || user.role === 'sales-admin') {
        doc.adminStatus = status;
        doc.adminFeedback = feedback || '';
        doc.adminFeedbackBy = user.id;
        doc.adminFeedbackByModel = user.role === 'Admin' ? 'Admin' : 'User';
    } else if (user.role === 'site-engineer') {
        doc.siteengineerStatus = status;
        doc.siteengineerFeedback = feedback || '';
        doc.siteengineerFeedbackBy = user.id;
    } else {
        throw new ApiError(httpStatus.FORBIDDEN, 'Not authorized to approve/reject');
    }

    doc.addedAt = doc.addedAt || now;
    await sitework.save();
    return doc;
};

export const getSiteworkDocumentsService = async (siteworkId, user) => {
    const sitework = await Sitework.findById(siteworkId);
    if (!sitework) throw new ApiError(404, 'Sitework not found');
    let documents = sitework.siteworkDocuments || [];

    // Manual population for each document
    for (const doc of documents) {
        // createdByUser
        if (doc.createdByUserModel === 'Admin') {
            doc.createdByUser = await Admin.findById(doc.createdByUser).select('adminName email role');
        } else if (doc.createdByUserModel === 'User') {
            doc.createdByUser = await User.findById(doc.createdByUser).select('name email role');
        }
        // adminFeedbackBy
        if (doc.adminFeedbackBy && doc.adminFeedbackByModel === 'Admin') {
            doc.adminFeedbackByUser = await Admin.findById(doc.adminFeedbackBy).select('adminName email role');
        } else if (doc.adminFeedbackBy && doc.adminFeedbackByModel === 'User') {
            doc.adminFeedbackByUser = await User.findById(doc.adminFeedbackBy).select('name email role');
        }
        // siteengineerFeedbackBy
        if (doc.siteengineerFeedbackBy) {
            doc.siteengineerFeedbackByUser = await User.findById(doc.siteengineerFeedbackBy).select('name email role');
        }
    }

    if (user.role !== 'Admin' && user.role !== 'sales-admin' && user.role !== 'site-engineer') {
        documents = documents.filter(doc => doc.createdByUser?._id?.toString() === user.id);
    }

    // Add createdByUserName, adminFeedbackByUserName, siteengineerFeedbackByUserName for frontend convenience
    documents = documents.map(doc => {
        let createdByUserName = '';
        if (doc.createdByUserModel === 'Admin') {
            createdByUserName = doc.createdByUser?.adminName || '';
        } else {
            createdByUserName = doc.createdByUser?.name || '';
        }
        let adminFeedbackByUserName = '';
        if (doc.adminFeedbackByUser) {
            adminFeedbackByUserName = doc.adminFeedbackByModel === 'Admin' ? (doc.adminFeedbackByUser?.adminName || '') : (doc.adminFeedbackByUser?.name || '');
        }
        let siteengineerFeedbackByUserName = '';
        if (doc.siteengineerFeedbackByUser) {
            siteengineerFeedbackByUserName = doc.siteengineerFeedbackByUser?.name || '';
        }
        return { ...doc.toObject(), createdByUserName, adminFeedbackByUserName, siteengineerFeedbackByUserName };
    });

    return documents;
};
