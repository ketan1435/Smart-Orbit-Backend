import mongoose from 'mongoose';
import CustomerDocument from '../models/customerDocument.model.js';
import Project from '../models/project.model.js';
import { createActivityLog } from './activityLog.service.js';

// Create Customer Document
const createCustomerDocument = async (documentData, user) => {
    try {
        // Verify project exists and populate lead data
        const project = await Project.findById(documentData.projectId).populate('lead');
        if (!project) {
            throw new Error('Project not found');
        }
        
        console.log('📄 CUSTOMER DOCUMENT SERVICE - Project found:', {
            projectId: project._id,
            projectName: project.projectName,
            hasLead: !!project.lead,
            leadData: project.lead
        });

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
        
        const documentDataWithDefaults = {
            ...documentData,
            uploadedBy: userId,
            uploadedByModel: userRole === 'Admin' ? 'Admin' : 'User',
            projectName: project.projectName,
            customerName: project.lead?.customerName || 'Unknown Customer',
            customerEmail: project.lead?.email || 'unknown@example.com'
        };
        
        console.log('📄 CUSTOMER DOCUMENT SERVICE - Creating document with data:', documentDataWithDefaults);
        
        const customerDocument = new CustomerDocument(documentDataWithDefaults);
        
        console.log('📄 CUSTOMER DOCUMENT SERVICE - Document object created, saving...');
        await customerDocument.save();
        console.log('📄 CUSTOMER DOCUMENT SERVICE - Document saved successfully:', customerDocument._id);

        // Create activity log
        try {
            await createActivityLog({
                projectId: documentData.projectId,
                user: userId,
                userModel: userRole === 'Admin' ? 'Admin' : 'User',
                userName: userName,
                userEmail: userEmail,
                actionType: 'CRUD',
                targetModel: 'Project', // Use Project since CustomerDocument is not in enum
                targetId: customerDocument._id,
                targetName: `Customer Document ${customerDocument.documentName}`,
                description: `Customer document ${customerDocument.documentName} uploaded`,
                action: 'create'
            });
            console.log('📄 CUSTOMER DOCUMENT SERVICE - Activity log created successfully');
        } catch (activityLogError) {
            console.error('📄 CUSTOMER DOCUMENT SERVICE - Activity log creation failed:', activityLogError);
            // Don't fail the document creation if activity log fails
        }

        return customerDocument;
    } catch (error) {
        throw error;
    }
};

// Get Customer Documents by Project
const getCustomerDocumentsByProject = async (projectId, user) => {
    try {
        const documents = await CustomerDocument.find({ projectId })
            .populate('uploadedBy', 'name email')
            .populate('viewedBy', 'name email')
            .sort({ createdAt: -1 });

        return documents;
    } catch (error) {
        throw error;
    }
};

// Get Single Customer Document
const getCustomerDocumentById = async (documentId, user) => {
    try {
        const document = await CustomerDocument.findById(documentId)
            .populate('uploadedBy', 'name email')
            .populate('viewedBy', 'name email');

        if (!document) {
            throw new Error('Customer document not found');
        }

        return document;
    } catch (error) {
        throw error;
    }
};

// Update Customer Document
const updateCustomerDocument = async (documentId, updateData, user) => {
    try {
        const document = await CustomerDocument.findById(documentId);
        if (!document) {
            throw new Error('Customer document not found');
        }

        const oldStatus = document.status;

        Object.assign(document, updateData);
        await document.save();

        // Create activity log for status changes
        if (oldStatus !== document.status) {
            await createActivityLog({
                projectId: document.projectId,
                userModel: user.role === 'Admin' ? 'Admin' : 'User',
                userId: user._id,
                userName: user.name,
                userEmail: user.email,
                actionType: 'update',
                targetModel: 'CustomerDocument',
                targetId: document._id,
                targetName: `Customer Document ${document.documentName}`,
                description: `Customer document ${document.documentName} status changed from ${oldStatus} to ${document.status}`,
                action: 'document_status_updated'
            });
        }

        return document;
    } catch (error) {
        throw error;
    }
};

