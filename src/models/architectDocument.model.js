import mongoose from 'mongoose';

const architectDocumentSchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  architect: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  files: [{
    fileType: {
      type: String,
      enum: ['image', 'video', 'sketch', 'pdf', 'document'],
      required: true
    },
    key: {
      type: String,
      required: true
    },
    originalName: {
      type: String,
      required: true
    },
    size: {
      type: Number,
      required: true
    },
    mimeType: {
      type: String,
      required: true
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  notes: {
    type: String,
    default: ''
  },
  adminStatus: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected'],
    default: 'Pending'
  },
  customerStatus: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected'],
    default: 'Pending'
  },
  adminRemarks: {
    type: String,
    default: ''
  },
  customerRemarks: {
    type: String,
    default: ''
  },
  sentToCustomer: {
    type: Boolean,
    default: false
  },
  sentToCustomerAt: {
    type: Date
  },
  sentToCustomerBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  sentToPlanningEngineer: {
    type: Boolean,
    default: false
  },
  sentToPlanningEngineerAt: {
    type: Date
  },
  sentToPlanningEngineerBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  submittedAt: {
    type: Date,
    default: Date.now
  },
  adminReviewedAt: {
    type: Date
  },
  customerReviewedAt: {
    type: Date
  },
  version: {
    type: Number,
    default: 1
  },
  isSharedWithAnyPlanningEngineer: {
    type: Boolean,
    default: false
  },
  attachments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Attachment'
  }]
}, {
  timestamps: true
});

// Index for efficient queries
architectDocumentSchema.index({ project: 1, submittedAt: -1 });
architectDocumentSchema.index({ architect: 1, submittedAt: -1 });
architectDocumentSchema.index({ adminStatus: 1, customerStatus: 1 });

const ArchitectDocument = mongoose.model('ArchitectDocument', architectDocumentSchema);

export default ArchitectDocument;
