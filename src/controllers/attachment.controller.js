import httpStatus from 'http-status';
import multer from 'multer';
import * as attachmentService from '../services/attachment.service.js';
import ApiError from '../utils/ApiError.js';
import catchAsync from '../utils/catchAsync.js';

// Configure multer for file upload
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        console.log('File filter - file:', file);
        console.log('File filter - mimetype:', file.mimetype);
        
        // Allow common document and image formats
        const allowedTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/gif',
            'text/plain'
        ];
        
        if (allowedTypes.includes(file.mimetype)) {
            console.log('File type allowed:', file.mimetype);
            cb(null, true);
        } else {
            console.log('File type not allowed:', file.mimetype);
            cb(new ApiError(httpStatus.BAD_REQUEST, 'Invalid file type. Only PDF, DOC, DOCX, JPG, PNG, GIF, and TXT files are allowed.'), false);
        }
    }
});

/**
 * Create a new attachment
 */
const createAttachment = catchAsync(async (req, res) => {
    try {
        console.log('Request body:', req.body);
        console.log('Request file:', req.file);
        console.log('Request files:', req.files);
        console.log('Request headers:', req.headers);
        console.log('Content-Type:', req.headers['content-type']);
        
        // Check if file data is provided (either as file upload or as file key)
        if (!req.file && !req.body.file) {
            console.log('No file found in request');
            throw new ApiError(httpStatus.BAD_REQUEST, 'No file uploaded');
        }

        const attachmentData = {
            projectId: req.body.projectId,
            documentId: req.body.documentId,
            customerLeadId: req.body.customerLeadId,
            requirementId: req.body.requirementId,
            note: req.body.note || '',
            sentBy: req.user.id,
            file: req.body.file || {
                buffer: req.file.buffer,
                originalname: req.file.originalname,
                mimetype: req.file.mimetype,
                size: req.file.size
            }
        };

        const attachment = await attachmentService.createAttachment(attachmentData);
        
        res.status(httpStatus.CREATED).json({
            status: 1,
            message: 'Attachment created successfully',
            data: attachment
        });
    } catch (error) {
        throw error;
    }
});

/**
 * Get attachments for a customer
 */
const getAttachmentsForCustomer = catchAsync(async (req, res) => {
    try {
        const { customerLeadId } = req.params;
        const { page = 1, limit = 10, status } = req.query;

        const result = await attachmentService.getAttachmentsForCustomer(customerLeadId, {
            page,
            limit,
            status
        });

        res.status(httpStatus.OK).json({
            status: 1,
            message: 'Attachments retrieved successfully',
            data: result
        });
    } catch (error) {
        throw error;
    }
});

/**
 * Get attachment by ID
 */
const getAttachmentById = catchAsync(async (req, res) => {
    try {
        const { attachmentId } = req.params;
        const attachment = await attachmentService.getAttachmentById(attachmentId);

        res.status(httpStatus.OK).json({
            status: 1,
            message: 'Attachment retrieved successfully',
            data: attachment
        });
    } catch (error) {
        throw error;
    }
});

/**
 * Review attachment (approve/reject)
 */
const reviewAttachment = catchAsync(async (req, res) => {
    try {
        const { attachmentId } = req.params;
        const { status, remarks } = req.body;

        if (!status || !['approved', 'rejected'].includes(status)) {
            throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid status. Must be "approved" or "rejected"');
        }

        if (status === 'rejected' && !remarks?.trim()) {
            throw new ApiError(httpStatus.BAD_REQUEST, 'Rejection remarks are required');
        }

        const reviewData = {
            status,
            remarks: remarks || '',
            reviewedBy: req.user.id
        };

        const attachment = await attachmentService.reviewAttachment(attachmentId, reviewData);

        res.status(httpStatus.OK).json({
            status: 1,
            message: `Attachment ${status} successfully`,
            data: attachment
        });
    } catch (error) {
        throw error;
    }
});

/**
 * Get attachment file URL
 */
const getAttachmentFileUrl = catchAsync(async (req, res) => {
    try {
        const { attachmentId } = req.params;
        const fileUrl = await attachmentService.getAttachmentFileUrl(attachmentId);

        res.status(httpStatus.OK).json({
            status: 1,
            message: 'File URL retrieved successfully',
            data: { fileUrl }
        });
    } catch (error) {
        throw error;
    }
});

/**
 * Get attachments for a project
 */
const getAttachmentsForProject = catchAsync(async (req, res) => {
    try {
        const { projectId } = req.params;
        const { page = 1, limit = 10, status } = req.query;

        const result = await attachmentService.getAttachmentsForProject(projectId, {
            page,
            limit,
            status
        });

        res.status(httpStatus.OK).json({
            status: 1,
            message: 'Project attachments retrieved successfully',
            data: result
        });
    } catch (error) {
        throw error;
    }
});

export {
    createAttachment,
    getAttachmentsForCustomer,
    getAttachmentById,
    reviewAttachment,
    getAttachmentFileUrl,
    getAttachmentsForProject,
    upload
};
