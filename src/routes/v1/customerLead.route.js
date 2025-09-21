import express from 'express';

import multer from 'multer';
import path from 'path';
import {
  listCustomerLeadsController,
  getCustomerLeadController,
  activateCustomerLeadController,
  deactivateCustomerLeadController,
  updateCustomerLeadStatusController,
  updateCustomerAndProjectsStatusController,
  importCustomerLeadsController,
  downloadSampleCustomerLeadsController,
  exportCustomerLeadsController,
  // updateCustomerLeadController,
  shareRequirementForUserController,
  getSharedRequirementsForUserController,
  getMySharedRequirementsController,
  shareRequirementWithScpUsersController,
  updateScpDataByScpUserController,
  updateScpDataByAdminController,
  getScpUserAssignedRequirementsController,
  deleteFileFromRequirement,
  deleteMultipleFilesFromRequirement,
  updateCustomerStatusWithCascadeController,
  recalculateCustomerStatusController,
  getCustomerStatusSummaryController
} from '../../controllers/customerLead.controller.js';
import { createCustomerLeadService, updateCustomerLeadService } from '../../services/customerLead.service.js';
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
router.get('/import/sample', downloadSampleCustomerLeadsController);

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
 *         name: search
 *         schema:
 *           type: string
 *         description: Search across all fields (customer name, mobile number, email, state, city, lead source, etc.) - case insensitive
 *       - in: query
 *         name: customerName
 *         schema:
 *           type: string
 *         description: Filter by customer name (case insensitive) - for backward compatibility
 *       - in: query
 *         name: leadSource
 *         schema:
 *           type: string
 *         description: Filter by lead source - for backward compatibility
 *       - in: query
 *         name: mobileNumber
 *         schema:
 *           type: string
 *         description: Filter by mobile number (case insensitive) - for backward compatibility
 *       - in: query
 *         name: email
 *         schema:
 *           type: string
 *         description: Filter by email (case insensitive) - for backward compatibility
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *         description: Filter by state (case insensitive) - for backward compatibility
 *       - in: query
 *         name: city
 *         schema:
 *           type: string
 *         description: Filter by city (case insensitive) - for backward compatibility
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
 *         name: search
 *         schema:
 *           type: string
 *         description: Search across all fields (customer name, mobile number, email, state, city, lead source, etc.) - case insensitive
 *       - in: query
 *         name: customerName
 *         schema:
 *           type: string
 *         description: Filter by customer name (case insensitive) - for backward compatibility
 *       - in: query
 *         name: leadSource
 *         schema:
 *           type: string
 *         description: Filter by lead source - for backward compatibility
 *       - in: query
 *         name: mobileNumber
 *         schema:
 *           type: string
 *         description: Filter by mobile number (case insensitive) - for backward compatibility
 *       - in: query
 *         name: email
 *         schema:
 *           type: string
 *         description: Filter by email (case insensitive) - for backward compatibility
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *         description: Filter by state (case insensitive) - for backward compatibility
 *       - in: query
 *         name: city
 *         schema:
 *           type: string
 *         description: Filter by city (case insensitive) - for backward compatibility
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
 * /customer-leads/scp-assigned-requirements:
 *   get:
 *     summary: Get requirements assigned to current SCP user for modification
 *     description: Retrieves all requirements that have been assigned to the current SCP user for SCP data modification, with pagination, filtering, and sorting options
 *     tags: [Customer Leads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [sharedAt:asc, sharedAt:desc, updatedAt:asc, updatedAt:desc, projectName:asc, projectName:desc, customerName:asc, customerName:desc]
 *           default: sharedAt:desc
 *         description: Sort order for the results
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search across project name, customer name, site address, site type, and structure type
 *       - in: query
 *         name: projectName
 *         schema:
 *           type: string
 *         description: Filter by project name
 *       - in: query
 *         name: customerName
 *         schema:
 *           type: string
 *         description: Filter by customer name
 *       - in: query
 *         name: requirementType
 *         schema:
 *           type: string
 *         description: Filter by requirement type
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, updated, all]
 *           default: all
 *         description: Filter by status (pending = not updated yet, updated = already updated)
 *     responses:
 *       200:
 *         description: Requirements assigned to SCP user retrieved successfully
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
 *                   example: SCP user assigned requirements retrieved successfully.
 *                 data:
 *                   type: object
 *                   properties:
 *                     requirements:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           projectName:
 *                             type: string
 *                           requirementType:
 *                             type: string
 *                           requirementDescription:
 *                             type: string
 *                           urgency:
 *                             type: string
 *                           budget:
 *                             type: string
 *                           scpData:
 *                             type: object
 *                           files:
 *                             type: array
 *                           lead:
 *                             type: object
 *                           project:
 *                             type: object
 *                           visits:
 *                             type: array
 *                           scpShare:
 *                             type: object
 *                           status:
 *                             type: string
 *                             enum: [pending, updated]
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                           updatedAt:
 *                             type: string
 *                             format: date-time
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         currentPage:
 *                           type: integer
 *                         totalPages:
 *                           type: integer
 *                         totalRequirements:
 *                           type: integer
 *                         hasNextPage:
 *                           type: boolean
 *                         hasPrevPage:
 *                           type: boolean
 *                         limit:
 *                           type: integer
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  '/scp-assigned-requirements',
  auth('getProjects'),
  validate(customerLeadValidation.getScpUserAssignedRequirements),
  getScpUserAssignedRequirementsController
);


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
 * /customer-leads/{id}/status:
 *   patch:
 *     summary: Update the status of a customer lead
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
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, in_progress, completed, cancelled]
 *                 description: The new status of the customer lead
 *     responses:
 *       200:
 *         description: Customer lead status updated successfully
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
 *                   example: Customer lead status updated successfully.
 *                 data:
 *                   type: object
 *       400:
 *         description: Bad Request (e.g., invalid status)
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Customer lead not found
 */
