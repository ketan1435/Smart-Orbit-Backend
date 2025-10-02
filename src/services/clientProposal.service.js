import mongoose from 'mongoose';
import httpStatus from 'http-status';
import ApiError from '../utils/ApiError.js';
import ClientProposal from '../models/clientProposal.model.js';
import User from '../models/user.model.js';
import Admin from '../models/admin.model.js';
import Project from '../models/project.model.js';
import { generateClientProposalPDF } from './jsreport.service.js';
import { logActivity } from '../middlewares/activityLog.middleware.js';
import ClientProposalFile from '../models/clientProposalFile.model.js';

/**
 * Helper function to determine user type
 * @param {ObjectId} userId
 * @returns {Promise<{user: Object, userType: string}>}
 */
const getUserAndType = async (userId) => {
    let user = await User.findById(userId);
    let userType = 'User';

    if (!user) {
        const admin = await Admin.findById(userId);
        if (!admin) {
            throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
        }
        user = admin;
        userType = 'Admin';
    }

    return { user, userType };
};

/**
 * Create a client proposal
 * @param {Object} clientProposalBody
 * @param {ObjectId} userId
 * @returns {Promise<ClientProposal>}
 */
export const createClientProposal = async (req, clientProposalBody, userId) => {
    if (!clientProposalBody) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Client proposal data is required');
    }

    if (!clientProposalBody.project) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Project ID is required');
    }

    const { user, userType } = await getUserAndType(userId);

    // Verify project exists
    const project = await Project.findById(clientProposalBody.project).select('projectName projectCode status customerName requirementType architect');
    if (!project) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
    }

    // Validate customer info
    if (!clientProposalBody.customerInfo || !clientProposalBody.customerInfo.name) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Customer information is required');
    }

    const clientProposal = await ClientProposal.create({
        ...clientProposalBody,
        createdBy: userId,
        createdByModel: userType,
        updatedBy: userId,
        updatedByModel: userType,
    });

    // Log the client proposal creation activity
    try {
        console.log('Creating activity log for client proposal:', {
            userRole: user.role,
            isArchitect: user.role === 'architect',
            description: user.role === 'architect' 
                ? `Architect User Send Proposal to Admin`
                : `${userType} ${user.name} (${user.email}) created a new client proposal `
        });
        
        const activityLogResult = await logActivity(req, {
            action: 'create_client_proposal',
            targetModel: 'ClientProposal',
            targetId: clientProposal._id,
            targetName: clientProposalBody.proposalFor || 'Client Proposal',
            description: user.role === 'architect' 
                ? `Architect User Send Proposal to Admin`
                : `${userType} ${user.name} (${user.email}) created a new client proposal`,
            changes: {
                proposalCreated: {
                    from: null,
                    to: clientProposal._id
                },
                proposalStatus: {
                    from: null,
                    to: 'Draft'
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
                    userType: userType
                },
                proposalData: {
                    proposalId: clientProposal._id,
                    proposalFor: clientProposalBody.proposalFor,
                    projectLocation: clientProposalBody.projectLocation,
                    projectType: clientProposalBody.projectType,
                    unitCost: clientProposalBody.unitCost,
                    customerInfo: clientProposalBody.customerInfo,
                    manufacturingSupply: clientProposalBody.manufacturingSupply ? 'Present' : 'Not provided',
                    projectOverview: clientProposalBody.projectOverview ? 'Present' : 'Not provided',
                    cottageSpecifications: clientProposalBody.cottageSpecifications ? 'Present' : 'Not provided',
                    materialDetails: clientProposalBody.materialDetails ? 'Present' : 'Not provided',
                    costBreakdown: clientProposalBody.costBreakdown ? 'Present' : 'Not provided',
                    keyDurabilityFeatures: clientProposalBody.keyDurabilityFeatures ? 'Present' : 'Not provided',
                    additionalFeatures: clientProposalBody.additionalFeatures ? 'Present' : 'Not provided',
                    paymentTerms: clientProposalBody.paymentTerms ? 'Present' : 'Not provided',
                    salesTerms: clientProposalBody.salesTerms ? 'Present' : 'Not provided',
                    contactInformation: clientProposalBody.contactInformation ? 'Present' : 'Not provided',
                    createdBy: userId,
                    createdByModel: userType,
                    updatedBy: userId,
                    updatedByModel: userType,
                    createdAt: clientProposal.createdAt,
                    updatedAt: clientProposal.updatedAt
                },
                proposalCreation: {
                    proposalCreated: true,
                    createdBy: userId,
                    createdByModel: userType,
                    createdAt: clientProposal.createdAt,
                    proposalStatus: 'Draft'
                },
                contentSections: {
                    totalSections: 11,
                    completedSections: [
                        clientProposalBody.manufacturingSupply ? 'manufacturingSupply' : null,
                        clientProposalBody.projectOverview ? 'projectOverview' : null,
                        clientProposalBody.cottageSpecifications ? 'cottageSpecifications' : null,
                        clientProposalBody.materialDetails ? 'materialDetails' : null,
                        clientProposalBody.costBreakdown ? 'costBreakdown' : null,
                        clientProposalBody.keyDurabilityFeatures ? 'keyDurabilityFeatures' : null,
                        clientProposalBody.additionalFeatures ? 'additionalFeatures' : null,
                        clientProposalBody.paymentTerms ? 'paymentTerms' : null,
                        clientProposalBody.salesTerms ? 'salesTerms' : null,
                        clientProposalBody.contactInformation ? 'contactInformation' : null
                    ].filter(Boolean).length,
                    sectionsProvided: [
                        clientProposalBody.manufacturingSupply ? 'manufacturingSupply' : null,
                        clientProposalBody.projectOverview ? 'projectOverview' : null,
                        clientProposalBody.cottageSpecifications ? 'cottageSpecifications' : null,
                        clientProposalBody.materialDetails ? 'materialDetails' : null,
                        clientProposalBody.costBreakdown ? 'costBreakdown' : null,
                        clientProposalBody.keyDurabilityFeatures ? 'keyDurabilityFeatures' : null,
                        clientProposalBody.additionalFeatures ? 'additionalFeatures' : null,
                        clientProposalBody.paymentTerms ? 'paymentTerms' : null,
                        clientProposalBody.salesTerms ? 'salesTerms' : null,
                        clientProposalBody.contactInformation ? 'contactInformation' : null
                    ].filter(Boolean)
                }
            }
        });
        
        console.log('Activity log created successfully:', activityLogResult);
    } catch (error) {
        console.error('Error logging client proposal creation:', error);
    }

    return clientProposal.populate(['project', 'createdBy', 'updatedBy']);
};

/**
 * Query for client proposals
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @param {string} [options.sortBy] - Sort option in the format: sortField:(desc|asc)
 * @param {number} [options.limit] - Maximum number of results per page (default = 10)
 * @param {number} [options.page] - Current page (default = 1)
 * @returns {Promise<QueryResult>}
 */
export const queryClientProposals = async (filter, options) => {
    const { limit = 10, page = 1, sortBy } = options;
    const sort = sortBy
        ? { [sortBy.split(':')[0]]: sortBy.split(':')[1] === 'desc' ? -1 : 1 }
        : { createdAt: -1 };

    const clientProposals = await ClientProposal.find(filter)
        .populate('project', 'projectName projectCode')
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email')
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

    const totalResults = await ClientProposal.countDocuments(filter);

    return {
        results: clientProposals,
        page,
        limit,
        totalPages: Math.ceil(totalResults / limit),
        totalResults,
    };
};

/**
 * Send client proposal to customer
 * @param {ObjectId} clientProposalId
 * @param {ObjectId} userId
 * @returns {Promise<ClientProposal>}
 */
