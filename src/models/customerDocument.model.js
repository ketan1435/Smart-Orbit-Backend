import mongoose from 'mongoose';

const customerDocumentSchema = new mongoose.Schema({
    projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true
    },
    documentName: {
        type: String,
        required: true
    },
    originalName: {
        type: String,
        required: true
    },
    fileKey: {
        type: String,
        required: true
    },
    fileSize: {
        type: Number,
        required: true
    },
    mimeType: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['uploaded', 'viewed', 'acknowledged'],
        default: 'uploaded'
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
    uploadedAt: {
        type: Date,
        default: Date.now
    },
    uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    uploadedByModel: {
        type: String,
        enum: ['User', 'Admin'],
        default: 'User'
    },
    viewedAt: {
        type: Date,
        default: null
    },
    viewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    notes: {
        type: String,
        default: null
    }
}, {
    timestamps: true
});

// Index for better query performance
customerDocumentSchema.index({ projectId: 1, createdAt: -1 });
customerDocumentSchema.index({ uploadedBy: 1 });
customerDocumentSchema.index({ status: 1 });

const CustomerDocument = mongoose.model('CustomerDocument', customerDocumentSchema);
export default CustomerDocument;
