import * as adminService from '../services/admin.service.js';
import catchAsync from '../utils/catchAsync.js';
import ApiError from '../utils/ApiError.js';
// import { setSelectedStoreService } from '../services/admin.service.js';

export const registerAdmin = catchAsync(async (req, res) => {
  const admin = await adminService.register(req, req.body);
  res.status(201).json({ status: 1, message: 'Admin registered successfully', admin });
});

export const loginAdmin = catchAsync(async (req, res) => {
  const result = await adminService.login(req.body);
  res.status(200).json(result);
});

export const getAdminProfile = catchAsync(async (req, res) => {
  const admin = await adminService.updateProfile(req.user._id, req.body);
  res.json({ status: 1, data: admin }); // populated by `auth` middleware
});

export const updateAdminProfile = catchAsync(async (req, res) => {
  const updatedAdmin = await adminService.updateProfile(req.user._id, req.body);
  res.json({ status: 1, data: updatedAdmin });
});

export const getPendingApprovals = catchAsync(async (req, res) => {
  const counts = await adminService.getPendingApprovalsCount();

  res.status(200).json({
    status: 1,
    message: 'Pending approvals fetched successfully',
    data: counts
  });
});

export const getInProgressProjects = catchAsync(async (req, res) => {
  console.log('getInProgressProjects controller called');
  const stats = await adminService.getInProgressProjectsStats();
  console.log('In-progress projects stats:', stats);

  res.status(200).json({
    status: 1,
    message: 'In-progress projects stats fetched successfully',
    data: stats
  });
});

export const getDashboardSummary = catchAsync(async (req, res) => {
  const data = await adminService.getDashboardSummary();
  res.status(200).json({
    status: 1,
    message: 'Dashboard summary fetched successfully',
    data,
  });
});
