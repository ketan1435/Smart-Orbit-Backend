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
import { logActivity } from '../middlewares/activityLog.middleware.js';


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

    // Log requirement creation
    try {
      await logActivity(req, {
        action: 'create',
        targetModel: 'Requirement',
        targetId: requirementId,
        targetName: reqData.projectName,
        description: `Created requirement: ${reqData.projectName} for customer lead: ${lead.customerName}`,
        metadata: {
          requirementData: {
            projectName: reqData.projectName,
            requirementType: reqData.requirementType,
            urgency: reqData.urgency,
            budget: reqData.budget,
            fileCount: files.length
          },
          leadId: lead._id,
          leadName: lead.customerName,
          projectId: project._id
        }
      });
    } catch (error) {
      console.error('Error logging requirement creation:', error);
    }

    // Log project creation
    try {
      await logActivity(req, {
        action: 'create',
        targetModel: 'Project',
        targetId: project._id,
        targetName: reqData.projectName,
        description: `Created project: ${reqData.projectName} for customer lead: ${lead.customerName}`,
        metadata: {
          projectId: project._id,
          projectData: {
            projectName: reqData.projectName,
            budget: reqData.budget ? parseFloat(reqData.budget.replace(/[^0-9.-]+/g, '')) : 0,
            status: 'draft'
          },
          leadId: lead._id,
          leadName: lead.customerName,
          requirementId: requirementId
        }
      });
    } catch (error) {
      console.error('Error logging project creation:', error);
    }

    // 5.1 Handle SCP user sharing
    // Share whenever an SCP user is selected during lead creation, regardless of sendToScp flag
    if (reqData.selectedScpUser) {
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

      // Log site visits creation
      try {
        for (const siteVisit of createdSiteVisits) {
          await logActivity(req, {
            action: 'create',
            targetModel: 'SiteVisit',
            targetId: siteVisit._id,
            targetName: `Site visit for ${reqData.projectName}`,
            description: `Created site visit for project: ${reqData.projectName} with site engineer`,
            metadata: {
              siteVisitData: {
                projectName: reqData.projectName,
                siteEngineer: siteVisit.siteEngineer,
                visitDate: siteVisit.visitDate,
                visitStartDate: siteVisit.visitStartDate,
                visitEndDate: siteVisit.visitEndDate,
                hasRequirementEditAccess: siteVisit.hasRequirementEditAccess
              },
              leadId: lead._id,
              leadName: lead.customerName,
              requirementId: requirementId
            }
          });
        }
      } catch (error) {
        console.error('Error logging site visit creation:', error);
      }

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
    await createUser(req, {
      name: leadData.customerName,
      email: leadData.email,
      password: leadData.password,
    });
  }

  // 7. Clean up temp S3 files after commit
  Promise.all(tempFileKeysToDelete.map(key => storage.deleteFile(key))).catch(err => {
    logger.error(`Failed to delete temporary file during cleanup: ${err.message}`);
  });

  // Log the customer lead creation
  try {
    await logActivity(req, {
      action: 'create',
      targetModel: 'CustomerLead',
      targetId: lead._id,
      targetName: lead.customerName || 'Unknown Customer',
      description: `Created customer lead: ${lead.customerName} (${lead.email})`,
      metadata: {
        leadData: {
          customerName: lead.customerName,
          email: lead.email,
          mobileNumber: lead.mobileNumber,
          state: lead.state,
          city: lead.city,
          townVillage: lead.townVillage,
          status: lead.status,
          leadSource: lead.leadSource
        },
        requirementsCount: requirements.length,
        projectsCreated: requirements.length,
        createdBy: req.user.id,
        createdByModel: req.user.role === 'Admin' ? 'Admin' : 'User'
      }
    });
  } catch (error) {
    console.error('Error logging customer lead creation:', error);
    // Don't throw error - logging should not break the main operation
  }

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

  // Store original lead data for change detection
  const originalLead = { ...lead.toObject() };

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

  // Track which fields are being updated
  const updatedFields = {};
  for (const key of Object.keys(restUpdateBody)) {
    if (allowedFields.includes(key)) {
      updatedFields[key] = {
        from: originalLead[key],
        to: restUpdateBody[key]
      };
      lead[key] = restUpdateBody[key];
    }
  }

  // Handle requirement updates if provided
  const updatedRequirements = [];
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

      // Store original requirement data for change detection
      const originalRequirement = { ...requirement.toObject() };

      // Update the requirement fields
      const { _id, ...updateFields } = reqUpdate;
      Object.assign(requirement, updateFields);

      await requirement.save({ session });

      // Track requirement updates for logging
      updatedRequirements.push({
        requirementId: requirement._id,
        projectName: requirement.projectName,
        originalData: originalRequirement,
        updatedData: requirement.toObject(),
        changes: Object.keys(updateFields).reduce((acc, key) => {
          if (originalRequirement[key] !== updateFields[key]) {
            acc[key] = {
              from: originalRequirement[key],
              to: updateFields[key]
            };
          }
          return acc;
        }, {})
      });
    }
  }

  // If status is being updated, use cascade logic
  if (isStatusUpdate) {
    const result = await updateCustomerStatusWithCascade(id, restUpdateBody.status, session);

    // Log customer lead status update with cascade
    try {
      await logActivity(req, {
        action: 'update',
        targetModel: 'CustomerLead',
        targetId: lead._id,
        targetName: lead.customerName || 'Unknown Customer',
        description: `Updated customer lead status: ${lead.customerName} - ${originalLead.status} → ${restUpdateBody.status} (cascade updated ${result.projectsUpdated} projects)`,
        changes: updatedFields,
        metadata: {
          leadData: {
            customerName: lead.customerName,
            email: lead.email,
            status: lead.status,
            previousStatus: originalLead.status,
            newStatus: restUpdateBody.status
          },
          statusUpdate: true,
          cascadeUpdate: true,
          projectsUpdated: result.projectsUpdated,
          requirementsUpdated: updatedRequirements.length,
          updatedFields: Object.keys(updatedFields),
          updatedBy: req.user.id,
          updatedByModel: req.user.role === 'Admin' ? 'Admin' : 'User'
        }
      });
    } catch (error) {
      console.error('Error logging customer lead status update:', error);
    }

    // Log individual requirement updates if any
    for (const reqUpdate of updatedRequirements) {
      try {
        await logActivity(req, {
          action: 'update',
          targetModel: 'Requirement',
          targetId: reqUpdate.requirementId,
          targetName: reqUpdate.projectName,
          description: `Updated requirement: ${reqUpdate.projectName} for customer lead: ${lead.customerName}`,
          changes: reqUpdate.changes,
          metadata: {
            requirementData: {
              projectName: reqUpdate.projectName,
              requirementType: reqUpdate.updatedData.requirementType,
              urgency: reqUpdate.updatedData.urgency,
              budget: reqUpdate.updatedData.budget
            },
            leadId: lead._id,
            leadName: lead.customerName,
            updatedFields: Object.keys(reqUpdate.changes),
            updatedBy: req.user.id,
            updatedByModel: req.user.role === 'Admin' ? 'Admin' : 'User'
          }
        });
      } catch (error) {
        console.error('Error logging requirement update:', error);
      }
    }

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

    // Log customer lead update
    try {
      await logActivity(req, {
        action: 'update',
        targetModel: 'CustomerLead',
        targetId: lead._id,
        targetName: lead.customerName || 'Unknown Customer',
        description: `Updated customer lead: ${lead.customerName} (${lead.email})`,
        changes: updatedFields,
        metadata: {
          leadData: {
            customerName: lead.customerName,
            email: lead.email,
            mobileNumber: lead.mobileNumber,
            state: lead.state,
            city: lead.city,
            townVillage: lead.townVillage,
            status: lead.status,
            leadSource: lead.leadSource
          },
          requirementsUpdated: updatedRequirements.length,
          updatedFields: Object.keys(updatedFields),
          updatedBy: req.user.id,
          updatedByModel: req.user.role === 'Admin' ? 'Admin' : 'User'
        }
      });
    } catch (error) {
      console.error('Error logging customer lead update:', error);
    }

    // Log individual requirement updates if any
    for (const reqUpdate of updatedRequirements) {
      try {
        await logActivity(req, {
          action: 'update',
          targetModel: 'Requirement',
          targetId: reqUpdate.requirementId,
          targetName: reqUpdate.projectName,
          description: `Updated requirement: ${reqUpdate.projectName} for customer lead: ${lead.customerName}`,
          changes: reqUpdate.changes,
          metadata: {
            requirementData: {
              projectName: reqUpdate.projectName,
              requirementType: reqUpdate.updatedData.requirementType,
              urgency: reqUpdate.updatedData.urgency,
              budget: reqUpdate.updatedData.budget
            },
            leadId: lead._id,
            leadName: lead.customerName,
            updatedFields: Object.keys(reqUpdate.changes),
            updatedBy: req.user.id,
            updatedByModel: req.user.role === 'Admin' ? 'Admin' : 'User'
          }
        });
      } catch (error) {
        console.error('Error logging requirement update:', error);
      }
    }

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


export const activateCustomerLeadService = async (req, id) => {
  const lead = await getCustomerLeadByIdService(id);
  if (!lead) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Customer lead not found');
  }

  const originalStatus = lead.status;
  lead.status = STATUS_ENUM.ACTIVE;
  await lead.save();

  // Log the activation
  try {
    await logActivity(req, {
      action: 'activate',
      targetModel: 'CustomerLead',
      targetId: lead._id,
      targetName: lead.customerName || 'Unknown Customer',
      description: `Activated customer lead: ${lead.customerName} (${lead.email})`,
      metadata: {
        leadData: {
          customerName: lead.customerName,
          email: lead.email,
          previousStatus: originalStatus,
          newStatus: STATUS_ENUM.ACTIVE
        },
        statusChange: true,
        activatedBy: req.user.id,
        activatedByModel: req.user.role === 'Admin' ? 'Admin' : 'User'
      }
    });
  } catch (error) {
    console.error('Error logging customer lead activation:', error);
  }

  return lead;
};

