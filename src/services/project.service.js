import Project from '../models/project.model.js';
import CustomerLead from '../models/customerLead.model.js';
import ApiError from '../utils/ApiError.js';
import { mongoose, isValidObjectId } from 'mongoose';
import Requirement from '../models/requirement.model.js';
import User from '../models/user.model.js';
import Admin from '../models/admin.model.js';
import httpStatus from 'http-status';
import storage from '../factory/storage.factory.js';
import Sitework from '../models/sitework.model.js';
import Roles from '../config/enums/roles.enum.js';
import ProjectAssignmentPayment from '../models/projectAssignmentPaymant.model.js';
import { STATUS_VALUES } from '../config/enums/status.enum.js';
import { STATUS_ENUM } from '../config/enums/status.enum.js';
import { updateProjectStatusWithReflection } from './statusCascade.service.js';
import Attachment from '../models/attachment.model.js';
import { logActivity } from '../middlewares/activityLog.middleware.js';

/**
 * Generates a unique project code.
 * The code format will be `PROJ-<timestamp>-<random-4-digits>`.
 * @returns {Promise<string>}
 */
const generateProjectCode = async () => {
  const timestamp = new Date().getTime().toString().slice(-6); // Last 6 digits of timestamp
  const random = Math.floor(1000 + Math.random() * 9000); // 4 random digits
  const projectCode = `PROJ-${timestamp}${random}`;

  // Check for uniqueness
  const existingProject = await Project.findOne({ projectCode });
  if (existingProject) {
    return generateProjectCode(); // Recurse if code already exists
  }
  return projectCode;
};


/**
 * Create a project
 * @param {Object} projectBody
 * @returns {Promise<Project>}
 */
export const createProject = async (projectBody, session) => {
  const projectCode = await generateProjectCode();
  const [project] = await Project.create([{ ...projectBody, projectCode }], { session });
  return project;
};

/**
 * Query for projects with pagination, sorting, and filtering
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @param {string} [options.sortBy] - "Sort option in the format: field:(desc|asc)"
 * @param {number} [options.limit] - Maximum number of results per page (default: 10)
 * @param {number} [options.page] - Current page (default: 1)
 * @returns {Promise<Object>}
 */
export const queryProjects = async (filter, options, user = null) => {
  const { limit = 10, page = 1, sortBy } = options;
  const { customerName, requirementType, projectName, ...directFilters } = filter;
  const sort = sortBy
    ? { [sortBy.split(':')[0]]: sortBy.split(':')[1] === 'desc' ? -1 : 1 }
    : { createdAt: -1 };

  const projectFilter = { ...directFilters };

  // Filter for SCP users - REMOVED: Now SCP users can see all projects like admin users
  if (user && user.role === Roles.SCP_USER) {
    const requirementsWithScpUser = await Requirement.find({
      'sharedWith.user': user._id
    }).select('_id');

    if (requirementsWithScpUser.length === 0) {
      return { results: [], page, limit, totalPages: 0, totalResults: 0 };
    }

    const requirementIds = requirementsWithScpUser.map(r => r._id);
    projectFilter.requirement = { $in: requirementIds };
  }

  // Fuzzy search for project name
  if (projectName) {
    projectFilter.projectName = { $regex: projectName, $options: 'i' };
  }

  const leadFilter = {
    status: { $nin: [STATUS_ENUM.DRAFT] }
  };

  // Filter by customer name (via lead)
  if (customerName) {
    leadFilter.customerName = { $regex: customerName, $options: 'i' };
  }

  const leads = await CustomerLead.find(leadFilter).select('_id');
  const leadIds = leads.map((l) => l._id);
  if (customerName && leadIds.length === 0) {
    return { results: [], page, limit, totalPages: 0, totalResults: 0 };
  }
  projectFilter.lead = { $in: leadIds };


  // Filter by requirementType (from Requirement collection)
  if (requirementType) {
    const matchingRequirements = await Requirement.find({
      requirementType,
    }).select('_id');
    const reqIds = matchingRequirements.map(r => r._id);
    if (reqIds.length === 0)
      return { results: [], page, limit, totalPages: 0, totalResults: 0 };
    projectFilter.requirement = { $in: reqIds };
  }

  const projects = await Project.find(projectFilter)
    .populate('lead')
    .populate('requirement') // optional: populate requirement if needed
    .populate({
      path: 'proposals.architect',
      select: 'name email role'
    })
    .populate({
      path: 'siteVisits',
      populate: {
        path: 'siteEngineer',
        select: 'name email role'
      }
    })
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(limit);

  // Auto-sync project statuses with customer statuses
  const projectStatusMapping = {
    [STATUS_ENUM.ACTIVE]: STATUS_ENUM.ACTIVE,
    [STATUS_ENUM.INACTIVE]: STATUS_ENUM.CANCELLED,
    [STATUS_ENUM.HOLD]: STATUS_ENUM.HOLD,
    [STATUS_ENUM.COMPLETE]: STATUS_ENUM.COMPLETE,
    [STATUS_ENUM.CANCELLED]: STATUS_ENUM.CANCELLED,
    [STATUS_ENUM.INPROGRESS]: STATUS_ENUM.INPROGRESS,
    [STATUS_ENUM.DRAFT]: STATUS_ENUM.DRAFT,
  };

  // Update project statuses that don't match their customer status
  const updatePromises = projects.map(async (project) => {
    if (project.lead && project.lead.status) {
      const customerStatus = project.lead.status;
      const expectedProjectStatus = projectStatusMapping[customerStatus] || STATUS_ENUM.DRAFT;

      if (project.status !== expectedProjectStatus) {
        project.status = expectedProjectStatus;
        await project.save();
      }
    }
  });

  await Promise.all(updatePromises);

  const totalResults = await Project.countDocuments(projectFilter);

  return {
    results: projects,
    page,
    limit,
    totalPages: Math.ceil(totalResults / limit),
    totalResults,
  };
};

/**
 * Add a proposal from an architect to a project
 * @param {string} projectId - The ID of the project
 * @param {Object} architect - The authenticated user object (architect)
 * @param {Object} proposalBody - The proposal details
 * @returns {Promise<Project>}
 */
export const addArchitectProposal = async (req, projectId, architect, proposalBody) => {
  const project = await Project.findById(projectId);
  if (!project) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
  }

  // // Check if the architect has already submitted a proposal
  // const existingProposal = project.proposals.find(
  //   (p) => p.architect.toString() === architect.id.toString()
  // );
  // if (existingProposal) {
  //   throw new ApiError(httpStatus.BAD_REQUEST, 'You have already submitted a proposal for this project.');
  // }

  // Store original project data for logging
  const originalProposalsCount = project.proposals.length;
  const originalProposals = [...project.proposals];

  // Create and add the new proposal
  const newProposal = {
    ...proposalBody,
    architect: architect.id,
  };

  project.proposals.push(newProposal);
  await project.save();

  // Get the newly added proposal (last one in the array)
  const addedProposal = project.proposals[project.proposals.length - 1];

  // Log the architect proposal submission activity
  try {
    console.log('Creating activity log for architect proposal submission:', {
      architectName: architect.name,
      architectEmail: architect.email,
      projectName: project.projectName,
      description: 'Vendor Send Proposal to Admin'
    });
    
    await logActivity(req, {
      action: 'submit_proposal',
      targetModel: 'Project',
      targetId: project._id,
      targetName: project.projectName,
      description: `Vendor Send Proposal to Admin`,
      changes: {
        proposals: {
          from: originalProposalsCount,
          to: project.proposals.length
        }
      },
      metadata: {
        projectId: project._id,
        projectData: {
          projectId: project._id,
          projectName: project.projectName,
          projectCode: project.projectCode,
          status: project.status,
          customerName: project.customerName,
          requirementType: project.requirementType
        },
        architect: {
          userId: architect.id,
          userName: architect.name,
          userEmail: architect.email,
          userRole: architect.role
        },
        proposalData: {
          proposalId: addedProposal._id,
          email: addedProposal.email,
          proposedCharges: addedProposal.proposedCharges,
          deliveryTimelineDays: addedProposal.deliveryTimelineDays,
          portfolioLink: addedProposal.portfolioLink,
          remarks: addedProposal.remarks,
          status: addedProposal.status || 'Pending',
          submittedAt: addedProposal.submittedAt || new Date()
        },
        proposalSubmission: true,
        proposalCount: project.proposals.length,
        originalProposalCount: originalProposalsCount,
        submittedBy: architect.id,
        submittedByModel: 'Architect',
        submittedAt: new Date()
      }
    });
    
    console.log('Activity log created successfully for architect proposal submission');
  } catch (error) {
    console.error('Error logging architect proposal submission:', error);
  }

  return project;
};

/**
 * Accept an architect's proposal
 * @param {string} projectId
 * @param {string} proposalId
 * @param {Object} adminUser - The user accepting the proposal
 * @returns {Promise<Project>}
 */
