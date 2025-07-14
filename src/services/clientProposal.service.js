import mongoose from 'mongoose';
import httpStatus from 'http-status';
import ApiError from '../utils/ApiError.js';
import ClientProposal from '../models/clientProposal.model.js';
import User from '../models/user.model.js';
import Admin from '../models/admin.model.js';
import Project from '../models/project.model.js';
import { generateClientProposalPDF } from './jsreport.service.js';

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
export const createClientProposal = async (clientProposalBody, userId) => {
    const { user, userType } = await getUserAndType(userId);

    // Verify project exists
    const project = await Project.findById(clientProposalBody.project);
    if (!project) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
    }

    const clientProposal = await ClientProposal.create({
        ...clientProposalBody,
        createdBy: userId,
        createdByModel: userType,
        updatedBy: userId,
        updatedByModel: userType,
    });

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
export const sendToCustomer = async (clientProposalId, userId) => {
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

    // Update proposal to sent status
    clientProposal.status = 'sent';
    clientProposal.sentToCustomer = true;
    clientProposal.sentToCustomerAt = new Date();
    clientProposal.updatedBy = userId;

    // Determine user type for updatedBy
    const { userType } = await getUserAndType(userId);
    clientProposal.updatedByModel = userType;

    await clientProposal.save();

    return clientProposal.populate(['project', 'createdBy', 'updatedBy']);
};

/**
 * Customer review of client proposal
 * @param {ObjectId} clientProposalId
 * @param {Object} reviewData
 * @param {ObjectId} userId
 * @returns {Promise<ClientProposal>}
 */
export const customerReview = async (clientProposalId, reviewData, userId) => {
    const clientProposal = await getClientProposalById(clientProposalId);

    // Check if proposal was sent to customer
    if (!clientProposal.sentToCustomer) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Proposal has not been sent to customer');
    }

    // Update proposal based on customer review
    clientProposal.status = reviewData.status;
    clientProposal.customerRemarks = reviewData.remarks;
    clientProposal.customerReviewedAt = new Date();
    clientProposal.updatedBy = userId;

    // Determine user type for updatedBy
    const { userType } = await getUserAndType(userId);
    clientProposal.updatedByModel = userType;

    await clientProposal.save();

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
    const clientProposal = await ClientProposal.findById(id)
        .populate('project', 'projectName projectCode')
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
export const updateClientProposalById = async (clientProposalId, updateBody, userId) => {
    const clientProposal = await getClientProposalById(clientProposalId);

    // Check if user has permission to update (creator or admin)
    const createdById = clientProposal.createdBy?._id || clientProposal.createdBy;
    if (createdById && createdById.toString() !== userId.toString()) {
        const user = await User.findById(userId);
        if (!user || user.role !== 'admin') {
            throw new ApiError(httpStatus.FORBIDDEN, 'Forbidden');
        }
    }

    // If project is being updated, verify it exists
    if (updateBody.project) {
        const project = await Project.findById(updateBody.project);
        if (!project) {
            throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
        }
    }

    // Determine user type for updatedBy
    const { userType } = await getUserAndType(userId);

    Object.assign(clientProposal, updateBody, {
        updatedBy: userId,
        updatedByModel: userType
    });
    await clientProposal.save();

    return clientProposal.populate(['project', 'createdBy', 'updatedBy']);
};

/**
 * Update client proposal status
 * @param {ObjectId} clientProposalId
 * @param {string} status
 * @param {ObjectId} userId
 * @returns {Promise<ClientProposal>}
 */
export const updateClientProposalStatus = async (clientProposalId, status, userId) => {
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

    // Determine user type for updatedBy
    const { userType } = await getUserAndType(userId);

    clientProposal.status = status;
    clientProposal.updatedBy = userId;
    clientProposal.updatedByModel = userType;
    await clientProposal.save();

    return clientProposal.populate(['project', 'createdBy', 'updatedBy']);
};

/**
 * Create a new version of a client proposal
 * @param {ObjectId} clientProposalId
 * @param {Object} updateBody
 * @param {ObjectId} userId
 * @returns {Promise<ClientProposal>}
 */
export const createNewVersion = async (clientProposalId, updateBody, userId) => {
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
    const { userType } = await getUserAndType(userId);

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

    return newProposal.populate(['project', 'createdBy', 'updatedBy']);
};

/**
 * Delete client proposal by id
 * @param {ObjectId} clientProposalId
 * @param {ObjectId} userId
 * @returns {Promise<ClientProposal>}
 */
export const deleteClientProposalById = async (clientProposalId, userId) => {
    const clientProposal = await getClientProposalById(clientProposalId);

    // Check if user has permission to delete (creator or admin)
    const createdById = clientProposal.createdBy?._id || clientProposal.createdBy;
    if (createdById && createdById.toString() !== userId.toString()) {
        const user = await User.findById(userId);
        if (!user || user.role !== 'admin') {
            throw new ApiError(httpStatus.FORBIDDEN, 'Forbidden');
        }
    }

    await clientProposal.deleteOne();
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
        $or: [
            { status: 'sent' },
            { status: 'approved' },
            { status: 'rejected' },
        ],
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