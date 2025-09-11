import { roles } from '../config/roles.js';

import BOM from '../models/bom.model.js';
import Project from '../models/project.model.js';
import User from '../models/user.model.js';
import ApiError from '../utils/ApiError.js';
import httpStatus from 'http-status';
import Roles from '../config/enums/roles.enum.js';
import { mongoose } from 'mongoose';
import socketService from './socket.service.js';

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
        .populate('items.vendor')
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
        .populate('items.addedBy', 'name email')
        .populate('assignedToSiteEngineer', 'name email')
        .populate('sentToSiteEngineerBy', 'name email');

    if (!bom) {
        throw new ApiError(httpStatus.NOT_FOUND, 'BOM not found');
    }

    return bom;
};

/**
 * Get a single BOM by ID for site engineers (assigned to them)
 * @param {string} bomId - The BOM ID
 * @param {string} siteEngineerId - The site engineer ID
 * @returns {Promise<BOM>}
 */
export const getBOMByIdForSiteEngineer = async (bomId, siteEngineerId) => {
    const bom = await BOM.findOne({
        _id: bomId,
        assignedToSiteEngineer: siteEngineerId
    })
        .populate('createdBy', 'name email')
        .populate('projectId', 'projectName projectCode')
        .populate('items.addedBy', 'name email')
        .populate('assignedToSiteEngineer', 'name email')
        .populate('sentToSiteEngineerBy', 'name email');

    if (!bom) {
        throw new ApiError(httpStatus.NOT_FOUND, 'BOM not found or not assigned to you');
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
    const mongoFilter = { status: { $in: ['submitted', 'approved', 'rejected', 'pending', 'finalized'] } };
    if (filter.createdBy) {
        mongoFilter.createdBy = filter.createdBy;
    }
    if (filter.projectId) {
        mongoFilter.projectId = filter.projectId;
    }
    const boms = await BOM.find(mongoFilter)
        .populate('createdBy', 'name email')
        .populate('items.vendor')
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

    // Only allow review if BOM is in submitted status or finalized status
    const allowedStatuses = ['submitted', 'finalized'];
    if (!allowedStatuses.includes(bom.status)) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Can only review BOMs in submitted status or finalized status');
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
    const { limit = 10, page = 1, sortBy } = options;
    const sort = sortBy
        ? { [sortBy.split(':')[0]]: sortBy.split(':')[1] === 'desc' ? -1 : 1 }
        : { name: 1 };

    const users = await User.find({ role: Roles.PLANNING_ENGINEER })
        .select('name email phone role')
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

    const totalResults = await User.countDocuments({ role: Roles.PLANNING_ENGINEER });

    return {
        results: users,
        page,
        limit,
        totalPages: Math.ceil(totalResults / limit),
        totalResults,
    };
};

/**
 * Assign BOM to site engineer
 * @param {string} projectId - The project ID
 * @param {string} bomId - The BOM ID
 * @param {Object} assignmentData - Assignment data
 * @param {Object} user - The authenticated user
 * @returns {Promise<BOM>}
 */
export const assignBOMToSiteEngineer = async (projectId, bomId, assignmentData, user) => {
    const bom = await BOM.findOne({ _id: bomId, projectId });
    if (!bom) {
        throw new ApiError(httpStatus.NOT_FOUND, 'BOM not found');
    }

    // Verify the site engineer exists and has the correct role
    const siteEngineer = await User.findById(assignmentData.siteEngineerId);
    if (!siteEngineer || siteEngineer.role !== Roles.SITE_ENGINEER) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid site engineer');
    }

    // Update BOM with assignment details
    bom.assignedToSiteEngineer = assignmentData.siteEngineerId;
    bom.assignedAt = new Date();
    bom.status = 'site_engineer_review';
    bom.isRoughBOM = true; // Mark as rough BOM for site engineer review
    bom.sentToSiteEngineer = true;
    bom.sentToSiteEngineerAt = new Date();
    bom.sentToSiteEngineerBy = user.id;
    bom.updatedAt = new Date();

    await bom.save();

    // Send notification to site engineer
    try {
        const populatedBom = await bom.populate(['assignedToSiteEngineer', 'createdBy', 'projectId']);

        await socketService.handleSystemNotification(
            [assignmentData.siteEngineerId],
            {
                title: 'New BOM Assignment',
                message: `A new BOM has been assigned to you for project: ${populatedBom.projectId?.projectName || 'Unknown Project'}`,
                type: 'info',
                data: {
                    bomId: bom._id,
                    projectId: bom.projectId,
                    projectName: populatedBom.projectId?.projectName,
                    assignedBy: populatedBom.createdBy?.name,
                    sentToSiteEngineer: bom.sentToSiteEngineer,
                    sentToSiteEngineerAt: bom.sentToSiteEngineerAt,
                    sentToSiteEngineerBy: populatedBom.sentToSiteEngineerBy?.name
                }
            }
        );
    } catch (error) {
        console.error('Failed to send BOM assignment notification:', error);
        // Don't throw error as notification failure shouldn't break the assignment
    }

    return bom.populate(['assignedToSiteEngineer', 'createdBy', 'projectId', 'sentToSiteEngineerBy']);
};

