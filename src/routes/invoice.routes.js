const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoice.controller');
const authMiddleware = require('../middleware/auth.middleware');

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Invoice routes
router.post('/projects/:projectId/invoices', invoiceController.createInvoice);
router.get('/projects/:projectId/invoices', invoiceController.getInvoicesByProject);
router.get('/invoices/:invoiceId', invoiceController.getInvoiceById);
router.put('/invoices/:invoiceId', invoiceController.updateInvoice);
router.delete('/invoices/:invoiceId', invoiceController.deleteInvoice);
router.post('/invoices/:invoiceId/send', invoiceController.sendInvoiceToCustomer);

module.exports = router;