export const sendToCustomer = async (req, clientProposalId, userId) => {
    const clientProposal = await getClientProposalById(clientProposalId);

    // Check if user has permission to send to customer (creator or admin)
    const createdById = clientProposal.createdBy?._id || clientProposal.createdBy;
    if (createdById && createdById.toString() !== userId.toString()) {
        const user = await User.findById(userId);
        if (!user || user.role !== 'admin') {
            throw new ApiError(httpStatus.FORBIDDEN, 'Forbidden');
        }
    }

    // Only allow sending if proposal is approved
    if (clientProposal.status !== 'approved') {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Only approved proposals can be sent to customers');
    }

    // Store original data for logging
    const originalStatus = clientProposal.status;
    const originalSentToCustomer = clientProposal.sentToCustomer;
    const originalSentToCustomerAt = clientProposal.sentToCustomerAt;

    // Update proposal to sent status
    clientProposal.status = 'sent';
    clientProposal.sentToCustomer = true;
    clientProposal.sentToCustomerAt = new Date();
    clientProposal.updatedBy = userId;

    // Determine user type for updatedBy
    const { user, userType } = await getUserAndType(userId);
    clientProposal.updatedByModel = userType;

    await clientProposal.save();

    // Log the send to customer activity
    try {
        await logActivity(req, {
            action: 'send_to_customer',
            targetModel: 'ClientProposal',
            targetId: clientProposal._id,
            targetName: clientProposal.proposalFor || 'Client Proposal',
            description: `${userType} ${user.name} (${user.email}) sent client proposal to customer`,
            changes: {
                status: {
                    from: originalStatus,
                    to: 'sent'
                },
                sentToCustomer: {
                    from: originalSentToCustomer,
                    to: true
                },
                sentToCustomerAt: {
                    from: originalSentToCustomerAt,
                    to: new Date()
                }
            },
            metadata: {
                projectId: clientProposal.project?._id,
                projectData: {
                    projectId: clientProposal.project?._id,
                    projectName: clientProposal.project?.projectName,
                    projectCode: clientProposal.project?.projectCode,
                    status: clientProposal.project?.status,
                    customerName: clientProposal.project?.customerName,
                    requirementType: clientProposal.project?.requirementType,
                    architect: clientProposal.project?.architect
                },
                user: {
                    userId: user._id,
                    userName: user.name,
                    userEmail: user.email,
                    userRole: user.role,
                    userType: userType
                },
                proposalData: {
                    proposalId: clientProposal._id,
                    proposalFor: clientProposal.proposalFor,
                    projectLocation: clientProposal.projectLocation,
                    projectType: clientProposal.projectType,
                    unitCost: clientProposal.unitCost,
                    customerInfo: clientProposal.customerInfo,
                    status: 'sent',
                    sentToCustomer: true,
                    sentToCustomerAt: new Date(),
                    updatedBy: userId,
                    updatedByModel: userType
                },
                customerNotification: {
                    proposalSent: true,
                    sentBy: userId,
                    sentByModel: userType,
                    sentAt: new Date(),
                    customerEmail: clientProposal.customerInfo?.email,
                    customerName: clientProposal.customerInfo?.name
                },
                workflow: {
                    proposalWorkflow: true,
                    customerWorkflow: true,
                    notificationSent: true
                }
            }
        });
    } catch (error) {
        console.error('Error logging send to customer:', error);
    }

    return clientProposal.populate(['project', 'createdBy', 'updatedBy']);
};

/**
 * Customer review of client proposal
 * @param {ObjectId} clientProposalId
 * @param {Object} reviewData
 * @param {ObjectId} userId
 * @returns {Promise<ClientProposal>}
 */
export const customerReview = async (req, clientProposalId, reviewData, userId) => {
    const clientProposal = await getClientProposalById(clientProposalId);

    // Check if proposal was sent to customer
    if (!clientProposal.sentToCustomer) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Proposal has not been sent to customer');
    }

    // Store original data for logging
    const originalStatus = clientProposal.status;
    const originalCustomerRemarks = clientProposal.customerRemarks;
    const originalCustomerReviewedAt = clientProposal.customerReviewedAt;
    const originalProjectStatus = clientProposal.project?.status;

    // Update proposal based on customer review
    clientProposal.status = reviewData.status;
    if (reviewData.status === 'approved') {
        await Project.findByIdAndUpdate(clientProposal.project._id, { status: 'Open' });
    }
    clientProposal.customerRemarks = reviewData.remarks;
    clientProposal.customerReviewedAt = new Date();
    clientProposal.updatedBy = userId;

    // Determine user type for updatedBy
    const { user, userType } = await getUserAndType(userId);
    clientProposal.updatedByModel = userType;

    await clientProposal.save();

    // Log the customer review activity
    try {
        await logActivity(req, {
            action: 'customer_review',
            targetModel: 'ClientProposal',
            targetId: clientProposal._id,
            targetName: clientProposal.proposalFor || 'Client Proposal',
            description: `Customer ${user.name} (${user.email}) ${reviewData.status} the client proposal`,
            changes: {
                status: {
                    from: originalStatus,
                    to: reviewData.status
                },
                customerRemarks: {
                    from: originalCustomerRemarks,
                    to: reviewData.remarks
                },
                customerReviewedAt: {
                    from: originalCustomerReviewedAt,
                    to: new Date()
                },
                projectStatus: reviewData.status === 'approved' ? {
                    from: originalProjectStatus,
                    to: 'Open'
                } : undefined
            },
            metadata: {
                projectId: clientProposal.project?._id,
                projectData: {
                    projectId: clientProposal.project?._id,
                    projectName: clientProposal.project?.projectName,
                    projectCode: clientProposal.project?.projectCode,
                    status: reviewData.status === 'approved' ? 'Open' : clientProposal.project?.status,
                    customerName: clientProposal.project?.customerName,
                    requirementType: clientProposal.project?.requirementType,
                    architect: clientProposal.project?.architect
                },
                customer: {
                    userId: user._id,
                    userName: user.name,
                    userEmail: user.email,
                    userRole: user.role,
                    userType: userType
                },
                proposalData: {
                    proposalId: clientProposal._id,
                    proposalFor: clientProposal.proposalFor,
                    projectLocation: clientProposal.projectLocation,
                    projectType: clientProposal.projectType,
                    unitCost: clientProposal.unitCost,
                    customerInfo: clientProposal.customerInfo,
                    status: reviewData.status,
                    customerRemarks: reviewData.remarks,
                    customerReviewedAt: new Date(),
                    updatedBy: userId,
                    updatedByModel: userType
                },
                reviewData: {
                    status: reviewData.status,
                    remarks: reviewData.remarks,
                    reviewedAt: new Date(),
                    reviewedBy: userId,
                    reviewedByModel: userType
                },
                customerReview: {
                    proposalReviewed: true,
                    reviewStatus: reviewData.status,
                    reviewRemarks: reviewData.remarks,
                    reviewedAt: new Date(),
                    reviewedBy: userId,
                    reviewedByModel: userType
                },
                projectUpdate: reviewData.status === 'approved' ? {
                    projectStatusUpdated: true,
                    fromStatus: originalProjectStatus,
                    toStatus: 'Open',
                    updatedAt: new Date()
                } : {
                    projectStatusUpdated: false,
                    reason: 'Proposal not approved'
                },
                workflow: {
                    customerReview: true,
                    proposalWorkflow: true,
                    projectWorkflow: reviewData.status === 'approved',
                    reviewComplete: true
                }
            }
        });
    } catch (error) {
        console.error('Error logging customer review:', error);
    }

    return clientProposal.populate(['project', 'createdBy', 'updatedBy']);
};

/**
 * Generate PDF for client proposal
 * @param {ObjectId} clientProposalId
 * @param {ObjectId} userId
 * @returns {Promise<Buffer>}
 */
