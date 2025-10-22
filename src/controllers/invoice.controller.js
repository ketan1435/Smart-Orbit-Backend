import invoiceService from '../services/invoice.service.js';

// Create Invoice
const createInvoice = async (req, res) => {
    try {
        const user = req.user;
        console.log('Controller - User object:', user);
        console.log('Controller - User ID:', user?._id || user?.id);
        console.log('Controller - File:', req.file);
        
        // Remove invoiceNumber from request body since it's auto-generated
        const { invoiceNumber, ...bodyData } = req.body;
        
        // Handle file upload if present
        let attachmentKey = null;
        console.log('Invoice Controller Debug - File present:', !!req.file);
        console.log('Invoice Controller Debug - File details:', req.file ? {
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
            bufferLength: req.file.buffer?.length
        } : 'No file');
        
        if (req.file) {
            const { uploadFileToS3 } = await import('../services/s3.service.js');
            console.log('About to upload file to S3...');
            console.log('File details:', {
                originalname: req.file.originalname,
                mimetype: req.file.mimetype,
                size: req.file.size,
                bufferLength: req.file.buffer?.length
            });
            
            const uploadResult = await uploadFileToS3(req.file, `projects/${req.params.projectId}/invoices`);
            attachmentKey = uploadResult.key;
            console.log('File uploaded to S3 successfully:', uploadResult);
            console.log('Attachment key stored:', attachmentKey);
        } else {
            console.log('No file provided for upload');
        }
        
        const invoiceData = {
            ...bodyData,
            projectId: req.params.projectId,
            attachmentKey: attachmentKey
        };

        const invoice = await invoiceService.createInvoice(invoiceData, user);

        res.status(201).json({
            status: 1,
            message: 'Invoice created successfully',
            data: invoice
        });
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message || 'Failed to create invoice',
            error: error.message
        });
    }
};

// Get Invoices by Project
const getInvoicesByProject = async (req, res) => {
    try {
        console.log('🟢 INVOICE CONTROLLER - getInvoicesByProject called');
        console.log('🟢 Project ID:', req.params.projectId);
        const user = req.user;
        const { projectId } = req.params;

        const invoices = await invoiceService.getInvoicesByProject(projectId, user);
        console.log('🟢 Invoices found:', invoices.length);
        console.log('🟢 First invoice:', invoices[0]);

        res.status(200).json({
            status: 1,
            message: 'Invoices retrieved successfully',
            data: invoices
        });
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message || 'Failed to retrieve invoices',
            error: error.message
        });
    }
};

// Get Single Invoice
const getInvoiceById = async (req, res) => {
    try {
        const user = req.user;
        const { invoiceId } = req.params;

        const invoice = await invoiceService.getInvoiceById(invoiceId, user);

        res.status(200).json({
            status: 1,
            message: 'Invoice retrieved successfully',
            data: invoice
        });
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message || 'Failed to retrieve invoice',
            error: error.message
        });
    }
};

// Update Invoice
const updateInvoice = async (req, res) => {
    try {
        const user = req.user;
        const { invoiceId } = req.params;

        const invoice = await invoiceService.updateInvoice(invoiceId, req.body, user);

        res.status(200).json({
            status: 1,
            message: 'Invoice updated successfully',
            data: invoice
        });
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message || 'Failed to update invoice',
            error: error.message
        });
    }
};

// Delete Invoice
const deleteInvoice = async (req, res) => {
    try {
        const user = req.user;
        const { invoiceId } = req.params;

        const result = await invoiceService.deleteInvoice(invoiceId, user);

        res.status(200).json({
            status: 1,
            message: result.message,
            data: result
        });
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message || 'Failed to delete invoice',
            error: error.message
        });
    }
};

// Send Invoice to Customer
const sendInvoiceToCustomer = async (req, res) => {
    try {
        const user = req.user;
        const { invoiceId } = req.params;

        const invoice = await invoiceService.sendInvoiceToCustomer(invoiceId, user);

        res.status(200).json({
            status: 1,
            message: 'Invoice sent to customer successfully',
            data: invoice
        });
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message || 'Failed to send invoice to customer',
            error: error.message
        });
    }
};

// Get Invoices for Customer (sent items only)
const getInvoicesForCustomer = async (req, res) => {
    try {
        const { projectId } = req.params;
        const user = req.user;
        
        const invoices = await invoiceService.getInvoicesForCustomer(projectId, user);

        res.status(200).json({
            status: 1,
            message: 'Customer invoices retrieved successfully',
            data: invoices
        });
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message || 'Failed to retrieve customer invoices',
            error: error.message
        });
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
