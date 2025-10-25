import express from 'express';
import customerDocumentController from '../../controllers/customerDocument.controller.js';
import { uploadSingle } from '../../services/s3.service.js';

const router = express.Router();

// Customer Document routes
router.post('/projects/:projectId/customer-documents', uploadSingle('attachment'), customerDocumentController.createCustomerDocument);
router.get('/projects/:projectId/customer-documents', customerDocumentController.getCustomerDocumentsByProject);
router.get('/projects/:projectId/customer-documents/customer', customerDocumentController.getCustomerDocumentsForCustomer);
router.get('/customer-documents/:documentId', customerDocumentController.getCustomerDocumentById);
router.put('/customer-documents/:documentId', customerDocumentController.updateCustomerDocument);
router.delete('/customer-documents/:documentId', customerDocumentController.deleteCustomerDocument);
router.post('/customer-documents/:documentId/view', customerDocumentController.markDocumentAsViewed);

export default router;
