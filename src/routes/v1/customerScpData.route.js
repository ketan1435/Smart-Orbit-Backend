import express from 'express';
import { getScpDataForCustomer, getCustomerProjectsWithScpData } from '../../controllers/customerScpData.controller.js';
import auth from '../../middlewares/auth.js';

const router = express.Router();

router.get('/projects-with-scp-data', auth(), getCustomerProjectsWithScpData);
router.get('/:projectId/scp-data', auth(), getScpDataForCustomer);

export default router;

