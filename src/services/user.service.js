import httpStatus from 'http-status';
import path from 'path';
import User from '../models/user.model.js';
import ApiError from '../utils/ApiError.js';
import storage from '../factory/storage.factory.js';
import logger from '../config/logger.js';
import xlsx from 'xlsx';
import { SiteVisit, CustomerLead } from '../models/index.js';
import { logActivity } from '../middlewares/activityLog.middleware.js';

/**
 * Create a user
 * @param {Object} userBody
 * @returns {Promise<User>}
 */
export const createUser = async (req, userBody) => {
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

  // Log the user creation activity
  try {
    await logActivity(req, {
      action: 'create',
      targetModel: 'User',
      targetId: user._id,
      targetName: user.name,
      description: `Created user: ${user.name} (${user.email}) with role: ${user.role}`,
      metadata: {
        userData: {
          name: user.name,
          email: user.email,
          role: user.role,
          phoneNumber: user.phoneNumber,
          state: user.state,
          city: user.city,
          region: user.region,
          address: user.address,
          education: user.education,
          experience: user.experience,
          isActive: user.isActive
        },
        profilePictureUploaded: !!profilePictureKey,
        profilePictureKey: user.profilePicture,
        documentsCount: user.documents ? user.documents.length : 0,
        createdBy: req.user?.id,
        createdByModel: req.user?.role === 'admin' ? 'Admin' : 'User'
      }
    });
  } catch (error) {
    console.error('Error logging user creation:', error);
  }

  // Log profile picture upload if there was one
  if (profilePictureKey && user.profilePicture) {
    try {
      await logActivity(req, {
        action: 'upload',
        targetModel: 'File',
        targetId: user.profilePicture,
        targetName: `Profile picture for ${user.name}`,
        description: `Uploaded profile picture for user: ${user.name} (${user.email})`,
        metadata: {
          userId: user._id,
          userName: user.name,
          userEmail: user.email,
          fileData: {
            fileType: 'image',
            originalKey: profilePictureKey,
            permanentKey: user.profilePicture,
            uploadedAt: new Date()
          },
          uploadedBy: req.user?.id,
          uploadedByModel: req.user?.role === 'admin' ? 'Admin' : 'User'
        }
      });
    } catch (error) {
      console.error('Error logging profile picture upload:', error);
    }
  }

  // Log document uploads if there are any
  if (user.documents && user.documents.length > 0) {
    for (const document of user.documents) {
      try {
        await logActivity(req, {
          action: 'upload',
          targetModel: 'File',
          targetId: document.key,
          targetName: `Document for ${user.name}`,
          description: `Uploaded document (${document.fileType}) for user: ${user.name} (${user.email})`,
          metadata: {
            userId: user._id,
            userName: user.name,
            userEmail: user.email,
            fileData: {
              fileType: document.fileType,
              key: document.key,
              uploadedAt: document.uploadedAt || new Date()
            },
            uploadedBy: req.user?.id,
            uploadedByModel: req.user?.role === 'admin' ? 'Admin' : 'User'
          }
        });
      } catch (error) {
        console.error('Error logging document upload:', error);
      }
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

  const users = await User.find(query).sort(sortOption).skip(skip).limit(limit).populate('createdBy', 'name email role').select('name email role createdBy isActive experience education phoneNumber city state region address profilePicture documents');
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
export const updateUserById = async (req, userId, updateBody) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  if (updateBody.email && (await User.isEmailTaken(updateBody.email, userId))) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already taken');
  }

  // Store original user data for change detection
  const originalUser = { ...user.toObject() };

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

  // Detect changes in user data
  const userChanges = {};
  Object.keys(restOfBody).forEach(key => {
    if (originalUser[key] !== restOfBody[key]) {
      userChanges[key] = {
        from: originalUser[key],
        to: restOfBody[key]
      };
    }
  });

  // Log the user update activity
  try {
    await logActivity(req, {
      action: 'update',
      targetModel: 'User',
      targetId: user._id,
      targetName: user.name,
      description: `Updated user: ${user.name} (${user.email})`,
      changes: userChanges,
      metadata: {
        userData: {
          name: user.name,
          email: user.email,
          role: user.role,
          phoneNumber: user.phoneNumber,
          state: user.state,
          city: user.city,
          region: user.region,
          address: user.address,
          education: user.education,
          experience: user.experience,
          isActive: user.isActive
        },
        originalUserData: {
          name: originalUser.name,
          email: originalUser.email,
          role: originalUser.role,
          phoneNumber: originalUser.phoneNumber,
          state: originalUser.state,
          city: originalUser.city,
          region: originalUser.region,
          address: originalUser.address,
          education: originalUser.education,
          experience: originalUser.experience,
          isActive: originalUser.isActive
        },
        profilePictureUpdated: !!profilePictureKey,
        oldProfilePicture: originalUser.profilePicture,
        newProfilePicture: user.profilePicture,
        documentsCount: user.documents ? user.documents.length : 0,
        updatedFields: Object.keys(userChanges),
        updatedBy: req.user?.id,
        updatedByModel: req.user?.role === 'admin' ? 'Admin' : 'User'
      }
    });
  } catch (error) {
    console.error('Error logging user update:', error);
  }

  // Log profile picture update if there was one
  if (profilePictureKey && user.profilePicture) {
    try {
      await logActivity(req, {
        action: 'update',
        targetModel: 'File',
        targetId: user.profilePicture,
        targetName: `Profile picture for ${user.name}`,
        description: `Updated profile picture for user: ${user.name} (${user.email})`,
        changes: {
          profilePicture: {
            from: originalUser.profilePicture,
            to: user.profilePicture
          }
        },
        metadata: {
          userId: user._id,
          userName: user.name,
          userEmail: user.email,
          fileData: {
            fileType: 'image',
            originalKey: profilePictureKey,
            permanentKey: user.profilePicture,
            oldKey: originalUser.profilePicture,
            uploadedAt: new Date()
          },
          updatedBy: req.user?.id,
          updatedByModel: req.user?.role === 'admin' ? 'Admin' : 'User'
        }
      });
    } catch (error) {
      console.error('Error logging profile picture update:', error);
    }
  }

  return user;
};

/**
 * Delete user by id
 * @param {ObjectId} userId
 * @returns {Promise<User>}
 */
export const deleteUserById = async (req, userId) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  // Store user data for logging before deletion
  const userData = {
    name: user.name,
    email: user.email,
    role: user.role,
    phoneNumber: user.phoneNumber,
    state: user.state,
    city: user.city,
    region: user.region,
    address: user.address,
    education: user.education,
    experience: user.experience,
    isActive: user.isActive,
    profilePicture: user.profilePicture,
    documentsCount: user.documents ? user.documents.length : 0
  };

  // Before deleting user, consider deleting their profile picture from storage
  if (user.profilePicture) {
    await storage.deleteFile(user.profilePicture).catch((e) => logger.error(`Non-critical: Failed to delete profile picture for deleted user ${userId}. Error: ${e.message}`));
  }

  await user.deleteOne();

  // Log the user deletion activity
  try {
    await logActivity(req, {
      action: 'delete',
      targetModel: 'User',
      targetId: userId,
      targetName: userData.name,
      description: `Deleted user: ${userData.name} (${userData.email}) with role: ${userData.role}`,
      changes: {
        userDeleted: {
          from: userData,
          to: null
        }
      },
      metadata: {
        userData: userData,
        profilePictureDeleted: !!user.profilePicture,
        profilePictureKey: user.profilePicture,
        documentsCount: userData.documentsCount,
        deletedBy: req.user?.id,
        deletedByModel: req.user?.role === 'admin' ? 'Admin' : 'User',
        deletedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Error logging user deletion:', error);
  }

  // Log profile picture deletion if there was one
  if (user.profilePicture) {
    try {
      await logActivity(req, {
        action: 'delete',
        targetModel: 'File',
        targetId: user.profilePicture,
        targetName: `Profile picture for ${userData.name}`,
        description: `Deleted profile picture for user: ${userData.name} (${userData.email})`,
        changes: {
          fileDeleted: {
            from: {
              fileType: 'image',
              key: user.profilePicture,
              originalName: `Profile picture for ${userData.name}`
            },
            to: null
          }
        },
        metadata: {
          userId: userId,
          userName: userData.name,
          userEmail: userData.email,
          fileData: {
            fileType: 'image',
            key: user.profilePicture,
            deletedAt: new Date()
          },
          deletedBy: req.user?.id,
          deletedByModel: req.user?.role === 'admin' ? 'Admin' : 'User'
        }
      });
    } catch (error) {
      console.error('Error logging profile picture deletion:', error);
    }
  }

  // Log document deletions if there are any
  if (user.documents && user.documents.length > 0) {
    for (const document of user.documents) {
      try {
        await logActivity(req, {
          action: 'delete',
          targetModel: 'File',
          targetId: document.key,
          targetName: `Document for ${userData.name}`,
          description: `Deleted document (${document.fileType}) for user: ${userData.name} (${userData.email})`,
          changes: {
            fileDeleted: {
              from: {
                fileType: document.fileType,
                key: document.key,
                originalName: `Document for ${userData.name}`
              },
              to: null
            }
          },
          metadata: {
            userId: userId,
            userName: userData.name,
            userEmail: userData.email,
            fileData: {
              fileType: document.fileType,
              key: document.key,
              deletedAt: new Date()
            },
            deletedBy: req.user?.id,
            deletedByModel: req.user?.role === 'admin' ? 'Admin' : 'User'
          }
        });
      } catch (error) {
        console.error('Error logging document deletion:', error);
      }
    }
  }

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


export const activateUser = async (req, userId) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  const originalStatus = user.isActive;
  user.isActive = true;
  await user.save();

  // Log the user activation activity
  try {
    await logActivity(req, {
      action: 'activate',
      targetModel: 'User',
      targetId: user._id,
      targetName: user.name,
      description: `Activated user: ${user.name} (${user.email})`,
      changes: {
        isActive: {
          from: originalStatus,
          to: true
        }
      },
      metadata: {
        userData: {
          name: user.name,
          email: user.email,
          role: user.role,
          phoneNumber: user.phoneNumber,
          state: user.state,
          city: user.city,
          region: user.region,
          address: user.address,
          education: user.education,
          experience: user.experience
        },
        previousStatus: originalStatus,
        newStatus: true,
        statusChange: true,
        activatedBy: req.user?.id,
        activatedByModel: req.user?.role === 'admin' ? 'Admin' : 'User',
        activatedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Error logging user activation:', error);
  }

  return user;
};

export const deactivateUser = async (req, userId) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  const originalStatus = user.isActive;
  user.isActive = false;
  await user.save();

  // Log the user deactivation activity
  try {
    await logActivity(req, {
      action: 'deactivate',
      targetModel: 'User',
      targetId: user._id,
      targetName: user.name,
      description: `Deactivated user: ${user.name} (${user.email})`,
      changes: {
        isActive: {
          from: originalStatus,
          to: false
        }
      },
      metadata: {
        userData: {
          name: user.name,
          email: user.email,
          role: user.role,
          phoneNumber: user.phoneNumber,
          state: user.state,
          city: user.city,
          region: user.region,
          address: user.address,
          education: user.education,
          experience: user.experience
        },
        previousStatus: originalStatus,
        newStatus: false,
        statusChange: true,
        deactivatedBy: req.user?.id,
        deactivatedByModel: req.user?.role === 'admin' ? 'Admin' : 'User',
        deactivatedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Error logging user deactivation:', error);
  }

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

export const createWorkerBySiteEngineerService = async (req, data, siteEngineerId) => {
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

  const worker = await User.create(data);

  // Log the worker creation activity
  try {
    await logActivity(req, {
      action: 'create',
      targetModel: 'User',
      targetId: worker._id,
      targetName: worker.name,
      description: `Created ${data.role}: ${worker.name} (${worker.email}) by site engineer: ${siteEngineer.name}`,
      changes: {
        role: {
          from: null,
          to: data.role
        },
        isActive: {
          from: null,
          to: data.isActive !== undefined ? data.isActive : true
        },
        createdBy: {
          from: null,
          to: siteEngineerId
        }
      },
      metadata: {
        workerData: {
          name: worker.name,
          email: worker.email,
          role: worker.role,
          phoneNumber: worker.phoneNumber,
          mobileNumber: worker.mobileNumber,
          city: worker.city,
          region: worker.region,
          address: worker.address,
          education: worker.education,
          experience: worker.experience,
          isActive: worker.isActive,
          createdBy: worker.createdBy
        },
        siteEngineer: {
          userId: siteEngineer._id,
          userName: siteEngineer.name,
          userEmail: siteEngineer.email,
          userRole: siteEngineer.role
        },
        workerCreation: true,
        workerType: data.role,
        createdBy: siteEngineerId,
        createdByModel: 'SiteEngineer',
        createdAt: new Date(),
        profilePictureUploaded: !!data.profilePictureKey,
        documentsCount: data.documents ? data.documents.length : 0
      }
    });

    // Log profile picture upload if present
    if (data.profilePictureKey) {
      await logActivity(req, {
        action: 'upload',
        targetModel: 'User',
        targetId: worker._id,
        targetName: worker.name,
        description: `Uploaded profile picture for ${data.role}: ${worker.name}`,
        changes: {
          profilePictureKey: {
            from: null,
            to: data.profilePictureKey
          }
        },
        metadata: {
          workerData: {
            name: worker.name,
            email: worker.email,
            role: worker.role
          },
          siteEngineer: {
            userId: siteEngineer._id,
            userName: siteEngineer.name,
            userEmail: siteEngineer.email
          },
          fileUpload: true,
          fileType: 'profilePicture',
          fileKey: data.profilePictureKey,
          uploadedBy: siteEngineerId,
          uploadedByModel: 'SiteEngineer',
          uploadedAt: new Date()
        }
      });
    }

    // Log document uploads if present
    if (data.documents && data.documents.length > 0) {
      for (const doc of data.documents) {
        await logActivity(req, {
          action: 'upload',
          targetModel: 'User',
          targetId: worker._id,
          targetName: worker.name,
          description: `Uploaded document for ${data.role}: ${worker.name} - ${doc.fileType}`,
          changes: {
            documents: {
              from: null,
              to: doc
            }
          },
          metadata: {
            workerData: {
              name: worker.name,
              email: worker.email,
              role: worker.role
            },
            siteEngineer: {
              userId: siteEngineer._id,
              userName: siteEngineer.name,
              userEmail: siteEngineer.email
            },
            fileUpload: true,
            fileType: doc.fileType,
            fileKey: doc.key,
            uploadedBy: siteEngineerId,
            uploadedByModel: 'SiteEngineer',
            uploadedAt: doc.uploadedAt || new Date()
          }
        });
      }
    }
  } catch (error) {
    console.error('Error logging worker creation:', error);
  }

  return worker;
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

export const updateWorkerBySiteEngineerService = async (req, workerId, siteEngineerId, data) => {
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

  // Store original worker data for change detection
  const originalWorker = {
    name: worker.name,
    email: worker.email,
    role: worker.role,
    phoneNumber: worker.phoneNumber,
    mobileNumber: worker.mobileNumber,
    city: worker.city,
    region: worker.region,
    address: worker.address,
    education: worker.education,
    experience: worker.experience,
    isActive: worker.isActive,
    profilePictureKey: worker.profilePictureKey,
    documents: worker.documents ? [...worker.documents] : []
  };

  const updatedWorker = await User.findByIdAndUpdate(workerId, data, { new: true });

  // Detect changes for logging
  const changes = {};
  const updatedFields = [];

  // Check for changes in each field
  if (data.name !== undefined && data.name !== originalWorker.name) {
    changes.name = { from: originalWorker.name, to: data.name };
    updatedFields.push('name');
  }
  if (data.email !== undefined && data.email !== originalWorker.email) {
    changes.email = { from: originalWorker.email, to: data.email };
    updatedFields.push('email');
  }
  if (data.role !== undefined && data.role !== originalWorker.role) {
    changes.role = { from: originalWorker.role, to: data.role };
    updatedFields.push('role');
  }
  if (data.phoneNumber !== undefined && data.phoneNumber !== originalWorker.phoneNumber) {
    changes.phoneNumber = { from: originalWorker.phoneNumber, to: data.phoneNumber };
    updatedFields.push('phoneNumber');
  }
  if (data.mobileNumber !== undefined && data.mobileNumber !== originalWorker.mobileNumber) {
    changes.mobileNumber = { from: originalWorker.mobileNumber, to: data.mobileNumber };
    updatedFields.push('mobileNumber');
  }
  if (data.city !== undefined && data.city !== originalWorker.city) {
    changes.city = { from: originalWorker.city, to: data.city };
    updatedFields.push('city');
  }
  if (data.region !== undefined && data.region !== originalWorker.region) {
    changes.region = { from: originalWorker.region, to: data.region };
    updatedFields.push('region');
  }
  if (data.address !== undefined && data.address !== originalWorker.address) {
    changes.address = { from: originalWorker.address, to: data.address };
    updatedFields.push('address');
  }
  if (data.education !== undefined && data.education !== originalWorker.education) {
    changes.education = { from: originalWorker.education, to: data.education };
    updatedFields.push('education');
  }
  if (data.experience !== undefined && data.experience !== originalWorker.experience) {
    changes.experience = { from: originalWorker.experience, to: data.experience };
    updatedFields.push('experience');
  }
  if (data.isActive !== undefined && data.isActive !== originalWorker.isActive) {
    changes.isActive = { from: originalWorker.isActive, to: data.isActive };
    updatedFields.push('isActive');
  }

  // Log the worker update activity
  try {
    await logActivity(req, {
      action: 'update',
      targetModel: 'User',
      targetId: worker._id,
      targetName: worker.name,
      description: `Updated ${worker.role}: ${worker.name} (${worker.email}) by site engineer: ${siteEngineer.name}`,
      changes,
      metadata: {
        workerData: {
          name: updatedWorker.name,
          email: updatedWorker.email,
          role: updatedWorker.role,
          phoneNumber: updatedWorker.phoneNumber,
          mobileNumber: updatedWorker.mobileNumber,
          city: updatedWorker.city,
          region: updatedWorker.region,
          address: updatedWorker.address,
          education: updatedWorker.education,
          experience: updatedWorker.experience,
          isActive: updatedWorker.isActive,
          createdBy: updatedWorker.createdBy
        },
        originalWorkerData: originalWorker,
        siteEngineer: {
          userId: siteEngineer._id,
          userName: siteEngineer.name,
          userEmail: siteEngineer.email,
          userRole: siteEngineer.role
        },
        workerUpdate: true,
        workerType: updatedWorker.role,
        updatedFields,
        fieldsChanged: updatedFields.length,
        updatedBy: siteEngineerId,
        updatedByModel: 'SiteEngineer',
        updatedAt: new Date(),
        profilePictureUpdated: data.profilePictureKey !== undefined,
        documentsUpdated: data.documents !== undefined
      }
    });

    // Log profile picture update if present
    if (data.profilePictureKey !== undefined && data.profilePictureKey !== originalWorker.profilePictureKey) {
      await logActivity(req, {
        action: 'upload',
        targetModel: 'User',
        targetId: worker._id,
        targetName: worker.name,
        description: `Updated profile picture for ${updatedWorker.role}: ${worker.name}`,
        changes: {
          profilePictureKey: {
            from: originalWorker.profilePictureKey,
            to: data.profilePictureKey
          }
        },
        metadata: {
          workerData: {
            name: updatedWorker.name,
            email: updatedWorker.email,
            role: updatedWorker.role
          },
          siteEngineer: {
            userId: siteEngineer._id,
            userName: siteEngineer.name,
            userEmail: siteEngineer.email
          },
          fileUpload: true,
          fileType: 'profilePicture',
          fileKey: data.profilePictureKey,
          oldFileKey: originalWorker.profilePictureKey,
          uploadedBy: siteEngineerId,
          uploadedByModel: 'SiteEngineer',
          uploadedAt: new Date()
        }
      });
    }

    // Log document updates if present
    if (data.documents !== undefined) {
      const originalDocKeys = originalWorker.documents.map(doc => doc.key);
      const newDocKeys = data.documents.map(doc => doc.key);

      // Find added documents
      const addedDocs = data.documents.filter(doc => !originalDocKeys.includes(doc.key));
      // Find removed documents
      const removedDocs = originalWorker.documents.filter(doc => !newDocKeys.includes(doc.key));
      // Find updated documents
      const updatedDocs = data.documents.filter(doc => {
        const originalDoc = originalWorker.documents.find(orig => orig.key === doc.key);
        return originalDoc && (originalDoc.fileType !== doc.fileType || originalDoc.uploadedAt !== doc.uploadedAt);
      });

      // Log added documents
      for (const doc of addedDocs) {
        await logActivity(req, {
          action: 'upload',
          targetModel: 'User',
          targetId: worker._id,
          targetName: worker.name,
          description: `Added document for ${updatedWorker.role}: ${worker.name} - ${doc.fileType}`,
          changes: {
            documents: {
              from: null,
              to: doc
            }
          },
          metadata: {
            workerData: {
              name: updatedWorker.name,
              email: updatedWorker.email,
              role: updatedWorker.role
            },
            siteEngineer: {
              userId: siteEngineer._id,
              userName: siteEngineer.name,
              userEmail: siteEngineer.email
            },
            fileUpload: true,
            fileType: doc.fileType,
            fileKey: doc.key,
            uploadedBy: siteEngineerId,
            uploadedByModel: 'SiteEngineer',
            uploadedAt: doc.uploadedAt || new Date()
          }
        });
      }

      // Log removed documents
      for (const doc of removedDocs) {
        await logActivity(req, {
          action: 'delete',
          targetModel: 'User',
          targetId: worker._id,
          targetName: worker.name,
          description: `Removed document for ${updatedWorker.role}: ${worker.name} - ${doc.fileType}`,
          changes: {
            documents: {
              from: doc,
              to: null
            }
          },
          metadata: {
            workerData: {
              name: updatedWorker.name,
              email: updatedWorker.email,
              role: updatedWorker.role
            },
            siteEngineer: {
              userId: siteEngineer._id,
              userName: siteEngineer.name,
              userEmail: siteEngineer.email
            },
            fileDeletion: true,
            fileType: doc.fileType,
            fileKey: doc.key,
            deletedBy: siteEngineerId,
            deletedByModel: 'SiteEngineer',
            deletedAt: new Date()
          }
        });
      }

      // Log updated documents
      for (const doc of updatedDocs) {
        const originalDoc = originalWorker.documents.find(orig => orig.key === doc.key);
        await logActivity(req, {
          action: 'update',
          targetModel: 'User',
          targetId: worker._id,
          targetName: worker.name,
          description: `Updated document for ${updatedWorker.role}: ${worker.name} - ${doc.fileType}`,
          changes: {
            documents: {
              from: originalDoc,
              to: doc
            }
          },
          metadata: {
            workerData: {
              name: updatedWorker.name,
              email: updatedWorker.email,
              role: updatedWorker.role
            },
            siteEngineer: {
              userId: siteEngineer._id,
              userName: siteEngineer.name,
              userEmail: siteEngineer.email
            },
            fileUpdate: true,
            fileType: doc.fileType,
            fileKey: doc.key,
            updatedBy: siteEngineerId,
            updatedByModel: 'SiteEngineer',
            updatedAt: new Date()
          }
        });
      }
    }
  } catch (error) {
    console.error('Error logging worker update:', error);
  }

  return updatedWorker;
};

export const activateWorkerBySiteEngineerService = async (req, workerId, siteEngineerId) => {
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

  const originalStatus = worker.isActive;
  const updatedWorker = await User.findByIdAndUpdate(workerId, { isActive: true }, { new: true });

  // Log the worker activation activity
  try {
    await logActivity(req, {
      action: 'activate',
      targetModel: 'User',
      targetId: worker._id,
      targetName: worker.name,
      description: `Activated worker: ${worker.name} (${worker.email}) by site engineer: ${siteEngineer.name}`,
      changes: {
        isActive: {
          from: originalStatus,
          to: true
        }
      },
      metadata: {
        workerData: {
          name: worker.name,
          email: worker.email,
          role: worker.role,
          phoneNumber: worker.phoneNumber,
          city: worker.city,
          region: worker.region,
          address: worker.address,
          education: worker.education,
          experience: worker.experience
        },
        siteEngineer: {
          userId: siteEngineer._id,
          userName: siteEngineer.name,
          userEmail: siteEngineer.email,
          userRole: siteEngineer.role
        },
        previousStatus: originalStatus,
        newStatus: true,
        statusChange: true,
        workerActivation: true,
        activatedBy: siteEngineerId,
        activatedByModel: 'SiteEngineer',
        activatedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Error logging worker activation:', error);
  }

  return updatedWorker;
};

export const deactivateWorkerBySiteEngineerService = async (req, workerId, siteEngineerId) => {
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

  const originalStatus = worker.isActive;
  const updatedWorker = await User.findByIdAndUpdate(workerId, { isActive: false }, { new: true });

  // Log the worker deactivation activity
  try {
    await logActivity(req, {
      action: 'deactivate',
      targetModel: 'User',
      targetId: worker._id,
      targetName: worker.name,
      description: `Deactivated worker: ${worker.name} (${worker.email}) by site engineer: ${siteEngineer.name}`,
      changes: {
        isActive: {
          from: originalStatus,
          to: false
        }
      },
      metadata: {
        workerData: {
          name: worker.name,
          email: worker.email,
          role: worker.role,
          phoneNumber: worker.phoneNumber,
          city: worker.city,
          region: worker.region,
          address: worker.address,
          education: worker.education,
          experience: worker.experience
        },
        siteEngineer: {
          userId: siteEngineer._id,
          userName: siteEngineer.name,
          userEmail: siteEngineer.email,
          userRole: siteEngineer.role
        },
        previousStatus: originalStatus,
        newStatus: false,
        statusChange: true,
        workerDeactivation: true,
        deactivatedBy: siteEngineerId,
        deactivatedByModel: 'SiteEngineer',
        deactivatedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Error logging worker deactivation:', error);
  }

  return updatedWorker;
};

export const resetUserPasswordById = async (req, userId, newPassword) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  // Store original user data for logging
  const originalUser = {
    name: user.name,
    email: user.email,
    role: user.role,
    phoneNumber: user.phoneNumber,
    mobileNumber: user.mobileNumber,
    city: user.city,
    region: user.region,
    address: user.address,
    education: user.education,
    experience: user.experience,
    isActive: user.isActive,
    createdBy: user.createdBy
  };

  user.password = newPassword;
  await user.save();

  // Log the password reset activity
  try {
    await logActivity(req, {
      action: 'reset_password',
      targetModel: 'User',
      targetId: user._id,
      targetName: user.name,
      description: `Password reset for user: ${user.name} (${user.email}) by ${req.user?.role === 'admin' ? 'Admin' : req.user?.role === 'sales-admin' ? 'Sales Admin' : 'Site Engineer'}: ${req.user?.name}`,
      changes: {
        password: {
          from: '[HIDDEN]',
          to: '[RESET]'
        }
      },
      metadata: {
        userData: {
          name: user.name,
          email: user.email,
          role: user.role,
          phoneNumber: user.phoneNumber,
          mobileNumber: user.mobileNumber,
          city: user.city,
          region: user.region,
          address: user.address,
          education: user.education,
          experience: user.experience,
          isActive: user.isActive,
          createdBy: user.createdBy
        },
        originalUserData: originalUser,
        resetBy: {
          userId: req.user?._id,
          userName: req.user?.name,
          userEmail: req.user?.email,
          userRole: req.user?.role
        },
        passwordReset: true,
        userType: user.role,
        resetByRole: req.user?.role,
        resetAt: new Date(),
        passwordChanged: true,
        securityAction: true
      }
    });
  } catch (error) {
    console.error('Error logging password reset:', error);
  }

  return user;
};

/**
 * Get all SCP users for dropdown
 * @returns {Promise<Array>}
 */
export const getScpUsersService = async (filter, options) => {
  const { limit = 50, page = 1, sortBy } = options;
  const skip = (page - 1) * limit;

  const sortOption = sortBy ? { [sortBy.split(':')[0]]: sortBy.split(':')[1] === 'desc' ? -1 : 1 } : { createdAt: -1 };

  // Build optimized filter with partial search for region
  const optimizedFilter = { role: 'scp-user', isActive: true };

  // Add exact matches for state and city if provided
  if (filter.state) {
    optimizedFilter.state = filter.state;
  }
  if (filter.city) {
    optimizedFilter.city = filter.city;
  }

  // Add partial search for region if provided
  if (filter.region) {
    optimizedFilter.region = { $regex: filter.region, $options: 'i' };
  }

  // Add name search if provided
  if (filter.name) {
    optimizedFilter.name = { $regex: filter.name, $options: 'i' };
  }

  const scpUsers = await User.find(optimizedFilter)
    .select('name email role isActive state city region')
    .sort(sortOption)
    .skip(skip)
    .limit(limit)
    .lean();

  return scpUsers;
};
