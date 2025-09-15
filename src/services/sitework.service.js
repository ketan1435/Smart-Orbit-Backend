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
import { logActivity } from '../middlewares/activityLog.middleware.js';


export const createSiteworkService = async (req, data, user) => {
    // Get project details for logging
    const project = await Project.findById(data.project).populate('architect', 'name email');
    if (!project) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
    }

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
    const paymentRecords = [];
    await Promise.all(data.assignedUsers.map(async (assigned) => {
        // const existing = await ProjectAssignmentPaymant.findOne({
        //     user: assigned.user,
        //     project: data.project,
        // });

        if (true) {
            const paymentRecord = await ProjectAssignmentPaymant.create({
                user: assigned.user,
                project: data.project,
                assignedAmount: assigned.assignmentAmount,
                perDayAmount: assigned.perDayAmount,
            });
            paymentRecords.push(paymentRecord);
        }
    }));

    // Log the sitework creation activity
    try {
        await logActivity(req, {
            action: 'create_sitework',
            targetModel: 'Sitework',
            targetId: sitework._id,
            targetName: sitework.name || 'Sitework',
            description: `${user.role === 'Admin' ? 'Admin' : 'User'} ${user.name} (${user.email}) created sitework "${sitework.name}" for project: ${project.projectName || 'Unknown Project'}`,
            changes: {
                siteworkCreated: {
                    from: null,
                    to: sitework._id
                },
                name: {
                    from: null,
                    to: sitework.name
                },
                description: {
                    from: null,
                    to: sitework.description
                },
                project: {
                    from: null,
                    to: sitework.project
                },
                startDate: {
                    from: null,
                    to: sitework.startDate
                },
                endDate: {
                    from: null,
                    to: sitework.endDate
                },
                status: {
                    from: null,
                    to: sitework.status
                },
                assignedUsers: {
                    from: null,
                    to: sitework.assignedUsers
                },
                createdBy: {
                    from: null,
                    to: user.id
                },
                createdByModel: {
                    from: null,
                    to: user.role === 'Admin' ? 'Admin' : 'User'
                },
                isActive: {
                    from: null,
                    to: true
                }
            },
            metadata: {
                projectId: project._id,
                projectData: {
                    projectId: project._id,
                    projectName: project.projectName,
                    projectCode: project.projectCode,
                    status: project.status,
                    customerName: project.customerName,
                    requirementType: project.requirementType,
                    architect: project.architect
                },
                user: {
                    userId: user._id,
                    userName: user.name,
                    userEmail: user.email,
                    userRole: user.role,
                    userType: user.role === 'Admin' ? 'Admin' : 'User',
                    userPhone: user.phone
                },
                siteworkData: {
                    siteworkId: sitework._id,
                    name: sitework.name,
                    description: sitework.description,
                    project: sitework.project,
                    startDate: sitework.startDate,
                    endDate: sitework.endDate,
                    status: sitework.status,
                    assignedUsers: sitework.assignedUsers,
                    createdBy: sitework.createdBy,
                    createdByModel: sitework.createdByModel,
                    isActive: sitework.isActive,
                    createdAt: sitework.createdAt,
                    updatedAt: sitework.updatedAt
                },
                siteworkCreation: {
                    siteworkCreated: true,
                    createdBy: user.id,
                    createdByModel: user.role === 'Admin' ? 'Admin' : 'User',
                    createdAt: new Date(),
                    assignedUsersCount: sitework.assignedUsers.length,
                    paymentRecordsCreated: paymentRecords.length,
                    duration: sitework.endDate && sitework.startDate ?
                        Math.ceil((new Date(sitework.endDate) - new Date(sitework.startDate)) / (1000 * 60 * 60 * 24)) : null
                },
                assignedUsersData: {
                    totalAssignedUsers: sitework.assignedUsers.length,
                    assignedUserIds: sitework.assignedUsers.map(au => au.user),
                    totalAssignedAmount: sitework.assignedUsers.reduce((sum, au) => sum + (au.assignmentAmount || 0), 0),
                    totalPerDayAmount: sitework.assignedUsers.reduce((sum, au) => sum + (au.perDayAmount || 0), 0),
                    averageAssignedAmount: sitework.assignedUsers.length > 0 ?
                        sitework.assignedUsers.reduce((sum, au) => sum + (au.assignmentAmount || 0), 0) / sitework.assignedUsers.length : 0,
                    averagePerDayAmount: sitework.assignedUsers.length > 0 ?
                        sitework.assignedUsers.reduce((sum, au) => sum + (au.perDayAmount || 0), 0) / sitework.assignedUsers.length : 0
                },
                paymentRecordsData: {
                    paymentRecordsCreated: paymentRecords.length,
                    totalAssignedAmount: paymentRecords.reduce((sum, pr) => sum + (pr.assignedAmount || 0), 0),
                    totalPerDayAmount: paymentRecords.reduce((sum, pr) => sum + (pr.perDayAmount || 0), 0),
                    averageAssignedAmount: paymentRecords.length > 0 ?
                        paymentRecords.reduce((sum, pr) => sum + (pr.assignedAmount || 0), 0) / paymentRecords.length : 0,
                    averagePerDayAmount: paymentRecords.length > 0 ?
                        paymentRecords.reduce((sum, pr) => sum + (pr.perDayAmount || 0), 0) / paymentRecords.length : 0
                },
                contentSections: {
                    totalSections: 7,
                    completedSections: [
                        sitework.name ? 'name' : null,
                        sitework.description ? 'description' : null,
                        sitework.project ? 'project' : null,
                        sitework.startDate ? 'startDate' : null,
                        sitework.endDate ? 'endDate' : null,
                        sitework.status ? 'status' : null,
                        sitework.assignedUsers.length > 0 ? 'assignedUsers' : null
                    ].filter(Boolean).length,
                    sectionsProvided: [
                        sitework.name ? 'name' : null,
                        sitework.description ? 'description' : null,
                        sitework.project ? 'project' : null,
                        sitework.startDate ? 'startDate' : null,
                        sitework.endDate ? 'endDate' : null,
                        sitework.status ? 'status' : null,
                        sitework.assignedUsers.length > 0 ? 'assignedUsers' : null
                    ].filter(Boolean)
                },
                workflow: {
                    siteworkCreation: true,
                    siteworkWorkflow: true,
                    projectWorkflow: true,
                    userAssignment: true,
                    paymentSetup: true,
                    creationComplete: true
                }
            }
        });
    } catch (error) {
        console.error('Error logging sitework creation:', error);
    }

    return sitework;
};

