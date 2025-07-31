import Project from '../models/project.model.js';
import CustomerLead from '../models/customerLead.model.js';
import ApiError from '../utils/ApiError.js';
import { mongoose } from 'mongoose';
import Requirement from '../models/requirement.model.js';
import httpStatus from 'http-status';
import storage from '../factory/storage.factory.js';
import Sitework from '../models/sitework.model.js';
import Roles from '../config/enums/roles.enum.js';
import ProjectAssignmentPayment from '../models/projectAssignmentPaymant.model.js';

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
 * @param {string} [options.sortBy] - Sort option in the format: field:(desc|asc)
 * @param {number} [options.limit] - Maximum number of results per page (default: 10)
 * @param {number} [options.page] - Current page (default: 1)
 * @returns {Promise<Object>}
 */
export const queryProjects = async (filter, options) => {
  const { limit = 10, page = 1, sortBy } = options;
  const { customerName, requirementType, projectName, ...directFilters } = filter;
  const sort = sortBy
    ? { [sortBy.split(':')[0]]: sortBy.split(':')[1] === 'desc' ? -1 : 1 }
    : { createdAt: -1 };

  const projectFilter = { ...directFilters };

  // Fuzzy search for project name
  if (projectName) {
    projectFilter.projectName = { $regex: projectName, $options: 'i' };
  }

  // Filter by customer name (via lead)
  if (customerName) {
    const leads = await CustomerLead.find({
      customerName: { $regex: customerName, $options: 'i' },
    }).select('_id');
    const leadIds = leads.map(l => l._id);
    if (leadIds.length === 0)
      return { results: [], page, limit, totalPages: 0, totalResults: 0 };
    projectFilter.lead = { $in: leadIds };
  }

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
      path: 'siteVisits',
      populate: {
        path: 'siteEngineer',
        select: 'name email role'
      }
    })
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
 * Add a proposal from an architect to a project
 * @param {string} projectId - The ID of the project
 * @param {Object} architect - The authenticated user object (architect)
 * @param {Object} proposalBody - The proposal details
 * @returns {Promise<Project>}
 */
export const addArchitectProposal = async (projectId, architect, proposalBody) => {
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

  // Create and add the new proposal
  project.proposals.push({
    ...proposalBody,
    architect: architect.id,
  });

  await project.save();
  return project;
};

/**
 * Accept an architect's proposal
 * @param {string} projectId
 * @param {string} proposalId
 * @param {Object} adminUser - The user accepting the proposal
 * @returns {Promise<Project>}
 */
export const acceptArchitectProposal = async (projectId, proposalId, adminUser) => {
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

  // Accept the chosen proposal
  proposalToAccept.status = 'Accepted';
  proposalToAccept.acceptedAt = new Date();
  project.architect = proposalToAccept.architect; // Assign architect to the project

  await ProjectAssignmentPayment.create({
    user: proposalToAccept.architect,
    project: project._id,
    assignedAmount: proposalToAccept.proposedCharges,
  });

  // Reject all other pending proposals
  // project.proposals.forEach((p) => {
  //   if (p.id !== proposalId && (p.status === 'Pending' || p.status === 'Responded')) {
  //     p.status = 'Rejected';
  //     p.rejectedAt = new Date();
  //   }
  // });

  await project.save();
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

  return project.proposals;
};

/**
 * Submit architect documents for a project
 * @param {string} projectId - The ID of the project
 * @param {Object} architect - The authenticated user object (architect)
 * @param {Object} documentData - The document data including file keys and notes
 * @param {Object} session - Mongoose session for transaction
 * @returns {Promise<Project>}
 */