export const deactivateCustomerLeadService = async (req, id) => {
  const lead = await getCustomerLeadByIdService(id);
  if (!lead) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Customer lead not found');
  }

  const originalStatus = lead.status;
  lead.status = STATUS_ENUM.INACTIVE;
  await lead.save();

  // Log the deactivation
  try {
    await logActivity(req, {
      action: 'deactivate',
      targetModel: 'CustomerLead',
      targetId: lead._id,
      targetName: lead.customerName || 'Unknown Customer',
      description: `Deactivated customer lead: ${lead.customerName} (${lead.email})`,
      metadata: {
        leadData: {
          customerName: lead.customerName,
          email: lead.email,
          previousStatus: originalStatus,
          newStatus: STATUS_ENUM.INACTIVE
        },
        statusChange: true,
        deactivatedBy: req.user.id,
        deactivatedByModel: req.user.role === 'Admin' ? 'Admin' : 'User'
      }
    });
  } catch (error) {
    console.error('Error logging customer lead deactivation:', error);
  }

  return lead;
};

export const updateCustomerLeadStatusService = async (req, id, newStatus) => {
  const lead = await getCustomerLeadByIdService(id);
  if (!lead) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Customer lead not found');
  }

  if (!STATUS_VALUES.includes(newStatus)) {
    throw new ApiError(httpStatus.BAD_REQUEST, `Invalid status. Must be one of: ${STATUS_VALUES.join(', ')}`);
  }

  const originalStatus = lead.status;
  lead.status = newStatus;
  await lead.save();

  // Log the status update
  try {
    await logActivity(req, {
      action: 'update',
      targetModel: 'CustomerLead',
      targetId: lead._id,
      targetName: lead.customerName || 'Unknown Customer',
      description: `Updated customer lead status: ${lead.customerName} - ${originalStatus} → ${newStatus}`,
      changes: {
        status: {
          from: originalStatus,
          to: newStatus
        }
      },
      metadata: {
        leadData: {
          customerName: lead.customerName,
          email: lead.email,
          previousStatus: originalStatus,
          newStatus: newStatus
        },
        statusUpdate: true,
        updatedBy: req.user.id,
        updatedByModel: req.user.role === 'Admin' ? 'Admin' : 'User'
      }
    });
  } catch (error) {
    console.error('Error logging customer lead status update:', error);
  }

  return lead;
};

export const updateCustomerAndProjectsStatusService = async (req, id, newStatus) => {
  const lead = await getCustomerLeadByIdService(id);
  if (!lead) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Customer lead not found');
  }

  if (!STATUS_VALUES.includes(newStatus)) {
    throw new ApiError(httpStatus.BAD_REQUEST, `Invalid status. Must be one of: ${STATUS_VALUES.join(', ')}`);
  }

  // Store original status for change detection
  const originalLeadStatus = lead.status;

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

    // Store original project statuses for change detection
    const projectUpdates = projects.map(project => ({
      projectId: project._id,
      projectName: project.projectName,
      originalStatus: project.status,
      newStatus: newProjectStatus
    }));

    // Update all projects
    if (projects.length > 0) {
      await Project.updateMany(
        { lead: id },
        { status: newProjectStatus },
        { session }
      );
    }

    await session.commitTransaction();

    // Log customer lead status update with cascade
    try {
      await logActivity(req, {
        action: 'update',
        targetModel: 'CustomerLead',
        targetId: lead._id,
        targetName: lead.customerName || 'Unknown Customer',
        description: `Updated customer lead status with cascade: ${lead.customerName} - ${originalLeadStatus} → ${newStatus} (updated ${projects.length} projects to ${newProjectStatus})`,
        changes: {
          status: {
            from: originalLeadStatus,
            to: newStatus
          }
        },
        metadata: {
          leadData: {
            customerName: lead.customerName,
            email: lead.email,
            previousStatus: originalLeadStatus,
            newStatus: newStatus
          },
          statusUpdate: true,
          cascadeUpdate: true,
          projectsUpdated: projects.length,
          newProjectStatus: newProjectStatus,
          projectUpdates: projectUpdates,
          updatedBy: req.user.id,
          updatedByModel: req.user.role === 'Admin' ? 'Admin' : 'User'
        }
      });
    } catch (error) {
      console.error('Error logging customer lead cascade status update:', error);
    }

    // Log individual project status updates
    for (const projectUpdate of projectUpdates) {
      try {
        await logActivity(req, {
          action: 'update',
          targetModel: 'Project',
          targetId: projectUpdate.projectId,
          targetName: projectUpdate.projectName,
          description: `Updated project status via customer lead cascade: ${projectUpdate.projectName} - ${projectUpdate.originalStatus} → ${projectUpdate.newStatus}`,
          changes: {
            status: {
              from: projectUpdate.originalStatus,
              to: projectUpdate.newStatus
            }
          },
          metadata: {
            projectData: {
              projectName: projectUpdate.projectName,
              previousStatus: projectUpdate.originalStatus,
              newStatus: projectUpdate.newStatus
            },
            leadId: lead._id,
            leadName: lead.customerName,
            cascadeUpdate: true,
            triggeredBy: 'CustomerLead',
            triggeredById: lead._id,
            updatedBy: req.user.id,
            updatedByModel: req.user.role === 'Admin' ? 'Admin' : 'User'
          }
        });
      } catch (error) {
        console.error('Error logging project cascade status update:', error);
      }
    }

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

