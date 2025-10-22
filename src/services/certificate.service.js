import mongoose from 'mongoose';
import Certificate from '../models/certificate.model.js';
import Project from '../models/project.model.js';
import { createActivityLog } from './activityLog.service.js';

// Create Certificate
const createCertificate = async (certificateData, user) => {
    try {
        // Verify project exists and populate lead data
        const project = await Project.findById(certificateData.projectId).populate('lead');
        if (!project) {
            throw new Error('Project not found');
        }
        
        console.log('🟣 CERTIFICATE SERVICE - Project found:', {
            projectId: project._id,
            projectName: project.projectName,
            hasLead: !!project.lead,
            leadData: project.lead
        });

        // Generate unique certificate number if not provided
        if (!certificateData.certificateNumber) {
            const count = await Certificate.countDocuments();
            certificateData.certificateNumber = `CC-${String(count + 1).padStart(6, '0')}`;
        }

        // Ensure we have a valid user ID
        let userId = user?._id || user?.id || user?.sub;
        const userRole = user?.role || 'User';
        const userName = user?.name || 'Unknown User';
        const userEmail = user?.email || 'unknown@example.com';
        
        // If no valid user ID, create a new ObjectId or use a default admin ID
        if (!userId || userId === 'unknown') {
            // Try to find an admin user to use as fallback
            const Admin = await import('../models/admin.model.js').then(m => m.default);
            const adminUser = await Admin.findOne();
            if (adminUser) {
                userId = adminUser._id;
            } else {
                // Create a new ObjectId as last resort
                userId = new mongoose.Types.ObjectId();
            }
        }
        
        const certificateDataWithDefaults = {
            ...certificateData,
            createdBy: userId,
            createdByModel: userRole === 'Admin' ? 'Admin' : 'User',
            projectName: project.projectName,
            customerName: project.lead?.customerName || 'Unknown Customer',
            customerEmail: project.lead?.email || 'unknown@example.com'
        };
        
        console.log('🟣 CERTIFICATE SERVICE - Creating certificate with data:', certificateDataWithDefaults);
        
        const certificate = new Certificate(certificateDataWithDefaults);
        
        console.log('🟣 CERTIFICATE SERVICE - Certificate object created, saving...');
        await certificate.save();
        console.log('🟣 CERTIFICATE SERVICE - Certificate saved successfully:', certificate._id);

        // Create activity log
        try {
            await createActivityLog({
                projectId: certificateData.projectId,
                user: userId,
                userModel: userRole === 'Admin' ? 'Admin' : 'User',
                userName: userName,
                userEmail: userEmail,
                actionType: 'CRUD',
                targetModel: 'Project', // Use Project since Certificate is not in enum
                targetId: certificate._id,
                targetName: `Certificate ${certificate.certificateNumber}`,
                description: `Completion certificate ${certificate.certificateNumber} generated`,
                action: 'create'
            });
            console.log('🟣 CERTIFICATE SERVICE - Activity log created successfully');
        } catch (activityLogError) {
            console.error('🟣 CERTIFICATE SERVICE - Activity log creation failed:', activityLogError);
            // Don't fail the certificate creation if activity log fails
        }

        return certificate;
    } catch (error) {
        throw error;
    }
};

// Get Certificates by Project
const getCertificatesByProject = async (projectId, user) => {
    try {
        const certificates = await Certificate.find({ projectId })
            .populate('createdBy', 'name email')
            .populate('sentTo', 'name email')
            .sort({ createdAt: -1 });

        return certificates;
    } catch (error) {
        throw error;
    }
};

// Get Single Certificate
const getCertificateById = async (certificateId, user) => {
    try {
        const certificate = await Certificate.findById(certificateId)
            .populate('createdBy', 'name email')
            .populate('sentTo', 'name email');

        if (!certificate) {
            throw new Error('Certificate not found');
        }

        return certificate;
    } catch (error) {
        throw error;
    }
};

// Update Certificate
const updateCertificate = async (certificateId, updateData, user) => {
    try {
        const certificate = await Certificate.findById(certificateId);
        if (!certificate) {
            throw new Error('Certificate not found');
        }

        const oldStatus = certificate.status;

        Object.assign(certificate, updateData);
        await certificate.save();

        // Create activity log for status changes
        if (oldStatus !== certificate.status) {
            await createActivityLog({
                projectId: certificate.projectId,
                userModel: user.role === 'Admin' ? 'Admin' : 'User',
                userId: user._id,
                userName: user.name,
                userEmail: user.email,
                actionType: 'update',
                targetModel: 'Certificate',
                targetId: certificate._id,
                targetName: `Certificate ${certificate.certificateNumber}`,
                description: `Certificate ${certificate.certificateNumber} status changed from ${oldStatus} to ${certificate.status}`,
                action: 'certificate_status_updated'
            });
        }

        return certificate;
    } catch (error) {
        throw error;
    }
};

