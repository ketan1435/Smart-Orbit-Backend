import {
    createPerformanceRatingService,
    getPerformanceRatingsForProjectService,
    getAllPerformanceRatingsService,
    updatePerformanceRatingService,
    deletePerformanceRatingService
} from '../services/performanceRating.service.js';

// Create performance rating
export const createPerformanceRating = async (req, res) => {
    try {
        console.log('🔍 Performance Rating Controller Debug:', {
            user: req.user,
            userId: req.user._id,
            userIdAlt: req.user.id,
            userKeys: Object.keys(req.user || {}),
            body: req.body
        });
        
        const userId = req.user.id;
        const { projectId, rating, comments, ratingType } = req.body;

        // Validation
        if (!projectId || !rating) {
            return res.status(400).json({
                success: false,
                message: 'Project ID and rating are required'
            });
        }

        if (rating < 1 || rating > 10) {
            return res.status(400).json({
                success: false,
                message: 'Rating must be between 1 and 10'
            });
        }

        const result = await createPerformanceRatingService({
            projectId,
            rating,
            comments,
            ratingType
        }, userId);

        res.status(201).json(result);
    } catch (error) {
        console.error('Error in createPerformanceRating:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to create performance rating'
        });
    }
};

// Get performance ratings for a project
export const getPerformanceRatingsForProject = async (req, res) => {
    try {
        const { projectId } = req.params;

        if (!projectId) {
            return res.status(400).json({
                success: false,
                message: 'Project ID is required'
            });
        }

        const result = await getPerformanceRatingsForProjectService(projectId);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error in getPerformanceRatingsForProject:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to get performance ratings'
        });
    }
};

// Get all performance ratings (admin only)
export const getAllPerformanceRatings = async (req, res) => {
    try {
        const filters = req.query;
        const result = await getAllPerformanceRatingsService(filters);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error in getAllPerformanceRatings:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to get performance ratings'
        });
    }
};

// Update performance rating
export const updatePerformanceRating = async (req, res) => {
    try {
        const userId = req.user.id;
        const { ratingId } = req.params;
        const updateData = req.body;

        if (!ratingId) {
            return res.status(400).json({
                success: false,
                message: 'Rating ID is required'
            });
        }

        if (updateData.rating && (updateData.rating < 1 || updateData.rating > 10)) {
            return res.status(400).json({
                success: false,
                message: 'Rating must be between 1 and 10'
            });
        }

        const result = await updatePerformanceRatingService(ratingId, updateData, userId);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error in updatePerformanceRating:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to update performance rating'
        });
    }
};

// Delete performance rating
export const deletePerformanceRating = async (req, res) => {
    try {
        const userId = req.user.id;
        const { ratingId } = req.params;

        if (!ratingId) {
            return res.status(400).json({
                success: false,
                message: 'Rating ID is required'
            });
        }

        const result = await deletePerformanceRatingService(ratingId, userId);
        res.status(200).json(result);
    } catch (error) {
        console.error('Error in deletePerformanceRating:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to delete performance rating'
        });
    }
};
