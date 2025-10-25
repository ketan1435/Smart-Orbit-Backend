import mongoose from 'mongoose';

const performanceRatingSchema = new mongoose.Schema({
    projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true,
    },
    ratedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    ratedByName: {
        type: String,
        required: true
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 10,
    },
    comments: {
        type: String,
        trim: true,
        maxlength: 500,
    },
    ratingType: {
        type: String,
        enum: ['overall', 'quality', 'timeline', 'communication', 'delivery'],
        default: 'overall'
    },
    isVisibleToScp: {
        type: Boolean,
        default: true
    },
    isVisibleToAdmin: {
        type: Boolean,
        default: true
    },
}, {
    timestamps: true,
});

performanceRatingSchema.index({ projectId: 1, createdAt: -1 });
performanceRatingSchema.index({ ratedBy: 1, createdAt: -1 });
performanceRatingSchema.index({ rating: 1 });

export default mongoose.model('PerformanceRating', performanceRatingSchema);
