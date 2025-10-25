import customerDocumentService from '../services/customerDocument.service.js';
import { uploadFileToS3 } from '../services/s3.service.js';

// Create Customer Document
const createCustomerDocument = async (req, res) => {
    try {
        const user = req.user;
        const { projectId } = req.params;
        
        console.log('📄 CUSTOMER DOCUMENT CONTROLLER - createCustomerDocument called');
        console.log('📄 Project ID:', projectId);
        console.log('📄 File received:', req.file ? 'Yes' : 'No');
        console.log('📄 File details:', req.file);
        
        const documentData = {
            ...req.body,
            projectId
        };

        // Handle file upload if file is provided
        if (req.file) {
            console.log('📄 Uploading customer document file to S3...');
            const uploadResult = await uploadFileToS3(req.file, `projects/${projectId}/customer-documents`);
            console.log('📄 Upload result:', uploadResult);
            documentData.fileKey = uploadResult.key;
            documentData.fileSize = req.file.size;
            documentData.mimeType = req.file.mimetype;
        }

        const document = await customerDocumentService.createCustomerDocument(documentData, user);

        res.status(201).json({
            status: 1,
            message: 'Customer document uploaded successfully',
            data: document
        });
    } catch (error) {
        console.error('📄 Customer document creation error:', error);
        res.status(400).json({
            status: 0,
            message: error.message || 'Failed to upload customer document',
            error: error.message
        });
    }
};

// Get Customer Documents by Project
const getCustomerDocumentsByProject = async (req, res) => {
    try {
        console.log('📄 CUSTOMER DOCUMENT CONTROLLER - getCustomerDocumentsByProject called');
        console.log('📄 Project ID:', req.params.projectId);
        const user = req.user;
        const { projectId } = req.params;

        const documents = await customerDocumentService.getCustomerDocumentsByProject(projectId, user);
        console.log('📄 Customer documents found:', documents.length);
        console.log('📄 First document:', documents[0]);

        res.status(200).json({
            status: 1,
            message: 'Customer documents retrieved successfully',
            data: documents
        });
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message || 'Failed to retrieve customer documents',
            error: error.message
        });
    }
};

// Get Single Customer Document
const getCustomerDocumentById = async (req, res) => {
    try {
        const user = req.user;
        const { documentId } = req.params;

        const document = await customerDocumentService.getCustomerDocumentById(documentId, user);

        res.status(200).json({
            status: 1,
            message: 'Customer document retrieved successfully',
            data: document
        });
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message || 'Failed to retrieve customer document',
            error: error.message
        });
    }
};

// Update Customer Document
const updateCustomerDocument = async (req, res) => {
    try {
        const user = req.user;
        const { documentId } = req.params;

        const document = await customerDocumentService.updateCustomerDocument(documentId, req.body, user);

        res.status(200).json({
            status: 1,
            message: 'Customer document updated successfully',
            data: document
        });
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message || 'Failed to update customer document',
            error: error.message
        });
    }
};

// Delete Customer Document
const deleteCustomerDocument = async (req, res) => {
    try {
        const user = req.user;
        const { documentId } = req.params;

        const result = await customerDocumentService.deleteCustomerDocument(documentId, user);

        res.status(200).json({
            status: 1,
            message: result.message,
            data: result
        });
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message || 'Failed to delete customer document',
            error: error.message
        });
    }
};

// Mark Document as Viewed
const markDocumentAsViewed = async (req, res) => {
    try {
        const user = req.user;
        const { documentId } = req.params;

        const document = await customerDocumentService.markDocumentAsViewed(documentId, user);

        res.status(200).json({
            status: 1,
            message: 'Document marked as viewed successfully',
            data: document
        });
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message || 'Failed to mark document as viewed',
            error: error.message
        });
    }
};

// Get Customer Documents for Customer (uploaded by customer)
const getCustomerDocumentsForCustomer = async (req, res) => {
    try {
        const { projectId } = req.params;
        const user = req.user;
        
        const documents = await customerDocumentService.getCustomerDocumentsForCustomer(projectId, user);

        res.status(200).json({
            status: 1,
            message: 'Customer documents retrieved successfully',
            data: documents
        });
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message || 'Failed to retrieve customer documents',
            error: error.message
        });
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
