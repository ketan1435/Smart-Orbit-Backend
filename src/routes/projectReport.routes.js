const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth.middleware');
const {
    getProjectReport,
    generatePDF,
    shareProjectReport,
    getSharedReport
} = require('../controllers/projectReport.controller');

// Protected routes (require authentication)
router.get('/:projectId', authenticateToken, getProjectReport);
router.post('/:projectId/pdf', authenticateToken, generatePDF);
router.post('/:projectId/share', authenticateToken, shareProjectReport);

// Public route for shared reports
router.get('/shared/:shareToken', getSharedReport);

module.exports = router;