export const acceptArchitectProposal = async (req, projectId, proposalId, adminUser) => {
  const project = await Project.findById(projectId);
  if (!project) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
  }

  const proposalToAccept = project.proposals.id(proposalId);
  if (!proposalToAccept) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Proposal not found');
  }

  if (proposalToAccept.status !== 'Pending' && proposalToAccept.status !== 'Responded') {
    throw new ApiError(httpStatus.BAD_REQUEST, `Cannot accept a proposal with status '${proposalToAccept.status}'`);
  }

  // Store original data for logging
  const originalProposalStatus = proposalToAccept.status;
  const originalProjectArchitect = project.architect;
  const originalProposalData = {
    status: proposalToAccept.status,
    email: proposalToAccept.email,
    proposedCharges: proposalToAccept.proposedCharges,
    deliveryTimelineDays: proposalToAccept.deliveryTimelineDays,
    portfolioLink: proposalToAccept.portfolioLink,
    remarks: proposalToAccept.remarks,
    architect: proposalToAccept.architect
  };

  // Accept the chosen proposal
  proposalToAccept.status = 'Accepted';
  proposalToAccept.acceptedBy = adminUser._id;
  proposalToAccept.acceptedByModel = adminUser.constructor.modelName;
  proposalToAccept.acceptedAt = new Date();
  project.architect = proposalToAccept.architect; // Assign architect to the project

  await ProjectAssignmentPayment.create({
    user: proposalToAccept.architect,
    project: project._id,
    assignedAmount: proposalToAccept.proposedCharges,
  });

  // --- commented out for now ---
  // Reject all other pending proposals
  // project.proposals.forEach((p) => {
  //   if (p.id !== proposalId && (p.status === 'Pending' || p.status === 'Responded')) {
  //     p.status = 'Rejected';
  //     p.rejectedAt = new Date();
  //   }
  // });

  await project.save();

  // Log the architect proposal acceptance activity
  try {
    console.log('Creating activity log for vendor proposal approval:', {
      adminName: adminUser.name,
      adminEmail: adminUser.email,
      projectName: project.projectName,
      description: 'Vendor Proposal is Approve From Admin'
    });
    
    await logActivity(req, {
      action: 'accept_proposal',
      targetModel: 'Project',
      targetId: project._id,
      targetName: project.projectName,
      description: `Vendor Proposal is Approve From Admin`,
      changes: {
        proposalStatus: {
          from: originalProposalStatus,
          to: 'Accepted'
        },
        projectArchitect: {
          from: originalProjectArchitect,
          to: proposalToAccept.architect
        }
      },
      metadata: {
        projectId: project._id,
        projectData: {
          projectId: project._id,
          projectName: project.projectName,
          projectCode: project.projectCode,
          status: project.status,
          customerName: project.customerName,
          requirementType: project.requirementType,
          architect: project.architect
        },
        adminUser: {
          userId: adminUser._id,
          userName: adminUser.name,
          userEmail: adminUser.email,
          userRole: adminUser.role
        },
        proposalData: {
          proposalId: proposalToAccept._id,
          email: proposalToAccept.email,
          proposedCharges: proposalToAccept.proposedCharges,
          deliveryTimelineDays: proposalToAccept.deliveryTimelineDays,
          portfolioLink: proposalToAccept.portfolioLink,
          remarks: proposalToAccept.remarks,
          architect: proposalToAccept.architect,
          status: proposalToAccept.status,
          acceptedAt: proposalToAccept.acceptedAt
        },
        originalProposalData,
        proposalAcceptance: true,
        architectAssignment: true,
        paymentAssignment: true,
        assignedAmount: proposalToAccept.proposedCharges,
        acceptedBy: adminUser._id,
        acceptedByModel: adminUser.constructor.modelName,
        acceptedAt: new Date()
      }
    });
    
    console.log('Activity log created successfully for vendor proposal approval');
  } catch (error) {
    console.error('Error logging architect proposal acceptance:', error);
  }

  return project;
};

/**
 * Get all proposals for a specific project
 * @param {string} projectId
 * @returns {Promise<ArchitectProposal[]>}
 */
export const getProposalsForProject = async (projectId) => {
  const project = await Project.findById(projectId).populate({
    path: 'proposals.architect',
    select: 'name email',
  });

  if (!project) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
  }

  // Transform proposals to include all necessary fields
  const proposals = project.proposals.map(proposal => ({
    _id: proposal._id,
    architect: proposal.architect,
    email: proposal.email,
    proposedCharges: proposal.proposedCharges,
    deliveryTimelineDays: proposal.deliveryTimelineDays,
    portfolioLink: proposal.portfolioLink,
    remarks: proposal.remarks,
    status: proposal.status,
    adminRemark: proposal.adminRemark,
    submittedAt: proposal.submittedAt,
    acceptedAt: proposal.acceptedAt,
    acceptedBy: proposal.acceptedBy,
    acceptedByModel: proposal.acceptedByModel,
    rejectedAt: proposal.rejectedAt,
    withdrawnAt: proposal.withdrawnAt
  }));

  return proposals;
};

/**
 * Submit architect documents for a project
 * @param {string} projectId - The ID of the project
 * @param {Object} architect - The authenticated user object (architect)
 * @param {Object} documentData - The document data including file keys and notes
 * @param {Object} session - Mongoose session for transaction
 * @returns {Promise<Project>}
 */
export const submitArchitectDocument = async (req, projectId, architect, documentData, session) => {
  const project = await Project.findById(projectId).session(session);
  if (!project) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
  }

  // Verify the architect is assigned to this project
  if (!project.architect || project.architect.toString() !== architect.id.toString()) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You are not assigned to this project as an architect');
  }

  // Store original data for logging
  const originalDocumentsCount = project.architectDocuments ? project.architectDocuments.length : 0;
  const originalDocuments = project.architectDocuments ? [...project.architectDocuments] : [];

  // Determine the version number (increment from the last version if exists)
  let version = 1;
  if (project.architectDocuments && project.architectDocuments.length > 0) {
    const lastVersion = Math.max(...project.architectDocuments.map(doc => doc.version));
    version = lastVersion + 1;
  }

  // Process the temporary files and move them to permanent location
  const processedFiles = [];
  try {
    // Process each file key from the request
    for (const fileData of documentData.files) {
      const tmpKey = fileData.key;

      // Generate a permanent key for the file
      const fileExtension = tmpKey.split('.').pop();
      const fileName = `${Date.now()}-${Math.round(Math.random() * 1000)}.${fileExtension}`;
      const permanentKey = `projects/${project._id}/architect-documents/${version}/${fileName}`;

      // Copy the file from temporary to permanent location
      await storage.copyFile(tmpKey, permanentKey);

      // Track the successful copy
      processedFiles.push({
        tmpKey,
        permanentKey,
        fileType: fileData.fileType
      });
    }

    // Create and add the new document with permanent file keys
    const architectDocument = {
      architect: architect.id,
      notes: documentData.notes || '',
      version,
      files: processedFiles.map(file => ({
        fileType: file.fileType,
        key: file.permanentKey,
        uploadedAt: new Date()
      }))
    };

    project.architectDocuments.push(architectDocument);
    await project.save({ session });

    // Delete temporary files after successful save
    for (const file of processedFiles) {
      await storage.deleteFile(file.tmpKey);
    }

    // Get the newly added document (last one in the array)
    const addedDocument = project.architectDocuments[project.architectDocuments.length - 1];

    // Log the architect document submission activity
    try {
      await logActivity(req, {
        action: 'submit_document',
        targetModel: 'Project',
        targetId: project._id,
        targetName: project.projectName,
        description: `Vendor Send Document to Admin`,
        changes: {
          architectDocuments: {
            from: originalDocumentsCount,
            to: project.architectDocuments.length
          },
          documentVersion: {
            from: version - 1,
            to: version
          }
        },
        metadata: {
          projectId: project._id,
          projectData: {
            projectId: project._id,
            projectName: project.projectName,
            projectCode: project.projectCode,
            status: project.status,
            customerName: project.customerName,
            requirementType: project.requirementType,
            architect: project.architect
          },
          architect: {
            userId: architect.id,
            userName: architect.name,
            userEmail: architect.email,
            userRole: architect.role
          },
          documentData: {
            documentId: addedDocument._id,
            version: addedDocument.version,
            notes: addedDocument.notes,
            architect: addedDocument.architect,
            filesCount: addedDocument.files.length,
            files: addedDocument.files.map(file => ({
              fileType: file.fileType,
              key: file.key,
              uploadedAt: file.uploadedAt
            }))
          },
          originalDocumentsCount,
          newDocumentsCount: project.architectDocuments.length,
          documentSubmission: true,
          documentVersion: version,
          filesUploaded: processedFiles.length,
          fileTypes: processedFiles.map(file => file.fileType),
          submittedBy: architect.id,
          submittedByModel: 'Architect',
          submittedAt: new Date()
        }
      });

      // Log individual file uploads
      for (const file of processedFiles) {
        await logActivity(req, {
          action: 'upload',
          targetModel: 'Project',
          targetId: project._id,
          targetName: project.projectName,
          description: `Vendor Send Document to Admin`,
          changes: {
            files: {
              from: null,
              to: {
                fileType: file.fileType,
                key: file.permanentKey,
                uploadedAt: new Date()
              }
            }
          },
          metadata: {
            projectId: project._id,
            projectData: {
              projectId: project._id,
              projectName: project.projectName,
              projectCode: project.projectCode
            },
            architect: {
              userId: architect.id,
              userName: architect.name,
              userEmail: architect.email
            },
            fileUpload: true,
            fileType: file.fileType,
            fileKey: file.permanentKey,
            tmpKey: file.tmpKey,
            documentVersion: version,
            uploadedBy: architect.id,
            uploadedByModel: 'Architect',
            uploadedAt: new Date()
          }
        });
      }
    } catch (error) {
      console.error('Error logging architect document submission:', error);
    }

    return project;
  } catch (error) {
    // If any error occurs during file processing, clean up any copied files
    for (const file of processedFiles) {
      try {
        await storage.deleteFile(file.permanentKey);
      } catch (deleteError) {
        // Log the error but continue with cleanup
        console.error(`Failed to delete file ${file.permanentKey}:`, deleteError);
      }
    }
    throw error;
  }
};

