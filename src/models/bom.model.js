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
            // validate: {
            //     validator: function (value) {
            //         // Title is required only if isReusable is true
            //         if (this.isReusable && !value) {
            //             return false;
            //         }
            //         return true;
            //     },
            //     message: 'Title is required for reusable BOMs'
            // }
        },
        status: {
            type: String,
            enum: ['draft', 'submitted', 'approved', 'rejected'],
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
    },
    {
        timestamps: true,
    }
);

const BOM = mongoose.model('BOM', bomSchema);
export default BOM; 