import Joi from 'joi';

// Validation for individual quote item
const quoteItemValidation = Joi.object({
    bomItemId: Joi.string().required().messages({
        'string.empty': 'BOM item ID is required',
        'any.required': 'BOM item ID is required'
    }),
    itemName: Joi.string().required().trim().messages({
        'string.empty': 'Item name is required',
        'any.required': 'Item name is required'
    }),
    specification: Joi.string().optional().trim(),

    // Availability Information
    availabilityStatus: Joi.string().valid('available', 'not-available', 'limited', 'out-of-stock').required().messages({
        'any.only': 'Availability status must be one of: available, not-available, limited, out-of-stock',
        'any.required': 'Availability status is required'
    }),
    availableQuantity: Joi.number().min(0).default(0).messages({
        'number.min': 'Available quantity must be 0 or greater'
    }),
    restockTime: Joi.number().min(0).default(0).messages({
        'number.min': 'Restock time must be 0 or greater'
    }),
    restockDate: Joi.date().optional(),

    // Pricing Information
    unitPrice: Joi.number().min(0).required().messages({
        'number.min': 'Unit price must be 0 or greater',
        'any.required': 'Unit price is required'
    }),
    quantity: Joi.number().min(1).required().messages({
        'number.min': 'Quantity must be 1 or greater',
        'any.required': 'Quantity is required'
    }),
    totalPrice: Joi.number().min(0).default(0).messages({
        'number.min': 'Total price must be 0 or greater'
    }),
    currency: Joi.string().default('INR'),
    priceType: Joi.string().valid('per-unit', 'bulk', 'negotiable').default('per-unit').messages({
        'any.only': 'Price type must be one of: per-unit, bulk, negotiable'
    }),

    // Quality & Specifications
    brand: Joi.string().optional().trim(),
    grade: Joi.string().optional().trim(),
    warranty: Joi.string().optional().trim(),
    certification: Joi.string().optional().trim(),

    // Delivery & Terms
    deliveryTime: Joi.number().min(0).default(0).messages({
        'number.min': 'Delivery time must be 0 or greater'
    }),
    deliveryCost: Joi.number().min(0).default(0).messages({
        'number.min': 'Delivery cost must be 0 or greater'
    }),
    minimumOrderQuantity: Joi.number().min(0).default(0).messages({
        'number.min': 'Minimum order quantity must be 0 or greater'
    }),
    paymentTerms: Joi.string().valid('advance', 'credit', 'cod', 'partial').default('advance').messages({
        'any.only': 'Payment terms must be one of: advance, credit, cod, partial'
    }),
    creditDays: Joi.number().min(0).default(0).messages({
        'number.min': 'Credit days must be 0 or greater'
    }),

    // Additional Information
    notes: Joi.string().optional().trim(),
    alternatives: Joi.array().items(
        Joi.object({
            itemName: Joi.string().required().trim().messages({
                'string.empty': 'Alternative item name is required',
                'any.required': 'Alternative item name is required'
            }),
            price: Joi.number().min(0).required().messages({
                'number.min': 'Alternative price must be 0 or greater',
                'any.required': 'Alternative price is required'
            }),
            availability: Joi.string().valid('available', 'not-available', 'limited').required().messages({
                'any.only': 'Alternative availability must be one of: available, not-available, limited',
                'any.required': 'Alternative availability is required'
            })
        })
    ).optional(),

    // Attachments
    attachments: Joi.array().items(
        Joi.object({
            type: Joi.string().valid('quote-document', 'product-image', 'catalog', 'other').required().messages({
                'any.only': 'Attachment type must be one of: quote-document, product-image, catalog, other',
                'any.required': 'Attachment type is required'
            }),
            fileKey: Joi.string().required().messages({
                'string.empty': 'File key is required',
                'any.required': 'File key is required'
            }),
            fileName: Joi.string().required().messages({
                'string.empty': 'File name is required',
                'any.required': 'File name is required'
            })
        })
    ).optional()
});