/**
 * Get architect documents for a project
 * @param {string} projectId - The ID of the project
 * @returns {Promise<Array>} - The architect documents
 */
export const getArchitectDocuments = async (projectId) => {
  const project = await Project.findById(projectId)
    .populate({
      path: 'architectDocuments.architect',
      select: 'name email phone role',
    })
    .populate({
      path: 'requirement',
      select: 'sharedWith',
      populate: {
        path: 'sharedWith.user',
        select: 'role'
      }
    });

  if (!project) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
  }

  // Check if any planning engineer members are in the sharedWith list
  const isSharedWithAnyPlanningEngineer = project.requirement?.sharedWith?.some(share =>
    share.user?.role === Roles.PLANNING_ENGINEER
  ) || false;

  const requirementId = project.requirement._id;
  const customerLeadId = project.lead;

  // Get attachments for each document
  const architectDocumentsWithAttachments = await Promise.all(
    project.architectDocuments.map(async (doc) => {
      // Get attachments for this document
      const attachments = await Attachment.find({
        documentId: doc._id,
        projectId: projectId
      }).populate('sentBy', 'name email')
        .populate('reviewedBy', 'name email')
        .sort({ createdAt: -1 });

      return {
        ...doc.toObject(),
        isSharedWithAnyPlanningEngineer,
        requirementId,
        customerLeadId,
        attachments
      };
    })
  );

  return architectDocumentsWithAttachments;
};

/**
 * Review architect document by admin
 * @param {string} projectId - The ID of the project
 * @param {string} documentId - The ID of the document
 * @param {Object} reviewData - The review data including status and remarks
 * @param {Object} admin - The authenticated admin user
 * @returns {Promise<Project>}
 */
export const reviewArchitectDocument = async (req, projectId, documentId, reviewData, admin) => {
  const project = await Project.findById(projectId);
  if (!project) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
  }

  const documentIndex = project.architectDocuments.findIndex(
    doc => doc._id.toString() === documentId
  );

  if (documentIndex === -1) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Document not found');
  }

  // Store original document data for logging
  const originalDocument = {
    adminStatus: project.architectDocuments[documentIndex].adminStatus,
    adminRemarks: project.architectDocuments[documentIndex].adminRemarks,
    adminReviewedAt: project.architectDocuments[documentIndex].adminReviewedAt,
    version: project.architectDocuments[documentIndex].version,
    notes: project.architectDocuments[documentIndex].notes,
    architect: project.architectDocuments[documentIndex].architect,
    filesCount: project.architectDocuments[documentIndex].files.length
  };

  // Update the document with admin review
  project.architectDocuments[documentIndex].adminStatus = reviewData.status;
  project.architectDocuments[documentIndex].adminRemarks = reviewData.remarks || '';
  project.architectDocuments[documentIndex].adminReviewedAt = new Date();

  await project.save();

  // Get the updated document for logging
  const updatedDocument = project.architectDocuments[documentIndex];

  // Log the architect document review activity
  try {
    await logActivity(req, {
      action: 'review_document',
      targetModel: 'Project',
      targetId: project._id,
      targetName: project.projectName,
      description: (String(reviewData.status).toLowerCase() === 'approved')
        ? `Admin Aprove Vendor Document`
        : `Admin Reject Vendor Document`,
      changes: {
        adminStatus: {
          from: originalDocument.adminStatus,
          to: reviewData.status
        },
        adminRemarks: {
          from: originalDocument.adminRemarks,
          to: reviewData.remarks || ''
        },
        adminReviewedAt: {
          from: originalDocument.adminReviewedAt,
          to: new Date()
        }
      },
      metadata: {
        projectId: project._id,
        projectData: {
          projectId: project._id,
          projectName: project.projectName,
          projectCode: project.projectCode,
          status: project.status,
          customerName: project.customerName,
          requirementType: project.requirementType,
          architect: project.architect
        },
        adminUser: {
          userId: admin._id,
          userName: admin.name,
          userEmail: admin.email,
          userRole: admin.role
        },
        documentData: {
          documentId: updatedDocument._id,
          version: updatedDocument.version,
          notes: updatedDocument.notes,
          architect: updatedDocument.architect,
          filesCount: updatedDocument.files.length,
          adminStatus: updatedDocument.adminStatus,
          adminRemarks: updatedDocument.adminRemarks,
          adminReviewedAt: updatedDocument.adminReviewedAt
        },
        originalDocumentData: originalDocument,
        reviewData: {
          status: reviewData.status,
          remarks: reviewData.remarks || '',
          reviewedAt: new Date()
        },
        documentReview: true,
        reviewStatus: reviewData.status,
        documentVersion: updatedDocument.version,
        reviewedBy: admin._id,
        reviewedByModel: admin.constructor.modelName,
        reviewedAt: new Date(),
        isApproved: reviewData.status === 'Approved',
        isRejected: reviewData.status === 'Rejected'
      }
    });
  } catch (error) {
    console.error('Error logging architect document review:', error);
  }

  return project;
};

/**
 * Send document to customer for review
 * @param {string} projectId - The ID of the project
 * @param {string} documentId - The ID of the document
 * @param {Object} admin - The authenticated admin user
 * @returns {Promise<Project>}
 */
export const sendDocumentToCustomer = async (req, projectId, documentId, admin) => {
  const project = await Project.findById(projectId);
  if (!project) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
  }

  const documentIndex = project.architectDocuments.findIndex(
    doc => doc._id.toString() === documentId
  );

  if (documentIndex === -1) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Document not found');
  }

  const document = project.architectDocuments[documentIndex];

  // Check if document is approved by admin
  if (document.adminStatus !== 'Approved') {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Document must be approved by admin before sending to customer'
    );
  }

  // Store original document data for logging
  const originalSentToCustomer = document.sentToCustomer;

  // Mark document as sent to customer
  project.architectDocuments[documentIndex].sentToCustomer = true;

  await project.save();

  // Log the document sending to customer activity
  try {
    await logActivity(req, {
      action: 'send_to_customer',
      targetModel: 'Project',
      targetId: project._id,
      targetName: project.projectName,
      description: `Admin sent architect document  to customer`,
      changes: {
        sentToCustomer: {
          from: originalSentToCustomer,
          to: true
        }
      },
      metadata: {
        projectId: project._id,
        projectData: {
          projectId: project._id,
          projectName: project.projectName,
          projectCode: project.projectCode,
          status: project.status,
          customerName: project.customerName,
          requirementType: project.requirementType,
          architect: project.architect
        },
        adminUser: {
          userId: admin._id,
          userName: admin.name,
          userEmail: admin.email,
          userRole: admin.role
        },
        documentData: {
          documentId: document._id,
          version: document.version,
          notes: document.notes,
          architect: document.architect,
          filesCount: document.files.length,
          adminStatus: document.adminStatus,
          adminRemarks: document.adminRemarks,
          adminReviewedAt: document.adminReviewedAt,
          sentToCustomer: true
        },
        documentWorkflow: true,
        documentVersion: document.version,
        sentBy: admin._id,
        sentByModel: admin.constructor.modelName,
        sentAt: new Date(),
        customerNotification: true
      }
    });
  } catch (error) {
    console.error('Error logging document send to customer:', error);
  }

  return project;
};

/**
 * Customer review of architect document
 * @param {string} projectId - The ID of the project
 * @param {string} documentId - The ID of the document
 * @param {Object} reviewData - The review data including status and remarks
 * @returns {Promise<Project>}
 */
