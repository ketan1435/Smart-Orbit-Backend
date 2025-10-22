const express = require('express');
const router = express.Router();
const certificateController = require('../controllers/certificate.controller');
const authMiddleware = require('../middleware/auth.middleware');

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Certificate routes
router.post('/projects/:projectId/certificates', certificateController.createCertificate);
router.get('/projects/:projectId/certificates', certificateController.getCertificatesByProject);
router.get('/certificates/:certificateId', certificateController.getCertificateById);
router.put('/certificates/:certificateId', certificateController.updateCertificate);
router.delete('/certificates/:certificateId', certificateController.deleteCertificate);
router.post('/certificates/:certificateId/send', certificateController.sendCertificateToCustomer);

module.exports = router;
