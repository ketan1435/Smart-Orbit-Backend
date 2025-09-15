import httpStatus from 'http-status';
import { Remark, Project } from '../models/index.js';
import ApiError from '../utils/ApiError.js';

/**
 * Create a remark
 * @param {Object} remarkBody
 * @returns {Promise<Remark>}
 */
const createRemark = async (remarkBody) => {
    // Check if project exists
    const project = await Project.findById(remarkBody.projectId);
    if (!project) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
    }

    const remark = await Remark.create(remarkBody);
    return remark;
};

/**
 * Get remarks by project ID
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @returns {Promise<QueryResult>}
 */
const getRemarksByProjectId = async (filter, options) => {
    const remarks = await Remark.find(filter)
        .populate('addedBy', 'name email')
        .sort({ [options.sortBy]: options.sortOrder === 'desc' ? -1 : 1 })
        .limit(options.limit * 1)
        .skip((options.page - 1) * options.limit);

    const totalResults = await Remark.countDocuments(filter);
    const totalPages = Math.ceil(totalResults / options.limit);

    return {
        results: remarks,
        page: options.page,
        limit: options.limit,
        totalPages,
        totalResults
    };
};

/**
 * Get remark by ID
 * @param {ObjectId} remarkId
 * @returns {Promise<Remark>}
 */
const getRemarkById = async (remarkId) => {
    const remark = await Remark.findById(remarkId).populate('addedBy', 'name email');
    if (!remark) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Remark not found');
    }
    return remark;
};

/**
 * Update remark by ID
 * @param {ObjectId} remarkId
 * @param {Object} updateBody
 * @returns {Promise<Remark>}
 */
const updateRemarkById = async (remarkId, updateBody) => {
    const remark = await getRemarkById(remarkId);
    
    Object.assign(remark, {
        ...updateBody,
        updatedAt: new Date(),
        isEdited: true
    });
    
    await remark.save();
    return remark;
};

/**
 * Delete remark by ID
 * @param {ObjectId} remarkId
 * @returns {Promise<Remark>}
 */
const deleteRemarkById = async (remarkId) => {
    const remark = await getRemarkById(remarkId);
    await Remark.findByIdAndDelete(remarkId);
    return remark;
};

export {
    createRemark,
    getRemarksByProjectId,
    getRemarkById,
    updateRemarkById,
    deleteRemarkById
};
