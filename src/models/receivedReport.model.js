import mongoose from 'mongoose';

const receivedReportSchema = new mongoose.Schema({
    project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true
    },
    sentBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    sentTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    reportData: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },
    message: {
        type: String,
        default: ''
    },
    metadata: {
        projectName: String,
        customerName: String,
        sentBy: String,
        sentAt: String
    },
    status: {
        type: String,
        enum: ['sent', 'viewed', 'downloaded'],
        default: 'sent'
    },
    viewedAt: {
        type: Date
    },
    downloadedAt: {
        type: Date
    }
}, {
    timestamps: true
});

// Index for efficient queries
receivedReportSchema.index({ project: 1, sentTo: 1 });
receivedReportSchema.index({ sentBy: 1 });
receivedReportSchema.index({ status: 1 });

const ReceivedReport = mongoose.model('ReceivedReport', receivedReportSchema);

export default ReceivedReport;

