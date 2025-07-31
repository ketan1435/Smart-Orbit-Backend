import mongoose from 'mongoose';

const walletTransactionSchema = new mongoose.Schema({
    // User who owns this transaction
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    // Transaction type
    type: {
        type: String,
        enum: [
            'SITE_ENGINEER_PAYMENT',    // Site engineer assignment payment
            'ARCHITECT_PAYMENT',        // Architect payment
            'PROCURERMENT_PAYMENT',     // Procurment payment
        ],
        required: true
    },

    // Amount details
    amount: {
        type: Number,
        required: true,
        min: 0
    },

    forDate: {
        type: Date,
    },

    // Currency (default to INR)
    currency: {
        type: String,
        default: 'INR',
        enum: ['INR', 'USD', 'EUR']
    },

    // Related entities
    project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
    },

    siteVisit: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SiteVisit',
    },

    requirement: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Requirement',
    },


    // Transaction description
    description: {
        type: String,
        required: true,
        trim: true
    },

    // Additional notes
    notes: {
        type: String,
        trim: true
    },

    // Who created/processed this transaction
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'createdByModel',
        required: true
    },

    createdByModel: {
        type: String,
        enum: ['Admin', 'User'],
        required: true
    },
}, {
    timestamps: true,
});

// Indexes for better query performance
walletTransactionSchema.index({ userId: 1, createdAt: -1 });
walletTransactionSchema.index({ type: 1 });
walletTransactionSchema.index({ project: 1 });

// Virtual for formatted amount
walletTransactionSchema.virtual('formattedAmount').get(function () {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: this.currency
    }).format(this.amount);
});

const WalletTransaction = mongoose.model('WalletTransaction', walletTransactionSchema);

export default WalletTransaction;