export const generateClientProposalPDFById = async (clientProposalId, userId) => {
    const clientProposal = await getClientProposalById(clientProposalId);

    // Check if user has permission to generate PDF (creator or admin)
    const createdById = clientProposal.createdBy?._id || clientProposal.createdBy;
    const isSentToCustomer = clientProposal.sentToCustomer;
    const customerEmail = clientProposal.customerInfo.email;
    if (createdById && createdById.toString() !== userId.toString()) {
        const user = await User.findById(userId);
        if (isSentToCustomer && customerEmail !== user.email) {
            throw new ApiError(httpStatus.FORBIDDEN, 'Forbidden');
        }
    }

    try {
        const pdfBuffer = await generateClientProposalPDF(clientProposal);
        return pdfBuffer;
    } catch (error) {
        throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, `PDF generation failed: ${error.message}`);
    }
};

/**
 * Get client proposal by id
 * @param {ObjectId} id
 * @returns {Promise<ClientProposal>}
 */
export const getClientProposalById = async (id) => {
    if (!id) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Client proposal ID is required');
    }

    const clientProposal = await ClientProposal.findById(id)
        .populate('project', 'projectName projectCode workOrderSentToPlanningEngineer')
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email');

    if (!clientProposal) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Client proposal not found');
    }

    return clientProposal;
};

/**
 * Update client proposal by id
 * @param {ObjectId} clientProposalId
 * @param {Object} updateBody
 * @param {ObjectId} userId
 * @returns {Promise<ClientProposal>}
 */
export const updateClientProposalById = async (req, clientProposalId, updateBody, userId) => {
    const clientProposal = await getClientProposalById(clientProposalId);

    // Check if user has permission to update (creator or admin)
    const createdById = clientProposal.createdBy?._id || clientProposal.createdBy;
    const { user, userType } = await getUserAndType(userId);

    if (createdById && createdById.toString() !== userId.toString()) {
        if (!user || user.role !== 'admin') {
            throw new ApiError(httpStatus.FORBIDDEN, 'Forbidden');
        }
    }

    // Check if proposal is in an editable state
    if (clientProposal.status !== 'draft' && userType !== 'Admin') {
        throw new ApiError(
            httpStatus.FORBIDDEN,
            `Cannot edit proposal with status '${clientProposal.status}'. Only draft proposals can be edited.`
        );
    }

    // Prevent editing proposals that have been sent to customer (unless admin)
    if (clientProposal.sentToCustomer && userType !== 'Admin') {
        throw new ApiError(
            httpStatus.FORBIDDEN,
            'Cannot edit proposal that has been sent to customer. Only administrators can edit sent proposals.'
        );
    }

    // If project is being updated, verify it exists
    if (updateBody.project) {
        const project = await Project.findById(updateBody.project).select('projectName projectCode status customerName requirementType architect');
        if (!project) {
            throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
        }
    }

    // Store original data for logging
    const originalProposal = {
        proposalFor: clientProposal.proposalFor,
        projectLocation: clientProposal.projectLocation,
        projectType: clientProposal.projectType,
        unitCost: clientProposal.unitCost,
        customerInfo: clientProposal.customerInfo,
        manufacturingSupply: clientProposal.manufacturingSupply,
        projectOverview: clientProposal.projectOverview,
        cottageSpecifications: clientProposal.cottageSpecifications,
        materialDetails: clientProposal.materialDetails,
        costBreakdown: clientProposal.costBreakdown,
        keyDurabilityFeatures: clientProposal.keyDurabilityFeatures,
        additionalFeatures: clientProposal.additionalFeatures,
        paymentTerms: clientProposal.paymentTerms,
        salesTerms: clientProposal.salesTerms,
        contactInformation: clientProposal.contactInformation,
        project: clientProposal.project,
        status: clientProposal.status,
        sentToCustomer: clientProposal.sentToCustomer,
        updatedBy: clientProposal.updatedBy,
        updatedByModel: clientProposal.updatedByModel
    };

    // Remove any status, version, or sentToCustomer updates from the update body
    // These should be handled by separate endpoints
    const { status, version, sentToCustomer, sentToCustomerAt, customerRemarks, customerReviewedAt, ...safeUpdateBody } = updateBody;

    Object.assign(clientProposal, safeUpdateBody, {
        updatedBy: userId,
        updatedByModel: userType
    });
    await clientProposal.save();

    // Log the client proposal update activity
    try {
        await logActivity(req, {
            action: 'update_client_proposal',
            targetModel: 'ClientProposal',
            targetId: clientProposal._id,
            targetName: clientProposal.proposalFor || 'Client Proposal',
            description: `${userType} ${user.name} (${user.email}) updated client proposal `,
            changes: {
                proposalFor: updateBody.proposalFor ? {
                    from: originalProposal.proposalFor,
                    to: updateBody.proposalFor
                } : undefined,
                projectLocation: updateBody.projectLocation ? {
                    from: originalProposal.projectLocation,
                    to: updateBody.projectLocation
                } : undefined,
                projectType: updateBody.projectType ? {
                    from: originalProposal.projectType,
                    to: updateBody.projectType
                } : undefined,
                unitCost: updateBody.unitCost ? {
                    from: originalProposal.unitCost,
                    to: updateBody.unitCost
                } : undefined,
                customerInfo: updateBody.customerInfo ? {
                    from: originalProposal.customerInfo,
                    to: updateBody.customerInfo
                } : undefined,
                project: updateBody.project ? {
                    from: originalProposal.project,
                    to: updateBody.project
                } : undefined,
                updatedBy: {
                    from: originalProposal.updatedBy,
                    to: userId
                },
                updatedByModel: {
                    from: originalProposal.updatedByModel,
                    to: userType
                }
            },
            metadata: {
                projectId: clientProposal.project?._id,
                projectData: {
                    projectId: clientProposal.project?._id,
                    projectName: clientProposal.project?.projectName,
                    projectCode: clientProposal.project?.projectCode,
                    status: clientProposal.project?.status,
                    customerName: clientProposal.project?.customerName,
                    requirementType: clientProposal.project?.requirementType,
                    architect: clientProposal.project?.architect
                },
                user: {
                    userId: user._id,
                    userName: user.name,
                    userEmail: user.email,
                    userRole: user.role,
                    userType: userType
                },
                proposalData: {
                    proposalId: clientProposal._id,
                    proposalFor: clientProposal.proposalFor,
                    projectLocation: clientProposal.projectLocation,
                    projectType: clientProposal.projectType,
                    unitCost: clientProposal.unitCost,
                    customerInfo: clientProposal.customerInfo,
                    manufacturingSupply: clientProposal.manufacturingSupply ? 'Present' : 'Not provided',
                    projectOverview: clientProposal.projectOverview ? 'Present' : 'Not provided',
                    cottageSpecifications: clientProposal.cottageSpecifications ? 'Present' : 'Not provided',
                    materialDetails: clientProposal.materialDetails ? 'Present' : 'Not provided',
                    costBreakdown: clientProposal.costBreakdown ? 'Present' : 'Not provided',
                    keyDurabilityFeatures: clientProposal.keyDurabilityFeatures ? 'Present' : 'Not provided',
                    additionalFeatures: clientProposal.additionalFeatures ? 'Present' : 'Not provided',
                    paymentTerms: clientProposal.paymentTerms ? 'Present' : 'Not provided',
                    salesTerms: clientProposal.salesTerms ? 'Present' : 'Not provided',
                    contactInformation: clientProposal.contactInformation ? 'Present' : 'Not provided',
                    status: clientProposal.status,
                    sentToCustomer: clientProposal.sentToCustomer,
                    updatedBy: userId,
                    updatedByModel: userType,
                    updatedAt: clientProposal.updatedAt
                },
                originalProposalData: originalProposal,
                updateData: {
                    updatedFields: Object.keys(safeUpdateBody),
                    updatedBy: userId,
                    updatedByModel: userType,
                    updatedAt: clientProposal.updatedAt
                },
                contentSections: {
                    totalSections: 11,
                    completedSections: [
                        clientProposal.manufacturingSupply ? 'manufacturingSupply' : null,
                        clientProposal.projectOverview ? 'projectOverview' : null,
                        clientProposal.cottageSpecifications ? 'cottageSpecifications' : null,
                        clientProposal.materialDetails ? 'materialDetails' : null,
                        clientProposal.costBreakdown ? 'costBreakdown' : null,
                        clientProposal.keyDurabilityFeatures ? 'keyDurabilityFeatures' : null,
                        clientProposal.additionalFeatures ? 'additionalFeatures' : null,
                        clientProposal.paymentTerms ? 'paymentTerms' : null,
                        clientProposal.salesTerms ? 'salesTerms' : null,
                        clientProposal.contactInformation ? 'contactInformation' : null
                    ].filter(Boolean).length,
                    sectionsProvided: [
                        clientProposal.manufacturingSupply ? 'manufacturingSupply' : null,
                        clientProposal.projectOverview ? 'projectOverview' : null,
                        clientProposal.cottageSpecifications ? 'cottageSpecifications' : null,
                        clientProposal.materialDetails ? 'materialDetails' : null,
                        clientProposal.costBreakdown ? 'costBreakdown' : null,
                        clientProposal.keyDurabilityFeatures ? 'keyDurabilityFeatures' : null,
                        clientProposal.additionalFeatures ? 'additionalFeatures' : null,
                        clientProposal.paymentTerms ? 'paymentTerms' : null,
                        clientProposal.salesTerms ? 'salesTerms' : null,
                        clientProposal.contactInformation ? 'contactInformation' : null
                    ].filter(Boolean)
                },
                proposalUpdate: {
                    proposalUpdated: true,
                    updatedBy: userId,
                    updatedByModel: userType,
                    updatedAt: clientProposal.updatedAt,
                    fieldsUpdated: Object.keys(safeUpdateBody)
                }
            }
        });
    } catch (error) {
        console.error('Error logging client proposal update:', error);
    }

    return clientProposal.populate(['project', 'createdBy', 'updatedBy']);
};