router.patch(
  '/:id/status',
  auth(),
  validate(customerLeadValidation.updateCustomerLeadStatus),
  updateCustomerLeadStatusController
);

/**
 * @swagger
 * /customer-leads/{id}/status-with-projects:
 *   patch:
 *     summary: Update the status of a customer lead and synchronize all associated projects
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
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [Active, Inactive, Hold, Draft, Complete, InProgress, Cancelled]
 *                 description: The new status of the customer lead
 *     responses:
 *       200:
 *         description: Customer lead and project statuses updated successfully
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
 *                   example: Customer status updated to Active and 3 projects synchronized successfully
 *                 data:
 *                   type: object
 *       400:
 *         description: Bad Request (e.g., invalid status)
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Customer lead not found
 */
router.patch(
  '/:id/status-with-projects',
  auth(),
  validate(customerLeadValidation.updateCustomerLeadStatus),
  updateCustomerAndProjectsStatusController
);

/**
 * @swagger
 * /customer-leads/{id}:
 *   put:
 *     summary: Update a customer lead
 *     description: Update specific fields of a customer lead. Also supports optional updates to associated requirements.
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
 *               isActive:
 *                 type: boolean
 *               requirementsToUpdate:
 *                 type: array
 *                 description: Array of requirement updates
 *                 items:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                       description: Requirement ID to update (must belong to this lead)
 *                     requirementType:
 *                       type: string
 *                     otherRequirement:
 *                       type: string
 *                     requirementDescription:
 *                       type: string
 *                     urgency:
 *                       type: string
 *                     budget:
 *                       type: string
 *                     roomRequirements:
 *                       type: string
 *                     architectStatus:
 *                       type: string
 *                     drawingStatus:
 *                       type: string
 *                     scpRemarks:
 *                       type: string
 *     examples:
 *       application/json:
 *         value:
 *           customerName: "John Doe Updated"
 *           email: "john.doe.updated@example.com"
 *           requirementsToUpdate:
 *             - _id: "64f31a7b7e5d6e001f7e1234"
 *               urgency: "Immediate"
 *               requirementType: "New Construction"
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
  transactional(updateCustomerLeadService)
);

/**
 * @swagger
 * /customer-leads/{leadId}/requirements/{requirementId}/share:
 *   post:
 *     summary: Share a specific requirement with one or more users
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
 *               - userIds
 *             properties:
 *               userIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of user IDs to share the requirement with
 *             example:
 *               userIds: ["64f57c1a7baf4a001f68b111", "64f57c1a7baf4a001f68b222"]
 *     responses:
 *       200:
 *         description: Requirement shared successfully
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
 *                   example: Requirement shared successfully.
 *                 data:
 *                   type: object
 *       400:
 *         description: Bad Request (e.g., already shared with user)
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

/**
 * @swagger
 * /customer-leads/{leadId}/requirements/{requirementId}/share-scp:
 *   post:
 *     summary: Share requirement with multiple SCP users and grant update permissions
 *     description: Allows an admin to share a requirement with multiple SCP users and grant them permission to update SCP data once
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
 *               - scpUserIds
 *             properties:
 *               scpUserIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of SCP user IDs to share with
 *                 minItems: 1
 *             example:
 *               scpUserIds: ["64f57c1a7baf4a001f68b111", "64f57c1a7baf4a001f68b222"]
 *     responses:
 *       200:
 *         description: Requirement shared with SCP users successfully
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
 *                   example: Requirement shared with SCP users successfully.
 *                 data:
 *                   type: object
 *       400:
 *         description: Bad Request (e.g., users are not SCP users)
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Customer lead, requirement, or SCP users not found
 */
