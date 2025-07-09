import mongoose from 'mongoose';
import httpStatus from 'http-status';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import SiteVisit from '../models/siteVisit.model.js';
import CustomerLead from '../models/customerLead.model.js';
import storage from '../factory/storage.factory.js';
import ApiError from '../utils/ApiError.js';
import * as userService from './user.service.js';
import Project from '../models/project.model.js';
import Requirement from '../models/requirement.model.js';

/**
 * Query for site visits
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @param {string} [options.sortBy] - Sort option in the format: sortField:(desc|asc)
 * @param {number} [options.limit] - Maximum number of results per page (default: 10)
 * @param {number} [options.page] - Current page (default: 1)
 * @returns {Promise<QueryResult>}
 */
export const querySiteVisits = async (filter, options) => {
  const { page = 1, limit = 10, sortBy } = options;

  const customOptions = {
    page: parseInt(page),
    limit: parseInt(limit),
    sort: sortBy || { visitDate: -1 }, // default sort
    populate: [
      { path: 'siteEngineer', select: 'name email role' },
      { path: 'project', select: 'projectName projectCode' },
      { path: 'requirement', select: 'requirementType projectName' },
    ],
    lean: true,
  };

  const visits = await SiteVisit.paginate(filter, customOptions);
  return visits;
};


/**
 * Schedule a new site visit
 * @param {string} requirementId
 * @param {Object} visitBody
 * @param {Object} adminUser - The authenticated admin user
 * @returns {Promise<SiteVisit>}
 */
export const scheduleSiteVisit = async (requirementId, visitBody, adminUser = null) => {
  const { siteEngineerId, visitDate, hasRequirementEditAccess } = visitBody;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Get the requirement with lead and project
    const requirement = await Requirement.findById(requirementId)
      .populate('lead', '_id customerName')
      .populate('project', '_id siteVisits')
      .session(session);

    if (!requirement) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Requirement not found');
    }

    if (!requirement.project) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Associated project not found for this requirement');
    }

    const project = requirement.project;

    // 2. Check if the site engineer is valid
    const siteEngineer = await userService.getUserById(siteEngineerId);
    if (!siteEngineer || siteEngineer.role !== 'site-engineer') {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid site engineer');
    }

    // 3. Revoke edit access from existing visits for the same requirement
    await SiteVisit.updateMany(
      { requirement: requirementId },
      { $set: { hasRequirementEditAccess: false } },
      { session }
    );

    // 4. Create the new visit
    const [siteVisit] = await SiteVisit.create([
      {
        requirement: requirementId,
        project: project._id,
        siteEngineer: siteEngineerId,
        visitDate,
        hasRequirementEditAccess,
      }
    ], { session });

    // 5. Push to project siteVisits if not already there
    project.siteVisits = project.siteVisits || [];
    project.siteVisits.push(siteVisit._id);
    await project.save({ session });

    // 6. Add the site engineer to requirement.sharedWith (if not already)
    const alreadyShared = requirement.sharedWith.some(sw => sw.user.toString() === siteEngineerId);
    if (!alreadyShared) {
      requirement.sharedWith.push({
        user: siteEngineerId,
        sharedBy: adminUser ? adminUser.id : siteEngineerId,
      });
      await requirement.save({ session });
    }

    await session.commitTransaction();
    return siteVisit;

  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Get all site visits for a requirement
 * @param {string} requirementId
 * @returns {Promise<SiteVisit[]>}
 */
export const getSiteVisitsForRequirement = async (requirementId) => {
  return SiteVisit.find({ requirement: requirementId }).populate('siteEngineer', 'name role').populate('reviewedBy', 'name');
};

/**
 * Get a single site visit by its ID
 * @param {string} visitId
 * @returns {Promise<SiteVisit>}
 */
export const getSiteVisitById = async (visitId) => {
  const visit = await SiteVisit.findById(visitId).populate('siteEngineer', 'name role').populate('reviewedBy', 'name');
  if (!visit) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Site visit not found');
  }
  return visit;
};

/**
 * Update a site visit (by site engineer, for saving progress)
 * Handles file uploads transactionally.
 * @param {string} visitId
 * @param {Object} updateBody
 * @returns {Promise<SiteVisit>}
 */
