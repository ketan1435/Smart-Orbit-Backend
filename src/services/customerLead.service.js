import xlsx from 'xlsx';
import CustomerLead from '../models/customerLead.model.js';
import ApiError from '../utils/ApiError.js';
import httpStatus from 'http-status';
import storage from '../factory/storage.factory.js';
import mongoose from 'mongoose';
import logger from '../config/logger.js';
import { createCustomerLead, updateCustomerLead } from '../validations/customerLead.validation.js';
import { createProject, sendDocumentToProcurement } from './project.service.js';
import Requirement from '../models/requirement.model.js';
import User from '../models/user.model.js';
import SiteVisit from '../models/siteVisit.model.js';
import Project from '../models/project.model.js';
import { roles } from '../config/roles.js';
import Roles from '../config/enums/roles.enum.js';
import { createUser } from './user.service.js';
import ProjectAssignmentPayment from '../models/projectAssignmentPaymant.model.js';
import { STATUS_ENUM, STATUS_VALUES } from '../config/enums/status.enum.js';
import { updateCustomerStatusWithCascade } from './statusCascade.service.js';


export const createCustomerLeadService = async (req, session) => {
  const { body: leadData } = req;
  const tempFileKeysToDelete = [];
  const { requirements, ...basicLeadInfo } = leadData;

  const requirementIds = [];

  // 1. Create the CustomerLead first
  const { town, ...restBasicLeadInfo } = basicLeadInfo;
  const leadPayload = {
    ...restBasicLeadInfo,
    townVillage: town || restBasicLeadInfo.townVillage, // Map town to townVillage
    createdBy: req.user.id,
    createdByModel: req.user.role === 'Admin' ? 'Admin' : 'User',
    status: basicLeadInfo.status || STATUS_ENUM.INPROGRESS, // Default to inprogress for new customers
    requirements: [], // will update after creating Requirement docs
  };

  const lead = (await CustomerLead.create([leadPayload], { session }))[0];

  // 2. Process each requirement separately
  for (const reqData of requirements) {
    const requirementId = new mongoose.Types.ObjectId();
    const files = [];

    const fileKeys = {
      imageUrlKeys: reqData.imageUrlKeys || [],
      videoUrlKeys: reqData.videoUrlKeys || [],
      voiceMessageUrlKeys: reqData.voiceMessageUrlKeys || [],
      sketchUrlKeys: reqData.sketchUrlKeys || [],
    };

    for (const [type, keys] of Object.entries(fileKeys)) {
      for (const tempKey of keys) {
        const fileType = type.replace('UrlKeys', '');
        const fileName = tempKey.split('/').pop();
        const permanentKey = `customer-leads/${lead._id}/${requirementId}/${fileType}/${fileName}`;
        await storage.copyFile(tempKey, permanentKey);
        files.push({ fileType, key: permanentKey });
        tempFileKeysToDelete.push(tempKey);
      }
    }

    // 3. Create Requirement document
    const requirement = await Requirement.create([{
      _id: requirementId,
      lead: lead._id,
      projectName: reqData.projectName,
      requirementType: reqData.requirementType,
      otherRequirement: reqData.otherRequirement,
      requirementDescription: reqData.requirementDescription,
      urgency: reqData.urgency,
      budget: reqData.budget,
      scpData: reqData.scpData || {},
      files,
      sharedWith: [],
    }], { session });

    requirementIds.push(requirementId);

    // 4. Create a project and link back to requirement
    const project = await createProject({
      projectName: reqData.projectName,
      requirement: requirementId,
      lead: lead._id,
      budget: reqData.budget ? parseFloat(reqData.budget.replace(/[^0-9.-]+/g, '')) : 0,
      createdBy: req.user.id,
      createdByModel: req.user.constructor.modelName,
    }, session);

    // 5. Update the requirement with the project ID
    await Requirement.findByIdAndUpdate(requirementId, {
      project: project._id,
    }, { session });

    // 5.1 Handle SCP user sharing if sendToScp is true
    if (reqData.sendToScp && reqData.selectedScpUser) {
      console.log('SCP sharing requested:', {
        sendToScp: reqData.sendToScp,
        selectedScpUser: reqData.selectedScpUser,
        requirementId: requirementId.toString()
      });

      // Handle single SCP user (string) or multiple SCP users (array)
      const scpUserIds = Array.isArray(reqData.selectedScpUser)
        ? reqData.selectedScpUser
        : [reqData.selectedScpUser];

      console.log('SCP user IDs to process:', scpUserIds);

      // Validate all SCP users
      for (const scpUserId of scpUserIds) {
        const scpUser = await User.findById(scpUserId).session(session);
        if (!scpUser || scpUser.role !== 'scp-user') {
          throw new ApiError(httpStatus.BAD_REQUEST, `Invalid SCP user ID: ${scpUserId}`);
        }
        console.log(`Validated SCP user: ${scpUser.name} (${scpUser.email})`);
      }

      // Share requirement with all selected SCP users and grant update permissions
      for (const scpUserId of scpUserIds) {
        const result = await Requirement.updateOne(
          { _id: requirementId, 'sharedWith.user': { $ne: scpUserId } },
          {
            $push: {
              sharedWith: {
                user: scpUserId,
                sharedBy: req.user.id,
                sharedAt: new Date(),
                isSeen: false,
                canUpdateScpData: true,
                scpDataUpdated: false
              },
            },
          },
          { session }
        );
        console.log(`Shared requirement with SCP user ${scpUserId}, result:`, result);
      }
    }

    // 5.2 Handle multiple site visits
    const siteVisitsToCreate = [];
    const siteEngineersToShare = new Set();

    // Check for new multiple site visits format
    if (reqData.scpData.siteVisits && Array.isArray(reqData.scpData.siteVisits)) {
      // Process multiple site visits
      for (const siteVisitData of reqData.scpData.siteVisits) {
        // Validate site engineer
        const siteEngineer = await User.findById(siteVisitData.siteEngineer).session(session);
        if (!siteEngineer || siteEngineer.role !== 'site-engineer') {
          throw new ApiError(httpStatus.BAD_REQUEST, `Invalid site engineer ID: ${siteVisitData.siteEngineer}`);
        }

        const siteVisitToCreate = {
          requirement: requirementId,
          project: project._id,
          siteEngineer: siteVisitData.siteEngineer,
          hasRequirementEditAccess: siteVisitData.hasRequirementEditAccess || false,
        };

        // Handle date range or single date
        if (siteVisitData.visitStartDate && siteVisitData.visitEndDate) {
          // Date range scheduling
          siteVisitToCreate.visitStartDate = siteVisitData.visitStartDate;
          siteVisitToCreate.visitEndDate = siteVisitData.visitEndDate;
          siteVisitToCreate.visitDate = siteVisitData.visitStartDate; // For backward compatibility
        } else if (siteVisitData.visitDate) {
          // Single date scheduling (backward compatibility)
          siteVisitToCreate.visitDate = siteVisitData.visitDate;
        } else {
          throw new ApiError(httpStatus.BAD_REQUEST, 'Either visitDate or both visitStartDate and visitEndDate must be provided for site visits');
        }

        siteVisitsToCreate.push(siteVisitToCreate);

        // Add to set for sharing if they have edit access
        if (siteVisitData.hasRequirementEditAccess) {
          siteEngineersToShare.add(siteVisitData.siteEngineer);
        }
      }
    } else if (reqData.scpData.siteEngineer && reqData.scpData.siteVisitDate) {
      // Backward compatibility: single site visit
      const siteEngineer = await User.findById(reqData.scpData.siteEngineer).session(session);
      if (!siteEngineer || siteEngineer.role !== 'site-engineer') {
        throw new ApiError(httpStatus.BAD_REQUEST, `Invalid site engineer ID: ${reqData.scpData.siteEngineer}`);
      }

      siteVisitsToCreate.push({
        requirement: requirementId,
        project: project._id,
        siteEngineer: reqData.scpData.siteEngineer,
        visitDate: reqData.scpData.siteVisitDate,
        hasRequirementEditAccess: true, // Default to true for backward compatibility
      });

      siteEngineersToShare.add(reqData.scpData.siteEngineer);
    }

    // 5.3 Push all site visits to project
    if (siteVisitsToCreate.length > 0) {
      const createdSiteVisits = await SiteVisit.create(siteVisitsToCreate, { session, ordered: true });

      for (const siteVisit of createdSiteVisits) {
        project.siteVisits.push(siteVisit._id);
      }
      await project.save({ session });

      // 5.4 Add site engineers with edit access to requirement.sharedWith
      for (const siteEngineerId of siteEngineersToShare) {
        await Requirement.updateOne(
          { _id: requirementId, 'sharedWith.user': { $ne: siteEngineerId } },
          {
            $push: {
              sharedWith: {
                user: siteEngineerId,
                sharedBy: req.user.id,
              },
            },
          },
          { session }
        );
      }

      // 5.5 Create project assignment payments (mandatory for all site visits)
      for (const siteVisitData of reqData.scpData.siteVisits || []) {
        if (!siteVisitData.assignmentAmount || siteVisitData.assignmentAmount <= 0) {
          throw new ApiError(httpStatus.BAD_REQUEST, 'Assignment amount is required for all site visits');
        }

        const existingPayment = await ProjectAssignmentPayment.findOne({
          project: project._id,
          user: siteVisitData.siteEngineer
        }).session(session);

        if (!existingPayment) {
          // Calculate perDayAmount properly
          let perDayAmount = 1; // Default value

          if (siteVisitData.assignmentAmount) {
            try {
              let daysDiff = 1; // Default to 1 day for single visits

              // Handle date range visits
              if (siteVisitData.visitEndDate && siteVisitData.visitStartDate) {
                const startDate = new Date(siteVisitData.visitStartDate);
                const endDate = new Date(siteVisitData.visitEndDate);

                // Check if dates are valid
                if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
                  const timeDiff = endDate.getTime() - startDate.getTime();
                  daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

                  // Ensure at least 1 day
                  if (daysDiff <= 0) {
                    daysDiff = 1;
                  }
                }
              } else if (siteVisitData.visitDate) {
                // Handle single day visits
                const visitDate = new Date(siteVisitData.visitDate);
                if (!isNaN(visitDate.getTime())) {
                  daysDiff = 1; // Single day visit
                }
              }

              perDayAmount = siteVisitData.assignmentAmount / daysDiff;
            } catch (error) {
              // If there's any error in date calculation, use the full amount
              perDayAmount = siteVisitData.assignmentAmount;
            }
          }

          await ProjectAssignmentPayment.create([{
            project: project._id,
            createdBy: req.user.id,
            createdByModel: req.user.constructor.modelName,
            assignedAmount: siteVisitData.assignmentAmount,
            perDayAmount: perDayAmount,
            note: "Site visit assignment amount",
            user: siteVisitData.siteEngineer
          }], { session });
        }
      }
    }
  }

  // 6. Update the lead with the array of requirement references
  lead.requirements = requirementIds;
  await lead.save({ session });

  // create user if password is provided
  if (leadData.password) {
    await createUser({
      name: leadData.customerName,
      email: leadData.email,
      password: leadData.password,
    });
  }

  // 7. Clean up temp S3 files after commit
  Promise.all(tempFileKeysToDelete.map(key => storage.deleteFile(key))).catch(err => {
    logger.error(`Failed to delete temporary file during cleanup: ${err.message}`);
  });

  return {
    status: httpStatus.CREATED,
    body: { status: 1, message: 'Customer lead created successfully', data: lead },
  };
};