router.post(
  '/:leadId/requirements/:requirementId/share-scp',
  auth('manageLeads'),
  validate(customerLeadValidation.shareRequirementWithScpUsers),
  shareRequirementWithScpUsersController
);

/**
 * @swagger
 * /customer-leads/{leadId}/requirements/{requirementId}/update-scp:
 *   patch:
 *     summary: Update SCP data by SCP user (one-time only)
 *     description: Allows an SCP user to update SCP data for a requirement they have been shared with. This can only be done once per requirement.
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
 *         description: The ID of the requirement to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - scpData
 *             properties:
 *               scpData:
 *                 type: object
 *                 description: The updated SCP data
 *                 properties:
 *                   siteAddress:
 *                     type: string
 *                   googleLocationLink:
 *                     type: string
 *                   siteType:
 *                     type: string
 *                   plotSize:
 *                     type: string
 *                   totalArea:
 *                     type: string
 *                   plinthStatus:
 *                     type: string
 *                   structureType:
 *                     type: string
 *                   numUnits:
 *                     type: string
 *                   usageType:
 *                     type: string
 *                   avgStayDuration:
 *                     type: string
 *                   additionalFeatures:
 *                     type: string
 *                   designIdeas:
 *                     type: string
 *                   drawingStatus:
 *                     type: string
 *                   architectStatus:
 *                     type: string
 *                   roomRequirements:
 *                     type: string
 *                   tokenAdvance:
 *                     type: string
 *                   financing:
 *                     type: string
 *                   roadWidth:
 *                     type: string
 *                   targetCompletionDate:
 *                     type: string
 *                   scpRemarks:
 *                     type: string
 *               files:
 *                 type: array
 *                 description: Array of files to be stored in the requirement
 *                 items:
 *                   type: object
 *                   required:
 *                     - fileType
 *                     - key
 *                   properties:
 *                     fileType:
 *                       type: string
 *                       enum: [image, video, voiceMessage, sketch, pdf, document, layoutPlan, 2d drawing, 3d drawing, audio]
 *                       description: Type of the file
 *                     key:
 *                       type: string
 *                       description: S3 key of the uploaded file (from presigned URL upload)
 *                     originalName:
 *                       type: string
 *                       description: Original file name (optional)
 *             example:
 *               scpData:
 *                 siteAddress: "123 Main St, City, State"
 *                 siteType: "Residential"
 *                 plotSize: "2000 sq ft"
 *                 structureType: "Cottage"
 *                 scpRemarks: "Site visit completed, all measurements taken"
 *               files:
 *                 - fileType: "image"
 *                   key: "uploads/tmp/scp-files/some-uuid.jpg"
 *                   originalName: "site-photo-1.jpg"
 *                 - fileType: "pdf"
 *                   key: "uploads/tmp/scp-files/some-uuid.pdf"
 *                   originalName: "site-plan.pdf"
 *                 - fileType: "audio"
 *                   key: "uploads/tmp/scp-files/some-uuid.mp3"
 *                   originalName: "voice-message.mp3"
 *     responses:
 *       200:
 *         description: SCP data updated successfully
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
 *                   example: SCP data updated successfully.
 *                 data:
 *                   type: object
 *       400:
 *         description: Bad Request (e.g., SCP data already updated)
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (e.g., no permission to update SCP data)
 *       404:
 *         description: Customer lead or requirement not found
 */
router.patch(
  '/:leadId/requirements/:requirementId/update-scp',
  auth('getProjects'),
  validate(customerLeadValidation.updateScpDataByScpUser),
  updateScpDataByScpUserController
);