export const customerReviewDocument = async (req, projectId, documentId, reviewData) => {
  const project = await Project.findById(projectId);
  if (!project) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
  }

  const documentIndex = project.architectDocuments.findIndex(
    doc => doc._id.toString() === documentId
  );

  if (documentIndex === -1) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Document not found');
  }

  const document = project.architectDocuments[documentIndex];

  // Check if document has been approved by admin (customers can review approved documents)
  if (document.adminStatus !== 'Approved') {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Document has not been approved by admin yet'
    );
  }

  // Store original document data for logging
  const originalDocument = {
    customerStatus: document.customerStatus,
    customerRemarks: document.customerRemarks,
    customerReviewedAt: document.customerReviewedAt,
    version: document.version,
    notes: document.notes,
    architect: document.architect,
    filesCount: document.files.length,
    adminStatus: document.adminStatus,
    sentToCustomer: document.sentToCustomer
  };

  // Update the document with customer review
  project.architectDocuments[documentIndex].customerStatus = reviewData.status;
  project.architectDocuments[documentIndex].customerRemarks = reviewData.remarks || '';
  project.architectDocuments[documentIndex].customerReviewedAt = new Date();

  await project.save();

  // Get the updated document for logging
  const updatedDocument = project.architectDocuments[documentIndex];

  // Log the customer document review activity
  try {
    await logActivity(req, {
      action: 'customer_review',
      targetModel: 'Project',
      targetId: project._id,
      targetName: project.projectName,
      description: `Customer ${reviewData.status.toLowerCase()} Vendor document`,
      changes: {
        customerStatus: {
          from: originalDocument.customerStatus,
          to: reviewData.status
        },
        customerRemarks: {
          from: originalDocument.customerRemarks,
          to: reviewData.remarks || ''
        },
        customerReviewedAt: {
          from: originalDocument.customerReviewedAt,
          to: new Date()
        }
      },
      metadata: {
        projectId: project._id,
        projectData: {
          projectId: project._id,
          projectName: project.projectName,
          projectCode: project.projectCode,
          status: project.status,
          customerName: project.customerName,
          requirementType: project.requirementType,
          architect: project.architect
        },
        customer: {
          // Note: Customer info might not be available in req.user for customer endpoints
          // This would need to be populated based on your authentication setup
          customerName: project.customerName,
          customerEmail: project.customerEmail || 'N/A'
        },
        documentData: {
          documentId: updatedDocument._id,
          version: updatedDocument.version,
          notes: updatedDocument.notes,
          architect: updatedDocument.architect,
          filesCount: updatedDocument.files.length,
          adminStatus: updatedDocument.adminStatus,
          adminRemarks: updatedDocument.adminRemarks,
          adminReviewedAt: updatedDocument.adminReviewedAt,
          customerStatus: updatedDocument.customerStatus,
          customerRemarks: updatedDocument.customerRemarks,
          customerReviewedAt: updatedDocument.customerReviewedAt,
          sentToCustomer: updatedDocument.sentToCustomer
        },
        originalDocumentData: originalDocument,
        reviewData: {
          status: reviewData.status,
          remarks: reviewData.remarks || '',
          reviewedAt: new Date()
        },
        documentWorkflow: true,
        customerReview: true,
        reviewStatus: reviewData.status,
        documentVersion: updatedDocument.version,
        reviewedAt: new Date(),
        isApproved: reviewData.status === 'Approved',
        isRejected: reviewData.status === 'Rejected',
        workflowComplete: reviewData.status === 'Approved'
      }
    });
  } catch (error) {
    console.error('Error logging customer document review:', error);
  }

  return project;
};

export const getArchitectDocumentsForCustomer = async (projectId, user) => {
  const project = await Project.findById(projectId).populate('lead');
  if (!project) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
  }

  if (project.lead.email !== user.email) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You are not authorized to view documents for this project.');
  }

  // Get all architect documents (not just approved ones)
  // Customers should see documents that have admin attachments regardless of admin status
  const allDocuments = project.architectDocuments;

  // Get attachments for each document and filter out documents without admin attachments
  const documentsWithAttachments = await Promise.all(
    allDocuments.map(async (doc) => {
      // Get attachments for this document
      const attachments = await Attachment.find({
        documentId: doc._id,
        projectId: projectId
      }).populate('sentBy', 'name email')
        .populate('reviewedBy', 'name email')
        .sort({ createdAt: -1 });

      // Include documents that have admin attachments OR have been sent to customer
      // This allows customers to see documents with admin attachments regardless of admin status
      if (attachments.length > 0 || doc.sentToCustomer) {
        return {
          ...doc.toObject(),
          // Keep architect's original files if document was sent to customer
          files: doc.sentToCustomer ? doc.files : [], // Show LayoutPlan files only if sent to customer
          attachments // Include admin attachments
        };
      }
      return null; // Exclude documents without attachments and not sent to customer
    })
  );

  // Filter out null values (documents without attachments)
  return documentsWithAttachments.filter(doc => doc !== null);
};

/**
 * Query for projects for a specific customer
 * @param {Object} user - The authenticated user object (customer)
 * @param {Object} options - Query options
 * @param {string} [options.sortBy] - "Sort option in the format: field:(desc|asc)"
 * @param {number} [options.limit] - Maximum number of results per page (default: 10)
 * @param {number} [options.page] - Current page (default: 1)
 * @returns {Promise<Object>}
 */
export const getProjectsForCustomer = async (user, options) => {
  const { limit = 10, page = 1, sortBy } = options;
  const sort = sortBy
    ? { [sortBy.split(':')[0]]: sortBy.split(':')[1] === 'desc' ? -1 : 1 }
    : { createdAt: -1 };

  // Find leads associated with the customer's email
  const leads = await CustomerLead.find({ email: user.email }).select('_id');
  const leadIds = leads.map(l => l._id);

  if (leadIds.length === 0) {
    return { results: [], page, limit, totalPages: 0, totalResults: 0 };
  }

  const projectFilter = { lead: { $in: leadIds } };

  const projects = await Project.find(projectFilter)
    .populate('lead')
    .populate('requirement')
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  const totalResults = await Project.countDocuments(projectFilter);

  return {
    results: projects,
    page,
    limit,
    totalPages: Math.ceil(totalResults / limit),
    totalResults,
  };
};

/**
 * Get projects for architect
 * @param {Object} user - The authenticated user object (architect)
 * @param {Object} options - Query options
 * @param {string} [options.sortBy] - "Sort option in the format: field:(desc|asc)"
 * @param {number} [options.limit] - Maximum number of results per page (default: 10)
 * @param {number} [options.page] - Current page (default: 1)
 * @returns {Promise<Object>}
 */
export const getProjectsForArchitect = async (user, options) => {
  const { limit = 10, page = 1, sortBy } = options;
  const sort = sortBy
    ? { [sortBy.split(':')[0]]: sortBy.split(':')[1] === 'desc' ? -1 : 1 }
    : { createdAt: -1 };

  const projects = await Project.find({ architect: user._id })
    .populate('lead', 'customerName mobileNumber email state city')
    .populate('requirement', 'requirementType projectName')
    .populate({
      path: 'proposals',
      match: { architect: user._id },
      populate: {
        path: 'architect',
        select: 'name email'
      }
    })
    .populate({
      path: 'architectDocuments',
      match: { architect: user._id },
      populate: {
        path: 'architect',
        select: 'name email'
      }
    })
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  const totalResults = await Project.countDocuments({ architect: user._id });
  const totalPages = Math.ceil(totalResults / limit);

  return {
    results: projects,
    page,
    limit,
    totalPages,
    totalResults,
  };
};

/**
 * Get proposals submitted by the authenticated architect
 * @param {Object} user - The authenticated architect user
 * @param {Object} options - Query options
 * @param {string} [options.sortBy] - "Sort option in the format: field:(desc|asc)"
 * @param {number} [options.limit] - Maximum number of results per page (default: 10)
 * @param {number} [options.page] - Current page (default: 1)
 * @param {string} [options.status] - Filter by proposal status
 * @param {string} [options.projectName] - Filter by project name
 * @param {string} [options.startDate] - Filter by start date (ISO string)
 * @param {string} [options.endDate] - Filter by end date (ISO string)
 * @returns {Promise<Object>}
 */
