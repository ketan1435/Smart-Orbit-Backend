import Sitework from '../models/sitework.model.js';
import ApiError from '../utils/ApiError.js';
import httpStatus from 'http-status';
import storage from '../factory/storage.factory.js';
import { v4 as uuidv4 } from 'uuid';
import Admin from '../models/admin.model.js';
import User from '../models/user.model.js';
import ProjectAssignmentPaymant from '../models/projectAssignmentPaymant.model.js';
import Project from '../models/project.model.js';
import Roles from '../config/enums/roles.enum.js';


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
        // const existing = await ProjectAssignmentPaymant.findOne({
        //     user: assigned.user,
        //     project: data.project,
        // });

        if (true) {
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
    if (user.role !== 'Admin' && user.role !== 'site-engineer' && user.role !== Roles.USER) {
        filter["assignedUsers.user"] = user._id;
    }
    const siteworks = await Sitework.find(filter)
        .sort({ sequence: 1, createdAt: 1 })
        .select('name description status startDate endDate assignedUsers sequence isActive siteworkDocuments')
        .populate('assignedUsers', 'name email role');

    if (user.role === Roles.USER) {
        siteworks.forEach(sitework => {
            sitework.siteworkDocuments = sitework.siteworkDocuments.filter(doc => doc.sentToCustomer === true);
        });
        return siteworks;
    }

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
    } else if (user.role === Roles.USER) {
        doc.customerStatus = status;
        doc.customerFeedback = feedback || '';
        doc.customerFeedbackBy = user.id;
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
        // customerFeedbackBy
        if (doc.customerFeedbackBy) {
            doc.customerFeedbackByUser = await User.findById(doc.customerFeedbackBy).select('name email role');
        }
        // sentToCustomerBy
        if (doc.sentToCustomerBy && doc.sentToCustomerByModel === 'Admin') {
            doc.sentToCustomerByUser = await Admin.findById(doc.sentToCustomerBy).select('adminName email role');
        } else if (doc.sentToCustomerBy && doc.sentToCustomerByModel === 'User') {
            doc.sentToCustomerByUser = await User.findById(doc.sentToCustomerBy).select('name email role');
        }
    }

    if (user.role !== 'Admin' && user.role !== 'sales-admin' && user.role !== 'site-engineer') {
        if (user.role === Roles.USER) {
            documents = documents.filter(doc => doc.sentToCustomer === true);
        } else {
            documents = documents.filter(doc => doc.createdByUser?._id?.toString() === user.id);
        }
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
        let customerFeedbackByUserName = '';
        if (doc.customerFeedbackByUser) {
            customerFeedbackByUserName = doc.customerFeedbackByUser?.name || '';
        }
        let sentToCustomerByUserName = '';
        if (doc.sentToCustomerByUser) {
            sentToCustomerByUserName = doc.sentToCustomerByModel === 'Admin' ? (doc.sentToCustomerByUser?.adminName || '') : (doc.sentToCustomerByUser?.name || '');
        }
        return {
            ...doc.toObject(),
            createdByUserName,
            adminFeedbackByUserName,
            siteengineerFeedbackByUserName,
            customerFeedbackByUserName,
            sentToCustomerByUserName
        };
    });

    return documents;
};

