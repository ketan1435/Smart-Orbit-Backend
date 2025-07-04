import express from 'express';
import auth from '../../middlewares/auth.js';
import validate from '../../middlewares/validate.js';
import * as projectValidation from '../../validations/project.validation.js';
import * as projectController from '../../controllers/project.controller.js';
import { transactional } from '../../utils/transactional.js';
// const projectValidation = require('../../validations/project.validation');
// const projectController = require('../../controllers/project.controller');

const router = express.Router();

router
    .route('/')
    .get(auth('getProjects'), validate(projectValidation.getProjects), projectController.getProjects);

router
    .route('/customer/my-projects')
    .get(
        auth('getProjects'),
        validate(projectValidation.getProjectsForCustomer),
        projectController.getProjectsForCustomer
    );

router
    .route('/:projectId/visits')
    .get(auth('getProjects'), validate(projectValidation.getProjectSiteVisits), projectController.getProjectSiteVisits);

router
    .route('/:projectId/proposals')
    .post(auth('manageProjects'), validate(projectValidation.submitProposal), projectController.submitProposal)
    .get(auth('getProjects'), validate(projectValidation.getProposals), projectController.getProposalsForProject);

router
    .route('/:projectId/proposals/:proposalId/accept')
    .patch(auth('manageProjects'), validate(projectValidation.acceptProposal), projectController.acceptProposal);

router
    .route('/:projectId/architect-documents')
    .post(auth('manageProjects'), validate(projectValidation.submitArchitectDocument), transactional(projectController.submitArchitectDocument))
    .get(auth('getProjects'), projectController.getArchitectDocuments);

router
    .route('/:projectId/architect-documents/:documentId/admin-review')
    .patch(auth('manageProjects'), validate(projectValidation.reviewArchitectDocument), projectController.reviewArchitectDocument);

router
    .route('/:projectId/architect-documents/:documentId/send-to-customer')
    .post(auth('manageProjects'), validate(projectValidation.sendDocumentToCustomer), projectController.sendDocumentToCustomer);

router
    .route('/:projectId/architect-documents/:documentId/customer-review')
    .patch(auth('getProjects'), validate(projectValidation.customerReviewDocument), projectController.customerReviewDocument);

router
    .route('/:projectId/architect-documents/customer')
    .get(
        auth('getProjects'),
        validate(projectValidation.getArchitectDocumentsForCustomer),
        projectController.getArchitectDocumentsForCustomer
    );

// Define project routes here later
// For example:
// router
//   .route('/')
//   .get(auth('getProjects'), validate(projectValidation.getProjects), projectController.getProjects)
//   .post(auth('manageProjects'), validate(projectValidation.createProject), projectController.createProject);

export default router;

/**
 * @swagger
 * tags:
 *   name: Projects
 *   description: Project management and retrieval
 */

/**
 * @swagger
 * /projects:
 *   get:
 *     summary: Get a list of projects
 *     description: Fetch all projects with optional filters, pagination, and sorting.
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: projectName
 *         schema:
 *           type: string
 *         description: Filter projects by name (partial match)
 *       - in: query
 *         name: projectCode
 *         schema:
 *           type: string
 *         description: Filter by project code
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [Draft, Pending, Active, OnHold, Completed, Cancelled]
 *         description: Filter by project status
 *       - in: query
 *         name: customerName
 *         schema:
 *           type: string
 *         description: Filter by customer name (partial match from CustomerLead)
 *       - in: query
 *         name: requirementType
 *         schema:
 *           type: string
 *         description: Filter by type of requirement
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of results per page
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           example: createdAt:desc
 *         description: Sorting order (e.g., createdAt:desc, projectName:asc)
 *     responses:
 *       200:
 *         description: List of projects
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
 *                   example: Projects fetched successfully.
 *                 data:
 *                   type: object
 *                   properties:
 *                     results:
 *                       type: array
 *                       items:
 *                         type: object
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *                     totalResults:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /projects/customer/my-projects:
 *   get:
 *     summary: Get projects for the logged-in customer
 *     description: Fetch all projects associated with the currently authenticated customer, with pagination and sorting.
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of results per page
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           example: createdAt:desc
 *         description: Sorting order (e.g., createdAt:desc, projectName:asc)
 *     responses:
 *       200:
 *         description: List of projects for the customer
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
 *                   example: Your projects fetched successfully.
 *                 data:
 *                   type: object
 *                   properties:
 *                     results:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Project'
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *                     totalResults:
 *                       type: integer
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */


