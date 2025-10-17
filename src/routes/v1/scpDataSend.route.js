import express from 'express';
import { sendScpDataToCustomer, getScpDataSendStatus, getScpDataSendHistory } from '../../controllers/scpDataSend.controller.js';
import auth from '../../middlewares/auth.js';

const router = express.Router();

router.post('/:projectId/send-to-customer', auth(), sendScpDataToCustomer);
router.get('/:projectId/send-status', auth(), getScpDataSendStatus);
router.get('/:projectId/send-history', auth(), getScpDataSendHistory);

export default router;