// Delete Customer Document
const deleteCustomerDocument = async (documentId, user) => {
    try {
        const document = await CustomerDocument.findById(documentId);
        if (!document) {
            throw new Error('Customer document not found');
        }

        await CustomerDocument.findByIdAndDelete(documentId);

        // Create activity log
        await createActivityLog({
            projectId: document.projectId,
            userModel: user.role === 'Admin' ? 'Admin' : 'User',
            userId: user._id,
            userName: user.name,
            userEmail: user.email,
            actionType: 'delete',
            targetModel: 'CustomerDocument',
            targetId: document._id,
            targetName: `Customer Document ${document.documentName}`,
            description: `Customer document ${document.documentName} deleted`,
            action: 'document_deleted'
        });

        return { message: 'Customer document deleted successfully' };
    } catch (error) {
        throw error;
    }
};

// Mark Document as Viewed
const markDocumentAsViewed = async (documentId, user) => {
    try {
        const document = await CustomerDocument.findById(documentId);
        if (!document) {
            throw new Error('Customer document not found');
        }

        // Ensure we have a valid user ID
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

        document.status = 'viewed';
        document.viewedAt = new Date();
        document.viewedBy = userId;
        await document.save();

        // Create activity log
        try {
            await createActivityLog({
                projectId: document.projectId,
                user: userId,
                userModel: userRole === 'Admin' ? 'Admin' : 'User',
                userName: userName,
                userEmail: userEmail,
                actionType: 'Communication',
                targetModel: 'Project',
                targetId: document._id,
                targetName: `Customer Document ${document.documentName}`,
                description: `Viewed customer document ${document.documentName}`,
                action: 'document_viewed',
                metadata: {
                    documentId: String(document._id),
                    uploadedBy: String(document.uploadedBy)
                }
            });
            console.log('📄 CUSTOMER DOCUMENT SERVICE - View activity log created successfully');
        } catch (activityLogError) {
            console.error('📄 CUSTOMER DOCUMENT SERVICE - View activity log creation failed:', activityLogError);
        }

        return document;
    } catch (error) {
        throw error;
    }
};

// Get Customer Documents for Customer (uploaded by customer)
const getCustomerDocumentsForCustomer = async (projectId, user) => {
    try {
        const userId = user?._id || user?.id || user?.sub;
        console.log('📄 getCustomerDocumentsForCustomer - projectId:', projectId, 'userId:', userId);
        
        // First, try to find documents uploaded by the current user
        let documents = await CustomerDocument.find({ 
            projectId, 
            uploadedBy: userId 
        })
            .populate('uploadedBy', 'name email')
            .populate('viewedBy', 'name email')
            .sort({ createdAt: -1 });

        console.log('📄 getCustomerDocumentsForCustomer - found documents for userId:', documents.length);

        // If no documents found for current user, try to find by project lead
        if (documents.length === 0) {
            const project = await Project.findById(projectId).populate('lead');
            if (project && project.lead) {
                console.log('📄 getCustomerDocumentsForCustomer - trying with project lead ID:', project.lead._id);
                documents = await CustomerDocument.find({ 
                    projectId, 
                    uploadedBy: project.lead._id 
                })
                    .populate('uploadedBy', 'name email')
                    .populate('viewedBy', 'name email')
                    .sort({ createdAt: -1 });
                console.log('📄 getCustomerDocumentsForCustomer - found documents for lead:', documents.length);
            }
        }

        // If still no documents found, return all customer documents for this project
        // This ensures customers can see all documents uploaded for their project
        if (documents.length === 0) {
            console.log('📄 getCustomerDocumentsForCustomer - trying to find all customer documents for project');
            documents = await CustomerDocument.find({ 
                projectId
            })
                .populate('uploadedBy', 'name email')
                .populate('viewedBy', 'name email')
                .sort({ createdAt: -1 });
            console.log('📄 getCustomerDocumentsForCustomer - found all documents for project:', documents.length);
        }

        return documents;
    } catch (error) {
        console.error('❌ getCustomerDocumentsForCustomer error:', error);
        throw error;
    }
};

export {
    createCustomerDocument,
    getCustomerDocumentsByProject,
    getCustomerDocumentById,
    updateCustomerDocument,
    deleteCustomerDocument,
    markDocumentAsViewed,
    getCustomerDocumentsForCustomer
};

export default {
    createCustomerDocument,
    getCustomerDocumentsByProject,
    getCustomerDocumentById,
    updateCustomerDocument,
    deleteCustomerDocument,
    markDocumentAsViewed,
    getCustomerDocumentsForCustomer
};
