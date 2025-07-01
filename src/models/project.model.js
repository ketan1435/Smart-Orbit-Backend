import mongoose from 'mongoose';
import { fileSchema } from './schema/requirement.schema.js';

const projectSchema = new mongoose.Schema(
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
        siteVisits: {
            type: [mongoose.Schema.Types.ObjectId],
            ref: 'SiteVisit',
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



const Project = mongoose.model('Project', projectSchema);

export default Project; 