export const shareRequirementWithUsersService = async (req, leadId, requirementId, userIds, adminId, documentId = null, shouldSendToEngineer = false) => {
  const requirement = await Requirement.findOne({ _id: requirementId, lead: leadId });
  if (!requirement) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Requirement not found for this lead');
  }

  // Get lead information for logging
  const lead = await getCustomerLeadByIdService(leadId);
  if (!lead) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Customer lead not found');
  }

  let updated = false;
  const sharedUsers = [];
  const skippedUsers = [];
  const siteEngineerAssignments = [];

  // Check if any of the users are procurement team members
  const users = await User.find({ _id: { $in: userIds } }).select('_id role name email');
  const procurementUsers = users.filter(user => user.role === 'planning-engineer');
  const otherUsers = users.filter(user => user.role !== 'planning-engineer');

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
      sharedUsers.push({
        userId: user._id,
        userName: user.name,
        userEmail: user.email,
        role: user.role
      });

      // If user is a site engineer, automatically assign them to the project
      if (user.role === 'site-engineer' && project) {
        // Check if site engineer is not already assigned to this project
        if (!project.assignedSiteEngineer.includes(user._id)) {
          project.assignedSiteEngineer.push(user._id);
          project.save().catch(error => {
            logger.error(`Failed to assign site engineer ${user._id} to project ${project._id}:`, error);
          });
          logger.info(`Automatically assigned site engineer ${user._id} to project ${project._id} via requirement sharing`);
          siteEngineerAssignments.push({
            userId: user._id,
            userName: user.name,
            projectId: project._id,
            projectName: project.projectName
          });
        }
      }
    } else {
      skippedUsers.push({
        userId: user._id,
        userName: user.name,
        userEmail: user.email,
        role: user.role,
        reason: 'Already shared'
      });
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
            sharedUsers.push({
              userId: user._id,
              userName: user.name,
              userEmail: user.email,
              role: user.role
            });
          } else {
            skippedUsers.push({
              userId: user._id,
              userName: user.name,
              userEmail: user.email,
              role: user.role,
              reason: 'Already shared'
            });
          }
        });
      } else {
        // Log that procurement sharing was skipped due to no approved documents
        logger.info(`Procurement sharing skipped for requirement ${requirementId}: No approved architect documents found`);
        procurementUsers.forEach(user => {
          skippedUsers.push({
            userId: user._id,
            userName: user.name,
            userEmail: user.email,
            role: user.role,
            reason: 'No approved architect documents'
          });
        });
      }
    } else {
      // Log that no project was found
      logger.warn(`No project found for requirement ${requirementId} when sharing with procurement team`);
      procurementUsers.forEach(user => {
        skippedUsers.push({
          userId: user._id,
          userName: user.name,
          userEmail: user.email,
          role: user.role,
          reason: 'No project found'
        });
      });
    }
  }

  if (updated) {
    await requirement.save();
  }

  // Handle automatic document sending to procurement if requested
  let documentSent = false;
  let documentSendError = null;
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

          await sendDocumentToProcurement(req, project._id.toString(), documentId, admin);
          logger.info(`Document ${documentId} successfully sent to procurement`);
          documentSent = true;
        } else {
          logger.warn(`Document ${documentId} not found or doesn't meet criteria for auto-sending to procurement`);
          documentSendError = 'Document not found or doesn\'t meet criteria';
        }
      } else {
        logger.warn(`No project found for requirement ${requirementId} when trying to auto-send document to procurement`);
        documentSendError = 'No project found';
      }
    } catch (error) {
      logger.error(`Failed to auto-send document ${documentId} to procurement:`, error);
      documentSendError = error.message;
      // Don't throw the error - we don't want to fail the sharing operation because of this
      // The sharing was successful, the auto-send just failed
    }
  }

  // Log the requirement sharing activity
  try {
    await logActivity(req, {
      action: 'share',
      targetModel: 'Requirement',
      targetId: requirementId,
      targetName: requirement.projectName,
      description: `Shared requirement: ${requirement.projectName} with ${sharedUsers.length} users for customer lead: ${lead.customerName}`,
      metadata: {
        requirementData: {
          projectName: requirement.projectName,
          requirementType: requirement.requirementType,
          urgency: requirement.urgency,
          budget: requirement.budget
        },
        leadId: lead._id,
        leadName: lead.customerName,
        sharedUsers: sharedUsers,
        skippedUsers: skippedUsers,
        siteEngineerAssignments: siteEngineerAssignments,
        documentSent: documentSent,
        documentId: documentId,
        documentSendError: documentSendError,
        shouldSendToEngineer: shouldSendToEngineer,
        projectId: project?._id,
        projectName: project?.projectName,
        sharedBy: adminId,
        sharedByModel: req.user.role === 'Admin' ? 'Admin' : 'User'
      }
    });
  } catch (error) {
    console.error('Error logging requirement sharing:', error);
  }

  // Log individual user sharing if there are shared users
  for (const sharedUser of sharedUsers) {
    try {
      await logActivity(req, {
        action: 'share',
        targetModel: 'User',
        targetId: sharedUser.userId,
        targetName: sharedUser.userName,
        description: `Shared requirement: ${requirement.projectName} with user: ${sharedUser.userName} (${sharedUser.userEmail})`,
        metadata: {
          requirementId: requirementId,
          requirementName: requirement.projectName,
          leadId: lead._id,
          leadName: lead.customerName,
          userRole: sharedUser.role,
          projectId: project?._id,
          projectName: project?.projectName,
          sharedBy: adminId,
          sharedByModel: req.user.role === 'Admin' ? 'Admin' : 'User'
        }
      });
    } catch (error) {
      console.error('Error logging individual user sharing:', error);
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
export const shareRequirementWithScpUsersService = async (req, leadId, requirementId, scpUserIds, adminId) => {
  const requirement = await Requirement.findOne({ _id: requirementId, lead: leadId });
  if (!requirement) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Requirement not found for this lead');
  }

  // Get lead information for logging
  const lead = await getCustomerLeadByIdService(leadId);
  if (!lead) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Customer lead not found');
  }

  // Check if all users are SCP users
  const scpUsers = await User.find({ _id: { $in: scpUserIds } }).select('_id role name email');
  if (scpUsers.length !== scpUserIds.length) {
    throw new ApiError(httpStatus.NOT_FOUND, 'One or more SCP users not found');
  }

  // Check if all users are actually SCP users
  const nonScpUsers = scpUsers.filter(user => user.role !== 'scp-user');
  if (nonScpUsers.length > 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, `Users ${nonScpUsers.map(u => u.name).join(', ')} are not SCP users`);
  }

  let updated = false;
  const sharedScpUsers = [];
  const updatedScpUsers = [];
  const skippedScpUsers = [];

  // Process each SCP user
  for (const scpUserId of scpUserIds) {
    const scpUser = scpUsers.find(user => user._id.toString() === scpUserId);

    // Check if already shared
    const existingShare = requirement.sharedWith.find(share => share.user.toString() === scpUserId);
    if (existingShare) {
      // Update existing share to grant SCP update permissions
      const hadScpPermissions = existingShare.canUpdateScpData;
      existingShare.canUpdateScpData = true;
      existingShare.sharedBy = adminId;
      existingShare.sharedAt = new Date();
      updated = true;

      if (hadScpPermissions) {
        skippedScpUsers.push({
          userId: scpUser._id,
          userName: scpUser.name,
          userEmail: scpUser.email,
          reason: 'Already had SCP permissions'
        });
      } else {
        updatedScpUsers.push({
          userId: scpUser._id,
          userName: scpUser.name,
          userEmail: scpUser.email,
          previousPermissions: hadScpPermissions,
          newPermissions: true
        });
      }
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

      sharedScpUsers.push({
        userId: scpUser._id,
        userName: scpUser.name,
        userEmail: scpUser.email,
        permissions: {
          canUpdateScpData: true,
          scpDataUpdated: false
        }
      });
    }
  }

  if (updated) {
    await requirement.save();
  }

  // Log the SCP requirement sharing activity
  try {
    await logActivity(req, {
      action: 'share',
      targetModel: 'Requirement',
      targetId: requirementId,
      targetName: requirement.projectName,
      description: `Shared requirement with SCP users: ${requirement.projectName} - ${sharedScpUsers.length} new shares, ${updatedScpUsers.length} permission updates for customer lead: ${lead.customerName}`,
      metadata: {
        requirementData: {
          projectName: requirement.projectName,
          requirementType: requirement.requirementType,
          urgency: requirement.urgency,
          budget: requirement.budget
        },
        leadId: lead._id,
        leadName: lead.customerName,
        scpSharing: true,
        sharedScpUsers: sharedScpUsers,
        updatedScpUsers: updatedScpUsers,
        skippedScpUsers: skippedScpUsers,
        totalScpUsers: scpUserIds.length,
        newShares: sharedScpUsers.length,
        permissionUpdates: updatedScpUsers.length,
        skipped: skippedScpUsers.length,
        projectId: requirement.project,
        sharedBy: adminId,
        sharedByModel: req.user.role === 'Admin' ? 'Admin' : 'User'
      }
    });
  } catch (error) {
    console.error('Error logging SCP requirement sharing:', error);
  }

  // Log individual SCP user sharing if there are new shares
  for (const scpUser of sharedScpUsers) {
    try {
      await logActivity(req, {
        action: 'share',
        targetModel: 'User',
        targetId: scpUser.userId,
        targetName: scpUser.userName,
        description: `Shared requirement with SCP user: ${requirement.projectName} - ${scpUser.userName} (${scpUser.userEmail}) with SCP update permissions`,
        metadata: {
          requirementId: requirementId,
          requirementName: requirement.projectName,
          leadId: lead._id,
          leadName: lead.customerName,
          userRole: 'scp-user',
          scpPermissions: scpUser.permissions,
          sharedBy: adminId,
          sharedByModel: req.user.role === 'Admin' ? 'Admin' : 'User'
        }
      });
    } catch (error) {
      console.error('Error logging individual SCP user sharing:', error);
    }
  }

  // Log individual SCP user permission updates if there are updates
  for (const scpUser of updatedScpUsers) {
    try {
      await logActivity(req, {
        action: 'update',
        targetModel: 'User',
        targetId: scpUser.userId,
        targetName: scpUser.userName,
        description: `Updated SCP permissions for user: ${requirement.projectName} - ${scpUser.userName} (${scpUser.userEmail})`,
        changes: {
          canUpdateScpData: {
            from: scpUser.previousPermissions,
            to: scpUser.newPermissions
          }
        },
        metadata: {
          requirementId: requirementId,
          requirementName: requirement.projectName,
          leadId: lead._id,
          leadName: lead.customerName,
          userRole: 'scp-user',
          permissionUpdate: true,
          updatedBy: adminId,
          updatedByModel: req.user.role === 'Admin' ? 'Admin' : 'User'
        }
      });
    } catch (error) {
      console.error('Error logging SCP user permission update:', error);
    }
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
export const updateScpDataByScpUserService = async (req, leadId, requirementId, scpUserId, scpData, files = []) => {
  const requirement = await Requirement.findOne({ _id: requirementId, lead: leadId });
  if (!requirement) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Requirement not found for this lead');
  }

  // Get lead information for logging
  const lead = await getCustomerLeadByIdService(leadId);
  if (!lead) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Customer lead not found');
  }

  // Get SCP user information for logging
  const scpUser = await User.findById(scpUserId).select('_id name email role');
  if (!scpUser) {
    throw new ApiError(httpStatus.NOT_FOUND, 'SCP user not found');
  }

  // Remove permission validation - SCP users now have full access to update SCP data
  // Check if the user is shared with this requirement (but don't require canUpdateScpData permission)
  const userShare = requirement.sharedWith.find(share =>
    share.user.toString() === scpUserId
  );

  if (!userShare) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You are not shared with this requirement');
  }

  // Store original SCP data for change detection
  const originalScpData = { ...requirement.scpData };
  const originalFiles = [...requirement.files];

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

  // Detect changes in SCP data
  const scpDataChanges = {};
  Object.keys(scpData).forEach(key => {
    if (originalScpData[key] !== scpData[key]) {
      scpDataChanges[key] = {
        from: originalScpData[key],
        to: scpData[key]
      };
    }
  });

  // Detect file changes
  const fileChanges = {
    filesAdded: newlyCopiedFiles.length,
    filesExisting: existingFiles.length,
    totalFiles: allFiles.length,
    previousFileCount: originalFiles.length
  };

  // Log the SCP data update activity
  try {
    await logActivity(req, {
      action: 'update',
      targetModel: 'Requirement',
      targetId: requirementId,
      targetName: requirement.projectName,
      description: `Updated SCP data: ${requirement.projectName} by SCP user: ${scpUser.name} for customer lead: ${lead.customerName}`,
      changes: scpDataChanges,
      metadata: {
        requirementData: {
          projectName: requirement.projectName,
          requirementType: requirement.requirementType,
          urgency: requirement.urgency,
          budget: requirement.budget
        },
        leadId: lead._id,
        leadName: lead.customerName,
        scpDataUpdate: true,
        scpUser: {
          userId: scpUser._id,
          userName: scpUser.name,
          userEmail: scpUser.email,
          userRole: scpUser.role
        },
        scpDataChanges: Object.keys(scpDataChanges),
        fileChanges: fileChanges,
        newlyCopiedFiles: newlyCopiedFiles.map(file => ({
          fileType: file.fileType,
          originalName: file.originalName,
          key: file.key
        })),
        existingFiles: existingFiles.map(file => ({
          fileType: file.fileType,
          originalName: file.originalName,
          key: file.key
        })),
        updatedFields: Object.keys(scpData),
        lastUpdatedBy: scpUserId,
        lastUpdatedAt: new Date(),
        updatedBy: scpUserId,
        updatedByModel: 'SCPUser'
      }
    });
  } catch (error) {
    console.error('Error logging SCP data update:', error);
  }

  // Log individual file operations if there are new files
  for (const newFile of newlyCopiedFiles) {
    try {
      await logActivity(req, {
        action: 'upload',
        targetModel: 'File',
        targetId: newFile.key,
        targetName: newFile.originalName,
        description: `Uploaded SCP file: ${newFile.originalName} (${newFile.fileType}) for requirement: ${requirement.projectName}`,
        metadata: {
          requirementId: requirementId,
          requirementName: requirement.projectName,
          leadId: lead._id,
          leadName: lead.customerName,
          fileData: {
            fileType: newFile.fileType,
            originalName: newFile.originalName,
            key: newFile.key,
            uploadedAt: newFile.uploadedAt
          },
          scpUser: {
            userId: scpUser._id,
            userName: scpUser.name,
            userEmail: scpUser.email
          },
          uploadedBy: scpUserId,
          uploadedByModel: 'SCPUser'
        }
      });
    } catch (error) {
      console.error('Error logging SCP file upload:', error);
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
export const updateScpDataByAdminService = async (req, leadId, requirementId, adminId, scpData, files = []) => {
  const requirement = await Requirement.findOne({ _id: requirementId, lead: leadId });
  if (!requirement) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Requirement not found for this lead');
  }

  // Get lead information for logging
  const lead = await getCustomerLeadByIdService(leadId);
  if (!lead) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Customer lead not found');
  }

  // Get admin information for logging
  const admin = await User.findById(adminId).select('_id name email role');
  if (!admin) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Admin user not found');
  }

  // Store original SCP data for change detection
  const originalScpData = { ...requirement.scpData };

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

  // Detect changes in SCP data
  const scpDataChanges = {};
  Object.keys(scpData).forEach(key => {
    if (originalScpData[key] !== scpData[key]) {
      scpDataChanges[key] = {
        from: originalScpData[key],
        to: scpData[key]
      };
    }
  });

  // Detect file changes
  // const fileChanges = {
  //   filesAdded: newlyCopiedFiles.length,
  //   filesExisting: existingFiles.length,
  //   totalFiles: allFiles.length,
  //   previousFileCount: requirement.files.length - allFiles.length + existingFiles.length
  // };

  // Log the admin SCP data update activity
  try {
    await logActivity(req, {
      action: 'update',
      targetModel: 'Requirement',
      targetId: requirementId,
      targetName: requirement.projectName,
      description: `Updated SCP data by admin: ${requirement.projectName} - ${admin.name} for customer lead: ${lead.customerName}`,
      changes: scpDataChanges,
      metadata: {
        projectId: requirement.project,
        requirementData: {
          projectName: requirement.projectName,
          requirementType: requirement.requirementType,
          urgency: requirement.urgency,
          budget: requirement.budget
        },
        leadId: lead._id,
        leadName: lead.customerName,
        scpDataUpdate: true,
        adminUpdate: true,
        admin: {
          userId: admin._id,
          userName: admin.name,
          userEmail: admin.email,
          userRole: admin.role
        },
        scpDataChanges: Object.keys(scpDataChanges),
        fileChanges: fileChanges,
        // newlyCopiedFiles: newlyCopiedFiles.map(file => ({
        //   fileType: file.fileType,
        //   originalName: file.originalName,
        //   key: file.key
        // })),
        // existingFiles: existingFiles.map(file => ({
        //   fileType: file.fileType,
        //   originalName: file.originalName,
        //   key: file.key
        // })),
        updatedFields: Object.keys(scpData),
        lastUpdatedBy: adminId,
        lastUpdatedAt: new Date(),
        updatedBy: adminId,
        updatedByModel: 'Admin'
      }
    });
  } catch (error) {
    console.error('Error logging admin SCP data update:', error);
  }

  // Log individual file operations if there are new files
  // for (const newFile of newlyCopiedFiles) {
  //   try {
  //     await logActivity(req, {
  //       action: 'upload',
  //       targetModel: 'File',
  //       targetId: newFile.key,
  //       targetName: newFile.originalName,
  //       description: `Uploaded SCP file by admin: ${newFile.originalName} (${newFile.fileType}) for requirement: ${requirement.projectName}`,
  //       metadata: {
  //         requirementId: requirementId,
  //         requirementName: requirement.projectName,
  //         leadId: lead._id,
  //         leadName: lead.customerName,
  //         fileData: {
  //           fileType: newFile.fileType,
  //           originalName: newFile.originalName,
  //           key: newFile.key,
  //           uploadedAt: newFile.uploadedAt
  //         },
  //         admin: {
  //           userId: admin._id,
  //           userName: admin.name,
  //           userEmail: admin.email
  //         },
  //         uploadedBy: adminId,
  //         uploadedByModel: 'Admin'
  //       }
  //     });
  //   } catch (error) {
  //     console.error('Error logging admin SCP file upload:', error);
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
export const deleteFileFromRequirementService = async (req, leadId, requirementId, fileKey, userId) => {
  const requirement = await Requirement.findOne({ _id: requirementId, lead: leadId });
  if (!requirement) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Requirement not found for this lead');
  }

  // Get lead information for logging
  const lead = await getCustomerLeadByIdService(leadId);
  if (!lead) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Customer lead not found');
  }

  // Get user information for logging
  const user = await User.findById(userId).select('_id name email role');
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  // Find the file in the requirement's files array
  const fileIndex = requirement.files.findIndex(file => file.key === fileKey);
  if (fileIndex === -1) {
    throw new ApiError(httpStatus.NOT_FOUND, 'File not found in this requirement');
  }

  const fileToDelete = requirement.files[fileIndex];

  // Store file information for logging before deletion
  const fileInfo = {
    fileType: fileToDelete.fileType,
    originalName: fileToDelete.originalName,
    key: fileToDelete.key,
    uploadedAt: fileToDelete.uploadedAt
  };

  // Store file count before deletion for change tracking
  const filesBeforeDeletion = requirement.files.length;

  try {
    // Delete the file from S3
    await storage.deleteFile(fileKey);

    // Remove the file from the requirement's files array
    requirement.files.splice(fileIndex, 1);

    // Update the last modified information
    requirement.scpData.lastUpdatedBy = userId;
    requirement.scpData.lastUpdatedAt = new Date();

    await requirement.save();

    // Log the file deletion activity
    try {
      await logActivity(req, {
        action: 'delete',
        targetModel: 'File',
        targetId: fileKey,
        targetName: fileToDelete.originalName,
        description: `Deleted SCP file: ${fileToDelete.originalName} (${fileToDelete.fileType}) from requirement: ${requirement.projectName}`,
        changes: {
          fileDeleted: {
            from: fileInfo,
            to: null
          },
          fileCount: {
            from: filesBeforeDeletion,
            to: requirement.files.length
          }
        },
        metadata: {
          requirementData: {
            projectName: requirement.projectName,
            requirementType: requirement.requirementType,
            urgency: requirement.urgency,
            budget: requirement.budget
          },
          leadId: lead._id,
          leadName: lead.customerName,
          fileDeletion: true,
          fileInfo: fileInfo,
          user: {
            userId: user._id,
            userName: user.name,
            userEmail: user.email,
            userRole: user.role
          },
          fileCountBefore: filesBeforeDeletion,
          fileCountAfter: requirement.files.length,
          deletedBy: userId,
          deletedAt: new Date(),
          deletedByModel: user.role === 'admin' ? 'Admin' : 'User'
        }
      });
    } catch (error) {
      console.error('Error logging file deletion:', error);
    }

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
export const deleteMultipleFilesFromRequirementService = async (req, leadId, requirementId, fileKeys, userId) => {
  const requirement = await Requirement.findOne({ _id: requirementId, lead: leadId });
  if (!requirement) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Requirement not found for this lead');
  }

  // Get lead information for logging
  const lead = await getCustomerLeadByIdService(leadId);
  if (!lead) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Customer lead not found');
  }

  // Get user information for logging
  const user = await User.findById(userId).select('_id name email role');
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
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

  // Store file information for logging before deletion
  const filesToDelete = requirement.files.filter(file => fileKeys.includes(file.key));
  const fileInfoBeforeDeletion = filesToDelete.map(file => ({
    fileType: file.fileType,
    originalName: file.originalName,
    key: file.key,
    uploadedAt: file.uploadedAt
  }));

  // Store file count before deletion for change tracking
  const filesBeforeDeletion = requirement.files.length;

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

  // Log the bulk file deletion activity
  try {
    await logActivity(req, {
      action: 'bulk_delete',
      targetModel: 'File',
      targetId: requirementId,
      targetName: `Multiple files from ${requirement.projectName}`,
      description: `Bulk deleted ${deletedFiles.length} files from requirement: ${requirement.projectName}`,
      changes: {
        filesDeleted: {
          from: fileInfoBeforeDeletion,
          to: []
        },
        fileCount: {
          from: filesBeforeDeletion,
          to: requirement.files.length
        },
        deletionResults: {
          totalRequested: fileKeys.length,
          totalDeleted: deletedFiles.length,
          totalFailed: failedDeletions.length
        }
      },
      metadata: {
        requirementData: {
          projectName: requirement.projectName,
          requirementType: requirement.requirementType,
          urgency: requirement.urgency,
          budget: requirement.budget
        },
        leadId: lead._id,
        leadName: lead.customerName,
        bulkFileDeletion: true,
        filesDeleted: deletedFiles,
        filesFailed: failedDeletions,
        fileInfoBeforeDeletion: fileInfoBeforeDeletion,
        user: {
          userId: user._id,
          userName: user.name,
          userEmail: user.email,
          userRole: user.role
        },
        fileCountBefore: filesBeforeDeletion,
        fileCountAfter: requirement.files.length,
        deletedBy: userId,
        deletedAt: new Date(),
        deletedByModel: user.role === 'admin' ? 'Admin' : 'User',
        deletionSummary: {
          totalRequested: fileKeys.length,
          totalDeleted: deletedFiles.length,
          totalFailed: failedDeletions.length,
          successRate: `${Math.round((deletedFiles.length / fileKeys.length) * 100)}%`
        }
      }
    });
  } catch (error) {
    console.error('Error logging bulk file deletion:', error);
  }

  // Log individual file deletion for each successfully deleted file
  for (const fileKey of deletedFiles) {
    const fileInfo = fileInfoBeforeDeletion.find(f => f.key === fileKey);
    if (fileInfo) {
      try {
        await logActivity(req, {
          action: 'delete',
          targetModel: 'File',
          targetId: fileKey,
          targetName: fileInfo.originalName,
          description: `Deleted file: ${fileInfo.originalName} (${fileInfo.fileType}) from requirement: ${requirement.projectName}`,
          changes: {
            fileDeleted: {
              from: fileInfo,
              to: null
            }
          },
          metadata: {
            requirementId: requirementId,
            requirementName: requirement.projectName,
            leadId: lead._id,
            leadName: lead.customerName,
            fileDeletion: true,
            fileInfo: fileInfo,
            user: {
              userId: user._id,
              userName: user.name,
              userEmail: user.email,
              userRole: user.role
            },
            deletedBy: userId,
            deletedAt: new Date(),
            deletedByModel: user.role === 'admin' ? 'Admin' : 'User',
            partOfBulkOperation: true,
            bulkOperationId: requirementId
          }
        });
      } catch (error) {
        console.error('Error logging individual file deletion:', error);
      }
    }
  }

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
    .populate('lead', 'customerName mobileNumber email state city') // populate necessary lead fields
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
    whatsappNumber: ['whatsappnumber', 'whatsapp number', 'whatsapp'],
    email: ['email', 'email address'],
    preferredLanguages: ['preferredlanguages', 'preferred languages', 'languages'],
    state: ['state'],
    city: ['city'],
    town: ['town', 'townvillage', 'town village'],

    // Requirement specific
    requirementType: ['requirementtype', 'requirement type'],
    projectName: ['projectname', 'project name'],
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

