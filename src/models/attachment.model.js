import mongoose from 'mongoose';

const attachmentSchema = new mongoose.Schema({
    projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true
    },
    documentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ArchitectDocument',
        required: true
    },
    customerLeadId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CustomerLead',
        required: true
    },
    requirementId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Requirement',
        required: true
    },
    attachment: {
        file: {
            key: {
                type: String,
                required: true
            },
            originalName: {
                type: String,
                required: true
            },
            fileType: {
                type: String,
                required: true
            },
            size: {
                type: Number,
                required: true
            },
            mimeType: {
                type: String,
                required: true
            }
        },
        note: {
            type: String,
            default: ''
        },
        type: {
            type: String,
            enum: ['admin_attachment'],
            default: 'admin_attachment'
        }
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    customerRemarks: {
        type: String,
        default: ''
    },
    reviewedAt: {
        type: Date
    },
    reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    sentBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

// Index for efficient queries
attachmentSchema.index({ projectId: 1, status: 1 });
attachmentSchema.index({ customerLeadId: 1, status: 1 });

export default mongoose.model('Attachment', attachmentSchema);
