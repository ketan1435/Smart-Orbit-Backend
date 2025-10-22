import mongoose from 'mongoose';
import Payment from '../models/payment.model.js';
import Invoice from '../models/invoice.model.js';
import Project from '../models/project.model.js';
import { createActivityLog } from './activityLog.service.js';

// Create Payment
const createPayment = async (paymentData, user) => {
    try {
        // Verify project exists
        const project = await Project.findById(paymentData.projectId);
        if (!project) {
            throw new Error('Project not found');
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
        
        const payment = new Payment({
            ...paymentData,
            createdBy: userId,
            createdByModel: userRole === 'Admin' ? 'Admin' : 'User',
            customerName: project.lead?.customerName || 'Unknown Customer',
            customerEmail: project.lead?.email || 'unknown@example.com'
        });

        await payment.save();

        // Create activity log
        await createActivityLog({
            projectId: paymentData.projectId,
            user: userId,
            userModel: userRole === 'Admin' ? 'Admin' : 'User',
            userName: userName,
            userEmail: userEmail,
            actionType: 'CRUD',
            targetModel: 'Project', // Use Project since Payment is not in enum
            targetId: payment._id,
            targetName: `Payment for ₹${payment.amount}`,
            description: `Payment of ₹${payment.amount} via ${payment.method} recorded`,
            action: 'create'
        });

        return payment;
    } catch (error) {
        throw error;
    }
};

// Get Payments by Project
const getPaymentsByProject = async (projectId, user) => {
    try {
        const payments = await Payment.find({ projectId })
            .populate('createdBy', 'name email')
            .populate('verifiedBy', 'name email')
            .populate('invoiceId', 'invoiceNumber amount')
            .sort({ createdAt: -1 });

        return payments;
    } catch (error) {
        throw error;
    }
};

// Get Single Payment
const getPaymentById = async (paymentId, user) => {
    try {
        const payment = await Payment.findById(paymentId)
            .populate('createdBy', 'name email')
            .populate('verifiedBy', 'name email')
            .populate('invoiceId', 'invoiceNumber amount');

        if (!payment) {
            throw new Error('Payment not found');
        }

        return payment;
    } catch (error) {
        throw error;
    }
};

// Update Payment
const updatePayment = async (paymentId, updateData, user) => {
    try {
        const payment = await Payment.findById(paymentId);
        if (!payment) {
            throw new Error('Payment not found');
        }

        const oldStatus = payment.status;

        Object.assign(payment, updateData);
        await payment.save();

        // Create activity log for status changes
        if (oldStatus !== payment.status) {
            await createActivityLog({
                projectId: payment.projectId,
                userModel: user.role === 'Admin' ? 'Admin' : 'User',
                userId: user._id,
                userName: user.name,
                userEmail: user.email,
                actionType: 'update',
                targetModel: 'Payment',
                targetId: payment._id,
                targetName: `Payment for ₹${payment.amount}`,
                description: `Payment status changed from ${oldStatus} to ${payment.status}`,
                action: 'payment_status_updated'
            });
        }

        return payment;
    } catch (error) {
        throw error;
    }
};

// Delete Payment
const deletePayment = async (paymentId, user) => {
    try {
        const payment = await Payment.findById(paymentId);
        if (!payment) {
            throw new Error('Payment not found');
        }

        await Payment.findByIdAndDelete(paymentId);

        // Create activity log
        await createActivityLog({
            projectId: payment.projectId,
            userModel: user.role === 'Admin' ? 'Admin' : 'User',
            userId: user._id,
            userName: user.name,
            userEmail: user.email,
            actionType: 'delete',
            targetModel: 'Payment',
            targetId: payment._id,
            targetName: `Payment for ₹${payment.amount}`,
            description: `Payment of ₹${payment.amount} deleted`,
            action: 'payment_deleted'
        });

        return { message: 'Payment deleted successfully' };
    } catch (error) {
        throw error;
    }
};

// Verify Payment
const verifyPayment = async (paymentId, user) => {
    try {
        const payment = await Payment.findById(paymentId);
        if (!payment) {
            throw new Error('Payment not found');
        }

        payment.status = 'verified';
        payment.verifiedAt = new Date();
        payment.verifiedBy = user._id;
        await payment.save();

        // Update related invoice payment status if exists
        if (payment.invoiceId) {
            const invoice = await Invoice.findById(payment.invoiceId);
            if (invoice) {
                invoice.paymentStatus = 'paid';
                invoice.paidDate = new Date();
                await invoice.save();
            }
        }

        // Create activity log
        await createActivityLog({
            projectId: payment.projectId,
            userModel: user.role === 'Admin' ? 'Admin' : 'User',
            userId: user._id,
            userName: user.name,
            userEmail: user.email,
            actionType: 'verify',
            targetModel: 'Payment',
            targetId: payment._id,
            targetName: `Payment for ₹${payment.amount}`,
            description: `Payment of ₹${payment.amount} verified`,
            action: 'payment_verified'
        });

        return payment;
    } catch (error) {
        throw error;
    }
};

export const getPaymentsForCustomer = async (projectId, user) => {
    try {
        const userId = user?._id || user?.id || user?.sub;
        console.log('🔍 getPaymentsForCustomer - projectId:', projectId, 'userId:', userId);
        
        // Try to find payments sent to the current user
        let payments = await Payment.find({ 
            projectId, 
            status: 'sent',
            sentTo: userId 
        })
            .populate('createdBy', 'name email')
            .populate('sentTo', 'name email')
            .sort({ createdAt: -1 });

        console.log('🔍 getPaymentsForCustomer - found payments for userId:', payments.length);

        // If no payments found for current user, try to find by project lead
        if (payments.length === 0) {
            const project = await Project.findById(projectId).populate('lead');
            if (project && project.lead) {
                console.log('🔍 getPaymentsForCustomer - trying with project lead ID:', project.lead._id);
                payments = await Payment.find({ 
                    projectId, 
                    status: 'sent',
                    sentTo: project.lead._id 
                })
                    .populate('createdBy', 'name email')
                    .populate('sentTo', 'name email')
                    .sort({ createdAt: -1 });
                console.log('🔍 getPaymentsForCustomer - found payments for lead:', payments.length);
            }
        }
        return payments;
    } catch (error) {
        console.error('❌ getPaymentsForCustomer error:', error);
        throw error;
    }
};

export {
    createPayment,
    getPaymentsByProject,
    getPaymentById,
    updatePayment,
    deletePayment,
    verifyPayment
};

export default {
    createPayment,
    getPaymentsByProject,
    getPaymentById,
    updatePayment,
    deletePayment,
    verifyPayment
};