/**
 * @swagger
 * /customer-leads/{leadId}/requirements/{requirementId}/update-scp-admin:
 *   patch:
 *     summary: Update SCP data by admin
 *     description: Allow admin to update SCP data for a requirement (without permission restrictions)
 *     tags: [CustomerLeads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: leadId
 *         required: true
 *         schema:
 *           type: string
 *         description: The lead ID
 *       - in: path
 *         name: requirementId
 *         required: true
 *         schema:
 *           type: string
 *         description: The requirement ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - scpData
 *             properties:
 *               scpData:
 *                 type: object
 *                 description: The SCP data to update
 *                 properties:
 *                   siteAddress:
 *                     type: string
 *                   googleLocationLink:
 *                     type: string
 *                   siteType:
 *                     type: string
 *                   plotSize:
 *                     type: string
 *                   totalArea:
 *                     type: string
 *                   plinthStatus:
 *                     type: string
 *                   structureType:
 *                     type: string
 *                   numUnits:
 *                     type: string
 *                   usageType:
 *                     type: string
 *                   avgStayDuration:
 *                     type: string
 *                   additionalFeatures:
 *                     type: string
 *                   designIdeas:
 *                     type: string
 *                   drawingStatus:
 *                     type: string
 *                   architectStatus:
 *                     type: string
 *                   roomRequirements:
 *                     type: string
 *                   tokenAdvance:
 *                     type: string
 *                   financing:
 *                     type: string
 *                   roadWidth:
 *                     type: string
 *                   targetCompletionDate:
 *                     type: string
 *                   scpRemarks:
 *                     type: string
 *               files:
 *                 type: array
 *                 description: Array of files to be stored in the requirement
 *                 items:
 *                   type: object
 *                   required:
 *                     - fileType
 *                     - key
 *                   properties:
 *                     fileType:
 *                       type: string
 *                       enum: [image, video, voiceMessage, sketch, pdf, document, layoutPlan, 2d drawing, 3d drawing, audio]
 *                       description: Type of the file
 *                     key:
 *                       type: string
 *                       description: S3 key of the uploaded file (from presigned URL upload)
 *                     originalName:
 *                       type: string
 *                       description: Original file name (optional)
 *     responses:
 *       200:
 *         description: SCP data updated successfully by admin
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
 *                   example: SCP data updated successfully by admin.
 *                 data:
 *                   type: object
 *       400:
 *         description: Bad Request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (admin access required)
 *       404:
 *         description: Customer lead or requirement not found
 */
router.patch(
  '/:leadId/requirements/:requirementId/update-scp-admin',
  auth('manageProjects'),
  validate(customerLeadValidation.updateScpDataByScpUser),
  updateScpDataByAdminController
);

/**
 * @route   DELETE /customer-leads/{leadId}/requirements/{requirementId}/files/{fileKey}
 * @desc    Delete a single file from a requirement
 * @access  Private (Admin, SCP User with permissions)
 */
router.delete(
  '/:leadId/requirements/:requirementId/files/:fileKey',
  auth('manageProjects'),
  validate(customerLeadValidation.deleteFile),
  deleteFileFromRequirement
);

/**
 * @route   DELETE /customer-leads/{leadId}/requirements/{requirementId}/files
 * @desc    Delete multiple files from a requirement (bulk deletion)
 * @access  Private (Admin, SCP User with permissions)
 */
router.delete(
  '/:leadId/requirements/:requirementId/files',
  auth('manageProjects'),
  validate(customerLeadValidation.deleteMultipleFiles),
  deleteMultipleFilesFromRequirement
);

/**
 * @swagger
 * /customer-leads/{id}/status:
 *   patch:
 *     summary: Update the status of a customer lead
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
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, in_progress, completed, cancelled]
 *                 description: The new status of the customer lead
 *     responses:
 *       200:
 *         description: Customer lead status updated successfully
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
 *                   example: Customer lead status updated successfully.
 *                 data:
 *                   type: object
 *       400:
 *         description: Bad Request (e.g., invalid status)
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Customer lead not found
 */
router.patch(
  '/:id/status',
  auth(),
  validate(customerLeadValidation.updateCustomerLeadStatus),
  updateCustomerLeadStatusController
);

/**
 * @swagger
 * /customer-leads/{id}/status-cascade:
 *   patch:
 *     summary: Update customer status with cascade to all projects
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
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [active, inactive, inprogress, complete, draft, close]
 *                 description: The new status for customer and all projects
 *     responses:
 *       200:
 *         description: Customer and project statuses updated successfully
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
 *                   example: Customer status updated to active. 3 projects also updated.
 *                 data:
 *                   type: object
 *       400:
 *         description: Bad Request (e.g., invalid status)
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Customer lead not found
 */
router.patch(
  '/:id/status-cascade',
  auth(),
  validate(customerLeadValidation.updateCustomerStatusWithCascade),
  updateCustomerStatusWithCascadeController
);

/**
 * @swagger
 * /customer-leads/{id}/status-recalculate:
 *   post:
 *     summary: Recalculate customer status based on project statuses
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
 *     responses:
 *       200:
 *         description: Customer status recalculated successfully
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
 *                   example: Customer status recalculated to active based on 3 projects.
 *                 data:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Customer lead not found
 */
router.post(
  '/:id/status-recalculate',
  auth(),
  validate(customerLeadValidation.recalculateCustomerStatus),
  recalculateCustomerStatusController
);

/**
 * @swagger
 * /customer-leads/{id}/status-summary:
 *   get:
 *     summary: Get customer status summary with project breakdown
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
 *     responses:
 *       200:
 *         description: Customer status summary retrieved successfully
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
 *                   example: Customer status summary retrieved successfully.
 *                 data:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Customer lead not found
 */
router.get(
  '/:id/status-summary',
  auth(),
  validate(customerLeadValidation.getCustomerStatusSummary),
  getCustomerStatusSummaryController
);

export default router;