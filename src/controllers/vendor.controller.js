import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync.js';
import ApiError from '../utils/ApiError.js';
import { createVendorService, getVendorsService, activateVendorService, deactivateVendorService, getVendorsDropdownService, updateVendorService, getVendorByIdService, deleteVendorService } from '../services/vendor.service.js';

export const createVendor = catchAsync(async (req, res) => {
    const vendor = await createVendorService(req, req.body);
    res.status(httpStatus.CREATED).json({ status: 1, message: 'Vendor created successfully', data: vendor });
});

export const getVendors = catchAsync(async (req, res) => {
    const result = await getVendorsService(req.query);
    res.status(httpStatus.OK).json({ status: 1, ...result });
});

export const getVendorsDropdown = catchAsync(async (req, res) => {
    const vendors = await getVendorsDropdownService(req.query);
    res.status(httpStatus.OK).json({ status: 1, data: vendors });
});

export const activateVendor = catchAsync(async (req, res) => {
    const vendor = await activateVendorService(req, req.params.id);
    if (!vendor) throw new ApiError(httpStatus.NOT_FOUND, 'Vendor not found');
    res.status(httpStatus.OK).json({ status: 1, message: 'Vendor activated', data: vendor });
});

export const deactivateVendor = catchAsync(async (req, res) => {
    const vendor = await deactivateVendorService(req, req.params.id);
    if (!vendor) throw new ApiError(httpStatus.NOT_FOUND, 'Vendor not found');
    res.status(httpStatus.OK).json({ status: 1, message: 'Vendor deactivated', data: vendor });
});

export const updateVendor = catchAsync(async (req, res) => {
    const vendor = await updateVendorService(req, req.params.id, req.body);
    if (!vendor) throw new ApiError(httpStatus.NOT_FOUND, 'Vendor not found');
    res.status(httpStatus.OK).json({ status: 1, message: 'Vendor updated successfully', data: vendor });
});

export const getVendorById = catchAsync(async (req, res) => {
    const vendor = await getVendorByIdService(req.params.id);
    if (!vendor) throw new ApiError(httpStatus.NOT_FOUND, 'Vendor not found');
    res.status(httpStatus.OK).json({ status: 1, data: vendor });
});

export const deleteVendor = catchAsync(async (req, res) => {
    const vendor = await deleteVendorService(req, req.params.id);
    if (!vendor) throw new ApiError(httpStatus.NOT_FOUND, 'Vendor not found');
    res.status(httpStatus.OK).json({ status: 1, message: 'Vendor deleted successfully', data: vendor });
}); 