// Main quote validation schema
export const createQuoteValidation = Joi.object({
    bomId: Joi.string().required().messages({
        'string.empty': 'BOM ID is required',
        'any.required': 'BOM ID is required'
    }),
    projectId: Joi.string().required().messages({
        'string.empty': 'Project ID is required',
        'any.required': 'Project ID is required'
    }),
    vendorId: Joi.string().required().messages({
        'string.empty': 'Vendor ID is required',
        'any.required': 'Vendor ID is required'
    }),
    createdBy: Joi.string().optional().messages({
        'string.empty': 'Created By ID cannot be empty'
    }),
    creatorRole: Joi.string().valid('site-engineer', 'planning-engineer').optional().messages({
        'any.only': 'Creator role must be either site-engineer or planning-engineer'
    }),
    siteEngineerId: Joi.string().optional().messages({
        'string.empty': 'Site Engineer ID cannot be empty'
    }),

    // Quote Details
    quoteTitle: Joi.string().required().trim().messages({
        'string.empty': 'Quote title is required',
        'any.required': 'Quote title is required'
    }),

    // Quote Items
    quoteItems: Joi.array().items(quoteItemValidation).min(1).required().messages({
        'array.min': 'At least one quote item is required',
        'any.required': 'Quote items are required'
    }),

    // Overall Quote Information
    totalAmount: Joi.number().min(0).default(0).messages({
        'number.min': 'Total amount must be 0 or greater'
    }),
    currency: Joi.string().default('INR'),

    // Validity & Terms
    validityDays: Joi.number().min(1).default(30).messages({
        'number.min': 'Validity days must be 1 or greater'
    }),
    validUntil: Joi.date().optional(),

    // Delivery Information
    overallDeliveryTime: Joi.number().min(0).default(0).messages({
        'number.min': 'Overall delivery time must be 0 or greater'
    }),
    overallDeliveryCost: Joi.number().min(0).default(0).messages({
        'number.min': 'Overall delivery cost must be 0 or greater'
    }),

    // Payment Terms
    overallPaymentTerms: Joi.string().valid('advance', 'credit', 'cod', 'partial').default('advance').messages({
        'any.only': 'Overall payment terms must be one of: advance, credit, cod, partial'
    }),
    overallCreditDays: Joi.number().min(0).default(0).messages({
        'number.min': 'Overall credit days must be 0 or greater'
    }),

    // Status & Workflow
    status: Joi.string().valid('draft', 'submitted', 'reviewed', 'accepted', 'rejected', 'expired').default('draft').messages({
        'any.only': 'Status must be one of: draft, submitted, reviewed, accepted, rejected, expired'
    }),

    // Site Engineer Notes
    siteEngineerNotes: Joi.string().optional().trim(),

    // Additional Information
    notes: Joi.string().optional().trim(),

    // Attachments for the entire quote
    quoteAttachments: Joi.array().items(
        Joi.object({
            type: Joi.string().valid('quote-document', 'catalog', 'terms', 'other').required().messages({
                'any.only': 'Quote attachment type must be one of: quote-document, catalog, terms, other',
                'any.required': 'Quote attachment type is required'
            }),
            fileKey: Joi.string().required().messages({
                'string.empty': 'Quote file key is required',
                'any.required': 'Quote file key is required'
            }),
            fileName: Joi.string().required().messages({
                'string.empty': 'Quote file name is required',
                'any.required': 'Quote file name is required'
            })
        })
    ).optional()
});

// Update quote validation (all fields optional)
export const updateQuoteValidation = Joi.object({
    bomId: Joi.string().optional(),
    projectId: Joi.string().optional(),
    vendorId: Joi.string().optional(),
    siteEngineerId: Joi.string().optional(),

    // Quote Details
    quoteTitle: Joi.string().optional().trim(),

    // Quote Items
    quoteItems: Joi.array().items(quoteItemValidation).optional(),

    // Overall Quote Information
    totalAmount: Joi.number().min(0).optional().messages({
        'number.min': 'Total amount must be 0 or greater'
    }),
    currency: Joi.string().optional(),

    // Validity & Terms
    validityDays: Joi.number().min(1).optional().messages({
        'number.min': 'Validity days must be 1 or greater'
    }),
    validUntil: Joi.date().optional(),

    // Delivery Information
    overallDeliveryTime: Joi.number().min(0).optional().messages({
        'number.min': 'Overall delivery time must be 0 or greater'
    }),
    overallDeliveryCost: Joi.number().min(0).optional().messages({
        'number.min': 'Overall delivery cost must be 0 or greater'
    }),

    // Payment Terms
    overallPaymentTerms: Joi.string().valid('advance', 'credit', 'cod', 'partial').optional().messages({
        'any.only': 'Overall payment terms must be one of: advance, credit, cod, partial'
    }),
    overallCreditDays: Joi.number().min(0).optional().messages({
        'number.min': 'Overall credit days must be 0 or greater'
    }),

    // Status & Workflow
    status: Joi.string().valid('draft', 'submitted', 'reviewed', 'accepted', 'rejected', 'expired').optional().messages({
        'any.only': 'Status must be one of: draft, submitted, reviewed, accepted, rejected, expired'
    }),

    // Review Information
    reviewedBy: Joi.string().optional(),
    reviewedAt: Joi.date().optional(),
    reviewNotes: Joi.string().optional().trim(),

    // Site Engineer Notes
    siteEngineerNotes: Joi.string().optional().trim(),

    // Additional Information
    notes: Joi.string().optional().trim(),

    // Attachments for the entire quote
    quoteAttachments: Joi.array().items(
        Joi.object({
            type: Joi.string().valid('quote-document', 'catalog', 'terms', 'other').required().messages({
                'any.only': 'Quote attachment type must be one of: quote-document, catalog, terms, other',
                'any.required': 'Quote attachment type is required'
            }),
            fileKey: Joi.string().required().messages({
                'string.empty': 'Quote file key is required',
                'any.required': 'Quote file key is required'
            }),
            fileName: Joi.string().required().messages({
                'string.empty': 'Quote file name is required',
                'any.required': 'Quote file name is required'
            })
        })
    ).optional(),

    // Tracking
    isActive: Joi.boolean().optional()
});

