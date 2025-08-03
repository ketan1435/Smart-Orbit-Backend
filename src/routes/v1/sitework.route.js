import express from 'express';
import auth from '../../middlewares/auth.js';
import validate from '../../middlewares/validate.js';
import * as siteworkValidation from '../../validations/sitework.validation.js';
import * as siteworkController from '../../controllers/sitework.controller.js';

const router = express.Router();

/**
 * @swagger
 * /siteworks:
 *   post:
 *     summary: Create a sitework
 *     tags: [Sitework]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - project
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               project:
 *                 type: string
 *               startDate:
 *                 type: string
 *                 format: date
 *               endDate:
 *                 type: string
 *                 format: date
 *               status:
 *                 type: string
 *                 enum: [not-started, in-progress, completed, cancelled]
 *               assignedUsers:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Sitework created successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 */
router.post('/', auth('manageSiteworks'), validate(siteworkValidation.createSitework), siteworkController.createSitework);

/**
 * @swagger
 * /siteworks/{id}:
 *   put:
 *     summary: Update sitework details
 *     tags: [Sitework]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Sitework ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               description:
 *                 type: string
 *               assignedUsers:
 *                 type: array
 *                 items:
 *                   type: string
 *               endDate:
 *                 type: string
 *                 format: date
 *               status:
 *                 type: string
 *                 enum: [not-started, in-progress, completed, cancelled]
 *     responses:
 *       200:
 *         description: Sitework updated successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Sitework not found
 */
router.put('/:id', auth('manageSiteworks'), validate(siteworkValidation.updateSitework), siteworkController.updateSitework);

/**
 * @swagger
 * /siteworks/project/{projectId}:
 *   get:
 *     summary: Get all siteworks for a project
 *     tags: [Sitework]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID
 *     responses:
 *       200:
 *         description: Siteworks fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 1
 *                 message:
 *                   type: string
 *                   example: Siteworks fetched successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       description:
 *                         type: string
 *                       status:
 *                         type: string
 *                       startDate:
 *                         type: string
 *                         format: date-time
 *                       endDate:
 *                         type: string
 *                         format: date-time
 *                       assignedUsers:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             _id:
 *                               type: string
 *                             name:
 *                               type: string
 *                             email:
 *                               type: string
 *                             role:
 *                               type: string
 *                       sequence:
 *                         type: number
 *                       isActive:
 *                         type: boolean
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Project not found
 */
router.get('/project/:projectId', auth('getSiteworks'), validate(siteworkValidation.getSiteworksByProject), siteworkController.getSiteworksByProject);

/**
 * @swagger
 * /siteworks/{siteworkId}/documents:
 *   post:
 *     summary: Add a document to a sitework (site engineer or assigned user)
 *     tags: [Sitework]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: siteworkId
 *         required: true
 *         schema:
 *           type: string
 *         description: Sitework ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - files
 *             properties:
 *               files:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - key
 *                     - fileType
 *                   properties:
 *                     key:
 *                       type: string
 *                       description: S3 key of the uploaded file (from initiate-upload)
 *                     fileType:
 *                       type: string
 *                       description: File type (e.g., image/png, application/pdf)
 *               userNote:
 *                 type: string
 *                 description: Optional note from the user
 *           example:
 *             files:
 *               - key: uploads/tmp/sitework-docs/uuid-filename.pdf
 *                 fileType: application/pdf
 *             userNote: "Initial excavation report"
 *     responses:
 *       201:
 *         description: Sitework document added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 1
 *                 message:
 *                   type: string
 *                   example: Sitework document added successfully
 *                 data:
 *                   type: object
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Sitework not found
 */
router.post('/:siteworkId/documents', auth('manageSiteworkDocuments'), validate(siteworkValidation.addSiteworkDocument), siteworkController.addSiteworkDocument);

