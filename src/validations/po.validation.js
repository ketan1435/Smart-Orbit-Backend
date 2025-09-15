import Joi from 'joi';

const poItemSchema = Joi.object({
    originalBomItemId: Joi.string().optional().allow(null, ''),
    itemName: Joi.string().required().trim().messages({
        'string.empty': 'Item name is required',
        'any.required': 'Item name is required',
    }),
    units: Joi.string().required().trim().messages({
        'string.empty': 'Units is required',
        'any.required': 'Units is required',
    }),
    quantity: Joi.number().min(0).required().messages({
        'number.min': 'Quantity must be greater than or equal to 0',
        'any.required': 'Quantity is required',
    }),
    unitCost: Joi.number().min(0).required().messages({
        'number.min': 'Unit cost must be greater than or equal to 0',
        'any.required': 'Unit cost is required',
    }),
    vendor: Joi.string().optional().allow(null, ''),
    vendorName: Joi.string().optional().allow('', null),
    vendorWhatsappNumber: Joi.string().optional().allow('', null),
    selected: Joi.boolean().default(true),
});

const createPO = {
    body: Joi.object().keys({
        vendor: Joi.string().required().messages({
            'string.empty': 'Vendor is required',
            'any.required': 'Vendor is required',
        }),
        vendorName: Joi.string().required().messages({
            'string.empty': 'Vendor name is required',
            'any.required': 'Vendor name is required',
        }),
        vendorWhatsappNumber: Joi.string().required().messages({
            'string.empty': 'Vendor WhatsApp number is required',
            'any.required': 'Vendor WhatsApp number is required',
        }),
        project: Joi.string().required().messages({
            'string.empty': 'Project is required',
            'any.required': 'Project is required',
        }),
        name: Joi.string().required().trim().messages({
            'string.empty': 'PO name is required',
            'any.required': 'PO name is required',
        }),
        description: Joi.string().optional().allow('', null),
        notes: Joi.string().optional().allow('', null),
        originalBomId: Joi.string().optional().allow(null, ''),
        documents: Joi.array().items(
            Joi.object({
                key: Joi.string().required(),
                fileType: Joi.string().required(),
            })
        ).optional().default([]),
        items: Joi.array().items(poItemSchema).default([]),
    }),
};

const getPOs = {
    query: Joi.object().keys({
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number().integer().min(1).max(100).default(10),
        vendor: Joi.string().optional(),
        project: Joi.string().optional(),
        name: Joi.string().optional(),
    }),
};

const activatePO = {
    params: Joi.object().keys({
        id: Joi.string().required(),
    }),
};

const deactivatePO = {
    params: Joi.object().keys({
        id: Joi.string().required(),
    }),
};

const markItemsAsDelivered = {
    params: Joi.object().keys({
        id: Joi.string().required(),
    }),
    body: Joi.object().keys({
        itemIndices: Joi.array()
            .items(Joi.number().integer().min(0))
            .min(1)
            .required()
            .messages({
                'array.min': 'At least one item index must be provided',
                'any.required': 'Item indices are required',
            }),
    }),
};

export default {
    createPO,
    getPOs,
    activatePO,
    deactivatePO,
    markItemsAsDelivered,
};
