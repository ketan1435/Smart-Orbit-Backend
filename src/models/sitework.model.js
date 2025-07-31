import mongoose from 'mongoose';
import { fileSchema } from './requirement.model.js';

const documentSchema = new mongoose.Schema({
    siteengineerStatus: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected'],
        default: 'Pending',
    },
    adminStatus: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected'],
        default: 'Pending',
    },
    files: {
        type: [fileSchema],
        default: [],
    },
    addedAt: {
        type: Date,
        default: Date.now,
    },
    adminFeedback: {
        type: String,
        trim: true,
    },
    adminFeedbackBy: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'adminFeedbackByModel',
    },
    adminFeedbackByModel: {
        type: String,
        enum: ['User', 'Admin'],
    },
    siteengineerFeedback: {
        type: String,
        trim: true,
    },
    siteengineerFeedbackBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    createdByUser: { type: mongoose.Schema.Types.ObjectId, refPath: 'createdByUserModel', required: true },
    createdByUserModel: {
        type: String,
        enum: ['User', 'Admin'],
    },
    userNote: { type: String, trim: true },
});

const siteworkSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    startDate: { type: Date },
    endDate: { type: Date },
    status: {
        type: String,
        enum: ['not-started', 'in-progress', 'completed', 'cancelled'],
        default: 'not-started',
    },
    siteworkDocuments: {
        type: [documentSchema],
        default: [],
    },
    assignedUsers: [{
        user: {
            type: mongoose.Schema.Types.ObjectId, ref: 'User'
        },
        assignmentAmount: { type: Number, default: 0 },
        perDayAmount: { type: Number, default: 0 }
    }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, refPath: 'createdByModel', required: true },
    createdByModel: {
        type: String,
        enum: ['User', 'Admin'],
    },
    sequence: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
}, {
    timestamps: true,
});

const Sitework = mongoose.model('Sitework', siteworkSchema);
export default Sitework; 