/**
 * @swagger
 * /siteworks/{siteworkId}/documents/{docId}/review:
 *   patch:
 *     summary: Review (approve or reject) a sitework document (admin, sales-admin, site engineer)
 *     tags: [Sitework]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: siteworkId
 *         required: true
 *         schema:
 *           type: string
 *         description: Sitework ID
 *       - in: path
 *         name: docId
 *         required: true
 *         schema:
 *           type: string
 *         description: The _id of the document in the siteworkDocuments array
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
 *                 enum: [Approved, Rejected]
 *               feedback:
 *                 type: string
 *                 description: Optional feedback
 *           example:
 *             status: "Approved"
 *             feedback: "Looks good."
 *     responses:
 *       200:
 *         description: Document status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 1
 *                 message:
 *                   type: string
 *                   example: Document status updated successfully
 *                 data:
 *                   type: object
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Sitework or document not found
 */
router.patch('/:siteworkId/documents/:docId/review', auth('manageSiteworkDocuments'), validate(siteworkValidation.approveOrRejectSiteworkDocument), siteworkController.approveOrRejectSiteworkDocument);

/**
 * @swagger
 * /siteworks/project/{projectId}/documents/customer:
 *   get:
 *     summary: Get sitework documents for customer
 *     tags: [Sitework]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID
 *     responses:
 *       200:
 *         description: Sitework documents for customer fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: number
 *                   example: 1
 *                 message:
 *                   type: string
 *                   example: Sitework documents for customer fetched successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       files:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             fileType:
 *                               type: string
 *                             key:
 *                               type: string
 *                             uploadedAt:
 *                               type: string
 *                             format: date-time
 *                       userNote:
 *                         type: string
 *                       siteengineerStatus:
 *                         type: string
 *                         enum: [Pending, Approved, Rejected]
 *                       adminStatus:
 *                         type: string
 *                         enum: [Pending, Approved, Rejected]
 *                       siteengineerFeedback:
 *                         type: string
 *                       adminFeedback:
 *                         type: string
 *                       addedAt:
 *                         type: string
 *                         format: date-time
 *                       createdByUserName:
 *                         type: string
 *                       siteengineerFeedbackByUserName:
 *                         type: string
 *                       siteworkName:
 *                         type: string
 *                       siteworkDescription:
 *                         type: string
 *                       siteworkStatus:
 *                         type: string
 *                       siteworkId:
 *                         type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Only customers can access this endpoint
 *       404:
 *         description: Project not found
 */
router.get('/project/:projectId/documents/customer', auth('getSiteworkDocumentsForCustomer'), validate(siteworkValidation.getSiteworkDocumentsForCustomer), siteworkController.getSiteworkDocumentsForCustomer);

/**
 * @swagger
 * /siteworks/project/{projectId}/sitework/{siteworkId}/documents/{docId}/customer-review:
 *   patch:
 *     summary: Customer review of sitework document
 *     tags: [Sitework]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID
 *       - in: path
 *         name: siteworkId
 *         required: true
 *         schema:
 *           type: string
 *         description: Sitework ID
 *       - in: path
 *         name: docId
 *         required: true
 *         schema:
 *           type: string
 *         description: Document ID
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
 *                 enum: [Approved, Rejected]
 *               feedback:
 *                 type: string
 *                 description: Optional feedback from customer
 *           example:
 *             status: "Approved"
 *             feedback: "Work looks good, approved."
 *     responses:
 *       200:
 *         description: Sitework document reviewed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: number
 *                   example: 1
 *                 message:
 *                   type: string
 *                   example: Sitework document reviewed successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     files:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           fileType:
 *                             type: string
 *                           key:
 *                             type: string
 *                           uploadedAt:
 *                             type: string
 *                             format: date-time
 *                     userNote:
 *                       type: string
 *                     siteengineerStatus:
 *                       type: string
 *                     adminStatus:
 *                       type: string
 *                     customerStatus:
 *                       type: string
 *                     siteengineerFeedback:
 *                       type: string
 *                     adminFeedback:
 *                       type: string
 *                     customerFeedback:
 *                       type: string
 *                     customerReviewedAt:
 *                       type: string
 *                       format: date-time
 *                     createdByUserName:
 *                       type: string
 *                     siteengineerFeedbackByUserName:
 *                       type: string
 *                     adminFeedbackByUserName:
 *                       type: string
 *                     siteworkName:
 *                       type: string
 *                     siteworkDescription:
 *                       type: string
 *                     siteworkStatus:
 *                       type: string
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Only customers can review documents
 *       404:
 *         description: Sitework or document not found
 */