/**
 * Update client proposal status
 * @param {ObjectId} clientProposalId
 * @param {string} status
 * @param {ObjectId} userId
 * @returns {Promise<ClientProposal>}
 */
export const updateClientProposalStatus = async (req, clientProposalId, status, userId) => {
    const clientProposal = await getClientProposalById(clientProposalId);

    // Check if user has permission to update status (creator or admin)
    const createdById = clientProposal.createdBy?._id || clientProposal.createdBy;
    if (createdById && createdById.toString() !== userId.toString()) {
        const user = await User.findById(userId);
        if (!user || user.role !== 'admin') {
            throw new ApiError(httpStatus.FORBIDDEN, 'Forbidden');
        }
    }

    // Validate status transitions
    const validTransitions = {
        draft: ['sent', 'archived'],
        sent: ['approved', 'rejected', 'draft'],
        approved: ['archived'],
        rejected: ['draft', 'archived'],
        archived: ['draft'],
    };

    if (!validTransitions[clientProposal.status].includes(status)) {
        throw new ApiError(
            httpStatus.BAD_REQUEST,
            `Cannot change status from ${clientProposal.status} to ${status}`
        );
    }

    // Store original data for logging
    const originalStatus = clientProposal.status;
    const originalSentToCustomer = clientProposal.sentToCustomer;
    const originalSentToCustomerAt = clientProposal.sentToCustomerAt;
    const originalProjectStatus = clientProposal.project?.status;

    // Determine user type for updatedBy
    const { user, userType } = await getUserAndType(userId);

    clientProposal.status = status;
    clientProposal.updatedBy = userId;
    clientProposal.updatedByModel = userType;
    if (status === 'sent') {
        clientProposal.sentToCustomer = true;
        clientProposal.sentToCustomerAt = new Date();
    }
    if (status === 'approved') {
        await Project.findByIdAndUpdate(clientProposal.project._id, { status: 'Open' });
    }
    await clientProposal.save();

    // Log the client proposal status update activity
    try {
        await logActivity(req, {
            action: 'update_client_proposal_status',
            targetModel: 'ClientProposal',
            targetId: clientProposal._id,
            targetName: clientProposal.proposalFor || 'Client Proposal',
            description: `${userType} ${user.name} (${user.email}) updated client proposal status from '${originalStatus}' to '${status}' `,
            changes: {
                status: {
                    from: originalStatus,
                    to: status
                },
                sentToCustomer: status === 'sent' ? {
                    from: originalSentToCustomer,
                    to: true
                } : undefined,
                sentToCustomerAt: status === 'sent' ? {
                    from: originalSentToCustomerAt,
                    to: new Date()
                } : undefined,
                projectStatus: status === 'approved' ? {
                    from: originalProjectStatus,
                    to: 'Open'
                } : undefined,
                updatedBy: {
                    from: clientProposal.updatedBy,
                    to: userId
                },
                updatedByModel: {
                    from: clientProposal.updatedByModel,
                    to: userType
                }
            },
            metadata: {
                projectId: clientProposal.project?._id,
                projectData: {
                    projectId: clientProposal.project?._id,
                    projectName: clientProposal.project?.projectName,
                    projectCode: clientProposal.project?.projectCode,
                    status: status === 'approved' ? 'Open' : clientProposal.project?.status,
                    customerName: clientProposal.project?.customerName,
                    requirementType: clientProposal.project?.requirementType,
                    architect: clientProposal.project?.architect
                },
                user: {
                    userId: user._id,
                    userName: user.name,
                    userEmail: user.email,
                    userRole: user.role,
                    userType: userType
                },
                proposalData: {
                    proposalId: clientProposal._id,
                    proposalFor: clientProposal.proposalFor,
                    projectLocation: clientProposal.projectLocation,
                    projectType: clientProposal.projectType,
                    unitCost: clientProposal.unitCost,
                    customerInfo: clientProposal.customerInfo,
                    status: status,
                    sentToCustomer: status === 'sent' ? true : clientProposal.sentToCustomer,
                    sentToCustomerAt: status === 'sent' ? new Date() : clientProposal.sentToCustomerAt,
                    updatedBy: userId,
                    updatedByModel: userType,
                    updatedAt: clientProposal.updatedAt
                },
                statusUpdate: {
                    originalStatus,
                    newStatus: status,
                    statusTransition: `${originalStatus} → ${status}`,
                    statusChanged: originalStatus !== status,
                    updatedAt: new Date()
                },
                validTransitions: {
                    fromStatus: originalStatus,
                    validTransitions: validTransitions[originalStatus],
                    transitionValid: validTransitions[originalStatus].includes(status)
                },
                workflowActions: {
                    sentToCustomer: status === 'sent',
                    projectStatusUpdated: status === 'approved',
                    customerNotification: status === 'sent',
                    projectWorkflow: status === 'approved'
                },
                projectUpdate: status === 'approved' ? {
                    projectStatusUpdated: true,
                    fromStatus: originalProjectStatus,
                    toStatus: 'Open',
                    updatedAt: new Date()
                } : {
                    projectStatusUpdated: false,
                    reason: 'Status not approved'
                },
                customerNotification: status === 'sent' ? {
                    proposalSent: true,
                    sentBy: userId,
                    sentByModel: userType,
                    sentAt: new Date(),
                    customerEmail: clientProposal.customerInfo?.email,
                    customerName: clientProposal.customerInfo?.name
                } : {
                    proposalSent: false,
                    reason: 'Status not sent'
                },
                workflow: {
                    statusUpdate: true,
                    proposalWorkflow: true,
                    projectWorkflow: status === 'approved',
                    customerWorkflow: status === 'sent',
                    statusTransition: true
                }
            }
        });
    } catch (error) {
        console.error('Error logging client proposal status update:', error);
    }

    return clientProposal.populate(['project', 'createdBy', 'updatedBy']);
};

/**
 * Create a new version of a client proposal
 * @param {ObjectId} clientProposalId
 * @param {Object} updateBody
 * @param {ObjectId} userId
 * @returns {Promise<ClientProposal>}
 */
