import { createPostPhoto, getPostPhotosByProject, sendPostPhotoToCustomer, getPostPhotosForCustomer as getPostPhotosForCustomerService } from '../services/postPhoto.service.js';
import { uploadFileToS3 } from '../services/s3.service.js';

export const create = async (req, res) => {
  try {
    const { projectId } = req.params;
    const data = { projectId, notes: req.body?.notes };
    if (req.file) {
      const result = await uploadFileToS3(req.file, `projects/${projectId}/site-photos`);
      data.key = result.key;
      data.originalName = req.file.originalname;
    } else {
      return res.status(400).json({ status: 0, message: 'Attachment is required' });
    }
    const doc = await createPostPhoto(data, req.user);
    res.status(201).json({ status: 1, message: 'Post photo created', data: doc });
  } catch (e) {
    res.status(400).json({ status: 0, message: e.message || 'Failed', error: e.message });
  }
};

export const listByProject = async (req, res) => {
  try {
    const docs = await getPostPhotosByProject(req.params.projectId);
    res.status(200).json({ status: 1, message: 'Post photos retrieved', data: docs });
  } catch (e) {
    res.status(400).json({ status: 0, message: e.message || 'Failed', error: e.message });
  }
};

export const sendToCustomer = async (req, res) => {
  try {
    const doc = await sendPostPhotoToCustomer(req.params.photoId, req.user);
    res.status(200).json({ status: 1, message: 'Post photo sent to customer', data: doc });
  } catch (e) {
    res.status(400).json({ status: 0, message: e.message || 'Failed', error: e.message });
  }
};

export const getPostPhotosForCustomer = async (req, res) => {
  try {
    const { projectId } = req.params;
    const user = req.user;
    const userId = user?._id || user?.id || user?.sub;
    
    const photos = await getPostPhotosForCustomerService(projectId, user);
    
    res.status(200).json({ status: 1, message: 'Customer post photos retrieved', data: photos });
  } catch (e) {
    res.status(400).json({ status: 0, message: e.message || 'Failed', error: e.message });
  }
};

export default { create, listByProject, sendToCustomer, getPostPhotosForCustomer };


