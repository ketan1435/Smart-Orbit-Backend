import { roles } from '../config/roles.js';

import BOM from '../models/bom.model.js';
import Project from '../models/project.model.js';
import User from '../models/user.model.js';
import ApiError from '../utils/ApiError.js';
import httpStatus from 'http-status';
import Roles from '../config/enums/roles.enum.js';
import { mongoose } from 'mongoose';

/**
 * Create a BOM for a project
 * @param {string} projectId - The ID of the project
 * @param {Object} bomData - The BOM data
 * @param {Object} user - The authenticated user
 * @returns {Promise<BOM>}
 */
export const createBOM = async (projectId, bomData, user) => {
    // Verify project exists
    const project = await Project.findById(projectId);
    if (!project) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
    }

    // Get the highest version number for this project
    const lastBOM = await BOM.findOne({ projectId }).sort({ version: -1 });
    const version = lastBOM ? lastBOM.version + 1 : 1;

    // Calculate total estimated cost for each item
    const itemsWithTotal = bomData.items.map(item => ({
        ...item,
        totalEstimatedCost: item.quantity * item.estimatedUnitCost,
        addedBy: user.id,
    }));

    const bomBody = {
        ...bomData,
        projectId,
        version,
        items: itemsWithTotal,
        createdBy: user.id,
    };

    const bom = await BOM.create(bomBody);
    return bom.populate(['createdBy', 'projectId', 'items.addedBy']);
};

/**
 * Query BOMs for a project 
 * with pagination, sorting, and filtering
 * @param {string} projectId - The project ID
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @returns {Promise<Object>}
 */
export const queryBOMs = async (projectId, filter, options) => {
    const { limit = 10, page = 1, sortBy } = options;
    const sort = sortBy
        ? { [sortBy.split(':')[0]]: sortBy.split(':')[1] === 'desc' ? -1 : 1 }
        : { createdAt: -1 };

    const bomFilter = { projectId, ...filter };

    const boms = await BOM.find(bomFilter)
        .populate('createdBy', 'name email')
        .populate('projectId', 'projectName projectCode')
        .populate('items.addedBy', 'name email')
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

    const totalResults = await BOM.countDocuments(bomFilter);

    return {
        results: boms,
        page,
        limit,
        totalPages: Math.ceil(totalResults / limit),
        totalResults,
    };
};

/**
 * Get a single BOM by ID
 * @param {string} projectId - The project ID
 * @param {string} bomId - The BOM ID
 * @returns {Promise<BOM>}
 */
export const getBOMById = async (projectId, bomId) => {
    const bom = await BOM.findOne({ _id: bomId, projectId })
        .populate('createdBy', 'name email')
        .populate('projectId', 'projectName projectCode')
        .populate('items.addedBy', 'name email');

    if (!bom) {
        throw new ApiError(httpStatus.NOT_FOUND, 'BOM not found');
    }

    return bom;
};

/**
 * Update a BOM
 * @param {string} projectId - The project ID
 * @param {string} bomId - The BOM ID
 * @param {Object} updateBody - The update data
 * @param {Object} user - The authenticated user
 * @returns {Promise<BOM>}
 */
export const updateBOM = async (projectId, bomId, updateBody, user) => {
    const bom = await BOM.findOne({ _id: bomId, projectId });
    if (!bom) {
        throw new ApiError(httpStatus.NOT_FOUND, 'BOM not found');
    }

    // Only allow updates if BOM is in draft status
    if (bom.status !== 'draft') {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Can only update BOMs in draft status');
    }

    // If items are being updated, calculate total estimated cost
    if (updateBody.items) {
        updateBody.items = updateBody.items.map(item => ({
            ...item,
            totalEstimatedCost: item.quantity * item.estimatedUnitCost,
            addedBy: item.addedBy || user.id,
            addedAt: item.addedAt || new Date(),
        }));
    }

    Object.assign(bom, updateBody);
    await bom.save();

    return bom.populate(['createdBy', 'projectId', 'items.addedBy']);
};

