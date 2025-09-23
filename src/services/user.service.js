import httpStatus from 'http-status';
import path from 'path';
import mongoose from 'mongoose';
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
      } else if (['state', 'city'].includes(key)) {
        // Use exact matching for state and city (case-insensitive)
        query[key] = { $regex: `^${value}$`, $options: 'i' };
      } else {
        query[key] = value;
      }
    }
  });

  const sortOption = sortBy ? { [sortBy.split(':')[0]]: sortBy.split(':')[1] === 'desc' ? -1 : 1 } : { createdAt: -1 };

  const users = await User.find(query).sort(sortOption).skip(skip).limit(limit).populate('createdBy', 'name email role').select('name email role subRole createdBy isActive experience education phoneNumber city state region address profilePicture documents');
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

export const exportUsersService = async (filter = {}, selectedFields = []) => {
  const users = await User.find(filter).lean();

  if (users.length === 0) {
    return null;
  }

  // Default fields if none selected
  const defaultFields = [
    'name', 'email', 'role', 'phoneNumber', 'city', 'region', 'address',
    'education', 'experience', 'isActive', 'isEmailVerified', 'createdAt'
  ];

  const fieldsToExport = selectedFields.length > 0 ? selectedFields : defaultFields;

  const worksheetData = users.map((user) => {
    const row = {};

    if (fieldsToExport.includes('name')) row.Name = user.name;
    if (fieldsToExport.includes('email')) row.Email = user.email;
    if (fieldsToExport.includes('role')) row.Role = user.role;
    if (fieldsToExport.includes('subRole')) row['Custom Role'] = user.subRole || '';
    if (fieldsToExport.includes('phoneNumber')) row['Phone Number'] = user.phoneNumber;
    if (fieldsToExport.includes('mobileNumber')) row['Mobile Number'] = user.mobileNumber;
    if (fieldsToExport.includes('state')) row.State = user.state;
    if (fieldsToExport.includes('city')) row.City = user.city;
    if (fieldsToExport.includes('region')) row.Region = user.region;
    if (fieldsToExport.includes('address')) row.Address = user.address;
    if (fieldsToExport.includes('education')) row.Education = user.education;
    if (fieldsToExport.includes('experience')) row.Experience = user.experience;
    if (fieldsToExport.includes('isActive')) row['Active Status'] = user.isActive ? 'Active' : 'Inactive';
    if (fieldsToExport.includes('isEmailVerified')) row['Email Verified'] = user.isEmailVerified ? 'Yes' : 'No';
    if (fieldsToExport.includes('createdAt')) row['Created Date'] = user.createdAt;
    if (fieldsToExport.includes('createdBy')) row['Created By'] = user.createdBy;

    return row;
  });

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

  // Ensure the user being created has custom role only
  if (data.role !== 'custom') {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Site engineers can only create custom role users');
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
    role: { $in: ['worker', 'fabricator', 'custom'] }
  };

  // if (role) filter.role = role;
  if (name) filter.name = { $regex: name, $options: 'i' };
  if (email) filter.email = { $regex: email, $options: 'i' };
  if (mobileNumber) filter.mobileNumber = { $regex: mobileNumber, $options: 'i' };
  if (isActive !== undefined) filter.isActive = isActive === 'true' || isActive === true;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [users, total] = await Promise.all([
    User.find(filter)
      .select('_id name email mobileNumber role subRole state city region address phoneNumber education experience isActive createdAt documents')
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

  // Ensure the role remains worker, fabricator, or custom
  if (data.role && !['worker', 'fabricator', 'custom'].includes(data.role)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Site engineers can only assign worker, fabricator, or custom roles');
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

// Generate sample users CSV for import
export const generateSampleUsersCSV = () => {
  const sampleData = [
    // Headers with field type indicators
    [
      'name (MANDATORY)',
      'email (MANDATORY)',
      'password (MANDATORY)',
      'role (MANDATORY)',
      'subRole (OPTIONAL)',
      'phoneNumber (OPTIONAL)',
      'state (OPTIONAL)',
      'city (OPTIONAL)',
      'region (OPTIONAL)',
      'address (OPTIONAL)',
      'education (OPTIONAL)',
      'experience (OPTIONAL)'
    ],
    // Field options and validation rules
    [
      'Enter Full Name',
      'Enter Email Address',
      'Auto-generated as FirstName@123',
      'architect, planning-engineer, site-engineer, scp-user, fabricator, worker, custom',
      'Enter custom role if role is "custom"',
      'Enter Phone Number',
      'Maharashtra, Karnataka, Delhi, Gujarat, Tamil Nadu, etc.',
      'Mumbai, Bangalore, New Delhi, Ahmedabad, Chennai, etc.',
      'Enter Region/Area',
      'Enter Full Address',
      'Enter Education Details',
      'Enter Experience Details'
    ],
    // Sample data row 1 - Architect
    [
      'John Smith',
      'john.smith@example.com',
      'John@123',
      'architect',
      '',
      '9876543210',
      'Maharashtra',
      'Mumbai',
      'Andheri',
      '123 Main Street, Andheri West',
      'B.Arch from IIT',
      '5 years experience'
    ],
    // Sample data row 2 - Site Engineer
    [
      'Jane Doe',
      'jane.doe@example.com',
      'Jane@123',
      'site-engineer',
      '',
      '9876543211',
      'Karnataka',
      'Bangalore',
      'Whitefield',
      '456 Tech Park, Whitefield',
      'B.E Civil Engineering',
      '3 years experience'
    ],
    // Sample data row 3 - Custom Role
    [
      'Mike Johnson',
      'mike.johnson@example.com',
      'Mike@123',
      'custom',
      'Fitter',
      '9876543212',
      'Delhi',
      'New Delhi',
      'Connaught Place',
      '789 Business Center, CP',
      'ITI Fitter',
      '2 years experience'
    ],
    // Sample data row 4 - Worker
    [
      'Sarah Wilson',
      'sarah.wilson@example.com',
      'Sarah@123',
      'worker',
      '',
      '9876543213',
      'Gujarat',
      'Ahmedabad',
      'Vastrapur',
      '321 Industrial Area, Vastrapur',
      'High School',
      '1 year experience'
    ]
  ];

  const worksheet = xlsx.utils.aoa_to_sheet(sampleData);

  // Set column widths for better readability
  const columnWidths = [
    { wch: 20 }, // name
    { wch: 30 }, // email
    { wch: 20 }, // password
    { wch: 20 }, // role
    { wch: 20 }, // subRole
    { wch: 18 }, // phoneNumber
    { wch: 20 }, // state
    { wch: 20 }, // city
    { wch: 20 }, // region
    { wch: 40 }, // address
    { wch: 30 }, // education
    { wch: 30 }  // experience
  ];

  worksheet['!cols'] = columnWidths;

  // Add data validation for dropdown options
  const dataValidation = [];

  // Role dropdown (Column D)
  dataValidation.push({
    ref: 'D3:D1000', // Apply to all data rows
    type: 'list',
    allowBlank: false,
    showDropDown: true,
    formula1: '"architect,planning-engineer,site-engineer,scp-user,fabricator,worker,custom"'
  });

  // State dropdown (Column G) - Major Indian states
  dataValidation.push({
    ref: 'G3:G1000',
    type: 'list',
    allowBlank: true,
    showDropDown: true,
    formula1: '"Maharashtra,Karnataka,Delhi,Gujarat,Tamil Nadu,West Bengal,Uttar Pradesh,Rajasthan,Madhya Pradesh,Andhra Pradesh,Telangana,Kerala,Punjab,Haryana,Bihar,Odisha,Assam,Chhattisgarh,Jharkhand,Uttarakhand,Himachal Pradesh,Tripura,Meghalaya,Manipur,Nagaland,Goa,Arunachal Pradesh,Mizoram,Sikkim"'
  });

  // Apply data validation to worksheet
  worksheet['!dataValidation'] = dataValidation;

  // Style the header row (row 1) and options row (row 2)
  const headerRow = 1;
  const optionsRow = 2;

  // Apply styling to header row
  for (let col = 0; col < sampleData[0].length; col++) {
    const cellRef = xlsx.utils.encode_cell({ r: headerRow - 1, c: col });
    if (!worksheet[cellRef]) continue;

    worksheet[cellRef].s = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "366092" } },
      alignment: { horizontal: "center", vertical: "center" }
    };
  }

  // Apply styling to options row
  for (let col = 0; col < sampleData[1].length; col++) {
    const cellRef = xlsx.utils.encode_cell({ r: optionsRow - 1, c: col });
    if (!worksheet[cellRef]) continue;

    worksheet[cellRef].s = {
      font: { italic: true, color: { rgb: "666666" } },
      fill: { fgColor: { rgb: "F2F2F2" } },
      alignment: { horizontal: "center", vertical: "center" }
    };
  }

  // Create a helper sheet with all dropdown options
  const helperData = [
    ['Field', 'Options', 'Description'],
    ['Role', 'architect, planning-engineer, site-engineer, scp-user, fabricator, worker, custom', 'Select the user role'],
    ['State', 'Maharashtra, Karnataka, Delhi, Gujarat, Tamil Nadu, West Bengal, Uttar Pradesh, Rajasthan, Madhya Pradesh, Andhra Pradesh, Telangana, Kerala, Punjab, Haryana, Bihar, Odisha, Assam, Chhattisgarh, Jharkhand, Uttarakhand, Himachal Pradesh, Tripura, Meghalaya, Manipur, Nagaland, Goa, Arunachal Pradesh, Mizoram, Sikkim', 'Select the state where the user is located'],
    ['Password', 'Auto-generated as "FirstName@123"', 'Password will be auto-generated from first name'],
    ['Custom Role', 'Enter custom role if role is "custom"', 'Only required when role is set to "custom"'],
    ['', '', ''],
    ['Instructions:', '', ''],
    ['1. Use the dropdowns in the main sheet for accurate data entry', '', ''],
    ['2. All MANDATORY fields must be filled', '', ''],
    ['3. OPTIONAL fields can be left empty', '', ''],
    ['4. Passwords will be auto-generated as "FirstName@123"', '', ''],
    ['5. Save as CSV or XLSX format for import', '', '']
  ];

  const helperWorksheet = xlsx.utils.aoa_to_sheet(helperData);

  // Set column widths for helper sheet
  helperWorksheet['!cols'] = [
    { wch: 20 }, // Field
    { wch: 80 }, // Options
    { wch: 50 }  // Description
  ];

  // Style the helper sheet
  const helperHeaderRow = 1;
  for (let col = 0; col < 3; col++) {
    const cellRef = xlsx.utils.encode_cell({ r: helperHeaderRow - 1, c: col });
    if (helperWorksheet[cellRef]) {
      helperWorksheet[cellRef].s = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "366092" } },
        alignment: { horizontal: "center", vertical: "center" }
      };
    }
  }

  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, 'Users Sample');
  xlsx.utils.book_append_sheet(workbook, helperWorksheet, 'Field Options & Help');

  return xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};

// Import users from Excel/CSV file
export const importUsersService = async (filePath, req) => {
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(worksheet, { header: 1, cellDates: true, raw: false });

  // Check if req.user exists, if not use a default admin user ID
  const createdBy = req?.user?.id || '000000000000000000000000'; // Default admin ID
  const createdByModel = req?.user?.role === 'Admin' ? 'Admin' : 'User';

  if (data.length < 2) {
    return { importedCount: 0, errors: [] };
  }

  const headers = data[0];
  const headerMapping = normalizeUserHeaders(headers);
  // Skip the first row (headers) and second row (options/instructions)
  const rows = data.slice(2);

  const errors = [];
  const usersToCreate = [];

  // Role validation options
  const validRoles = ['architect', 'planning-engineer', 'site-engineer', 'scp-user', 'fabricator', 'worker', 'custom'];

  rows.forEach((row, index) => {
    const getVal = (fieldName) => {
      const colIndex = headerMapping[fieldName];
      if (colIndex === undefined) return undefined;
      const cellValue = row[colIndex];
      if (cellValue === null || cellValue === undefined) return undefined;
      if (cellValue instanceof Date) {
        return cellValue;
      }
      return cellValue.toString().trim();
    };

    // Get required fields
    const name = getVal('name');
    const email = getVal('email');
    const password = getVal('password');
    const role = getVal('role');
    const subRole = getVal('subRole');
    const phoneNumber = getVal('phoneNumber');
    const state = getVal('state');
    const city = getVal('city');
    const region = getVal('region');
    const address = getVal('address');
    const education = getVal('education');
    const experience = getVal('experience');

    // Validate required fields
    if (!name) {
      errors.push({ row: index + 3, error: 'Missing name. Name is required.' });
      return;
    }

    if (!email) {
      errors.push({ row: index + 3, error: 'Missing email. Email is required.' });
      return;
    }

    if (!role) {
      errors.push({ row: index + 3, error: 'Missing role. Role is required.' });
      return;
    }

    if (!validRoles.includes(role)) {
      errors.push({ row: index + 3, error: `Invalid role: ${role}. Must be one of: ${validRoles.join(', ')}.` });
      return;
    }

    if (role === 'custom' && !subRole) {
      errors.push({ row: index + 3, error: 'Missing subRole. Custom role requires subRole field.' });
      return;
    }

    // Generate password if not provided
    const finalPassword = password || generateUserPassword(name);

    // Create user object
    const userData = {
      name,
      email,
      password: finalPassword,
      role,
      subRole: role === 'custom' ? subRole : undefined,
      phoneNumber: phoneNumber || undefined,
      state: state || undefined,
      city: city || undefined,
      region: region || undefined,
      address: address || undefined,
      education: education || undefined,
      experience: experience || undefined,
      isActive: true,
      createdBy,
      createdByModel
    };

    // Remove undefined values
    const cleanedUserData = Object.fromEntries(
      Object.entries(userData).filter(([_, value]) => value !== undefined)
    );

    usersToCreate.push(cleanedUserData);
  });

  if (errors.length > 0) {
    return { importedCount: 0, errors };
  }

  // Create users in database
  let importedCount = 0;
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      for (const userData of usersToCreate) {
        // Check if user already exists
        const existingUser = await User.findOne({ email: userData.email });
        if (existingUser) {
          errors.push({
            row: usersToCreate.indexOf(userData) + 3,
            error: `User with email ${userData.email} already exists.`
          });
          continue;
        }

        // Create user
        const user = await User.create([userData], { session });
        importedCount++;
      }
    });
  } finally {
    session.endSession();
  }

  return { importedCount, errors };
};