const parseBoolean = (value) => {
  if (value === null || value === undefined) return undefined;
  const strVal = String(value).toLowerCase().trim();
  if (['true', '1', 'yes', 'y'].includes(strVal)) return true;
  if (['false', '0', 'no', 'n'].includes(strVal)) return false;
  return undefined;
};

// Generate password: first word of name + @ + 123
const generatePassword = (customerName) => {
  if (!customerName) return 'Customer@123';
  const firstWord = customerName.trim().split(' ')[0];
  return `${firstWord}@123`;
};

// Field validation options (matching CustomerLeadForm)
const leadSourceOptions = ['Meta Ads', 'WhatsApp', 'Instagram', 'Referral'];
const languageOptions = ['English', 'Hindi', 'Marathi'];
const urgencyOptions = ['Immediate', 'Within 1 month', '2-3 months', 'Not Sure'];
const requirementTypeOptions = [
  'Cottage / Structure Proposal',
  'Manpower Requirement',
  'Tourism Consultancy',
  'Wants to Invest in Tourism Project',
  'Wants to Invest in Smart Orbiters',
  'Seeks Tourism Infrastructure Development',
  'Other'
];

// Normalize urgency values to standard format
const normalizeUrgency = (urgency) => {
  if (!urgency) return urgency;

  const urgencyLower = urgency.toLowerCase().trim();

  // Map common variations to standard values
  if (urgencyLower.includes('immediate') || urgencyLower.includes('urgent') || urgencyLower === 'high') {
    return 'Immediate';
  } else if (urgencyLower.includes('1 month') || urgencyLower.includes('within 1 month')) {
    return 'Within 1 month';
  } else if (urgencyLower.includes('2-3') || urgencyLower.includes('2 to 3') || urgencyLower.includes('2 months') || urgencyLower === 'medium') {
    return '2-3 months';
  } else if (urgencyLower.includes('not sure') || urgencyLower.includes('unsure') || urgencyLower === 'low') {
    return 'Not Sure';
  }

  return urgency; // Return original if no match
};

