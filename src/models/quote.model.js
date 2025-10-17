import mongoose from 'mongoose';

// Schema for individual quote items
const quoteItemSchema = new mongoose.Schema({
    bomItemId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BOM',
        required: true,
    },
    itemName: {
        type: String,
        required: true,
        trim: true,
    },
    specification: {
        type: String,
        trim: true,
    },

    // Availability Information
    availabilityStatus: {
        type: String,
        enum: ['available', 'not-available', 'limited', 'out-of-stock'],
        required: true,
        default: 'available',
    },
    availableQuantity: {
        type: Number,
        min: 0,
        default: 0,
    },
    restockTime: {
        type: Number, // days
        min: 0,
        default: 0,
    },
    restockDate: {
        type: Date,
        default: null,
    },

    // Pricing Information
    unitPrice: {
        type: Number,
        required: true,
        min: 0,
    },
    quantity: {
        type: Number,
        required: true,
        min: 1,
    },
    totalPrice: {
        type: Number,
        required: true,
        min: 0,
    },
    currency: {
        type: String,
        default: 'INR',
    },
    priceType: {
        type: String,
        enum: ['per-unit', 'bulk', 'negotiable'],
        default: 'per-unit',
    },

    // Quality & Specifications
    brand: {
        type: String,
        trim: true,
    },
    grade: {
        type: String,
        trim: true,
    },
    warranty: {
        type: String,
        trim: true,
    },
    certification: {
        type: String,
        trim: true, // ISI, BIS, etc.
    },

    // Delivery & Terms
    deliveryTime: {
        type: Number, // days
        min: 0,
        default: 0,
    },
    deliveryCost: {
        type: Number,
        min: 0,
        default: 0,
    },
    minimumOrderQuantity: {
        type: Number,
        min: 0,
        default: 0,
    },
    paymentTerms: {
        type: String,
        enum: ['advance', 'credit', 'cod', 'partial'],
        default: 'advance',
    },
    creditDays: {
        type: Number,
        min: 0,
        default: 0,
    },

    // Additional Information
    notes: {
        type: String,
        trim: true,
    },
    alternatives: [{
        itemName: {
            type: String,
            trim: true,
        },
        price: {
            type: Number,
            min: 0,
        },
        availability: {
            type: String,
            enum: ['available', 'not-available', 'limited'],
        },
    }],

    // Attachments
    attachments: [{
        type: {
            type: String,
            enum: ['quote-document', 'product-image', 'catalog', 'other'],
        },
        fileKey: {
            type: String,
            required: true,
        },
        fileName: {
            type: String,
            required: true,
        },
        uploadedAt: {
            type: Date,
            default: Date.now,
        },
    }],

    // Timestamps
    quotedAt: {
        type: Date,
        default: Date.now,
    },
}, {
    timestamps: true,
});

// Main Quote Schema
const quoteSchema = new mongoose.Schema({
    bomId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BOM',
        required: true,
    },
    projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true,
    },
    vendorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vendor',
        required: true,
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    creatorRole: {
        type: String,
        enum: ['site-engineer', 'planning-engineer'],
        required: true,
    },
    // Legacy field for backward compatibility
    siteEngineerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false, // Made optional for backward compatibility
    },

    // Quote Details
    quoteNumber: {
        type: String,
        // unique index defined below; avoid duplicate index definitions
        required: false, // Will be generated in pre-save middleware
    },
    quoteTitle: {
        type: String,
        trim: true,
        required: true,
    },

    // Quote Items
    quoteItems: [quoteItemSchema],

    // Overall Quote Information
    totalAmount: {
        type: Number,
        required: true,
        min: 0,
    },
    currency: {
        type: String,
        default: 'INR',
    },

    // Validity & Terms
    validityDays: {
        type: Number,
        min: 1,
        default: 30,
    },
    validUntil: {
        type: Date,
        required: false, // Will be calculated in pre-save middleware
    },

    // Delivery Information
    overallDeliveryTime: {
        type: Number, // days
        min: 0,
        default: 0,
    },
    overallDeliveryCost: {
        type: Number,
        min: 0,
        default: 0,
    },

    // Payment Terms
    overallPaymentTerms: {
        type: String,
        enum: ['advance', 'credit', 'cod', 'partial'],
        default: 'advance',
    },
    overallCreditDays: {
        type: Number,
        min: 0,
        default: 0,
    },

    // Status & Workflow
    status: {
        type: String,
        enum: ['draft', 'submitted', 'reviewed', 'accepted', 'rejected', 'expired'],
        default: 'draft',
    },

    // Review Information
    reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },
    reviewedAt: {
        type: Date,
        default: null,
    },
    reviewNotes: {
        type: String,
        trim: true,
    },

    // Site Engineer Notes
    siteEngineerNotes: {
        type: String,
        trim: true,
    },

    // Vendor Information (cached for performance)
    vendorInfo: {
        storeName: {
            type: String,
            required: false, // Will be populated in pre-save middleware
        },
        contactPerson: {
            type: String,
        },
        mobileNumber: {
            type: String,
            required: false, // Will be populated in pre-save middleware
        },
        email: {
            type: String,
        },
        address: {
            type: String,
        },
        city: {
            type: String,
        },
        state: {
            type: String,
        },
    },

    // Additional Information
    notes: {
        type: String,
        trim: true,
    },

    // Attachments for the entire quote
    quoteAttachments: [{
        type: {
            type: String,
            enum: ['quote-document', 'catalog', 'terms', 'other'],
        },
        fileKey: {
            type: String,
            required: true,
        },
        fileName: {
            type: String,
            required: true,
        },
        uploadedAt: {
            type: Date,
            default: Date.now,
        },
    }],

    // Tracking
    isActive: {
        type: Boolean,
        default: true,
    },

    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
}, {
    timestamps: true,
});

