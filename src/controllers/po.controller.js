import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync.js';
import { createPOService, getPOsService, activatePOService, deactivatePOService } from '../services/po.service.js';
import ApiError from '../utils/ApiError.js';

export const createPO = catchAsync(async (req, res) => {
    const po = await createPOService(req.body, req.user);
    res.status(httpStatus.CREATED).json({ status: 1, message: 'PO created successfully', data: po });
});

export const getPOs = catchAsync(async (req, res) => {
    const result = await getPOsService(req.query);
    res.status(httpStatus.OK).json({ status: 1, ...result });
});

export const activatePO = catchAsync(async (req, res) => {
    const po = await activatePOService(req.params.id);
    if (!po) throw new ApiError(httpStatus.NOT_FOUND, 'PO not found');
    res.status(httpStatus.OK).json({ status: 1, message: 'PO activated', data: po });
});

export const deactivatePO = catchAsync(async (req, res) => {
    const po = await deactivatePOService(req.params.id);
    if (!po) throw new ApiError(httpStatus.NOT_FOUND, 'PO not found');
    res.status(httpStatus.OK).json({ status: 1, message: 'PO deactivated', data: po });
}); 