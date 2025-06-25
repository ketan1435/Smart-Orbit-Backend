import mongoose from 'mongoose';
import httpStatus from 'http-status';
import { SiteVisit, CustomerLead } from '../models/index.js';
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
    const visit = await SiteVisit.findById(visitId).populate('siteEngineer', 'name role').populate('approvedBy', 'name');
    if (!visit) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Site visit not found');
    }
    return visit;
};

/**
 * Complete a site visit (by site engineer)
 * @param {string} visitId
 * @param {Object} updateBody
 * @param {mongoose.Types.ObjectId} userId
 * @returns {Promise<SiteVisit>}
 */
export const completeSiteVisit = async (visitId, updateBody) => {
    const visit = await getSiteVisitById(visitId);
    if (visit.status !== 'Scheduled') {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Visit cannot be completed as it is not in scheduled state.');
    }

    Object.assign(visit, {
        ...updateBody,
        status: 'Completed',
    });

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