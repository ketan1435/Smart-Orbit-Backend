import httpStatus from 'http-status';
import Service from '../models/service.model.js';
import ApiError from '../utils/ApiError.js';
import catchAsync from '../utils/catchAsync.js';

export const createService = catchAsync(async (req, res) => {
  const serviceData = {
    ...req.body,
    createdBy: req.user._id,
  };

  const service = await Service.create(serviceData);
  res.status(httpStatus.CREATED).json({
    status: 1,
    message: 'Service created successfully',
    data: service,
  });
});

export const getServices = catchAsync(async (req, res) => {
  const { page = 1, limit = 10, search, category, status } = req.query;
  const skip = (page - 1) * limit;

  // Build filter object
  const filter = {};
  
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ];
  }
  
  if (category) {
    filter.category = category;
  }
  
  if (status) {
    filter.status = status;
  }

  const services = await Service.find(filter)
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Service.countDocuments(filter);

  res.json({
    status: 1,
    message: 'Services fetched successfully',
    data: services,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit),
    },
  });
});

export const getServiceById = catchAsync(async (req, res) => {
  const service = await Service.findById(req.params.id)
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email');

  if (!service) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Service not found');
  }

  res.json({
    status: 1,
    message: 'Service fetched successfully',
    data: service,
  });
});

export const updateService = catchAsync(async (req, res) => {
  const service = await Service.findById(req.params.id);

  if (!service) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Service not found');
  }

  const updatedService = await Service.findByIdAndUpdate(
    req.params.id,
    { ...req.body, updatedBy: req.user._id },
    { new: true, runValidators: true }
  )
    .populate('createdBy', 'name email')
    .populate('updatedBy', 'name email');

  res.json({
    status: 1,
    message: 'Service updated successfully',
    data: updatedService,
  });
});

export const deleteService = catchAsync(async (req, res) => {
  const service = await Service.findById(req.params.id);

  if (!service) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Service not found');
  }

  await Service.findByIdAndDelete(req.params.id);

  res.json({
    status: 1,
    message: 'Service deleted successfully',
  });
});

export const addServiceAttachment = catchAsync(async (req, res) => {
  const { serviceId } = req.params;
  const { fileName, fileType, fileSize, key } = req.body;

  const service = await Service.findById(serviceId);

  if (!service) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Service not found');
  }

  const attachment = {
    fileName,
    fileType,
    fileSize,
    key,
    uploadedBy: req.user._id,
  };

  service.attachments.push(attachment);
  await service.save();

  res.json({
    status: 1,
    message: 'Attachment added successfully',
    data: service,
  });
});

export const removeServiceAttachment = catchAsync(async (req, res) => {
  const { serviceId, attachmentId } = req.params;

  const service = await Service.findById(serviceId);

  if (!service) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Service not found');
  }

  service.attachments = service.attachments.filter(
    (attachment) => attachment._id.toString() !== attachmentId
  );

  await service.save();

  res.json({
    status: 1,
    message: 'Attachment removed successfully',
    data: service,
  });
});
