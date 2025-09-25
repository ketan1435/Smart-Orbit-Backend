import express from 'express';
import auth from '../../middlewares/auth.js';
import validate from '../../middlewares/validate.js';
import * as attachmentController from '../../controllers/attachment.controller.js';
import * as attachmentValidation  from '../../validations/attachment.validation.js';

const router = express.Router();

// Middleware for file upload
const uploadMiddleware = attachmentController.upload.single('file');

/**
 * @swagger
 * /attachments:
 *   post:
 *     summary: Create a new attachment
 *     tags: [Attachments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - projectId
 *               - documentId
 *               - customerLeadId
 *               - requirementId
 *               - file
 *             properties:
 *               projectId:
 *                 type: string
 *               documentId:
 *                 type: string
 *               customerLeadId:
 *                 type: string
 *               requirementId:
 *                 type: string
 *               note:
 *                 type: string
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Attachment created successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
router.post(
    '/',
    auth(),
    attachmentController.createAttachment
);

/**
 * @swagger
 * /attachments/customer/{customerLeadId}:
 *   get:
 *     summary: Get attachments for a customer
 *     tags: [Attachments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: customerLeadId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, approved, rejected]
 *     responses:
 *       200:
 *         description: Attachments retrieved successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Customer not found
 */
router.get(
    '/customer/:customerLeadId',
    auth(),
    validate(attachmentValidation.getAttachmentsForCustomer),
    attachmentController.getAttachmentsForCustomer
);

/**
 * @swagger
 * /attachments/{attachmentId}:
 *   get:
 *     summary: Get attachment by ID
 *     tags: [Attachments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: attachmentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Attachment retrieved successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Attachment not found
 */
router.get(
    '/:attachmentId',
    auth(),
    validate(attachmentValidation.getAttachmentById),
    attachmentController.getAttachmentById
);

/**
 * @swagger
 * /attachments/{attachmentId}/review:
 *   put:
 *     summary: Review attachment (approve/reject)
 *     tags: [Attachments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: attachmentId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [approved, rejected]
 *               remarks:
 *                 type: string
 *     responses:
 *       200:
 *         description: Attachment reviewed successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Attachment not found
 */
router.put(
    '/:attachmentId/review',
    auth(),
    validate(attachmentValidation.reviewAttachment),
    attachmentController.reviewAttachment
);

/**
 * @swagger
 * /attachments/{attachmentId}/file:
 *   get:
 *     summary: Get attachment file URL
 *     tags: [Attachments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: attachmentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: File URL retrieved successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Attachment not found
 */
router.get(
    '/:attachmentId/file',
    auth(),
    validate(attachmentValidation.getAttachmentFileUrl),
    attachmentController.getAttachmentFileUrl
);

/**
 * @swagger
 * /attachments/project/{projectId}:
 *   get:
 *     summary: Get attachments for a project
 *     tags: [Attachments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, approved, rejected]
 *     responses:
 *       200:
 *         description: Project attachments retrieved successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Project not found
 */
router.get(
    '/project/:projectId',
    auth(),
    validate(attachmentValidation.getAttachmentsForProject),
    attachmentController.getAttachmentsForProject
);

export default router;
