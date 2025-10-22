import mongoose from 'mongoose';

const maintenanceSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  title: { type: String, required: true },
  attachmentKey: { type: String, default: null },
  originalName: { type: String, default: null },
  notes: { type: String, default: null },
  status: { type: String, enum: ['draft', 'sent'], default: 'draft' },
  sentAt: { type: Date, default: null },
  sentTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdByModel: { type: String, enum: ['User', 'Admin'], default: 'User' }
}, { timestamps: true });

maintenanceSchema.index({ projectId: 1, createdAt: -1 });

const Maintenance = mongoose.model('Maintenance', maintenanceSchema);
export default Maintenance;


