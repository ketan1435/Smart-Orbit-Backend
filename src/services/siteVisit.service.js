import mongoose from 'mongoose';
import httpStatus from 'http-status';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { SiteVisit, CustomerLead } from '../models/index.js';
import storage from '../factory/storage.factory.js';
import ApiError from '../utils/ApiError.js';
import * as userService from './user.service.js';

/**
 * Schedule a new site visit
 * @param {string} requirementId
 * @param {Object} visitBody
 * @param {mongoose.Types.ObjectId} createdBy
 * @returns {Promise<SiteVisit>}
 */
export const scheduleSiteVisit = async (requirementId, visitBody) => {
    const { siteEngineerId, visitDate } = visitBody;

    // Check if the requirement exists
    const lead = await CustomerLead.findOne({ 'requirements._id': requirementId });
    if (!lead) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Requirement not found');
    }

    // Check if the site engineer exists and has the correct role
    const siteEngineer = await userService.getUserById(siteEngineerId);
    if (!siteEngineer || siteEngineer.role !== 'site-engineer') {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid site engineer');
    }

    return SiteVisit.create({
        requirement: requirementId,
        siteEngineer: siteEngineerId,
        visitDate,
    });
};

/**
 * Get all site visits for a requirement
 * @param {string} requirementId
 * @returns {Promise<SiteVisit[]>}
 */
export const getSiteVisitsForRequirement = async (requirementId) => {
    return SiteVisit.find({ requirement: requirementId }).populate('siteEngineer', 'name role').populate('approvedBy', 'name');
};

/**
 * Get a single site visit by its ID
 * @param {string} visitId
 * @returns {Promise<SiteVisit>}
 */
export const getSiteVisitById = async (visitId) => {
    const visit = await SiteVisit.findById(visitId).populate('siteEngineer', 'name role').populate('approvedBy', 'name', 'requirement');
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
        visit.approvedBy = adminId;
        visit.approvedAt = new Date();
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