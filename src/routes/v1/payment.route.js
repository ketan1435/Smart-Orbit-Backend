import express from 'express';
import paymentController from '../../controllers/payment.controller.js';
import { uploadSingle } from '../../services/s3.service.js';

const router = express.Router();

// Payment routes
router.post('/projects/:projectId/payments', uploadSingle('receipt'), paymentController.createPayment);
router.get('/projects/:projectId/payments', paymentController.getPaymentsByProject);
router.get('/projects/:projectId/payments/customer', paymentController.getPaymentsForCustomer);
router.get('/payments/:paymentId', paymentController.getPaymentById);
router.put('/payments/:paymentId', paymentController.updatePayment);
router.delete('/payments/:paymentId', paymentController.deletePayment);
router.post('/payments/:paymentId/verify', paymentController.verifyPayment);

export default router;
