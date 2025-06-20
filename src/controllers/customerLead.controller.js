import catchAsync from '../utils/catchAsync.js';
import { createCustomerLeadService, listCustomerLeadsService, getCustomerLeadByIdService, activateCustomerLeadService, deactivateCustomerLeadService, importCustomerLeadsService, exportCustomerLeadsService, updateCustomerLeadService } from '../services/customerLead.service.js';
import ApiError from '../utils/ApiError.js';

export const createCustomerLeadController = catchAsync(async (req, res) => {
  const {
    leadSource,
    customerName,
    mobileNumber,
    whatsappNumber,
    email,
    preferredLanguage,
    state,
    city,
    googleLocationLink,
    requirementType,
    otherRequirement,
    requirementDescription,
    urgency,
    budget,
    hasDrawing,
    needsArchitect,
    requestSiteVisit
  } = req.body;

  const samplePhotoUrl = req.file ? req.file.path : undefined;

  const payload = {
    leadSource,
    customerName,
    mobileNumber,
    whatsappNumber,
    email,
    preferredLanguage,
    state,
    city,
    googleLocationLink,
    requirementType,
    otherRequirement,
    requirementDescription,
    urgency,
    budget,
    hasDrawing: hasDrawing === 'Yes',
    needsArchitect: needsArchitect === 'Yes',
    requestSiteVisit: requestSiteVisit === 'on' || requestSiteVisit === true,
    samplePhotoUrl
  };

  const lead = await createCustomerLeadService(payload);
  res.status(201).json({ success: true, lead });
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
  
  res.status(200).json({ success: true, status: 1, lead });
});

export const activateCustomerLeadController = catchAsync(async (req, res) => {
  const { id } = req.params;
  const lead = await activateCustomerLeadService(id);
  if (!lead) {
    throw new ApiError(404, 'Customer lead not found');
  }
  res.status(200).json({ success: true,  status: 1, isActive: true });
});

export const deactivateCustomerLeadController = catchAsync(async (req, res) => {
  const { id } = req.params;
  const lead = await deactivateCustomerLeadService(id);
  if (!lead) {
    throw new ApiError(404, 'Customer lead not found');
  }
  res.status(200).json({ success: true, status: 1, isActive:false });
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
  // Add any other filters you need, e.g., date range

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

export const updateCustomerLeadController = async (req, session) => {
  const updatedLead = await updateCustomerLeadService(req, session);
  return {
    status: 200,
    body: {
      status: 1,
      message: 'Customer lead updated successfully.',
      data: updatedLead,
    },
  };
};
