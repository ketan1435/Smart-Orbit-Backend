import express from 'express';
import certificateController from '../../controllers/certificate.controller.js';
import { uploadSingle } from '../../services/s3.service.js';

const router = express.Router();

// Certificate routes
router.post('/projects/:projectId/certificates', uploadSingle('attachment'), certificateController.createCertificate);
router.get('/projects/:projectId/certificates', certificateController.getCertificatesByProject);
router.get('/projects/:projectId/certificates/customer', certificateController.getCertificatesForCustomer);
router.get('/certificates/:certificateId', certificateController.getCertificateById);
router.put('/certificates/:certificateId', certificateController.updateCertificate);
router.delete('/certificates/:certificateId', certificateController.deleteCertificate);
router.post('/certificates/:certificateId/send', certificateController.sendCertificateToCustomer);

export default router;
