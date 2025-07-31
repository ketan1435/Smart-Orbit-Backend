import Joi from 'joi';
import { objectId } from './custom.validation.js';

export const getProjectAssignmentPayments = {
  query: Joi.object().keys({
    projectName: Joi.string().description('Filter by project name (case-insensitive)'),
    userName: Joi.string().description('Filter by user name (case-insensitive)'),
    userRole: Joi.string().valid('admin', 'sales-admin', 'architect', 'fabricator', 'procurement-team', 'site-engineer', 'worker', 'dispatch-installation', 'user', 'Admin').description('Filter by user role'),
    createdBy: Joi.string().custom(objectId),
    createdByModel: Joi.string().valid('Admin', 'User'),
    sortBy: Joi.string(),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
  }),
};

export const getProjectAssignmentPayment = {
  params: Joi.object().keys({
    paymentId: Joi.string().custom(objectId).required(),
  }),
};

export const createProjectAssignmentPayment = {
  body: Joi.object().keys({
    project: Joi.string().custom(objectId).required(),
    user: Joi.string().custom(objectId).required(),
    assignedAmount: Joi.number().positive().required(),
    perDayAmount: Joi.number().positive().required(),
    note: Joi.string().allow(''),
    createdBy: Joi.string().custom(objectId).required(),
    createdByModel: Joi.string().valid('Admin', 'User').required(),
  }),
};

export const updateProjectAssignmentPayment = {
  params: Joi.object().keys({
    paymentId: Joi.string().custom(objectId).required(),
  }),
  body: Joi.object()
    .keys({
      project: Joi.string().custom(objectId),
      user: Joi.string().custom(objectId),
      perDayAmount: Joi.number().positive(),
      assignedAmount: Joi.number().positive(),
      note: Joi.string().allow(''),
      createdByModel: Joi.string().valid('Admin', 'User'),
    })
    .min(1),
};

export const deleteProjectAssignmentPayment = {
  params: Joi.object().keys({
    paymentId: Joi.string().custom(objectId).required(),
  }),
}; 