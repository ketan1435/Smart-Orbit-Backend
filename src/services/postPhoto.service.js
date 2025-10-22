import mongoose from 'mongoose';
import PostPhoto from '../models/postPhoto.model.js';
import Project from '../models/project.model.js';
import { createActivityLog } from './activityLog.service.js';

export const createPostPhoto = async (data, user) => {
  const project = await Project.findById(data.projectId).populate('lead');
  if (!project) throw new Error('Project not found');

  let userId = user?._id || user?.id || user?.sub || new mongoose.Types.ObjectId();
  const userRole = user?.role || 'User';
  const userName = user?.name || 'Unknown User';
  const userEmail = user?.email || 'unknown@example.com';

  const doc = await PostPhoto.create({
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
      targetName: `Post Photo ${doc.originalName}`,
      description: `Post photo ${doc.originalName} added`,
      action: 'create'
    });
  } catch {}

  return doc;
};

export const getPostPhotosByProject = async (projectId) => {
  return await PostPhoto.find({ projectId }).sort({ createdAt: -1 });
};

export const sendPostPhotoToCustomer = async (photoId, user) => {
  const doc = await PostPhoto.findById(photoId);
  if (!doc) throw new Error('Post photo not found');
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
      targetName: `Post Photo ${doc.originalName}`,
      description: `Sent post photo ${doc.originalName} to customer ${project.lead.customerName}`,
      action: 'send_to_customer',
      metadata: { customerId: String(project.lead._id), postPhotoId: String(doc._id) }
    });
  } catch {}

  return doc;
};

export const getPostPhotosForCustomer = async (projectId, user) => {
  try {
    const userId = user?._id || user?.id || user?.sub;
    console.log('🔍 getPostPhotosForCustomer - projectId:', projectId, 'userId:', userId);
    
        // Try to find photos sent to the current user
        let photos = await PostPhoto.find({ 
            projectId, 
            status: 'sent',
            sentTo: userId 
        })
            .populate('createdBy', 'name email')
            .populate('sentTo', 'name email')
            .sort({ createdAt: -1 });

        console.log('🔍 getPostPhotosForCustomer - found photos for userId:', photos.length);

        // If no photos found for current user, try to find by project lead
        if (photos.length === 0) {
            const project = await Project.findById(projectId).populate('lead');
            if (project && project.lead) {
                console.log('🔍 getPostPhotosForCustomer - trying with project lead ID:', project.lead._id);
                photos = await PostPhoto.find({ 
                    projectId, 
                    status: 'sent',
                    sentTo: project.lead._id 
                })
                    .populate('createdBy', 'name email')
                    .populate('sentTo', 'name email')
                    .sort({ createdAt: -1 });
                console.log('🔍 getPostPhotosForCustomer - found photos for lead:', photos.length);
            }
        }
    return photos;
  } catch (error) {
    console.error('❌ getPostPhotosForCustomer error:', error);
    throw error;
  }
};


