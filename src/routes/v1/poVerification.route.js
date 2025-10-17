import express from 'express';
import multer from 'multer';
import { createPOVerification, getPOVerifications, updatePOVerification } from '../../controllers/poVerification.controller.js';
import auth from '../../middlewares/auth.js';

// Configure multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

const router = express.Router();

// Quality Inspector creates verification request with file uploads
router.post('/', (req, res, next) => {
    console.log('=== Multer Middleware Debug ===');
    console.log('Content-Type:', req.headers['content-type']);
    console.log('Request method:', req.method);
    console.log('Request URL:', req.url);
    next();
}, upload.array('attachments', 10), (req, res, next) => {
    console.log('=== After Multer Debug ===');
    console.log('Files after multer:', req.files);
    console.log('Body after multer:', req.body);
    next();
}, auth('procurement'), createPOVerification);

// Get verification requests (filtered by role)
router.get('/', auth('procurement'), getPOVerifications);

// Admin updates verification status
router.patch('/:id', auth('admin'), updatePOVerification);

export default router;