export const getSiteworkDocumentsForCustomerService = async (projectId, user) => {
    // Verify user is a customer and has access to this project
    if (user.role !== 'Customer') {
        throw new ApiError(httpStatus.FORBIDDEN, 'Only customers can access this endpoint');
    }

    // Get all siteworks for the project
    const siteworks = await Sitework.find({
        project: projectId,
        isActive: true
    }).select('name description status siteworkDocuments');

    if (!siteworks || siteworks.length === 0) {
        return [];
    }

    const allDocuments = [];

    // Process each sitework and its documents
    for (const sitework of siteworks) {
        const documents = sitework.siteworkDocuments || [];

        // Filter documents that are approved by site engineers and admin (ready for customer review)
        const customerDocuments = documents.filter(doc =>
            doc.siteengineerStatus === 'Approved' &&
            doc.adminStatus === 'Approved'
        );

        // Manual population for each document
        for (const doc of customerDocuments) {
            // createdByUser
            if (doc.createdByUserModel === 'Admin') {
                doc.createdByUser = await Admin.findById(doc.createdByUser).select('adminName email role');
            } else if (doc.createdByUserModel === 'User') {
                doc.createdByUser = await User.findById(doc.createdByUser).select('name email role');
            }
            // siteengineerFeedbackBy
            if (doc.siteengineerFeedbackBy) {
                doc.siteengineerFeedbackByUser = await User.findById(doc.siteengineerFeedbackBy).select('name email role');
            }
            // adminFeedbackBy
            if (doc.adminFeedbackBy && doc.adminFeedbackByModel === 'Admin') {
                doc.adminFeedbackByUser = await Admin.findById(doc.adminFeedbackBy).select('adminName email role');
            } else if (doc.adminFeedbackBy && doc.adminFeedbackByModel === 'User') {
                doc.adminFeedbackByUser = await User.findById(doc.adminFeedbackBy).select('name email role');
            }
            // customerFeedbackBy
            if (doc.customerFeedbackBy) {
                doc.customerFeedbackByUser = await User.findById(doc.customerFeedbackBy).select('name email role');
            }
        }

        // Add sitework context to each document
        const documentsWithContext = customerDocuments.map(doc => {
            let createdByUserName = '';
            if (doc.createdByUserModel === 'Admin') {
                createdByUserName = doc.createdByUser?.adminName || '';
            } else {
                createdByUserName = doc.createdByUser?.name || '';
            }
            let siteengineerFeedbackByUserName = '';
            if (doc.siteengineerFeedbackByUser) {
                siteengineerFeedbackByUserName = doc.siteengineerFeedbackByUser?.name || '';
            }
            let adminFeedbackByUserName = '';
            if (doc.adminFeedbackByUser) {
                adminFeedbackByUserName = doc.adminFeedbackByModel === 'Admin' ? (doc.adminFeedbackByUser?.adminName || '') : (doc.adminFeedbackByUser?.name || '');
            }
            let customerFeedbackByUserName = '';
            if (doc.customerFeedbackByUser) {
                customerFeedbackByUserName = doc.customerFeedbackByUser?.name || '';
            }

            return {
                ...doc.toObject(),
                createdByUserName,
                siteengineerFeedbackByUserName,
                adminFeedbackByUserName,
                customerFeedbackByUserName,
                siteworkName: sitework.name,
                siteworkDescription: sitework.description,
                siteworkStatus: sitework.status,
                siteworkId: sitework._id
            };
        });

        allDocuments.push(...documentsWithContext);
    }

    // Sort by creation date (newest first)
    allDocuments.sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));

    return allDocuments;
};

export const customerReviewSiteworkDocumentService = async (projectId, siteworkId, docId, data, user) => {
    // Verify user is a customer
    if (user.role !== Roles.USER) {
        throw new ApiError(httpStatus.FORBIDDEN, 'Only customers can review documents');
    }

    // Find the sitework and verify it belongs to the project
    const sitework = await Sitework.findOne({
        _id: siteworkId,
        project: projectId,
        isActive: true
    });

    if (!sitework) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Sitework not found');
    }

    // Find the document
    const doc = sitework.siteworkDocuments.id(docId);
    if (!doc) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Document not found');
    }

    // Verify the document has been approved by both site engineer and admin
    if (doc.siteengineerStatus !== 'Approved' || doc.adminStatus !== 'Approved') {
        throw new ApiError(httpStatus.FORBIDDEN, 'Document must be approved by site engineer and admin before customer review');
    }

    const { status, feedback } = data;
    const now = new Date();

    // Update customer review status
    doc.customerStatus = status;
    doc.customerFeedback = feedback || '';
    doc.customerFeedbackBy = user._id;
    doc.customerReviewedAt = now;

    await sitework.save();

    // Populate user information for response
    if (doc.createdByUserModel === 'Admin') {
        doc.createdByUser = await Admin.findById(doc.createdByUser).select('adminName email role');
    } else if (doc.createdByUserModel === 'User') {
        doc.createdByUser = await User.findById(doc.createdByUser).select('name email role');
    }

    if (doc.siteengineerFeedbackBy) {
        doc.siteengineerFeedbackByUser = await User.findById(doc.siteengineerFeedbackBy).select('name email role');
    }

    if (doc.adminFeedbackBy && doc.adminFeedbackByModel === 'Admin') {
        doc.adminFeedbackByUser = await Admin.findById(doc.adminFeedbackBy).select('adminName email role');
    } else if (doc.adminFeedbackBy && doc.adminFeedbackByModel === 'User') {
        doc.adminFeedbackByUser = await User.findById(doc.adminFeedbackBy).select('name email role');
    }

    // Add convenience fields for frontend
    let createdByUserName = '';
    if (doc.createdByUserModel === 'Admin') {
        createdByUserName = doc.createdByUser?.adminName || '';
    } else {
        createdByUserName = doc.createdByUser?.name || '';
    }

    let siteengineerFeedbackByUserName = '';
    if (doc.siteengineerFeedbackByUser) {
        siteengineerFeedbackByUserName = doc.siteengineerFeedbackByUser?.name || '';
    }

    let adminFeedbackByUserName = '';
    if (doc.adminFeedbackByUser) {
        adminFeedbackByUserName = doc.adminFeedbackByModel === 'Admin' ? (doc.adminFeedbackByUser?.adminName || '') : (doc.adminFeedbackByUser?.name || '');
    }

    return {
        ...doc.toObject(),
        createdByUserName,
        siteengineerFeedbackByUserName,
        adminFeedbackByUserName,
        siteworkName: sitework.name,
        siteworkDescription: sitework.description,
        siteworkStatus: sitework.status
    };
};

