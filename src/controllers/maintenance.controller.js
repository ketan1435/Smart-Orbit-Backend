import { createMaintenance, getMaintenanceByProject, sendMaintenanceToCustomer, getMaintenanceForCustomer as getMaintenanceForCustomerService } from '../services/maintenance.service.js';
import { uploadFileToS3 } from '../services/s3.service.js';

export const create = async (req, res) => {
  try {
    const { projectId } = req.params;
    const data = { projectId, title: req.body?.title, notes: req.body?.notes };
    if (!data.title) return res.status(400).json({ status: 0, message: 'Title is required' });
    if (req.file) {
      const result = await uploadFileToS3(req.file, `projects/${projectId}/maintenance`);
      data.attachmentKey = result.key;
      data.originalName = req.file.originalname;
    }
    const doc = await createMaintenance(data, req.user);
    res.status(201).json({ status: 1, message: 'Maintenance created', data: doc });
  } catch (e) {
    res.status(400).json({ status: 0, message: e.message || 'Failed', error: e.message });
  }
};

export const listByProject = async (req, res) => {
  try {
    const docs = await getMaintenanceByProject(req.params.projectId);
    res.status(200).json({ status: 1, message: 'Maintenance retrieved', data: docs });
  } catch (e) {
    res.status(400).json({ status: 0, message: e.message || 'Failed', error: e.message });
  }
};

export const sendToCustomer = async (req, res) => {
  try {
    const doc = await sendMaintenanceToCustomer(req.params.maintenanceId, req.user);
    res.status(200).json({ status: 1, message: 'Maintenance sent to customer', data: doc });
  } catch (e) {
    res.status(400).json({ status: 0, message: e.message || 'Failed', error: e.message });
  }
};

export const getMaintenanceForCustomer = async (req, res) => {
  try {
    const { projectId } = req.params;
    const user = req.user;
    
    const entries = await getMaintenanceForCustomerService(projectId, user);
    
    res.status(200).json({ status: 1, message: 'Customer maintenance entries retrieved', data: entries });
  } catch (e) {
    res.status(400).json({ status: 0, message: e.message || 'Failed', error: e.message });
  }
};

export default { create, listByProject, sendToCustomer, getMaintenanceForCustomer };


