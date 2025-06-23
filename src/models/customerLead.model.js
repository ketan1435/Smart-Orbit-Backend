import mongoose from 'mongoose';
import { requirementSchema } from './schema/requirement.schema.js';

const customerLeadSchema = new mongoose.Schema({
  leadSource: { type: String, required: true },
  customerName: { type: String, required: true },
  mobileNumber: { type: String, required: true },
  alternateContactNumber: { type: String },
  whatsappNumber: { type: String },
  email: { type: String, lowercase: true, trim: true },
  preferredLanguage: { type: String },
  state: { type: String, default: '' },
  city: { type: String, default: '' },
  googleLocationLink: { type: String },

  requirements: [requirementSchema],

  isActive: { type: Boolean, default: true },
}, {
  timestamps: true,
});

const CustomerLead = mongoose.model('CustomerLead', customerLeadSchema);
export default CustomerLead;
