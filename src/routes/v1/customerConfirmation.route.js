import express from 'express';
import auth from '../../middlewares/auth.js';
import { confirmScpData, rejectScpData, getCustomerConfirmationHistory } from '../../controllers/customerConfirmation.controller.js';

const router = express.Router();

// Customer confirms SCP data for a project
router.post('/:projectId/confirm', auth(), confirmScpData);

// Customer rejects SCP data
router.post('/:projectId/reject', auth(), rejectScpData);

// Get confirmation history
router.get('/:projectId/history', auth(), getCustomerConfirmationHistory);

export default router;