// Export workers for site engineers

export const exportWorkersBySiteEngineerService = async (filter = {}, siteEngineerId, selectedFields = []) => {
  // Filter workers created by this site engineer with custom roles
  const workersFilter = {
    ...filter,
    createdBy: siteEngineerId,
    role: { $in: ['custom'] }
  };

  const workers = await User.find(workersFilter).lean();

  if (workers.length === 0) {
    return null;
  }

  // Default fields if none selected
  const defaultFields = [
    'name', 'email', 'role', 'subRole', 'phoneNumber', 'state', 'city', 'region',
    'address', 'education', 'experience', 'isActive', 'isEmailVerified', 'createdAt'
  ];

  const fieldsToExport = selectedFields.length > 0 ? selectedFields : defaultFields;

  const worksheetData = workers.map((worker) => {
    const row = {};

    if (fieldsToExport.includes('name')) row.Name = worker.name;
    if (fieldsToExport.includes('email')) row.Email = worker.email;
    if (fieldsToExport.includes('role')) row.Role = worker.role;
    if (fieldsToExport.includes('subRole')) row['Custom Role'] = worker.subRole || '';
    if (fieldsToExport.includes('phoneNumber')) row['Phone Number'] = worker.phoneNumber;
    if (fieldsToExport.includes('mobileNumber')) row['Mobile Number'] = worker.mobileNumber;
    if (fieldsToExport.includes('state')) row.State = worker.state;
    if (fieldsToExport.includes('city')) row.City = worker.city;
    if (fieldsToExport.includes('region')) row.Region = worker.region;
    if (fieldsToExport.includes('address')) row.Address = worker.address;
    if (fieldsToExport.includes('education')) row.Education = worker.education;
    if (fieldsToExport.includes('experience')) row.Experience = worker.experience;
    if (fieldsToExport.includes('isActive')) row['Active Status'] = worker.isActive ? 'Active' : 'Inactive';
    if (fieldsToExport.includes('isEmailVerified')) row['Email Verified'] = worker.isEmailVerified ? 'Yes' : 'No';
    if (fieldsToExport.includes('createdAt')) row['Created Date'] = worker.createdAt ? new Date(worker.createdAt) : '';
    if (fieldsToExport.includes('createdBy')) row['Created By'] = worker.createdBy;

    return row;
  });

  const worksheet = xlsx.utils.json_to_sheet(worksheetData, {
    header: [
      'Name', 'Email', 'Role', 'Custom Role', 'Phone Number', 'State', 'City',
      'Region', 'Address', 'Education', 'Experience', 'Active Status',
      'Email Verified', 'Created Date'
    ]
  });

  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, 'Workers');

  // Set column widths
  worksheet['!cols'] = [
    { wch: 25 }, // Name
    { wch: 30 }, // Email
    { wch: 15 }, // Role
    { wch: 20 }, // Custom Role
    { wch: 20 }, // Phone Number
    { wch: 15 }, // State
    { wch: 15 }, // City
    { wch: 15 }, // Region
    { wch: 30 }, // Address
    { wch: 20 }, // Education
    { wch: 20 }, // Experience
    { wch: 15 }, // Active Status
    { wch: 15 }, // Email Verified
    { wch: 20 }  // Created Date
  ];

  // Apply date format to the Created Date column (index 13 = column N)
  workers.forEach((_worker, index) => {
    const cellRef = xlsx.utils.encode_cell({ c: 13, r: index + 1 }); // row +1 to skip header
    if (worksheet[cellRef]) {
      worksheet[cellRef].t = 'd'; // explicitly mark as date
      worksheet[cellRef].z = 'yyyy-mm-dd';
    }
  });

  return xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};