// Validate field values against allowed options (lenient validation)
const validateFieldOptions = (fieldName, value) => {
  if (!value) return true; // Empty values are allowed

  switch (fieldName) {
    case 'leadSource':
      // Allow any non-empty value for lead source
      return value.trim() !== '';
    case 'preferredLanguages':
      // Allow any languages, just check they're not empty
      const languages = value.split(',').map(lang => lang.trim());
      return languages.every(lang => lang.trim() !== '');
    case 'urgency':
      // Allow common urgency variations
      const urgencyLower = value.toLowerCase().trim();
      return urgencyOptions.some(option =>
        option.toLowerCase() === urgencyLower ||
        urgencyLower.includes('immediate') ||
        urgencyLower.includes('high') ||
        urgencyLower.includes('urgent') ||
        urgencyLower.includes('medium') ||
        urgencyLower.includes('low') ||
        urgencyLower.includes('month') ||
        urgencyLower.includes('sure')
      );
    case 'requirementType':
      // Allow any non-empty requirement type
      return value.trim() !== '';
    default:
      return true;
  }
};

// Helper function to process requirement and create project (extracted from createCustomerLeadService)
const processRequirementAndProject = async (req, lead, requirementData, session) => {
  const requirementId = new mongoose.Types.ObjectId();
  const files = [];

  // Check if req.user exists, if not use a default admin user ID
  const createdBy = req?.user?.id || '000000000000000000000000'; // Default admin ID
  const createdByModel = req?.user?.constructor?.modelName || 'Admin';

  // Handle file processing if needed (for now, empty files array)
  const fileKeys = {
    imageUrlKeys: requirementData.imageUrlKeys || [],
    videoUrlKeys: requirementData.videoUrlKeys || [],
    voiceMessageUrlKeys: requirementData.voiceMessageUrlKeys || [],
    sketchUrlKeys: requirementData.sketchUrlKeys || [],
  };

  for (const [type, keys] of Object.entries(fileKeys)) {
    for (const tempKey of keys) {
      const fileType = type.replace('UrlKeys', '');
      const fileName = tempKey.split('/').pop();
      const permanentKey = `customer-leads/${lead._id}/${requirementId}/${fileType}/${fileName}`;
      await storage.copyFile(tempKey, permanentKey);
      files.push({ fileType, key: permanentKey });
    }
  }

  // Create Requirement document
  const requirement = await Requirement.create([{
    _id: requirementId,
    lead: lead._id,
    projectName: requirementData.projectName,
    requirementType: requirementData.requirementType,
    otherRequirement: requirementData.otherRequirement,
    requirementDescription: requirementData.requirementDescription,
    urgency: requirementData.urgency,
    budget: requirementData.budget,
    scpData: requirementData.scpData || {},
    files,
    sharedWith: [],
  }], { session });

  // Create a project and link back to requirement
  const project = await createProject({
    projectName: requirementData.projectName,
    requirement: requirementId,
    lead: lead._id,
    budget: requirementData.budget ? parseFloat(requirementData.budget.replace(/[^0-9.-]+/g, '')) : 0,
    createdBy: createdBy,
    createdByModel: createdByModel,
  }, session);

  // Update the requirement with the project ID
  await Requirement.findByIdAndUpdate(requirementId, {
    project: project._id,
  }, { session });

  // Add requirement to lead
  lead.requirements.push(requirementId);

  // Simplified import - no SCP sharing, site visits, or project assignment payments
  // These can be added later through the UI if needed

  return { requirement, project };
};

