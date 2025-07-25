import mongoose from 'mongoose';
import { fileSchema } from './requirement.model.js';

const poSchema = new mongoose.Schema({
    documents: { type: [fileSchema], default: [] },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    name: { type: String, required: true },
    description: { type: String }, // optional
    isActive: { type: Boolean, default: true },
}, {
    timestamps: true,
});

const PO = mongoose.model('PO', poSchema);
export default PO; 