/**
 * Update BOM status (submit, approve, reject)
 * @param {string} projectId - The project ID
 * @param {string} bomId - The BOM ID
 * @param {Object} statusUpdate - The status update data
 * @param {Object} user - The authenticated user
 * @returns {Promise<BOM>}
 */
export const updateBOMStatus = async (projectId, bomId, statusUpdate, user) => {
    const bom = await BOM.findOne({ _id: bomId, projectId });
    if (!bom) {
        throw new ApiError(httpStatus.NOT_FOUND, 'BOM not found');
    }

    const { status, remarks } = statusUpdate;

    // Validate status transitions
    const validTransitions = {
        draft: ['submitted'],
        submitted: ['approved', 'rejected', 'draft'],
        approved: ['rejected'],
        rejected: ['draft'],
    };

    if (!validTransitions[bom.status].includes(status)) {
        throw new ApiError(
            httpStatus.BAD_REQUEST,
            `Cannot change status from ${bom.status} to ${status}`
        );
    }

    bom.status = status;
    if (remarks) {
        bom.remarks = remarks;
    }

    await bom.save();
    return bom.populate(['createdBy', 'projectId', 'items.addedBy']);
};

/**
 * Delete a BOM
 * @param {string} projectId - The project ID
 * @param {string} bomId - The BOM ID
 * @param {Object} user - The authenticated user
 * @returns {Promise<BOM>}
 */
export const deleteBOM = async (projectId, bomId, user) => {
    const bom = await BOM.findOne({ _id: bomId, projectId });
    if (!bom) {
        throw new ApiError(httpStatus.NOT_FOUND, 'BOM not found');
    }

    // Only allow deletion if BOM is in draft status
    if (bom.status !== 'draft') {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Can only delete BOMs in draft status');
    }

    await BOM.findByIdAndDelete(bomId);
    return bom;
};

/**
 * Get reusable BOMs
 * @param {Object} options - Query options
 * @returns {Promise<Object>}
 */
export const getReusableBOMs = async (options) => {
    const { limit = 10, page = 1, sortBy } = options;
    const sort = sortBy
        ? { [sortBy.split(':')[0]]: sortBy.split(':')[1] === 'desc' ? -1 : 1 }
        : { createdAt: -1 };

    const filter = { isReusable: true };

    const boms = await BOM.find(filter)
        .populate('createdBy', 'name email')
        .populate('projectId', 'projectName projectCode')
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

    const totalResults = await BOM.countDocuments(filter);

    return {
        results: boms,
        page,
        limit,
        totalPages: Math.ceil(totalResults / limit),
        totalResults,
    };
};

/**
 * Submit BOM for admin review
 * @param {string} projectId - The project ID
 * @param {string} bomId - The BOM ID
 * @param {Object} user - The authenticated user
 * @returns {Promise<BOM>}
 */
export const submitBOM = async (projectId, bomId, user) => {
    const bom = await BOM.findOne({ _id: bomId, projectId });
    if (!bom) {
        throw new ApiError(httpStatus.NOT_FOUND, 'BOM not found');
    }

    // Only allow submission if BOM is in draft status
    if (bom.status !== 'draft') {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Can only submit BOMs in draft status');
    }

    // Validate BOM has at least one item
    if (!bom.items || bom.items.length === 0) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'BOM must have at least one item to submit');
    }

    bom.status = 'submitted';
    await bom.save();

    return bom.populate(['createdBy', 'projectId', 'items.addedBy']);
};

/**
 * Get submitted BOMs for admin review
 * @param {Object} filter - Filter options
 * @param {Object} options - Query options
 * @returns {Promise<Object>}
 */
