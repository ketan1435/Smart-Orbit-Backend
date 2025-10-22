import paymentService, { getPaymentsForCustomer } from '../services/payment.service.js';
import { uploadFileToS3 } from '../services/s3.service.js';

// Create Payment
const createPayment = async (req, res) => {
    try {
        const user = req.user;
        const { projectId } = req.params;
        
        console.log('🔵 PAYMENT CONTROLLER - createPayment called');
        console.log('🔵 Project ID:', projectId);
        console.log('🔵 Request body:', req.body);
        console.log('🔵 Request file:', req.file);
        
        const paymentData = {
            ...req.body,
            projectId: projectId
        };

        // Handle file upload if receipt is provided
        if (req.file) {
            console.log('🔵 File received, uploading to S3...');
            const uploadResult = await uploadFileToS3(req.file, `projects/${projectId}/payments`);
            console.log('🔵 S3 upload result:', uploadResult);
            paymentData.receiptKey = uploadResult.key;
        }

        const payment = await paymentService.createPayment(paymentData, user);

        res.status(201).json({
            status: 1,
            message: 'Payment recorded successfully',
            data: payment
        });
    } catch (error) {
        console.error('🔵 Payment creation error:', error);
        res.status(400).json({
            status: 0,
            message: error.message || 'Failed to record payment',
            error: error.message
        });
    }
};

// Get Payments by Project
const getPaymentsByProject = async (req, res) => {
    try {
        console.log('🔵 PAYMENT CONTROLLER - getPaymentsByProject called');
        console.log('🔵 Project ID:', req.params.projectId);
        const user = req.user;
        const { projectId } = req.params;

        const payments = await paymentService.getPaymentsByProject(projectId, user);
        console.log('🔵 Payments found:', payments.length);
        console.log('🔵 First payment:', payments[0]);

        res.status(200).json({
            status: 1,
            message: 'Payments retrieved successfully',
            data: payments
        });
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message || 'Failed to retrieve payments',
            error: error.message
        });
    }
};

// Get Single Payment
const getPaymentById = async (req, res) => {
    try {
        const user = req.user;
        const { paymentId } = req.params;

        const payment = await paymentService.getPaymentById(paymentId, user);

        res.status(200).json({
            status: 1,
            message: 'Payment retrieved successfully',
            data: payment
        });
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message || 'Failed to retrieve payment',
            error: error.message
        });
    }
};

// Update Payment
const updatePayment = async (req, res) => {
    try {
        const user = req.user;
        const { paymentId } = req.params;

        const payment = await paymentService.updatePayment(paymentId, req.body, user);

        res.status(200).json({
            status: 1,
            message: 'Payment updated successfully',
            data: payment
        });
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message || 'Failed to update payment',
            error: error.message
        });
    }
};

// Delete Payment
const deletePayment = async (req, res) => {
    try {
        const user = req.user;
        const { paymentId } = req.params;

        const result = await paymentService.deletePayment(paymentId, user);

        res.status(200).json({
            status: 1,
            message: result.message,
            data: result
        });
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message || 'Failed to delete payment',
            error: error.message
        });
    }
};

// Verify Payment
const verifyPayment = async (req, res) => {
    try {
        const user = req.user;
        const { paymentId } = req.params;

        const payment = await paymentService.verifyPayment(paymentId, user);

        res.status(200).json({
            status: 1,
            message: 'Payment verified successfully',
            data: payment
        });
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message || 'Failed to verify payment',
            error: error.message
        });
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

// Get Payments for Customer
const getPaymentsForCustomerController = async (req, res) => {
    try {
        const { projectId } = req.params;
        const user = req.user;
        
        const payments = await getPaymentsForCustomer(projectId, user);
        
        res.status(200).json({ 
            status: 1, 
            message: 'Customer payments retrieved successfully', 
            data: payments 
        });
    } catch (error) {
        console.error('Error getting payments for customer:', error);
        res.status(400).json({ 
            status: 0, 
            message: error.message || 'Failed to retrieve payments', 
            error: error.message 
        });
    }
};

export default {
    createPayment,
    getPaymentsByProject,
    getPaymentById,
    updatePayment,
    deletePayment,
    verifyPayment,
    getPaymentsForCustomer: getPaymentsForCustomerController
};
