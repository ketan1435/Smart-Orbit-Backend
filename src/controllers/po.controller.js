import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync.js';
import { createPOService, getPOsService, activatePOService, deactivatePOService, markItemsAsDeliveredService } from '../services/po.service.js';
import ApiError from '../utils/ApiError.js';

export const createPO = catchAsync(async (req, res) => {
    const po = await createPOService(req, req.body);
    res.status(httpStatus.CREATED).json({ status: 1, message: 'PO created successfully', data: po });
});

export const getPOs = catchAsync(async (req, res) => {
    const result = await getPOsService(req.query);
    res.status(httpStatus.OK).json({ status: 1, ...result });
});

export const activatePO = catchAsync(async (req, res) => {
    const po = await activatePOService(req, req.params.id);
    if (!po) throw new ApiError(httpStatus.NOT_FOUND, 'PO not found');
    res.status(httpStatus.OK).json({ status: 1, message: 'PO activated', data: po });
});

export const deactivatePO = catchAsync(async (req, res) => {
    const po = await deactivatePOService(req, req.params.id);
    if (!po) throw new ApiError(httpStatus.NOT_FOUND, 'PO not found');
    res.status(httpStatus.OK).json({ status: 1, message: 'PO deactivated', data: po });
});

export const markItemsAsDelivered = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { itemIndices } = req.body;

    const result = await markItemsAsDeliveredService(req, id, itemIndices);

    res.status(httpStatus.OK).json({
        status: 1,
        message: `Successfully marked ${result.summary.newlyMarked} items as delivered`,
        data: {
            po: result.po,
            itemsMarked: result.itemsMarked,
            alreadyDeliveredItems: result.alreadyDeliveredItems,
            summary: result.summary
        }
    });
}); 