export const updateSiteVisit = async (visitId, updateBody) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const visit = await getSiteVisitById(visitId);
    if (!visit) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Site visit not found');
    }

    if (['Completed', 'Approved', 'Cancelled'].includes(visit.status)) {
      throw new ApiError(httpStatus.BAD_REQUEST, `Visit cannot be updated in '${visit.status}' state.`);
    }

    const { updatedData, ...otherUpdates } = updateBody;
    const newFilesToProcess = updatedData?.files?.filter(f => f.key && f.key.startsWith('uploads/tmp/')) || [];
    const successfullyMovedFiles = [];

    // Handle file operations if new files are present
    if (newFilesToProcess.length > 0) {
      const lead = await CustomerLead.findOne({ 'requirements._id': visit.requirement }).session(session);
      if (!lead) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Parent lead for the requirement not found.');
      }

      try {
        for (const file of newFilesToProcess) {
          const uniqueId = uuidv4();
          const fileExtension = path.extname(file.key);
          const newKey = `customer-leads/${lead._id}/requirements/${visit.requirement}/visits/${visit._id}/${uniqueId}${fileExtension}`;

          await storage.copyFile(file.key, newKey);
          successfullyMovedFiles.push({ oldKey: file.key, newKey });

          // Update the key in updatedData to the permanent one
          file.key = newKey;
        }
      } catch (s3Error) {
        // Compensating Action: Delete any files that were already moved
        for (const movedFile of successfullyMovedFiles) {
          await storage.deleteFile(movedFile.newKey);
        }
        throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, `Failed to process files: ${s3Error.message}`);
      }
    }

    // Merge the updates. The `updatedData` in the body now has permanent keys.
    // The existing visit.updatedData is merged with the new one.
    const finalUpdatedData = {
      ...(visit.updatedData || {}),
      ...updatedData
    };

    Object.assign(visit, { ...otherUpdates, updatedData: finalUpdatedData });

    if (visit.status === 'Scheduled') {
      visit.status = 'InProgress';
    }

    await visit.save({ session });
    await session.commitTransaction();

    // After transaction commits, clean up temp files
    for (const movedFile of successfullyMovedFiles) {
      await storage.deleteFile(movedFile.oldKey);
    }

    return visit;

  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Complete a site visit (by site engineer)
 * @param {string} visitId
 * @returns {Promise<SiteVisit>}
 */
export const completeSiteVisit = async (visitId) => {
  const visit = await getSiteVisitById(visitId);
  if (!['Scheduled', 'InProgress'].includes(visit.status)) {
    throw new ApiError(httpStatus.BAD_REQUEST, `Visit cannot be completed as it is in '${visit.status}' state.`);
  }

  // Optional: Add a check to ensure some data has been saved before completing.
  if (!visit.updatedData && !visit.remarks) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Cannot complete visit without any data. Please save some information first.');
  }

  visit.status = 'Completed';

  await visit.save();
  return visit;
};

/**
 * Approve a site visit and merge data (transactional)
 * @param {string} visitId
 * @param {mongoose.Types.ObjectId} adminId
 * @returns {Promise<CustomerLead>}
 */
export const approveSiteVisit = async (visitId, adminId) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const visit = await SiteVisit.findById(visitId).session(session);
    if (!visit || visit.status !== 'Completed') {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Site visit cannot be approved or does not exist.');
    }
    if (!visit.updatedData) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'No data to approve. The site visit has no updatedData.');
    }

    const lead = await CustomerLead.findOne({ 'requirements._id': visit.requirement }).session(session);
    if (!lead) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Parent requirement or lead not found.');
    }

    const requirementToUpdate = lead.requirements.id(visit.requirement);
    if (!requirementToUpdate) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Requirement not found within the lead document.');
    }

    // Merge the approved data into the master scpData
    Object.assign(requirementToUpdate.scpData, visit.updatedData);
    await lead.save({ session });

    // Update the visit status
    visit.status = 'Approved';
    visit.reviewedBy = adminId;
    visit.reviewedAt = new Date();
    await visit.save({ session });

    // Optional: Mark other pending visits for this requirement as 'Outdated'
    await SiteVisit.updateMany(
      {
        requirement: visit.requirement,
        _id: { $ne: visitId },
        status: { $in: ['Scheduled', 'Completed'] },
      },
      { $set: { status: 'Outdated' } },
      { session }
    );

    await session.commitTransaction();
    return requirementToUpdate;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Add documents to a site visit (by site engineer)
 * Handles file uploads transactionally.
 * @param {string} visitId
 * @param {Object} body
 * @param {Object} user
 * @returns {Promise<SiteVisit>}
 */
