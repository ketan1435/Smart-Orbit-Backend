import Joi from 'joi';
import { objectId } from './custom.validation.js';

export const scheduleSiteVisit = {
    params: Joi.object().keys({
        requirementId: Joi.string().custom(objectId).required(),
    }),
    body: Joi.object().keys({
        siteEngineerId: Joi.string().custom(objectId).required(),
        visitDate: Joi.date().optional(), // Single date (for backward compatibility)
        visitStartDate: Joi.date().optional(), // Start date for range
        visitEndDate: Joi.date().optional(), // End date for range
        hasRequirementEditAccess: Joi.boolean().optional(),
        assignmentAmount: Joi.number().positive().required(), // Assignment amount for payment (mandatory)
    }).custom((value, helpers) => {
        // Validate that either visitDate OR (visitStartDate AND visitEndDate) is provided
        const hasSingleDate = value.visitDate;
        const hasDateRange = value.visitStartDate && value.visitEndDate;

        if (!hasSingleDate && !hasDateRange) {
            return helpers.error('any.invalid', {
                message: 'Either visitDate or both visitStartDate and visitEndDate must be provided'
            });
        }

        if (hasDateRange && value.visitStartDate >= value.visitEndDate) {
            return helpers.error('any.invalid', {
                message: 'visitStartDate must be before visitEndDate'
            });
        }

        return value;
    }),
};

export const getSiteVisitsForRequirement = {
    params: Joi.object().keys({
        requirementId: Joi.string().custom(objectId).required(),
    }),
};

export const getSiteVisitById = {
    params: Joi.object().keys({
        visitId: Joi.string().custom(objectId).required(),
    }),
};

export const completeSiteVisit = {
    params: Joi.object().keys({
        visitId: Joi.string().custom(objectId).required(),
    }),
    body: Joi.object().keys({
        updatedData: Joi.object().required(),
        remarks: Joi.string().allow('', null),
    }),
};

export const approveSiteVisit = {
    params: Joi.object().keys({
        visitId: Joi.string().custom(objectId).required(),
    }),
};

export const updateSiteVisit = {
    params: Joi.object().keys({
        visitId: Joi.string().custom(objectId).required(),
    }),
    body: Joi.object().keys({
        updatedData: Joi.object(),
        remarks: Joi.string().allow('').optional(),
    }).min(1),
};

export const savePermanentSiteVisit = {
    params: Joi.object().keys({
        visitId: Joi.string().custom(objectId).required(),
    }),
    body: Joi.object().keys({
        remarks: Joi.string().allow('').optional(),
    }),
};

export const addDocuments = {
    params: Joi.object().keys({
        visitId: Joi.string().custom(objectId).required(),
    }),
    body: Joi.object().keys({
        engineerFeedback: Joi.string().optional(),
        files: Joi.array().items(Joi.object({
            fileType: Joi.string().required(),
            key: Joi.string().required(),
        })).min(1).required(),
    }),
};

export const getSiteVisitDocuments = {
    params: Joi.object().keys({
        visitId: Joi.string().custom(objectId).required(),
    }),
    query: Joi.object().keys({
        page: Joi.number().integer().min(1),
        limit: Joi.number().integer().min(1),
    }),
};

export const querySiteVisits = {
    query: Joi.object().keys({
        siteEngineer: Joi.string().custom(objectId),
        project: Joi.string().custom(objectId),
        status: Joi.string().valid('Scheduled', 'InProgress', 'Completed', 'Cancelled', 'Outdated'),
        page: Joi.number().integer(),
        limit: Joi.number().integer(),
        sortBy: Joi.string(),
    }),
};

export const addRemark = {
    params: Joi.object().keys({
        visitId: Joi.string().custom(objectId).required(),
    }),
    body: Joi.object().keys({
        engineerFeedback: Joi.string().required(),
    }),
};

export const reviewDocument = {
    params: Joi.object().keys({
        visitId: Joi.string().custom(objectId).required(),
        documentId: Joi.string().custom(objectId).required(),
    }),
    body: Joi.object().keys({
        status: Joi.string().required().valid('Approved', 'Rejected'),
        adminFeedback: Joi.string().when('status', {
            is: 'Rejected',
            then: Joi.string().required(),
            otherwise: Joi.string().allow('').optional(),
        }),
    }),
}; 