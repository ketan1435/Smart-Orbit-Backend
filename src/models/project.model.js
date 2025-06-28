import mongoose from 'mongoose';
import { fileSchema } from './schema/requirement.schema.js';

const projectSchema = mongoose.Schema(
    {
        projectName: {
            type: String,
            required: true,
            trim: true,
        },
        projectCode: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },

        lead: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'CustomerLead',
            required: true,
        },
        status: {
            type: String,
            enum: ['Draft', 'Pending', 'Active', 'OnHold', 'Completed', 'Cancelled'],
            default: 'Draft',
        },
        assignedArchitect: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        assignedSiteEngineer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        startDate: {
            type: Date,
        },
        estimatedCompletionDate: {
            type: Date,
        },
        actualCompletionDate: {
            type: Date,
        },
        budget: {
            type: String,
        },
        files: [fileSchema],
        notes: {
            type: String,
            trim: true,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            refPath: 'createdByModel',
            required: true,
        },
        createdByModel: {
            type: String,
            enum: ['User', 'Admin'],
            required: true,
        },
    },
    {
        timestamps: true,
    }
);


/**
 * @typedef Project
 */
const Project = mongoose.model('Project', projectSchema);

export default Project; 