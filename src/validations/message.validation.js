import Joi from 'joi';
import { objectId } from './custom.validation.js';

export const createMessage = {
    body: Joi.object().keys({
        project: Joi.string().custom(objectId).required(),
        content: Joi.string().required().trim(),
        files: Joi.array().items(
            Joi.object().keys({
                key: Joi.string().required(),
                fileName: Joi.string().required(),
                fileType: Joi.string().required(),
                fileSize: Joi.number().positive().required(),
                uploadedAt: Joi.date().required()
            })
        ).optional(),
    }),
};

export const getMessages = {
    query: Joi.object().keys({
        project: Joi.string().custom(objectId).description('Filter by project ID'),
        sender: Joi.string().custom(objectId).description('Filter by sender ID'),
        senderModel: Joi.string().valid('User', 'Admin').description('Filter by sender model'),
        isRead: Joi.boolean().description('Filter by read status'),
        startDate: Joi.date().description('Start date for date range filter'),
        endDate: Joi.date().description('End date for date range filter'),
        sortBy: Joi.string(),
        limit: Joi.number().integer(),
        page: Joi.number().integer(),
    }),
};

export const getMessage = {
    params: Joi.object().keys({
        messageId: Joi.string().custom(objectId).required(),
    }),
};

export const deleteMessage = {
    params: Joi.object().keys({
        messageId: Joi.string().custom(objectId).required(),
    }),
};

export const getProjectMessages = {
    params: Joi.object().keys({
        projectId: Joi.string().custom(objectId).required(),
    }),
    query: Joi.object().keys({
        sortBy: Joi.string(),
        limit: Joi.number().integer(),
        page: Joi.number().integer(),
    }),
}; 