export const listCustomerLeadsService = async (filter = {}, options = {}) => {
  const { limit = 10, page = 1, sortBy } = options;

  let sort;
  if (typeof sortBy === 'string') {
    const [field, order] = sortBy.split(':');
    sort = { [field]: order === 'desc' ? -1 : 1 };
  } else if (typeof sortBy === 'object' && sortBy !== null) {
    sort = sortBy;
  } else {
    sort = { createdAt: -1 };
  }

  const customerLeads = await CustomerLead.find(filter)
    .populate({
      path: 'requirements',
      populate: { path: 'visits' },
    })
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  const totalResults = await CustomerLead.countDocuments(filter);

  return {
    results: customerLeads,
    page,
    limit,
    totalPages: Math.ceil(totalResults / limit),
    totalResults,
  };
};

export const getCustomerLeadByIdService = async (id) => {
  return CustomerLead.findById(id)
    .populate({
      path: 'requirements',
      populate: { path: 'visits' }  // Optional: only if you need visits too
    });
};

export const updateCustomerLeadService = async (req, session) => {
  console.log('=== BACKEND DEBUG: UPDATE CUSTOMER LEAD ===');
  console.log('Request body:', JSON.stringify(req.body, null, 2));
  console.log('Status value:', req.body.status);
  console.log('Status type:', typeof req.body.status);
  console.log('Status length:', req.body.status?.length);
  console.log('Status char codes:', req.body.status?.split('').map(c => c.charCodeAt(0)));
  console.log('==========================================');

  const { id } = req.params;
  const { body: updateBody } = req;
  const lead = await getCustomerLeadByIdService(id);
  if (!lead) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Customer lead not found');
  }

  // Handle town field mapping
  const { town, requirementsToUpdate, ...restUpdateBody } = updateBody;
  if (town !== undefined) {
    restUpdateBody.townVillage = town;
  }

  // Check if status is being updated
  const isStatusUpdate = restUpdateBody.status && restUpdateBody.status !== lead.status;

  // Only allow updating basic fields
  const allowedFields = [
    'leadSource',
    'customerName',
    'mobileNumber',
    'alternateContactNumber',
    'whatsappNumber',
    'email',
    'preferredLanguage',
    'state',
    'city',
    'townVillage',
    'googleLocationLink',
    'status',
  ];

  for (const key of Object.keys(restUpdateBody)) {
    if (allowedFields.includes(key)) {
      lead[key] = restUpdateBody[key];
    }
  }

  // Handle requirement updates if provided
  if (requirementsToUpdate && Array.isArray(requirementsToUpdate)) {
    for (const reqUpdate of requirementsToUpdate) {
      const requirement = await Requirement.findById(reqUpdate._id);
      if (!requirement) {
        throw new ApiError(httpStatus.NOT_FOUND, `Requirement with ID ${reqUpdate._id} not found`);
      }

      // Verify the requirement belongs to this lead
      if (requirement.lead.toString() !== id) {
        throw new ApiError(httpStatus.BAD_REQUEST, `Requirement ${reqUpdate._id} does not belong to this lead`);
      }

      // Update the requirement fields
      const { _id, ...updateFields } = reqUpdate;
      Object.assign(requirement, updateFields);

      await requirement.save({ session });
    }
  }

  // If status is being updated, use cascade logic
  if (isStatusUpdate) {
    const result = await updateCustomerStatusWithCascade(id, restUpdateBody.status, session);
    return {
      status: httpStatus.OK,
      body: {
        status: 1,
        message: `Customer lead updated successfully. ${result.projectsUpdated} projects also updated to status: ${restUpdateBody.status}`,
        data: result.customer,
        projectsUpdated: result.projectsUpdated
      },
    };
  } else {
    // Regular update without status change
    await lead.save({ session });
    return {
      status: httpStatus.OK,
      body: {
        status: 1,
        message: 'Customer lead updated successfully',
        data: lead,
      },
    };
  }
};