export const importCustomerLeadsService = async (filePath, req) => {
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
  const headerMapping = normalizeHeaders(headers);
  // Skip the first row (headers) and second row (options/instructions)
  const rows = data.slice(2);

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
    const email = getVal('email');
    const mobileNumber = getVal('mobileNumber');
    const customerName = getVal('customerName');

    // More lenient customer identification - allow partial matches
    const customerId = email || mobileNumber || customerName || `customer_${index + 3}`;

    // Only require customer name if no other identifier is present
    if (!customerName && !email && !mobileNumber) {
      errors.push({ row: index + 3, error: 'Missing customer identifier (Email, Mobile, or Name). At least one is required.' });
      return;
    }

    // Get and normalize field values
    const leadSource = getVal('leadSource');
    const preferredLanguages = getVal('preferredLanguages');
    const urgency = getVal('urgency');
    const requirementType = getVal('requirementType');

    // Normalize urgency values to standard format
    const normalizedUrgency = normalizeUrgency(urgency);

    // Get other required fields
    const alternateContactNumber = getVal('alternateContactNumber');
    const whatsappNumber = getVal('whatsappNumber');
    const state = getVal('state');
    const city = getVal('city');
    const town = getVal('town');
    const googleLocationLink = getVal('googleLocationLink');
    const projectName = getVal('projectName');
    const requirementDescription = getVal('requirementDescription');
    const budget = getVal('budget');

    if (leadSource && !validateFieldOptions('leadSource', leadSource)) {
      errors.push({ row: index + 3, error: `Invalid leadSource: ${leadSource}. Please provide a valid lead source.` });
      return;
    }

    if (preferredLanguages && !validateFieldOptions('preferredLanguages', preferredLanguages)) {
      errors.push({ row: index + 3, error: `Invalid preferredLanguages: ${preferredLanguages}. Please provide comma-separated language values.` });
      return;
    }

    if (urgency && !validateFieldOptions('urgency', normalizedUrgency)) {
      errors.push({ row: index + 3, error: `Invalid urgency: ${urgency}. Please use values like: Immediate, High, Medium, Low, Within 1 month, 2-3 months, Not Sure.` });
      return;
    }

    if (requirementType && !validateFieldOptions('requirementType', requirementType)) {
      errors.push({ row: index + 3, error: `Invalid requirementType: ${requirementType}. Please provide a valid requirement type.` });
      return;
    }

    if (!leadsByCustomer.has(customerId)) {
      leadsByCustomer.set(customerId, {
        leadSource: leadSource || 'Meta Ads',
        customerName: customerName,
        mobileNumber: mobileNumber,
        alternateContactNumber: alternateContactNumber,
        whatsappNumber: whatsappNumber,
        preferredLanguages: preferredLanguages,
        email: email,
        state: state,
        city: city,
        town: town,
        townVillage: town,
        googleLocationLink: googleLocationLink,
        status: STATUS_ENUM.INPROGRESS,
        password: generatePassword(customerName), // Auto-generate password
        requirements: [],
        _sourceRows: [], // To track original row numbers for better error reporting
      });
    }

    const customerData = leadsByCustomer.get(customerId);
    customerData._sourceRows.push(index + 3); // Store original row number (3-based index, skipping headers and options)

    // Simplified requirement data - only basic fields
    const requirement = {
      projectName: projectName,
      requirementType: requirementType,
      requirementDescription: requirementDescription,
      urgency: normalizedUrgency || urgency, // Use normalized urgency if available
      budget: budget ? budget.toString() : undefined,
      scpData: {}, // Empty SCP data for simplified import
    };

    customerData.requirements.push(requirement);
  });

  let importedCount = 0;
  const session = await mongoose.startSession();

  try {
    await session.startTransaction();

    for (const [customerId, leadData] of leadsByCustomer.entries()) {
      const { _sourceRows, ...leadPayload } = leadData;
      const rowIdentifier = `Row(s) ${_sourceRows.join(', ')}`;

      try {
        // Find existing lead by email or mobile
        const existingLead = await CustomerLead.findOne({
          $or: [{ email: leadPayload.email }, { mobileNumber: leadPayload.mobileNumber }],
        }).session(session);

        if (existingLead) {
          // If lead exists, add new requirements and create projects
          for (const requirementData of leadPayload.requirements) {
            await processRequirementAndProject(req, existingLead, requirementData, session);
          }
        } else {
          // Create new lead with simplified functionality
          const { requirements, password, ...basicLeadInfo } = leadPayload;

          const leadPayloadData = {
            ...basicLeadInfo,
            createdBy: createdBy,
            createdByModel: createdByModel,
            status: STATUS_ENUM.INPROGRESS,
            requirements: [],
          };

          const lead = (await CustomerLead.create([leadPayloadData], { session }))[0];

          // Process each requirement and create projects
          for (const requirementData of requirements) {
            await processRequirementAndProject(req, lead, requirementData, session);
          }

          // Update lead with requirement references
          lead.requirements = lead.requirements;
          await lead.save({ session });

          // Create user account if password is provided
          if (password) {
            try {
              await createUser(req, {
                name: leadPayloadData.customerName,
                email: leadPayloadData.email,
                password: password,
              });
            } catch (userError) {
              console.error('Error creating user account:', userError);
              // Don't fail the import if user creation fails
            }
          }
        }

        importedCount++;
      } catch (dbError) {
        const errorMessage = `Failed to process lead. Reason: ${dbError.message}`;
        errors.push({ customerId, error: errorMessage, location: rowIdentifier });
      }
    }

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }

  return { importedCount, errors };
};