export const createNewVersion = async (req, clientProposalId, updateBody, userId) => {
    const originalProposal = await getClientProposalById(clientProposalId);

    // Check if user has permission to create new version (creator or admin)
    const createdById = originalProposal.createdBy?._id || originalProposal.createdBy;
    if (createdById && createdById.toString() !== userId.toString()) {
        const user = await User.findById(userId);
        if (!user || user.role !== 'admin') {
            throw new ApiError(httpStatus.FORBIDDEN, 'Forbidden');
        }
    }

    // Determine user type for new version
    const { user, userType } = await getUserAndType(userId);

    // Create new version with incremented version number
    const newVersion = originalProposal.version + 1;

    const newProposal = await ClientProposal.create({
        ...originalProposal.toObject(),
        ...updateBody,
        _id: undefined, // Remove the original _id
        version: newVersion,
        status: 'draft', // Reset status to draft for new version
        createdBy: userId,
        createdByModel: userType,
        updatedBy: userId,
        updatedByModel: userType,
    });

    // Log the new version creation activity
    try {
        await logActivity(req, {
            action: 'create_new_version',
            targetModel: 'ClientProposal',
            targetId: newProposal._id,
            targetName: newProposal.proposalFor || 'Client Proposal',
            description: `${userType} ${user.name} (${user.email}) created new  client proposal `,
            changes: {
                version: {
                    from: originalProposal.version,
                    to: newVersion
                },
                status: {
                    from: originalProposal.status,
                    to: 'draft'
                },
                createdBy: {
                    from: originalProposal.createdBy,
                    to: userId
                },
                createdByModel: {
                    from: originalProposal.createdByModel,
                    to: userType
                },
                updatedBy: {
                    from: originalProposal.updatedBy,
                    to: userId
                },
                updatedByModel: {
                    from: originalProposal.updatedByModel,
                    to: userType
                }
            },
            metadata: {
                projectId: newProposal.project?._id,
                projectData: {
                    projectId: newProposal.project?._id,
                    projectName: newProposal.project?.projectName,
                    projectCode: newProposal.project?.projectCode,
                    status: newProposal.project?.status,
                    customerName: newProposal.project?.customerName,
                    requirementType: newProposal.project?.requirementType,
                    architect: newProposal.project?.architect
                },
                user: {
                    userId: user._id,
                    userName: user.name,
                    userEmail: user.email,
                    userRole: user.role,
                    userType: userType
                },
                originalProposalData: {
                    proposalId: originalProposal._id,
                    proposalFor: originalProposal.proposalFor,
                    projectLocation: originalProposal.projectLocation,
                    projectType: originalProposal.projectType,
                    unitCost: originalProposal.unitCost,
                    customerInfo: originalProposal.customerInfo,
                    version: originalProposal.version,
                    status: originalProposal.status,
                    sentToCustomer: originalProposal.sentToCustomer,
                    createdBy: originalProposal.createdBy,
                    createdByModel: originalProposal.createdByModel,
                    updatedBy: originalProposal.updatedBy,
                    updatedByModel: originalProposal.updatedByModel
                },
                newProposalData: {
                    proposalId: newProposal._id,
                    proposalFor: newProposal.proposalFor,
                    projectLocation: newProposal.projectLocation,
                    projectType: newProposal.projectType,
                    unitCost: newProposal.unitCost,
                    customerInfo: newProposal.customerInfo,
                    manufacturingSupply: newProposal.manufacturingSupply ? 'Present' : 'Not provided',
                    projectOverview: newProposal.projectOverview ? 'Present' : 'Not provided',
                    cottageSpecifications: newProposal.cottageSpecifications ? 'Present' : 'Not provided',
                    materialDetails: newProposal.materialDetails ? 'Present' : 'Not provided',
                    costBreakdown: newProposal.costBreakdown ? 'Present' : 'Not provided',
                    keyDurabilityFeatures: newProposal.keyDurabilityFeatures ? 'Present' : 'Not provided',
                    additionalFeatures: newProposal.additionalFeatures ? 'Present' : 'Not provided',
                    paymentTerms: newProposal.paymentTerms ? 'Present' : 'Not provided',
                    salesTerms: newProposal.salesTerms ? 'Present' : 'Not provided',
                    contactInformation: newProposal.contactInformation ? 'Present' : 'Not provided',
                    version: newVersion,
                    status: 'draft',
                    sentToCustomer: false,
                    createdBy: userId,
                    createdByModel: userType,
                    updatedBy: userId,
                    updatedByModel: userType,
                    createdAt: newProposal.createdAt,
                    updatedAt: newProposal.updatedAt
                },
                versionCreation: {
                    newVersionCreated: true,
                    originalVersion: originalProposal.version,
                    newVersion: newVersion,
                    versionIncremented: true,
                    statusReset: true,
                    createdBy: userId,
                    createdByModel: userType,
                    createdAt: newProposal.createdAt
                },
                contentSections: {
                    totalSections: 11,
                    completedSections: [
                        newProposal.manufacturingSupply ? 'manufacturingSupply' : null,
                        newProposal.projectOverview ? 'projectOverview' : null,
                        newProposal.cottageSpecifications ? 'cottageSpecifications' : null,
                        newProposal.materialDetails ? 'materialDetails' : null,
                        newProposal.costBreakdown ? 'costBreakdown' : null,
                        newProposal.keyDurabilityFeatures ? 'keyDurabilityFeatures' : null,
                        newProposal.additionalFeatures ? 'additionalFeatures' : null,
                        newProposal.paymentTerms ? 'paymentTerms' : null,
                        newProposal.salesTerms ? 'salesTerms' : null,
                        newProposal.contactInformation ? 'contactInformation' : null
                    ].filter(Boolean).length,
                    sectionsProvided: [
                        newProposal.manufacturingSupply ? 'manufacturingSupply' : null,
                        newProposal.projectOverview ? 'projectOverview' : null,
                        newProposal.cottageSpecifications ? 'cottageSpecifications' : null,
                        newProposal.materialDetails ? 'materialDetails' : null,
                        newProposal.costBreakdown ? 'costBreakdown' : null,
                        newProposal.keyDurabilityFeatures ? 'keyDurabilityFeatures' : null,
                        newProposal.additionalFeatures ? 'additionalFeatures' : null,
                        newProposal.paymentTerms ? 'paymentTerms' : null,
                        newProposal.salesTerms ? 'salesTerms' : null,
                        newProposal.contactInformation ? 'contactInformation' : null
                    ].filter(Boolean)
                },
                updateData: {
                    updatedFields: Object.keys(updateBody),
                    updatedBy: userId,
                    updatedByModel: userType,
                    updatedAt: newProposal.updatedAt
                },
                workflow: {
                    versionCreation: true,
                    proposalWorkflow: true,
                    newVersion: true,
                    statusReset: true
                }
            }
        });
    } catch (error) {
        console.error('Error logging new version creation:', error);
    }

    return newProposal.populate(['project', 'createdBy', 'updatedBy']);
};

/**
 * Delete client proposal by id
 * @param {ObjectId} clientProposalId
 * @param {ObjectId} userId
 * @returns {Promise<ClientProposal>}
 */