export const activateCustomerLeadService = async (id) => {
  const lead = await getCustomerLeadByIdService(id);
  if (!lead) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Customer lead not found');
  }
  lead.status = STATUS_ENUM.ACTIVE;
  await lead.save();
  return lead;
};

export const deactivateCustomerLeadService = async (id) => {
  const lead = await getCustomerLeadByIdService(id);
  if (!lead) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Customer lead not found');
  }
  lead.status = STATUS_ENUM.INACTIVE;
  await lead.save();
  return lead;
};

export const updateCustomerLeadStatusService = async (id, newStatus) => {
  const lead = await getCustomerLeadByIdService(id);
  if (!lead) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Customer lead not found');
  }

  if (!STATUS_VALUES.includes(newStatus)) {
    throw new ApiError(httpStatus.BAD_REQUEST, `Invalid status. Must be one of: ${STATUS_VALUES.join(', ')}`);
  }

  lead.status = newStatus;
  await lead.save();
  return lead;
};

export const updateCustomerAndProjectsStatusService = async (id, newStatus) => {
  const lead = await getCustomerLeadByIdService(id);
  if (!lead) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Customer lead not found');
  }

  if (!STATUS_VALUES.includes(newStatus)) {
    throw new ApiError(httpStatus.BAD_REQUEST, `Invalid status. Must be one of: ${STATUS_VALUES.join(', ')}`);
  }

  // Start a session for transaction
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Update customer lead status
    lead.status = newStatus;
    await lead.save({ session });

    // Find all projects associated with this customer lead
    const projects = await Project.find({ lead: id }).session(session);

    // Update all project statuses based on customer status
    const projectStatusMapping = {
      [STATUS_ENUM.ACTIVE]: STATUS_ENUM.ACTIVE,
      [STATUS_ENUM.INACTIVE]: STATUS_ENUM.CANCELLED,
      [STATUS_ENUM.HOLD]: STATUS_ENUM.HOLD,
      [STATUS_ENUM.COMPLETE]: STATUS_ENUM.COMPLETE,
      [STATUS_ENUM.CANCELLED]: STATUS_ENUM.CANCELLED,
      [STATUS_ENUM.INPROGRESS]: STATUS_ENUM.INPROGRESS,
      [STATUS_ENUM.DRAFT]: STATUS_ENUM.DRAFT,
    };

    const newProjectStatus = projectStatusMapping[newStatus] || STATUS_ENUM.DRAFT;

    // Update all projects
    if (projects.length > 0) {
      await Project.updateMany(
        { lead: id },
        { status: newProjectStatus },
        { session }
      );
    }

    await session.commitTransaction();

    return {
      customer: lead,
      projectsUpdated: projects.length,
      newProjectStatus
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

export const shareRequirementService = async (leadId, requirementId, userIdToShareWith, adminId) => {
  const lead = await getCustomerLeadByIdService(leadId);
  if (!lead) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Customer lead not found');
  }

  const requirement = lead.requirements.id(requirementId);
  if (!requirement) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Requirement not found within the lead');
  }

  const isAlreadyShared = requirement.sharedWith.some(share => share.user.toString() === userIdToShareWith);
  if (isAlreadyShared) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Requirement already shared with this user');
  }

  requirement.sharedWith.push({
    user: userIdToShareWith,
    sharedBy: adminId,
  });

  await lead.save();
  return lead;
};

