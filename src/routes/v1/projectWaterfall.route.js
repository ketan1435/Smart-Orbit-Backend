import express from 'express';
import {
    getProjectWaterfall,
    moveToNextStep,
    getProjectHistory,
    updateStepStatus,
    getAllProjectWaterfalls,
    resetProjectWaterfall
} from '../../controllers/projectWaterfall.controller.js';
import auth from '../../middlewares/auth.js';

const router = express.Router();

// Get project waterfall progress
router.get('/:projectId', auth(), getProjectWaterfall);

// Move to next step
router.put('/:projectId/next-step', auth(), moveToNextStep);

// Get project history
router.get('/:projectId/history', auth(), getProjectHistory);

// Update step status manually
router.put('/:projectId/step/:stepNo', auth(), updateStepStatus);

// Get all project waterfalls
router.get('/', auth(), getAllProjectWaterfalls);

// Reset project waterfall
router.put('/:projectId/reset', auth(), resetProjectWaterfall);

export default router;