// Helper function to normalize user headers
const normalizeUserHeaders = (headers) => {
  const headerMap = {
    name: ['name', 'full name', 'fullname'],
    email: ['email', 'email address'],
    password: ['password'],
    role: ['role'],
    subRole: ['subrole', 'sub role', 'custom role'],
    phoneNumber: ['phonenumber', 'phone number', 'phone', 'mobile'],
    state: ['state'],
    city: ['city'],
    region: ['region'],
    address: ['address'],
    education: ['education'],
    experience: ['experience']
  };

  const mapping = {};
  headers.forEach((header, index) => {
    // Clean header by removing (MANDATORY), (OPTIONAL) tags and extra spaces
    const cleanHeader = header.toLowerCase()
      .replace(/\s*\(mandatory\)\s*/gi, '')
      .replace(/\s*\(optional\)\s*/gi, '')
      .replace(/\s+/g, '')
      .trim();

    for (const key in headerMap) {
      if (headerMap[key].includes(cleanHeader)) {
        mapping[key] = index;
      }
    }
  });
  return mapping;
};

// Helper function to generate user password
const generateUserPassword = (name) => {
  if (!name) return 'User@123';
  const firstWord = name.trim().split(' ')[0];
  return `${firstWord}@123`;
};

// Generate sample workers CSV for site engineer import
export const generateSampleWorkersCSV = () => {
  const sampleData = [
    // Headers with field type indicators
    [
      'name (MANDATORY)',
      'email (MANDATORY)',
      'password (MANDATORY)',
      'role (MANDATORY)',
      'subRole (OPTIONAL)',
      'phoneNumber (OPTIONAL)',
      'state (OPTIONAL)',
      'city (OPTIONAL)',
      'region (OPTIONAL)',
      'address (OPTIONAL)',
      'education (OPTIONAL)',
      'experience (OPTIONAL)'
    ],
    // Field options and validation rules
    [
      'Enter Full Name',
      'Enter Email Address',
      'Auto-generated as FirstName@123',
      'custom (MANDATORY)',
      'Enter custom role (MANDATORY)',
      'Enter Phone Number',
      'Maharashtra, Karnataka, Delhi, Gujarat, Tamil Nadu, etc.',
      'Mumbai, Bangalore, New Delhi, Ahmedabad, Chennai, etc.',
      'Enter Region/Area',
      'Enter Full Address',
      'Enter Education Details',
      'Enter Experience Details'
    ],
    // Sample data row 1 - Custom Role: Welder
    [
      'Rajesh Kumar',
      'rajesh.kumar@example.com',
      'Rajesh@123',
      'custom',
      'Welder',
      '9876543210',
      'Maharashtra',
      'Mumbai',
      'Andheri',
      '123 Industrial Area, Andheri West',
      'ITI Welder',
      '3 years experience'
    ],
    // Sample data row 2 - Custom Role: Fitter
    [
      'Priya Sharma',
      'priya.sharma@example.com',
      'Priya@123',
      'custom',
      'Fitter',
      '9876543211',
      'Karnataka',
      'Bangalore',
      'Whitefield',
      '456 Tech Park, Whitefield',
      'ITI Fitter',
      '2 years experience'
    ],
    // Sample data row 3 - Custom Role: Electrician
    [
      'Amit Singh',
      'amit.singh@example.com',
      'Amit@123',
      'custom',
      'Electrician',
      '9876543212',
      'Delhi',
      'New Delhi',
      'Connaught Place',
      '789 Business Center, CP',
      'ITI Electrician',
      '4 years experience'
    ],
    // Sample data row 4 - Custom Role: Painter
    [
      'Sunita Patel',
      'sunita.patel@example.com',
      'Sunita@123',
      'custom',
      'Painter',
      '9876543213',
      'Gujarat',
      'Ahmedabad',
      'Vastrapur',
      '321 Industrial Area, Vastrapur',
      'High School',
      '1 year experience'
    ]
  ];

  const worksheet = xlsx.utils.aoa_to_sheet(sampleData);

  // Set column widths for better readability
  const columnWidths = [
    { wch: 20 }, // name
    { wch: 25 }, // email
    { wch: 20 }, // password
    { wch: 15 }, // role
    { wch: 15 }, // subRole
    { wch: 15 }, // phoneNumber
    { wch: 15 }, // state
    { wch: 15 }, // city
    { wch: 15 }, // region
    { wch: 30 }, // address
    { wch: 20 }, // education
    { wch: 20 }  // experience
  ];
  worksheet['!cols'] = columnWidths;

  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, 'Workers Sample');

  return xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};

