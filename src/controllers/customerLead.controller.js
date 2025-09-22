import catchAsync from '../utils/catchAsync.js';
import {
  createCustomerLeadService,
  listCustomerLeadsService,
  getCustomerLeadByIdService,
  updateCustomerLeadService,
  activateCustomerLeadService,
  deactivateCustomerLeadService,
  updateCustomerLeadStatusService,
  updateCustomerAndProjectsStatusService,
  importCustomerLeadsService,
  generateSampleCustomerLeadsCSV,
  exportCustomerLeadsService,
  shareRequirementWithUsersService,
  getSharedRequirementsForUserService,
  shareRequirementWithScpUsersService,
  updateScpDataByScpUserService,
  updateScpDataByAdminService,
  getScpUserAssignedRequirementsService,
  deleteFileFromRequirementService,
  deleteMultipleFilesFromRequirementService,
} from '../services/customerLead.service.js';
import {
  updateCustomerStatusWithCascade,
  recalculateCustomerStatus,
  getCustomerStatusSummary
} from '../services/statusCascade.service.js';
import ApiError from '../utils/ApiError.js';
import httpStatus from 'http-status';
import { STATUS_ENUM } from '../config/enums/status.enum.js';

export const createCustomerLeadController = catchAsync(async (req, res) => {
  console.log('=== BACKEND DEBUG: CREATE CUSTOMER LEAD ===');
  console.log('Request body:', JSON.stringify(req.body, null, 2));
  console.log('Status value:', req.body.status);
  console.log('Status type:', typeof req.body.status);
  console.log('Status length:', req.body.status?.length);
  console.log('Status char codes:', req.body.status?.split('').map(c => c.charCodeAt(0)));
  console.log('==========================================');
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

  // Enhanced search functionality
  if (req.query.search) {
    const searchTerm = req.query.search;
    const searchRegex = { $regex: searchTerm, $options: 'i' };

    // Create an OR condition to search across multiple fields
    filter.$or = [
      { customerName: searchRegex },
      { mobileNumber: searchRegex },
      { alternateContactNumber: searchRegex },
      { whatsappNumber: searchRegex },
      { email: searchRegex },
      { state: searchRegex },
      { city: searchRegex },
      { leadSource: searchRegex },
      { preferredLanguage: searchRegex },
      { googleLocationLink: searchRegex }
    ];
  } else {
    // Apply individual filters if provided (backward compatibility)
    if (req.query.customerName) {
      filter.customerName = { $regex: req.query.customerName, $options: 'i' };
    }
    if (req.query.leadSource) {
      filter.leadSource = req.query.leadSource;
    }
    if (req.query.mobileNumber) {
      filter.mobileNumber = { $regex: req.query.mobileNumber, $options: 'i' };
    }
    if (req.query.email) {
      filter.email = { $regex: req.query.email, $options: 'i' };
    }
    if (req.query.state) {
      filter.state = { $regex: req.query.state, $options: 'i' };
    }
    if (req.query.city) {
      filter.city = { $regex: req.query.city, $options: 'i' };
    }
  }

  if (req.query.status) {
    filter.status = req.query.status;
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

// export const updateCustomerLeadController = async (req, res) => {
//   const { id } = req.params;
//   const lead = await updateCustomerLeadService(id, req.body);
//   res.status(200).json({ status: 1, message: 'Customer lead updated successfully', data: lead });
// };

export const activateCustomerLeadController = catchAsync(async (req, res) => {
  const { id } = req.params;
  const lead = await activateCustomerLeadService(req, id);
  if (!lead) {
    throw new ApiError(404, 'Customer lead not found');
  }
  res.status(200).json({ success: true, status: 1, status: STATUS_ENUM.ACTIVE });
});

export const deactivateCustomerLeadController = catchAsync(async (req, res) => {
  const { id } = req.params;
  const lead = await deactivateCustomerLeadService(req, id);
  if (!lead) {
    throw new ApiError(404, 'Customer lead not found');
  }
  res.status(200).json({ success: true, status: 1, status: STATUS_ENUM.INACTIVE });
});

export const updateCustomerLeadStatusController = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    throw new ApiError(400, 'Status is required');
  }

  const lead = await updateCustomerLeadStatusService(req, id, status);
  res.status(200).json({
    success: true,
    status: 1,
    message: 'Customer lead status updated successfully',
    data: lead
  });
});

