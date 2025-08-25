import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync.js';
import * as bomService from '../services/bom.service.js';
import pick from '../utils/pick.js';

/**
 * Create a BOM for a project
 */
export const createBOM = catchAsync(async (req, res) => {
    const bom = await bomService.createBOM(req.params.projectId, req.body, req.user);
    res.status(httpStatus.CREATED).send({
        status: 1,
        message: 'BOM created successfully',
        data: bom,
    });
});

/**
 * Get BOMs for a project
 */
export const getBOMs = catchAsync(async (req, res) => {
    const filter = pick(req.query, ['status', 'version', 'architectDocumentId', 'isReusable']);
    const options = pick(req.query, ['sortBy', 'limit', 'page']);
    const result = await bomService.queryBOMs(req.params.projectId, filter, options);
    res.status(httpStatus.OK).send({
        status: 1,
        message: 'BOMs fetched successfully',
        data: result,
    });
});

/**
 * Get a single BOM by ID
 */
export const getBOM = catchAsync(async (req, res) => {
    const bom = await bomService.getBOMById(req.params.projectId, req.params.bomId);
    res.status(httpStatus.OK).send({
        status: 1,
        message: 'BOM fetched successfully',
        data: bom,
    });
});

/**
 * Get a single BOM by ID for site engineers
 */
export const getBOMForSiteEngineer = catchAsync(async (req, res) => {
    const bom = await bomService.getBOMByIdForSiteEngineer(req.params.bomId, req.user.id);
    res.status(httpStatus.OK).send({
        status: 1,
        message: 'BOM fetched successfully',
        data: bom,
    });
});

/**
 * Update a BOM
 */
export const updateBOM = catchAsync(async (req, res) => {
    const bom = await bomService.updateBOM(req.params.projectId, req.params.bomId, req.body, req.user);
    res.status(httpStatus.OK).send({
        status: 1,
        message: 'BOM updated successfully',
        data: bom,
    });
});

/**
 * Update BOM status
 */
export const updateBOMStatus = catchAsync(async (req, res) => {
    const bom = await bomService.updateBOMStatus(req.params.projectId, req.params.bomId, req.body, req.user);
    res.status(httpStatus.OK).send({
        status: 1,
        message: 'BOM status updated successfully',
        data: bom,
    });
});

/**
 * Delete a BOM
 */
export const deleteBOM = catchAsync(async (req, res) => {
    await bomService.deleteBOM(req.params.projectId, req.params.bomId, req.user);
    res.status(httpStatus.NO_CONTENT).send();
});

/**
 * Get reusable BOMs
 */
export const getReusableBOMs = catchAsync(async (req, res) => {
    const options = pick(req.query, ['sortBy', 'limit', 'page']);
    const result = await bomService.getReusableBOMs(options);
    res.status(httpStatus.OK).send({
        status: 1,
        message: 'Reusable BOMs fetched successfully',
        data: result,
    });
});

/**
 * Submit BOM for admin review
 */
export const submitBOM = catchAsync(async (req, res) => {
    const bom = await bomService.submitBOM(req.params.projectId, req.params.bomId, req.user);
    res.status(httpStatus.OK).send({
        status: 1,
        message: 'BOM submitted for review successfully',
        data: bom,
    });
});

/**
 * Get submitted BOMs for admin review
 */
export const getSubmittedBOMs = catchAsync(async (req, res) => {
    const filter = pick(req.query, ['createdBy', 'projectId']);
    const options = pick(req.query, ['sortBy', 'limit', 'page']);
    const result = await bomService.getSubmittedBOMs(filter, options);
    res.status(httpStatus.OK).send({
        status: 1,
        message: 'Submitted BOMs fetched successfully',
        data: result,
    });
});

/**
 * Review BOM (admin approve/reject)
 */
export const reviewBOM = catchAsync(async (req, res) => {
    const bom = await bomService.reviewBOM(req.params.projectId, req.params.bomId, req.body, req.user);
    res.status(httpStatus.OK).send({
        status: 1,
        message: `BOM ${req.body.status} successfully`,
        data: bom,
    });
});

/**
 * Get all BOMs (general listing)
 */
export const getAllBOMs = catchAsync(async (req, res) => {
    const filter = pick(req.query, ['status', 'projectId', 'search']);
    const options = pick(req.query, ['sortBy', 'limit', 'page']);
    const result = await bomService.getAllBOMs(filter, options);
    res.status(httpStatus.OK).send({
        status: 1,
        message: 'BOMs fetched successfully',
        data: result,
    });
});

