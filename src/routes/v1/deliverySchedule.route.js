import express from 'express';
import multer from 'multer';
import { 
    createDeliverySchedule, 
    getDeliverySchedules, 
    updateDeliverySchedule, 
    deleteDeliverySchedule 
} from '../../controllers/deliverySchedule.controller.js';
import auth from '../../middlewares/auth.js';

// Configure multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

const router = express.Router();

// Create delivery schedule with file uploads
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
}, auth('manageDispatch'), createDeliverySchedule);

// Get delivery schedules
router.get('/', auth('manageDispatch'), getDeliverySchedules);

// Update delivery schedule
router.patch('/:scheduleId', auth('manageDispatch'), updateDeliverySchedule);

// Delete delivery schedule
router.delete('/:scheduleId', auth('manageDispatch'), deleteDeliverySchedule);

export default router;
0