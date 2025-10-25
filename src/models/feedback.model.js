import mongoose from 'mongoose';

const feedbackSchema = new mongoose.Schema({
    projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    userRole: {
        type: String,
        required: true,
        enum: ['user', 'Admin', 'scp-user', 'architect', 'vendor']
    },
    userName: {
        type: String,
        required: true
    },
    feedbackType: {
        type: String,
        required: true,
        enum: ['general', 'quality', 'communication', 'timeline', 'service', 'other']
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    title: {
        type: String,
        required: true,
        trim: true,
        maxLength: 200
    },
    description: {
        type: String,
        required: true,
        trim: true,
        maxLength: 1000
    },
    isPublic: {
        type: Boolean,
        default: true
    },
    status: {
        type: String,
        enum: ['submitted', 'reviewed', 'resolved'],
        default: 'submitted'
    },
    adminResponse: {
        type: String,
        trim: true,
        maxLength: 500
    },
    adminResponseBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    adminResponseAt: {
        type: Date
    }
}, {
    timestamps: true
});

// Index for efficient queries
feedbackSchema.index({ projectId: 1, createdAt: -1 });
feedbackSchema.index({ userId: 1, createdAt: -1 });
feedbackSchema.index({ userRole: 1, createdAt: -1 });
feedbackSchema.index({ status: 1 });

export default mongoose.model('Feedback', feedbackSchema);

