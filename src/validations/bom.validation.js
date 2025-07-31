import Joi from 'joi';
import { objectId } from './custom.validation.js';

const bomItemSchema = Joi.object({
    itemName: Joi.string().required().trim(),
    description: Joi.string().optional(),
    category: Joi.string()
        .valid(
            'Raw Materials',
            'Hardware',
            'Electrical',
            'Plumbing',
            'Finishing',
            'Tools',
            'Equipment',
            'Other'
        )
        .required(),
    unit: Joi.string().required(),
    quantity: Joi.number().min(0).required(),
    estimatedUnitCost: Joi.number().min(0).required(),
    totalEstimatedCost: Joi.number().min(0).optional(),
    remarks: Joi.string().optional(),
});

export const createBOM = {
    params: Joi.object().keys({
        projectId: Joi.string().custom(objectId).required(),
    }),
    body: Joi.object().keys({
        architectDocumentId: Joi.string().required(),
        sourceBOMId: Joi.string().custom(objectId).optional().allow(null, ''),
        isReusable: Joi.boolean().optional().default(false),
        title: Joi.string().trim().when('isReusable', {
            is: true,
            then: Joi.required(),
            otherwise: Joi.optional()
        }),
        status: Joi.string().valid('draft', 'submitted').optional().default('draft'),
        remarks: Joi.string().optional(),
        items: Joi.array().items(bomItemSchema).min(1).required(),
    }),
};

export const getBOMs = {
    params: Joi.object().keys({
        projectId: Joi.string().custom(objectId).required(),
    }),
    query: Joi.object().keys({
        status: Joi.string().valid('draft', 'submitted', 'approved', 'rejected'),
        version: Joi.number().min(1),
        architectDocumentId: Joi.string().custom(objectId),
        isReusable: Joi.boolean(),
        sortBy: Joi.string(),
        limit: Joi.number().integer(),
        page: Joi.number().integer(),
    }),
};

export const getBOM = {
    params: Joi.object().keys({
        projectId: Joi.string().custom(objectId).required(),
        bomId: Joi.string().custom(objectId).required(),
    }),
};

export const updateBOM = {
    params: Joi.object().keys({
        projectId: Joi.string().custom(objectId).required(),
        bomId: Joi.string().custom(objectId).required(),
    }),
    body: Joi.object()
        .keys({
            isReusable: Joi.boolean().optional(),
            title: Joi.string().trim().when('isReusable', {
                is: true,
                then: Joi.required(),
                otherwise: Joi.optional()
            }),
            remarks: Joi.string().optional(),
            items: Joi.array().items(bomItemSchema).min(1).optional(),
        })
        .min(1),
};

export const updateBOMStatus = {
    params: Joi.object().keys({
        projectId: Joi.string().custom(objectId).required(),
        bomId: Joi.string().custom(objectId).required(),
    }),
    body: Joi.object().keys({
        status: Joi.string().valid('draft', 'submitted', 'approved', 'rejected').required(),
        remarks: Joi.string().optional(),
    }),
};

export const deleteBOM = {
    params: Joi.object().keys({
        projectId: Joi.string().custom(objectId).required(),
        bomId: Joi.string().custom(objectId).required(),
    }),
};

// New validation for submitting BOM for admin review
export const submitBOM = {
    params: Joi.object().keys({
        projectId: Joi.string().custom(objectId).required(),
        bomId: Joi.string().custom(objectId).required(),
    }),
};

// New validation for getting submitted BOMs for admin review
export const getSubmittedBOMs = {
    query: Joi.object().keys({
        createdBy: Joi.string().custom(objectId).optional(),
        sortBy: Joi.string(),
        limit: Joi.number().integer(),
        page: Joi.number().integer(),
        projectId: Joi.string().custom(objectId).optional(),
    }),
};

// New validation for admin reviewing BOM (approve/reject)
export const reviewBOM = {
    params: Joi.object().keys({
        projectId: Joi.string().custom(objectId).required(),
        bomId: Joi.string().custom(objectId).required(),
    }),
    body: Joi.object().keys({
        status: Joi.string().valid('approved', 'rejected').required(),
        adminRemarks: Joi.string().required(),
    }),
};

// New validation for getting procurement team members
export const getProcurementTeam = {
    query: Joi.object().keys({
        sortBy: Joi.string(),
        limit: Joi.number().integer().min(1).max(100).default(50),
        page: Joi.number().integer().min(1).default(1),
    }),
};

// New validation for getting all BOMs (general listing)
export const getAllBOMs = {
    query: Joi.object().keys({
        status: Joi.string().valid('draft', 'submitted', 'pending', 'approved', 'rejected'),
        projectId: Joi.string().custom(objectId),
        search: Joi.string().optional(),
        sortBy: Joi.string(),
        limit: Joi.number().integer().min(1).max(100).default(50),
        page: Joi.number().integer().min(1).default(1),
    }),
}; 