export const getMyProposals = async (user, options) => {
  const { limit = 10, page = 1, sortBy, status, projectName, startDate, endDate } = options;

  // Build filter for proposals
  const proposalFilter = { architect: user._id };
  if (status) {
    proposalFilter.status = status;
  }

  // Build date filter
  const dateFilter = {};
  if (startDate) {
    dateFilter.$gte = new Date(startDate);
  }
  if (endDate) {
    dateFilter.$lte = new Date(endDate);
  }
  if (Object.keys(dateFilter).length > 0) {
    proposalFilter.submittedAt = dateFilter;
  }

  // Find projects that have proposals from this architect
  const projects = await Project.find({
    'proposals.architect': user._id
  })
    .populate('lead', 'customerName mobileNumber email state city')
    .populate('requirement', 'requirementType projectName')
    .populate({
      path: 'proposals',
      match: proposalFilter,
      populate: {
        path: 'architect',
        select: 'name email'
      }
    })
    .lean();

  // Transform the data to focus on proposals
  const proposals = [];
  for (const project of projects) {
    // Filter by project name if specified
    if (projectName && !project.projectName.toLowerCase().includes(projectName.toLowerCase())) {
      continue;
    }

    for (const proposal of project.proposals) {
      proposals.push({
        _id: proposal._id,
        project: {
          _id: project._id,
          projectName: project.projectName,
          projectCode: project.projectCode,
          status: project.status,
          lead: project.lead,
          requirement: project.requirement
        },
        architect: proposal.architect,
        email: proposal.email,
        proposedCharges: proposal.proposedCharges,
        deliveryTimelineDays: proposal.deliveryTimelineDays,
        portfolioLink: proposal.portfolioLink,
        remarks: proposal.remarks,
        status: proposal.status,
        adminRemark: proposal.adminRemark,
        submittedAt: proposal.submittedAt,
        acceptedAt: proposal.acceptedAt,
        rejectedAt: proposal.rejectedAt,
        withdrawnAt: proposal.withdrawnAt
      });
    }
  }

  // Sort proposals based on sortBy parameter
  if (sortBy) {
    const [field, order] = sortBy.split(':');
    const sortOrder = order === 'desc' ? -1 : 1;

    proposals.sort((a, b) => {
      let aValue = a[field];
      let bValue = b[field];

      // Handle date fields
      if (field === 'submittedAt' || field === 'acceptedAt' || field === 'rejectedAt' || field === 'withdrawnAt') {
        aValue = new Date(aValue || 0);
        bValue = new Date(bValue || 0);
      }

      // Handle numeric fields
      if (field === 'proposedCharges' || field === 'deliveryTimelineDays') {
        aValue = Number(aValue) || 0;
        bValue = Number(bValue) || 0;
      }

      // Handle string fields
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (aValue < bValue) return -1 * sortOrder;
      if (aValue > bValue) return 1 * sortOrder;
      return 0;
    });
  } else {
    // Default sort by submittedAt descending (latest first)
    proposals.sort((a, b) => {
      const dateA = new Date(a.submittedAt || 0);
      const dateB = new Date(b.submittedAt || 0);
      return dateB - dateA; // Descending order
    });
  }

  // Apply pagination to sorted results
  const totalResults = proposals.length;
  const totalPages = Math.ceil(totalResults / limit);
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const paginatedProposals = proposals.slice(startIndex, endIndex);

  return {
    results: paginatedProposals,
    page,
    limit,
    totalPages,
    totalResults,
  };
};

/**
 * Delete a proposal submitted by the authenticated architect (only if status is Pending)
 * @param {string} proposalId - The ID of the proposal to delete
 * @param {Object} user - The authenticated architect user
 * @returns {Promise<Object>}
 */
