import mongoose from 'mongoose';
import { requirementSchema } from './schema/requirement.schema.js';

const customerLeadSchema = new mongoose.Schema({
  leadSource: { type: String, required: true },
  customerName: { type: String, required: true },
  mobileNumber: { type: String, required: true },
  alternateContactNumber: { type: String },
  email: { type: String, lowercase: true, trim: true },
  state: { type: String, default: '' },
  city: { type: String, default: '' },

  requirements: [requirementSchema],

  isActive: { type: Boolean, default: true },
}, {
  timestamps: true,
});

const CustomerLead = mongoose.model('CustomerLead', customerLeadSchema);
export default CustomerLead;