// Import workers from Excel/CSV file (Site Engineer only)
export const importWorkersBySiteEngineerService = async (filePath, req) => {
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(worksheet, { header: 1, cellDates: true, raw: false });

  // Validate that the creator is a site engineer
  const siteEngineerId = req?.user?.id;
  if (!siteEngineerId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Authentication required');
  }

  const siteEngineer = await User.findById(siteEngineerId);
  if (!siteEngineer || siteEngineer.role !== 'site-engineer') {
    throw new ApiError(httpStatus.FORBIDDEN, 'Only site engineers can import workers');
  }

  if (data.length < 2) {
    return { importedCount: 0, errors: [] };
  }

  const headers = data[0];
  const headerMapping = normalizeUserHeaders(headers);
  // Skip the first row (headers) and second row (options/instructions)
  const rows = data.slice(2);

  const errors = [];
  const workersToCreate = [];

  // Role validation options for site engineers (only custom)
  const validRoles = ['custom'];

  rows.forEach((row, index) => {
    const getVal = (fieldName) => {
      const colIndex = headerMapping[fieldName];
      if (colIndex === undefined) return undefined;
      const cellValue = row[colIndex];
      if (cellValue === null || cellValue === undefined) return undefined;
      if (cellValue instanceof Date) {
        return cellValue;
      }
      return cellValue.toString().trim();
    };

    // Get required fields
    const name = getVal('name');
    const email = getVal('email');
    const password = getVal('password');
    const role = getVal('role');
    const subRole = getVal('subRole');
    const phoneNumber = getVal('phoneNumber');
    const state = getVal('state');
    const city = getVal('city');
    const region = getVal('region');
    const address = getVal('address');
    const education = getVal('education');
    const experience = getVal('experience');

    // Validate required fields
    if (!name) {
      errors.push({ row: index + 3, error: 'Missing name. Name is required.' });
      return;
    }

    if (!email) {
      errors.push({ row: index + 3, error: 'Missing email. Email is required.' });
      return;
    }

    if (!role) {
      errors.push({ row: index + 3, error: 'Missing role. Role is required.' });
      return;
    }

    if (!validRoles.includes(role)) {
      errors.push({ row: index + 3, error: `Invalid role: ${role}. Site engineers can only create custom role users.` });
      return;
    }

    if (role === 'custom' && !subRole) {
      errors.push({ row: index + 3, error: 'Missing subRole. Custom role requires subRole field.' });
      return;
    }

    // Generate password if not provided
    const finalPassword = password || generateUserPassword(name);

    // Create worker object
    const workerData = {
      name,
      email,
      password: finalPassword,
      role,
      subRole: role === 'custom' ? subRole : undefined,
      phoneNumber: phoneNumber || undefined,
      state: state || undefined,
      city: city || undefined,
      region: region || undefined,
      address: address || undefined,
      education: education || undefined,
      experience: experience || undefined,
      isActive: true,
      createdBy: siteEngineerId,
      createdByModel: 'User'
    };

    // Remove undefined values
    const cleanedWorkerData = Object.fromEntries(
      Object.entries(workerData).filter(([_, value]) => value !== undefined)
    );

    workersToCreate.push(cleanedWorkerData);
  });

  if (errors.length > 0) {
    return { importedCount: 0, errors };
  }

  // Create workers in database
  let importedCount = 0;
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      for (const workerData of workersToCreate) {
        // Check if worker already exists
        const existingWorker = await User.findOne({ email: workerData.email });
        if (existingWorker) {
          errors.push({
            row: workersToCreate.indexOf(workerData) + 3,
            error: `Worker with email ${workerData.email} already exists.`
          });
          continue;
        }

        // Create worker
        const worker = await User.create([workerData], { session });
        importedCount++;

        // Log the worker creation activity
        try {
          await logActivity(req, {
            action: 'create',
            targetModel: 'User',
            targetId: worker[0]._id,
            targetName: worker[0].name,
            description: `Imported ${workerData.role}: ${worker[0].name} (${worker[0].email}) by site engineer: ${siteEngineer.name}`,
            changes: {
              role: {
                from: null,
                to: workerData.role
              },
              isActive: {
                from: null,
                to: true
              }
            }
          });
        } catch (logError) {
          console.error('Error logging worker import activity:', logError);
        }
      }
    });
  } finally {
    session.endSession();
  }

  return { importedCount, errors };
};
