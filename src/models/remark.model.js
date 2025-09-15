import mongoose from 'mongoose';

const remarkSchema = new mongoose.Schema({
    projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true,
        index: true
    },
    text: {
        type: String,
        required: true,
        trim: true,
        maxlength: 1000
    },
    addedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    addedByModel: {
        type: String,
        required: true,
        enum: ['Admin', 'User']
    },
    addedAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    isEdited: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Index for efficient querying
remarkSchema.index({ projectId: 1, addedAt: -1 });

// Virtual for formatted timestamp
remarkSchema.virtual('formattedTimestamp').get(function() {
    return this.addedAt.toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
});

// Ensure virtual fields are serialized
remarkSchema.set('toJSON', { virtuals: true });
remarkSchema.set('toObject', { virtuals: true });

export default mongoose.model('Remark', remarkSchema);