export const deleteMyProposal = async (req, proposalId, user) => {
  // Find the project that contains this proposal
  const project = await Project.findOne({
    'proposals._id': proposalId,
    'proposals.architect': user._id
  });

  if (!project) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Proposal not found or you do not have permission to delete it');
  }

  // Find the specific proposal
  const proposal = project.proposals.find(p => p._id.toString() === proposalId);

  if (!proposal) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Proposal not found');
  }

  // Check if the proposal status is Pending
  if (proposal.status !== 'Pending') {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Cannot delete proposal with status '${proposal.status}'. Only pending proposals can be deleted.`
    );
  }

  // Store original proposal data for logging
  const originalProposal = {
    proposalId: proposal._id,
    email: proposal.email,
    proposedCharges: proposal.proposedCharges,
    deliveryTimelineDays: proposal.deliveryTimelineDays,
    portfolioLink: proposal.portfolioLink,
    remarks: proposal.remarks,
    architect: proposal.architect,
    status: proposal.status,
    submittedAt: proposal.submittedAt
  };

  const originalProposalsCount = project.proposals.length;

  // Remove the proposal from the project
  project.proposals = project.proposals.filter(p => p._id.toString() !== proposalId);
  await project.save();

  // Log the proposal deletion activity
  try {
    await logActivity(req, {
      action: 'delete_proposal',
      targetModel: 'Project',
      targetId: project._id,
      targetName: project.projectName,
      description: `Vendor deleted their proposal`,
      changes: {
        proposals: {
          from: originalProposalsCount,
          to: project.proposals.length
        }
      },
      metadata: {
        projectId: project._id,
        projectData: {
          projectId: project._id,
          projectName: project.projectName,
          projectCode: project.projectCode,
          status: project.status,
          customerName: project.customerName,
          requirementType: project.requirementType,
          architect: project.architect
        },
        architect: {
          userId: user._id,
          userName: user.name,
          userEmail: user.email,
          userRole: user.role
        },
        deletedProposalData: originalProposal,
        originalProposalsCount,
        newProposalsCount: project.proposals.length,
        proposalDeletion: true,
        deletedBy: user._id,
        deletedByModel: 'Architect',
        deletedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Error logging proposal deletion:', error);
  }

  return {
    deletedProposalId: proposalId,
    projectId: project._id,
    projectName: project.projectName
  };
};

/**
 * Reject a proposal by admin
 * @param {string} proposalId - The ID of the proposal to reject
 * @param {Object} adminUser - The authenticated admin user
 * @param {Object} rejectData - Rejection data including remarks
 * @returns {Promise<Object>}
 */
export const rejectProposal = async (req, proposalId, adminUser, rejectData) => {
  // Find the project that contains this proposal
  const project = await Project.findOne({
    'proposals._id': proposalId
  });

  if (!project) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Proposal not found');
  }

  // Find the specific proposal
  const proposal = project.proposals.find(p => p._id.toString() === proposalId);

  if (!proposal) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Proposal not found');
  }

  // Check if the proposal can be rejected
  if (proposal.status === 'Rejected') {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Proposal is already rejected');
  }

  if (proposal.status === 'Accepted') {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Cannot reject an accepted proposal');
  }

  if (proposal.status === 'Withdrawn') {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Cannot reject a withdrawn proposal');
  }

  // Store original proposal data for logging
  const originalProposal = {
    status: proposal.status,
    adminRemark: proposal.adminRemark,
    rejectedAt: proposal.rejectedAt,
    rejectedBy: proposal.rejectedBy,
    email: proposal.email,
    proposedCharges: proposal.proposedCharges,
    deliveryTimelineDays: proposal.deliveryTimelineDays,
    portfolioLink: proposal.portfolioLink,
    remarks: proposal.remarks,
    architect: proposal.architect
  };

  // Update the proposal status
  proposal.status = 'Rejected';
  proposal.rejectedAt = new Date();
  proposal.rejectedBy = adminUser._id;
  proposal.adminRemark = rejectData.remarks || '';

  await project.save();

  // Log the proposal rejection activity
  try {
    await logActivity(req, {
      action: 'reject_proposal',
      targetModel: 'Project',
      targetId: project._id,
      targetName: project.projectName,
      description: `Admin Reject Vendor Proposal`,
      changes: {
        proposalStatus: {
          from: originalProposal.status,
          to: 'Rejected'
        },
        adminRemark: {
          from: originalProposal.adminRemark,
          to: rejectData.remarks || ''
        },
        rejectedAt: {
          from: originalProposal.rejectedAt,
          to: new Date()
        },
        rejectedBy: {
          from: originalProposal.rejectedBy,
          to: adminUser._id
        }
      },
      metadata: {
        projectId: project._id,
        projectData: {
          projectId: project._id,
          projectName: project.projectName,
          projectCode: project.projectCode,
          status: project.status,
          customerName: project.customerName,
          requirementType: project.requirementType,
          architect: project.architect
        },
        adminUser: {
          userId: adminUser._id,
          userName: adminUser.name,
          userEmail: adminUser.email,
          userRole: adminUser.role
        },
        proposalData: {
          proposalId: proposal._id,
          email: proposal.email,
          proposedCharges: proposal.proposedCharges,
          deliveryTimelineDays: proposal.deliveryTimelineDays,
          portfolioLink: proposal.portfolioLink,
          remarks: proposal.remarks,
          architect: proposal.architect,
          status: proposal.status,
          adminRemark: proposal.adminRemark,
          rejectedAt: proposal.rejectedAt,
          rejectedBy: proposal.rejectedBy
        },
        originalProposalData: originalProposal,
        rejectData: {
          remarks: rejectData.remarks || '',
          rejectedAt: new Date()
        },
        proposalRejection: true,
        rejectedBy: adminUser._id,
        rejectedByModel: adminUser.constructor.modelName,
        rejectedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Error logging proposal rejection:', error);
  }

  return {
    proposalId: proposalId,
    projectId: project._id,
    projectName: project.projectName,
    architect: proposal.architect,
    status: proposal.status,
    rejectedAt: proposal.rejectedAt,
    rejectedBy: adminUser._id,
    adminRemark: proposal.adminRemark
  };
};

/**
 * Send approved architect document to procurement
 * @param {string} projectId - The ID of the project
 * @param {string} documentId - The ID of the document
 * @param {Object} admin - The authenticated admin user
 * @returns {Promise<Project>}
 */
export const sendDocumentToProcurement = async (req, projectId, documentId, admin) => {
  const project = await Project.findById(projectId);
  if (!project) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
  }

  const documentIndex = project.architectDocuments.findIndex(
    doc => doc._id.toString() === documentId
  );

  if (documentIndex === -1) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Document not found');
  }

  const document = project.architectDocuments[documentIndex];

  // Check if document is approved by both admin and customer
  if (document.adminStatus !== 'Approved') {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Document must be approved by admin before sending to procurement'
    );
  }

  if (document.customerStatus !== 'Approved') {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Document must be approved by customer before sending to procurement'
    );
  }

  // Check if already sent to procurement
  if (document.sentToPlanningEngineer) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Document has already been sent to procurement'
    );
  }

  // Store original document data for logging
  const originalSentToPlanningEngineer = document.sentToPlanningEngineer;
  const originalSentToPlanningEngineerAt = document.sentToPlanningEngineerAt;
  const originalSentToPlanningEngineerBy = document.sentToPlanningEngineerBy;

  // Mark document as sent to procurement
  project.architectDocuments[documentIndex].sentToPlanningEngineer = true;
  project.architectDocuments[documentIndex].sentToPlanningEngineerAt = new Date();
  project.architectDocuments[documentIndex].sentToPlanningEngineerBy = admin._id;

  await project.save();

  // Log the document sending to procurement activity
  try {
    await logActivity(req, {
      action: 'send_to_procurement',
      targetModel: 'Project',
      targetId: project._id,
      targetName: project.projectName,
      description: `Admin sent approved Vendor document to Planning Engineer`,
      changes: {
        sentToPlanningEngineer: {
          from: originalSentToPlanningEngineer,
          to: true
        },
        sentToPlanningEngineerAt: {
          from: originalSentToPlanningEngineerAt,
          to: new Date()
        },
        sentToPlanningEngineerBy: {
          from: originalSentToPlanningEngineerBy,
          to: admin._id
        }
      },
      metadata: {
        projectId: project._id,
        projectData: {
          projectId: project._id,
          projectName: project.projectName,
          projectCode: project.projectCode,
          status: project.status,
          customerName: project.customerName,
          requirementType: project.requirementType,
          architect: project.architect
        },
        adminUser: {
          userId: admin._id,
          userName: admin.name,
          userEmail: admin.email,
          userRole: admin.role
        },
        documentData: {
          documentId: document._id,
          version: document.version,
          notes: document.notes,
          architect: document.architect,
          filesCount: document.files.length,
          adminStatus: document.adminStatus,
          adminRemarks: document.adminRemarks,
          adminReviewedAt: document.adminReviewedAt,
          customerStatus: document.customerStatus,
          customerRemarks: document.customerRemarks,
          customerReviewedAt: document.customerReviewedAt,
          sentToCustomer: document.sentToCustomer,
          sentToPlanningEngineer: true,
          sentToPlanningEngineerAt: new Date(),
          sentToPlanningEngineerBy: admin._id
        },
        documentWorkflow: true,
        procurementWorkflow: true,
        documentVersion: document.version,
        sentBy: admin._id,
        sentByModel: admin.constructor.modelName,
        sentAt: new Date(),
        procurementNotification: true
      }
    });
  } catch (error) {
    console.error('Error logging document send to procurement:', error);
  }

  return project;
};

/**
 * Get approved architect documents for procurement team
 * @param {Object} filter - Filter criteria
 * @param {Object} options - Query options
 * @returns {Promise<Object>}
 */
export const getApprovedDocumentsForProcurement = async (filter, options) => {
  const { limit = 10, page = 1, sortBy } = options;
  const sort = sortBy
    ? { [sortBy.split(':')[0]]: sortBy.split(':')[1] === 'desc' ? -1 : 1 }
    : { 'architectDocuments.sentToPlanningEngineerAt': -1 };

  // Build the aggregation pipeline
  const pipeline = [
    {
      $match: {
        'architectDocuments.sentToPlanningEngineer': true,
        'architectDocuments.adminStatus': 'Approved',
        'architectDocuments.customerStatus': 'Approved'
      }
    },
    {
      $lookup: {
        from: 'customerleads',
        localField: 'lead',
        foreignField: '_id',
        as: 'lead'
      }
    },
    {
      $lookup: {
        from: 'requirements',
        localField: 'requirement',
        foreignField: '_id',
        as: 'requirement'
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: 'architect',
        foreignField: '_id',
        as: 'architect'
      }
    },
    {
      $unwind: '$lead'
    },
    {
      $unwind: '$requirement'
    },
    {
      $unwind: '$architect'
    },
    {
      $unwind: '$architectDocuments'
    },
    {
      $match: {
        'architectDocuments.sentToPlanningEngineer': true,
        'architectDocuments.adminStatus': 'Approved',
        'architectDocuments.customerStatus': 'Approved'
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: 'architectDocuments.architect',
        foreignField: '_id',
        as: 'architectDocuments.architect'
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: 'architectDocuments.sentToPlanningEngineerBy',
        foreignField: '_id',
        as: 'architectDocuments.sentToPlanningEngineerBy'
      }
    },
    {
      $unwind: '$architectDocuments.architect'
    },
    {
      $unwind: {
        path: '$architectDocuments.sentToPlanningEngineerBy',
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $project: {
        _id: 1,
        projectName: 1,
        projectCode: 1,
        lead: {
          _id: 1,
          customerName: 1,
          email: 1,
          mobileNumber: 1
        },
        architect: {
          _id: 1,
          name: 1,
          email: 1
        },
        requirement: {
          _id: 1,
          requirementType: 1
        },
        document: {
          _id: '$architectDocuments._id',
          files: '$architectDocuments.files',
          notes: '$architectDocuments.notes',
          adminStatus: '$architectDocuments.adminStatus',
          customerStatus: '$architectDocuments.customerStatus',
          adminRemarks: '$architectDocuments.adminRemarks',
          customerRemarks: '$architectDocuments.customerRemarks',
          version: '$architectDocuments.version',
          submittedAt: '$architectDocuments.submittedAt',
          sentToPlanningEngineerAt: '$architectDocuments.sentToPlanningEngineerAt',
          architect: '$architectDocuments.architect',
          sentToPlanningEngineerBy: '$architectDocuments.sentToPlanningEngineerBy'
        }
      }
    },
    {
      $sort: sort
    }
  ];

  // Add project name filter if provided
  if (filter.projectName) {
    pipeline.unshift({
      $match: {
        projectName: { $regex: filter.projectName, $options: 'i' }
      }
    });
  }

  // Execute the aggregation
  const results = await Project.aggregate([
    ...pipeline,
    { $skip: (page - 1) * limit },
    { $limit: limit }
  ]);

  // Get total count
  const totalResults = await Project.aggregate([
    ...pipeline,
    { $count: 'total' }
  ]);

  const total = totalResults.length > 0 ? totalResults[0].total : 0;

  return {
    results,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    totalResults: total,
  };
};

/**
 * Get projects for procurement team (basic info only)
 * @param {Object} user - The authenticated procurement user
 * @param {Object} options - Query options
 * @returns {Promise<Object>}
 */
export const getProjectsForProcurement = async (user, options) => {
  const { limit = 10, page = 1, sortBy } = options;
  const sort = sortBy
    ? { [sortBy.split(':')[0]]: sortBy.split(':')[1] === 'desc' ? -1 : 1 }
    : { createdAt: -1 };

  // Find requirements shared with this procurement user
  const sharedRequirements = await Requirement.find({
    'sharedWith.user': user._id
  }).select('_id project');

  const projectIds = sharedRequirements.map(req => req.project).filter(Boolean);

  if (projectIds.length === 0) {
    return { results: [], page, limit, totalPages: 0, totalResults: 0 };
  }

  const projects = await Project.find({ _id: { $in: projectIds } })
    .populate('lead', 'customerName email mobileNumber')
    .populate('requirement', 'requirementType')
    .select('_id projectName projectCode status createdAt workOrderSentToPlanningEngineer workOrderSentToPlanningEngineerAt workOrderSentToPlanningEngineerBy')
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  const totalResults = await Project.countDocuments({ _id: { $in: projectIds } });

  return {
    results: projects,
    page,
    limit,
    totalPages: Math.ceil(totalResults / limit),
    totalResults,
  };
};

/**
 * Get architect documents for a specific project (procurement team)
 * @param {string} projectId - The ID of the project
 * @param {Object} user - The authenticated procurement user
 * @returns {Promise<Array>}
 */
export const getProjectDocumentsForProcurement = async (projectId, user) => {
  // Check if the procurement user has access to this project
  const sharedRequirement = await Requirement.findOne({
    project: projectId,
    'sharedWith.user': user._id
  });

  if (!sharedRequirement) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You do not have access to this project');
  }

  const project = await Project.findById(projectId)
    .populate('lead', 'customerName email mobileNumber')
    .populate('requirement', 'requirementType')
    .populate({
      path: 'architectDocuments.architect',
      select: 'name email'
    });

  if (!project) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
  }

  // Filter to only show approved documents
  const approvedDocuments = project.architectDocuments.filter(doc =>
    doc.adminStatus === 'Approved' && doc.customerStatus === 'Approved'
  );

  // Get attachments for each approved document
  const documentsWithAttachments = await Promise.all(
    approvedDocuments.map(async (doc) => {
      // Get approved attachments for this document
      const attachments = await Attachment.find({
        documentId: doc._id,
        projectId: projectId,
        status: 'approved' // Only get approved attachments
      }).populate('sentBy', 'name email')
        .populate('reviewedBy', 'name email')
        .sort({ createdAt: -1 });

      return {
        ...doc.toObject(),
        attachments // Include approved attachments
      };
    })
  );

  return {
    project: {
      _id: project._id,
      projectName: project.projectName,
      projectCode: project.projectCode,
      status: project.status,
      lead: project.lead,
      requirement: project.requirement
    },
    documents: documentsWithAttachments
  };
};

export const getProjectById = async (projectId) => {
  if (!isValidObjectId(projectId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid project ID');
  }
  const project = await Project.findById(projectId)
    .populate('lead')
    .populate('requirement')
    .populate({
      path: 'proposals.architect',
      select: 'name email',
    })
    .populate({
      path: 'architectDocuments.architect',
      select: 'name email',
    })
    .populate({
      path: 'siteVisits',
      populate: {
        path: 'siteEngineer',
        select: 'name email'
      }
    });

  if (!project) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
  }

  // Manually populate sharedWith user data if requirement exists
  if (project.requirement && project.requirement.sharedWith && project.requirement.sharedWith.length > 0) {
    console.log('Manual population: Found sharedWith data', project.requirement.sharedWith);

    // Get all unique user IDs from sharedWith
    const userIds = [...new Set([
      ...project.requirement.sharedWith.map(share => share.user),
      ...project.requirement.sharedWith.map(share => share.sharedBy)
    ])].filter(id => id);

    console.log('Manual population: User IDs to fetch', userIds);

    if (userIds.length > 0) {
      const users = await User.find({ _id: { $in: userIds } }).select('_id name email role');
      console.log('Manual population: Found users', users);

      const userMap = users.reduce((map, user) => {
        map[user._id.toString()] = user;
        return map;
      }, {});

      console.log('Manual population: User map', userMap);

      // Populate the sharedWith array
      project.requirement.sharedWith = project.requirement.sharedWith.map(share => {
        const populatedShare = {
          ...share.toObject(),
          user: userMap[share.user.toString()] || share.user,
          sharedBy: userMap[share.sharedBy.toString()] || share.sharedBy
        };
        console.log('Manual population: Populated share', populatedShare);
        return populatedShare;
      });
    }
  }

  // Auto-sync project status with customer status
  if (project.lead && project.lead.status) {
    const customerStatus = project.lead.status;
    const projectStatusMapping = {
      [STATUS_ENUM.ACTIVE]: STATUS_ENUM.ACTIVE,
      [STATUS_ENUM.INACTIVE]: STATUS_ENUM.CANCELLED,
      [STATUS_ENUM.HOLD]: STATUS_ENUM.HOLD,
      [STATUS_ENUM.COMPLETE]: STATUS_ENUM.COMPLETE,
      [STATUS_ENUM.CANCELLED]: STATUS_ENUM.CANCELLED,
      [STATUS_ENUM.INPROGRESS]: STATUS_ENUM.INPROGRESS,
      [STATUS_ENUM.DRAFT]: STATUS_ENUM.DRAFT,
    };

    const expectedProjectStatus = projectStatusMapping[customerStatus] || STATUS_ENUM.DRAFT;

    if (project.status !== expectedProjectStatus) {
      project.status = expectedProjectStatus;
      await project.save();
    }
  }

  return project;
};

export const assignSiteEngineersService = async (req, projectId, siteEngineers) => {
  try {
    // Step 1: Get current assigned site engineers
    const project = await Project.findById(projectId).select('assignedSiteEngineer projectName projectCode status customerName requirementType architect');
    if (!project) throw new Error('Project not found');

    const existingEngineerIds = project.assignedSiteEngineer.map(id => id.toString());

    // Step 2: Filter out engineers already assigned
    const newEngineers = siteEngineers.filter(
      eng => !existingEngineerIds.includes(eng.userId.toString())
    );

    // Store original data for logging
    const originalAssignedEngineers = [...project.assignedSiteEngineer];
    const originalEngineersCount = project.assignedSiteEngineer.length;

    if (newEngineers.length === 0) {
      // No new engineers to add; return the fully populated project
      const populatedProject = await Project.findById(projectId).populate('assignedSiteEngineer', 'name email role');

      // Log that no new engineers were added
      try {
        await logActivity(req, {
          action: 'assign_site_engineers',
          targetModel: 'Project',
          targetId: project._id,
          targetName: project.projectName,
          description: `Admin ${req.user.name} to assign site engineers to project - No new engineers added (all already assigned)`,
          changes: {
            assignedSiteEngineers: {
              from: originalEngineersCount,
              to: originalEngineersCount
            }
          },
          metadata: {
            projectId: project._id,
            projectData: {
              projectId: project._id,
              projectName: project.projectName,
              projectCode: project.projectCode,
              status: project.status,
              customerName: project.customerName,
              requirementType: project.requirementType,
              architect: project.architect
            },
            adminUser: {
              userId: req.user._id,
              userName: req.user.name,
              userEmail: req.user.email,
              userRole: req.user.role
            },
            siteEngineersData: {
              requestedEngineers: siteEngineers,
              newEngineers: [],
              existingEngineers: originalAssignedEngineers,
              totalEngineers: originalEngineersCount,
              engineersAdded: 0,
              engineersSkipped: siteEngineers.length
            },
            assignmentDetails: {
              noNewAssignments: true,
              allAlreadyAssigned: true,
              assignmentAttempted: true,
              assignmentResult: 'no_changes'
            }
          }
        });
      } catch (error) {
        console.error('Error logging site engineer assignment (no changes):', error);
      }

      return populatedProject;
    }

    const newEngineerIds = newEngineers.map(eng => eng.userId);

    // Step 3: Add only new engineers to the project (merge)
    const updatedProject = await Project.findByIdAndUpdate(
      projectId,
      { $addToSet: { assignedSiteEngineer: { $each: newEngineerIds } } },
      { new: true }
    ).populate('assignedSiteEngineer', 'name email role');

    // Step 4: Create project assignment payments only for newly added engineers
    const createdPayments = await Promise.all(newEngineers.map(engineer =>
      ProjectAssignmentPayment.create({
        project: projectId,
        siteEngineer: engineer.userId,
        assignedAmount: engineer.assignmentAmount,
        perDayAmount: engineer.perDayAmount,
      })
    ));

    // Log the site engineer assignment activity
    try {
      await logActivity(req, {
        action: 'assign_site_engineers',
        targetModel: 'Project',
        targetId: project._id,
        targetName: project.projectName,
        description: `Admin ${req.user.name}  assigned ${newEngineers.length} site engineer(s) to project`,
        changes: {
          assignedSiteEngineers: {
            from: originalEngineersCount,
            to: updatedProject.assignedSiteEngineer.length
          }
        },
        metadata: {
          projectId: project._id,
          projectData: {
            projectId: project._id,
            projectName: project.projectName,
            projectCode: project.projectCode,
            status: project.status,
            customerName: project.customerName,
            requirementType: project.requirementType,
            architect: project.architect
          },
          adminUser: {
            userId: req.user._id,
            userName: req.user.name,
            userEmail: req.user.email,
            userRole: req.user.role
          },
          siteEngineersData: {
            requestedEngineers: siteEngineers,
            newEngineers: newEngineers.map(eng => ({
              userId: eng.userId,
              assignedAmount: eng.assignmentAmount,
              perDayAmount: eng.perDayAmount
            })),
            existingEngineers: originalAssignedEngineers,
            totalEngineers: updatedProject.assignedSiteEngineer.length,
            engineersAdded: newEngineers.length,
            engineersSkipped: siteEngineers.length - newEngineers.length
          },
          assignmentDetails: {
            assignmentSuccessful: true,
            newAssignments: newEngineers.length,
            totalAssignments: updatedProject.assignedSiteEngineer.length,
            assignmentResult: 'success'
          },
          paymentDetails: {
            paymentsCreated: createdPayments.length,
            totalAssignedAmount: newEngineers.reduce((sum, eng) => sum + (eng.assignmentAmount || 0), 0),
            averagePerDayAmount: newEngineers.reduce((sum, eng) => sum + (eng.perDayAmount || 0), 0) / newEngineers.length
          }
        }
      });
    } catch (error) {
      console.error('Error logging site engineer assignment:', error);
    }

    return updatedProject;
  } catch (error) {
    console.error('Error assigning site engineers:', error);
    throw error;
  }
};


export const getAssignedSiteEngineersService = async (projectId) => {
  const project = await Project.findById(projectId)
    .populate('assignedSiteEngineer', 'name email role')
    .select('assignedSiteEngineer');

  return project ? project.assignedSiteEngineer : [];
};

export const getAssignedProjectsForSiteEngineerService = async (siteEngineerId, query) => {
  const { page = 1, limit = 10, status } = query;
  const filter = {
    assignedSiteEngineer: siteEngineerId,
    // status: 'Open'
  };

  if (status) {
    filter.status = status;
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [projects, total] = await Promise.all([
    Project.find(filter)
      .select('projectName projectCode status startDate estimatedCompletionDate budget')
      .populate('lead', 'customerName mobileNumber')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Project.countDocuments(filter)
  ]);

  return {
    data: projects,
    page: parseInt(page),
    limit: parseInt(limit),
    total,
    totalPages: Math.ceil(total / parseInt(limit)),
  };
};

export const getProjectsForUserAssignedInSiteworkService = async (userId, query) => {
  // 1. Find all siteworks where user is assigned
  const siteworks = await Sitework.find({ "assignedUsers.user": userId })
    .select('project name attachment')
    .sort({ createdAt: -1 });
  
  const projectIds = [...new Set(siteworks.map(sw => sw.project.toString()))];
  if (projectIds.length === 0) {
    return { data: [], page: 1, limit: 10, total: 0, totalPages: 0 };
  }

  // 2. Paginate and fetch projects
  const { page = 1, limit = 10 } = query;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [projects, total] = await Promise.all([
    Project.find({ _id: { $in: projectIds } })
      .select('projectName projectCode status startDate estimatedCompletionDate budget')
      .populate('lead', 'customerName mobileNumber')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Project.countDocuments({ _id: { $in: projectIds } })
  ]);

  // 3. Populate attachment.uploadedBy for each sitework
  for (const sitework of siteworks) {
    if (sitework.attachment && sitework.attachment.uploadedBy) {
      if (sitework.attachment.uploadedByModel === 'Admin') {
        sitework.attachment.uploadedBy = await Admin.findById(sitework.attachment.uploadedBy).select('adminName email role');
      } else if (sitework.attachment.uploadedByModel === 'User') {
        sitework.attachment.uploadedBy = await User.findById(sitework.attachment.uploadedBy).select('name email role');
      }
    }
  }

  // 4. Attach siteworks with attachments to each project
  const projectsWithSiteworks = projects.map(project => {
    const projectSiteworks = siteworks.filter(sw => sw.project.toString() === project._id.toString());
    return {
      ...project.toObject(),
      siteworks: projectSiteworks
    };
  });

  return {
    data: projectsWithSiteworks,
    page: parseInt(page),
    limit: parseInt(limit),
    total,
    totalPages: Math.ceil(total / parseInt(limit)),
  };
};

/**
 * Update project status manually (Admin only)
 * @param {string} projectId
 * @param {string} newStatus
 * @param {Object} user
 * @returns {Promise<Project>}
 */
export const updateProjectStatusService = async (req, projectId, newStatus) => {
  if (!isValidObjectId(projectId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid project ID');
  }
  if (!STATUS_VALUES.includes(newStatus)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid status value');
  }

  const project = await Project.findById(projectId).select('projectName projectCode status customerName requirementType architect assignedSiteEngineer');
  if (!project) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
  }

  // Store original status for logging
  const originalStatus = project.status;

  // Use the cascade service to update project and reflect to customer
  const result = await updateProjectStatusWithReflection(projectId, newStatus);

  // Log the project status update activity
  try {
    await logActivity(req, {
      action: 'update_project_status',
      targetModel: 'Project',
      targetId: project._id,
      targetName: project.projectName,
      description: `${req.user.role === 'admin' ? 'Admin' : 'User'} ${req.user.name} (${req.user.email}) updated project status from '${originalStatus}' to '${newStatus}`,
      changes: {
        status: {
          from: originalStatus,
          to: newStatus
        }
      },
      metadata: {
        projectId: project._id,
        projectData: {
          projectId: project._id,
          projectName: project.projectName,
          projectCode: project.projectCode,
          status: newStatus,
          customerName: project.customerName,
          requirementType: project.requirementType,
          architect: project.architect,
          assignedSiteEngineers: project.assignedSiteEngineer.length
        },
        user: {
          userId: req.user._id,
          userName: req.user.name,
          userEmail: req.user.email,
          userRole: req.user.role
        },
        statusUpdate: {
          originalStatus,
          newStatus,
          statusChanged: originalStatus !== newStatus,
          statusTransition: `${originalStatus} → ${newStatus}`,
          updatedAt: new Date()
        },
        cascadeUpdate: {
          customerReflection: true,
          projectUpdated: true,
          statusCascade: true
        },
        workflow: {
          statusUpdate: true,
          projectWorkflow: true,
          customerNotification: true
        }
      }
    });
  } catch (error) {
    console.error('Error logging project status update:', error);
  }

  return result.project;
};

