import express from 'express';
import auth from '../../middlewares/auth.js';
import {
    createPerformanceRating,
    getPerformanceRatingsForProject,
    getAllPerformanceRatings,
    updatePerformanceRating,
    deletePerformanceRating
} from '../../controllers/performanceRating.controller.js';

const router = express.Router();

// Create performance rating
router.post('/', auth(), createPerformanceRating);

// Get performance ratings for a project
router.get('/project/:projectId', auth(), getPerformanceRatingsForProject);

// Get all performance ratings (admin only)
router.get('/all', auth('getUsers'), getAllPerformanceRatings);

// Update performance rating
router.put('/:ratingId', auth(), updatePerformanceRating);

// Delete performance rating
router.delete('/:ratingId', auth(), deletePerformanceRating);

export default router;
