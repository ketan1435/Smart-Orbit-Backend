import mongoose from 'mongoose';

const certificateSchema = new mongoose.Schema({
    projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true
    },
    certificateNumber: {
        type: String,
        required: true,
        unique: true
    },
    completionDate: {
        type: Date,
        required: true
    },
    notes: {
        type: String,
        default: null
    },
    attachmentKey: {
        type: String,
        default: null
    },
    status: {
        type: String,
        enum: ['draft', 'generated', 'sent', 'acknowledged'],
        default: 'draft'
    },
    projectName: {
        type: String,
        required: true
    },
    customerName: {
        type: String,
        required: true
    },
    customerEmail: {
        type: String,
        required: true
    },
    sentAt: {
        type: Date,
        default: null
    },
    sentTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    acknowledgedAt: {
        type: Date,
        default: null
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    createdByModel: {
        type: String,
        enum: ['User', 'Admin'],
        default: 'User'
    }
}, {
    timestamps: true
});

// Index for better query performance
certificateSchema.index({ projectId: 1, createdAt: -1 });
certificateSchema.index({ certificateNumber: 1 });
certificateSchema.index({ status: 1 });

const Certificate = mongoose.model('Certificate', certificateSchema);
export default Certificate;
