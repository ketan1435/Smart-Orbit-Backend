import mongoose from 'mongoose';
import Invoice from '../models/invoice.model.js';
import Project from '../models/project.model.js';
import { createActivityLog } from './activityLog.service.js';

// Create Invoice
const createInvoice = async (invoiceData, user) => {
    try {
        console.log('Service - User object:', user);
        console.log('Service - User ID:', user?._id || user?.id);
        console.log('Service - User role:', user?.role);
        
        // Verify project exists and populate lead data (same as project service)
        const project = await Project.findById(invoiceData.projectId)
            .populate('lead')
            .populate('requirement');
        if (!project) {
            throw new Error('Project not found');
        }
        
        // Debug: Log project lead data
        console.log('Project Lead Data:', project.lead);
        console.log('Lead Customer Name:', project.lead?.customerName);
        console.log('Lead Email:', project.lead?.email);
        console.log('Lead Mobile:', project.lead?.mobileNumber);

        // Auto-generate invoice number with proper sequencing
        let invoiceNumber;
        let attempts = 0;
        const maxAttempts = 10;
        
        do {
            // Get the highest invoice number and increment
            const lastInvoice = await Invoice.findOne({}, {}, { sort: { 'invoiceNumber': -1 } });
            const lastNumber = lastInvoice ? parseInt(lastInvoice.invoiceNumber) : 0;
            invoiceNumber = String(lastNumber + 1).padStart(4, '0');
            
            // Check if this number already exists (handle race conditions)
            const existingInvoice = await Invoice.findOne({ invoiceNumber });
            if (!existingInvoice) {
                break;
            }
            
            attempts++;
            if (attempts >= maxAttempts) {
                throw new Error('Unable to generate unique invoice number');
            }
        } while (true);
        
        invoiceData.invoiceNumber = invoiceNumber;

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
        
        console.log('Service - Final user data:', { userId, userRole, userName, userEmail });
        
        const invoice = new Invoice({
            ...invoiceData,
            createdBy: userId,
            createdByModel: userRole === 'Admin' ? 'Admin' : 'User',
            customerName: project.lead?.customerName || 'Unknown Customer',
            customerEmail: project.lead?.email || 'unknown@example.com'
        });

        await invoice.save();

        // Create activity log
        await createActivityLog({
            projectId: invoiceData.projectId,
            user: userId,
            userModel: userRole === 'Admin' ? 'Admin' : 'User',
            userName: userName,
            userEmail: userEmail,
            actionType: 'CRUD',
            targetModel: 'Project', // Use Project since Invoice is not in enum
            targetId: invoice._id,
            targetName: `Invoice ${invoice.invoiceNumber}`,
            description: `Invoice ${invoice.invoiceNumber} created for ₹${invoice.amount}`,
            action: 'create'
        });

        return invoice;
    } catch (error) {
        throw error;
    }
};

// Get Invoices by Project
const getInvoicesByProject = async (projectId, user) => {
    try {
        const invoices = await Invoice.find({ projectId })
            .populate('createdBy', 'name email')
            .populate('sentTo', 'name email')
            .sort({ createdAt: -1 });

        return invoices;
    } catch (error) {
        throw error;
    }
};

// Get Single Invoice
const getInvoiceById = async (invoiceId, user) => {
    try {
        const invoice = await Invoice.findById(invoiceId)
            .populate('createdBy', 'name email')
            .populate('sentTo', 'name email');

        if (!invoice) {
            throw new Error('Invoice not found');
        }

        return invoice;
    } catch (error) {
        throw error;
    }
};

// Update Invoice
const updateInvoice = async (invoiceId, updateData, user) => {
    try {
        const invoice = await Invoice.findById(invoiceId);
        if (!invoice) {
            throw new Error('Invoice not found');
        }

        const oldStatus = invoice.status;
        const oldPaymentStatus = invoice.paymentStatus;

        Object.assign(invoice, updateData);
        await invoice.save();

        // Create activity log for status changes
        if (oldStatus !== invoice.status) {
            await createActivityLog({
                projectId: invoice.projectId,
                userModel: user.role === 'Admin' ? 'Admin' : 'User',
                userId: user._id,
                userName: user.name,
                userEmail: user.email,
                actionType: 'update',
                targetModel: 'Invoice',
                targetId: invoice._id,
                targetName: `Invoice ${invoice.invoiceNumber}`,
                description: `Invoice ${invoice.invoiceNumber} status changed from ${oldStatus} to ${invoice.status}`,
                action: 'invoice_status_updated'
            });
        }

        if (oldPaymentStatus !== invoice.paymentStatus) {
            await createActivityLog({
                projectId: invoice.projectId,
                userModel: user.role === 'Admin' ? 'Admin' : 'User',
                userId: user._id,
                userName: user.name,
                userEmail: user.email,
                actionType: 'update',
                targetModel: 'Invoice',
                targetId: invoice._id,
                targetName: `Invoice ${invoice.invoiceNumber}`,
                description: `Invoice ${invoice.invoiceNumber} payment status changed from ${oldPaymentStatus} to ${invoice.paymentStatus}`,
                action: 'invoice_payment_status_updated'
            });
        }

        return invoice;
    } catch (error) {
        throw error;
    }
};

