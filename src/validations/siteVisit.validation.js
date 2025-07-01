import Joi from 'joi';
import { objectId } from './custom.validation.js';

export const scheduleSiteVisit = {
    params: Joi.object().keys({
        requirementId: Joi.string().custom(objectId).required(),
    }),
    body: Joi.object().keys({
        siteEngineerId: Joi.string().custom(objectId).required(),
        visitDate: Joi.date().required(),
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