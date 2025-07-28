import httpStatus from 'http-status';
import path from 'path';
import User from '../models/user.model.js';
import ApiError from '../utils/ApiError.js';
import storage from '../factory/storage.factory.js';
import logger from '../config/logger.js';
import xlsx from 'xlsx';
import { SiteVisit, CustomerLead } from '../models/index.js';

/**
 * Create a user
 * @param {Object} userBody
 * @returns {Promise<User>}
 */
export const createUser = async (userBody) => {
  if (await User.isEmailTaken(userBody.email)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already taken');
  }

  const { profilePictureKey, ...restOfBody } = userBody;
  const user = await User.create(restOfBody);

  // Handle profile picture upload, similar to the old architect service
  if (profilePictureKey) {
    try {
      const fileExtension = path.extname(profilePictureKey);
      // More generic path for user profile pictures
      const permanentKey = `users/${user._id}/profile-picture${fileExtension}`;

      await storage.copyFile(profilePictureKey, permanentKey);
      user.profilePicture = permanentKey;
      await user.save();

      // Clean up the temporary file
      await storage.deleteFile(profilePictureKey).catch((e) => logger.error(`Non-critical: Failed to delete temp file ${profilePictureKey}. Error: ${e.message}`));
    } catch (error) {
      logger.error(`Failed to process profile picture for user ${user._id}: ${error.message}`);
      // If file processing fails, we should ideally roll back user creation.
      // For now, we'll throw an error. If wrapped in a transaction, this would trigger a rollback.
      await User.findByIdAndDelete(user._id);
      throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to process profile picture.');
    }
  }

  return user;
};

/**
 * Query for users
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @param {string} [options.sortBy] - Sort option in the format: field:desc/asc
 * @param {number} [options.limit] - Maximum number of results per page (default = 10)
 * @param {number} [options.page] - Current page (default = 1)
 * @returns {Promise<Object>}
 */
export const queryUsers = async (filter, options) => {
  const { limit = 10, page = 1, sortBy } = options;
  const skip = (page - 1) * limit;

  const query = {};

  // Build the query dynamically for flexible, case-insensitive searching
  Object.keys(filter).forEach(key => {
    const value = filter[key];
    // This condition ensures that we filter on truthy values, but also when a value is explicitly `false` (for the isActive filter).
    // It correctly ignores `null`, `undefined`, and empty strings.
    if (value || value === false) {
      if (key === 'role' && Array.isArray(value)) {
        // Use $in for an array of roles, ensuring case-insensitivity
        query[key] = { $in: value.map(role => new RegExp(`^${role}$`, 'i')) };
      } else if (['name', 'experience', 'region', 'education'].includes(key)) {
        query[key] = { $regex: value, $options: 'i' };
      } else {
        query[key] = value;
      }
    }
  });

  const sortOption = sortBy ? { [sortBy.split(':')[0]]: sortBy.split(':')[1] === 'desc' ? -1 : 1 } : { createdAt: -1 };

  const users = await User.find(query).sort(sortOption).skip(skip).limit(limit).populate('createdBy', 'name email role').select('name email role createdBy isActive experience education phoneNumber city region address profilePicture ');
  const totalResults = await User.countDocuments(query);

  return {
    results: users,
    page,
    limit,
    totalPages: Math.ceil(totalResults / limit),
    totalResults,
  };
};

/**
 * Get user by ID
 * @param {ObjectId} id
 * @returns {Promise<User>}
 */
export const getUserById = async (id) => {
  return User.findById(id);
};

/**
 * Get user by email
 * @param {string} email
 * @returns {Promise<User>}
 */
export const getUserByEmail = async (email) => {
  return User.findOne({ email });
};

/**
 * Update user by ID
 * @param {ObjectId} userId
 * @param {Object} updateBody
 * @returns {Promise<User>}
 */