export const shareRequirementWithUsersService = async (leadId, requirementId, userIds, adminId, documentId = null, shouldSendToEngineer = false) => {
  const requirement = await Requirement.findOne({ _id: requirementId, lead: leadId });
  if (!requirement) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Requirement not found for this lead');
  }

  let updated = false;

  // Check if any of the users are procurement team members
  const users = await User.find({ _id: { $in: userIds } }).select('_id role');
  const procurementUsers = users.filter(user => user.role === 'procurement-team');
  const otherUsers = users.filter(user => user.role !== 'procurement-team');

  // Find the project associated with this requirement
  const project = await Project.findOne({ requirement: requirementId });

  // Handle regular users (non-procurement)
  otherUsers.forEach(user => {
    const alreadyShared = requirement.sharedWith.some(share => share.user.toString() === user._id.toString());
    if (!alreadyShared) {
      requirement.sharedWith.push({
        user: user._id,
        sharedBy: adminId,
        isSeen: false
      });
      updated = true;

      // If user is a site engineer, automatically assign them to the project
      if (user.role === 'site-engineer' && project) {
        // Check if site engineer is not already assigned to this project
        if (!project.assignedSiteEngineer.includes(user._id)) {
          project.assignedSiteEngineer.push(user._id);
          project.save().catch(error => {
            logger.error(`Failed to assign site engineer ${user._id} to project ${project._id}:`, error);
          });
          logger.info(`Automatically assigned site engineer ${user._id} to project ${project._id} via requirement sharing`);
        }
      }
    }
  });

  // Handle procurement team members specially
  if (procurementUsers.length > 0) {
    if (project) {
      // Check if there are any approved architect documents
      const approvedDocuments = project.architectDocuments.filter(doc =>
        doc.adminStatus === 'Approved' && doc.customerStatus === 'Approved'
      );

      if (approvedDocuments.length > 0) {
        // Share requirement with procurement team only if there are approved documents
        procurementUsers.forEach(user => {
          const alreadyShared = requirement.sharedWith.some(share => share.user.toString() === user._id.toString());
          if (!alreadyShared) {
            requirement.sharedWith.push({
              user: user._id,
              sharedBy: adminId,
              isSeen: false
            });
            updated = true;
          }
        });
      } else {
        // Log that procurement sharing was skipped due to no approved documents
        logger.info(`Procurement sharing skipped for requirement ${requirementId}: No approved architect documents found`);
      }
    } else {
      // Log that no project was found
      logger.warn(`No project found for requirement ${requirementId} when sharing with procurement team`);
    }
  }

  if (updated) {
    await requirement.save();
  }

  // Handle automatic document sending to procurement if requested
  if (shouldSendToEngineer && documentId) {
    try {
      if (project) {
        // Verify the document exists and meets criteria
        const document = project.architectDocuments.find(doc =>
          doc._id.toString() === documentId &&
          doc.adminStatus === 'Approved' &&
          doc.customerStatus === 'Approved' &&
          !doc.sentToPlanningEngineer
        );

        if (document) {
          logger.info(`Auto-sending document ${documentId} to procurement for project ${project._id}`);

          // Create admin object for the service
          const admin = { _id: adminId };

          await sendDocumentToProcurement(project._id.toString(), documentId, admin);
          logger.info(`Document ${documentId} successfully sent to procurement`);
        } else {
          logger.warn(`Document ${documentId} not found or doesn't meet criteria for auto-sending to procurement`);
        }
      } else {
        logger.warn(`No project found for requirement ${requirementId} when trying to auto-send document to procurement`);
      }
    } catch (error) {
      logger.error(`Failed to auto-send document ${documentId} to procurement:`, error);
      // Don't throw the error - we don't want to fail the sharing operation because of this
      // The sharing was successful, the auto-send just failed
    }
  }

  return requirement;
};

/**
 * Share requirement with multiple SCP users and grant update permissions
 * @param {string} leadId - The lead ID
 * @param {string} requirementId - The requirement ID
 * @param {Array<string>} scpUserIds - Array of SCP user IDs
 * @param {string} adminId - The admin ID who is sharing
 * @returns {Promise<Object>}
 */
export const shareRequirementWithScpUsersService = async (leadId, requirementId, scpUserIds, adminId) => {
  const requirement = await Requirement.findOne({ _id: requirementId, lead: leadId });
  if (!requirement) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Requirement not found for this lead');
  }

  // Check if all users are SCP users
  const scpUsers = await User.find({ _id: { $in: scpUserIds } });
  if (scpUsers.length !== scpUserIds.length) {
    throw new ApiError(httpStatus.NOT_FOUND, 'One or more SCP users not found');
  }

  // Check if all users are actually SCP users
  const nonScpUsers = scpUsers.filter(user => user.role !== 'scp-user');
  if (nonScpUsers.length > 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, `Users ${nonScpUsers.map(u => u.name).join(', ')} are not SCP users`);
  }

  let updated = false;

  // Process each SCP user
  for (const scpUserId of scpUserIds) {
    // Check if already shared
    const existingShare = requirement.sharedWith.find(share => share.user.toString() === scpUserId);
    if (existingShare) {
      // Update existing share to grant SCP update permissions
      existingShare.canUpdateScpData = true;
      existingShare.sharedBy = adminId;
      existingShare.sharedAt = new Date();
      updated = true;
    } else {
      // Add new share with SCP update permissions
      requirement.sharedWith.push({
        user: scpUserId,
        sharedBy: adminId,
        isSeen: false,
        canUpdateScpData: true,
        scpDataUpdated: false
      });
      updated = true;
    }
  }

  if (updated) {
    await requirement.save();
  }

  return requirement;
};

/**
 * Update SCP data by SCP user (one-time only)
 * @param {string} leadId - The lead ID
 * @param {string} requirementId - The requirement ID
 * @param {string} scpUserId - The SCP user ID
 * @param {Object} scpData - The updated SCP data
 * @returns {Promise<Object>}
 */
export const updateScpDataByScpUserService = async (leadId, requirementId, scpUserId, scpData, files = []) => {
  const requirement = await Requirement.findOne({ _id: requirementId, lead: leadId });
  if (!requirement) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Requirement not found for this lead');
  }

  // Remove permission validation - SCP users now have full access to update SCP data
  // Check if the user is shared with this requirement (but don't require canUpdateScpData permission)
  const userShare = requirement.sharedWith.find(share =>
    share.user.toString() === scpUserId
  );

  if (!userShare) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You are not shared with this requirement');
  }

  // Process files if provided with better error handling
  const tempFileKeysToDelete = [];
  const newlyCopiedFiles = [];
  const existingFiles = [];
  const allFiles = [];

  if (files && files.length > 0) {
    try {
      for (const fileData of files) {
        const { fileType, key: tempKey, originalName } = fileData;

        // Check if the file is already in permanent storage using startsWith for precise matching
        const permanentPathPattern = `customer-leads/${leadId}/${requirementId}/scp-files/`;
        const isPermanentFile = tempKey.startsWith(permanentPathPattern);

        if (isPermanentFile) {
          // File is already in permanent storage, just add it to existing files
          const existingFile = {
            fileType,
            key: tempKey, // Use the existing permanent key
            originalName: originalName || tempKey.split('/').pop(),
            uploadedAt: new Date()
          };
          existingFiles.push(existingFile);
          allFiles.push(existingFile);
        } else {
          // File is in temporary storage, copy to permanent location
          const fileName = tempKey.split('/').pop();
          const permanentKey = `customer-leads/${leadId}/${requirementId}/scp-files/${fileType}/${fileName}`;

          // Copy file from temporary to permanent location
          await storage.copyFile(tempKey, permanentKey);

          // Add to newly copied files array
          const newFile = {
            fileType,
            key: permanentKey,
            originalName: originalName || fileName,
            uploadedAt: new Date()
          };
          newlyCopiedFiles.push(newFile);
          allFiles.push(newFile);

          // Mark for deletion from temp location
          tempFileKeysToDelete.push(tempKey);
        }
      }
    } catch (error) {
      // If any file copy fails, clean up only the newly copied files
      for (const file of newlyCopiedFiles) {
        try {
          await storage.deleteFile(file.key);
        } catch (deleteError) {
          logger.error('Failed to delete newly copied file during cleanup:', deleteError);
        }
      }
      throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to process uploaded files');
    }
  }

  // Update the SCP data
  requirement.scpData = {
    ...requirement.scpData,
    ...scpData
  };

  // Mark as updated for this user
  userShare.scpDataUpdated = true;
  userShare.scpDataUpdatedAt = new Date();

  // Track the last update information
  requirement.scpData.lastUpdatedBy = scpUserId;
  requirement.scpData.lastUpdatedAt = new Date();

  // Replace files array with all files (existing + newly copied)
  if (allFiles.length > 0) {
    requirement.files = allFiles;
  }

  await requirement.save();

  // Clean up temporary files
  for (const tempKey of tempFileKeysToDelete) {
    try {
      await storage.deleteFile(tempKey);
    } catch (deleteError) {
      logger.error('Failed to delete temporary file:', deleteError);
    }
  }

  return requirement;
};

