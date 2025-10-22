import mongoose from 'mongoose';
import Maintenance from '../models/maintenance.model.js';
import Project from '../models/project.model.js';
import { createActivityLog } from './activityLog.service.js';

export const createMaintenance = async (data, user) => {
  const project = await Project.findById(data.projectId).populate('lead');
  if (!project) throw new Error('Project not found');

  let userId = user?._id || user?.id || user?.sub || new mongoose.Types.ObjectId();
  const userRole = user?.role || 'User';
  const userName = user?.name || 'Unknown User';
  const userEmail = user?.email || 'unknown@example.com';

  const doc = await Maintenance.create({
    ...data,
    createdBy: userId,
    createdByModel: userRole === 'Admin' ? 'Admin' : 'User',
  });

  try {
    await createActivityLog({
      projectId: data.projectId,
      user: userId,
      userModel: userRole === 'Admin' ? 'Admin' : 'User',
      userName,
      userEmail,
      actionType: 'CRUD',
      targetModel: 'Project',
      targetId: doc._id,
      targetName: `Maintenance ${doc.title}`,
      description: `Maintenance entry ${doc.title} added`,
      action: 'create'
    });
  } catch {}

  return doc;
};

export const getMaintenanceByProject = async (projectId) => {
  return await Maintenance.find({ projectId }).sort({ createdAt: -1 });
};

export const sendMaintenanceToCustomer = async (maintId, user) => {
  const doc = await Maintenance.findById(maintId);
  if (!doc) throw new Error('Maintenance not found');
  const project = await Project.findById(doc.projectId).populate('lead');
  if (!project || !project.lead) throw new Error('Project or customer not found');

  let userId = user?._id || user?.id || user?.sub || new mongoose.Types.ObjectId();
  const userRole = user?.role || 'User';
  const userName = user?.name || 'Unknown User';
  const userEmail = user?.email || 'unknown@example.com';

  doc.status = 'sent';
  doc.sentAt = new Date();
  doc.sentTo = project.lead._id;
  await doc.save();

  try {
    await createActivityLog({
      projectId: doc.projectId,
      user: userId,
      userModel: userRole === 'Admin' ? 'Admin' : 'User',
      userName,
      userEmail,
      actionType: 'Communication',
      targetModel: 'Project',
      targetId: doc._id,
      targetName: `Maintenance ${doc.title}`,
      description: `Sent maintenance entry ${doc.title} to customer ${project.lead.customerName}`,
      action: 'send_to_customer',
      metadata: { customerId: String(project.lead._id), maintenanceId: String(doc._id) }
    });
  } catch {}

  return doc;
};

export const getMaintenanceForCustomer = async (projectId, user) => {
  try {
    const userId = user?._id || user?.id || user?.sub;
    console.log('🔍 getMaintenanceForCustomer - projectId:', projectId, 'userId:', userId);
    
        // Try to find entries sent to the current user
        let entries = await Maintenance.find({ 
            projectId, 
            status: 'sent',
            sentTo: userId 
        })
            .populate('createdBy', 'name email')
            .populate('sentTo', 'name email')
            .sort({ createdAt: -1 });

        console.log('🔍 getMaintenanceForCustomer - found entries for userId:', entries.length);

        // If no entries found for current user, try to find by project lead
        if (entries.length === 0) {
            const project = await Project.findById(projectId).populate('lead');
            if (project && project.lead) {
                console.log('🔍 getMaintenanceForCustomer - trying with project lead ID:', project.lead._id);
                entries = await Maintenance.find({ 
                    projectId, 
                    status: 'sent',
                    sentTo: project.lead._id 
                })
                    .populate('createdBy', 'name email')
                    .populate('sentTo', 'name email')
                    .sort({ createdAt: -1 });
                console.log('🔍 getMaintenanceForCustomer - found entries for lead:', entries.length);
            }
        }
    return entries;
  } catch (error) {
    console.error('❌ getMaintenanceForCustomer error:', error);
    throw error;
  }
};


