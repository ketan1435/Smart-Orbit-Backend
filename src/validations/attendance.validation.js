import Joi from 'joi';
import { objectId } from './custom.validation.js';

export const clockIn = {
    body: Joi.object().keys({
        clockInTime: Joi.date().iso().required(),
        photoKey: Joi.string().required(),
        projectId: Joi.string().custom(objectId).required(),
    }),
};

export const clockOut = {
    body: Joi.object().keys({
        clockOutTime: Joi.date().iso().required(),
        photoKey: Joi.string().required(),
        projectId: Joi.string().custom(objectId).required(),
    }),
};

export const getAttendanceRecords = {
    query: Joi.object().keys({
        page: Joi.number().integer().min(1),
        limit: Joi.number().integer().min(1).max(100),
        fabricatorId: Joi.string().custom(objectId),
        projectId: Joi.string().custom(objectId),
        startDate: Joi.date().iso(),
        endDate: Joi.date().iso(),
    }),
};

export const getCurrentAttendance = {
    query: Joi.object().keys({
        projectId: Joi.string().custom(objectId),
    }),
};

export const getAttendanceStats = {
    query: Joi.object().keys({
        fabricatorId: Joi.string().custom(objectId),
        projectId: Joi.string().custom(objectId),
        month: Joi.number().integer().min(1).max(12),
        year: Joi.number().integer().min(2020).max(2030),
    }),
};