router.patch('/project/:projectId/sitework/:siteworkId/documents/:docId/customer-review', auth('customerReviewSiteworkDocument'), validate(siteworkValidation.customerReviewSiteworkDocument), siteworkController.customerReviewSiteworkDocument);

/**
 * @swagger
 * /siteworks/project/{projectId}/sitework/{siteworkId}/documents/{docId}/send-to-customer:
 *   post:
 *     summary: Send sitework document to customer for review (Admin only)
 *     tags: [Sitework]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID
 *       - in: path
 *         name: siteworkId
 *         required: true
 *         schema:
 *           type: string
 *         description: Sitework ID
 *       - in: path
 *         name: docId
 *         required: true
 *         schema:
 *           type: string
 *         description: Document ID
 *     responses:
 *       200:
 *         description: Sitework document sent to customer successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: number
 *                   example: 1
 *                 message:
 *                   type: string
 *                   example: Sitework document sent to customer successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     files:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           fileType:
 *                             type: string
 *                           key:
 *                             type: string
 *                           uploadedAt:
 *                             type: string
 *                             format: date-time
 *                     userNote:
 *                       type: string
 *                     siteengineerStatus:
 *                       type: string
 *                     adminStatus:
 *                       type: string
 *                     customerStatus:
 *                       type: string
 *                     siteengineerFeedback:
 *                       type: string
 *                     adminFeedback:
 *                       type: string
 *                     sentToCustomerAt:
 *                       type: string
 *                       format: date-time
 *                     sentToCustomerBy:
 *                       type: string
 *                     sentToCustomerByModel:
 *                       type: string
 *                     createdByUserName:
 *                       type: string
 *                     siteengineerFeedbackByUserName:
 *                       type: string
 *                     adminFeedbackByUserName:
 *                       type: string
 *                     sentToCustomerByUserName:
 *                       type: string
 *                     siteworkName:
 *                       type: string
 *                     siteworkDescription:
 *                       type: string
 *                     siteworkStatus:
 *                       type: string
 *       400:
 *         description: Bad request - Document already sent to customer
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Only admins can send documents to customers
 *       404:
 *         description: Sitework or document not found
 */
router.post('/project/:projectId/sitework/:siteworkId/documents/:docId/send-to-customer', auth('sendSiteworkDocumentToCustomer'), validate(siteworkValidation.sendSiteworkDocumentToCustomer), siteworkController.sendSiteworkDocumentToCustomer);

/**
 * @swagger
 * /siteworks/{siteworkId}/documents:
 *   get:
 *     summary: Get sitework documents
 *     tags: [Sitework]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: siteworkId
 *         required: true
 *         schema:
 *           type: string
 *         description: Sitework ID
 *     responses:
 *       200:
 *         description: Sitework documents fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: number
 *                   example: 1
 *                 message:
 *                   type: string
 *                   example: Sitework documents fetched successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       files:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             fileType:
 *                               type: string
 *                             key:
 *                               type: string
 *                             uploadedAt:
 *                               type: string
 *                             format: date-time
 *                       userNote:
 *                         type: string
 *                       siteengineerStatus:
 *                         type: string
 *                         enum: [Pending, Approved, Rejected]
 *                       adminStatus:
 *                         type: string
 *                         enum: [Pending, Approved, Rejected]
 *                       siteengineerFeedback:
 *                         type: string
 *                       adminFeedback:
 *                         type: string
 *                       addedAt:
 *                         type: string
 *                         format: date-time
 *                       createdByUserName:
 *                         type: string
 *                       adminFeedbackByUserName:
 *                         type: string
 *                       siteengineerFeedbackByUserName:
 *                         type: string
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Sitework not found
 */
router.get('/:siteworkId/documents', auth(), siteworkController.getSiteworkDocuments);

export default router; 