export const submitArchitectDocument = async (projectId, architect, documentData, session) => {
  const project = await Project.findById(projectId).session(session);
  if (!project) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
  }

  // Verify the architect is assigned to this project
  if (!project.architect || project.architect.toString() !== architect.id.toString()) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You are not assigned to this project as an architect');
  }

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

  // Check if any procurement team members are in the sharedWith list
  const isSharedWithAnyProcurementTeam = project.requirement?.sharedWith?.some(share =>
    share.user?.role === Roles.PROCUREMENT
  ) || false;

  const requirementId = project.requirement._id;
  const customerLeadId = project.lead;

  // Add the isSharedWithAnyProcurementTeam flag to each architect document
  const architectDocumentsWithFlag = project.architectDocuments.map(doc => ({
    ...doc.toObject(),
    isSharedWithAnyProcurementTeam,
    requirementId,
    customerLeadId
  }));

  return architectDocumentsWithFlag;
};

/**
 * Review architect document by admin
 * @param {string} projectId - The ID of the project
 * @param {string} documentId - The ID of the document
 * @param {Object} reviewData - The review data including status and remarks
 * @param {Object} admin - The authenticated admin user
 * @returns {Promise<Project>}
 */
export const reviewArchitectDocument = async (projectId, documentId, reviewData, admin) => {
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

  // Update the document with admin review
  project.architectDocuments[documentIndex].adminStatus = reviewData.status;
  project.architectDocuments[documentIndex].adminRemarks = reviewData.remarks || '';
  project.architectDocuments[documentIndex].adminReviewedAt = new Date();

  await project.save();
  return project;
};

/**
 * Send document to customer for review
 * @param {string} projectId - The ID of the project
 * @param {string} documentId - The ID of the document
 * @param {Object} admin - The authenticated admin user
 * @returns {Promise<Project>}
 */
export const sendDocumentToCustomer = async (projectId, documentId, admin) => {
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

  // Mark document as sent to customer
  project.architectDocuments[documentIndex].sentToCustomer = true;

  await project.save();
  return project;
};

/**
 * Customer review of architect document
 * @param {string} projectId - The ID of the project
 * @param {string} documentId - The ID of the document
 * @param {Object} reviewData - The review data including status and remarks
 * @returns {Promise<Project>}
 */
export const customerReviewDocument = async (projectId, documentId, reviewData) => {
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

  // Check if document has been sent to customer
  if (!document.sentToCustomer) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Document has not been sent to customer for review yet'
    );
  }

  // Update the document with customer review
  project.architectDocuments[documentIndex].customerStatus = reviewData.status;
  project.architectDocuments[documentIndex].customerRemarks = reviewData.remarks || '';
  project.architectDocuments[documentIndex].customerReviewedAt = new Date();

  await project.save();
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

  return project.architectDocuments.filter(
    (doc) => doc.sentToCustomer
  );
};

/**
 * Query for projects for a specific customer
 * @param {Object} user - The authenticated user object (customer)
 * @param {Object} options - Query options
 * @param {string} [options.sortBy] - Sort option in the format: field:(desc|asc)
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
 * @param {string} [options.sortBy] - Sort option in the format: field:(desc|asc)
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
 * @param {string} [options.sortBy] - Sort option in the format: field:(desc|asc)
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
  const sort = sortBy
    ? { [sortBy.split(':')[0]]: sortBy.split(':')[1] === 'desc' ? -1 : 1 }
    : { 'proposals.submittedAt': -1 };

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
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(limit)
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
        submittedAt: proposal.submittedAt,
        acceptedAt: proposal.acceptedAt,
        rejectedAt: proposal.rejectedAt,
        withdrawnAt: proposal.withdrawnAt
      });
    }
  }

  // Apply pagination to filtered results
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
export const deleteMyProposal = async (proposalId, user) => {
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

  // Remove the proposal from the project
  project.proposals = project.proposals.filter(p => p._id.toString() !== proposalId);
  await project.save();

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
export const rejectProposal = async (proposalId, adminUser, rejectData) => {
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

  // Update the proposal status
  proposal.status = 'Rejected';
  proposal.rejectedAt = new Date();
  proposal.rejectedBy = adminUser._id;
  proposal.adminRemarks = rejectData.remarks || '';

  await project.save();

  return {
    proposalId: proposalId,
    projectId: project._id,
    projectName: project.projectName,
    architect: proposal.architect,
    status: proposal.status,
    rejectedAt: proposal.rejectedAt,
    rejectedBy: adminUser._id,
    adminRemarks: proposal.adminRemarks
  };
};

/**
 * Send approved architect document to procurement
 * @param {string} projectId - The ID of the project
 * @param {string} documentId - The ID of the document
 * @param {Object} admin - The authenticated admin user
 * @returns {Promise<Project>}
 */