/**
 * Get BOMs assigned to site engineer
 * @param {string} siteEngineerId - The site engineer ID
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @returns {Promise<Object>}
 */
export const getSiteEngineerBOMs = async (siteEngineerId, filter, options) => {
    console.log('getSiteEngineerBOMs called with:', { siteEngineerId, filter, options });

    // Temporary fix: Update existing BOMs that are assigned but don't have isRoughBOM set
    try {
        const updateResult = await BOM.updateMany(
            {
                assignedToSiteEngineer: siteEngineerId,
                isRoughBOM: { $ne: true }
            },
            {
                $set: { isRoughBOM: true }
            }
        );
        if (updateResult.modifiedCount > 0) {
            console.log(`Updated ${updateResult.modifiedCount} BOMs to have isRoughBOM: true`);
        }
    } catch (error) {
        console.error('Error updating existing BOMs:', error);
    }

    const { limit = 10, page = 1, sortBy } = options;
    const sort = sortBy
        ? { [sortBy.split(':')[0]]: sortBy.split(':')[1] === 'desc' ? -1 : 1 }
        : { assignedAt: -1 };

    const bomFilter = {
        assignedToSiteEngineer: siteEngineerId,
        $or: [
            { isRoughBOM: true },
            { status: { $in: ['site_engineer_review', 'site_engineer_updated'] } }
        ]
    };

    // Add filter conditions only if they have valid values
    if (filter.status && filter.status.trim() !== '') {
        bomFilter.status = filter.status;
    }

    if (filter.projectId && filter.projectId.trim() !== '' && mongoose.Types.ObjectId.isValid(filter.projectId)) {
        bomFilter.projectId = filter.projectId;
    }

    console.log('BOM filter:', bomFilter);

    const boms = await BOM.find(bomFilter)
        .populate('createdBy', 'name email')
        .populate('projectId', 'projectName projectCode')
        .populate('assignedToSiteEngineer', 'name email')
        .populate('sentToSiteEngineerBy', 'name email')
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

    console.log('Found BOMs:', boms.length);
    console.log('BOMs:', boms.map(bom => ({
        id: bom._id,
        title: bom.title,
        status: bom.status,
        isRoughBOM: bom.isRoughBOM,
        assignedToSiteEngineer: bom.assignedToSiteEngineer
    })));

    // Debug: Check all BOMs assigned to this site engineer (without isRoughBOM filter)
    const allAssignedBOMs = await BOM.find({ assignedToSiteEngineer: siteEngineerId })
        .select('_id title status isRoughBOM assignedToSiteEngineer')
        .lean();
    console.log('All BOMs assigned to site engineer (without isRoughBOM filter):', allAssignedBOMs.length);
    console.log('All assigned BOMs:', allAssignedBOMs);

    const totalResults = await BOM.countDocuments(bomFilter);
    console.log('Total results count:', totalResults);

    return {
        results: boms,
        page,
        limit,
        totalPages: Math.ceil(totalResults / limit),
        totalResults,
    };
};

/**
 * Update BOM by site engineer
 * @param {string} projectId - The project ID
 * @param {string} bomId - The BOM ID
 * @param {Object} updateData - Update data
 * @param {Object} user - The authenticated user
 * @returns {Promise<BOM>}
 */