// Indexes for better query performance
quoteSchema.index({ bomId: 1, vendorId: 1 });
quoteSchema.index({ projectId: 1, status: 1 });
quoteSchema.index({ siteEngineerId: 1, createdAt: -1 });
quoteSchema.index({ validUntil: 1, status: 1 });
quoteSchema.index({ quoteNumber: 1 }, { unique: true });

// Pre-save middleware to generate quote number
quoteSchema.pre('save', async function (next) {
    try {
        // Generate quote number if not exists
        if (this.isNew && !this.quoteNumber) {
            const count = await this.constructor.countDocuments();
            this.quoteNumber = `QT-${Date.now()}-${count + 1}`;
        }

        // Calculate validUntil date
        if (this.validityDays && !this.validUntil) {
            this.validUntil = new Date();
            this.validUntil.setDate(this.validUntil.getDate() + this.validityDays);
        }

        // Handle legacy siteEngineerId field for backward compatibility
        if (this.createdBy && !this.siteEngineerId) {
            this.siteEngineerId = this.createdBy;
        }

        // Cache vendor information
        if (this.vendorId && (!this.vendorInfo || !this.vendorInfo.storeName)) {
            try {
                const Vendor = mongoose.model('Vendor');
                const vendor = await Vendor.findById(this.vendorId);
                if (vendor) {
                    this.vendorInfo = {
                        storeName: vendor.storeName || 'Unknown Store',
                        contactPerson: vendor.name || '',
                        mobileNumber: vendor.mobileNumber || '',
                        email: vendor.email || '',
                        address: vendor.address || '',
                        city: vendor.city || '',
                        state: vendor.state || '',
                    };
                } else {
                    // Set default values if vendor not found
                    this.vendorInfo = {
                        storeName: 'Unknown Store',
                        contactPerson: '',
                        mobileNumber: '',
                        email: '',
                        address: '',
                        city: '',
                        state: '',
                    };
                }
            } catch (error) {
                console.error('Error caching vendor info:', error);
                // Set default values on error
                this.vendorInfo = {
                    storeName: 'Unknown Store',
                    contactPerson: '',
                    mobileNumber: '',
                    email: '',
                    address: '',
                    city: '',
                    state: '',
                };
            }
        }

        next();
    } catch (error) {
        console.error('Pre-save middleware error:', error);
        next(error);
    }
});

// Method to check if quote is expired
quoteSchema.methods.isExpired = function () {
    return new Date() > this.validUntil;
};

// Method to calculate total amount from items
quoteSchema.methods.calculateTotal = function () {
    this.totalAmount = this.quoteItems.reduce((sum, item) => sum + item.totalPrice, 0);
    return this.totalAmount;
};

// Static method to get quotes by BOM with vendor details
quoteSchema.statics.getQuotesByBOM = function (bomId) {
    return this.find({ bomId, isActive: true })
        .populate('vendorId', 'storeName name mobileNumber email address city state')
        .populate('createdBy', 'name email role')
        .populate('siteEngineerId', 'name email')
        .populate('reviewedBy', 'name email')
        .sort({ createdAt: -1 });
};

// Static method to get quote comparison for BOM items
quoteSchema.statics.getQuoteComparison = function (bomId) {
    return this.aggregate([
        { $match: { bomId: new mongoose.Types.ObjectId(bomId), isActive: true } },
        { $unwind: '$quoteItems' },
        {
            $group: {
                _id: '$quoteItems.bomItemId',
                itemName: { $first: '$quoteItems.itemName' },
                quotes: {
                    $push: {
                        quoteId: '$_id',
                        vendorId: '$vendorId',
                        vendorName: '$vendorInfo.storeName',
                        price: '$quoteItems.unitPrice',
                        totalPrice: '$quoteItems.totalPrice',
                        availability: '$quoteItems.availabilityStatus',
                        deliveryTime: '$quoteItems.deliveryTime',
                        paymentTerms: '$quoteItems.paymentTerms',
                        quoteDate: '$quoteItems.quotedAt',
                        validUntil: '$validUntil',
                    }
                }
            }
        },
        { $sort: { 'quotes.price': 1 } }
    ]);
};

const Quote = mongoose.model('Quote', quoteSchema);
export default Quote;
