import mongoose from 'mongoose';
import { fileSchema } from './requirement.model.js';

const poVerificationItemSchema = new mongoose.Schema({
    itemId: {
        type: String, // Changed from ObjectId to String since we're using custom IDs
        required: true,
    },
    itemName: {
        type: String,
        required: true,
    },
    quantity: {
        type: Number,
        required: true,
    },
    units: {
        type: String,
        required: true,
    },
    unitCost: {
        type: Number,
        required: true,
    },
    isVerified: {
        type: Boolean,
        default: false,
    },
    verificationNotes: {
        type: String,
        trim: true,
    },
    verifiedAt: {
        type: Date,
    },
}, { _id: false });

const poVerificationSchema = new mongoose.Schema({
    poId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PO',
        required: true,
    },
    projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true,
    },
    qualityInspectorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    qualityInspectorName: {
        type: String,
        required: true,
    },
    status: {
        type: String,
        enum: ['pending', 'verified', 'rejected'],
        default: 'pending',
    },
    items: [poVerificationItemSchema],
    verificationNotes: {
        type: String,
        trim: true,
    },
    adminNotes: {
        type: String,
        trim: true,
    },
    verifiedAt: {
        type: Date,
    },
    adminReviewedAt: {
        type: Date,
    },
    adminReviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    attachments: {
        type: [fileSchema],
        default: [],
    },
    isActive: {
        type: Boolean,
        default: true,
    },
}, {
    timestamps: true,
});

// Indexes
poVerificationSchema.index({ poId: 1 });
poVerificationSchema.index({ projectId: 1 });
poVerificationSchema.index({ qualityInspectorId: 1 });
poVerificationSchema.index({ status: 1 });

const POVerification = mongoose.model('POVerification', poVerificationSchema);

export default POVerification;