// Query parameters validation for getting quotes
export const getQuotesValidation = Joi.object({
    page: Joi.number().min(1).default(1).messages({
        'number.min': 'Page must be 1 or greater'
    }),
    limit: Joi.number().min(1).max(100).default(10).messages({
        'number.min': 'Limit must be 1 or greater',
        'number.max': 'Limit cannot exceed 100'
    }),
    bomId: Joi.string().optional(),
    projectId: Joi.string().optional(),
    vendorId: Joi.string().optional(),
    siteEngineerId: Joi.string().optional(),
    status: Joi.string().valid('draft', 'submitted', 'reviewed', 'accepted', 'rejected', 'expired').optional().messages({
        'any.only': 'Status must be one of: draft, submitted, reviewed, accepted, rejected, expired'
    }),
    isActive: Joi.boolean().optional(),
    sortBy: Joi.string().valid('createdAt', 'updatedAt', 'totalAmount', 'validUntil').default('createdAt').messages({
        'any.only': 'Sort by must be one of: createdAt, updatedAt, totalAmount, validUntil'
    }),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc').messages({
        'any.only': 'Sort order must be one of: asc, desc'
    })
});

// Validation for quote comparison
export const getQuoteComparisonValidation = Joi.object({
    includeExpired: Joi.boolean().default(false).messages({
        'boolean.base': 'Include expired must be a boolean value'
    })
});

// Validation for bulk quote operations
export const bulkQuoteValidation = Joi.object({
    bomId: Joi.string().required().messages({
        'string.empty': 'BOM ID is required',
        'any.required': 'BOM ID is required'
    }),
    projectId: Joi.string().required().messages({
        'string.empty': 'Project ID is required',
        'any.required': 'Project ID is required'
    }),
    createdBy: Joi.string().optional().messages({
        'string.empty': 'Created By ID cannot be empty'
    }),
    creatorRole: Joi.string().valid('site-engineer', 'planning-engineer').optional().messages({
        'any.only': 'Creator role must be either site-engineer or planning-engineer'
    }),
    siteEngineerId: Joi.string().optional().messages({
        'string.empty': 'Site Engineer ID cannot be empty'
    }),
    quotes: Joi.array().items(
        Joi.object({
            vendorId: Joi.string().required().messages({
                'string.empty': 'Vendor ID is required',
                'any.required': 'Vendor ID is required'
            }),
            quoteTitle: Joi.string().required().trim().messages({
                'string.empty': 'Quote title is required',
                'any.required': 'Quote title is required'
            }),
            quoteItems: Joi.array().items(quoteItemValidation).min(1).required().messages({
                'array.min': 'At least one quote item is required',
                'any.required': 'Quote items are required'
            }),
            totalAmount: Joi.number().min(0).required().messages({
                'number.min': 'Total amount must be 0 or greater',
                'any.required': 'Total amount is required'
            }),
            validityDays: Joi.number().min(1).default(30).messages({
                'number.min': 'Validity days must be 1 or greater'
            }),
            siteEngineerNotes: Joi.string().optional().trim(),
            notes: Joi.string().optional().trim()
        })
    ).min(1).required().messages({
        'array.min': 'At least one quote is required',
        'any.required': 'Quotes are required'
    })
});
