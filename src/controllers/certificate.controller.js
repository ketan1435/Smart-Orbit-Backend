import certificateService from '../services/certificate.service.js';
import { uploadFileToS3 } from '../services/s3.service.js';

// Create Certificate
const createCertificate = async (req, res) => {
    try {
        const user = req.user;
        const { projectId } = req.params;
        
        console.log('🟣 CERTIFICATE CONTROLLER - createCertificate called');
        console.log('🟣 Project ID:', projectId);
        console.log('🟣 File received:', req.file ? 'Yes' : 'No');
        console.log('🟣 File details:', req.file);
        
        const certificateData = {
            ...req.body,
            projectId
        };

        // Handle file upload if file is provided
        if (req.file) {
            console.log('🟣 Uploading certificate file to S3...');
            const uploadResult = await uploadFileToS3(req.file, `projects/${projectId}/certificates`);
            console.log('🟣 Upload result:', uploadResult);
            certificateData.attachmentKey = uploadResult.key;
        }

        const certificate = await certificateService.createCertificate(certificateData, user);

        res.status(201).json({
            status: 1,
            message: 'Certificate generated successfully',
            data: certificate
        });
    } catch (error) {
        console.error('🟣 Certificate creation error:', error);
        res.status(400).json({
            status: 0,
            message: error.message || 'Failed to generate certificate',
            error: error.message
        });
    }
};

// Get Certificates by Project
const getCertificatesByProject = async (req, res) => {
    try {
        console.log('🟣 CERTIFICATE CONTROLLER - getCertificatesByProject called');
        console.log('🟣 Project ID:', req.params.projectId);
        const user = req.user;
        const { projectId } = req.params;

        const certificates = await certificateService.getCertificatesByProject(projectId, user);
        console.log('🟣 Certificates found:', certificates.length);
        console.log('🟣 First certificate:', certificates[0]);

        res.status(200).json({
            status: 1,
            message: 'Certificates retrieved successfully',
            data: certificates
        });
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message || 'Failed to retrieve certificates',
            error: error.message
        });
    }
};

// Get Single Certificate
const getCertificateById = async (req, res) => {
    try {
        const user = req.user;
        const { certificateId } = req.params;

        const certificate = await certificateService.getCertificateById(certificateId, user);

        res.status(200).json({
            status: 1,
            message: 'Certificate retrieved successfully',
            data: certificate
        });
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message || 'Failed to retrieve certificate',
            error: error.message
        });
    }
};

// Update Certificate
const updateCertificate = async (req, res) => {
    try {
        const user = req.user;
        const { certificateId } = req.params;

        const certificate = await certificateService.updateCertificate(certificateId, req.body, user);

        res.status(200).json({
            status: 1,
            message: 'Certificate updated successfully',
            data: certificate
        });
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message || 'Failed to update certificate',
            error: error.message
        });
    }
};

// Delete Certificate
const deleteCertificate = async (req, res) => {
    try {
        const user = req.user;
        const { certificateId } = req.params;

        const result = await certificateService.deleteCertificate(certificateId, user);

        res.status(200).json({
            status: 1,
            message: result.message,
            data: result
        });
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message || 'Failed to delete certificate',
            error: error.message
        });
    }
};

// Send Certificate to Customer
const sendCertificateToCustomer = async (req, res) => {
    try {
        const user = req.user;
        const { certificateId } = req.params;

        const certificate = await certificateService.sendCertificateToCustomer(certificateId, user);

        res.status(200).json({
            status: 1,
            message: 'Certificate sent to customer successfully',
            data: certificate
        });
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message || 'Failed to send certificate to customer',
            error: error.message
        });
    }
};

// Get Certificates for Customer (sent items only)
const getCertificatesForCustomer = async (req, res) => {
    try {
        const { projectId } = req.params;
        const user = req.user;
        const userId = user?._id || user?.id || user?.sub;
        
        const certificates = await certificateService.getCertificatesForCustomer(projectId, user);

        res.status(200).json({
            status: 1,
            message: 'Customer certificates retrieved successfully',
            data: certificates
        });
    } catch (error) {
        res.status(400).json({
            status: 0,
            message: error.message || 'Failed to retrieve customer certificates',
            error: error.message
        });
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
