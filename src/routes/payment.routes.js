const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const authMiddleware = require('../middleware/auth.middleware');

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Payment routes
router.post('/projects/:projectId/payments', paymentController.createPayment);
router.get('/projects/:projectId/payments', paymentController.getPaymentsByProject);
router.get('/payments/:paymentId', paymentController.getPaymentById);
router.put('/payments/:paymentId', paymentController.updatePayment);
router.delete('/payments/:paymentId', paymentController.deletePayment);
router.post('/payments/:paymentId/verify', paymentController.verifyPayment);

module.exports = router;
