import mongoose from 'mongoose';
import { validateLocaleAndSetLanguage } from 'typescript';
import { STATUS_VALUES } from '../config/enums/status.enum.js';

const customerLeadSchema = new mongoose.Schema({
  leadSource: { type: String },
  customerName: { type: String },
  mobileNumber: { type: String },
  alternateContactNumber: { type: String },
  whatsappNumber: { type: String },
  email: { type: String, lowercase: true, trim: true },
  preferredLanguage: { type: [String], default: [] },
  state: { type: String, default: '' },
  city: { type: String, default: '' },
  townVillage: { type: String, default: '' },
  googleLocationLink: { type: String },

  // Changed: requirements is now an array of ObjectId references to the Requirement model
  requirements: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Requirement',
  }],

  status: {
    type: String,
    enum: STATUS_VALUES,
    default: 'inprogress' // Default to inprogress for new customers
  },
  isConvertedToCustomer: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

const CustomerLead = mongoose.model('CustomerLead', customerLeadSchema);
export default CustomerLead;
