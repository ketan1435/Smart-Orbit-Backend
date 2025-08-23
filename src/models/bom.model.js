import mongoose from 'mongoose';

const bomItemSchema = new mongoose.Schema({
    itemName: {
        type: String,
        required: true,
        trim: true,
    },
    description: String,
    category: {
        type: String,
        enum: [
            'Raw Materials',
            'Hardware',
            'Electrical',
            'Plumbing',
            'Finishing',
            'Tools',
            'Equipment',
            'Other',
        ],
        required: true,
    },
    unit: {
        type: String,
        required: true,
    },
    quantity: {
        type: Number,
        required: true,
        min: 0,
    },
    estimatedUnitCost: {
        type: Number,
        required: true,
        min: 0,
    },
    totalEstimatedCost: {
        type: Number,
        min: 0,
    },
    remarks: String,
    addedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    addedAt: {
        type: Date,
        default: Date.now,
    },
});

const bomSchema = new mongoose.Schema(
    {
        projectId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Project',
            required: true,
        },
        architectDocumentId: {
            type: String,
            default: null,
        },
        sourceBOMId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'BOM',
            default: null,
        },
        version: {
            type: Number,
            default: 1,
        },
        isReusable: {
            type: Boolean,
            default: false,
        },
        title: {
            type: String,
            trim: true,
        },
        status: {
            type: String,
            enum: ['draft', 'submitted', 'approved', 'rejected', 'rough', 'site_engineer_review', 'site_engineer_updated', 'planning_review'],
            default: 'draft',
        },
        remarks: String,
        adminRemarks: {
            type: String,
            default: null,
        },
        items: [bomItemSchema],
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
        updatedAt: {
            type: Date,
            default: Date.now,
        },
        // New fields for site engineer flow
        isRoughBOM: {
            type: Boolean,
            default: false,
        },
        assignedToSiteEngineer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        assignedAt: {
            type: Date,
            default: null,
        },
        siteEngineerRemarks: {
            type: String,
            default: null,
        },
        siteEngineerUpdatedAt: {
            type: Date,
            default: null,
        },
        updatedBySiteEngineer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        // Reference to the updated BOM created by site engineer
        updatedBOMId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'BOM',
            default: null,
        },
        // Reference to the original rough BOM (for updated BOMs)
        originalRoughBOMId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'BOM',
            default: null,
        },
        // Track if BOM has been sent to site engineer
        sentToSiteEngineer: {
            type: Boolean,
            default: false,
        },
        sentToSiteEngineerAt: {
            type: Date,
            default: null,
        },
        sentToSiteEngineerBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

const BOM = mongoose.model('BOM', bomSchema);
export default BOM; 