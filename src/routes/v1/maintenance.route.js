import express from 'express';
import { create, listByProject, sendToCustomer, getMaintenanceForCustomer } from '../../controllers/maintenance.controller.js';
import { uploadSingle } from '../../services/s3.service.js';

const router = express.Router();

router.post('/projects/:projectId/maintenance', uploadSingle('attachment'), create);
router.get('/projects/:projectId/maintenance', listByProject);
router.get('/projects/:projectId/maintenance/customer', getMaintenanceForCustomer);
router.post('/maintenance/:maintenanceId/send', sendToCustomer);

export default router;