export const updateSiteworkService = async (req, id, data, user) => {
    const sitework = await Sitework.findById(id).populate('project', 'projectName projectCode status customerName requirementType architect');
    if (!sitework) throw new ApiError(httpStatus.NOT_FOUND, 'Sitework not found');

    // Store original values for logging
    const originalDescription = sitework.description;
    const originalAssignedUsers = JSON.parse(JSON.stringify(sitework.assignedUsers));
    const originalEndDate = sitework.endDate;
    const originalStatus = sitework.status;
    const originalUpdatedAt = sitework.updatedAt;

    // Update fields if provided
    if (data.description !== undefined) sitework.description = data.description;
    if (data.assignedUsers !== undefined) sitework.assignedUsers = data.assignedUsers;
    if (data.endDate !== undefined) sitework.endDate = data.endDate;
    if (data.status !== undefined) sitework.status = data.status;

    // Update assignment payment details
    const updatedPaymentRecords = [];
    if (data.assignedUsers && data.assignedUsers.length > 0) {
        await Promise.all(data.assignedUsers.map(async (assigned) => {
            const paymentRecord = await ProjectAssignmentPaymant.findOneAndUpdate(
                { user: assigned.user, project: sitework.project },
                {
                    assignedAmount: assigned.assignmentAmount,
                    perDayAmount: assigned.perDayAmount,
                },
                { new: true, upsert: true } // upsert ensures a record exists if missing
            );
            updatedPaymentRecords.push(paymentRecord);
        }));
    }

    sitework.updatedAt = new Date();
    await sitework.save();

    // Log the sitework update activity
    try {
        await logActivity(req, {
            action: 'update_sitework',
            targetModel: 'Sitework',
            targetId: sitework._id,
            targetName: sitework.name || 'Sitework',
            description: `${user.role === 'Admin' ? 'Admin' : 'User'} ${user.name} (${user.email}) updated sitework "${sitework.name}" for project: ${sitework.project?.projectName || 'Unknown Project'}`,
            changes: {
                description: {
                    from: originalDescription,
                    to: sitework.description
                },
                assignedUsers: {
                    from: originalAssignedUsers,
                    to: sitework.assignedUsers
                },
                endDate: {
                    from: originalEndDate,
                    to: sitework.endDate
                },
                status: {
                    from: originalStatus,
                    to: sitework.status
                },
                updatedAt: {
                    from: originalUpdatedAt,
                    to: new Date()
                }
            },
            metadata: {
                projectId: sitework.project?._id,
                projectData: {
                    projectId: sitework.project?._id,
                    projectName: sitework.project?.projectName,
                    projectCode: sitework.project?.projectCode,
                    status: sitework.project?.status,
                    customerName: sitework.project?.customerName,
                    requirementType: sitework.project?.requirementType,
                    architect: sitework.project?.architect
                },
                user: {
                    userId: user._id,
                    userName: user.name,
                    userEmail: user.email,
                    userRole: user.role,
                    userType: user.role === 'Admin' ? 'Admin' : 'User',
                    userPhone: user.phone
                },
                siteworkData: {
                    siteworkId: sitework._id,
                    name: sitework.name,
                    description: sitework.description,
                    project: sitework.project,
                    startDate: sitework.startDate,
                    endDate: sitework.endDate,
                    status: sitework.status,
                    assignedUsers: sitework.assignedUsers,
                    createdBy: sitework.createdBy,
                    createdByModel: sitework.createdByModel,
                    isActive: sitework.isActive,
                    createdAt: sitework.createdAt,
                    updatedAt: sitework.updatedAt
                },
                siteworkUpdate: {
                    siteworkUpdated: true,
                    updatedBy: user.id,
                    updatedByModel: user.role === 'Admin' ? 'Admin' : 'User',
                    updatedAt: new Date(),
                    descriptionUpdated: data.description !== undefined,
                    assignedUsersUpdated: data.assignedUsers !== undefined,
                    endDateUpdated: data.endDate !== undefined,
                    statusUpdated: data.status !== undefined,
                    paymentRecordsUpdated: updatedPaymentRecords.length,
                    assignedUsersCount: sitework.assignedUsers.length,
                    previousAssignedUsersCount: originalAssignedUsers.length
                },
                assignedUsersData: {
                    totalAssignedUsers: sitework.assignedUsers.length,
                    previousTotalAssignedUsers: originalAssignedUsers.length,
                    assignedUserIds: sitework.assignedUsers.map(au => au.user),
                    previousAssignedUserIds: originalAssignedUsers.map(au => au.user),
                    totalAssignedAmount: sitework.assignedUsers.reduce((sum, au) => sum + (au.assignmentAmount || 0), 0),
                    previousTotalAssignedAmount: originalAssignedUsers.reduce((sum, au) => sum + (au.assignmentAmount || 0), 0),
                    totalPerDayAmount: sitework.assignedUsers.reduce((sum, au) => sum + (au.perDayAmount || 0), 0),
                    previousTotalPerDayAmount: originalAssignedUsers.reduce((sum, au) => sum + (au.perDayAmount || 0), 0),
                    averageAssignedAmount: sitework.assignedUsers.length > 0 ?
                        sitework.assignedUsers.reduce((sum, au) => sum + (au.assignmentAmount || 0), 0) / sitework.assignedUsers.length : 0,
                    averagePerDayAmount: sitework.assignedUsers.length > 0 ?
                        sitework.assignedUsers.reduce((sum, au) => sum + (au.perDayAmount || 0), 0) / sitework.assignedUsers.length : 0
                },
                paymentRecordsData: {
                    paymentRecordsUpdated: updatedPaymentRecords.length,
                    totalAssignedAmount: updatedPaymentRecords.reduce((sum, pr) => sum + (pr.assignedAmount || 0), 0),
                    totalPerDayAmount: updatedPaymentRecords.reduce((sum, pr) => sum + (pr.perDayAmount || 0), 0),
                    averageAssignedAmount: updatedPaymentRecords.length > 0 ?
                        updatedPaymentRecords.reduce((sum, pr) => sum + (pr.assignedAmount || 0), 0) / updatedPaymentRecords.length : 0,
                    averagePerDayAmount: updatedPaymentRecords.length > 0 ?
                        updatedPaymentRecords.reduce((sum, pr) => sum + (pr.perDayAmount || 0), 0) / updatedPaymentRecords.length : 0
                },
                contentSections: {
                    totalSections: 7,
                    completedSections: [
                        sitework.name ? 'name' : null,
                        sitework.description ? 'description' : null,
                        sitework.project ? 'project' : null,
                        sitework.startDate ? 'startDate' : null,
                        sitework.endDate ? 'endDate' : null,
                        sitework.status ? 'status' : null,
                        sitework.assignedUsers.length > 0 ? 'assignedUsers' : null
                    ].filter(Boolean).length,
                    sectionsProvided: [
                        sitework.name ? 'name' : null,
                        sitework.description ? 'description' : null,
                        sitework.project ? 'project' : null,
                        sitework.startDate ? 'startDate' : null,
                        sitework.endDate ? 'endDate' : null,
                        sitework.status ? 'status' : null,
                        sitework.assignedUsers.length > 0 ? 'assignedUsers' : null
                    ].filter(Boolean)
                },
                workflow: {
                    siteworkUpdate: true,
                    siteworkWorkflow: true,
                    projectWorkflow: true,
                    userAssignment: true,
                    paymentUpdate: true,
                    updateComplete: true
                }
            }
        });
    } catch (error) {
        console.error('Error logging sitework update:', error);
    }

    return sitework;
};