// Delete Certificate
const deleteCertificate = async (certificateId, user) => {
    try {
        const certificate = await Certificate.findById(certificateId);
        if (!certificate) {
            throw new Error('Certificate not found');
        }

        await Certificate.findByIdAndDelete(certificateId);

        // Create activity log
        await createActivityLog({
            projectId: certificate.projectId,
            userModel: user.role === 'Admin' ? 'Admin' : 'User',
            userId: user._id,
            userName: user.name,
            userEmail: user.email,
            actionType: 'delete',
            targetModel: 'Certificate',
            targetId: certificate._id,
            targetName: `Certificate ${certificate.certificateNumber}`,
            description: `Certificate ${certificate.certificateNumber} deleted`,
            action: 'certificate_deleted'
        });

        return { message: 'Certificate deleted successfully' };
    } catch (error) {
        throw error;
    }
};

// Send Certificate to Customer
const sendCertificateToCustomer = async (certificateId, user) => {
    try {
        console.log('🔵 SEND CERT - User object:', user);
        console.log('🔵 SEND CERT - User ID:', user?._id || user?.id || user?.sub);
        console.log('🔵 SEND CERT - User role:', user?.role);

        const certificate = await Certificate.findById(certificateId);
        if (!certificate) {
            throw new Error('Certificate not found');
        }

        // Get project to find customer
        const project = await Project.findById(certificate.projectId).populate('lead');
        if (!project || !project.lead) {
            throw new Error('Project or customer not found');
        }

        // Ensure we have a valid user identity
        let userId = user?._id || user?.id || user?.sub;
        const userRole = user?.role || 'User';
        const userName = user?.name || 'Unknown User';
        const userEmail = user?.email || 'unknown@example.com';

        if (!userId || userId === 'unknown') {
            const Admin = await import('../models/admin.model.js').then(m => m.default);
            const adminUser = await Admin.findOne();
            if (adminUser) {
                userId = adminUser._id;
            } else {
                userId = new mongoose.Types.ObjectId();
            }
        }

        certificate.status = 'sent';
        certificate.sentAt = new Date();
        certificate.sentTo = project.lead._id;
        await certificate.save();

        // Create activity log (do not fail the main flow if logging fails)
        try {
            await createActivityLog({
                projectId: certificate.projectId,
                user: userId,
                userModel: userRole === 'Admin' ? 'Admin' : 'User',
                userName: userName,
                userEmail: userEmail,
                actionType: 'Communication',
                // Use Project to match existing enum constraints
                targetModel: 'Project',
                targetId: certificate._id,
                targetName: `Certificate ${certificate.certificateNumber}`,
                description: `Sent certificate ${certificate.certificateNumber} to customer ${project.lead.customerName}`,
                action: 'send_to_customer',
                metadata: {
                    customerId: String(project.lead._id),
                    certificateId: String(certificate._id)
                }
            });
            console.log('🔵 SEND CERT - Activity log created successfully');
        } catch (activityLogError) {
            console.error('🔵 SEND CERT - Activity log creation failed:', activityLogError);
        }

        return certificate;
    } catch (error) {
        throw error;
    }
};

// Get Certificates for Customer (sent items only)
const getCertificatesForCustomer = async (projectId, user) => {
    try {
        const userId = user?._id || user?.id || user?.sub;
        console.log('🔍 getCertificatesForCustomer - projectId:', projectId, 'userId:', userId);
        
        // Try to find certificates sent to the current user
        let certificates = await Certificate.find({ 
            projectId, 
            status: 'sent',
            sentTo: userId 
        })
            .populate('createdBy', 'name email')
            .populate('sentTo', 'name email')
            .sort({ createdAt: -1 });

        console.log('🔍 getCertificatesForCustomer - found certificates for userId:', certificates.length);

        // If no certificates found for current user, try to find by project lead
        if (certificates.length === 0) {
            const project = await Project.findById(projectId).populate('lead');
            if (project && project.lead) {
                console.log('🔍 getCertificatesForCustomer - trying with project lead ID:', project.lead._id);
                certificates = await Certificate.find({ 
                    projectId, 
                    status: 'sent',
                    sentTo: project.lead._id 
                })
                    .populate('createdBy', 'name email')
                    .populate('sentTo', 'name email')
                    .sort({ createdAt: -1 });
                console.log('🔍 getCertificatesForCustomer - found certificates for lead:', certificates.length);
            }
        }
        return certificates;
    } catch (error) {
        console.error('❌ getCertificatesForCustomer error:', error);
        throw error;
    }
};

export {
    createCertificate,
    getCertificatesByProject,
    getCertificateById,
    updateCertificate,
    deleteCertificate,
    sendCertificateToCustomer,
    getCertificatesForCustomer
};

export default {
    createCertificate,
    getCertificatesByProject,
    getCertificateById,
    updateCertificate,
    deleteCertificate,
    sendCertificateToCustomer,
    getCertificatesForCustomer
};
