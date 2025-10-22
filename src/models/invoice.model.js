import mongoose from 'mongoose';

const invoiceSchema = new mongoose.Schema({
    projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true
    },
    invoiceNumber: {
        type: String,
        required: true,
        unique: true,
        immutable: true, // Makes the field read-only after creation
        default: function() {
            // This will be overridden by the service, but provides a fallback
            return '0001';
        }
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    description: {
        type: String,
        required: true
    },
    attachmentKey: {
        type: String,
        default: null
    },
    status: {
        type: String,
        enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled'],
        default: 'draft'
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'partial', 'overdue'],
        default: 'pending'
    },
    customerName: {
        type: String,
        required: true
    },
    customerEmail: {
        type: String,
        required: true
    },
    dueDate: {
        type: Date,
        default: null
    },
    paidDate: {
        type: Date,
        default: null
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    createdByModel: {
        type: String,
        enum: ['User', 'Admin'],
        default: 'User'
    },
    sentAt: {
        type: Date,
        default: null
    },
    sentTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    }
}, {
    timestamps: true
});

// Index for better query performance
invoiceSchema.index({ projectId: 1, createdAt: -1 });
invoiceSchema.index({ invoiceNumber: 1 });
invoiceSchema.index({ status: 1 });

const Invoice = mongoose.model('Invoice', invoiceSchema);
export default Invoice;