export const deleteClientProposalById = async (req, clientProposalId, userId) => {
    const clientProposal = await getClientProposalById(clientProposalId);

    // Check if user has permission to delete (creator or admin)
    const createdById = clientProposal.createdBy?._id || clientProposal.createdBy;
    if (createdById && createdById.toString() !== userId.toString()) {
        const user = await User.findById(userId);
        if (!user || user.role !== 'admin') {
            throw new ApiError(httpStatus.FORBIDDEN, 'Forbidden');
        }
    }

    // Store proposal data for logging before deletion
    const proposalData = {
        proposalId: clientProposal._id,
        proposalFor: clientProposal.proposalFor,
        projectLocation: clientProposal.projectLocation,
        projectType: clientProposal.projectType,
        unitCost: clientProposal.unitCost,
        customerInfo: clientProposal.customerInfo,
        manufacturingSupply: clientProposal.manufacturingSupply ? 'Present' : 'Not provided',
        projectOverview: clientProposal.projectOverview ? 'Present' : 'Not provided',
        cottageSpecifications: clientProposal.cottageSpecifications ? 'Present' : 'Not provided',
        materialDetails: clientProposal.materialDetails ? 'Present' : 'Not provided',
        costBreakdown: clientProposal.costBreakdown ? 'Present' : 'Not provided',
        keyDurabilityFeatures: clientProposal.keyDurabilityFeatures ? 'Present' : 'Not provided',
        additionalFeatures: clientProposal.additionalFeatures ? 'Present' : 'Not provided',
        paymentTerms: clientProposal.paymentTerms ? 'Present' : 'Not provided',
        salesTerms: clientProposal.salesTerms ? 'Present' : 'Not provided',
        contactInformation: clientProposal.contactInformation ? 'Present' : 'Not provided',
        version: clientProposal.version,
        status: clientProposal.status,
        sentToCustomer: clientProposal.sentToCustomer,
        sentToCustomerAt: clientProposal.sentToCustomerAt,
        customerRemarks: clientProposal.customerRemarks,
        customerReviewedAt: clientProposal.customerReviewedAt,
        createdBy: clientProposal.createdBy,
        createdByModel: clientProposal.createdByModel,
        updatedBy: clientProposal.updatedBy,
        updatedByModel: clientProposal.updatedByModel,
        createdAt: clientProposal.createdAt,
        updatedAt: clientProposal.updatedAt
    };

    // Get user information for logging
    const { user, userType } = await getUserAndType(userId);

    await clientProposal.deleteOne();

    // Log the client proposal deletion activity
    try {
        await logActivity(req, {
            action: 'delete_client_proposal',
            targetModel: 'ClientProposal',
            targetId: clientProposal._id,
            targetName: clientProposal.proposalFor || 'Client Proposal',
            description: `${userType} ${user.name} (${user.email}) deleted client proposal `,
            changes: {
                proposalDeleted: {
                    from: clientProposal._id,
                    to: null
                },
                status: {
                    from: clientProposal.status,
                    to: 'deleted'
                }
            },
            metadata: {
                projectId: clientProposal.project?._id,
                projectData: {
                    projectId: clientProposal.project?._id,
                    projectName: clientProposal.project?.projectName,
                    projectCode: clientProposal.project?.projectCode,
                    status: clientProposal.project?.status,
                    customerName: clientProposal.project?.customerName,
                    requirementType: clientProposal.project?.requirementType,
                    architect: clientProposal.project?.architect
                },
                user: {
                    userId: user._id,
                    userName: user.name,
                    userEmail: user.email,
                    userRole: user.role,
                    userType: userType
                },
                deletedProposalData: proposalData,
                deletionDetails: {
                    proposalDeleted: true,
                    deletedBy: userId,
                    deletedByModel: userType,
                    deletedAt: new Date(),
                    proposalVersion: clientProposal.version,
                    proposalStatus: clientProposal.status,
                    sentToCustomer: clientProposal.sentToCustomer
                },
                contentSections: {
                    totalSections: 11,
                    completedSections: [
                        clientProposal.manufacturingSupply ? 'manufacturingSupply' : null,
                        clientProposal.projectOverview ? 'projectOverview' : null,
                        clientProposal.cottageSpecifications ? 'cottageSpecifications' : null,
                        clientProposal.materialDetails ? 'materialDetails' : null,
                        clientProposal.costBreakdown ? 'costBreakdown' : null,
                        clientProposal.keyDurabilityFeatures ? 'keyDurabilityFeatures' : null,
                        clientProposal.additionalFeatures ? 'additionalFeatures' : null,
                        clientProposal.paymentTerms ? 'paymentTerms' : null,
                        clientProposal.salesTerms ? 'salesTerms' : null,
                        clientProposal.contactInformation ? 'contactInformation' : null
                    ].filter(Boolean).length,
                    sectionsProvided: [
                        clientProposal.manufacturingSupply ? 'manufacturingSupply' : null,
                        clientProposal.projectOverview ? 'projectOverview' : null,
                        clientProposal.cottageSpecifications ? 'cottageSpecifications' : null,
                        clientProposal.materialDetails ? 'materialDetails' : null,
                        clientProposal.costBreakdown ? 'costBreakdown' : null,
                        clientProposal.keyDurabilityFeatures ? 'keyDurabilityFeatures' : null,
                        clientProposal.additionalFeatures ? 'additionalFeatures' : null,
                        clientProposal.paymentTerms ? 'paymentTerms' : null,
                        clientProposal.salesTerms ? 'salesTerms' : null,
                        clientProposal.contactInformation ? 'contactInformation' : null
                    ].filter(Boolean)
                },
                workflow: {
                    proposalDeletion: true,
                    proposalWorkflow: true,
                    deletionComplete: true
                }
            }
        });
    } catch (error) {
        console.error('Error logging client proposal deletion:', error);
    }

    return clientProposal;
};

/**
 * Get client proposals by user
 * @param {ObjectId} userId
 * @param {Object} options - Query options
 * @returns {Promise<QueryResult>}
 */
export const getClientProposalsByUser = async (userId, options) => {
    const filter = { createdBy: userId };
    const { limit = 10, page = 1, sortBy } = options;
    const sort = sortBy
        ? { [sortBy.split(':')[0]]: sortBy.split(':')[1] === 'desc' ? -1 : 1 }
        : { createdAt: -1 };

    const clientProposals = await ClientProposal.find(filter)
        .populate('project', 'projectName projectCode')
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email')
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

    const totalResults = await ClientProposal.countDocuments(filter);

    return {
        results: clientProposals,
        page,
        limit,
        totalPages: Math.ceil(totalResults / limit),
        totalResults,
    };
};

export const getProposalsSentToUser = async (userId, options) => {
    const user = await User.findById(userId);
    if (!user) throw new ApiError(httpStatus.NOT_FOUND, 'User not found');

    const filter = {
        sentToCustomer: true,
        'customerInfo.email': user.email,
    };

    const { limit = 10, page = 1, sortBy } = options;
    const sort = sortBy
        ? { [sortBy.split(':')[0]]: sortBy.split(':')[1] === 'desc' ? -1 : 1 }
        : { createdAt: -1 };

    const proposals = await ClientProposal.find(filter)
        .populate('project', 'projectName projectCode')
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email')
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

    const totalResults = await ClientProposal.countDocuments(filter);

    return {
        results: proposals,
        page,
        limit,
        totalPages: Math.ceil(totalResults / limit),
        totalResults,
    };
};

/**
 * Query for work orders (converted client proposals)
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @param {string} [options.sortBy] - Sort option in the format: sortField:(desc|asc)
 * @param {number} [options.limit] - Maximum number of results per page (default = 10)
 * @param {number} [options.page] - Current page (default = 1)
 * @returns {Promise<QueryResult>}
 */
export const queryWorkOrders = async (filter = {}, options = {}) => {
    const { limit = 10, page = 1, sortBy } = options;
    const sort = sortBy
        ? { [sortBy.split(':')[0]]: sortBy.split(':')[1] === 'desc' ? -1 : 1 }
        : { convertedToWorkOrderAt: -1 };

    const effectiveFilter = {
        ...filter,
        convertedToWorkOrder: true,
    };

    const workOrders = await ClientProposal.find(effectiveFilter)
        .populate('project', 'projectName projectCode workOrderSentToPlanningEngineer')
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email')
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

    const totalResults = await ClientProposal.countDocuments(effectiveFilter);

    return {
        results: workOrders,
        page,
        limit,
        totalPages: Math.ceil(totalResults / limit),
        totalResults,
    };
};

/**
 * Convert client proposal to work order
 * @param {ObjectId} clientProposalId
 * @param {ObjectId} userId
 * @returns {Promise<ClientProposal>}
 */
