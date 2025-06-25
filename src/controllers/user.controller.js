import httpStatus from 'http-status';
import pick from '../utils/pick.js';
import ApiError from '../utils/ApiError.js';
import catchAsync from '../utils/catchAsync.js';
import { userService } from '../services/index.js';

const createUser = catchAsync(async (req, res) => {
  const user = await userService.createUser(req.body);
  res.status(httpStatus.CREATED).send({ status: 1, user });
});

const getUsers = catchAsync(async (req, res) => {
  const filter = pick(req.query, ['name', 'role', 'experience', 'region', 'education', 'isActive']);
  if (filter.role && typeof filter.role === 'string') {
    filter.role = filter.role.split(',').map(role => role.trim());
  }
  const options = pick(req.query, ['sortBy', 'limit', 'page']);
  const result = await userService.queryUsers(filter, options);
  res.send({ status: 1, ...result });
});

const getUser = catchAsync(async (req, res) => {
  const user = await userService.getUserById(req.params.userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  res.send({ status: 1, user });
});

const updateUser = catchAsync(async (req, res) => {
  const user = await userService.updateUserById(req.params.userId, req.body);
  res.send({ status: 1, user });
});

const deleteUser = catchAsync(async (req, res) => {
  await userService.deleteUserById(req.params.userId);
  res.status(httpStatus.NO_CONTENT).send();
});

const searchUsers = catchAsync(async (req, res) => {
  const filter = pick(req.body, ['name', 'role', 'experience', 'region', 'education']);
  filter.isActive = true; // Always filter for active users
  const options = pick(req.body, ['sortBy', 'limit', 'page']);
  const result = await userService.queryUsers(filter, options);
  res.send({ status: 1, ...result });
});

export const activateUserController = catchAsync(async (req, res) => {
  const user = await userService.activateUser(req.params.userId);
  res.send({ status: 1, user });
});

export const deactivateUserController = catchAsync(async (req, res) => {
  const user = await userService.deactivateUser(req.params.userId);
  res.send({ status: 1, user });
});

export const exportUsersController = catchAsync(async (req, res) => {
  const filter = pick(req.query, ['name', 'role', 'isActive']);

  if (filter.role && typeof filter.role === 'string') {
    filter.role = filter.role.split(',').map(role => role.trim());
  }

  // Only apply isActive filter if it's explicitly provided in the query
  if (req.query.isActive !== undefined && req.query.isActive !== null) {
    filter.isActive = req.query.isActive === 'true';
  } else {
    delete filter.isActive;
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

  const fileBuffer = await userService.exportUsersService(filter);

  if (!fileBuffer) {
    throw new ApiError(httpStatus.NOT_FOUND, 'No users found for the selected criteria.');
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `users-${timestamp}.xlsx`;

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.send(fileBuffer);
});

const getMySiteVisits = catchAsync(async (req, res) => {
  const visits = await userService.getMySiteVisits(req.user.id);
  res.send({ status: 1, results: visits });
});

const getSiteEngineers = catchAsync(async (req, res) => {
  const filter = pick(req.query, ['name']);
  const options = pick(req.query, ['sortBy', 'limit', 'page']);
  // a site engineer should be active to be assigned a task
  const result = await userService.queryUsers({ ...filter, role: 'site-engineer', isActive: true }, options);
  res.send({ status: 1, ...result });
});

export {
  createUser,
  getUsers,
  getUser,
  updateUser,
  deleteUser,
  searchUsers,
  getMySiteVisits,
  getSiteEngineers,
};
