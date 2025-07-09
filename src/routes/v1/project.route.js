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
    .route('/architect/my-projects')
    .get(
        auth('getProjects'),
        validate(projectValidation.getProjectsForArchitect),
        projectController.getProjectsForArchitect
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

router
    .route('/:projectId/architect-documents/:documentId/send-to-procurement')
    .post(auth('manageProjects'), validate(projectValidation.sendDocumentToProcurement), projectController.sendDocumentToProcurement);

router
    .route('/approved-documents/procurement')
    .get(
        auth('getProjects'),
        validate(projectValidation.getApprovedDocumentsForProcurement),
        projectController.getApprovedDocumentsForProcurement
    );

router
    .route('/procurement/my-projects')
    .get(
        auth('getProjects'),
        validate(projectValidation.getProjectsForProcurement),
        projectController.getProjectsForProcurement
    );

router
    .route('/procurement/:projectId/documents')
    .get(
        auth('getProjects'),
        validate(projectValidation.getProjectDocumentsForProcurement),
        projectController.getProjectDocumentsForProcurement
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
 *         description: Customer projects fetched successfully
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
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */

/**
 * @swagger
 * /projects/architect/my-projects:
 *   get:
 *     summary: Get projects for the logged-in architect
 *     description: Fetch all projects assigned to the currently authenticated architect, with pagination and sorting.
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
 *         description: Architect projects fetched successfully
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
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
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

/**
 * @swagger
 * /projects/{projectId}/architect-documents/{documentId}/send-to-procurement:
 *   post:
 *     summary: Send approved architect document to procurement
 *     description: |
 *       Allows an admin to send an architect document that has been approved by both admin and customer to the procurement team.
 *       The document must have both adminStatus and customerStatus as 'Approved' before it can be sent to procurement.
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
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the architect document.
 *     responses:
 *       "200":
 *         description: Document sent to procurement successfully
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
 *                   example: "Document sent to procurement successfully."
 *                 data:
 *                   $ref: '#/components/schemas/Project'
 *       "400":
 *         description: Bad Request - Document not approved by admin and/or customer, or already sent to procurement
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */

/**
 * @swagger
 * /projects/approved-documents/procurement:
 *   get:
 *     summary: Get approved architect documents for procurement team
 *     description: |
 *       Retrieve all architect documents that have been approved by both admin and customer and sent to procurement.
 *       This endpoint is specifically for the procurement team to view documents ready for BOM creation and procurement activities.
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: projectName
 *         schema:
 *           type: string
 *         description: Filter by project name (partial match)
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
 *           example: procurementSentAt:desc
 *         description: Sorting order (e.g., procurementSentAt:desc, projectName:asc)
 *     responses:
 *       "200":
 *         description: Approved documents for procurement fetched successfully
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
 *                   example: "Approved documents for procurement fetched successfully."
 *                 data:
 *                   type: object
 *                   properties:
 *                     results:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                             description: Project ID
 *                           projectName:
 *                             type: string
 *                           projectCode:
 *                             type: string
 *                           lead:
 *                             type: object
 *                             properties:
 *                               _id:
 *                                 type: string
 *                               customerName:
 *                                 type: string
 *                               email:
 *                                 type: string
 *                               mobileNumber:
 *                                 type: string
 *                           architect:
 *                             type: object
 *                             properties:
 *                               _id:
 *                                 type: string
 *                               name:
 *                                 type: string
 *                               email:
 *                                 type: string
 *                           requirement:
 *                             type: object
 *                             properties:
 *                               _id:
 *                                 type: string
 *                               requirementType:
 *                                 type: string
 *                           document:
 *                             type: object
 *                             properties:
 *                               _id:
 *                                 type: string
 *                               files:
 *                                 type: array
 *                                 items:
 *                                   $ref: '#/components/schemas/FileSchema'
 *                               notes:
 *                                 type: string
 *                               adminStatus:
 *                                 type: string
 *                                 enum: [Approved]
 *                               customerStatus:
 *                                 type: string
 *                                 enum: [Approved]
 *                               adminRemarks:
 *                                 type: string
 *                               customerRemarks:
 *                                 type: string
 *                               version:
 *                                 type: number
 *                               submittedAt:
 *                                 type: string
 *                                 format: date-time
 *                               procurementSentAt:
 *                                 type: string
 *                                 format: date-time
 *                               architect:
 *                                 type: object
 *                                 description: Document architect details
 *                               sentToProcurementBy:
 *                                 type: object
 *                                 description: Admin who sent to procurement
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *                     totalResults:
 *                       type: integer
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 */

/**
 * @swagger
 * /projects/procurement/my-projects:
 *   get:
 *     summary: Get projects for procurement team
 *     description: |
 *       Retrieve all projects that have been shared with the current procurement team member.
 *       Only shows basic project information like name, code, status, customer details, and requirement type.
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
 *       "200":
 *         description: Projects for procurement fetched successfully
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
 *                   example: "Projects for procurement fetched successfully."
 *                 data:
 *                   type: object
 *                   properties:
 *                     results:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           projectName:
 *                             type: string
 *                           projectCode:
 *                             type: string
 *                           status:
 *                             type: string
 *                             enum: [Draft, Pending, Active, OnHold, Completed, Cancelled]
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                           lead:
 *                             type: object
 *                             properties:
 *                               customerName:
 *                                 type: string
 *                               email:
 *                                 type: string
 *                               mobileNumber:
 *                                 type: string
 *                           requirement:
 *                             type: object
 *                             properties:
 *                               requirementType:
 *                                 type: string
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *                     totalResults:
 *                       type: integer
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 */

/**
 * @swagger
 * /projects/procurement/{projectId}/documents:
 *   get:
 *     summary: Get architect documents for a specific project (procurement team)
 *     description: |
 *       Retrieve all approved architect documents for a specific project that the procurement team has access to.
 *       Only shows documents that have been approved by both admin and customer.
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
 *         description: Project documents for procurement fetched successfully
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
 *                   example: "Project documents for procurement fetched successfully."
 *                 data:
 *                   type: object
 *                   properties:
 *                     project:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                         projectName:
 *                           type: string
 *                         projectCode:
 *                           type: string
 *                         status:
 *                           type: string
 *                         lead:
 *                           type: object
 *                           properties:
 *                             customerName:
 *                               type: string
 *                             email:
 *                               type: string
 *                             mobileNumber:
 *                               type: string
 *                         requirement:
 *                           type: object
 *                           properties:
 *                             requirementType:
 *                               type: string
 *                     documents:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           files:
 *                             type: array
 *                             items:
 *                               $ref: '#/components/schemas/FileSchema'
 *                           notes:
 *                             type: string
 *                           adminStatus:
 *                             type: string
 *                             enum: [Approved]
 *                           customerStatus:
 *                             type: string
 *                             enum: [Approved]
 *                           adminRemarks:
 *                             type: string
 *                           customerRemarks:
 *                             type: string
 *                           version:
 *                             type: number
 *                           submittedAt:
 *                             type: string
 *                             format: date-time
 *                           architect:
 *                             type: object
 *                             properties:
 *                               name:
 *                                 type: string
 *                               email:
 *                                 type: string
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */
