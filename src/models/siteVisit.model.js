import mongoose from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';
import { fileSchema } from './requirement.model.js';

const documentSchema = new mongoose.Schema({
    status: {
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
    feedbackBy: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'feedbackByModel',
    },
    feedbackByModel: {
        type: String,
        enum: ['User', 'Admin'],
    },
    engineerFeedback: {
        type: String,
        trim: true,
    },
    engineerFeedbackBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
});

const siteVisitSchema = new mongoose.Schema({
    project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true,
    },
    requirement: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Requirement',
        required: true,
    },
    hasRequirementEditAccess: {
        type: Boolean,
        default: false,
    },
    siteEngineer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    visitDate: {
        type: Date,
        required: true,
    },
    documents: {
        type: [documentSchema],
        default: [],
    },
    status: {
        type: String,
        enum: ['Scheduled', 'InProgress', 'Completed', 'Cancelled', 'Outdated'],
        default: 'Scheduled',
    },
    updatedData: {
        type: Object, // Stores the snapshot of scpData proposed by the engineer
        default: null,
    },
    reviewedBy: {
        type: [mongoose.Schema.Types.ObjectId],
        ref: 'User',
    },
    reviewedAt: {
        type: Date,
        default: null,
    },
},
    {
        timestamps: true,
    });

// add plugin that converts mongoose to json
siteVisitSchema.plugin(mongoosePaginate);

/**
 * @typedef SiteVisit
 */
const SiteVisit = mongoose.model('SiteVisit', siteVisitSchema);

export default SiteVisit;