/**
 * Update SCP data by admin (similar to SCP user but without permission restrictions)
 * @param {string} leadId - The lead ID
 * @param {string} requirementId - The requirement ID
 * @param {string} adminId - The admin user ID
 * @param {Object} scpData - The SCP data to update
 * @param {Array} files - Array of files to upload
 * @returns {Promise<Requirement>}
 */
export const updateScpDataByAdminService = async (leadId, requirementId, adminId, scpData, files = []) => {
  const requirement = await Requirement.findOne({ _id: requirementId, lead: leadId });
  if (!requirement) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Requirement not found for this lead');
  }

  // Process files if provided with better error handling (Admin Service)
  // const tempFileKeysToDelete = [];
  // const newlyCopiedFiles = [];
  // const existingFiles = [];
  // const allFiles = [];

  // if (files && files.length > 0) {
  //   try {
  //     for (const fileData of files) {
  //       const { fileType, key: tempKey, originalName } = fileData;

  //       // Check if the file is already in permanent storage using startsWith for precise matching
  //       const permanentPathPattern = `customer-leads/${leadId}/${requirementId}/scp-files/`;
  //       const isPermanentFile = tempKey.startsWith(permanentPathPattern);

  //       if (isPermanentFile) {
  //         // File is already in permanent storage, just add it to existing files
  //         const existingFile = {
  //           fileType,
  //           key: tempKey, // Use the existing permanent key
  //           originalName: originalName || tempKey.split('/').pop(),
  //           uploadedAt: new Date()
  //         };
  //         existingFiles.push(existingFile);
  //         allFiles.push(existingFile);
  //       } else {
  //         // File is in temporary storage, copy to permanent location
  //         const fileName = tempKey.split('/').pop();
  //         const permanentKey = `customer-leads/${leadId}/${requirementId}/scp-files/${fileType}/${fileName}`;

  //         // Copy file from temporary to permanent location
  //         await storage.copyFile(tempKey, permanentKey);

  //         // Add to newly copied files array
  //         const newFile = {
  //           fileType,
  //           key: permanentKey,
  //           originalName: originalName || fileName,
  //           uploadedAt: new Date()
  //         };
  //         newlyCopiedFiles.push(newFile);
  //         allFiles.push(newFile);

  //         // Mark for deletion from temp location
  //         tempFileKeysToDelete.push(tempKey);
  //       }
  //     }
  //   } catch (error) {
  //     // If any file copy fails, clean up only the newly copied files
  //     for (const file of newlyCopiedFiles) {
  //       try {
  //         await storage.deleteFile(file.key);
  //       } catch (deleteError) {
  //         logger.error('Failed to delete newly copied file during cleanup:', deleteError);
  //       }
  //     }
  //     throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to process uploaded files');
  //   }
  // }

  // Update the SCP data
  requirement.scpData = {
    ...requirement.scpData,
    ...scpData
  };

  // Track the last update information
  requirement.scpData.lastUpdatedBy = adminId;
  requirement.scpData.lastUpdatedAt = new Date();

  // File handling commented out - only handling textual data
  // Replace files array with all files (existing + newly copied)
  // if (allFiles.length > 0) {
  //   requirement.files = allFiles;
  // }

  await requirement.save();

  // // Clean up temporary files
  // for (const tempKey of tempFileKeysToDelete) {
  //   try {
  //     await storage.deleteFile(tempKey);
  //   } catch (deleteError) {
  //     logger.error('Failed to delete temporary file:', deleteError);
  //   }
  // }

  return requirement;
};

/**
 * Delete a single file from a requirement
 * @param {string} leadId - The lead ID
 * @param {string} requirementId - The requirement ID
 * @param {string} fileKey - The S3 key of the file to delete
 * @param {string} userId - The user ID performing the deletion
 * @returns {Promise<Requirement>}
 */
export const deleteFileFromRequirementService = async (leadId, requirementId, fileKey, userId) => {
  const requirement = await Requirement.findOne({ _id: requirementId, lead: leadId });
  if (!requirement) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Requirement not found for this lead');
  }

  // Find the file in the requirement's files array
  const fileIndex = requirement.files.findIndex(file => file.key === fileKey);
  if (fileIndex === -1) {
    throw new ApiError(httpStatus.NOT_FOUND, 'File not found in this requirement');
  }

  const fileToDelete = requirement.files[fileIndex];

  try {
    // Delete the file from S3
    await storage.deleteFile(fileKey);

    // Remove the file from the requirement's files array
    requirement.files.splice(fileIndex, 1);

    // Update the last modified information
    requirement.scpData.lastUpdatedBy = userId;
    requirement.scpData.lastUpdatedAt = new Date();

    await requirement.save();

    return requirement;
  } catch (error) {
    logger.error('Failed to delete file from S3:', error);
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to delete file from storage');
  }
};

/**
 * Delete multiple files from a requirement (bulk deletion)
 * @param {string} leadId - The lead ID
 * @param {string} requirementId - The requirement ID
 * @param {Array<string>} fileKeys - Array of S3 keys of files to delete
 * @param {string} userId - The user ID performing the deletion
 * @returns {Promise<Requirement>}
 */
