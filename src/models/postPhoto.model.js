import mongoose from 'mongoose';

const postPhotoSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  key: { type: String, required: true },
  originalName: { type: String, required: true },
  notes: { type: String, default: null },
  status: { type: String, enum: ['draft', 'sent'], default: 'draft' },
  sentAt: { type: Date, default: null },
  sentTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdByModel: { type: String, enum: ['User', 'Admin'], default: 'User' }
}, { timestamps: true });

postPhotoSchema.index({ projectId: 1, createdAt: -1 });

const PostPhoto = mongoose.model('PostPhoto', postPhotoSchema);
export default PostPhoto;