export const getSubmittedBOMs = async (filter = {}, options) => {
    const { limit = 10, page = 1, sortBy } = options;
    const sort = sortBy
        ? { [sortBy.split(':')[0]]: sortBy.split(':')[1] === 'desc' ? -1 : 1 }
        : { updatedAt: -1 };

    // Build filter object with status and optional createdBy
    const mongoFilter = { status: { $in: ['submitted', 'approved', 'rejected', 'pending'] } };
    if (filter.createdBy) {
        mongoFilter.createdBy = filter.createdBy;
    }
    if (filter.projectId) {
        mongoFilter.projectId = filter.projectId;
    }
    const boms = await BOM.find(mongoFilter)
        .populate('createdBy', 'name email')
        .populate('projectId', 'projectName projectCode')
        .populate('items.addedBy', 'name email')
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

    const totalResults = await BOM.countDocuments(mongoFilter);

    return {
        results: boms,
        page,
        limit,
        totalPages: Math.ceil(totalResults / limit),
        totalResults,
    };
};

/**
 * Review BOM (admin approve/reject)
 * @param {string} projectId - The project ID
 * @param {string} bomId - The BOM ID
 * @param {Object} reviewData - The review data (status, adminRemarks)
 * @param {Object} user - The authenticated user
 * @returns {Promise<BOM>}
 */
export const reviewBOM = async (projectId, bomId, reviewData, user) => {
    const bom = await BOM.findOne({ _id: bomId, projectId });
    if (!bom) {
        throw new ApiError(httpStatus.NOT_FOUND, 'BOM not found');
    }

    // Only allow review if BOM is in submitted status
    if (bom.status !== 'submitted') {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Can only review BOMs in submitted status');
    }

    const { status, adminRemarks } = reviewData;

    bom.status = status;
    bom.adminRemarks = adminRemarks;
    await bom.save();

    return bom.populate(['createdBy', 'projectId', 'items.addedBy']);
};

/**
 * Get all BOMs (general listing)
 * @param {Object} filter - Filter options (status, projectId, search)
 * @param {Object} options - Query options (sortBy, limit, page)
 * @returns {Promise<Object>}
 */
export const getAllBOMs = async (filter = {}, options) => {
    const { limit = 50, page = 1, sortBy } = options;
    const sort = sortBy
        ? { [sortBy.split(':')[0]]: sortBy.split(':')[1] === 'desc' ? -1 : 1 }
        : { createdAt: -1 };

    // Build filter object
    const mongoFilter = {};

    // Filter by status if provided
    if (filter.status) {
        mongoFilter.status = filter.status;
    }

    // Filter by project ID if provided
    if (filter.projectId) {
        mongoFilter.projectId = filter.projectId;
    }

    // Search in title and description if provided
    if (filter.search) {
        mongoFilter.$or = [
            { title: { $regex: filter.search, $options: 'i' } },
            { description: { $regex: filter.search, $options: 'i' } }
        ];
    }

    const boms = await BOM.find(mongoFilter)
        .populate('createdBy', 'name email')
        .populate('projectId', 'projectName projectCode')
        .populate('items.addedBy', 'name email')
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

    const totalResults = await BOM.countDocuments(mongoFilter);

    return {
        results: boms,
        page,
        limit,
        totalPages: Math.ceil(totalResults / limit),
        totalResults,
    };
};

/**
 * Get procurement team members
 * @param {Object} options - Query options
 * @returns {Promise<Object>}
 */
export const getProcurementTeam = async (options) => {
    const { limit = 50, page = 1, sortBy } = options;
    const sort = sortBy
        ? { [sortBy.split(':')[0]]: sortBy.split(':')[1] === 'desc' ? -1 : 1 }
        : { name: 1 }; // Default sort by name ascending

    const filter = {
        role: Roles.PROCUREMENT,
        isActive: true // Only return active users
    };

    const users = await User.find(filter)
        .select('_id name email') // Only select necessary fields
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

    const totalResults = await User.countDocuments(filter);

    return {
        results: users,
        page,
        limit,
        totalPages: Math.ceil(totalResults / limit),
        totalResults,
    };
}; 