export const deleteMultipleFilesFromRequirementService = async (leadId, requirementId, fileKeys, userId) => {
  const requirement = await Requirement.findOne({ _id: requirementId, lead: leadId });
  if (!requirement) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Requirement not found for this lead');
  }

  if (!Array.isArray(fileKeys) || fileKeys.length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'File keys array is required and cannot be empty');
  }

  // Validate that all files exist in the requirement
  const existingFileKeys = requirement.files.map(file => file.key);
  const invalidFileKeys = fileKeys.filter(key => !existingFileKeys.includes(key));

  if (invalidFileKeys.length > 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, `Files not found: ${invalidFileKeys.join(', ')}`);
  }

  const deletedFiles = [];
  const failedDeletions = [];

  // Delete files from S3 and track results
  for (const fileKey of fileKeys) {
    try {
      await storage.deleteFile(fileKey);
      deletedFiles.push(fileKey);
    } catch (error) {
      logger.error(`Failed to delete file ${fileKey} from S3:`, error);
      failedDeletions.push({ fileKey, error: error.message });
    }
  }

  // Remove successfully deleted files from the requirement's files array
  requirement.files = requirement.files.filter(file => !deletedFiles.includes(file.key));

  // Update the last modified information
  requirement.scpData.lastUpdatedBy = userId;
  requirement.scpData.lastUpdatedAt = new Date();

  await requirement.save();

  return {
    requirement,
    deletedFiles,
    failedDeletions,
    totalRequested: fileKeys.length,
    totalDeleted: deletedFiles.length,
    totalFailed: failedDeletions.length
  };
};

export const getSharedRequirementsForUserService = async (userId) => {
  const requirements = await Requirement.find({ 'sharedWith.user': userId })
    .populate('lead', 'customerName') // populate only necessary lead fields
    .populate({
      path: 'sharedWith.user',
      select: '_id name email role'
    })
    .populate({
      path: 'sharedWith.sharedBy',
      select: '_id name email role'
    })
    .lean();

  // Group requirements by lead
  const grouped = {};
  for (const req of requirements) {
    const leadId = req.lead._id.toString();
    grouped[leadId] = {
      leadId,
      customerName: req.lead.customerName,
      mobileNumber: req.lead.mobileNumber,
      email: req.lead.email,
      state: req.lead.state,
      city: req.lead.city,
      requirements: [],
    };


    // Add site visits data to the requirement
    const requirementWithVisits = {
      ...req,
    };
    delete requirementWithVisits.scpData.googleLocationLink;
    delete requirementWithVisits.scpData.siteAddress;
    delete requirementWithVisits.scpData.avgStayDuration;
    delete requirementWithVisits.scpData.drawingStatus;
    delete requirementWithVisits.scpData.roomRequirements;
    delete requirementWithVisits.scpData.architectStatus;
    delete requirementWithVisits.scpData.tokenAdvance;
    delete requirementWithVisits.scpData.financing;
    delete requirementWithVisits.scpData.siteVisitDate;
    delete requirementWithVisits.scpData.targetCompletionDate;
    delete requirementWithVisits.scpData.lastUpdatedBy;
    delete requirementWithVisits.scpData.lastUpdatedAt;

    grouped[leadId].requirements.push(requirementWithVisits);
  }

  return Object.values(grouped);
};

/**
 * Get requirements assigned to SCP user for modification (with pagination and filters)
 * @param {string} scpUserId - The SCP user ID
 * @param {Object} filter - Filter options
 * @param {Object} options - Pagination and sorting options
 * @returns {Promise<Object>}
 */
export const getScpUserAssignedRequirementsService = async (scpUserId, filter = {}, options = {}) => {
  const {
    page = 1,
    limit = 10,
    sortBy = 'sharedAt:desc', // Default: latest first
    search = '',
    projectName = '',
    customerName = '',
    requirementType = '',
    status = '', // 'pending', 'updated', 'all'
  } = options;

  // Build the base query for requirements shared with this SCP user
  const baseQuery = {
    'sharedWith.user': scpUserId,
  };

  // Add search filter
  if (search) {
    const searchRegex = { $regex: search, $options: 'i' };
    baseQuery.$or = [
      { projectName: searchRegex },
      { 'lead.customerName': searchRegex },
      { 'scpData.siteAddress': searchRegex },
      { 'scpData.siteType': searchRegex },
      { 'scpData.structureType': searchRegex }
    ];
  }

  // Add specific filters
  if (projectName) {
    baseQuery.projectName = { $regex: projectName, $options: 'i' };
  }

  if (customerName) {
    baseQuery['lead.customerName'] = { $regex: customerName, $options: 'i' };
  }

  if (requirementType) {
    baseQuery.requirementType = { $regex: requirementType, $options: 'i' };
  }

  // Get all requirements first (we'll handle sorting and pagination in memory)
  const allRequirements = await Requirement.find(baseQuery)
    .populate('lead', 'customerName mobileNumber email state city')
    .populate('project', 'projectName status')
    .populate({
      path: 'sharedWith',
      match: { user: scpUserId, canUpdateScpData: true },
      populate: [
        {
          path: 'user',
          select: '_id name email role'
        },
        {
          path: 'sharedBy',
          select: '_id name email role'
        }
      ]
    })
    .populate({
      path: 'visits',
      select: 'documents siteEngineer visitDate visitStartDate visitEndDate',
      populate: {
        path: 'siteEngineer',
        select: 'name email'
      }
    })
    .lean();

  // Process requirements to include SCP-specific information
  const processedRequirements = allRequirements.map(req => {
    // Find the specific share for this SCP user
    const userShare = req.sharedWith.find(share =>
      share.user && share.user._id.toString() === scpUserId.toString()
    );

    // Determine status
    let status = 'pending';
    if (userShare && userShare.scpDataUpdated) {
      status = 'updated';
    }

    // Filter out other users' shares for cleaner response
    const scpShare = userShare ? {
      sharedBy: userShare.sharedBy,
      sharedAt: userShare.sharedAt,
      isSeen: userShare.isSeen,
      canUpdateScpData: userShare.canUpdateScpData,
      scpDataUpdated: userShare.scpDataUpdated,
      scpDataUpdatedAt: userShare.scpDataUpdatedAt
    } : null;

    return {
      _id: req._id,
      projectName: req.projectName,
      requirementType: req.requirementType,
      requirementDescription: req.requirementDescription,
      urgency: req.urgency,
      budget: req.budget,
      scpData: req.scpData,
      files: req.files,
      lead: req.lead,
      project: req.project,
      visits: req.visits || [],
      scpShare,
      status,
      createdAt: req.createdAt,
      updatedAt: req.updatedAt,
      // Add sorting fields for in-memory sorting
      sharedAt: userShare ? userShare.sharedAt : req.createdAt,
      scpDataUpdatedAt: userShare ? userShare.scpDataUpdatedAt : null
    };
  });

  // Apply status filter if specified
  let filteredRequirements = processedRequirements;
  if (status && status !== 'all') {
    filteredRequirements = processedRequirements.filter(req => req.status === status);
  }

  // Apply sorting
  if (sortBy) {
    const [field, order] = sortBy.split(':');
    const sortOrder = order === 'desc' ? -1 : 1;

    if (field === 'sharedAt') {
      filteredRequirements.sort((a, b) => {
        const dateA = new Date(a.sharedAt || 0);
        const dateB = new Date(b.sharedAt || 0);
        return (dateB - dateA) * sortOrder;
      });
    } else if (field === 'updatedAt') {
      filteredRequirements.sort((a, b) => {
        const dateA = new Date(a.scpDataUpdatedAt || 0);
        const dateB = new Date(b.scpDataUpdatedAt || 0);
        return (dateB - dateA) * sortOrder;
      });
    } else if (field === 'projectName') {
      filteredRequirements.sort((a, b) => {
        const nameA = (a.projectName || '').toLowerCase();
        const nameB = (b.projectName || '').toLowerCase();
        return nameA.localeCompare(nameB) * sortOrder;
      });
    } else if (field === 'customerName') {
      filteredRequirements.sort((a, b) => {
        const nameA = (a.lead?.customerName || '').toLowerCase();
        const nameB = (b.lead?.customerName || '').toLowerCase();
        return nameA.localeCompare(nameB) * sortOrder;
      });
    } else {
      // Default sorting by createdAt
      filteredRequirements.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0);
        const dateB = new Date(b.createdAt || 0);
        return (dateB - dateA) * sortOrder;
      });
    }
  } else {
    // Default sort: latest shared first
    filteredRequirements.sort((a, b) => {
      const dateA = new Date(a.sharedAt || 0);
      const dateB = new Date(b.sharedAt || 0);
      return dateB - dateA; // Descending order
    });
  }

  // Apply pagination
  const totalRequirements = filteredRequirements.length;
  const totalPages = Math.ceil(totalRequirements / limit);
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const paginatedRequirements = filteredRequirements.slice(startIndex, endIndex);

  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  return {
    requirements: paginatedRequirements,
    pagination: {
      currentPage: page,
      totalPages,
      totalRequirements,
      hasNextPage,
      hasPrevPage,
      limit
    }
  };
};

