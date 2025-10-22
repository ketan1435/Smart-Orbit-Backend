import express from 'express';
import { create, listByProject, sendToCustomer, getPostPhotosForCustomer } from '../../controllers/postPhoto.controller.js';
import { uploadSingle } from '../../services/s3.service.js';

const router = express.Router();

router.post('/projects/:projectId/post-photos', uploadSingle('attachment'), create);
router.get('/projects/:projectId/post-photos', listByProject);
router.get('/projects/:projectId/post-photos/customer', getPostPhotosForCustomer);
router.post('/post-photos/:photoId/send', sendToCustomer);

export default router;


