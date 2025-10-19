import express from 'express';
import auth from '../../middlewares/auth.js';
import {
    getProjectReport,
    generatePDF,
    shareProjectReport,
    getSharedReport,
    sendReportToCustomerController,
    getReceivedReports,
    getReceivedReport
} from '../../controllers/projectReport.controller.js';

const router = express.Router();

// Protected routes (require authentication)
router.get('/:projectId', auth(), getProjectReport);
router.post('/:projectId/pdf', auth(), generatePDF);
router.post('/:projectId/share', auth(), shareProjectReport);

// Send report to customer
router.post('/:projectId/send-to-customer', auth(), sendReportToCustomerController);

// Get received reports for customer
router.get('/customer/:customerId/reports', auth(), getReceivedReports);

// Get received report by ID for customer
router.get('/customer/report/:reportId', auth(), getReceivedReport);

// Public route for shared reports
router.get('/shared/:shareToken', getSharedReport);

export default router;