/**
 * Get project chat groups for the authenticated user
 * @param {Object} user - The authenticated user
 * @param {Object} filter - Filter options
 * @param {Object} options - Query options
 * @returns {Promise<Object>}
 */
export const getProjectChatGroups = async (user, filter = {}, options = {}) => {
  const { limit = 10, page = 1, sortBy } = options;
  const { customerName, projectName, status } = filter;
  const sort = sortBy
    ? { [sortBy.split(':')[0]]: sortBy.split(':')[1] === 'desc' ? -1 : 1 }
    : { createdAt: -1 };

  let projectFilter = {};

  // If user is admin, show all projects
  if (user.role === 'Admin' || user.role === 'sales-admin') {
    // Apply filters for admin
    if (projectName) {
      projectFilter.projectName = { $regex: projectName, $options: 'i' };
    }
    if (status) {
      projectFilter.status = status;
    }
    if (customerName) {
      const leads = await CustomerLead.find({
        customerName: { $regex: customerName, $options: 'i' },
      }).select('_id');
      const leadIds = leads.map(l => l._id);
      if (leadIds.length > 0) {
        projectFilter.lead = { $in: leadIds };
      } else {
        return { results: [], page, limit, totalPages: 0, totalResults: 0 };
      }
    }

    // Get all projects with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [projects, total] = await Promise.all([
      Project.find(projectFilter)
        .select('projectName projectCode status createdAt updatedAt')
        .populate('lead', 'customerName')
        .populate('requirement', 'requirementType')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      Project.countDocuments(projectFilter)
    ]);

    const results = projects.map(project => ({
      _id: project._id,
      projectName: project.projectName,
      projectCode: project.projectCode,
      status: project.status,
      customerName: project.lead?.customerName || 'N/A',
      requirementType: project.requirement?.requirementType || 'N/A',
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      sharedAt: project.createdAt, // For admin, use creation date
      isSeen: true // Admin has access to all projects
    }));

    return {
      results,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
      totalResults: total
    };
  } else {
    // For regular users, only show projects shared with them
    const requirementsWithUser = await Requirement.find({
      'sharedWith.user': user._id
    }).select('_id project requirementType');

    if (requirementsWithUser.length === 0) {
      return { results: [], page, limit, totalPages: 0, totalResults: 0 };
    }

    const requirementIds = requirementsWithUser.map(r => r._id);
    projectFilter.requirement = { $in: requirementIds };

    // Apply additional filters
    if (projectName) {
      projectFilter.projectName = { $regex: projectName, $options: 'i' };
    }
    if (status) {
      projectFilter.status = status;
    }
    if (customerName) {
      const leads = await CustomerLead.find({
        customerName: { $regex: customerName, $options: 'i' },
      }).select('_id');
      const leadIds = leads.map(l => l._id);
      if (leadIds.length > 0) {
        projectFilter.lead = { $in: leadIds };
      } else {
        return { results: [], page, limit, totalPages: 0, totalResults: 0 };
      }
    }

    // Get projects with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [projects, total] = await Promise.all([
      Project.find(projectFilter)
        .select('projectName projectCode status createdAt updatedAt')
        .populate('lead', 'customerName')
        .populate({
          path: 'requirement',
          select: 'requirementType sharedWith',
          populate: {
            path: 'sharedWith.user',
            select: '_id name email role'
          }
        })
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      Project.countDocuments(projectFilter)
    ]);

    // Map projects with shared information
    const results = projects.map(project => {
      const requirement = requirementsWithUser.find(r => r._id.toString() === project.requirement?._id.toString());
      const sharedInfo = requirement ?
        project.requirement.sharedWith.find(sw => sw.user.toString() === user._id.toString()) : null;

      return {
        _id: project._id,
        projectName: project.projectName,
        projectCode: project.projectCode,
        status: project.status,
        customerName: project.lead?.customerName || 'N/A',
        requirementType: project.requirement?.requirementType || 'N/A',
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        sharedAt: sharedInfo?.sharedAt || project.createdAt,
        isSeen: sharedInfo?.isSeen || false
      };
    });

    return {
      results,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
      totalResults: total
    };
  }
};