/**
 * @swagger
 * /projects/{projectId}/visits:
 *   get:
 *     summary: Get site visits for a specific project
 *     description: Retrieves a paginated list of site visits associated with a specific project.
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the project.
 *       - in: query
 *         name: siteEngineer
 *         schema:
 *           type: string
 *         description: ID of the site engineer to filter by.
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [Scheduled, InProgress, Completed, Cancelled, Outdated]
 *         description: Filter visits by their status.
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of visits to return per page.
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           example: 'visitDate:desc'
 *         description: Sort order for the results. Format is field:order (e.g., createdAt:asc).
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SiteVisitPaginated'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */

/**
 * @swagger
 * /projects/{projectId}/proposals:
 *   get:
 *     summary: Get all proposals for a project
 *     description: Allows an admin to retrieve a list of all proposals submitted for a specific project, with architect details populated.
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the project.
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ArchitectProposal'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *   post:
 *     summary: Submit a proposal for a project
 *     description: Allows an architect to submit their proposal for a specific project. An architect can only submit one proposal per project.
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the project to submit the proposal for.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName:
 *                 type: string
 *                 example: "Priya Deshmukh"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "priya.architect@gmail.com"
 *               proposedCharges:
 *                 type: number
 *                 example: 8500
 *               deliveryTimelineDays:
 *                 type: number
 *                 example: 4
 *               portfolioLink:
 *                 type: string
 *                 format: uri
 *                 example: "https://drive.google.com/..."
 *               remarks:
 *                 type: string
 *                 example: "This proposal includes 3 design revisions and on-site consultation."
 *     responses:
 *       "201":
 *         description: Proposal Submitted Successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Project'
 *       "400":
 *         description: "Bad Request (e.g., validation error, proposal already exists)"
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */

/**
 * @swagger
 * /projects/{projectId}/proposals/{proposalId}/accept:
 *   patch:
 *     summary: Accept an architect's proposal
 *     description: Allows an admin to accept a specific proposal for a project. This will mark the chosen proposal as 'Accepted' and all other pending proposals for the same project as 'Rejected'.
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the project.
 *       - in: path
 *         name: proposalId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the proposal to accept.
 *     responses:
 *       "200":
 *         description: Proposal Accepted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Project'
 *       "400":
 *         description: "Bad Request (e.g., proposal already actioned)"
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */

/**
 * @swagger
 * /projects/{projectId}/architect-documents:
 *   post:
 *     summary: Submit architect documents for a project
 *     description: |
 *       Allows an architect to submit documents with notes for admin review.
 *       
 *       **Note:** This endpoint follows a two-phase upload process:
 *       1. First, use the `/api/v1/files/initiate-upload` endpoint to get presigned URLs for each file
 *       2. Upload the files directly to S3 using the presigned URLs
 *       3. Then call this endpoint with the file keys obtained from step 1
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the project.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes:
 *                 type: string
 *                 example: "These are the final design documents for the project."
 *               files:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - fileType
 *                     - key
 *                   properties:
 *                     fileType:
 *                       type: string
 *                       enum: [image, video, sketch, pdf, document]
 *                       example: "pdf"
 *                     key:
 *                       type: string
 *                       description: The temporary S3 key received from the initiate-upload endpoint
 *                       example: "uploads/tmp/architect-documents/uuid-filename.pdf"
 *     responses:
 *       "201":
 *         description: Documents submitted successfully
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *   get:
 *     summary: Get all architect documents for a project
 *     description: Retrieve all architect documents submitted for a project.
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the project.
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ArchitectDocument'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */
