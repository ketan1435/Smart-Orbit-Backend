import catchAsync from '../utils/catchAsync.js';
import {
  createCustomerLeadService,
  listCustomerLeadsService,
  getCustomerLeadByIdService,
  updateCustomerLeadService,
  activateCustomerLeadService,
  deactivateCustomerLeadService,
  importCustomerLeadsService,
  exportCustomerLeadsService,
  shareRequirementWithUsersService,
  getSharedRequirementsForUserService,
} from '../services/customerLead.service.js';
import ApiError from '../utils/ApiError.js';
import httpStatus from 'http-status';

export const createCustomerLeadController = catchAsync(async (req, res) => {
  const lead = await createCustomerLeadService(req.body);
  res.status(httpStatus.CREATED).json({ status: 1, message: 'Customer lead created successfully', data: lead });
});

export const listCustomerLeadsController = catchAsync(async (req, res) => {
  const filter = {};
  const options = {
    limit: parseInt(req.query.limit, 10) || 10,
    page: parseInt(req.query.page, 10) || 1,
  };
  options.skip = (options.page - 1) * options.limit;

  // Parse sortBy parameter
  if (req.query.sortBy) {
    const [field, order] = req.query.sortBy.split(':');
    options.sortBy = { [field]: order === 'desc' ? -1 : 1 };
  } else {
    options.sortBy = { createdAt: -1 }; // default sort
  }

  // Apply filters if provided
  if (req.query.customerName) {
    filter.customerName = { $regex: req.query.customerName, $options: 'i' };
  }
  if (req.query.leadSource) {
    filter.leadSource = req.query.leadSource;
  }
  if (req.query.isActive !== undefined) {
    filter.isActive = req.query.isActive === 'true';
  }

  const result = await listCustomerLeadsService(filter, options);
  res.status(200).json(result);
});

export const getCustomerLeadController = catchAsync(async (req, res) => {
  const { id } = req.params;
  const lead = await getCustomerLeadByIdService(id);
  
  if (!lead) {
    throw new ApiError(404, 'Customer lead not found');
  }
  
  res.status(200).json({ status: 1, data: lead });
});

export const updateCustomerLeadController = catchAsync(async (req, res) => {
    const { id } = req.params;
    const lead = await updateCustomerLeadService(id, req.body);
    res.status(200).json({ status: 1, message: 'Customer lead updated successfully', data: lead });
});

export const activateCustomerLeadController = catchAsync(async (req, res) => {
  const { id } = req.params;
  const lead = await activateCustomerLeadService(id);
  if (!lead) {
    throw new ApiError(404, 'Customer lead not found');
  }
  res.status(200).json({ success: true, status: 1, isActive: true });
});

export const deactivateCustomerLeadController = catchAsync(async (req, res) => {
  const { id } = req.params;
  const lead = await deactivateCustomerLeadService(id);
  if (!lead) {
    throw new ApiError(404, 'Customer lead not found');
  }
  res.status(200).json({ success: true, status: 1, isActive: false });
});

export const importCustomerLeadsController = catchAsync(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, 'Please upload a spreadsheet file.');
  }

  const { importedCount, errors } = await importCustomerLeadsService(req.file.path);

  const message = `${importedCount} leads imported successfully.`;

  if (errors && errors.length > 0) {
    return res.status(207).json({
      status: 1,
      message: `${message} Some rows had issues.`,
      importedCount,
      errors,
    });
  }

  res.status(201).json({ status: 1, message, importedCount });
});

export const exportCustomerLeadsController = catchAsync(async (req, res) => {
  const filter = {};
  // Reuse filtering logic from list controller
  if (req.query.customerName) {
    filter.customerName = { $regex: req.query.customerName, $options: 'i' };
  }
  if (req.query.leadSource) {
    filter.leadSource = req.query.leadSource;
  }
  if (req.query.isActive !== undefined) {
    filter.isActive = req.query.isActive === 'true';
  }
  
  // Handle date filters
  const { dateFilterType, specificDate, startDate, endDate } = req.query;
  if (dateFilterType === 'specific' && specificDate) {
    const dayStart = new Date(specificDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(specificDate);
    dayEnd.setHours(23, 59, 59, 999);
    filter.createdAt = { $gte: dayStart, $lte: dayEnd };
  } else if (dateFilterType === 'range' && startDate) {
    const rangeStart = new Date(startDate);
    rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd = endDate ? new Date(endDate) : new Date();
    rangeEnd.setHours(23, 59, 59, 999);
    filter.createdAt = { $gte: rangeStart, $lte: rangeEnd };
  }

  const fileBuffer = await exportCustomerLeadsService(filter);

  if (!fileBuffer) {
    throw new ApiError(404, 'No leads found for the selected criteria.');
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `customer-leads-${timestamp}.xlsx`;

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.send(fileBuffer);
});

export const shareRequirementForUserController = catchAsync(async (req, res) => {
    const { leadId, requirementId } = req.params;
    const { userIds } = req.body;
    const adminId = req.user.id; // Assuming admin's ID is on req.user

    const lead = await shareRequirementWithUsersService(leadId, requirementId, userIds, adminId);
    res.status(httpStatus.OK).json({ status: 1, message: 'Requirement shared successfully.', data: lead });
});

export const getMySharedRequirementsController = catchAsync(async (req, res) => {
    const userId = req.user.id;
    const requirements = await getSharedRequirementsForUserService(userId);
    res.status(httpStatus.OK).json({ status: 1, data: requirements });
});

// This is for an admin to view any user's shared items.
export const getSharedRequirementsForUserController = catchAsync(async (req, res) => {
    const { userId } = req.params;
    const requirements = await getSharedRequirementsForUserService(userId);
    res.status(httpStatus.OK).json({ status: 1, data: requirements });
});