/**
 * Get procurement team members
 */
export const getProcurementTeam = catchAsync(async (req, res) => {
    const options = pick(req.query, ['sortBy', 'limit', 'page']);
    const result = await bomService.getProcurementTeam(options);
    res.status(httpStatus.OK).send({
        status: 1,
        message: 'Procurement team members fetched successfully',
        data: result,
    });
});

/**
 * Assign BOM to site engineer
 */
export const assignBOMToSiteEngineer = catchAsync(async (req, res) => {
    const bom = await bomService.assignBOMToSiteEngineer(req.params.projectId, req.params.bomId, req.body, req.user);
    res.status(httpStatus.OK).send({
        status: 1,
        message: 'BOM assigned to site engineer successfully',
        data: bom,
    });
});

/**
 * Get BOMs assigned to site engineer
 */
export const getSiteEngineerBOMs = catchAsync(async (req, res) => {
    const filter = pick(req.query, ['status', 'projectId']);
    const options = pick(req.query, ['sortBy', 'limit', 'page']);

    // Clean up filter to remove empty values
    if (filter.projectId === '') {
        delete filter.projectId;
    }
    if (filter.status === '') {
        delete filter.status;
    }

    const result = await bomService.getSiteEngineerBOMs(req.user.id, filter, options);
    res.status(httpStatus.OK).send({
        status: 1,
        message: 'Site engineer BOMs fetched successfully',
        data: result,
    });
});

/**
 * Update BOM by site engineer
 */
export const updateBOMBySiteEngineer = catchAsync(async (req, res) => {
    const bom = await bomService.updateBOMBySiteEngineer(req.params.projectId, req.params.bomId, req.body, req.user);
    res.status(httpStatus.OK).send({
        status: 1,
        message: 'BOM updated by site engineer successfully',
        data: bom,
    });
});

/**
 * Submit updated BOM to planning engineer
 */
export const submitUpdatedBOMToPlanning = catchAsync(async (req, res) => {
    const bom = await bomService.submitUpdatedBOMToPlanning(req.params.projectId, req.params.bomId, req.body, req.user);
    res.status(httpStatus.OK).send({
        status: 1,
        message: 'Updated BOM submitted to planning engineer successfully',
        data: bom,
    });
});

/**
 * Get rough BOMs for planning engineer review
 */
export const getRoughBOMsForPlanning = catchAsync(async (req, res) => {
    const filter = pick(req.query, ['status', 'projectId']);
    const options = pick(req.query, ['sortBy', 'limit', 'page']);

    // Clean up filter to remove empty values
    if (filter.projectId === '') {
        delete filter.projectId;
    }
    if (filter.status === '') {
        delete filter.status;
    }

    const result = await bomService.getRoughBOMsForPlanning(filter, options);
    res.status(httpStatus.OK).send({
        status: 1,
        message: 'Rough BOMs for planning review fetched successfully',
        data: result,
    });
});

/**
 * Get site engineers list
 */
export const getSiteEngineers = catchAsync(async (req, res) => {
    console.log('=== BOM getSiteEngineers controller called ===');
    console.log('Request URL:', req.originalUrl);
    console.log('Request method:', req.method);
    console.log('Request headers:', req.headers);
    console.log('Request user:', req.user);

    const options = pick(req.query, ['sortBy', 'limit', 'page']);
    let { projectId } = req.query; // Get projectId from query params

    // Clean up projectId if it's empty
    if (projectId === '') {
        projectId = null;
    }

    console.log('getSiteEngineers called with:', { options, projectId, user: req.user });

    const result = await bomService.getSiteEngineers(options, projectId);

    console.log('getSiteEngineers result:', result);

    res.status(httpStatus.OK).send({
        status: 1,
        message: 'Site engineers fetched successfully',
        data: result,
    });
});

/**
 * Create a finalized BOM with vendor assignments
 */
export const createFinalizedBOM = catchAsync(async (req, res) => {
    const { originalBomId, finalizedItems } = req.body;
    const finalizedBOM = await bomService.createFinalizedBOM(
        req.params.projectId,
        originalBomId,
        finalizedItems,
        req.user
    );
    res.status(httpStatus.CREATED).send({
        status: 1,
        message: 'Finalized BOM created successfully',
        data: finalizedBOM,
    });
}); 