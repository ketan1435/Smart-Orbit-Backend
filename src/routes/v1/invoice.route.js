import express from 'express';
import invoiceController from '../../controllers/invoice.controller.js';
import { uploadSingle } from '../../services/s3.service.js';

const router = express.Router();

// Invoice routes
router.post('/projects/:projectId/invoices', uploadSingle('attachment'), invoiceController.createInvoice);
router.get('/projects/:projectId/invoices', invoiceController.getInvoicesByProject);
router.get('/projects/:projectId/invoices/customer', invoiceController.getInvoicesForCustomer);
router.get('/invoices/:invoiceId', invoiceController.getInvoiceById);
router.put('/invoices/:invoiceId', invoiceController.updateInvoice);
router.delete('/invoices/:invoiceId', invoiceController.deleteInvoice);
router.post('/invoices/:invoiceId/send', invoiceController.sendInvoiceToCustomer);

export default router;
