import mongoose from 'mongoose';
import { validateLocaleAndSetLanguage } from 'typescript';

const customerLeadSchema = new mongoose.Schema({
  leadSource: { type: String, required: true },
  customerName: { type: String, required: true },
  mobileNumber: { type: String, required: true },
  alternateContactNumber: { type: String },
  whatsappNumber: { type: String },
  email: { type: String, lowercase: true, trim: true },
  preferredLanguage: { type: [String] },
  state: { type: String, default: '' },
  city: { type: String, default: '' },
  townVillage: { type: String, default: '' },
  preferredLanguage: { type: [String], default: [] },
  state: { type: String, default: '' },
  googleLocationLink: { type: String },

  // Changed: requirements is now an array of ObjectId references to the Requirement model
  requirements: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Requirement',
  }],

  isActive: { type: Boolean, default: true },
}, {
  timestamps: true,
});

const CustomerLead = mongoose.model('CustomerLead', customerLeadSchema);
export default CustomerLead;