export const generateSampleCustomerLeadsCSV = () => {
  const sampleData = [
    // Headers with field type indicators
    [
      'customerName (MANDATORY)',
      'email (MANDATORY)',
      'mobileNumber (MANDATORY)',
      'alternateContactNumber (OPTIONAL)',
      'whatsappNumber (OPTIONAL)',
      'preferredLanguages (OPTIONAL)',
      'leadSource (MANDATORY)',
      'state (MANDATORY)',
      'city (MANDATORY)',
      'town (OPTIONAL)',
      'googleLocationLink (OPTIONAL)',
      'requirementType (MANDATORY)',
      'projectName (MANDATORY)',
      'requirementDescription (MANDATORY)',
      'urgency (MANDATORY)',
      'budget (MANDATORY)'
    ],
    // Field options and validation rules
    [
      'Enter Full Name',
      'Enter Email Address',
      'Enter Contact Number',
      'Enter Alternate Contact Number',
      'Enter WhatsApp Number',
      'English, Hindi, Marathi (comma-separated)',
      'Meta Ads, WhatsApp, Instagram, Referral',
      'Maharashtra, Karnataka, Delhi, Gujarat, Tamil Nadu, etc.',
      'Mumbai, Bangalore, New Delhi, Ahmedabad, Chennai, etc.',
      'Enter Town/Village Name',
      'Enter Google Maps Link',
      'Cottage / Structure Proposal, Manpower Requirement, Tourism Consultancy, etc.',
      'Enter Project Name',
      'Enter Project Description',
      'Immediate, Within 1 month, 2-3 months, Not Sure',
      'Enter Budget Amount (numbers only)'
    ],
    // Sample data row 1 - Residential Project
    [
      'John Doe',
      'john.doe@example.com',
      '9876543210',
      '9876543211',
      '9876543210',
      'English,Hindi',
      'Meta Ads',
      'Maharashtra',
      'Mumbai',
      'Andheri',
      'https://maps.google.com/example',
      'Cottage / Structure Proposal',
      'Residential Villa Project',
      'Need a 3BHK villa with modern amenities',
      'Immediate',
      '5000000'
    ],
    // Sample data row 2 - Commercial Project
    [
      'Jane Smith',
      'jane.smith@example.com',
      '9876543212',
      '',
      '9876543212',
      'English',
      'Meta Ads',
      'Karnataka',
      'Bangalore',
      'Whitefield',
      'https://maps.google.com/example2',
      'Manpower Requirement',
      'Office Space Project',
      'Need office space for 50 employees',
      'Within 1 month',
      '10000000'
    ],
    // Sample data row 3 - Different Lead Source
    [
      'Rajesh Kumar',
      'rajesh.kumar@example.com',
      '9876543213',
      '9876543214',
      '9876543213',
      'Hindi,English',
      'WhatsApp',
      'Delhi',
      'New Delhi',
      'Connaught Place',
      'https://maps.google.com/example3',
      'Tourism Consultancy',
      'Home Renovation Project',
      'Complete home renovation with modern design',
      '2-3 months',
      '2000000'
    ],
    // Sample data row 4 - Instagram Lead
    [
      'Priya Sharma',
      'priya.sharma@example.com',
      '9876543215',
      '',
      '9876543215',
      'English',
      'Instagram',
      'Gujarat',
      'Ahmedabad',
      'Vastrapur',
      'https://maps.google.com/example4',
      'Wants to Invest in Tourism Project',
      'Modern Interior Design',
      'Complete interior design for 2BHK apartment',
      'Not Sure',
      '1500000'
    ]
  ];

  const worksheet = xlsx.utils.aoa_to_sheet(sampleData);

  // Set column widths for better readability
  const columnWidths = [
    { wch: 25 }, // customerName
    { wch: 30 }, // email
    { wch: 18 }, // mobileNumber
    { wch: 30 }, // alternateContactNumber
    { wch: 22 }, // whatsappNumber
    { wch: 35 }, // preferredLanguages
    { wch: 15 }, // leadSource
    { wch: 20 }, // state
    { wch: 20 }, // city
    { wch: 20 }, // town
    { wch: 40 }, // googleLocationLink
    { wch: 30 }, // requirementType
    { wch: 30 }, // projectName
    { wch: 40 }, // requirementDescription
    { wch: 15 }, // urgency
    { wch: 15 }  // budget
  ];

  worksheet['!cols'] = columnWidths;

  // Add data validation for dropdown options
  const dataValidation = [];

  // Lead Source dropdown (Column G)
  dataValidation.push({
    ref: 'G3:G1000', // Apply to all data rows
    type: 'list',
    allowBlank: false,
    showDropDown: true,
    formula1: '"Meta Ads,WhatsApp,Instagram,Referral"'
  });

  // Preferred Languages dropdown (Column F)
  dataValidation.push({
    ref: 'F3:F1000',
    type: 'list',
    allowBlank: true,
    showDropDown: true,
    formula1: '"English,Hindi,Marathi"'
  });

  // State dropdown (Column H) - Major Indian states
  dataValidation.push({
    ref: 'H3:H1000',
    type: 'list',
    allowBlank: false,
    showDropDown: true,
    formula1: '"Maharashtra,Karnataka,Delhi,Gujarat,Tamil Nadu,West Bengal,Uttar Pradesh,Rajasthan,Madhya Pradesh,Andhra Pradesh,Telangana,Kerala,Punjab,Haryana,Bihar,Odisha,Assam,Chhattisgarh,Jharkhand,Uttarakhand,Himachal Pradesh,Tripura,Meghalaya,Manipur,Nagaland,Goa,Arunachal Pradesh,Mizoram,Sikkim"'
  });

  // Requirement Type dropdown (Column L)
  dataValidation.push({
    ref: 'L3:L1000',
    type: 'list',
    allowBlank: false,
    showDropDown: true,
    formula1: '"Cottage / Structure Proposal,Manpower Requirement,Tourism Consultancy,Wants to Invest in Tourism Project,Wants to Invest in Smart Orbiters,Seeks Tourism Infrastructure Development,Other"'
  });

  // Urgency dropdown (Column O)
  dataValidation.push({
    ref: 'O3:O1000',
    type: 'list',
    allowBlank: false,
    showDropDown: true,
    formula1: '"Immediate,Within 1 month,2-3 months,Not Sure"'
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
    ['Lead Source', 'Meta Ads, WhatsApp, Instagram, Referral', 'Select how the customer found you'],
    ['Preferred Languages', 'English, Hindi, Marathi', 'Comma-separated for multiple languages'],
    ['State', 'Maharashtra, Karnataka, Delhi, Gujarat, Tamil Nadu, West Bengal, Uttar Pradesh, Rajasthan, Madhya Pradesh, Andhra Pradesh, Telangana, Kerala, Punjab, Haryana, Bihar, Odisha, Assam, Chhattisgarh, Jharkhand, Uttarakhand, Himachal Pradesh, Tripura, Meghalaya, Manipur, Nagaland, Goa, Arunachal Pradesh, Mizoram, Sikkim', 'Select the state where the customer is located'],
    ['Requirement Type', 'Cottage / Structure Proposal, Manpower Requirement, Tourism Consultancy, Wants to Invest in Tourism Project, Wants to Invest in Smart Orbiters, Seeks Tourism Infrastructure Development, Other', 'Type of project the customer needs'],
    ['Urgency', 'Immediate, Within 1 month, 2-3 months, Not Sure', 'How urgent is this project'],
    ['Budget', 'Enter numeric value only (e.g., 5000000)', 'Project budget in rupees'],
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
  xlsx.utils.book_append_sheet(workbook, worksheet, 'Customer Leads Sample');
  xlsx.utils.book_append_sheet(workbook, helperWorksheet, 'Field Options & Help');

  return xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
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
