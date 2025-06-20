import mongoose from 'mongoose';

const customerLeadSchema = new mongoose.Schema({
  leadSource: { type: String, required: true },
  customerName: { type: String, required: true },
  mobileNumber: { type: String, required: true },
  whatsappNumber: { type: String },
  email: { type: String },
  preferredLanguage: { type: String },
  state: { type: String },
  city: { type: String },
  googleLocationLink: { type: String },

  requirementType: { type: String },
  otherRequirement: { type: String },
  requirementDescription: { type: String },
  urgency: { type: String },
  budget: { type: String },

  hasDrawing: { type: Boolean },
  needsArchitect: { type: Boolean },
  samplePhotoUrl: { type: String },
  requestSiteVisit: { type: Boolean },
  isActive: { type: Boolean, default: true },

  createdAt: { type: Date, default: Date.now },
});
const CustomerLead = mongoose.model('CustomerLead', customerLeadSchema);
export default CustomerLead
