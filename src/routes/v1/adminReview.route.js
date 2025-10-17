import express from 'express';
import {
    getScpDataForReview,
    adminReviewScpData,
    getAdminReviewHistory,
    updateProjectData
} from '../../controllers/adminReview.controller.js';
import auth from '../../middlewares/auth.js';

const router = express.Router();

// Get SCP data for admin review
router.get('/:projectId/scp-data', auth(), getScpDataForReview);

// Admin reviews SCP data (approve/reject)
router.post('/:projectId/review', auth(), adminReviewScpData);

// Get admin review history
router.get('/:projectId/history', auth(), getAdminReviewHistory);

// Update project data (for SCP)
router.put('/:projectId/update-data', auth(), updateProjectData);

export default router;
