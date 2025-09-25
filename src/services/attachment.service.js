import Attachment from '../models/attachment.model.js';
import Project from '../models/project.model.js';
import CustomerLead from '../models/customerLead.model.js';
import Requirement from '../models/requirement.model.js';
import storage from '../factory/storage.factory.js';
import ApiError from '../utils/ApiError.js';
import httpStatus from 'http-status';

/**
 * Create a new attachment
 * @param {Object} attachmentBody
 * @returns {Promise<Attachment>}
 */
const createAttachment = async (attachmentBody) => {
    try {
        // Verify project exists
        const project = await Project.findById(attachmentBody.projectId);
        if (!project) {
            throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
        }

        // Verify customer lead exists
        const customerLead = await CustomerLead.findById(attachmentBody.customerLeadId);
        if (!customerLead) {
            throw new ApiError(httpStatus.NOT_FOUND, 'Customer lead not found');
        }

        // Verify requirement exists
        const requirement = await Requirement.findById(attachmentBody.requirementId);
        if (!requirement) {
            throw new ApiError(httpStatus.NOT_FOUND, 'Requirement not found');
        }

        // Check if file is already uploaded to S3 (has key) or needs to be uploaded
        let fileData;
        if (attachmentBody.file.key) {
            // File is already uploaded to S3, use the provided file data
            fileData = attachmentBody.file;
        } else {
            // Upload file to S3
            fileData = await storage.uploadFile(attachmentBody.file, 'admin-attachments');
        }
        
        // Create attachment record
        const attachment = await Attachment.create({
            ...attachmentBody,
            attachment: {
                file: fileData,
                note: attachmentBody.note || '',
                type: 'admin_attachment'
            }
        });

        return attachment;
    } catch (error) {
        if (error instanceof ApiError) {
            throw error;
        }
        throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to create attachment');
    }
};

/**
 * Get attachments for a customer
 * @param {string} customerLeadId
 * @param {Object} options
 * @returns {Promise<Object>}
 */
const getAttachmentsForCustomer = async (customerLeadId, options = {}) => {
    try {
        const { page = 1, limit = 10, status } = options;
        
        const filter = { customerLeadId };
        if (status) {
            filter.status = status;
        }

        const attachments = await Attachment.find(filter)
            .populate('projectId', 'projectName')
            .populate('sentBy', 'name email')
            .populate('reviewedBy', 'name email')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const totalAttachments = await Attachment.countDocuments(filter);

        return {
            attachments,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: totalAttachments,
                pages: Math.ceil(totalAttachments / limit)
            }
        };
    } catch (error) {
        throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to get attachments');
    }
};

/**
 * Get attachment by ID
 * @param {string} attachmentId
 * @returns {Promise<Attachment>}
 */
const getAttachmentById = async (attachmentId) => {
    try {
        const attachment = await Attachment.findById(attachmentId)
            .populate('projectId', 'projectName')
            .populate('customerLeadId', 'customerName')
            .populate('sentBy', 'name email')
            .populate('reviewedBy', 'name email');

        if (!attachment) {
            throw new ApiError(httpStatus.NOT_FOUND, 'Attachment not found');
        }

        return attachment;
    } catch (error) {
        if (error instanceof ApiError) {
            throw error;
        }
        throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to get attachment');
    }
};

/**
 * Review attachment (approve/reject)
 * @param {string} attachmentId
 * @param {Object} reviewData
 * @returns {Promise<Attachment>}
 */
const reviewAttachment = async (attachmentId, reviewData) => {
    try {
        const attachment = await Attachment.findById(attachmentId);
        if (!attachment) {
            throw new ApiError(httpStatus.NOT_FOUND, 'Attachment not found');
        }

        if (attachment.status !== 'pending') {
            throw new ApiError(httpStatus.BAD_REQUEST, 'Attachment has already been reviewed');
        }

        const updatedAttachment = await Attachment.findByIdAndUpdate(
            attachmentId,
            {
                status: reviewData.status,
                customerRemarks: reviewData.remarks || '',
                reviewedAt: new Date(),
                reviewedBy: reviewData.reviewedBy
            },
            { new: true }
        ).populate('projectId', 'projectName')
         .populate('customerLeadId', 'customerName')
         .populate('sentBy', 'name email')
         .populate('reviewedBy', 'name email');

        return updatedAttachment;
    } catch (error) {
        if (error instanceof ApiError) {
            throw error;
        }
        throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to review attachment');
    }
};

/**
 * Get attachment file URL
 * @param {string} attachmentId
 * @returns {Promise<string>}
 */
const getAttachmentFileUrl = async (attachmentId) => {
    try {
        const attachment = await Attachment.findById(attachmentId);
        if (!attachment) {
            throw new ApiError(httpStatus.NOT_FOUND, 'Attachment not found');
        }

        const fileUrl = await storage.getFileUrl(attachment.attachment.file.key);
        return fileUrl;
    } catch (error) {
        if (error instanceof ApiError) {
            throw error;
        }
        throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to get file URL');
    }
};

/**
 * Get attachments for a project
 * @param {string} projectId
 * @param {Object} options
 * @returns {Promise<Object>}
 */
const getAttachmentsForProject = async (projectId, options = {}) => {
    try {
        const { page = 1, limit = 10, status } = options;
        
        const filter = { projectId };
        if (status) {
            filter.status = status;
        }

        const attachments = await Attachment.find(filter)
            .populate('customerLeadId', 'customerName')
            .populate('sentBy', 'name email')
            .populate('reviewedBy', 'name email')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const totalAttachments = await Attachment.countDocuments(filter);

        return {
            attachments,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: totalAttachments,
                pages: Math.ceil(totalAttachments / limit)
            }
        };
    } catch (error) {
        throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to get project attachments');
    }
};

export {
    createAttachment,
    getAttachmentsForCustomer,
    getAttachmentById,
    reviewAttachment,
    getAttachmentFileUrl,
    getAttachmentsForProject
};
