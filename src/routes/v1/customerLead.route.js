import express from 'express';

import multer from 'multer';
import path from 'path';
import {
  listCustomerLeadsController,
  getCustomerLeadController,
  activateCustomerLeadController,
  deactivateCustomerLeadController,
  importCustomerLeadsController,
  exportCustomerLeadsController,
  updateCustomerLeadController,
  shareRequirementForUserController,
  getSharedRequirementsForUserController,
  getMySharedRequirementsController,
} from '../../controllers/customerLead.controller.js';
import { createCustomerLeadService } from '../../services/customerLead.service.js';
import auth from '../../middlewares/auth.js';
import { transactional } from '../../utils/transactional.js';
import * as customerLeadValidation from '../../validations/customerLead.validation.js';
import validate from '../../middlewares/validate.js';

// Multer configuration for spreadsheet imports
const importStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/imports/');
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-spreadsheet${ext}`);
  },
});

const upload = multer({ storage: importStorage });

const router = express.Router();

/**
 * @swagger
 * /customer-leads/import/sample:
 *   get:
 *     summary: Download a sample CSV for importing customer leads
 *     tags: [Customer Leads]
 *     responses:
 *       200:
 *         description: A sample CSV file.
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get('/import/sample', (req, res) => {
  const filePath = path.join(process.cwd(), 'src/docs/customer_leads_sample.csv');
  res.download(filePath);
});

/**
 * @swagger
 * /customer-leads/export:
 *   get:
 *     summary: Export customer leads to an Excel file
 *     tags: [Customer Leads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: customerName
 *         schema:
 *           type: string
 *         description: Filter by customer name (case insensitive)
 *       - in: query
 *         name: leadSource
 *         schema:
 *           type: string
 *         description: Filter by lead source
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: string
 *           enum: [true, false]
 *         description: Filter by active status
 *     responses:
 *       200:
 *         description: An Excel file containing the customer leads.
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: Unauthorized.
 *       403:
 *         description: Forbidden. User does not have export rights.
 *       404:
 *         description: No leads found for the selected criteria.
 */
router.get('/export', auth(), exportCustomerLeadsController);

/**
 * @swagger
 * /customer-leads/import:
 *   post:
 *     summary: Import customer leads from a spreadsheet
 *     tags: [Customer Leads]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               spreadsheet:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Leads imported successfully.
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
 *                 importedCount:
 *                   type: integer
 *       207:
 *         description: Leads imported with some errors.
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
 *                 importedCount:
 *                   type: integer
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 *       400:
 *         description: Bad request, e.g., no file uploaded.
 */
router.post('/import', upload.single('spreadsheet'), importCustomerLeadsController);

/**
 * @swagger
 * /customer-leads:
 *   post:
 *     summary: Submit customer lead data
 *     tags: [Customer Leads]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/NewCustomerLead'
 *     responses:
 *       201:
 *         description: Lead submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 1
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/CustomerLead'
 *       400:
 *         description: Invalid input
 */
router.post('/', auth(), validate(customerLeadValidation.createCustomerLead), transactional(createCustomerLeadService));

/**
 * @swagger
 * /customer-leads:
 *   get:
 *     summary: Get list of customer leads
 *     tags: [Customer Leads]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *         description: Field to sort by (e.g., createdAt:desc, customerName:asc)
 *       - in: query
 *         name: customerName
 *         schema:
 *           type: string
 *         description: Filter by customer name (case insensitive)
 *       - in: query
 *         name: leadSource
 *         schema:
 *           type: string
 *         description: Filter by lead source
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: string
 *           enum: [true, false]
 *         description: Filter by active status (true for active, false for inactive)
 *     responses:
 *       200:
 *         description: List of customer leads
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                 totalResults:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 */
router.get('/', listCustomerLeadsController);

/**
 * @swagger
 * /customer-leads/{id}:
 *   get:
 *     summary: Get a specific customer lead by ID
 *     tags: [Customer Leads]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The customer lead ID
 *     responses:
 *       200:
 *         description: Customer lead details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 leadSource:
 *                   type: string
 *                 customerName:
 *                   type: string
 *                 mobileNumber:
 *                   type: string
 *                 whatsappNumber:
 *                   type: string
 *                 email:
 *                   type: string
 *                 preferredLanguage:
 *                   type: string
 *                 state:
 *                   type: string
 *                 city:
 *                   type: string
 *                 googleLocationLink:
 *                   type: string
 *                 requirementType:
 *                   type: string
 *                 otherRequirement:
 *                   type: string
 *                 requirementDescription:
 *                   type: string
 *                 urgency:
 *                   type: string
 *                 budget:
 *                   type: string
 *                 hasDrawing:
 *                   type: boolean
 *                 needsArchitect:
 *                   type: boolean
 *                 samplePhotoUrl:
 *                   type: string
 *                 requestSiteVisit:
 *                   type: boolean
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *       404:
 *         description: Customer lead not found
 */
router.get('/:id', getCustomerLeadController);

/**
 * @swagger
 * /customer-leads/{id}/activate:
 *   patch:
 *     summary: Activate a customer lead
 *     tags: [Customer Leads]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The customer lead ID
 *     responses:
 *       200:
 *         description: The lead has been activated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 lead:
 *                   type: object
 *                   properties:
 *                     isActive:
 *                       type: boolean
 *       404:
 *         description: Customer lead not found
 */
router.patch('/:id/activate', activateCustomerLeadController);

/**
 * @swagger
 * /customer-leads/{id}/deactivate:
 *   patch:
 *     summary: Deactivate a customer lead
 *     tags: [Customer Leads]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The customer lead ID
 *     responses:
 *       200:
 *         description: The lead has been deactivated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 lead:
 *                   type: object
 *                   properties:
 *                     isActive:
 *                       type: boolean
 *       404:
 *         description: Customer lead not found
 */
router.patch('/:id/deactivate', deactivateCustomerLeadController);

/**
 * @swagger
 * /customer-leads/{id}:
 *   put:
 *     summary: Update a customer lead
 *     description: Update specific fields of a customer lead. Only provided fields will be updated.
 *     tags: [Customer Leads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The customer lead ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               leadSource:
 *                 type: string
 *               customerName:
 *                 type: string
 *               mobileNumber:
 *                 type: string
 *               whatsappNumber:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               preferredLanguage:
 *                 type: string
 *               state:
 *                 type: string
 *               city:
 *                 type: string
 *               googleLocationLink:
 *                 type: string
 *                 format: uri
 *               requirementType:
 *                 type: string
 *               otherRequirement:
 *                 type: string
 *               requirementDescription:
 *                 type: string
 *               urgency:
 *                 type: string
 *               budget:
 *                 type: string
 *               hasDrawing:
 *                 type: boolean
 *               needsArchitect:
 *                 type: boolean
 *               requestSiteVisit:
 *                 type: boolean
 *               isActive:
 *                 type: boolean
 *             example:
 *               customerName: "John Doe Updated"
 *               email: "john.doe.updated@example.com"
 *     responses:
 *       200:
 *         description: Customer lead updated successfully
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
 *                   example: Customer lead updated successfully.
 *                 data:
 *                   type: object
 *       400:
 *         description: Bad Request (e.g., validation error)
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Customer lead not found
 */
router.put(
  '/:id',
  auth(),
  validate(customerLeadValidation.updateCustomerLead),
  transactional(updateCustomerLeadController)
);

/**
 * @swagger
 * /customer-leads/{leadId}/requirements/{requirementId}/share:
 *   post:
 *     summary: Share a specific requirement with a user
 *     tags: [Customer Leads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: leadId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the customer lead
 *       - in: path
 *         name: requirementId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the requirement to share
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 description: The ID of the user to share the requirement with
 *     responses:
 *       200:
 *         description: Requirement shared successfully
 *       400:
 *         description: Bad Request (e.g., already shared with this user)
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Customer lead or requirement not found
 */
router.post(
  '/:leadId/requirements/:requirementId/share',
  auth('manageLeads'),
  validate(customerLeadValidation.shareRequirement),
  shareRequirementForUserController
);

/**
 * @swagger
 * /customer-leads/shared-with/{userId}:
 *   get:
 *     summary: Get all requirements shared with a specific user
 *     tags: [Customer Leads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the user
 *     responses:
 *       200:
 *         description: A list of shared requirements
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 1
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  '/shared-with/:userId',
  auth('manageLeads'), // Or a more specific permission
  getSharedRequirementsForUserController
);

export default router;
