import mongoose from 'mongoose';
import httpStatus from 'http-status';
import ApiError from '../utils/ApiError.js';
import ClientProposal from '../models/clientProposal.model.js';
import User from '../models/user.model.js';
import Admin from '../models/admin.model.js';
import Project from '../models/project.model.js';

/**
 * Create a client proposal
 * @param {Object} clientProposalBody
 * @param {ObjectId} userId
 * @returns {Promise<ClientProposal>}
 */
export const createClientProposal = async (clientProposalBody, userId) => {
    let user = await User.findById(userId);
    if (!user) {
        const admin = await Admin.findById(userId);
        if (!admin) {
            throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
        }
        user = admin;
        userId = admin._id;
    }
    if (user === undefined || user === null) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Creator not found');
    }

    // Verify project exists
    const project = await Project.findById(clientProposalBody.project);
    if (!project) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
    }

    const clientProposal = await ClientProposal.create({
        ...clientProposalBody,
        createdBy: userId,
        updatedBy: userId,
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
    if (clientProposal.createdBy.toString() !== userId.toString()) {
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

    Object.assign(clientProposal, updateBody, { updatedBy: userId });
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
    if (clientProposal.createdBy.toString() !== userId.toString()) {
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

    clientProposal.status = status;
    clientProposal.updatedBy = userId;
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
    if (originalProposal.createdBy.toString() !== userId.toString()) {
        const user = await User.findById(userId);
        if (!user || user.role !== 'admin') {
            throw new ApiError(httpStatus.FORBIDDEN, 'Forbidden');
        }
    }

    // Create new version with incremented version number
    const newVersion = originalProposal.version + 1;

    const newProposal = await ClientProposal.create({
        ...originalProposal.toObject(),
        ...updateBody,
        _id: undefined, // Remove the original _id
        version: newVersion,
        status: 'draft', // Reset status to draft for new version
        createdBy: userId,
        updatedBy: userId,
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
    if (clientProposal.createdBy.toString() !== userId.toString()) {
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