export const addDocumentsToSiteVisit = async (visitId, body, user) => {
  const { files, engineerFeedback } = body;

  const visit = await getSiteVisitById(visitId);
  if (!visit) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Site visit not found');
  }

  if (['Completed', 'Cancelled'].includes(visit.status)) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Documents cannot be added when visit status is '${visit.status}'`
    );
  }

  if (visit.siteEngineer._id.toString() !== user._id.toString()) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      'You are not authorized to add documents to this site visit.'
    );
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  const successfullyMovedFiles = [];
  const permanentFiles = [];

  try {
    // ✅ Step 1: Fetch requirement from the Requirement model
    const requirement = await Requirement.findById(visit.requirement).session(session);
    if (!requirement) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Requirement not found');
    }

    // ✅ Step 2: Use requirement.lead to get the leadId
    const leadId = requirement.lead;

    const newDocumentId = new mongoose.Types.ObjectId();

    for (const file of files) {
      if (!file.key || !file.key.startsWith('uploads/tmp/')) {
        throw new ApiError(httpStatus.BAD_REQUEST, `Invalid file key provided: ${file.key}`);
      }

      const ext = path.extname(file.key);
      const newKey = `customer-leads/${leadId}/requirements/${requirement._id}/visits/${visit._id}/documents/${newDocumentId}/${uuidv4()}${ext}`;

      await storage.copyFile(file.key, newKey);
      successfullyMovedFiles.push({ oldKey: file.key, newKey });

      permanentFiles.push({
        ...file,
        key: newKey,
      });
    }

    visit.documents.push({
      _id: newDocumentId,
      files: permanentFiles,
      engineerFeedback,
      engineerFeedbackBy: user.id,
    });

    if (visit.status === 'Scheduled') {
      visit.status = 'InProgress';
    }

    await visit.save({ session });
    await session.commitTransaction();

    // Cleanup temp files after success
    for (const { oldKey } of successfullyMovedFiles) {
      await storage.deleteFile(oldKey);
    }

    return visit;
  } catch (error) {
    await session.abortTransaction();

    for (const { newKey } of successfullyMovedFiles) {
      await storage.deleteFile(newKey);
    }

    throw error;
  } finally {
    session.endSession();
  }
};
/**
 * Get paginated documents for a specific site visit
 * @param {string} visitId
 * @param {Object} user - The authenticated user object
 * @param {Object} options - Pagination options (page, limit)
 * @returns {Promise<Object>}
 */
export const getSiteVisitDocuments = async (visitId, user, options) => {
  // First, verify the user is the assigned engineer for this visit
  const visit = await getSiteVisitById(visitId);
  if (!visit) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Site visit not found');
  }
  if (visit.siteEngineer._id.toString() !== user.id.toString()) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You are not authorized to view documents for this visit.');
  }

  const limit = parseInt(options.limit, 10) || 10;
  const page = parseInt(options.page, 10) || 1;
  const skip = (page - 1) * limit;

  const aggregationPipeline = [
    { $match: { _id: new mongoose.Types.ObjectId(visitId) } },
    { $unwind: '$documents' },
    { $replaceRoot: { newRoot: '$documents' } },
    { $sort: { addedAt: -1 } },
    {
      $facet: {
        metadata: [{ $count: 'totalDocs' }],
        data: [{ $skip: skip }, { $limit: limit }],
      },
    },
  ];

  const results = await SiteVisit.aggregate(aggregationPipeline);

  const docs = results[0]?.data || [];
  const totalDocs = results[0]?.metadata[0]?.totalDocs || 0;
  const totalPages = Math.ceil(totalDocs / limit);

  return {
    docs,
    totalDocs,
    limit,
    page,
    totalPages,
  };
};

/**
 * Review (approve/reject) a document in a site visit
 * @param {string} visitId
 * @param {string} documentId
 * @param {Object} reviewBody - { status, adminFeedback }
 * @param {Object} user - The authenticated admin/user
 * @returns {Promise<SiteVisit>}
 */
export const reviewSiteVisitDocument = async (visitId, documentId, reviewBody, user) => {
  const visit = await getSiteVisitById(visitId);
  if (!visit) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Site visit not found');
  }

  const document = visit.documents.id(documentId);
  if (!document) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Document not found in this site visit');
  }

  if (document.status !== 'Pending') {
    throw new ApiError(httpStatus.BAD_REQUEST, `Cannot review a document that is already in '${document.status}' status.`);
  }

  document.status = reviewBody.status;
  document.adminFeedback = reviewBody.adminFeedback;
  document.feedbackBy = user.id;
  document.feedbackByModel = user.role === 'Admin' ? 'Admin' : 'User'; // Or based on your user schema

  await visit.save();
  return visit;
};

/**
 * Add a text-only remark to a site visit
 * @param {string} visitId
 * @param {Object} remarkBody - { engineerFeedback }
 * @param {Object} user - The authenticated user (site engineer)
 * @returns {Promise<SiteVisit>}
 */
export const addRemarkToSiteVisit = async (visitId, remarkBody, user) => {
  const visit = await getSiteVisitById(visitId);
  if (!visit) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Site visit not found');
  }

  if (visit.siteEngineer._id.toString() !== user.id.toString()) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You are not authorized to add remarks to this visit.');
  }

  if (['Completed', 'Approved', 'Cancelled'].includes(visit.status)) {
    throw new ApiError(httpStatus.BAD_REQUEST, `Remarks cannot be added when visit status is '${visit.status}'`);
  }

  visit.documents.push({
    engineerFeedback: remarkBody.engineerFeedback,
    engineerFeedbackBy: user.id,
  });

  if (visit.status === 'Scheduled') {
    visit.status = 'InProgress';
  }

  await visit.save();
  return visit;
};
