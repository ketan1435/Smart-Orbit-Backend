import mongoose from 'mongoose';

const PoRequestItemSchema = new mongoose.Schema({
  originalBomItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'BOMItem' },
  itemName: { type: String, required: true },
  units: { type: String, required: true },
  quantity: { type: Number, required: true },
  unitCost: { type: Number, required: true },
  description: { type: String },
  brand: { type: String },
  location: { type: String },
  category: { type: String },
});

const PoRequestSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    originalBomId: { type: mongoose.Schema.Types.ObjectId, ref: 'BOM' },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
    vendorName: { type: String },
    vendorWhatsappNumber: { type: String },
    name: { type: String, required: true },
    description: { type: String },
    notes: { type: String },
    documents: [
      {
        key: { type: String, required: true },
        fileType: { type: String },
      },
    ],
    items: { type: [PoRequestItemSchema], default: [] },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, refPath: 'createdByModel' },
    createdByModel: { type: String, enum: ['User', 'Admin'] },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, refPath: 'approvedByModel' },
    approvedByModel: { type: String, enum: ['User', 'Admin'] },
    approvedAt: { type: Date },
    linkedPo: { type: mongoose.Schema.Types.ObjectId, ref: 'PO' },
  },
  { timestamps: true }
);

export default mongoose.model('PoRequest', PoRequestSchema);


