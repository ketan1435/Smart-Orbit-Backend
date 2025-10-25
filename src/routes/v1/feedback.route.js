import express from 'express';
import {
    createFeedback,
    getFeedbacksForProject,
    getAllFeedbacks,
    updateFeedback,
    getFeedbackStats
} from '../../controllers/feedback.controller.js';
import auth from '../../middlewares/auth.js';

const router = express.Router();

// Create feedback
router.post('/', auth(), createFeedback);

// Get feedbacks for a specific project
router.get('/project/:projectId', auth(), getFeedbacksForProject);

// Get all feedbacks (admin only)
router.get('/all', auth('getUsers'), getAllFeedbacks);

// Update feedback (admin only)
router.put('/:feedbackId', auth('getUsers'), updateFeedback);

// Get feedback statistics
router.get('/stats', auth(), getFeedbackStats);

export default router;