// Delete Invoice
const deleteInvoice = async (invoiceId, user) => {
    try {
        const invoice = await Invoice.findById(invoiceId);
        if (!invoice) {
            throw new Error('Invoice not found');
        }

        await Invoice.findByIdAndDelete(invoiceId);

        // Create activity log
        await createActivityLog({
            projectId: invoice.projectId,
            userModel: user.role === 'Admin' ? 'Admin' : 'User',
            userId: user._id,
            userName: user.name,
            userEmail: user.email,
            actionType: 'delete',
            targetModel: 'Invoice',
            targetId: invoice._id,
            targetName: `Invoice ${invoice.invoiceNumber}`,
            description: `Invoice ${invoice.invoiceNumber} deleted`,
            action: 'invoice_deleted'
        });

        return { message: 'Invoice deleted successfully' };
    } catch (error) {
        throw error;
    }
};

// Send Invoice to Customer
const sendInvoiceToCustomer = async (invoiceId, user) => {
    try {
        console.log('🔵 SEND INVOICE - User object:', user);
        console.log('🔵 SEND INVOICE - User ID:', user?._id || user?.id);
        console.log('🔵 SEND INVOICE - User role:', user?.role);
        
        const invoice = await Invoice.findById(invoiceId);
        if (!invoice) {
            throw new Error('Invoice not found');
        }

        // Get project to find customer
        const project = await Project.findById(invoice.projectId).populate('lead');
        if (!project || !project.lead) {
            throw new Error('Project or customer not found');
        }

        // Ensure we have a valid user ID and role
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

        invoice.status = 'sent';
        invoice.sentAt = new Date();
        invoice.sentTo = project.lead._id;
        await invoice.save();

        // Create activity log
        try {
            await createActivityLog({
                projectId: invoice.projectId,
                user: userId,
                userModel: userRole === 'Admin' ? 'Admin' : 'User',
                userName: userName,
                userEmail: userEmail,
                actionType: 'Communication',
                targetModel: 'Project', // Use Project since Invoice is not in enum
                targetId: invoice._id,
                targetName: `Invoice ${invoice.invoiceNumber}`,
                description: `Sent invoice ${invoice.invoiceNumber} to customer ${project.lead.customerName}`,
                action: 'send_to_customer',
                metadata: {
                    customerId: String(project.lead._id),
                    invoiceId: String(invoice._id)
                }
            });
            console.log('🔵 SEND INVOICE - Activity log created successfully');
        } catch (activityLogError) {
            console.error('🔵 SEND INVOICE - Activity log creation failed:', activityLogError);
            // Don't fail the invoice sending if activity log fails
        }

        return invoice;
    } catch (error) {
        throw error;
    }
};

// Get Invoices for Customer (sent items only)
const getInvoicesForCustomer = async (projectId, user) => {
    try {
        const userId = user?._id || user?.id || user?.sub;
        console.log('🔍 getInvoicesForCustomer - projectId:', projectId, 'userId:', userId);
        console.log('🔍 getInvoicesForCustomer - user object:', user);
        
        // Debug: Check all invoices for this project
        const allInvoices = await Invoice.find({ projectId });
        console.log('🔍 getInvoicesForCustomer - all invoices for project:', allInvoices.length);
        allInvoices.forEach(inv => {
            console.log(`  - Invoice ${inv.invoiceNumber}: status=${inv.status}, sentTo=${inv.sentTo}, createdBy=${inv.createdBy}`);
        });
        
        // Try to find invoices sent to the current user
        let invoices = await Invoice.find({ 
            projectId, 
            status: 'sent',
            sentTo: userId 
        })
            .populate('createdBy', 'name email')
            .populate('sentTo', 'name email')
            .sort({ createdAt: -1 });

        console.log('🔍 getInvoicesForCustomer - found sent invoices for userId:', invoices.length);

        // If no invoices found for current user, try to find by project lead
        if (invoices.length === 0) {
            const project = await Project.findById(projectId).populate('lead');
            if (project && project.lead) {
                console.log('🔍 getInvoicesForCustomer - trying with project lead ID:', project.lead._id);
                invoices = await Invoice.find({ 
                    projectId, 
                    status: 'sent',
                    sentTo: project.lead._id 
                })
                    .populate('createdBy', 'name email')
                    .populate('sentTo', 'name email')
                    .sort({ createdAt: -1 });
                console.log('🔍 getInvoicesForCustomer - found sent invoices for lead:', invoices.length);
            }
        }
        return invoices;
    } catch (error) {
        console.error('❌ getInvoicesForCustomer error:', error);
        throw error;
    }
};

export {
    createInvoice,
    getInvoicesByProject,
    getInvoiceById,
    updateInvoice,
    deleteInvoice,
    sendInvoiceToCustomer,
    getInvoicesForCustomer
};

export default {
    createInvoice,
    getInvoicesByProject,
    getInvoiceById,
    updateInvoice,
    deleteInvoice,
    sendInvoiceToCustomer,
    getInvoicesForCustomer
};
