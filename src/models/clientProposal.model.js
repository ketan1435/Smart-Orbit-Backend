import mongoose, { Schema } from 'mongoose';

const ClientProposalSchema = new Schema(
    {
        project: {
            type: Schema.Types.ObjectId,
            required: true,
            ref: 'Project',
        },
        customerInfo: {
            name: { type: String, required: true },
            email: String,
            phone: String,
            address: String,
        },
        proposalFor: { type: String },
        projectLocation: { type: String },
        projectType: { type: String },
        unitCost: { type: String },

        // Custom WYSIWYG sections - stored as raw HTML
        manufacturingSupply: { type: String },  // HTML content
        projectOverview: { type: String },
        cottageSpecifications: { type: String },
        materialDetails: { type: String },
        keyDurabilityFeatures: { type: String },
        additionalFeatures: { type: String },
        costBreakdown: { type: String },
        paymentTerms: { type: String },
        salesTerms: { type: String },
        contactInformation: { type: String },

        status: {
            type: String,
            enum: ['draft', 'sent', 'approved', 'rejected', 'archived'],
            default: 'draft',
        },
        // Customer approval workflow
        sentToCustomer: {
            type: Boolean,
            default: false,
        },
        sentToCustomerAt: {
            type: Date,
        },
        customerRemarks: {
            type: String,
        },
        customerReviewedAt: {
            type: Date,
        },
        version: {
            type: Number,
            default: 1,
        },

        // Metadata
        createdBy: {
            type: Schema.Types.ObjectId,
            refpath: 'createdByModel',
        },
        createdByModel: {
            type: String,
            enum: ['User', 'Admin'],
        },
        updatedBy: {
            type: Schema.Types.ObjectId,
            refpath: 'updatedByModel',
        },
        updatedByModel: {
            type: String,
            enum: ['User', 'Admin'],
        },
    },
    {
        timestamps: true, // adds createdAt, updatedAt
    }
);

export default mongoose.model('ClientProposal', ClientProposalSchema); 