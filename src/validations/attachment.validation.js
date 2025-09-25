import Joi from 'joi';

const createAttachment = {
    body: Joi.object().keys({
        projectId: Joi.string().required().messages({
            'any.required': 'Project ID is required',
            'string.empty': 'Project ID cannot be empty'
        }),
        documentId: Joi.string().required().messages({
            'any.required': 'Document ID is required',
            'string.empty': 'Document ID cannot be empty'
        }),
        customerLeadId: Joi.string().required().messages({
            'any.required': 'Customer Lead ID is required',
            'string.empty': 'Customer Lead ID cannot be empty'
        }),
        requirementId: Joi.string().required().messages({
            'any.required': 'Requirement ID is required',
            'string.empty': 'Requirement ID cannot be empty'
        }),
        note: Joi.string().optional()
    }).unknown(true)
};

const getAttachmentsForCustomer = {
    params: Joi.object().keys({
        customerLeadId: Joi.string().required().messages({
            'any.required': 'Customer Lead ID is required',
            'string.empty': 'Customer Lead ID cannot be empty'
        })
    }),
    query: Joi.object().keys({
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number().integer().min(1).max(100).default(10),
        status: Joi.string().valid('pending', 'approved', 'rejected').optional()
    })
};

const getAttachmentById = {
    params: Joi.object().keys({
        attachmentId: Joi.string().required().messages({
            'any.required': 'Attachment ID is required',
            'string.empty': 'Attachment ID cannot be empty'
        })
    })
};

const reviewAttachment = {
    params: Joi.object().keys({
        attachmentId: Joi.string().required().messages({
            'any.required': 'Attachment ID is required',
            'string.empty': 'Attachment ID cannot be empty'
        })
    }),
    body: Joi.object().keys({
        status: Joi.string().valid('approved', 'rejected').required().messages({
            'any.required': 'Status is required',
            'any.only': 'Status must be either "approved" or "rejected"'
        }),
        remarks: Joi.string().when('status', {
            is: 'rejected',
            then: Joi.string().min(1).required().messages({
                'any.required': 'Remarks are required when rejecting an attachment',
                'string.empty': 'Remarks cannot be empty when rejecting an attachment'
            }),
            otherwise: Joi.string().optional()
        })
    })
};

const getAttachmentFileUrl = {
    params: Joi.object().keys({
        attachmentId: Joi.string().required().messages({
            'any.required': 'Attachment ID is required',
            'string.empty': 'Attachment ID cannot be empty'
        })
    })
};

const getAttachmentsForProject = {
    params: Joi.object().keys({
        projectId: Joi.string().required().messages({
            'any.required': 'Project ID is required',
            'string.empty': 'Project ID cannot be empty'
        })
    }),
    query: Joi.object().keys({
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number().integer().min(1).max(100).default(10),
        status: Joi.string().valid('pending', 'approved', 'rejected').optional()
    })
};

export {
    createAttachment,
    getAttachmentsForCustomer,
    getAttachmentById,
    reviewAttachment,
    getAttachmentFileUrl,
    getAttachmentsForProject
};