export const updateUserById = async (userId, updateBody) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  if (updateBody.email && (await User.isEmailTaken(updateBody.email, userId))) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already taken');
  }

  const { profilePictureKey, ...restOfBody } = updateBody;
  Object.assign(user, restOfBody);

  // Handle new profile picture upload
  if (profilePictureKey) {
    const oldProfilePicture = user.profilePicture;
    try {
      const fileExtension = path.extname(profilePictureKey);
      const permanentKey = `users/${user._id}/profile-picture${fileExtension}`;
      await storage.copyFile(profilePictureKey, permanentKey);
      user.profilePicture = permanentKey;

      await storage.deleteFile(profilePictureKey).catch((e) => logger.error(`Non-critical: Failed to delete temp file: ${e.message}`));
      if (oldProfilePicture) {
        await storage.deleteFile(oldProfilePicture).catch((e) => logger.error(`Non-critical: Failed to delete old profile picture: ${e.message}`));
      }
    } catch (error) {
      logger.error(`Failed to process new profile picture for user ${user._id}: ${error.message}`);
      throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to process new profile picture.');
    }
  }

  await user.save();
  return user;
};

/**
 * Delete user by id
 * @param {ObjectId} userId
 * @returns {Promise<User>}
 */
export const deleteUserById = async (userId) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  // Before deleting user, consider deleting their profile picture from storage
  if (user.profilePicture) {
    await storage.deleteFile(user.profilePicture).catch((e) => logger.error(`Non-critical: Failed to delete profile picture for deleted user ${userId}. Error: ${e.message}`));
  }
  await user.deleteOne();
  return user;
};

/**
 * Get site visits assigned to a user
 * @param {ObjectId} userId
 * @returns {Promise<SiteVisit[]>}
 */
export const getMySiteVisits = async (userId) => {
  // 1. Fetch all visits assigned to the user
  const visits = await SiteVisit.find({ siteEngineer: userId })
    .populate('siteEngineer', 'name role')
    .populate({
      path: 'requirement',
      populate: {
        path: 'lead',
        select: 'customerName mobileNumber email state city'
      }
    })
    .populate({
      path: 'requirement',
      populate: {
        path: 'project',
        select: 'projectName status'
      }
    })
    .sort({ visitDate: -1 })
    .lean();

  if (!visits.length) return [];

  // 2. Format response with lead and requirement attached
  const formattedVisits = visits.map(visit => {
    const requirement = visit.requirement || {};
    const lead = requirement.lead || null;

    return {
      ...visit,
      lead: lead ? {
        _id: lead._id,
        customerName: lead.customerName,
        mobileNumber: lead.mobileNumber,
        email: lead.email,
        state: lead.state,
        city: lead.city,
      } : null,
      requirement,
    };
  });

  return formattedVisits;
};


export const activateUser = async (userId) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  user.isActive = true;
  await user.save();
  return user;
};

export const deactivateUser = async (userId) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  user.isActive = false;
  await user.save();
  return user;
};

export const exportUsersService = async (filter = {}) => {
  const users = await User.find(filter).lean();

  if (users.length === 0) {
    return null;
  }

  const worksheetData = users.map((user) => ({
    Name: user.name,
    Email: user.email,
    Role: user.role,
    'Phone Number': user.phoneNumber,
    City: user.city,
    Region: user.region,
    Address: user.address,
    Education: user.education,
    Experience: user.experience,
    'Active Status': user.isActive ? 'Active' : 'Inactive',
    'Email Verified': user.isEmailVerified ? 'Yes' : 'No',
    'Joined Date': user.createdAt,
  }));

  const worksheet = xlsx.utils.json_to_sheet(worksheetData);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, 'Users');

  // Set date format for the 'Joined Date' column
  worksheet['!cols'] = [{ wch: 25 }, { wch: 30 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 30 }, { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 20 }];
  users.forEach((_user, index) => {
    const cellRef = xlsx.utils.encode_cell({ c: 11, r: index + 1 });
    if (worksheet[cellRef]) {
      worksheet[cellRef].z = 'yyyy-mm-dd';
    }
  });


  return xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};

