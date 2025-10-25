import {
    createFeedbackService,
    getFeedbacksForProjectService,
    getAllFeedbacksService,
    updateFeedbackService,
    getFeedbackStatsService
} from '../services/feedback.service.js';

// Create feedback
const createFeedback = async (req, res) => {
    try {
        const userId = req.user.id;
        const feedbackData = req.body;

        // Validate required fields
        if (!feedbackData.projectId || !feedbackData.title || !feedbackData.description || !feedbackData.rating) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: projectId, title, description, rating'
            });
        }

        // Validate rating
        if (feedbackData.rating < 1 || feedbackData.rating > 5) {
            return res.status(400).json({
                success: false,
                message: 'Rating must be between 1 and 5'
            });
        }

        const result = await createFeedbackService(feedbackData, userId);
        
        res.status(201).json(result);
    } catch (error) {
        console.error('Create feedback controller error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to create feedback'
        });
    }
};

// Get feedbacks for a project
const getFeedbacksForProject = async (req, res) => {
    try {
        const { projectId } = req.params;
        const userRole = req.user.role;
        const userId = req.user.id;

        const result = await getFeedbacksForProjectService(projectId, userRole, userId);
        
        res.status(200).json(result);
    } catch (error) {
        console.error('Get feedbacks controller error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to get feedbacks'
        });
    }
};

// Get all feedbacks (admin only)
const getAllFeedbacks = async (req, res) => {
    try {
        const userRole = req.user.role;
        
        // Check if user is admin
        if (userRole !== 'Admin') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Admin role required.'
            });
        }

        const filters = req.query;
        const result = await getAllFeedbacksService(filters);
        
        res.status(200).json(result);
    } catch (error) {
        console.error('Get all feedbacks controller error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to get feedbacks'
        });
    }
};

// Update feedback (admin only)
const updateFeedback = async (req, res) => {
    try {
        const userRole = req.user.role;
        
        // Check if user is admin
        if (userRole !== 'Admin') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Admin role required.'
            });
        }

        const { feedbackId } = req.params;
        const updateData = req.body;
        const adminUserId = req.user.id;

        const result = await updateFeedbackService(feedbackId, updateData, adminUserId);
        
        res.status(200).json(result);
    } catch (error) {
        console.error('Update feedback controller error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to update feedback'
        });
    }
};

// Get feedback statistics
const getFeedbackStats = async (req, res) => {
    try {
        const { projectId } = req.query;
        const result = await getFeedbackStatsService(projectId);
        
        res.status(200).json(result);
    } catch (error) {
        console.error('Get feedback stats controller error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to get feedback statistics'
        });
    }
};

export {
    createFeedback,
    getFeedbacksForProject,
    getAllFeedbacks,
    updateFeedback,
    getFeedbackStats
};

