import { roles } from '../config/roles.js';

import BOM from '../models/bom.model.js';
import Project from '../models/project.model.js';
import User from '../models/user.model.js';
import ApiError from '../utils/ApiError.js';
import httpStatus from 'http-status';
import Roles from '../config/enums/roles.enum.js';
import { mongoose } from 'mongoose';
import socketService from './socket.service.js';
import { logActivity } from '../middlewares/activityLog.middleware.js';

/**
 * Create a BOM for a project
 * @param {string} projectId - The ID of the project
 * @param {Object} bomData - The BOM data
 * @param {Object} user - The authenticated user
 * @returns {Promise<BOM>}
 */
export const createBOM = async (req, projectId, bomData, user) => {
    // Verify project exists
    const project = await Project.findById(projectId).select('projectName projectCode status customerName requirementType architect');
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

    // Log the BOM creation activity
    try {
        await logActivity(req, {
            action: 'create_bom',
            targetModel: 'BOM',
            targetId: bom._id,
            targetName: bom.title || `BOM v${bom.version}`,
            description: `${user.role === 'admin' ? 'Admin' : 'User'} ${user.name} (${user.email}) created BOM version ${bom.version} for project: ${project.projectName}`,
            changes: {
                bomCreated: {
                    from: null,
                    to: bom._id
                },
                version: {
                    from: null,
                    to: bom.version
                },
                status: {
                    from: null,
                    to: bom.status
                },
                createdBy: {
                    from: null,
                    to: user.id
                },
                projectId: {
                    from: null,
                    to: projectId
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
                    userType: user.role === 'admin' ? 'Admin' : 'User'
                },
                bomData: {
                    bomId: bom._id,
                    title: bom.title,
                    version: bom.version,
                    status: bom.status,
                    isReusable: bom.isReusable,
                    remarks: bom.remarks,
                    architectDocumentId: bom.architectDocumentId,
                    sourceBOMId: bom.sourceBOMId,
                    projectId: bom.projectId,
                    createdBy: bom.createdBy,
                    createdAt: bom.createdAt,
                    updatedAt: bom.updatedAt
                },
                bomCreation: {
                    bomCreated: true,
                    createdBy: user.id,
                    createdByModel: user.role === 'admin' ? 'Admin' : 'User',
                    versionGenerated: bom.version,
                    statusSet: bom.status,
                    isReusable: bom.isReusable,
                    itemsCount: bom.items.length
                },
                itemsData: {
                    totalItems: bom.items.length,
                    items: bom.items.map(item => ({
                        itemName: item.itemName,
                        description: item.description,
                        brand: item.brand,
                        location: item.location,
                        vendor: item.vendor,
                        category: item.category,
                        unit: item.unit,
                        quantity: item.quantity,
                        estimatedUnitCost: item.estimatedUnitCost,
                        totalEstimatedCost: item.totalEstimatedCost,
                        remarks: item.remarks,
                        addedBy: item.addedBy
                    })),
                    totalEstimatedCost: bom.items.reduce((sum, item) => sum + item.totalEstimatedCost, 0),
                    categories: [...new Set(bom.items.map(item => item.category))],
                    vendors: [...new Set(bom.items.map(item => item.vendor).filter(Boolean))]
                },
                contentSections: {
                    totalSections: 8,
                    completedSections: [
                        bom.title ? 'title' : null,
                        bom.remarks ? 'remarks' : null,
                        bom.architectDocumentId ? 'architectDocumentId' : null,
                        bom.sourceBOMId ? 'sourceBOMId' : null,
                        bom.isReusable ? 'isReusable' : null,
                        bom.status ? 'status' : null,
                        bom.items.length > 0 ? 'items' : null,
                        bom.projectId ? 'projectId' : null
                    ].filter(Boolean).length,
                    sectionsProvided: [
                        bom.title ? 'title' : null,
                        bom.remarks ? 'remarks' : null,
                        bom.architectDocumentId ? 'architectDocumentId' : null,
                        bom.sourceBOMId ? 'sourceBOMId' : null,
                        bom.isReusable ? 'isReusable' : null,
                        bom.status ? 'status' : null,
                        bom.items.length > 0 ? 'items' : null,
                        bom.projectId ? 'projectId' : null
                    ].filter(Boolean)
                },
                workflow: {
                    bomCreation: true,
                    bomWorkflow: true,
                    projectWorkflow: true,
                    creationComplete: true
                }
            }
        });
    } catch (error) {
        console.error('Error logging BOM creation:', error);
    }

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
export const updateBOM = async (req, projectId, bomId, updateBody, user) => {
    const bom = await BOM.findOne({ _id: bomId, projectId }).populate('projectId', 'projectName projectCode status customerName requirementType architect');
    if (!bom) {
        throw new ApiError(httpStatus.NOT_FOUND, 'BOM not found');
    }

    // Only allow updates if BOM is in draft status
    if (bom.status !== 'draft') {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Can only update BOMs in draft status');
    }

    // Store original BOM data for logging
    const originalBom = {
        title: bom.title,
        remarks: bom.remarks,
        isReusable: bom.isReusable,
        status: bom.status,
        items: bom.items.map(item => ({
            itemName: item.itemName,
            description: item.description,
            brand: item.brand,
            location: item.location,
            vendor: item.vendor,
            category: item.category,
            unit: item.unit,
            quantity: item.quantity,
            estimatedUnitCost: item.estimatedUnitCost,
            totalEstimatedCost: item.totalEstimatedCost,
            remarks: item.remarks,
            addedBy: item.addedBy
        })),
        totalEstimatedCost: bom.items.reduce((sum, item) => sum + item.totalEstimatedCost, 0),
        itemsCount: bom.items.length
    };

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

    // Log the BOM update activity
    try {
        await logActivity(req, {
            action: 'update_bom',
            targetModel: 'BOM',
            targetId: bom._id,
            targetName: bom.title || `BOM v${bom.version}`,
            description: `${user.role === 'admin' ? 'Admin' : 'User'} ${user.name} (${user.email}) updated BOM version ${bom.version} for project: ${bom.projectId?.projectName || 'Unknown Project'}`,
            changes: {
                title: updateBody.title ? {
                    from: originalBom.title,
                    to: bom.title
                } : undefined,
                remarks: updateBody.remarks ? {
                    from: originalBom.remarks,
                    to: bom.remarks
                } : undefined,
                isReusable: updateBody.isReusable !== undefined ? {
                    from: originalBom.isReusable,
                    to: bom.isReusable
                } : undefined,
                items: updateBody.items ? {
                    from: originalBom.items,
                    to: bom.items.map(item => ({
                        itemName: item.itemName,
                        description: item.description,
                        brand: item.brand,
                        location: item.location,
                        vendor: item.vendor,
                        category: item.category,
                        unit: item.unit,
                        quantity: item.quantity,
                        estimatedUnitCost: item.estimatedUnitCost,
                        totalEstimatedCost: item.totalEstimatedCost,
                        remarks: item.remarks,
                        addedBy: item.addedBy
                    }))
                } : undefined,
                totalEstimatedCost: updateBody.items ? {
                    from: originalBom.totalEstimatedCost,
                    to: bom.items.reduce((sum, item) => sum + item.totalEstimatedCost, 0)
                } : undefined,
                itemsCount: updateBody.items ? {
                    from: originalBom.itemsCount,
                    to: bom.items.length
                } : undefined
            },
            metadata: {
                projectId: bom.projectId?._id,
                projectData: {
                    projectId: bom.projectId?._id,
                    projectName: bom.projectId?.projectName,
                    projectCode: bom.projectId?.projectCode,
                    status: bom.projectId?.status,
                    customerName: bom.projectId?.customerName,
                    requirementType: bom.projectId?.requirementType,
                    architect: bom.projectId?.architect
                },
                user: {
                    userId: user._id,
                    userName: user.name,
                    userEmail: user.email,
                    userRole: user.role,
                    userType: user.role === 'admin' ? 'Admin' : 'User'
                },
                bomData: {
                    bomId: bom._id,
                    title: bom.title,
                    version: bom.version,
                    status: bom.status,
                    isReusable: bom.isReusable,
                    remarks: bom.remarks,
                    architectDocumentId: bom.architectDocumentId,
                    sourceBOMId: bom.sourceBOMId,
                    projectId: bom.projectId,
                    createdBy: bom.createdBy,
                    createdAt: bom.createdAt,
                    updatedAt: bom.updatedAt
                },
                originalBomData: originalBom,
                bomUpdate: {
                    bomUpdated: true,
                    updatedBy: user.id,
                    updatedByModel: user.role === 'admin' ? 'Admin' : 'User',
                    version: bom.version,
                    status: bom.status,
                    isReusable: bom.isReusable,
                    itemsCount: bom.items.length,
                    totalEstimatedCost: bom.items.reduce((sum, item) => sum + item.totalEstimatedCost, 0)
                },
                itemsData: {
                    totalItems: bom.items.length,
                    items: bom.items.map(item => ({
                        itemName: item.itemName,
                        description: item.description,
                        brand: item.brand,
                        location: item.location,
                        vendor: item.vendor,
                        category: item.category,
                        unit: item.unit,
                        quantity: item.quantity,
                        estimatedUnitCost: item.estimatedUnitCost,
                        totalEstimatedCost: item.totalEstimatedCost,
                        remarks: item.remarks,
                        addedBy: item.addedBy
                    })),
                    totalEstimatedCost: bom.items.reduce((sum, item) => sum + item.totalEstimatedCost, 0),
                    categories: [...new Set(bom.items.map(item => item.category))],
                    vendors: [...new Set(bom.items.map(item => item.vendor).filter(Boolean))]
                },
                contentSections: {
                    totalSections: 8,
                    completedSections: [
                        bom.title ? 'title' : null,
                        bom.remarks ? 'remarks' : null,
                        bom.architectDocumentId ? 'architectDocumentId' : null,
                        bom.sourceBOMId ? 'sourceBOMId' : null,
                        bom.isReusable ? 'isReusable' : null,
                        bom.status ? 'status' : null,
                        bom.items.length > 0 ? 'items' : null,
                        bom.projectId ? 'projectId' : null
                    ].filter(Boolean).length,
                    sectionsProvided: [
                        bom.title ? 'title' : null,
                        bom.remarks ? 'remarks' : null,
                        bom.architectDocumentId ? 'architectDocumentId' : null,
                        bom.sourceBOMId ? 'sourceBOMId' : null,
                        bom.isReusable ? 'isReusable' : null,
                        bom.status ? 'status' : null,
                        bom.items.length > 0 ? 'items' : null,
                        bom.projectId ? 'projectId' : null
                    ].filter(Boolean)
                },
                workflow: {
                    bomUpdate: true,
                    bomWorkflow: true,
                    projectWorkflow: true,
                    updateComplete: true
                }
            }
        });
    } catch (error) {
        console.error('Error logging BOM update:', error);
    }

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
export const updateBOMStatus = async (req, projectId, bomId, statusUpdate, user) => {
    const bom = await BOM.findOne({ _id: bomId, projectId }).populate('projectId', 'projectName projectCode status customerName requirementType architect');
    if (!bom) {
        throw new ApiError(httpStatus.NOT_FOUND, 'BOM not found');
    }

    const { status, remarks } = statusUpdate;

    // Store original values for logging
    const originalStatus = bom.status;
    const originalRemarks = bom.remarks;

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

    // Log the BOM status update activity
    try {
        await logActivity(req, {
            action: 'update_bom_status',
            targetModel: 'BOM',
            targetId: bom._id,
            targetName: bom.title || `BOM v${bom.version}`,
            description: `${user.role === 'admin' ? 'Admin' : 'User'} ${user.name} (${user.email}) updated BOM status from ${originalStatus} to ${status} for project: ${bom.projectId?.projectName || 'Unknown Project'}`,
            changes: {
                status: {
                    from: originalStatus,
                    to: status
                },
                remarks: remarks ? {
                    from: originalRemarks,
                    to: remarks
                } : undefined
            },
            metadata: {
                projectId: bom.projectId?._id,
                projectData: {
                    projectId: bom.projectId?._id,
                    projectName: bom.projectId?.projectName,
                    projectCode: bom.projectId?.projectCode,
                    status: bom.projectId?.status,
                    customerName: bom.projectId?.customerName,
                    requirementType: bom.projectId?.requirementType,
                    architect: bom.projectId?.architect
                },
                user: {
                    userId: user._id,
                    userName: user.name,
                    userEmail: user.email,
                    userRole: user.role,
                    userType: user.role === 'admin' ? 'Admin' : 'User'
                },
                bomData: {
                    bomId: bom._id,
                    title: bom.title,
                    version: bom.version,
                    status: bom.status,
                    isReusable: bom.isReusable,
                    remarks: bom.remarks,
                    architectDocumentId: bom.architectDocumentId,
                    sourceBOMId: bom.sourceBOMId,
                    projectId: bom.projectId,
                    createdBy: bom.createdBy,
                    createdAt: bom.createdAt,
                    updatedAt: bom.updatedAt
                },
                statusUpdate: {
                    statusUpdated: true,
                    updatedBy: user.id,
                    updatedByModel: user.role === 'admin' ? 'Admin' : 'User',
                    previousStatus: originalStatus,
                    newStatus: status,
                    statusTransition: `${originalStatus} → ${status}`,
                    remarksUpdated: !!remarks,
                    version: bom.version,
                    isReusable: bom.isReusable
                },
                validTransitions: {
                    from: originalStatus,
                    to: status,
                    validTransitions: validTransitions[originalStatus],
                    transitionValid: true
                },
                itemsData: {
                    totalItems: bom.items.length,
                    totalEstimatedCost: bom.items.reduce((sum, item) => sum + item.totalEstimatedCost, 0),
                    categories: [...new Set(bom.items.map(item => item.category))],
                    vendors: [...new Set(bom.items.map(item => item.vendor).filter(Boolean))]
                },
                contentSections: {
                    totalSections: 8,
                    completedSections: [
                        bom.title ? 'title' : null,
                        bom.remarks ? 'remarks' : null,
                        bom.architectDocumentId ? 'architectDocumentId' : null,
                        bom.sourceBOMId ? 'sourceBOMId' : null,
                        bom.isReusable ? 'isReusable' : null,
                        bom.status ? 'status' : null,
                        bom.items.length > 0 ? 'items' : null,
                        bom.projectId ? 'projectId' : null
                    ].filter(Boolean).length,
                    sectionsProvided: [
                        bom.title ? 'title' : null,
                        bom.remarks ? 'remarks' : null,
                        bom.architectDocumentId ? 'architectDocumentId' : null,
                        bom.sourceBOMId ? 'sourceBOMId' : null,
                        bom.isReusable ? 'isReusable' : null,
                        bom.status ? 'status' : null,
                        bom.items.length > 0 ? 'items' : null,
                        bom.projectId ? 'projectId' : null
                    ].filter(Boolean)
                },
                workflow: {
                    bomStatusUpdate: true,
                    bomWorkflow: true,
                    projectWorkflow: true,
                    statusTransition: true,
                    updateComplete: true
                }
            }
        });
    } catch (error) {
        console.error('Error logging BOM status update:', error);
    }

    return bom.populate(['createdBy', 'projectId', 'items.addedBy']);
};

/**
 * Delete a BOM
 * @param {string} projectId - The project ID
 * @param {string} bomId - The BOM ID
 * @param {Object} user - The authenticated user
 * @returns {Promise<BOM>}
 */
export const deleteBOM = async (req, projectId, bomId, user) => {
    const bom = await BOM.findOne({ _id: bomId, projectId }).populate('projectId', 'projectName projectCode status customerName requirementType architect');
    if (!bom) {
        throw new ApiError(httpStatus.NOT_FOUND, 'BOM not found');
    }

    // Only allow deletion if BOM is in draft status
    if (bom.status !== 'draft') {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Can only delete BOMs in draft status');
    }

    // Store BOM data for logging before deletion
    const bomData = {
        bomId: bom._id,
        title: bom.title,
        version: bom.version,
        status: bom.status,
        isReusable: bom.isReusable,
        remarks: bom.remarks,
        architectDocumentId: bom.architectDocumentId,
        sourceBOMId: bom.sourceBOMId,
        projectId: bom.projectId,
        createdBy: bom.createdBy,
        createdAt: bom.createdAt,
        updatedAt: bom.updatedAt,
        items: bom.items.map(item => ({
            itemName: item.itemName,
            description: item.description,
            brand: item.brand,
            location: item.location,
            vendor: item.vendor,
            category: item.category,
            unit: item.unit,
            quantity: item.quantity,
            estimatedUnitCost: item.estimatedUnitCost,
            totalEstimatedCost: item.totalEstimatedCost,
            remarks: item.remarks,
            addedBy: item.addedBy
        })),
        totalEstimatedCost: bom.items.reduce((sum, item) => sum + item.totalEstimatedCost, 0),
        itemsCount: bom.items.length
    };

    await BOM.findByIdAndDelete(bomId);

    // Log the BOM deletion activity
    try {
        await logActivity(req, {
            action: 'delete_bom',
            targetModel: 'BOM',
            targetId: bom._id,
            targetName: bom.title || `BOM v${bom.version}`,
            description: `${user.role === 'admin' ? 'Admin' : 'User'} ${user.name} (${user.email}) deleted BOM version ${bom.version} for project: ${bom.projectId?.projectName || 'Unknown Project'}`,
            changes: {
                bomDeleted: {
                    from: bom._id,
                    to: null
                },
                status: {
                    from: bom.status,
                    to: 'deleted'
                }
            },
            metadata: {
                projectId: bom.projectId?._id,
                projectData: {
                    projectId: bom.projectId?._id,
                    projectName: bom.projectId?.projectName,
                    projectCode: bom.projectId?.projectCode,
                    status: bom.projectId?.status,
                    customerName: bom.projectId?.customerName,
                    requirementType: bom.projectId?.requirementType,
                    architect: bom.projectId?.architect
                },
                user: {
                    userId: user._id,
                    userName: user.name,
                    userEmail: user.email,
                    userRole: user.role,
                    userType: user.role === 'admin' ? 'Admin' : 'User'
                },
                deletedBomData: bomData,
                bomDeletion: {
                    bomDeleted: true,
                    deletedBy: user.id,
                    deletedByModel: user.role === 'admin' ? 'Admin' : 'User',
                    deletedAt: new Date(),
                    bomVersion: bom.version,
                    bomStatus: bom.status,
                    isReusable: bom.isReusable,
                    itemsCount: bom.items.length
                },
                itemsData: {
                    totalItems: bom.items.length,
                    items: bom.items.map(item => ({
                        itemName: item.itemName,
                        description: item.description,
                        brand: item.brand,
                        location: item.location,
                        vendor: item.vendor,
                        category: item.category,
                        unit: item.unit,
                        quantity: item.quantity,
                        estimatedUnitCost: item.estimatedUnitCost,
                        totalEstimatedCost: item.totalEstimatedCost,
                        remarks: item.remarks,
                        addedBy: item.addedBy
                    })),
                    totalEstimatedCost: bom.items.reduce((sum, item) => sum + item.totalEstimatedCost, 0),
                    categories: [...new Set(bom.items.map(item => item.category))],
                    vendors: [...new Set(bom.items.map(item => item.vendor).filter(Boolean))]
                },
                contentSections: {
                    totalSections: 8,
                    completedSections: [
                        bom.title ? 'title' : null,
                        bom.remarks ? 'remarks' : null,
                        bom.architectDocumentId ? 'architectDocumentId' : null,
                        bom.sourceBOMId ? 'sourceBOMId' : null,
                        bom.isReusable ? 'isReusable' : null,
                        bom.status ? 'status' : null,
                        bom.items.length > 0 ? 'items' : null,
                        bom.projectId ? 'projectId' : null
                    ].filter(Boolean).length,
                    sectionsProvided: [
                        bom.title ? 'title' : null,
                        bom.remarks ? 'remarks' : null,
                        bom.architectDocumentId ? 'architectDocumentId' : null,
                        bom.sourceBOMId ? 'sourceBOMId' : null,
                        bom.isReusable ? 'isReusable' : null,
                        bom.status ? 'status' : null,
                        bom.items.length > 0 ? 'items' : null,
                        bom.projectId ? 'projectId' : null
                    ].filter(Boolean)
                },
                workflow: {
                    bomDeletion: true,
                    bomWorkflow: true,
                    projectWorkflow: true,
                    deletionComplete: true
                }
            }
        });
    } catch (error) {
        console.error('Error logging BOM deletion:', error);
    }

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
export const submitBOM = async (req, projectId, bomId, user) => {
    const bom = await BOM.findOne({ _id: bomId, projectId }).populate('projectId', 'projectName projectCode status customerName requirementType architect');
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

    // Store original values for logging
    const originalStatus = bom.status;

    bom.status = 'submitted';
    await bom.save();

    // Log the BOM submission activity
    try {
        await logActivity(req, {
            action: 'submit_bom',
            targetModel: 'BOM',
            targetId: bom._id,
            targetName: bom.title || `BOM v${bom.version}`,
            description: `${user.role === 'admin' ? 'Admin' : 'User'} ${user.name} (${user.email}) submitted BOM version ${bom.version} for review for project: ${bom.projectId?.projectName || 'Unknown Project'}`,
            changes: {
                status: {
                    from: originalStatus,
                    to: 'submitted'
                }
            },
            metadata: {
                projectId: bom.projectId?._id,
                projectData: {
                    projectId: bom.projectId?._id,
                    projectName: bom.projectId?.projectName,
                    projectCode: bom.projectId?.projectCode,
                    status: bom.projectId?.status,
                    customerName: bom.projectId?.customerName,
                    requirementType: bom.projectId?.requirementType,
                    architect: bom.projectId?.architect
                },
                user: {
                    userId: user._id,
                    userName: user.name,
                    userEmail: user.email,
                    userRole: user.role,
                    userType: user.role === 'admin' ? 'Admin' : 'User'
                },
                bomData: {
                    bomId: bom._id,
                    title: bom.title,
                    version: bom.version,
                    status: bom.status,
                    isReusable: bom.isReusable,
                    remarks: bom.remarks,
                    architectDocumentId: bom.architectDocumentId,
                    sourceBOMId: bom.sourceBOMId,
                    projectId: bom.projectId,
                    createdBy: bom.createdBy,
                    createdAt: bom.createdAt,
                    updatedAt: bom.updatedAt
                },
                bomSubmission: {
                    bomSubmitted: true,
                    submittedBy: user.id,
                    submittedByModel: user.role === 'admin' ? 'Admin' : 'User',
                    submittedAt: new Date(),
                    bomVersion: bom.version,
                    previousStatus: originalStatus,
                    newStatus: 'submitted',
                    statusTransition: `${originalStatus} → submitted`,
                    itemsCount: bom.items.length,
                    isReusable: bom.isReusable
                },
                itemsData: {
                    totalItems: bom.items.length,
                    totalEstimatedCost: bom.items.reduce((sum, item) => sum + item.totalEstimatedCost, 0),
                    categories: [...new Set(bom.items.map(item => item.category))],
                    vendors: [...new Set(bom.items.map(item => item.vendor).filter(Boolean))]
                },
                contentSections: {
                    totalSections: 8,
                    completedSections: [
                        bom.title ? 'title' : null,
                        bom.remarks ? 'remarks' : null,
                        bom.architectDocumentId ? 'architectDocumentId' : null,
                        bom.sourceBOMId ? 'sourceBOMId' : null,
                        bom.isReusable ? 'isReusable' : null,
                        bom.status ? 'status' : null,
                        bom.items.length > 0 ? 'items' : null,
                        bom.projectId ? 'projectId' : null
                    ].filter(Boolean).length,
                    sectionsProvided: [
                        bom.title ? 'title' : null,
                        bom.remarks ? 'remarks' : null,
                        bom.architectDocumentId ? 'architectDocumentId' : null,
                        bom.sourceBOMId ? 'sourceBOMId' : null,
                        bom.isReusable ? 'isReusable' : null,
                        bom.status ? 'status' : null,
                        bom.items.length > 0 ? 'items' : null,
                        bom.projectId ? 'projectId' : null
                    ].filter(Boolean)
                },
                workflow: {
                    bomSubmission: true,
                    bomWorkflow: true,
                    projectWorkflow: true,
                    reviewWorkflow: true,
                    submissionComplete: true
                }
            }
        });
    } catch (error) {
        console.error('Error logging BOM submission:', error);
    }

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
export const reviewBOM = async (req, projectId, bomId, reviewData, user) => {
    const bom = await BOM.findOne({ _id: bomId, projectId }).populate('projectId', 'projectName projectCode status customerName requirementType architect');
    if (!bom) {
        throw new ApiError(httpStatus.NOT_FOUND, 'BOM not found');
    }

    // Only allow review if BOM is in submitted status or finalized status
    const allowedStatuses = ['submitted', 'finalized'];
    if (!allowedStatuses.includes(bom.status)) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Can only review BOMs in submitted status or finalized status');
    }

    const { status, adminRemarks } = reviewData;

    // Store original values for logging
    const originalStatus = bom.status;
    const originalAdminRemarks = bom.adminRemarks;

    bom.status = status;
    bom.adminRemarks = adminRemarks;
    await bom.save();

    // Log the BOM review activity
    try {
        await logActivity(req, {
            action: 'review_bom',
            targetModel: 'BOM',
            targetId: bom._id,
            targetName: bom.title || `BOM v${bom.version}`,
            description: `${user.role === 'admin' ? 'Admin' : 'User'} ${user.name} (${user.email}) ${status} BOM version ${bom.version} for project: ${bom.projectId?.projectName || 'Unknown Project'}`,
            changes: {
                status: {
                    from: originalStatus,
                    to: status
                },
                adminRemarks: adminRemarks ? {
                    from: originalAdminRemarks,
                    to: adminRemarks
                } : undefined
            },
            metadata: {
                projectId: bom.projectId?._id,
                projectData: {
                    projectId: bom.projectId?._id,
                    projectName: bom.projectId?.projectName,
                    projectCode: bom.projectId?.projectCode,
                    status: bom.projectId?.status,
                    customerName: bom.projectId?.customerName,
                    requirementType: bom.projectId?.requirementType,
                    architect: bom.projectId?.architect
                },
                user: {
                    userId: user._id,
                    userName: user.name,
                    userEmail: user.email,
                    userRole: user.role,
                    userType: user.role === 'admin' ? 'Admin' : 'User'
                },
                bomData: {
                    bomId: bom._id,
                    title: bom.title,
                    version: bom.version,
                    status: bom.status,
                    isReusable: bom.isReusable,
                    remarks: bom.remarks,
                    adminRemarks: bom.adminRemarks,
                    architectDocumentId: bom.architectDocumentId,
                    sourceBOMId: bom.sourceBOMId,
                    projectId: bom.projectId,
                    createdBy: bom.createdBy,
                    createdAt: bom.createdAt,
                    updatedAt: bom.updatedAt
                },
                bomReview: {
                    bomReviewed: true,
                    reviewedBy: user.id,
                    reviewedByModel: user.role === 'admin' ? 'Admin' : 'User',
                    reviewedAt: new Date(),
                    bomVersion: bom.version,
                    previousStatus: originalStatus,
                    newStatus: status,
                    statusTransition: `${originalStatus} → ${status}`,
                    reviewAction: status,
                    adminRemarksProvided: !!adminRemarks,
                    isApproved: status === 'approved',
                    isRejected: status === 'rejected',
                    isReusable: bom.isReusable
                },
                itemsData: {
                    totalItems: bom.items.length,
                    totalEstimatedCost: bom.items.reduce((sum, item) => sum + item.totalEstimatedCost, 0),
                    categories: [...new Set(bom.items.map(item => item.category))],
                    vendors: [...new Set(bom.items.map(item => item.vendor).filter(Boolean))]
                },
                contentSections: {
                    totalSections: 8,
                    completedSections: [
                        bom.title ? 'title' : null,
                        bom.remarks ? 'remarks' : null,
                        bom.architectDocumentId ? 'architectDocumentId' : null,
                        bom.sourceBOMId ? 'sourceBOMId' : null,
                        bom.isReusable ? 'isReusable' : null,
                        bom.status ? 'status' : null,
                        bom.items.length > 0 ? 'items' : null,
                        bom.projectId ? 'projectId' : null
                    ].filter(Boolean).length,
                    sectionsProvided: [
                        bom.title ? 'title' : null,
                        bom.remarks ? 'remarks' : null,
                        bom.architectDocumentId ? 'architectDocumentId' : null,
                        bom.sourceBOMId ? 'sourceBOMId' : null,
                        bom.isReusable ? 'isReusable' : null,
                        bom.status ? 'status' : null,
                        bom.items.length > 0 ? 'items' : null,
                        bom.projectId ? 'projectId' : null
                    ].filter(Boolean)
                },
                workflow: {
                    bomReview: true,
                    bomWorkflow: true,
                    projectWorkflow: true,
                    adminReviewWorkflow: true,
                    reviewComplete: true
                }
            }
        });
    } catch (error) {
        console.error('Error logging BOM review:', error);
    }

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
export const assignBOMToSiteEngineer = async (req, projectId, bomId, assignmentData, user) => {
    const bom = await BOM.findOne({ _id: bomId, projectId }).populate('projectId', 'projectName projectCode status customerName requirementType architect');
    if (!bom) {
        throw new ApiError(httpStatus.NOT_FOUND, 'BOM not found');
    }

    // Verify the site engineer exists and has the correct role
    const siteEngineer = await User.findById(assignmentData.siteEngineerId);
    if (!siteEngineer || siteEngineer.role !== Roles.SITE_ENGINEER) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid site engineer');
    }

    // Store original values for logging
    const originalAssignedToSiteEngineer = bom.assignedToSiteEngineer;
    const originalAssignedAt = bom.assignedAt;
    const originalStatus = bom.status;
    const originalIsRoughBOM = bom.isRoughBOM;
    const originalSentToSiteEngineer = bom.sentToSiteEngineer;
    const originalSentToSiteEngineerAt = bom.sentToSiteEngineerAt;
    const originalSentToSiteEngineerBy = bom.sentToSiteEngineerBy;

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

    // Log the BOM assignment activity
    try {
        await logActivity(req, {
            action: 'assign_bom_to_site_engineer',
            targetModel: 'BOM',
            targetId: bom._id,
            targetName: bom.title || `BOM v${bom.version}`,
            description: `${user.role === 'admin' ? 'Admin' : 'User'} ${user.name} (${user.email}) assigned BOM version ${bom.version} to site engineer ${siteEngineer.name} for project: ${bom.projectId?.projectName || 'Unknown Project'}`,
            changes: {
                assignedToSiteEngineer: {
                    from: originalAssignedToSiteEngineer,
                    to: assignmentData.siteEngineerId
                },
                assignedAt: {
                    from: originalAssignedAt,
                    to: new Date()
                },
                status: {
                    from: originalStatus,
                    to: 'site_engineer_review'
                },
                isRoughBOM: {
                    from: originalIsRoughBOM,
                    to: true
                },
                sentToSiteEngineer: {
                    from: originalSentToSiteEngineer,
                    to: true
                },
                sentToSiteEngineerAt: {
                    from: originalSentToSiteEngineerAt,
                    to: new Date()
                },
                sentToSiteEngineerBy: {
                    from: originalSentToSiteEngineerBy,
                    to: user.id
                }
            },
            metadata: {
                projectId: bom.projectId?._id,
                projectData: {
                    projectId: bom.projectId?._id,
                    projectName: bom.projectId?.projectName,
                    projectCode: bom.projectId?.projectCode,
                    status: bom.projectId?.status,
                    customerName: bom.projectId?.customerName,
                    requirementType: bom.projectId?.requirementType,
                    architect: bom.projectId?.architect
                },
                user: {
                    userId: user._id,
                    userName: user.name,
                    userEmail: user.email,
                    userRole: user.role,
                    userType: user.role === 'admin' ? 'Admin' : 'User'
                },
                siteEngineer: {
                    siteEngineerId: siteEngineer._id,
                    siteEngineerName: siteEngineer.name,
                    siteEngineerEmail: siteEngineer.email,
                    siteEngineerRole: siteEngineer.role,
                    siteEngineerPhone: siteEngineer.phone
                },
                bomData: {
                    bomId: bom._id,
                    title: bom.title,
                    version: bom.version,
                    status: bom.status,
                    isReusable: bom.isReusable,
                    remarks: bom.remarks,
                    adminRemarks: bom.adminRemarks,
                    architectDocumentId: bom.architectDocumentId,
                    sourceBOMId: bom.sourceBOMId,
                    projectId: bom.projectId,
                    createdBy: bom.createdBy,
                    createdAt: bom.createdAt,
                    updatedAt: bom.updatedAt
                },
                bomAssignment: {
                    bomAssigned: true,
                    assignedBy: user.id,
                    assignedByModel: user.role === 'admin' ? 'Admin' : 'User',
                    assignedAt: new Date(),
                    bomVersion: bom.version,
                    previousStatus: originalStatus,
                    newStatus: 'site_engineer_review',
                    statusTransition: `${originalStatus} → site_engineer_review`,
                    isRoughBOM: true,
                    sentToSiteEngineer: true,
                    sentToSiteEngineerAt: new Date(),
                    sentToSiteEngineerBy: user.id,
                    itemsCount: bom.items.length
                },
                itemsData: {
                    totalItems: bom.items.length,
                    totalEstimatedCost: bom.items.reduce((sum, item) => sum + item.totalEstimatedCost, 0),
                    categories: [...new Set(bom.items.map(item => item.category))],
                    vendors: [...new Set(bom.items.map(item => item.vendor).filter(Boolean))]
                },
                contentSections: {
                    totalSections: 8,
                    completedSections: [
                        bom.title ? 'title' : null,
                        bom.remarks ? 'remarks' : null,
                        bom.architectDocumentId ? 'architectDocumentId' : null,
                        bom.sourceBOMId ? 'sourceBOMId' : null,
                        bom.isReusable ? 'isReusable' : null,
                        bom.status ? 'status' : null,
                        bom.items.length > 0 ? 'items' : null,
                        bom.projectId ? 'projectId' : null
                    ].filter(Boolean).length,
                    sectionsProvided: [
                        bom.title ? 'title' : null,
                        bom.remarks ? 'remarks' : null,
                        bom.architectDocumentId ? 'architectDocumentId' : null,
                        bom.sourceBOMId ? 'sourceBOMId' : null,
                        bom.isReusable ? 'isReusable' : null,
                        bom.status ? 'status' : null,
                        bom.items.length > 0 ? 'items' : null,
                        bom.projectId ? 'projectId' : null
                    ].filter(Boolean)
                },
                workflow: {
                    bomAssignment: true,
                    bomWorkflow: true,
                    projectWorkflow: true,
                    siteEngineerWorkflow: true,
                    assignmentComplete: true
                }
            }
        });
    } catch (error) {
        console.error('Error logging BOM assignment:', error);
    }

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
export const updateBOMBySiteEngineer = async (req, projectId, bomId, updateData, user) => {
    const bom = await BOM.findOne({ _id: bomId, projectId, assignedToSiteEngineer: user.id }).populate('projectId', 'projectName projectCode status customerName requirementType architect');
    if (!bom) {
        throw new ApiError(httpStatus.NOT_FOUND, 'BOM not found or not assigned to you');
    }

    // Store original values for logging
    const originalItems = JSON.parse(JSON.stringify(bom.items));
    const originalRemarks = bom.remarks;
    const originalSiteEngineerRemarks = bom.siteEngineerRemarks;
    const originalSiteEngineerUpdatedAt = bom.siteEngineerUpdatedAt;
    const originalUpdatedBySiteEngineer = bom.updatedBySiteEngineer;

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

    // Log the BOM update by site engineer activity
    try {
        await logActivity(req, {
            action: 'update_bom_by_site_engineer',
            targetModel: 'BOM',
            targetId: bom._id,
            targetName: bom.title || `BOM v${bom.version}`,
            description: `Site Engineer ${user.name} (${user.email}) updated BOM version ${bom.version} for project: ${bom.projectId?.projectName || 'Unknown Project'}`,
            changes: {
                items: {
                    from: originalItems,
                    to: bom.items
                },
                remarks: {
                    from: originalRemarks,
                    to: bom.remarks
                },
                siteEngineerRemarks: {
                    from: originalSiteEngineerRemarks,
                    to: bom.siteEngineerRemarks
                },
                siteEngineerUpdatedAt: {
                    from: originalSiteEngineerUpdatedAt,
                    to: new Date()
                },
                updatedBySiteEngineer: {
                    from: originalUpdatedBySiteEngineer,
                    to: user.id
                }
            },
            metadata: {
                projectId: bom.projectId?._id,
                projectData: {
                    projectId: bom.projectId?._id,
                    projectName: bom.projectId?.projectName,
                    projectCode: bom.projectId?.projectCode,
                    status: bom.projectId?.status,
                    customerName: bom.projectId?.customerName,
                    requirementType: bom.projectId?.requirementType,
                    architect: bom.projectId?.architect
                },
                user: {
                    userId: user._id,
                    userName: user.name,
                    userEmail: user.email,
                    userRole: user.role,
                    userType: 'Site Engineer',
                    userPhone: user.phone
                },
                bomData: {
                    bomId: bom._id,
                    title: bom.title,
                    version: bom.version,
                    status: bom.status,
                    isReusable: bom.isReusable,
                    remarks: bom.remarks,
                    siteEngineerRemarks: bom.siteEngineerRemarks,
                    adminRemarks: bom.adminRemarks,
                    architectDocumentId: bom.architectDocumentId,
                    sourceBOMId: bom.sourceBOMId,
                    projectId: bom.projectId,
                    createdBy: bom.createdBy,
                    assignedToSiteEngineer: bom.assignedToSiteEngineer,
                    createdAt: bom.createdAt,
                    updatedAt: bom.updatedAt,
                    siteEngineerUpdatedAt: bom.siteEngineerUpdatedAt,
                    updatedBySiteEngineer: bom.updatedBySiteEngineer
                },
                bomUpdate: {
                    bomUpdated: true,
                    updatedBy: user.id,
                    updatedByModel: 'Site Engineer',
                    updatedAt: new Date(),
                    bomVersion: bom.version,
                    itemsUpdated: updateData.items ? true : false,
                    remarksUpdated: updateData.remarks ? true : false,
                    siteEngineerRemarksUpdated: updateData.siteEngineerRemarks ? true : false,
                    itemsCount: bom.items.length,
                    previousItemsCount: originalItems.length
                },
                itemsData: {
                    totalItems: bom.items.length,
                    totalEstimatedCost: bom.items.reduce((sum, item) => sum + item.totalEstimatedCost, 0),
                    previousTotalEstimatedCost: originalItems.reduce((sum, item) => sum + item.totalEstimatedCost, 0),
                    categories: [...new Set(bom.items.map(item => item.category))],
                    vendors: [...new Set(bom.items.map(item => item.vendor).filter(Boolean))],
                    itemsChanged: updateData.items ? true : false,
                    itemsAdded: updateData.items ? bom.items.length - originalItems.length : 0,
                    itemsRemoved: updateData.items ? originalItems.length - bom.items.length : 0
                },
                contentSections: {
                    totalSections: 8,
                    completedSections: [
                        bom.title ? 'title' : null,
                        bom.remarks ? 'remarks' : null,
                        bom.siteEngineerRemarks ? 'siteEngineerRemarks' : null,
                        bom.architectDocumentId ? 'architectDocumentId' : null,
                        bom.sourceBOMId ? 'sourceBOMId' : null,
                        bom.isReusable ? 'isReusable' : null,
                        bom.status ? 'status' : null,
                        bom.items.length > 0 ? 'items' : null
                    ].filter(Boolean).length,
                    sectionsProvided: [
                        bom.title ? 'title' : null,
                        bom.remarks ? 'remarks' : null,
                        bom.siteEngineerRemarks ? 'siteEngineerRemarks' : null,
                        bom.architectDocumentId ? 'architectDocumentId' : null,
                        bom.sourceBOMId ? 'sourceBOMId' : null,
                        bom.isReusable ? 'isReusable' : null,
                        bom.status ? 'status' : null,
                        bom.items.length > 0 ? 'items' : null
                    ].filter(Boolean)
                },
                workflow: {
                    bomUpdate: true,
                    bomWorkflow: true,
                    projectWorkflow: true,
                    siteEngineerWorkflow: true,
                    siteEngineerUpdate: true,
                    updateComplete: true
                }
            }
        });
    } catch (error) {
        console.error('Error logging BOM update by site engineer:', error);
    }

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
export const submitUpdatedBOMToPlanning = async (req, projectId, bomId, submitData, user) => {
    const bom = await BOM.findOne({ _id: bomId, projectId, assignedToSiteEngineer: user.id }).populate('projectId', 'projectName projectCode status customerName requirementType architect');
    if (!bom) {
        throw new ApiError(httpStatus.NOT_FOUND, 'BOM not found or not assigned to you');
    }

    // Store original values for logging
    const originalStatus = bom.status;
    const originalUpdatedBOMId = bom.updatedBOMId;
    const originalUpdatedAt = bom.updatedAt;

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
    const newBOM = await createBOM(req, projectId, newBOMData, user);

    // Update the original rough BOM to reference the new BOM
    bom.updatedBOMId = newBOM._id;
    bom.status = 'site_engineer_updated';
    bom.updatedAt = new Date();
    await bom.save();

    // Log the BOM submission to planning activity
    try {
        await logActivity(req, {
            action: 'submit_updated_bom_to_planning',
            targetModel: 'BOM',
            targetId: newBOM._id,
            targetName: newBOM.title || `BOM v${newBOM.version}`,
            description: `Site Engineer ${user.name} (${user.email}) submitted updated BOM version ${newBOM.version} to planning engineer for project: ${bom.projectId?.projectName || 'Unknown Project'}`,
            changes: {
                newBOMCreated: {
                    from: null,
                    to: newBOM._id
                },
                originalBOMStatus: {
                    from: originalStatus,
                    to: 'site_engineer_updated'
                },
                originalBOMUpdatedBOMId: {
                    from: originalUpdatedBOMId,
                    to: newBOM._id
                },
                originalBOMUpdatedAt: {
                    from: originalUpdatedAt,
                    to: new Date()
                }
            },
            metadata: {
                projectId: bom.projectId?._id,
                projectData: {
                    projectId: bom.projectId?._id,
                    projectName: bom.projectId?.projectName,
                    projectCode: bom.projectId?.projectCode,
                    status: bom.projectId?.status,
                    customerName: bom.projectId?.customerName,
                    requirementType: bom.projectId?.requirementType,
                    architect: bom.projectId?.architect
                },
                user: {
                    userId: user._id,
                    userName: user.name,
                    userEmail: user.email,
                    userRole: user.role,
                    userType: 'Site Engineer',
                    userPhone: user.phone
                },
                originalBOMData: {
                    bomId: bom._id,
                    title: bom.title,
                    version: bom.version,
                    status: bom.status,
                    isReusable: bom.isReusable,
                    remarks: bom.remarks,
                    siteEngineerRemarks: bom.siteEngineerRemarks,
                    adminRemarks: bom.adminRemarks,
                    architectDocumentId: bom.architectDocumentId,
                    sourceBOMId: bom.sourceBOMId,
                    projectId: bom.projectId,
                    createdBy: bom.createdBy,
                    assignedToSiteEngineer: bom.assignedToSiteEngineer,
                    createdAt: bom.createdAt,
                    updatedAt: bom.updatedAt,
                    siteEngineerUpdatedAt: bom.siteEngineerUpdatedAt,
                    updatedBySiteEngineer: bom.updatedBySiteEngineer,
                    updatedBOMId: bom.updatedBOMId
                },
                newBOMData: {
                    bomId: newBOM._id,
                    title: newBOM.title,
                    version: newBOM.version,
                    status: newBOM.status,
                    isReusable: newBOM.isReusable,
                    remarks: newBOM.remarks,
                    adminRemarks: newBOM.adminRemarks,
                    architectDocumentId: newBOM.architectDocumentId,
                    sourceBOMId: newBOM.sourceBOMId,
                    projectId: newBOM.projectId,
                    createdBy: newBOM.createdBy,
                    createdAt: newBOM.createdAt,
                    updatedAt: newBOM.updatedAt,
                    originalRoughBOMId: newBOM.originalRoughBOMId
                },
                bomSubmission: {
                    bomSubmitted: true,
                    submittedBy: user.id,
                    submittedByModel: 'Site Engineer',
                    submittedAt: new Date(),
                    newBOMVersion: newBOM.version,
                    originalBOMVersion: bom.version,
                    statusTransition: `${originalStatus} → site_engineer_updated`,
                    planningReviewStatus: 'planning_review',
                    itemsCount: newBOM.items.length,
                    isRoughBOM: false,
                    originalRoughBOMId: bom._id
                },
                itemsData: {
                    totalItems: newBOM.items.length,
                    totalEstimatedCost: newBOM.items.reduce((sum, item) => sum + item.totalEstimatedCost, 0),
                    categories: [...new Set(newBOM.items.map(item => item.category))],
                    vendors: [...new Set(newBOM.items.map(item => item.vendor).filter(Boolean))],
                    itemsTransferred: true,
                    itemsFromRoughBOM: true
                },
                contentSections: {
                    totalSections: 8,
                    completedSections: [
                        newBOM.title ? 'title' : null,
                        newBOM.remarks ? 'remarks' : null,
                        newBOM.architectDocumentId ? 'architectDocumentId' : null,
                        newBOM.sourceBOMId ? 'sourceBOMId' : null,
                        newBOM.isReusable ? 'isReusable' : null,
                        newBOM.status ? 'status' : null,
                        newBOM.items.length > 0 ? 'items' : null,
                        newBOM.projectId ? 'projectId' : null
                    ].filter(Boolean).length,
                    sectionsProvided: [
                        newBOM.title ? 'title' : null,
                        newBOM.remarks ? 'remarks' : null,
                        newBOM.architectDocumentId ? 'architectDocumentId' : null,
                        newBOM.sourceBOMId ? 'sourceBOMId' : null,
                        newBOM.isReusable ? 'isReusable' : null,
                        newBOM.status ? 'status' : null,
                        newBOM.items.length > 0 ? 'items' : null,
                        newBOM.projectId ? 'projectId' : null
                    ].filter(Boolean)
                },
                workflow: {
                    bomSubmission: true,
                    bomWorkflow: true,
                    projectWorkflow: true,
                    siteEngineerWorkflow: true,
                    planningWorkflow: true,
                    bomTransfer: true,
                    submissionComplete: true
                }
            }
        });
    } catch (error) {
        console.error('Error logging BOM submission to planning:', error);
    }

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
export const createFinalizedBOM = async (req, projectId, originalBomId, finalizedItems, user) => {
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
    const project = await Project.findById(projectId).populate('architect', 'name email');
    if (!project) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
    }

    // Verify original BOM exists
    const originalBOM = await BOM.findOne({ _id: originalBomId, projectId }).populate('createdBy', 'name email role');
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

    // Store original values for logging
    const originalTitle = originalBOM.title;
    const originalStatus = originalBOM.status;
    const originalRemarks = originalBOM.remarks;
    const originalItems = JSON.parse(JSON.stringify(originalBOM.items));
    const originalFinalizedAt = originalBOM.finalizedAt;
    const originalFinalizedBy = originalBOM.finalizedBy;

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

    // Log the BOM finalization activity
    try {
        await logActivity(req, {
            action: 'create_finalized_bom',
            targetModel: 'BOM',
            targetId: updatedBOM._id,
            targetName: updatedBOM.title || `BOM v${updatedBOM.version}`,
            description: `${user.role === 'admin' ? 'Admin' : 'Planning Engineer'} ${user.name} (${user.email}) finalized BOM version ${updatedBOM.version} with vendor assignments for project: ${project.projectName || 'Unknown Project'}`,
            changes: {
                title: {
                    from: originalTitle,
                    to: updatedBOM.title
                },
                status: {
                    from: originalStatus,
                    to: 'finalized'
                },
                remarks: {
                    from: originalRemarks,
                    to: updatedBOM.remarks
                },
                items: {
                    from: originalItems,
                    to: bomItems
                },
                finalizedAt: {
                    from: originalFinalizedAt,
                    to: new Date()
                },
                finalizedBy: {
                    from: originalFinalizedBy,
                    to: user.id
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
                    userType: user.role === 'admin' ? 'Admin' : 'Planning Engineer',
                    userPhone: user.phone
                },
                originalBOMData: {
                    bomId: originalBOM._id,
                    title: originalBOM.title,
                    version: originalBOM.version,
                    status: originalBOM.status,
                    isReusable: originalBOM.isReusable,
                    remarks: originalBOM.remarks,
                    adminRemarks: originalBOM.adminRemarks,
                    architectDocumentId: originalBOM.architectDocumentId,
                    sourceBOMId: originalBOM.sourceBOMId,
                    projectId: originalBOM.projectId,
                    createdBy: originalBOM.createdBy,
                    createdAt: originalBOM.createdAt,
                    updatedAt: originalBOM.updatedAt
                },
                finalizedBOMData: {
                    bomId: updatedBOM._id,
                    title: updatedBOM.title,
                    version: updatedBOM.version,
                    status: updatedBOM.status,
                    isReusable: updatedBOM.isReusable,
                    remarks: updatedBOM.remarks,
                    adminRemarks: updatedBOM.adminRemarks,
                    architectDocumentId: updatedBOM.architectDocumentId,
                    sourceBOMId: updatedBOM.sourceBOMId,
                    projectId: updatedBOM.projectId,
                    createdBy: updatedBOM.createdBy,
                    createdAt: updatedBOM.createdAt,
                    updatedAt: updatedBOM.updatedAt,
                    finalizedAt: updatedBOM.finalizedAt,
                    finalizedBy: updatedBOM.finalizedBy
                },
                bomFinalization: {
                    bomFinalized: true,
                    finalizedBy: user.id,
                    finalizedByModel: user.role === 'admin' ? 'Admin' : 'Planning Engineer',
                    finalizedAt: new Date(),
                    bomVersion: updatedBOM.version,
                    statusTransition: `${originalStatus} → finalized`,
                    itemsFinalized: bomItems.length,
                    vendorAssignments: bomItems.filter(item => item.vendor).length,
                    itemsWithoutVendors: bomItems.filter(item => !item.vendor).length
                },
                itemsData: {
                    totalItems: bomItems.length,
                    totalEstimatedCost: bomItems.reduce((sum, item) => sum + item.totalEstimatedCost, 0),
                    previousTotalEstimatedCost: originalItems.reduce((sum, item) => sum + item.totalEstimatedCost, 0),
                    categories: [...new Set(bomItems.map(item => item.category))],
                    vendors: [...new Set(bomItems.map(item => item.vendor).filter(Boolean))],
                    finalizedItems: bomItems.filter(item => item.isFinalized).length,
                    itemsWithVendors: bomItems.filter(item => item.vendor).length,
                    itemsWithoutVendors: bomItems.filter(item => !item.vendor).length,
                    averageFinalPrice: bomItems.reduce((sum, item) => sum + (item.finalPrice || 0), 0) / bomItems.length
                },
                contentSections: {
                    totalSections: 8,
                    completedSections: [
                        updatedBOM.title ? 'title' : null,
                        updatedBOM.remarks ? 'remarks' : null,
                        updatedBOM.architectDocumentId ? 'architectDocumentId' : null,
                        updatedBOM.sourceBOMId ? 'sourceBOMId' : null,
                        updatedBOM.isReusable ? 'isReusable' : null,
                        updatedBOM.status ? 'status' : null,
                        updatedBOM.items.length > 0 ? 'items' : null,
                        updatedBOM.projectId ? 'projectId' : null
                    ].filter(Boolean).length,
                    sectionsProvided: [
                        updatedBOM.title ? 'title' : null,
                        updatedBOM.remarks ? 'remarks' : null,
                        updatedBOM.architectDocumentId ? 'architectDocumentId' : null,
                        updatedBOM.sourceBOMId ? 'sourceBOMId' : null,
                        updatedBOM.isReusable ? 'isReusable' : null,
                        updatedBOM.status ? 'status' : null,
                        updatedBOM.items.length > 0 ? 'items' : null,
                        updatedBOM.projectId ? 'projectId' : null
                    ].filter(Boolean)
                },
                workflow: {
                    bomFinalization: true,
                    bomWorkflow: true,
                    projectWorkflow: true,
                    planningWorkflow: true,
                    vendorAssignment: true,
                    finalizationComplete: true
                }
            }
        });
    } catch (error) {
        console.error('Error logging BOM finalization:', error);
    }

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

/**
 * Mark a BOM as reusable
 * @param {*} projectId
 * @param {*} bomId
 * @param {{title: string, remarks?: string}} data
 * @param {*} user
 */
export const makeBOMReusable = async (req, projectId, bomId, data, user) => {
    const bom = await BOM.findOne({ _id: bomId, projectId }).populate('projectId', 'projectName projectCode status customerName requirementType architect');
    if (!bom) {
        throw new ApiError(httpStatus.NOT_FOUND, 'BOM not found');
    }

    // Only allow if BOM is approved or finalized; adjust rules if needed
    const allowedStatuses = ['approved', 'finalized'];
    if (!allowedStatuses.includes(bom.status)) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Only approved or finalized BOMs can be made reusable');
    }

    const originalIsReusable = bom.isReusable;
    const originalTitle = bom.title;
    const originalRemarks = bom.remarks;

    bom.isReusable = true;
    bom.title = data.title;
    if (data.remarks) bom.remarks = data.remarks;
    await bom.save();

    // Log activity
    try {
        await logActivity(req, {
            action: 'make_bom_reusable',
            targetModel: 'BOM',
            targetId: bom._id,
            targetName: bom.title || `BOM v${bom.version}`,
            description: `${user.role === 'admin' ? 'Admin' : 'User'} ${user.name} (${user.email}) marked BOM version ${bom.version} reusable for project: ${bom.projectId?.projectName || 'Unknown Project'}`,
            changes: {
                isReusable: {
                    from: originalIsReusable,
                    to: true
                },
                title: {
                    from: originalTitle,
                    to: bom.title
                },
                remarks: data.remarks ? {
                    from: originalRemarks,
                    to: bom.remarks
                } : undefined
            },
            metadata: {
                projectId: bom.projectId?._id,
                projectData: {
                    projectId: bom.projectId?._id,
                    projectName: bom.projectId?.projectName,
                    projectCode: bom.projectId?.projectCode,
                    status: bom.projectId?.status,
                    customerName: bom.projectId?.customerName,
                    requirementType: bom.projectId?.requirementType,
                    architect: bom.projectId?.architect
                },
                user: {
                    userId: user._id,
                    userName: user.name,
                    userEmail: user.email,
                    userRole: user.role,
                    userType: user.role === 'admin' ? 'Admin' : 'User'
                },
                bomData: {
                    bomId: bom._id,
                    title: bom.title,
                    version: bom.version,
                    status: bom.status,
                    isReusable: bom.isReusable,
                    remarks: bom.remarks,
                    architectDocumentId: bom.architectDocumentId,
                    sourceBOMId: bom.sourceBOMId,
                    projectId: bom.projectId,
                    createdBy: bom.createdBy,
                    createdAt: bom.createdAt,
                    updatedAt: bom.updatedAt
                }
            }
        });
    } catch (error) {
        console.error('Error logging make BOM reusable:', error);
    }

    return bom.populate(['createdBy', 'projectId', 'items.addedBy']);
};

export const disableBOMReusable = async (req, projectId, bomId, user) => {
    const bom = await BOM.findOne({ _id: bomId, projectId });
    if (!bom) {
        throw new ApiError(httpStatus.NOT_FOUND, 'BOM not found');
    }
    // Only allow if currently reusable
    if (!bom.isReusable) {
        return bom;
    }
    bom.isReusable = false;
    bom.title = undefined;
    await bom.save();
    return bom;
};