export const createWorkerBySiteEngineerService = async (data, siteEngineerId) => {
  // Validate that the creator is a site engineer
  const siteEngineer = await User.findById(siteEngineerId);
  if (!siteEngineer || siteEngineer.role !== 'site-engineer') {
    throw new ApiError(httpStatus.FORBIDDEN, 'Only site engineers can create workers');
  }

  // Ensure the user being created has worker or fabricator role
  if (!['worker', 'fabricator'].includes(data.role)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Site engineers can only create workers or fabricators');
  }

  // Set the createdBy field to the site engineer
  data.createdBy = siteEngineerId;

  return User.create(data);
};

export const getWorkersBySiteEngineerService = async (siteEngineerId, query) => {
  const { page = 1, limit = 10, role, name, email, mobileNumber, isActive } = query;
  const filter = {
    createdBy: siteEngineerId,
    role: { $in: ['worker', 'fabricator'] }
  };

  // if (role) filter.role = role;
  if (name) filter.name = { $regex: name, $options: 'i' };
  if (email) filter.email = { $regex: email, $options: 'i' };
  if (mobileNumber) filter.mobileNumber = { $regex: mobileNumber, $options: 'i' };
  if (isActive !== undefined) filter.isActive = isActive === 'true' || isActive === true;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [users, total] = await Promise.all([
    User.find(filter)
      .select('name email mobileNumber role isActive createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    User.countDocuments(filter)
  ]);

  return {
    data: users,
    page: parseInt(page),
    limit: parseInt(limit),
    total,
    totalPages: Math.ceil(total / parseInt(limit)),
  };
};

export const updateWorkerBySiteEngineerService = async (workerId, siteEngineerId, data) => {
  // Validate that the updater is a site engineer
  const siteEngineer = await User.findById(siteEngineerId);
  if (!siteEngineer || siteEngineer.role !== 'site-engineer') {
    throw new ApiError(httpStatus.FORBIDDEN, 'Only site engineers can update workers');
  }

  // Check if the worker was created by this site engineer
  const worker = await User.findById(workerId);
  if (!worker || worker.createdBy.toString() !== siteEngineerId) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You can only update workers you created');
  }

  // Ensure the role remains worker or fabricator
  if (data.role && !['worker', 'fabricator'].includes(data.role)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Site engineers can only assign worker or fabricator roles');
  }

  return User.findByIdAndUpdate(workerId, data, { new: true });
};

export const activateWorkerBySiteEngineerService = async (workerId, siteEngineerId) => {
  // Validate that the activator is a site engineer
  const siteEngineer = await User.findById(siteEngineerId);
  if (!siteEngineer || siteEngineer.role !== 'site-engineer') {
    throw new ApiError(httpStatus.FORBIDDEN, 'Only site engineers can activate workers');
  }

  // Check if the worker was created by this site engineer
  const worker = await User.findById(workerId);
  if (!worker || worker.createdBy.toString() !== siteEngineerId) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You can only activate workers you created');
  }

  return User.findByIdAndUpdate(workerId, { isActive: true }, { new: true });
};

export const deactivateWorkerBySiteEngineerService = async (workerId, siteEngineerId) => {
  // Validate that the deactivator is a site engineer
  const siteEngineer = await User.findById(siteEngineerId);
  if (!siteEngineer || siteEngineer.role !== 'site-engineer') {
    throw new ApiError(httpStatus.FORBIDDEN, 'Only site engineers can deactivate workers');
  }

  // Check if the worker was created by this site engineer
  const worker = await User.findById(workerId);
  if (!worker || worker.createdBy.toString() !== siteEngineerId) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You can only deactivate workers you created');
  }

  return User.findByIdAndUpdate(workerId, { isActive: false }, { new: true });
};

export const resetUserPasswordById = async (userId, newPassword) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  user.password = newPassword;
  await user.save();
  return user;
};
