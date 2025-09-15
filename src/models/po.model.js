import mongoose from 'mongoose';
import { fileSchema } from './requirement.model.js';

const poItemSchema = new mongoose.Schema({
    originalBomItemId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
    },
    itemName: {
        type: String,
        required: true,
        trim: true,
    },
    units: {
        type: String,
        required: true,
        trim: true,
    },
    quantity: {
        type: Number,
        required: true,
        min: 0,
    },
    unitCost: {
        type: Number,
        required: true,
        min: 0,
    },
    vendor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vendor',
        default: null,
    },
    vendorName: { type: String },
    vendorWhatsappNumber: { type: String },
    selected: {
        type: Boolean,
        default: true,
    },
}, {
    _id: false, // Don't create separate _id for subdocuments
});

const poSchema = new mongoose.Schema({
    documents: { type: [fileSchema], default: [] },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
    vendorName: { type: String, required: true },
    vendorWhatsappNumber: { type: String, required: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    name: { type: String, required: true },
    description: { type: String }, // optional
    notes: { type: String }, // optional
    originalBomId: { type: mongoose.Schema.Types.ObjectId, ref: 'BOM', required: true },
    items: { type: [poItemSchema], default: [] }, // PO items

    isSent: { type: Boolean, default: false },
    sentAt: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
}, {
    timestamps: true,
});

const PO = mongoose.model('PO', poSchema);
export default PO; 