export const updateCustomerAndProjectsStatusController = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    throw new ApiError(400, 'Status is required');
  }

  const result = await updateCustomerAndProjectsStatusService(req, id, status);
  res.status(200).json({
    success: true,
    status: 1,
    message: `Customer status updated to ${status} and ${result.projectsUpdated} projects synchronized successfully`,
    data: result
  });
});

export const importCustomerLeadsController = catchAsync(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, 'Please upload a spreadsheet file.');
  }

  const { importedCount, errors } = await importCustomerLeadsService(req.file.path, req);

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

export const downloadSampleCustomerLeadsController = catchAsync(async (req, res) => {
  const fileBuffer = generateSampleCustomerLeadsCSV();

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="customer_leads_sample.xlsx"');
  res.send(fileBuffer);
});

export const exportCustomerLeadsController = catchAsync(async (req, res) => {
  const filter = {};

  // Enhanced search functionality for export
  if (req.query.search) {
    const searchTerm = req.query.search;
    const searchRegex = { $regex: searchTerm, $options: 'i' };

    // Create an OR condition to search across multiple fields
    filter.$or = [
      { customerName: searchRegex },
      { mobileNumber: searchRegex },
      { alternateContactNumber: searchRegex },
      { whatsappNumber: searchRegex },
      { email: searchRegex },
      { state: searchRegex },
      { city: searchRegex },
      { leadSource: searchRegex },
      { preferredLanguage: searchRegex },
      { googleLocationLink: searchRegex }
    ];
  } else {
    // Reuse filtering logic from list controller (backward compatibility)
    if (req.query.customerName) {
      filter.customerName = { $regex: req.query.customerName, $options: 'i' };
    }
    if (req.query.leadSource) {
      filter.leadSource = req.query.leadSource;
    }
    if (req.query.mobileNumber) {
      filter.mobileNumber = { $regex: req.query.mobileNumber, $options: 'i' };
    }
    if (req.query.email) {
      filter.email = { $regex: req.query.email, $options: 'i' };
    }
    if (req.query.state) {
      filter.state = { $regex: req.query.state, $options: 'i' };
    }
    if (req.query.city) {
      filter.city = { $regex: req.query.city, $options: 'i' };
    }
  }

  if (req.query.status) {
    filter.status = req.query.status;
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
  const { userIds, documentId, shouldSendToEngineer } = req.body;
  const adminId = req.user.id;

  const updatedRequirement = await shareRequirementWithUsersService(
    req,
    leadId,
    requirementId,
    userIds,
    adminId,
    documentId,
    shouldSendToEngineer
  );

  res.status(httpStatus.OK).json({
    status: 1,
    message: shouldSendToEngineer
      ? 'Requirement shared successfully and document sent to Planning Engineer.'
      : 'Requirement shared successfully.',
    data: updatedRequirement,
  });
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

/**
 * Share requirement with multiple SCP users and grant update permissions
 */
export const shareRequirementWithScpUsersController = catchAsync(async (req, res) => {
  const { leadId, requirementId } = req.params;
  const { scpUserIds } = req.body;
  const adminId = req.user.id;

  const updatedRequirement = await shareRequirementWithScpUsersService(req, leadId, requirementId, scpUserIds, adminId);
  res.status(httpStatus.OK).json({
    status: 1,
    message: 'Requirement shared with SCP users successfully.',
    data: updatedRequirement,
  });
});

/**
 * Update SCP data by SCP user (one-time only)
 */
export const updateScpDataByScpUserController = catchAsync(async (req, res) => {
  const { leadId, requirementId } = req.params;
  const { scpData, files } = req.body;
  const scpUserId = req.user.id;

  const updatedRequirement = await updateScpDataByScpUserService(req, leadId, requirementId, scpUserId, scpData, files);
  res.status(httpStatus.OK).json({
    status: 1,
    message: 'SCP data updated successfully.',
    data: updatedRequirement,
  });
});

/**
 * Get requirements assigned to SCP user for modification
 */
export const getScpUserAssignedRequirementsController = catchAsync(async (req, res) => {
  const scpUserId = req.user._id;

  // Extract query parameters
  const {
    page = 1,
    limit = 10,
    sortBy = 'sharedAt:desc',
    search = '',
    projectName = '',
    customerName = '',
    requirementType = '',
    status = ''
  } = req.query;

  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    sortBy,
    search,
    projectName,
    customerName,
    requirementType,
    status
  };

  const result = await getScpUserAssignedRequirementsService(scpUserId, {}, options);
  res.status(httpStatus.OK).json({
    status: 1,
    message: 'SCP user assigned requirements retrieved successfully.',
    data: result
  });
});

/**
 * Update SCP data by admin (similar to SCP user but without permission restrictions)
 */
export const updateScpDataByAdminController = catchAsync(async (req, res) => {
  const { leadId, requirementId } = req.params;
  const { scpData, files } = req.body;
  const adminId = req.user.id;

  const updatedRequirement = await updateScpDataByAdminService(req, leadId, requirementId, adminId, scpData, files);
  res.status(httpStatus.OK).json({
    status: 1,
    message: 'SCP data updated successfully by admin.',
    data: updatedRequirement,
  });
});

/**
 * Delete a single file from a requirement
 */
export const deleteFileFromRequirement = catchAsync(async (req, res) => {
  const { leadId, requirementId, fileKey } = req.params;
  const userId = req.user.id;

  const updatedRequirement = await deleteFileFromRequirementService(req, leadId, requirementId, fileKey, userId);

  res.status(httpStatus.OK).json({
    status: 1,
    message: 'File deleted successfully',
    data: updatedRequirement,
  });
});

/**
 * Delete multiple files from a requirement (bulk deletion)
 */
export const deleteMultipleFilesFromRequirement = catchAsync(async (req, res) => {
  const { leadId, requirementId } = req.params;
  const { fileKeys } = req.body;
  const userId = req.user.id;

  const result = await deleteMultipleFilesFromRequirementService(req, leadId, requirementId, fileKeys, userId);

  res.status(httpStatus.OK).json({
    status: 1,
    message: `Successfully deleted ${result.totalDeleted} out of ${result.totalRequested} files`,
    data: result,
  });
});

/**
 * Update customer status with cascade to projects
 */
export const updateCustomerStatusWithCascadeController = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Status is required');
  }

  const result = await updateCustomerStatusWithCascade(id, status);

  res.status(httpStatus.OK).json({
    status: 1,
    message: `Customer status updated to ${status}. ${result.projectsUpdated} projects also updated.`,
    data: result,
  });
});

/**
 * Recalculate customer status based on project statuses
 */
export const recalculateCustomerStatusController = catchAsync(async (req, res) => {
  const { id } = req.params;

  const result = await recalculateCustomerStatus(id);

  res.status(httpStatus.OK).json({
    status: 1,
    message: `Customer status recalculated to ${result.newCustomerStatus} based on ${result.projectsCount} projects.`,
    data: result,
  });
});

/**
 * Get customer status summary with project breakdown
 */
export const getCustomerStatusSummaryController = catchAsync(async (req, res) => {
  const { id } = req.params;

  const result = await getCustomerStatusSummary(id);

  res.status(httpStatus.OK).json({
    status: 1,
    message: 'Customer status summary retrieved successfully.',
    data: result,
  });
});