const normalizeHeaders = (headers) => {
  const headerMap = {
    // Basic Info
    leadSource: ['leadsource', 'lead source'],
    customerName: ['customername', 'customer name', 'name'],
    mobileNumber: ['mobilenumber', 'mobile number', 'mobile'],
    alternateContactNumber: ['alternatecontactnumber', 'alternate contact'],
    email: ['email', 'email address'],
    state: ['state'],
    city: ['city'],

    // Requirement specific
    requirementType: ['requirementtype', 'requirement type'],
    otherRequirement: ['otherrequirement', 'other requirement'],
    requirementDescription: ['requirementdescription', 'requirement description'],
    urgency: ['urgency'],
    budget: ['budget'],

    // SCP Data
    siteAddress: ['siteaddress', 'site address'],
    googleLocationLink: ['googlelocationlink', 'google maps link'],
    siteType: ['sitetype', 'site type'],
    plotSize: ['plotsize', 'plot size'],
    totalArea: ['totalarea', 'total area'],
    plinthStatus: ['plinthstatus', 'plinth status'],
    structureType: ['structuretype', 'structure type'],
    numUnits: ['numunits', 'number of units'],
    usageType: ['usagetype', 'usage type'],
    avgStayDuration: ['avgstayduration', 'average stay duration'],
    additionalFeatures: ['additionalfeatures', 'additional features'],
    designIdeas: ['designideas', 'design ideas'],
    drawingStatus: ['drawingstatus', 'drawing status'],
    architectStatus: ['architectstatus', 'architect status'],
    roomRequirements: ['roomrequirements', 'room requirements'],
    tokenAdvance: ['tokenadvance', 'token advance'],
    financing: ['financing', 'financing required'],
    roadWidth: ['roadwidth', 'road width'],
    targetCompletionDate: ['targetcompletiondate', 'target completion'],
    siteVisitDate: ['sitevisitdate', 'site visit date'],
    scpRemarks: ['scpremarks', 'scp remarks'],
  };

  const mapping = {};
  headers.forEach((header, index) => {
    const cleanHeader = header.toLowerCase().replace(/\s+/g, '');
    for (const key in headerMap) {
      if (headerMap[key].includes(cleanHeader)) {
        mapping[key] = index;
      }
    }
  });
  return mapping;
};

const parseBoolean = (value) => {
  if (value === null || value === undefined) return undefined;
  const strVal = String(value).toLowerCase().trim();
  if (['true', '1', 'yes', 'y'].includes(strVal)) return true;
  if (['false', '0', 'no', 'n'].includes(strVal)) return false;
  return undefined;
};

