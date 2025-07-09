import mongoose from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';

const scpDataSchema = new mongoose.Schema({
    siteAddress: { type: String, default: '' },
    googleLocationLink: { type: String, default: '' },
    siteType: { type: String, default: '' },
    plotSize: { type: String, default: '' },
    totalArea: { type: String, default: '' },
    plinthStatus: { type: String, default: '' },
    structureType: { type: String, default: '' },
    numUnits: { type: String, default: '' },
    usageType: { type: String, default: '' },
    avgStayDuration: { type: String, default: '' },
    additionalFeatures: { type: String, default: '' },
    designIdeas: { type: String, default: '' },
    drawingStatus: { type: String, default: '' },
    architectStatus: { type: String, default: '' },
    roomRequirements: { type: String, default: '' },
    tokenAdvance: { type: String, default: '' },
    financing: { type: String, default: '' },
    roadWidth: { type: String, default: '' },
    targetCompletionDate: { type: String, default: '' },
    siteVisitDate: { type: Date, default: null },
    scpRemarks: { type: String, default: '' },
}, { _id: false });

const sharedWithSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sharedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sharedAt: { type: Date, default: Date.now },
    isSeen: { type: Boolean, default: false },
}, { _id: false });

export const fileSchema = new mongoose.Schema({
    fileType: { type: String, required: true, enum: ['image', 'video', 'voiceMessage', 'sketch', 'pdf', 'document', 'layoutPlan', '2d drawing', '3d drawing'] },
    key: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now },
}, { _id: false });

const requirementSchema = new mongoose.Schema({
    lead: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CustomerLead',
        required: true,
    },
    project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
    },
    projectName: { type: String, default: '' },
    requirementType: { type: String, default: '' },
    otherRequirement: { type: String, default: '' },
    requirementDescription: { type: String, default: '' },
    urgency: { type: String, default: '' },
    budget: { type: String, default: '' },
    scpData: { type: scpDataSchema, default: () => ({}) },
    files: [fileSchema],
    sharedWith: [sharedWithSchema],
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});

// Virtual property to populate site visits
requirementSchema.virtual('visits', {
    ref: 'SiteVisit',
    localField: '_id',
    foreignField: 'requirement',
});

requirementSchema.plugin(mongoosePaginate);

/**
 * @typedef Requirement
 */
const Requirement = mongoose.model('Requirement', requirementSchema);

export default Requirement; 