export const sendDocumentToProcurement = async (projectId, documentId, admin) => {
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
  if (document.sentToProcurement) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Document has already been sent to procurement'
    );
  }

  // Mark document as sent to procurement
  project.architectDocuments[documentIndex].sentToProcurement = true;
  project.architectDocuments[documentIndex].procurementSentAt = new Date();
  project.architectDocuments[documentIndex].sentToProcurementBy = admin._id;

  await project.save();
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
    : { 'architectDocuments.procurementSentAt': -1 };

  // Build the aggregation pipeline
  const pipeline = [
    {
      $match: {
        'architectDocuments.sentToProcurement': true,
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
        'architectDocuments.sentToProcurement': true,
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
        localField: 'architectDocuments.sentToProcurementBy',
        foreignField: '_id',
        as: 'architectDocuments.sentToProcurementBy'
      }
    },
    {
      $unwind: '$architectDocuments.architect'
    },
    {
      $unwind: {
        path: '$architectDocuments.sentToProcurementBy',
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
          procurementSentAt: '$architectDocuments.procurementSentAt',
          architect: '$architectDocuments.architect',
          sentToProcurementBy: '$architectDocuments.sentToProcurementBy'
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
    .select('_id projectName projectCode status createdAt')
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

  return {
    project: {
      _id: project._id,
      projectName: project.projectName,
      projectCode: project.projectCode,
      status: project.status,
      lead: project.lead,
      requirement: project.requirement
    },
    documents: approvedDocuments
  };
};

export const getProjectById = async (projectId) => {
  const project = await Project.findById(projectId)
    .populate('lead')
    .populate('architect')
    .populate('siteVisits')
    .populate({
      path: 'siteVisits',
      populate: {
        path: 'siteEngineer',
        select: 'name email role'
      }
    })
    .populate('assignedSiteEngineer')
    .populate({
      path: 'requirement',
      populate: {
        path: 'sharedWith.user sharedWith.sharedBy',
        select: 'name email role'
      }
    });
  if (!project) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
  }
  return project;
};

export const assignSiteEngineersService = async (projectId, siteEngineers) => {
  try {
    // Step 1: Get current assigned site engineers
    const project = await Project.findById(projectId).select('assignedSiteEngineer');
    if (!project) throw new Error('Project not found');

    const existingEngineerIds = project.assignedSiteEngineer.map(id => id.toString());

    // Step 2: Filter out engineers already assigned
    const newEngineers = siteEngineers.filter(
      eng => !existingEngineerIds.includes(eng.userId.toString())
    );

    if (newEngineers.length === 0) {
      // No new engineers to add; return the fully populated project
      return await Project.findById(projectId).populate('assignedSiteEngineer', 'name email role');
    }

    const newEngineerIds = newEngineers.map(eng => eng.userId);

    // Step 3: Add only new engineers to the project (merge)
    const updatedProject = await Project.findByIdAndUpdate(
      projectId,
      { $addToSet: { assignedSiteEngineer: { $each: newEngineerIds } } },
      { new: true }
    ).populate('assignedSiteEngineer', 'name email role');

    // Step 4: Create project assignment payments only for newly added engineers
    await Promise.all(newEngineers.map(engineer =>
      ProjectAssignmentPayment.create({
        project: projectId,
        siteEngineer: engineer.userId,
        assignedAmount: engineer.assignmentAmount,
        perDayAmount: engineer.perDayAmount,
      })
    ));

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
    status: 'Open'
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
  const siteworks = await Sitework.find({ assignedUsers: userId }).select('project');
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

  return {
    data: projects,
    page: parseInt(page),
    limit: parseInt(limit),
    total,
    totalPages: Math.ceil(total / parseInt(limit)),
  };
}; 
