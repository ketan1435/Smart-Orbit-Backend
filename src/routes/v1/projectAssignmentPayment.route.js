import express from 'express';
import auth from '../../middlewares/auth.js';
import validate from '../../middlewares/validate.js';
import * as projectAssignmentPaymentValidation from '../../validations/projectAssignmentPayment.validation.js';
import * as projectAssignmentPaymentController from '../../controllers/projectAssignmentPayment.controller.js';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     ProjectAssignmentPayment:
 *       type: object
 *       required:
 *         - project
 *         - user
 *         - assignedAmount
 *         - createdBy
 *         - createdByModel
 *       properties:
 *         _id:
 *           type: string
 *           description: The auto-generated id of the payment
 *         project:
 *           type: string
 *           description: The project ID
 *         user:
 *           type: string
 *           description: The user ID who is assigned
 *         assignedAmount:
 *           type: number
 *           description: The amount assigned to the user
 *         note:
 *           type: string
 *           description: Additional notes about the payment
 *         createdBy:
 *           type: string
 *           description: The ID of the user who created this payment
 *         createdByModel:
 *           type: string
 *           enum: [Admin, User]
 *           description: The model type of the creator
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: The date the payment was created
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: The date the payment was last updated
 */

/**
 * @swagger
 * /v1/project-assignment-payments:
 *   get:
 *     summary: Get all project assignment payments
 *     description: Retrieve a list of all project assignment payments with filtering by project name, user name, user role, and pagination
 *     tags: [Project Assignment Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: projectName
 *         schema:
 *           type: string
 *         description: Filter by project name (case-insensitive search)
 *       - in: query
 *         name: userName
 *         schema:
 *           type: string
 *         description: Filter by user name (case-insensitive search)
 *       - in: query
 *         name: userRole
 *         schema:
 *           type: string
 *           enum: [admin, sales-admin, architect, fabricator, procurement-team, site-engineer, worker, dispatch-installation, user, Admin]
 *         description: Filter by user role
 *       - in: query
 *         name: createdBy
 *         schema:
 *           type: string
 *         description: Filter by creator ID
 *       - in: query
 *         name: createdByModel
 *         schema:
 *           type: string
 *           enum: [Admin, User]
 *         description: Filter by creator model type
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *         description: Sort field and order (e.g., createdAt:desc)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of results per page
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *     responses:
 *       200:
 *         description: List of project assignment payments
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
 *                   example: Project assignment payments fetched successfully.
 *                 data:
 *                   type: object
 *                   properties:
 *                     results:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/ProjectAssignmentPayment'
 *                     totalResults:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *                     currentPage:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *   post:
 *     summary: Create a new project assignment payment
 *     description: Create a new project assignment payment record
 *     tags: [Project Assignment Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - project
 *               - user
 *               - assignedAmount
 *               - createdBy
 *               - createdByModel
 *             properties:
 *               project:
 *                 type: string
 *                 description: The project ID
 *               user:
 *                 type: string
 *                 description: The user ID who is assigned
 *               assignedAmount:
 *                 type: number
 *                 description: The amount assigned to the user
 *               note:
 *                 type: string
 *                 description: Additional notes about the payment
 *               createdBy:
 *                 type: string
 *                 description: The ID of the user who created this payment
 *               createdByModel:
 *                 type: string
 *                 enum: [Admin, User]
 *                 description: The model type of the creator
 *     responses:
 *       201:
 *         description: Project assignment payment created successfully
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
 *                   example: Project assignment payment created successfully.
 *                 data:
 *                   $ref: '#/components/schemas/ProjectAssignmentPayment'
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router
  .route('/')
  .get(auth(), validate(projectAssignmentPaymentValidation.getProjectAssignmentPayments), projectAssignmentPaymentController.getProjectAssignmentPayments)
  .post(auth(), validate(projectAssignmentPaymentValidation.createProjectAssignmentPayment), projectAssignmentPaymentController.createProjectAssignmentPayment);

// Debug route
router.get('/debug/users-by-role', auth(), projectAssignmentPaymentController.debugUsersByRole);
router.get('/debug/all-payments', auth(), projectAssignmentPaymentController.debugAllPayments);
router.get('/debug/all-site-visits', auth(), projectAssignmentPaymentController.debugAllSiteVisits);
router.post('/test/create-sample', auth(), projectAssignmentPaymentController.createTestPayment);

/**
 * @swagger
 * /v1/project-assignment-payments/{paymentId}:
 *   get:
 *     summary: Get a project assignment payment by ID
 *     description: Retrieve a specific project assignment payment by its ID
 *     tags: [Project Assignment Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentId
 *         required: true
 *         schema:
 *           type: string
 *         description: The payment ID
 *     responses:
 *       200:
 *         description: Project assignment payment details
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
 *                   example: Project assignment payment fetched successfully.
 *                 data:
 *                   $ref: '#/components/schemas/ProjectAssignmentPayment'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Payment not found
 *   patch:
 *     summary: Update a project assignment payment
 *     description: Update an existing project assignment payment
 *     tags: [Project Assignment Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentId
 *         required: true
 *         schema:
 *           type: string
 *         description: The payment ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               assignedAmount:
 *                 type: number
 *                 description: The amount assigned to the user
 *               note:
 *                 type: string
 *                 description: Additional notes about the payment
 *     responses:
 *       200:
 *         description: Project assignment payment updated successfully
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
 *                   example: Project assignment payment updated successfully.
 *                 data:
 *                   $ref: '#/components/schemas/ProjectAssignmentPayment'
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Payment not found
 *   delete:
 *     summary: Delete a project assignment payment
 *     description: Delete a project assignment payment by its ID
 *     tags: [Project Assignment Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentId
 *         required: true
 *         schema:
 *           type: string
 *         description: The payment ID
 *     responses:
 *       204:
 *         description: Project assignment payment deleted successfully
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
 *                   example: Project assignment payment deleted successfully.
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Payment not found
 */

router
  .route('/:paymentId')
  .get(auth(), validate(projectAssignmentPaymentValidation.getProjectAssignmentPayment), projectAssignmentPaymentController.getProjectAssignmentPayment)
  .patch(auth(), validate(projectAssignmentPaymentValidation.updateProjectAssignmentPayment), projectAssignmentPaymentController.updateProjectAssignmentPayment)
  .delete(auth(), validate(projectAssignmentPaymentValidation.deleteProjectAssignmentPayment), projectAssignmentPaymentController.deleteProjectAssignmentPayment);

export default router; 