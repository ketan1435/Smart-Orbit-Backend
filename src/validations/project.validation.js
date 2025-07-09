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

export const getProjectSiteVisits = {
    params: Joi.object().keys({
        projectId: Joi.string().custom(objectId).required(),
    }),
    query: Joi.object().keys({
        siteEngineer: Joi.string().custom(objectId),
        status: Joi.string().valid('Scheduled', 'InProgress', 'Completed', 'Cancelled', 'Outdated'),
        page: Joi.number().integer(),
        limit: Joi.number().integer(),
        sortBy: Joi.string(),
    }),
};

export const submitProposal = {
    params: Joi.object().keys({
        projectId: Joi.string().custom(objectId).required(),
    }),
    body: Joi.object().keys({
        email: Joi.string().email().required(),
        proposedCharges: Joi.number().positive().required(),
        deliveryTimelineDays: Joi.number().integer().positive().required(),
        portfolioLink: Joi.string().uri().optional().allow(''),
        remarks: Joi.string().optional().allow(''),
    }),
};

export const acceptProposal = {
    params: Joi.object().keys({
        projectId: Joi.string().custom(objectId).required(),
        proposalId: Joi.string().custom(objectId).required(),
    }),
};

export const getProposals = {
    params: Joi.object().keys({
        projectId: Joi.string().custom(objectId).required(),
    }),
};

export const submitArchitectDocument = {
    params: Joi.object().keys({
        projectId: Joi.string().custom(objectId).required(),
    }),
    body: Joi.object().keys({
        notes: Joi.string().optional().allow(''),
        files: Joi.array().items(
            Joi.object().keys({
                fileType: Joi.string().valid('image', 'video', 'sketch', 'pdf', 'document', '2d drawing', '3d drawing', 'layoutPlan').required(),
                key: Joi.string().required(),
                uploadedAt: Joi.date().optional(),
            })
        ).min(1).required(),
    }),
};

export const reviewArchitectDocument = {
    params: Joi.object().keys({
        projectId: Joi.string().custom(objectId).required(),
        documentId: Joi.string().required(),
    }),
    body: Joi.object().keys({
        status: Joi.string().valid('Approved', 'Rejected').required(),
        remarks: Joi.string().when('status', {
            is: 'Rejected',
            then: Joi.string().required(),
            otherwise: Joi.string().optional().allow(''),
        }),
    }),
};

export const sendDocumentToCustomer = {
    params: Joi.object().keys({
        projectId: Joi.string().custom(objectId).required(),
        documentId: Joi.string().required(),
    }),
};

export const customerReviewDocument = {
    params: Joi.object().keys({
        projectId: Joi.string().custom(objectId).required(),
        documentId: Joi.string().required(),
    }),
    body: Joi.object().keys({
        status: Joi.string().valid('Approved', 'Rejected').required(),
        remarks: Joi.string().when('status', {
            is: 'Rejected',
            then: Joi.string().required(),
            otherwise: Joi.string().optional().allow(''),
        }),
    }),
};

export const getArchitectDocumentsForCustomer = {
    params: Joi.object().keys({
        projectId: Joi.string().custom(objectId).required(),
    }),
};

export const getProjectsForCustomer = {
    query: Joi.object().keys({
        sortBy: Joi.string(),
        limit: Joi.number().integer(),
        page: Joi.number().integer(),
    }),
};

export const sendDocumentToProcurement = {
    params: Joi.object().keys({
        projectId: Joi.string().custom(objectId).required(),
        documentId: Joi.string().required(),
    }),
};

export const getApprovedDocumentsForProcurement = {
    query: Joi.object().keys({
        projectName: Joi.string().allow(''),
        sortBy: Joi.string(),
        limit: Joi.number().integer(),
        page: Joi.number().integer(),
    }),
};

export const getProjectsForProcurement = {
    query: Joi.object().keys({
        sortBy: Joi.string(),
        limit: Joi.number().integer(),
        page: Joi.number().integer(),
    }),
};

export const getProjectDocumentsForProcurement = {
    params: Joi.object().keys({
        projectId: Joi.string().custom(objectId).required(),
    }),
}; 