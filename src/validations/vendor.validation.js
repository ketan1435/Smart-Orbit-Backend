import Joi from 'joi';
import { objectId } from './custom.validation.js';

const createVendor = {
    body: Joi.object().keys({
        name: Joi.string().required().trim().messages({
            'string.empty': 'Vendor name is required',
            'any.required': 'Vendor name is required',
        }),
        storeName: Joi.string().required().trim().messages({
            'string.empty': 'Store name is required',
            'any.required': 'Store name is required',
        }),
        mobileNumber: Joi.string().required().trim().messages({
            'string.empty': 'Mobile number is required',
            'any.required': 'Mobile number is required',
        }),
        email: Joi.string().email().required().trim().lowercase().messages({
            'string.empty': 'Email is required',
            'string.email': 'Please provide a valid email',
            'any.required': 'Email is required',
        }),
        address: Joi.string().required().trim().messages({
            'string.empty': 'Address is required',
            'any.required': 'Address is required',
        }),
        city: Joi.string().required().trim().messages({
            'string.empty': 'City is required',
            'any.required': 'City is required',
        }),
        state: Joi.string().required().trim().messages({
            'string.empty': 'State is required',
            'any.required': 'State is required',
        }),
        country: Joi.string().required().trim().messages({
            'string.empty': 'Country is required',
            'any.required': 'Country is required',
        }),
        gstNo: Joi.string().optional().allow('', null).trim(),
    }),
};

const updateVendor = {
    params: Joi.object().keys({
        id: Joi.string().custom(objectId).required(),
    }),
    body: Joi.object().keys({
        name: Joi.string().optional().trim(),
        storeName: Joi.string().optional().trim(),
        mobileNumber: Joi.string().optional().trim(),
        email: Joi.string().email().optional().trim().lowercase(),
        address: Joi.string().optional().trim(),
        city: Joi.string().optional().trim(),
        state: Joi.string().optional().trim(),
        country: Joi.string().optional().trim(),
        gstNo: Joi.string().optional().allow('', null).trim(),
        isActive: Joi.boolean().optional(),
    }).min(1), // At least one field must be provided for update
};

const getVendor = {
    params: Joi.object().keys({
        id: Joi.string().custom(objectId).required(),
    }),
};

const deleteVendor = {
    params: Joi.object().keys({
        id: Joi.string().custom(objectId).required(),
    }),
};

const getVendors = {
    query: Joi.object().keys({
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number().integer().min(1).max(100).default(10),
        name: Joi.string().optional(),
        storeName: Joi.string().optional(),
        city: Joi.string().optional(),
        state: Joi.string().optional(),
        country: Joi.string().optional(),
        gstNo: Joi.string().optional(),
        isActive: Joi.boolean().optional(),
    }),
};

const activateVendor = {
    params: Joi.object().keys({
        id: Joi.string().custom(objectId).required(),
    }),
};

const deactivateVendor = {
    params: Joi.object().keys({
        id: Joi.string().custom(objectId).required(),
    }),
};

export {
    createVendor,
    updateVendor,
    getVendor,
    deleteVendor,
    getVendors,
    activateVendor,
    deactivateVendor,
};