export const importCustomerLeadsService = async (filePath) => {
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(worksheet, { header: 1, cellDates: true, raw: false });

  if (data.length < 2) {
    return { importedCount: 0, errors: [] };
  }

  const headers = data[0];
  const headerMapping = normalizeHeaders(headers);
  const rows = data.slice(1);

  const leadsByCustomer = new Map();
  const errors = [];

  rows.forEach((row, index) => {
    const getVal = (fieldName) => {
      const colIndex = headerMapping[fieldName];
      if (colIndex === undefined) return undefined;
      const cellValue = row[colIndex];
      if (cellValue === null || cellValue === undefined) return undefined;
      // The xlsx library with cellDates:true will return a Date object for dates.
      // For other types it will be string/number.
      if (cellValue instanceof Date) {
        return cellValue;
      }
      return cellValue.toString().trim();
    };

    // Use a unique identifier for the customer, e.g., email or mobile.
    // Fallback to customer name if others are not present.
    const customerId = getVal('email') || getVal('mobileNumber') || getVal('customerName');

    if (!customerId) {
      errors.push({ row: index + 2, error: 'Missing customer identifier (Email, Mobile, or Name).' });
      return;
    }

    if (!leadsByCustomer.has(customerId)) {
      leadsByCustomer.set(customerId, {
        leadSource: getVal('leadSource'),
        customerName: getVal('customerName'),
        mobileNumber: getVal('mobileNumber'),
        alternateContactNumber: getVal('alternateContactNumber'),
        email: getVal('email'),
        state: getVal('state'),
        city: getVal('city'),
        requirements: [],
        _sourceRows: [], // To track original row numbers for better error reporting
      });
    }

    const customerData = leadsByCustomer.get(customerId);
    customerData._sourceRows.push(index + 2); // Store original row number (2-based index)

    const scpData = {
      siteAddress: getVal('siteAddress'),
      googleLocationLink: getVal('googleLocationLink'),
      siteType: getVal('siteType'),
      plotSize: getVal('plotSize'),
      totalArea: getVal('totalArea'),
      plinthStatus: getVal('plinthStatus'),
      structureType: getVal('structureType'),
      numUnits: getVal('numUnits') ? Number(getVal('numUnits')) : undefined,
      usageType: getVal('usageType'),
      avgStayDuration: getVal('avgStayDuration'),
      additionalFeatures: getVal('additionalFeatures'),
      designIdeas: getVal('designIdeas'),
      drawingStatus: getVal('drawingStatus'),
      architectStatus: getVal('architectStatus'),
      roomRequirements: getVal('roomRequirements'),
      tokenAdvance: parseBoolean(getVal('tokenAdvance')),
      financing: parseBoolean(getVal('financing')),
      roadWidth: getVal('roadWidth'),
      targetCompletionDate: getVal('targetCompletionDate'),
      siteVisitDate: getVal('siteVisitDate'),
      scpRemarks: getVal('scpRemarks'),
    };

    const requirement = {
      requirementType: getVal('requirementType'),
      otherRequirement: getVal('otherRequirement'),
      requirementDescription: getVal('requirementDescription'),
      urgency: getVal('urgency'),
      budget: getVal('budget') ? Number(getVal('budget')) : undefined,
      scpData: getVal('requirementType') === 'Cottage / Structure Proposal' ? scpData : {},
    };

    customerData.requirements.push(requirement);
  });

  let importedCount = 0;
  for (const [customerId, leadData] of leadsByCustomer.entries()) {
    const { _sourceRows, ...leadPayload } = leadData;
    const rowIdentifier = `Row(s) ${_sourceRows.join(', ')}`;

    try {
      // Find existing lead by email or mobile.
      const existingLead = await CustomerLead.findOne({
        $or: [{ email: leadPayload.email }, { mobileNumber: leadPayload.mobileNumber }],
      });

      if (existingLead) {
        // If lead exists, add new requirements.
        const { error: validationError } = updateCustomerLead.body.validate({ requirements: leadPayload.requirements });
        if (validationError) {
          errors.push({ customerId, error: validationError.details.map((d) => d.message).join(', '), location: rowIdentifier });
          continue;
        }

        existingLead.requirements.push(...leadPayload.requirements);
        await existingLead.save();

      } else {
        // If lead doesn't exist, create a new one.
        const { error: validationError } = createCustomerLead.body.validate(leadPayload);
        if (validationError) {
          errors.push({ customerId, error: validationError.details.map((d) => d.message).join(', '), location: rowIdentifier });
          continue;
        }

        await CustomerLead.create(leadPayload);
      }

      importedCount++;
    } catch (dbError) {
      const errorMessage = `Failed to process lead. Reason: ${dbError.message}`;
      errors.push({ customerId, error: errorMessage, location: rowIdentifier });
    }
  }

  return { importedCount, errors };
};

export const exportCustomerLeadsService = async (filter = {}) => {
  const customerLeads = await CustomerLead.find(filter).lean();

  if (customerLeads.length === 0) {
    return null;
  }

  const dataToExport = [];
  const headers = [
    // Basic Info
    'Lead ID', 'Lead Source', 'Customer Name', 'Mobile Number', 'Alternate Contact', 'Email', 'State', 'City', 'Status', 'Created At',
    // Requirement specific
    'Requirement ID', 'Requirement Type', 'Other Requirement', 'Description', 'Urgency', 'Budget',
    // SCP Data
    'Site Address', 'Google Location', 'Site Type', 'Plot Size', 'Total Area', 'Plinth Status', 'Structure Type', 'Num Units', 'Usage Type',
    'Avg Stay Duration', 'Additional Features', 'Design Ideas', 'Drawing Status', 'Architect Status', 'Room Requirements', 'Token Advance',
    'Financing', 'Road Width', 'Target Completion', 'Site Visit Date', 'SCP Remarks'
  ];

  for (const lead of customerLeads) {
    if (lead.requirements && lead.requirements.length > 0) {
      for (const requirement of lead.requirements) {
        const scpData = requirement.scpData || {};
        const row = {
          'Lead ID': lead._id.toString(),
          'Lead Source': lead.leadSource,
          'Customer Name': lead.customerName,
          'Mobile Number': lead.mobileNumber,
          'Alternate Contact': lead.alternateContactNumber,
          'Email': lead.email,
          'State': lead.state,
          'City': lead.city,
          'Status': lead.status,
          'Created At': lead.createdAt.toISOString(),

          'Requirement ID': requirement._id.toString(),
          'Requirement Type': requirement.requirementType,
          'Other Requirement': requirement.otherRequirement,
          'Description': requirement.requirementDescription,
          'Urgency': requirement.urgency,
          'Budget': requirement.budget,

          'Site Address': scpData.siteAddress,
          'Google Location': scpData.googleLocationLink,
          'Site Type': scpData.siteType,
          'Plot Size': scpData.plotSize,
          'Total Area': scpData.totalArea,
          'Plinth Status': scpData.plinthStatus,
          'Structure Type': scpData.structureType,
          'Num Units': scpData.numUnits,
          'Usage Type': scpData.usageType,
          'Avg Stay Duration': scpData.avgStayDuration,
          'Additional Features': scpData.additionalFeatures,
          'Design Ideas': scpData.designIdeas,
          'Drawing Status': scpData.drawingStatus,
          'Architect Status': scpData.architectStatus,
          'Room Requirements': scpData.roomRequirements,
          'Token Advance': scpData.tokenAdvance,
          'Financing': scpData.financing,
          'Road Width': scpData.roadWidth,
          'Target Completion': scpData.targetCompletionDate,
          'Site Visit Date': scpData.siteVisitDate,
          'SCP Remarks': scpData.scpRemarks
        };
        dataToExport.push(row);
      }
    } else {
      // Add a row for leads without any requirements
      const row = {
        'Lead ID': lead._id.toString(),
        'Lead Source': lead.leadSource,
        'Customer Name': lead.customerName,
        'Mobile Number': lead.mobileNumber,
        'Alternate Contact': lead.alternateContactNumber,
        'Email': lead.email,
        'State': lead.state,
        'City': lead.city,
        'Status': lead.status,
        'Created At': lead.createdAt.toISOString(),
      };
      dataToExport.push(row);
    }
  }

  const worksheet = xlsx.utils.json_to_sheet(dataToExport, { header: headers });
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, 'Customer Leads');

  return xlsx.write(workbook, { bookType: 'xlsx', type: 'buffer' });
};