export const updateBOMBySiteEngineer = async (projectId, bomId, updateData, user) => {
    const bom = await BOM.findOne({ _id: bomId, projectId, assignedToSiteEngineer: user.id });
    if (!bom) {
        throw new ApiError(httpStatus.NOT_FOUND, 'BOM not found or not assigned to you');
    }

    // Update BOM items with new data
    if (updateData.items) {
        const itemsWithTotal = updateData.items.map(item => ({
            ...item,
            totalEstimatedCost: item.quantity * item.estimatedUnitCost,
            addedBy: user.id,
        }));
        bom.items = itemsWithTotal;
    }

    // Update other fields
    if (updateData.remarks) bom.remarks = updateData.remarks;
    if (updateData.siteEngineerRemarks) bom.siteEngineerRemarks = updateData.siteEngineerRemarks;

    bom.siteEngineerUpdatedAt = new Date();
    bom.updatedBySiteEngineer = user.id;
    bom.updatedAt = new Date();

    await bom.save();
    return bom.populate(['assignedToSiteEngineer', 'createdBy', 'projectId', 'items.addedBy']);
};

/**
 * Submit updated BOM to planning engineer
 * @param {string} projectId - The project ID
 * @param {string} bomId - The BOM ID
 * @param {Object} submitData - Submit data
 * @param {Object} user - The authenticated user
 * @returns {Promise<BOM>}
 */
export const submitUpdatedBOMToPlanning = async (projectId, bomId, submitData, user) => {
    const bom = await BOM.findOne({ _id: bomId, projectId, assignedToSiteEngineer: user.id });
    if (!bom) {
        throw new ApiError(httpStatus.NOT_FOUND, 'BOM not found or not assigned to you');
    }

    // Create a new BOM based on the updated rough BOM
    const newBOMData = {
        projectId: bom.projectId,
        architectDocumentId: bom.architectDocumentId,
        sourceBOMId: bom._id, // Reference to the rough BOM
        title: submitData.title || `Updated BOM from ${bom.title || 'Rough BOM'}`,
        remarks: submitData.remarks || bom.siteEngineerRemarks,
        status: 'planning_review',
        items: bom.items,
        isRoughBOM: false,
        originalRoughBOMId: bom._id,
    };

    // Create the new BOM
    const newBOM = await createBOM(projectId, newBOMData, user);

    // Update the original rough BOM to reference the new BOM
    bom.updatedBOMId = newBOM._id;
    bom.status = 'site_engineer_updated';
    bom.updatedAt = new Date();
    await bom.save();

    return newBOM;
};

/**
 * Get rough BOMs for planning engineer review
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @returns {Promise<Object>}
 */