export const convertToWorkOrder = async (req, clientProposalId, userId) => {
    const clientProposal = await getClientProposalById(clientProposalId);

    // Only allow conversion if proposal is approved
    if (clientProposal.status !== 'approved') {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Only approved proposals can be converted to work orders');
    }

    // Check if already converted
    if (clientProposal.convertedToWorkOrder) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'This proposal has already been converted to a work order');
    }

    // Store original values for logging
    const originalConvertedToWorkOrder = clientProposal.convertedToWorkOrder;
    const originalConvertedToWorkOrderAt = clientProposal.convertedToWorkOrderAt;
    const originalUpdatedBy = clientProposal.updatedBy;
    const originalUpdatedByModel = clientProposal.updatedByModel;

    // Determine user type for updatedBy
    const { user, userType } = await getUserAndType(userId);

    // Update proposal to mark as converted to work order
    clientProposal.convertedToWorkOrder = true;
    clientProposal.convertedToWorkOrderAt = new Date();
    clientProposal.updatedBy = userId;
    clientProposal.updatedByModel = userType;

    await clientProposal.save();

    // Log the client proposal to work order conversion activity
    try {
        await logActivity(req, {
            action: 'convert_to_work_order',
            targetModel: 'ClientProposal',
            targetId: clientProposal._id,
            targetName: clientProposal.proposalFor || 'Client Proposal',
            description: `${userType} ${user.name} (${user.email}) converted client proposal to work order `,
            changes: {
                convertedToWorkOrder: {
                    from: originalConvertedToWorkOrder,
                    to: true
                },
                convertedToWorkOrderAt: {
                    from: originalConvertedToWorkOrderAt,
                    to: new Date()
                },
                updatedBy: {
                    from: originalUpdatedBy,
                    to: userId
                },
                updatedByModel: {
                    from: originalUpdatedByModel,
                    to: userType
                }
            },
            metadata: {
                projectId: clientProposal.project?._id,
                projectData: {
                    projectId: clientProposal.project?._id,
                    projectName: clientProposal.project?.projectName,
                    projectCode: clientProposal.project?.projectCode,
                    status: clientProposal.project?.status,
                    customerName: clientProposal.project?.customerName,
                    requirementType: clientProposal.project?.requirementType,
                    architect: clientProposal.project?.architect
                },
                user: {
                    userId: user._id,
                    userName: user.name,
                    userEmail: user.email,
                    userRole: user.role,
                    userType: userType
                },
                proposalData: {
                    proposalId: clientProposal._id,
                    proposalFor: clientProposal.proposalFor,
                    projectLocation: clientProposal.projectLocation,
                    projectType: clientProposal.projectType,
                    unitCost: clientProposal.unitCost,
                    customerInfo: clientProposal.customerInfo,
                    version: clientProposal.version,
                    status: clientProposal.status,
                    sentToCustomer: clientProposal.sentToCustomer,
                    sentToCustomerAt: clientProposal.sentToCustomerAt,
                    customerRemarks: clientProposal.customerRemarks,
                    customerReviewedAt: clientProposal.customerReviewedAt,
                    createdBy: clientProposal.createdBy,
                    createdByModel: clientProposal.createdByModel,
                    updatedBy: clientProposal.updatedBy,
                    updatedByModel: clientProposal.updatedByModel,
                    createdAt: clientProposal.createdAt,
                    updatedAt: clientProposal.updatedAt
                },
                workOrderConversion: {
                    convertedToWorkOrder: true,
                    convertedAt: new Date(),
                    convertedBy: userId,
                    convertedByModel: userType,
                    proposalVersion: clientProposal.version,
                    proposalStatus: clientProposal.status,
                    workOrderCreated: true
                },
                contentSections: {
                    totalSections: 11,
                    completedSections: [
                        clientProposal.manufacturingSupply ? 'manufacturingSupply' : null,
                        clientProposal.projectOverview ? 'projectOverview' : null,
                        clientProposal.cottageSpecifications ? 'cottageSpecifications' : null,
                        clientProposal.materialDetails ? 'materialDetails' : null,
                        clientProposal.costBreakdown ? 'costBreakdown' : null,
                        clientProposal.keyDurabilityFeatures ? 'keyDurabilityFeatures' : null,
                        clientProposal.additionalFeatures ? 'additionalFeatures' : null,
                        clientProposal.paymentTerms ? 'paymentTerms' : null,
                        clientProposal.salesTerms ? 'salesTerms' : null,
                        clientProposal.contactInformation ? 'contactInformation' : null
                    ].filter(Boolean).length,
                    sectionsProvided: [
                        clientProposal.manufacturingSupply ? 'manufacturingSupply' : null,
                        clientProposal.projectOverview ? 'projectOverview' : null,
                        clientProposal.cottageSpecifications ? 'cottageSpecifications' : null,
                        clientProposal.materialDetails ? 'materialDetails' : null,
                        clientProposal.costBreakdown ? 'costBreakdown' : null,
                        clientProposal.keyDurabilityFeatures ? 'keyDurabilityFeatures' : null,
                        clientProposal.additionalFeatures ? 'additionalFeatures' : null,
                        clientProposal.paymentTerms ? 'paymentTerms' : null,
                        clientProposal.salesTerms ? 'salesTerms' : null,
                        clientProposal.contactInformation ? 'contactInformation' : null
                    ].filter(Boolean)
                },
                workflow: {
                    proposalToWorkOrder: true,
                    proposalWorkflow: true,
                    workOrderWorkflow: true,
                    conversionComplete: true
                }
            }
        });
    } catch (error) {
        console.error('Error logging client proposal to work order conversion:', error);
    }

    return clientProposal.populate(['project', 'createdBy', 'updatedBy']);
};

/**
 * Send work order to planning engineer
 * @param {ObjectId} clientProposalId
 * @param {ObjectId} userId
 * @returns {Promise<ClientProposal>}
 */