export const getSiteworksByProjectService = async (projectId, user) => {
    const filter = { project: projectId };
    // If not admin, site engineer, or planning engineer, restrict to assignedUsers
    if (user.role !== 'Admin' && user.role !== 'site-engineer' && user.role !== 'planning-engineer' && user.role !== Roles.USER) {
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

export const approveOrRejectSiteworkDocumentService = async (req, siteworkId, docId, data, user) => {
    const sitework = await Sitework.findById(siteworkId).populate('project', 'projectName projectCode status customerName requirementType architect');
    if (!sitework) throw new ApiError(httpStatus.NOT_FOUND, 'Sitework not found');
    const doc = sitework.siteworkDocuments.id(docId);
    if (!doc) throw new ApiError(httpStatus.NOT_FOUND, 'Document not found');

    const { status, feedback } = data;
    const now = new Date();

    // Store original values for logging
    const originalAdminStatus = doc.adminStatus;
    const originalAdminFeedback = doc.adminFeedback;
    const originalAdminFeedbackBy = doc.adminFeedbackBy;
    const originalAdminFeedbackByModel = doc.adminFeedbackByModel;
    const originalSiteengineerStatus = doc.siteengineerStatus;
    const originalSiteengineerFeedback = doc.siteengineerFeedback;
    const originalSiteengineerFeedbackBy = doc.siteengineerFeedbackBy;
    const originalCustomerStatus = doc.customerStatus;
    const originalCustomerFeedback = doc.customerFeedback;
    const originalCustomerFeedbackBy = doc.customerFeedbackBy;

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

    // Log the sitework document approval/rejection activity
    try {
        await logActivity(req, {
            action: 'approve_or_reject_sitework_document',
            targetModel: 'SiteworkDocument',
            targetId: doc._id,
            targetName: `Document in ${sitework.name || 'Sitework'}`,
            description: `${user.role === 'Admin' ? 'Admin' : user.role === 'sales-admin' ? 'Sales Admin' : user.role === 'site-engineer' ? 'Site Engineer' : 'Customer'} ${user.name} (${user.email}) ${status.toLowerCase()}ed sitework document in "${sitework.name}" for project: ${sitework.project?.projectName || 'Unknown Project'}`,
            changes: {
                adminStatus: {
                    from: originalAdminStatus,
                    to: doc.adminStatus
                },
                adminFeedback: {
                    from: originalAdminFeedback,
                    to: doc.adminFeedback
                },
                adminFeedbackBy: {
                    from: originalAdminFeedbackBy,
                    to: doc.adminFeedbackBy
                },
                adminFeedbackByModel: {
                    from: originalAdminFeedbackByModel,
                    to: doc.adminFeedbackByModel
                },
                siteengineerStatus: {
                    from: originalSiteengineerStatus,
                    to: doc.siteengineerStatus
                },
                siteengineerFeedback: {
                    from: originalSiteengineerFeedback,
                    to: doc.siteengineerFeedback
                },
                siteengineerFeedbackBy: {
                    from: originalSiteengineerFeedbackBy,
                    to: doc.siteengineerFeedbackBy
                },
                customerStatus: {
                    from: originalCustomerStatus,
                    to: doc.customerStatus
                },
                customerFeedback: {
                    from: originalCustomerFeedback,
                    to: doc.customerFeedback
                },
                customerFeedbackBy: {
                    from: originalCustomerFeedbackBy,
                    to: doc.customerFeedbackBy
                }
            },
            metadata: {
                projectId: sitework.project?._id,
                projectData: {
                    projectId: sitework.project?._id,
                    projectName: sitework.project?.projectName,
                    projectCode: sitework.project?.projectCode,
                    status: sitework.project?.status,
                    customerName: sitework.project?.customerName,
                    requirementType: sitework.project?.requirementType,
                    architect: sitework.project?.architect
                },
                user: {
                    userId: user._id,
                    userName: user.name,
                    userEmail: user.email,
                    userRole: user.role,
                    userType: user.role === 'Admin' ? 'Admin' : user.role === 'sales-admin' ? 'Sales Admin' : user.role === 'site-engineer' ? 'Site Engineer' : 'Customer',
                    userPhone: user.phone
                },
                siteworkData: {
                    siteworkId: sitework._id,
                    name: sitework.name,
                    description: sitework.description,
                    project: sitework.project,
                    startDate: sitework.startDate,
                    endDate: sitework.endDate,
                    status: sitework.status,
                    assignedUsers: sitework.assignedUsers,
                    createdBy: sitework.createdBy,
                    createdByModel: sitework.createdByModel,
                    isActive: sitework.isActive,
                    createdAt: sitework.createdAt,
                    updatedAt: sitework.updatedAt
                },
                documentData: {
                    documentId: doc._id,
                    files: doc.files,
                    createdByUser: doc.createdByUser,
                    createdByUserModel: doc.createdByUserModel,
                    userNote: doc.userNote,
                    addedAt: doc.addedAt,
                    adminStatus: doc.adminStatus,
                    adminFeedback: doc.adminFeedback,
                    adminFeedbackBy: doc.adminFeedbackBy,
                    adminFeedbackByModel: doc.adminFeedbackByModel,
                    siteengineerStatus: doc.siteengineerStatus,
                    siteengineerFeedback: doc.siteengineerFeedback,
                    siteengineerFeedbackBy: doc.siteengineerFeedbackBy,
                    customerStatus: doc.customerStatus,
                    customerFeedback: doc.customerFeedback,
                    customerFeedbackBy: doc.customerFeedbackBy,
                    sentToCustomer: doc.sentToCustomer,
                    sentToCustomerAt: doc.sentToCustomerAt,
                    sentToCustomerBy: doc.sentToCustomerBy,
                    sentToCustomerByModel: doc.sentToCustomerByModel
                },
                documentReview: {
                    documentReviewed: true,
                    reviewedBy: user.id,
                    reviewedByModel: user.role === 'Admin' ? 'Admin' : user.role === 'sales-admin' ? 'Sales Admin' : user.role === 'site-engineer' ? 'Site Engineer' : 'Customer',
                    reviewedAt: new Date(),
                    reviewStatus: status,
                    reviewAction: status.toLowerCase(),
                    feedbackProvided: feedback ? true : false,
                    feedbackLength: feedback ? feedback.length : 0,
                    reviewType: user.role === 'Admin' || user.role === 'sales-admin' ? 'admin' :
                        user.role === 'site-engineer' ? 'siteengineer' : 'customer'
                },
                filesData: {
                    totalFiles: doc.files ? doc.files.length : 0,
                    fileTypes: doc.files ? [...new Set(doc.files.map(f => f.fileType))] : [],
                    totalFileSize: doc.files ? doc.files.reduce((sum, f) => sum + (f.size || 0), 0) : 0
                },
                contentSections: {
                    totalSections: 8,
                    completedSections: [
                        doc.files && doc.files.length > 0 ? 'files' : null,
                        doc.createdByUser ? 'createdByUser' : null,
                        doc.userNote ? 'userNote' : null,
                        doc.adminStatus ? 'adminStatus' : null,
                        doc.siteengineerStatus ? 'siteengineerStatus' : null,
                        doc.customerStatus ? 'customerStatus' : null,
                        doc.sentToCustomer ? 'sentToCustomer' : null,
                        doc.addedAt ? 'addedAt' : null
                    ].filter(Boolean).length,
                    sectionsProvided: [
                        doc.files && doc.files.length > 0 ? 'files' : null,
                        doc.createdByUser ? 'createdByUser' : null,
                        doc.userNote ? 'userNote' : null,
                        doc.adminStatus ? 'adminStatus' : null,
                        doc.siteengineerStatus ? 'siteengineerStatus' : null,
                        doc.customerStatus ? 'customerStatus' : null,
                        doc.sentToCustomer ? 'sentToCustomer' : null,
                        doc.addedAt ? 'addedAt' : null
                    ].filter(Boolean)
                },
                workflow: {
                    documentReview: true,
                    siteworkWorkflow: true,
                    projectWorkflow: true,
                    documentWorkflow: true,
                    approvalWorkflow: status === 'Approved',
                    rejectionWorkflow: status === 'Rejected',
                    reviewComplete: true
                }
            }
        });
    } catch (error) {
        console.error('Error logging sitework document approval/rejection:', error);
    }

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

export const customerReviewSiteworkDocumentService = async (req, projectId, siteworkId, docId, data, user) => {
    // Verify user is a customer
    if (user.role !== Roles.USER) {
        throw new ApiError(httpStatus.FORBIDDEN, 'Only customers can review documents');
    }

    // Find the sitework and verify it belongs to the project
    const sitework = await Sitework.findOne({
        _id: siteworkId,
        project: projectId,
        isActive: true
    }).populate('project', 'projectName projectCode status customerName requirementType architect');

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

    // Store original values for logging
    const originalCustomerStatus = doc.customerStatus;
    const originalCustomerFeedback = doc.customerFeedback;
    const originalCustomerFeedbackBy = doc.customerFeedbackBy;
    const originalCustomerReviewedAt = doc.customerReviewedAt;

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

    // Log the customer sitework document review activity
    try {
        await logActivity(req, {
            action: 'customer_review_sitework_document',
            targetModel: 'SiteworkDocument',
            targetId: doc._id,
            targetName: `Document in ${sitework.name || 'Sitework'}`,
            description: `Customer ${user.name} (${user.email}) ${status.toLowerCase()}ed sitework document in "${sitework.name}" for project: ${sitework.project?.projectName || 'Unknown Project'}`,
            changes: {
                customerStatus: {
                    from: originalCustomerStatus,
                    to: doc.customerStatus
                },
                customerFeedback: {
                    from: originalCustomerFeedback,
                    to: doc.customerFeedback
                },
                customerFeedbackBy: {
                    from: originalCustomerFeedbackBy,
                    to: doc.customerFeedbackBy
                },
                customerReviewedAt: {
                    from: originalCustomerReviewedAt,
                    to: doc.customerReviewedAt
                }
            },
            metadata: {
                projectId: sitework.project?._id,
                projectData: {
                    projectId: sitework.project?._id,
                    projectName: sitework.project?.projectName,
                    projectCode: sitework.project?.projectCode,
                    status: sitework.project?.status,
                    customerName: sitework.project?.customerName,
                    requirementType: sitework.project?.requirementType,
                    architect: sitework.project?.architect
                },
                user: {
                    userId: user._id,
                    userName: user.name,
                    userEmail: user.email,
                    userRole: user.role,
                    userType: 'Customer',
                    userPhone: user.phone
                },
                siteworkData: {
                    siteworkId: sitework._id,
                    name: sitework.name,
                    description: sitework.description,
                    project: sitework.project,
                    startDate: sitework.startDate,
                    endDate: sitework.endDate,
                    status: sitework.status,
                    assignedUsers: sitework.assignedUsers,
                    createdBy: sitework.createdBy,
                    createdByModel: sitework.createdByModel,
                    isActive: sitework.isActive,
                    createdAt: sitework.createdAt,
                    updatedAt: sitework.updatedAt
                },
                documentData: {
                    documentId: doc._id,
                    files: doc.files,
                    createdByUser: doc.createdByUser,
                    createdByUserModel: doc.createdByUserModel,
                    userNote: doc.userNote,
                    addedAt: doc.addedAt,
                    adminStatus: doc.adminStatus,
                    adminFeedback: doc.adminFeedback,
                    adminFeedbackBy: doc.adminFeedbackBy,
                    adminFeedbackByModel: doc.adminFeedbackByModel,
                    siteengineerStatus: doc.siteengineerStatus,
                    siteengineerFeedback: doc.siteengineerFeedback,
                    siteengineerFeedbackBy: doc.siteengineerFeedbackBy,
                    customerStatus: doc.customerStatus,
                    customerFeedback: doc.customerFeedback,
                    customerFeedbackBy: doc.customerFeedbackBy,
                    customerReviewedAt: doc.customerReviewedAt,
                    sentToCustomer: doc.sentToCustomer,
                    sentToCustomerAt: doc.sentToCustomerAt,
                    sentToCustomerBy: doc.sentToCustomerBy,
                    sentToCustomerByModel: doc.sentToCustomerByModel
                },
                customerReview: {
                    documentReviewed: true,
                    reviewedBy: user.id,
                    reviewedByModel: 'Customer',
                    reviewedAt: new Date(),
                    reviewStatus: status,
                    reviewAction: status.toLowerCase(),
                    feedbackProvided: feedback ? true : false,
                    feedbackLength: feedback ? feedback.length : 0,
                    reviewType: 'customer',
                    customerReviewComplete: true,
                    previousCustomerStatus: originalCustomerStatus,
                    newCustomerStatus: doc.customerStatus
                },
                approvalWorkflow: {
                    siteengineerApproved: doc.siteengineerStatus === 'Approved',
                    adminApproved: doc.adminStatus === 'Approved',
                    customerReviewed: true,
                    allApprovalsComplete: doc.siteengineerStatus === 'Approved' && doc.adminStatus === 'Approved' && doc.customerStatus === 'Approved',
                    workflowStage: 'customer_review',
                    nextStage: doc.customerStatus === 'Approved' ? 'completed' : 'revision_required'
                },
                filesData: {
                    totalFiles: doc.files ? doc.files.length : 0,
                    fileTypes: doc.files ? [...new Set(doc.files.map(f => f.fileType))] : [],
                    totalFileSize: doc.files ? doc.files.reduce((sum, f) => sum + (f.size || 0), 0) : 0
                },
                contentSections: {
                    totalSections: 8,
                    completedSections: [
                        doc.files && doc.files.length > 0 ? 'files' : null,
                        doc.createdByUser ? 'createdByUser' : null,
                        doc.userNote ? 'userNote' : null,
                        doc.adminStatus ? 'adminStatus' : null,
                        doc.siteengineerStatus ? 'siteengineerStatus' : null,
                        doc.customerStatus ? 'customerStatus' : null,
                        doc.sentToCustomer ? 'sentToCustomer' : null,
                        doc.addedAt ? 'addedAt' : null
                    ].filter(Boolean).length,
                    sectionsProvided: [
                        doc.files && doc.files.length > 0 ? 'files' : null,
                        doc.createdByUser ? 'createdByUser' : null,
                        doc.userNote ? 'userNote' : null,
                        doc.adminStatus ? 'adminStatus' : null,
                        doc.siteengineerStatus ? 'siteengineerStatus' : null,
                        doc.customerStatus ? 'customerStatus' : null,
                        doc.sentToCustomer ? 'sentToCustomer' : null,
                        doc.addedAt ? 'addedAt' : null
                    ].filter(Boolean)
                },
                workflow: {
                    documentReview: true,
                    siteworkWorkflow: true,
                    projectWorkflow: true,
                    documentWorkflow: true,
                    customerReviewWorkflow: true,
                    approvalWorkflow: status === 'Approved',
                    rejectionWorkflow: status === 'Rejected',
                    reviewComplete: true,
                    customerReviewComplete: true
                }
            }
        });
    } catch (error) {
        console.error('Error logging customer sitework document review:', error);
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

export const sendSiteworkDocumentToCustomerService = async (req, projectId, siteworkId, docId, user) => {
    // Verify user is an admin or sales-admin
    if (user.role !== 'Admin' && user.role !== 'sales-admin') {
        throw new ApiError(httpStatus.FORBIDDEN, 'Only admins can send documents to customers');
    }

    // Find the sitework and verify it belongs to the project
    const sitework = await Sitework.findOne({
        _id: siteworkId,
        project: projectId,
        isActive: true
    }).populate('project', 'projectName projectCode status customerName requirementType architect');

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

    // Store original values for logging
    const originalCustomerStatus = doc.customerStatus;
    const originalSentToCustomer = doc.sentToCustomer;
    const originalSentToCustomerAt = doc.sentToCustomerAt;
    const originalSentToCustomerBy = doc.sentToCustomerBy;
    const originalSentToCustomerByModel = doc.sentToCustomerByModel;

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

    // Log the sitework document send to customer activity
    try {
        await logActivity(req, {
            action: 'send_sitework_document_to_customer',
            targetModel: 'SiteworkDocument',
            targetId: doc._id,
            targetName: `Document in ${sitework.name || 'Sitework'}`,
            description: `${user.role === 'Admin' ? 'Admin' : 'Sales Admin'} ${user.name} (${user.email}) sent sitework document in "${sitework.name}" to customer for project: ${sitework.project?.projectName || 'Unknown Project'}`,
            changes: {
                customerStatus: {
                    from: originalCustomerStatus,
                    to: doc.customerStatus
                },
                sentToCustomer: {
                    from: originalSentToCustomer,
                    to: doc.sentToCustomer
                },
                sentToCustomerAt: {
                    from: originalSentToCustomerAt,
                    to: doc.sentToCustomerAt
                },
                sentToCustomerBy: {
                    from: originalSentToCustomerBy,
                    to: doc.sentToCustomerBy
                },
                sentToCustomerByModel: {
                    from: originalSentToCustomerByModel,
                    to: doc.sentToCustomerByModel
                }
            },
            metadata: {
                projectId: sitework.project?._id,
                projectData: {
                    projectId: sitework.project?._id,
                    projectName: sitework.project?.projectName,
                    projectCode: sitework.project?.projectCode,
                    status: sitework.project?.status,
                    customerName: sitework.project?.customerName,
                    requirementType: sitework.project?.requirementType,
                    architect: sitework.project?.architect
                },
                user: {
                    userId: user._id,
                    userName: user.name,
                    userEmail: user.email,
                    userRole: user.role,
                    userType: user.role === 'Admin' ? 'Admin' : 'Sales Admin',
                    userPhone: user.phone
                },
                siteworkData: {
                    siteworkId: sitework._id,
                    name: sitework.name,
                    description: sitework.description,
                    project: sitework.project,
                    startDate: sitework.startDate,
                    endDate: sitework.endDate,
                    status: sitework.status,
                    assignedUsers: sitework.assignedUsers,
                    createdBy: sitework.createdBy,
                    createdByModel: sitework.createdByModel,
                    isActive: sitework.isActive,
                    createdAt: sitework.createdAt,
                    updatedAt: sitework.updatedAt
                },
                documentData: {
                    documentId: doc._id,
                    files: doc.files,
                    createdByUser: doc.createdByUser,
                    createdByUserModel: doc.createdByUserModel,
                    userNote: doc.userNote,
                    addedAt: doc.addedAt,
                    adminStatus: doc.adminStatus,
                    adminFeedback: doc.adminFeedback,
                    adminFeedbackBy: doc.adminFeedbackBy,
                    adminFeedbackByModel: doc.adminFeedbackByModel,
                    siteengineerStatus: doc.siteengineerStatus,
                    siteengineerFeedback: doc.siteengineerFeedback,
                    siteengineerFeedbackBy: doc.siteengineerFeedbackBy,
                    customerStatus: doc.customerStatus,
                    customerFeedback: doc.customerFeedback,
                    customerFeedbackBy: doc.customerFeedbackBy,
                    customerReviewedAt: doc.customerReviewedAt,
                    sentToCustomer: doc.sentToCustomer,
                    sentToCustomerAt: doc.sentToCustomerAt,
                    sentToCustomerBy: doc.sentToCustomerBy,
                    sentToCustomerByModel: doc.sentToCustomerByModel
                },
                documentSending: {
                    documentSent: true,
                    sentBy: user.id,
                    sentByModel: user.role === 'Admin' ? 'Admin' : 'Sales Admin',
                    sentAt: new Date(),
                    sentToCustomer: true,
                    customerStatus: 'Pending',
                    previousCustomerStatus: originalCustomerStatus,
                    sendingAction: 'send_to_customer',
                    notificationSent: true,
                    customerNotification: true
                },
                approvalWorkflow: {
                    siteengineerApproved: doc.siteengineerStatus === 'Approved',
                    adminApproved: doc.adminStatus === 'Approved',
                    sentToCustomer: true,
                    customerReviewPending: true,
                    workflowStage: 'customer_review_pending',
                    nextStage: 'customer_review',
                    allInternalApprovalsComplete: doc.siteengineerStatus === 'Approved' && doc.adminStatus === 'Approved'
                },
                filesData: {
                    totalFiles: doc.files ? doc.files.length : 0,
                    fileTypes: doc.files ? [...new Set(doc.files.map(f => f.fileType))] : [],
                    totalFileSize: doc.files ? doc.files.reduce((sum, f) => sum + (f.size || 0), 0) : 0
                },
                contentSections: {
                    totalSections: 8,
                    completedSections: [
                        doc.files && doc.files.length > 0 ? 'files' : null,
                        doc.createdByUser ? 'createdByUser' : null,
                        doc.userNote ? 'userNote' : null,
                        doc.adminStatus ? 'adminStatus' : null,
                        doc.siteengineerStatus ? 'siteengineerStatus' : null,
                        doc.customerStatus ? 'customerStatus' : null,
                        doc.sentToCustomer ? 'sentToCustomer' : null,
                        doc.addedAt ? 'addedAt' : null
                    ].filter(Boolean).length,
                    sectionsProvided: [
                        doc.files && doc.files.length > 0 ? 'files' : null,
                        doc.createdByUser ? 'createdByUser' : null,
                        doc.userNote ? 'userNote' : null,
                        doc.adminStatus ? 'adminStatus' : null,
                        doc.siteengineerStatus ? 'siteengineerStatus' : null,
                        doc.customerStatus ? 'customerStatus' : null,
                        doc.sentToCustomer ? 'sentToCustomer' : null,
                        doc.addedAt ? 'addedAt' : null
                    ].filter(Boolean)
                },
                workflow: {
                    documentSending: true,
                    siteworkWorkflow: true,
                    projectWorkflow: true,
                    documentWorkflow: true,
                    customerNotificationWorkflow: true,
                    approvalWorkflow: true,
                    customerReviewWorkflow: true,
                    sendingComplete: true
                }
            }
        });
    } catch (error) {
        console.error('Error logging sitework document send to customer:', error);
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
