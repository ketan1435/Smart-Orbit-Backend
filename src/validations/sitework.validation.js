import Joi from 'joi';
import { objectId } from './custom.validation.js';

export const createSitework = {
    body: Joi.object().keys({
        name: Joi.string().required(),
        description: Joi.string().allow(''),
        project: Joi.string().custom(objectId).required(),
        startDate: Joi.date().optional(),
        endDate: Joi.date().optional(),
        status: Joi.string().valid('not-started', 'in-progress', 'completed', 'cancelled').optional(),
        assignedUsers: Joi.array().items(Joi.object().keys({
            user: Joi.string().custom(objectId).required(),
            assignmentAmount: Joi.number().required(),
            perDayAmount: Joi.number().required()
        })).required(),
    }),
};

export const updateSitework = {
    params: Joi.object().keys({
        id: Joi.string().custom(objectId).required(),
    }),
    body: Joi.object().keys({
        name: Joi.string().required(),
        description: Joi.string().allow(''),
        assignedUsers: Joi.array().items(Joi.object().keys({
            user: Joi.string().custom(objectId).required(),
            assignmentAmount: Joi.number().required(),
            perDayAmount: Joi.number().required()
        })),
        startDate: Joi.date(),
        endDate: Joi.date(),
        status: Joi.string().valid('not-started', 'in-progress', 'completed', 'cancelled'),
    }),
};

export const getSiteworksByProject = {
    params: Joi.object().keys({
        projectId: Joi.string().custom(objectId).required(),
    }),
};

export const addSiteworkDocument = {
    params: Joi.object().keys({
        siteworkId: Joi.string().custom(objectId).required(),
    }),
    body: Joi.object().keys({
        files: Joi.array().items(
            Joi.object({
                key: Joi.string().required(),
                fileType: Joi.string().required(),
            })
        ).min(1).required(),
        userNote: Joi.string().allow(''),
    }),
};

export const approveOrRejectSiteworkDocument = {
    params: Joi.object().keys({
        siteworkId: Joi.string().custom(objectId).required(),
        docId: Joi.string().custom(objectId).required(),
    }),
    body: Joi.object().keys({
        status: Joi.string().valid('Approved', 'Rejected').required(),
        feedback: Joi.string().allow(''),
    }),
}; 