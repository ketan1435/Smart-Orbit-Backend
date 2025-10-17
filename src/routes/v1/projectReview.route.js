import express from 'express';
import {
    submitProjectReview,
    getProjectReviewHistory,
    getProjectReviewStatus
} from '../../controllers/projectReview.controller.js';
import auth from '../../middlewares/auth.js';

const router = express.Router();

// Submit project review
router.post('/:projectId/review', auth(), submitProjectReview);

// Get project review history
router.get('/:projectId/review/history', auth(), getProjectReviewHistory);

// Get project review status
router.get('/:projectId/review/status', auth(), getProjectReviewStatus);

export default router;
