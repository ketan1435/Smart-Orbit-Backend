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