export const sendWorkOrderToPlanningEngineer = async (req, clientProposalId, userId) => {
    const clientProposal = await getClientProposalById(clientProposalId);

    // Only allow sending if proposal is converted to work order
    if (!clientProposal.convertedToWorkOrder) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Only converted work orders can be sent to planning engineers');
    }

    // Check if already sent to planning engineer
    if (clientProposal.project.workOrderSentToPlanningEngineer) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'This work order has already been sent to planning engineer');
    }

    // Store original values for logging
    const originalWorkOrderSentToPlanningEngineer = clientProposal.project.workOrderSentToPlanningEngineer;
    const originalWorkOrderSentToPlanningEngineerAt = clientProposal.project.workOrderSentToPlanningEngineerAt;
    const originalWorkOrderSentToPlanningEngineerBy = clientProposal.project.workOrderSentToPlanningEngineerBy;
    const originalWorkOrderSentToPlanningEngineerByModel = clientProposal.project.workOrderSentToPlanningEngineerByModel;
    const originalUpdatedBy = clientProposal.updatedBy;
    const originalUpdatedByModel = clientProposal.updatedByModel;

    // Determine user type for updatedBy
    const { user, userType } = await getUserAndType(userId);

    // Update project to mark as sent to planning engineer
    await Project.findByIdAndUpdate(clientProposal.project._id, {
        workOrderSentToPlanningEngineer: true,
        workOrderSentToPlanningEngineerAt: new Date(),
        workOrderSentToPlanningEngineerBy: userId,
        workOrderSentToPlanningEngineerByModel: userType,
    });

    // Update proposal's updatedBy fields
    clientProposal.updatedBy = userId;
    clientProposal.updatedByModel = userType;
    await clientProposal.save();

    // Log the work order to planning engineer sending activity
    try {
        await logActivity(req, {
            action: 'send_work_order_to_planning_engineer',
            targetModel: 'ClientProposal',
            targetId: clientProposal._id,
            targetName: clientProposal.proposalFor || 'Client Proposal',
            description: `${userType} ${user.name} (${user.email}) sent work order to planning engineer `,
            changes: {
                workOrderSentToPlanningEngineer: {
                    from: originalWorkOrderSentToPlanningEngineer,
                    to: true
                },
                workOrderSentToPlanningEngineerAt: {
                    from: originalWorkOrderSentToPlanningEngineerAt,
                    to: new Date()
                },
                workOrderSentToPlanningEngineerBy: {
                    from: originalWorkOrderSentToPlanningEngineerBy,
                    to: userId
                },
                workOrderSentToPlanningEngineerByModel: {
                    from: originalWorkOrderSentToPlanningEngineerByModel,
                    to: userType
                },
                updatedBy: {
                    from: originalUpdatedBy,
                    to: userId
                },
                updatedByModel: {
                    from: originalUpdatedByModel,
                    to: userType
                }
            },
            metadata: {
                projectId: clientProposal.project?._id,
                projectData: {
                    projectId: clientProposal.project?._id,
                    projectName: clientProposal.project?.projectName,
                    projectCode: clientProposal.project?.projectCode,
                    status: clientProposal.project?.status,
                    customerName: clientProposal.project?.customerName,
                    requirementType: clientProposal.project?.requirementType,
                    architect: clientProposal.project?.architect
                },
                user: {
                    userId: user._id,
                    userName: user.name,
                    userEmail: user.email,
                    userRole: user.role,
                    userType: userType
                },
                proposalData: {
                    proposalId: clientProposal._id,
                    proposalFor: clientProposal.proposalFor,
                    projectLocation: clientProposal.projectLocation,
                    projectType: clientProposal.projectType,
                    unitCost: clientProposal.unitCost,
                    customerInfo: clientProposal.customerInfo,
                    version: clientProposal.version,
                    status: clientProposal.status,
                    sentToCustomer: clientProposal.sentToCustomer,
                    sentToCustomerAt: clientProposal.sentToCustomerAt,
                    customerRemarks: clientProposal.customerRemarks,
                    customerReviewedAt: clientProposal.customerReviewedAt,
                    convertedToWorkOrder: clientProposal.convertedToWorkOrder,
                    convertedToWorkOrderAt: clientProposal.convertedToWorkOrderAt,
                    createdBy: clientProposal.createdBy,
                    createdByModel: clientProposal.createdByModel,
                    updatedBy: clientProposal.updatedBy,
                    updatedByModel: clientProposal.updatedByModel,
                    createdAt: clientProposal.createdAt,
                    updatedAt: clientProposal.updatedAt
                },
                workOrderSending: {
                    sentToPlanningEngineer: true,
                    sentAt: new Date(),
                    sentBy: userId,
                    sentByModel: userType,
                    proposalVersion: clientProposal.version,
                    proposalStatus: clientProposal.status,
                    workOrderStatus: 'sent_to_planning_engineer',
                    planningEngineerNotification: true
                },
                contentSections: {
                    totalSections: 11,
                    completedSections: [
                        clientProposal.manufacturingSupply ? 'manufacturingSupply' : null,
                        clientProposal.projectOverview ? 'projectOverview' : null,
                        clientProposal.cottageSpecifications ? 'cottageSpecifications' : null,
                        clientProposal.materialDetails ? 'materialDetails' : null,
                        clientProposal.costBreakdown ? 'costBreakdown' : null,
                        clientProposal.keyDurabilityFeatures ? 'keyDurabilityFeatures' : null,
                        clientProposal.additionalFeatures ? 'additionalFeatures' : null,
                        clientProposal.paymentTerms ? 'paymentTerms' : null,
                        clientProposal.salesTerms ? 'salesTerms' : null,
                        clientProposal.contactInformation ? 'contactInformation' : null
                    ].filter(Boolean).length,
                    sectionsProvided: [
                        clientProposal.manufacturingSupply ? 'manufacturingSupply' : null,
                        clientProposal.projectOverview ? 'projectOverview' : null,
                        clientProposal.cottageSpecifications ? 'cottageSpecifications' : null,
                        clientProposal.materialDetails ? 'materialDetails' : null,
                        clientProposal.costBreakdown ? 'costBreakdown' : null,
                        clientProposal.keyDurabilityFeatures ? 'keyDurabilityFeatures' : null,
                        clientProposal.additionalFeatures ? 'additionalFeatures' : null,
                        clientProposal.paymentTerms ? 'paymentTerms' : null,
                        clientProposal.salesTerms ? 'salesTerms' : null,
                        clientProposal.contactInformation ? 'contactInformation' : null
                    ].filter(Boolean)
                },
                workflow: {
                    proposalToWorkOrder: true,
                    workOrderToPlanningEngineer: true,
                    proposalWorkflow: true,
                    workOrderWorkflow: true,
                    planningEngineerWorkflow: true,
                    sendingComplete: true
                }
            }
        });
    } catch (error) {
        console.error('Error logging work order to planning engineer sending:', error);
    }

    return clientProposal.populate(['project', 'createdBy', 'updatedBy']);
};

export const sendProposalDocumentToCustomer = async (req, projectId, file, userId) => {
  // For S3 flow, the frontend will pass s3Key in body (uploaded via /files/initiate-upload)
  const s3Key = req.body?.s3Key;
  if (!s3Key) {
    throw new ApiError(httpStatus.BAD_REQUEST, 's3Key is required');
  }

  // Find project and customer info
  const project = await Project.findById(projectId).populate('lead');
  if (!project) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
  }

  const { user, userType } = await getUserAndType(userId);

  // Create a minimal proposal marked as sent with attachment reference
  const clientProposal = await ClientProposal.create({
    project: project._id,
    customerInfo: {
      name: project.lead?.customerName || 'Customer',
      email: project.lead?.email || '',
      phone: project.lead?.mobileNumber || '',
      address: [project.lead?.city, project.lead?.state].filter(Boolean).join(', '),
    },
    proposalFor: 'Shared Document',
    projectLocation: [project.lead?.city, project.lead?.state].filter(Boolean).join(', '),
    status: 'sent',
    sentToCustomer: true,
    sentToCustomerAt: new Date(),
    createdBy: userId,
    createdByModel: userType,
    updatedBy: userId,
    updatedByModel: userType,
  });

  // Store S3 reference (no DB blob). Frontend will use /v1/files/signed-url/{key} to view/download
  clientProposal.additionalFeatures = `Attachment: ${s3Key}`;
  await clientProposal.save();

  try {
    await logActivity(req, {
      action: 'upload',
      targetModel: 'ClientProposal',
      targetId: clientProposal._id,
      targetName: 'Shared Document',
      description: `${userType} ${user.name} sent a document to customer`,
      metadata: {
        projectId: project._id,
        s3Key,
      },
    });
  } catch (e) {
    console.error('Log activity failed for sendProposalDocumentToCustomer:', e);
  }

  return clientProposal;
};

export const getProposalFileById = async (fileId, userId) => {
  const file = await ClientProposalFile.findById(fileId).populate('proposal', 'sentToCustomer customerInfo createdBy');
  if (!file) throw new ApiError(httpStatus.NOT_FOUND, 'File not found');

  // Authorization: allow creator/admin or the customer the proposal was sent to
  const proposal = await ClientProposal.findById(file.proposal).populate('createdBy', 'email role').lean();
  if (!proposal) throw new ApiError(httpStatus.NOT_FOUND, 'Parent proposal not found');

  const requesterUser = await User.findById(userId) || await Admin.findById(userId);
  if (!requesterUser) throw new ApiError(httpStatus.FORBIDDEN, 'Forbidden');

  const isCreator = proposal.createdBy && proposal.createdBy._id?.toString() === userId.toString();
  const isAdmin = requesterUser.role && String(requesterUser.role).toLowerCase() === 'admin';
  const isCustomer = proposal.sentToCustomer && proposal.customerInfo?.email && proposal.customerInfo.email === requesterUser.email;

  if (!(isCreator || isAdmin || isCustomer)) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Forbidden');
  }

  return { file, filename: file.originalName };
};