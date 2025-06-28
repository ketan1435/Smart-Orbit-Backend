import Joi from 'joi';
import { objectId } from './custom.validation.js';

// Validation schemas for Project can be added here later
// For now, project creation is internal.
// We can add validations for update, etc. as those features are built.

// e.g., createProject, getProjects, etc.

export const getProjects = {
    query: Joi.object().keys({
        projectName: Joi.string().allow(''),
        projectCode: Joi.string().allow(''),
        status: Joi.string().allow(''),
        customerName: Joi.string().allow(''),
        requirementType: Joi.string().allow(''),
        sortBy: Joi.string(),
        limit: Joi.number().integer(),
        page: Joi.number().integer(),
    }),
}; 