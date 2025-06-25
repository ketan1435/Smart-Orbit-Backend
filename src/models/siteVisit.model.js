import mongoose from 'mongoose';


const siteVisitSchema = mongoose.Schema(
    {
        requirement: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Requirement',
            required: true,
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
        status: {
            type: String,
            enum: ['Scheduled', 'Completed', 'Approved', 'Cancelled', 'Outdated'],
            default: 'Scheduled',
        },
        updatedData: {
            type: Object, // Stores the snapshot of scpData proposed by the engineer
            default: null,
        },
        remarks: {
            type: String,
            trim: true,
        },
        approvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        approvedAt: {
            type: Date,
        },
    },
    {
        timestamps: true,
    }
);

/**
 * @typedef SiteVisit
 */
const SiteVisit = mongoose.model('SiteVisit', siteVisitSchema);

export default SiteVisit;
