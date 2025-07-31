import Joi from 'joi';
import { objectId } from './custom.validation.js';

export const sendSystemNotification = {
    body: Joi.object().keys({
        userIds: Joi.array().items(Joi.string().custom(objectId)).min(1).required(),
        notificationData: Joi.object().keys({
            title: Joi.string().required(),
            message: Joi.string().required(),
            type: Joi.string().valid('info', 'warning', 'error', 'success').optional(),
            data: Joi.object().optional()
        }).required()
    })
};

export const getOnlineUsersForProject = {
    params: Joi.object().keys({
        projectId: Joi.string().custom(objectId).required()
    })
};

export const checkUserOnlineStatus = {
    params: Joi.object().keys({
        userId: Joi.string().custom(objectId).required()
    })
};

export const forceDisconnectUser = {
    params: Joi.object().keys({
        userId: Joi.string().custom(objectId).required()
    })
}; 