export const getRoughBOMsForPlanning = async (filter, options) => {
    const { limit = 10, page = 1, sortBy } = options;
    const sort = sortBy
        ? { [sortBy.split(':')[0]]: sortBy.split(':')[1] === 'desc' ? -1 : 1 }
        : { createdAt: -1 };

    const bomFilter = {
        status: 'planning_review',
        isRoughBOM: false,
    };

    // Add filter conditions only if they have valid values
    if (filter.projectId && filter.projectId.trim() !== '' && mongoose.Types.ObjectId.isValid(filter.projectId)) {
        bomFilter.projectId = filter.projectId;
    }

    const boms = await BOM.find(bomFilter)
        .populate('createdBy', 'name email')
        .populate('projectId', 'projectName projectCode')
        .populate('originalRoughBOMId', 'title createdBy')
        .populate('originalRoughBOMId.createdBy', 'name email')
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
 * Get site engineers list
 * @param {Object} options - Query options
 * @param {string} projectId - Optional project ID to filter assigned site engineers
 * @returns {Promise<Object>}
 */
export const getSiteEngineers = async (options, projectId = null) => {
    console.log('getSiteEngineers service called with:', { options, projectId });

    const { limit = 10, page = 1, sortBy } = options;
    const sort = sortBy
        ? { [sortBy.split(':')[0]]: sortBy.split(':')[1] === 'desc' ? -1 : 1 }
        : { name: 1 };

    let users;
    let totalResults;

    if (projectId && projectId.trim() !== '' && mongoose.Types.ObjectId.isValid(projectId)) {
        console.log('Fetching site engineers for project:', projectId);

        // Get project with populated requirement and sharedWith data
        const project = await Project.findById(projectId)
            .populate({
                path: 'requirement',
                populate: {
                    path: 'sharedWith.user',
                    select: 'name email phone role'
                }
            });

        console.log('Project found:', project ? 'Yes' : 'No', project ? {
            projectName: project.projectName,
            requirementId: project.requirement?._id,
            sharedWithCount: project.requirement?.sharedWith?.length || 0
        } : null);

        if (!project) {
            throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
        }

        // Check if project has any shared site engineers
        if (!project.requirement || !project.requirement.sharedWith || project.requirement.sharedWith.length === 0) {
            console.log('No site engineers shared with project');
            return {
                results: [],
                page,
                limit,
                totalPages: 0,
                totalResults: 0,
            };
        }

        // Get user IDs from sharedWith array
        const sharedUserIds = project.requirement.sharedWith.map(share => {
            // Handle both populated and unpopulated user references
            if (share.user && typeof share.user === 'object' && share.user._id) {
                return share.user._id;
            } else if (share.user) {
                return share.user;
            }
            return null;
        }).filter(id => id !== null); // Remove any null values

        console.log('Shared user IDs:', sharedUserIds);

        // Filter to only get site engineers
        users = await User.find({
            _id: { $in: sharedUserIds },
            role: Roles.SITE_ENGINEER
        })
            .select('name email phone role')
            .sort(sort)
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();

        console.log('Found site engineers in sharedWith:', users.length);

        totalResults = await User.countDocuments({
            _id: { $in: sharedUserIds },
            role: Roles.SITE_ENGINEER
        });
    } else {
        console.log('Fetching all site engineers (no project filter)');

        // Get all site engineers (fallback for backward compatibility)
        users = await User.find({ role: Roles.SITE_ENGINEER })
            .select('name email phone role')
            .sort(sort)
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();

        totalResults = await User.countDocuments({ role: Roles.SITE_ENGINEER });
    }

    const result = {
        results: users,
        page,
        limit,
        totalPages: Math.ceil(totalResults / limit),
        totalResults,
    };

    console.log('getSiteEngineers returning:', result);
    return result;
};

/**
 * Update the original BOM with finalized vendor assignments from quote analysis
 * @param {string} projectId - The ID of the project
 * @param {string} originalBomId - The ID of the original BOM
 * @param {Array} finalizedItems - Array of items with vendor assignments and quote data
 * @param {Object} user - The authenticated user
 * @returns {Promise<BOM>}
 */
export const createFinalizedBOM = async (projectId, originalBomId, finalizedItems, user) => {
    console.log('=== createFinalizedBOM service called ===');
    console.log('Project ID:', projectId);
    console.log('Original BOM ID:', originalBomId);
    console.log('Finalized Items Count:', finalizedItems?.length);
    console.log('Finalized Items:', finalizedItems?.map(item => ({
        itemName: item.itemName,
        originalItemId: item.originalItemId,
        vendor: item.vendor
    })));

    // Verify project exists
    const project = await Project.findById(projectId);
    if (!project) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
    }

    // Verify original BOM exists
    const originalBOM = await BOM.findOne({ _id: originalBomId, projectId });
    if (!originalBOM) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Original BOM not found');
    }

    console.log('Original BOM Items:', originalBOM.items?.map(item => ({
        _id: item._id,
        itemName: item.itemName
    })));

    // Check user access (only planning engineers and admins can finalize BOMs)
    if (user.role !== 'admin' && user.role !== 'planning-engineer') {
        throw new ApiError(httpStatus.FORBIDDEN, 'Only planning engineers and admins can finalize BOMs');
    }

    // Create maps for different lookup strategies
    const originalItemsMapById = new Map();
    const originalItemsMapByName = new Map();

    originalBOM.items.forEach(item => {
        originalItemsMapById.set(item._id.toString(), item);
        originalItemsMapByName.set(item.itemName.toLowerCase().trim(), item);
    });

    // Transform finalized items while preserving original IDs and structure
    const bomItems = finalizedItems.map(finalizedItem => {
        console.log(`Processing finalized item: ${finalizedItem.itemName}`);
        console.log(`Finalized item vendor value:`, finalizedItem.vendor);
        console.log(`Finalized item vendor type:`, typeof finalizedItem.vendor);
        console.log(`Finalized item vendor is null:`, finalizedItem.vendor === null);
        console.log(`Finalized item vendor is undefined:`, finalizedItem.vendor === undefined);
        console.log(`Finalized item vendor is empty string:`, finalizedItem.vendor === '');
        // Try to find the corresponding original BOM item
        let originalItem = null;

        // First try by originalItemId if available
        if (finalizedItem.originalItemId) {
            console.log(`Trying to find by originalItemId: ${finalizedItem.originalItemId}`);
            originalItem = originalItemsMapById.get(finalizedItem.originalItemId);
        }

        // If not found by ID, try by item name (case-insensitive)
        if (!originalItem) {
            const searchName = finalizedItem.itemName.toLowerCase().trim();
            console.log(`Trying to find by name: "${searchName}"`);
            originalItem = originalItemsMapByName.get(searchName);
        }

        if (!originalItem) {
            console.log(`Available original items:`, Array.from(originalItemsMapByName.keys()));
            throw new ApiError(
                httpStatus.BAD_REQUEST,
                `Original BOM item not found for: ${finalizedItem.itemName}. Please ensure the item name matches exactly.`
            );
        }

        console.log(`Found original item: ${originalItem.itemName} (ID: ${originalItem._id})`);

        // Preserve the original item ID and structure, only update necessary fields
        const updatedItem = {
            _id: originalItem._id, // CRITICAL: Preserve original ID for quote compatibility
            itemName: originalItem.itemName,
            description: finalizedItem.description || originalItem.description,
            brand: finalizedItem.brand || originalItem.brand || null, // Include brand from finalized item or preserve original
            location: finalizedItem.location || originalItem.location, // Use finalized location if provided
            category: originalItem.category,
            unit: originalItem.unit,
            quantity: originalItem.quantity,
            estimatedUnitCost: finalizedItem.finalPrice || finalizedItem.estimatedUnitCost || originalItem.estimatedUnitCost,
            totalEstimatedCost: originalItem.quantity * (finalizedItem.finalPrice || finalizedItem.estimatedUnitCost || originalItem.estimatedUnitCost),
            remarks: finalizedItem.remarks || originalItem.remarks,
            addedBy: originalItem.addedBy, // Preserve original addedBy
            addedAt: originalItem.addedAt, // Preserve original timestamp
            // Add new finalized fields
            isFinalized: true,
            vendor: finalizedItem.vendor, // vendor is already the vendor ID string
            finalizedAt: new Date(),
            finalizedBy: user.id,
            finalPrice: finalizedItem.finalPrice || finalizedItem.estimatedUnitCost,
            // Preserve any other original fields that might exist
            ...Object.fromEntries(
                Object.entries(originalItem.toObject()).filter(([key]) =>
                    !['_id', 'itemName', 'description', 'brand', 'location', 'category', 'unit', 'quantity', 'estimatedUnitCost', 'totalEstimatedCost', 'remarks', 'addedBy', 'addedAt', 'vendor'].includes(key)
                )
            )
        };

        console.log(`Updated item vendor value:`, updatedItem.vendor);
        console.log(`Updated item vendor type:`, typeof updatedItem.vendor);

        return updatedItem;
    });

    // Update the original BOM with finalized data while preserving item IDs
    const updatedBOM = await BOM.findByIdAndUpdate(
        originalBomId,
        {
            title: originalBOM.title ? `${originalBOM.title} - Finalized` : 'BOM - Finalized',
            status: 'finalized', // Set status to finalized
            items: bomItems,
            remarks: `BOM finalized with vendor assignments from quote analysis on ${new Date().toLocaleDateString()}`,
            finalizedAt: new Date(),
            finalizedBy: user.id,
            updatedAt: new Date()
        },
        { new: true, runValidators: true }
    );

    return updatedBOM.populate([
        'createdBy',
        'projectId',
        'items.addedBy',
        'items.vendor',
        'finalizedBy'
    ]);
};

/**
 * Get finalized BOMs for selection
 * @param {Object} options - Query options
 * @returns {Promise<Object>}
 */
export const getFinalizedBOMs = async (options = {}) => {
    const { limit = 10, page = 1, sortBy, projectId } = options;
    const sort = sortBy
        ? { [sortBy.split(':')[0]]: sortBy.split(':')[1] === 'desc' ? -1 : 1 }
        : { finalizedAt: -1 };

    // Build filter for finalized BOMs
    const filter = {
        status: 'approved',
        finalizedAt: { $exists: true, $ne: null }
    };

    // Add project filter if provided
    if (projectId) {
        filter.projectId = projectId;
    }

    const boms = await BOM.find(filter)
        .populate('projectId', 'projectName projectCode')
        .populate('createdBy', 'name email')
        .populate('finalizedBy', 'name email')
        .populate('items.vendor')
        .select('_id title projectId status finalizedAt finalizedBy items')
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