export const sendSiteworkDocumentToCustomerService = async (projectId, siteworkId, docId, user) => {
    // Verify user is an admin or sales-admin
    if (user.role !== 'Admin' && user.role !== 'sales-admin') {
        throw new ApiError(httpStatus.FORBIDDEN, 'Only admins can send documents to customers');
    }

    // Find the sitework and verify it belongs to the project
    const sitework = await Sitework.findOne({
        _id: siteworkId,
        project: projectId,
        isActive: true
    });

    if (!sitework) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Sitework not found');
    }

    // Find the document
    const doc = sitework.siteworkDocuments.id(docId);
    if (!doc) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Document not found');
    }

    // Verify the document has been approved by both site engineer and admin
    if (doc.siteengineerStatus !== 'Approved' || doc.adminStatus !== 'Approved') {
        throw new ApiError(httpStatus.FORBIDDEN, 'Document must be approved by site engineer and admin before sending to customer');
    }

    // Check if document is already sent to customer
    if (doc.customerStatus !== 'Pending') {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Document has already been sent to customer for review');
    }

    // Update document to indicate it's sent to customer
    doc.customerStatus = 'Pending'; // Reset to pending for customer review
    doc.sentToCustomer = true;
    doc.sentToCustomerAt = new Date();
    doc.sentToCustomerBy = user.id;
    doc.sentToCustomerByModel = user.role === 'Admin' ? 'Admin' : 'User';

    await sitework.save();

    // Populate user information for response
    if (doc.createdByUserModel === 'Admin') {
        doc.createdByUser = await Admin.findById(doc.createdByUser).select('adminName email role');
    } else if (doc.createdByUserModel === 'User') {
        doc.createdByUser = await User.findById(doc.createdByUser).select('name email role');
    }

    if (doc.siteengineerFeedbackBy) {
        doc.siteengineerFeedbackByUser = await User.findById(doc.siteengineerFeedbackBy).select('name email role');
    }

    if (doc.adminFeedbackBy && doc.adminFeedbackByModel === 'Admin') {
        doc.adminFeedbackByUser = await Admin.findById(doc.adminFeedbackBy).select('adminName email role');
    } else if (doc.adminFeedbackBy && doc.adminFeedbackByModel === 'User') {
        doc.adminFeedbackByUser = await User.findById(doc.adminFeedbackBy).select('name email role');
    }

    // Add convenience fields for frontend
    let createdByUserName = '';
    if (doc.createdByUserModel === 'Admin') {
        createdByUserName = doc.createdByUser?.adminName || '';
    } else {
        createdByUserName = doc.createdByUser?.name || '';
    }

    let siteengineerFeedbackByUserName = '';
    if (doc.siteengineerFeedbackByUser) {
        siteengineerFeedbackByUserName = doc.siteengineerFeedbackByUser?.name || '';
    }

    let adminFeedbackByUserName = '';
    if (doc.adminFeedbackByUser) {
        adminFeedbackByUserName = doc.adminFeedbackByModel === 'Admin' ? (doc.adminFeedbackByUser?.adminName || '') : (doc.adminFeedbackByUser?.name || '');
    }

    let sentToCustomerByUserName = '';
    if (doc.sentToCustomerByModel === 'Admin') {
        sentToCustomerByUserName = doc.sentToCustomerByUser?.adminName || '';
    } else {
        sentToCustomerByUserName = doc.sentToCustomerByUser?.name || '';
    }

    return {
        ...doc.toObject(),
        createdByUserName,
        siteengineerFeedbackByUserName,
        adminFeedbackByUserName,
        sentToCustomerByUserName,
        siteworkName: sitework.name,
        siteworkDescription: sitework.description,
        siteworkStatus: sitework.status
    };
};
