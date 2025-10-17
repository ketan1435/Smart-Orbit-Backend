import express from 'express';
import auth from '../../middlewares/auth.js';
import { createPoRequest, getPoRequests, approvePoRequest, rejectPoRequest } from '../../controllers/poRequest.controller.js';

const router = express.Router();

// Planning engineer creates a PO request to admin
router.post('/', auth(), createPoRequest);

// List PO requests (filter by project/status)
router.get('/', auth(), getPoRequests);

// Admin approves and (optionally) creates a PO
router.post('/:id/approve', auth('admin'), approvePoRequest);

// Admin rejects a PO request
router.post('/:id/reject', auth('admin'), rejectPoRequest);

export default router;


