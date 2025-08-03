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
    .route('/architect/my-proposals')
    .get(
        auth('getProjects'),
        validate(projectValidation.getMyProposals),
        projectController.getMyProposals
    );

router
    .route('/architect/proposals/:proposalId')
    .delete(
        auth('getProjects'),
        validate(projectValidation.deleteMyProposal),
        projectController.deleteMyProposal
    );

router
    .route('/proposals/:proposalId/reject')
    .patch(
        auth('manageProjects'),
        validate(projectValidation.rejectProposal),
        projectController.rejectProposal
    );


/**
 * @swagger
 * /projects/my-sitework-projects:
 *   get:
 *     summary: Get projects where the authenticated user is assigned in any sitework
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
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
 *     responses:
 *       200:
 *         description: My sitework projects retrieved successfully
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
 *                   example: My sitework projects retrieved successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       projectName:
 *                         type: string
 *                       projectCode:
 *                         type: string
 *                       status:
 *                         type: string
 *                       startDate:
 *                         type: string
 *                         format: date-time
 *                       estimatedCompletionDate:
 *                         type: string
 *                         format: date-time
 *                       budget:
 *                         type: string
 *                       lead:
 *                         type: object
 *                         properties:
 *                           customerName:
 *                             type: string
 *                           mobileNumber:
 *                             type: string
 *                 page:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 total:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 */
router.get('/my-sitework-projects', auth(), projectController.getMySiteworkProjects);

router
    .route('/:projectId')
    .get(auth('getProjects'), projectController.getProjectById);

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

// Add these routes before the export statement

/**
 * @swagger
 * /projects/{projectId}/assign-site-engineers:
 *   post:
 *     summary: Assign site engineers to a project
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: The project ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - siteEngineerIds
 *             properties:
 *               siteEngineerIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of site engineer user IDs
 *           example:
 *             siteEngineerIds: ["64f31a7b7e5d6e001f7e1234", "64f31a7b7e5d6e001f7e5678"]
 *     responses:
 *       200:
 *         description: Site engineers assigned successfully
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
 *                   example: Site engineers assigned successfully
 *                 data:
 *                   type: object
 *       404:
 *         description: Project not found
 */
router
    .route('/:projectId/assign-site-engineers')
    .post(auth('manageProjects'), projectController.assignSiteEngineers);

/**
 * @swagger
 * /projects/{projectId}/assigned-site-engineers:
 *   get:
 *     summary: Get assigned site engineers for a project
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: The project ID
 *     responses:
 *       200:
 *         description: Assigned site engineers retrieved successfully
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
 *                   example: Assigned site engineers retrieved successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       email:
 *                         type: string
 *                       role:
 *                         type: string
 *       404:
 *         description: Project not found
 */
router
    .route('/:projectId/assigned-site-engineers')
    .get(auth('getProjects'), projectController.getAssignedSiteEngineers);

// Add this route after the existing routes

/**
 * @swagger
 * /projects/site-engineer/my-assigned-projects:
 *   get:
 *     summary: Get assigned projects for the authenticated site engineer
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [Draft, Pending, Active, OnHold, Completed, Cancelled]
 *         description: Filter by project status
 *     responses:
 *       200:
 *         description: Assigned projects retrieved successfully
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
 *                   example: My assigned projects retrieved successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       projectName:
 *                         type: string
 *                       projectCode:
 *                         type: string
 *                       status:
 *                         type: string
 *                       startDate:
 *                         type: string
 *                         format: date-time
 *                       estimatedCompletionDate:
 *                         type: string
 *                         format: date-time
 *                       budget:
 *                         type: string
 *                       lead:
 *                         type: object
 *                         properties:
 *                           customerName:
 *                             type: string
 *                           mobileNumber:
 *                             type: string
 *                 page:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 total:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 */
router
    .route('/site-engineer/my-assigned-projects')
    .get(auth('getProjects'), projectController.getMyAssignedProjects);

// Define project routes here later
// For example:
// router
//   .route('/')
//   .get(auth('getProjects'), validate(projectValidation.getProjects), projectController.getProjects)
//   .post(auth('manageProjects'), validate(projectValidation.createProject), projectController.createProject);

/**
 * @swagger
 * /projects/{projectId}/status:
 *   patch:
 *     summary: Update project status manually (Admin only)
 *     description: Allows an admin to manually change the project status to any valid status
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the project to update
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
 *                 enum: [Draft, Pending, Open, OnHold, Completed, Cancelled]
 *                 description: The new status for the project
 *           example:
 *             status: "Active"
 *     responses:
 *       200:
 *         description: Project status updated successfully
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
 *                   example: Project status updated successfully
 *                 data:
 *                   $ref: '#/components/schemas/Project'
 *       400:
 *         description: Bad Request - Invalid status value
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Only admins can update project status
 *       404:
 *         description: Project not found
 */
router
    .route('/:projectId/status')
    .patch(auth('updateProjectStatus'), validate(projectValidation.updateProjectStatus), projectController.updateProjectStatus);

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
 *     summary: Get projects assigned to the authenticated architect
 *     description: Retrieves all projects where the authenticated user is assigned as the architect
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
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
 *         description: "Sort option in the format: field:(desc|asc)"
 *     responses:
 *       200:
 *         description: Architect projects retrieved successfully
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
 *                   example: Your projects fetched successfully
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
 */

/**
 * @swagger
 * /projects/architect/my-proposals:
 *   get:
 *     summary: Get proposals submitted by the authenticated architect
 *     description: Retrieves all proposals submitted by the authenticated architect across all projects with filtering and pagination
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
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
 *         description: "Sort option in the format: field:(desc|asc)"
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [Pending, Open, Responded, Withdrawn, Expired, Accepted, Rejected, Archived]
 *         description: Filter by proposal status
 *       - in: query
 *         name: projectName
 *         schema:
 *           type: string
 *         description: Filter by project name (case-insensitive search)
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter proposals submitted from this date (ISO format)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter proposals submitted until this date (ISO format)
 *     responses:
 *       200:
 *         description: Architect proposals retrieved successfully
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
 *                   example: Your proposals fetched successfully
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
 *                             description: Proposal ID
 *                           project:
 *                             type: object
 *                             properties:
 *                               _id:
 *                                 type: string
 *                               projectName:
 *                                 type: string
 *                               projectCode:
 *                                 type: string
 *                               status:
 *                                 type: string
 *                               lead:
 *                                 type: object
 *                                 properties:
 *                                   customerName:
 *                                     type: string
 *                                   mobileNumber:
 *                                     type: string
 *                                   email:
 *                                     type: string
 *                                   state:
 *                                     type: string
 *                                   city:
 *                                     type: string
 *                               requirement:
 *                                 type: object
 *                                 properties:
 *                                   requirementType:
 *                                     type: string
 *                                   projectName:
 *                                     type: string
 *                           architect:
 *                             type: object
 *                             properties:
 *                               _id:
 *                                 type: string
 *                               name:
 *                                 type: string
 *                               email:
 *                                 type: string
 *                           email:
 *                             type: string
 *                           proposedCharges:
 *                             type: number
 *                           deliveryTimelineDays:
 *                             type: number
 *                           portfolioLink:
 *                             type: string
 *                           remarks:
 *                             type: string
 *                           status:
 *                             type: string
 *                             enum: [Pending, Open, Responded, Withdrawn, Expired, Accepted, Rejected, Archived]
 *                           submittedAt:
 *                             type: string
 *                             format: date-time
 *                           acceptedAt:
 *                             type: string
 *                             format: date-time
 *                           rejectedAt:
 *                             type: string
 *                             format: date-time
 *                           withdrawnAt:
 *                             type: string
 *                             format: date-time
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *                     totalResults:
 *                       type: integer
 *       400:
 *         description: Bad Request - Invalid filter parameters
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 0
 *                 message:
 *                   type: string
 *                   example: Invalid filter parameters
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */

/**
 * @swagger
 * /projects/{projectId}:
 *   get:
 *     summary: Get a project by its ID
 *     description: Fetch a single project by its unique ID, including populated lead, architect, and requirement fields.
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the project to fetch.
 *     responses:
 *       200:
 *         description: Project fetched successfully
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
 *                   example: Project fetched successfully.
 *                 data:
 *                   $ref: '#/components/schemas/Project'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Project not found
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
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                     description: Document ID
 *                   architect:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       email:
 *                         type: string
 *                       phone:
 *                         type: string
 *                       role:
 *                         type: string
 *                   files:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         fileType:
 *                           type: string
 *                         key:
 *                           type: string
 *                         uploadedAt:
 *                           type: string
 *                           format: date-time
 *                   notes:
 *                     type: string
 *                   adminStatus:
 *                     type: string
 *                     enum: [Pending, Approved, Rejected]
 *                   customerStatus:
 *                     type: string
 *                     enum: [Pending, Approved, Rejected]
 *                   adminRemarks:
 *                     type: string
 *                   customerRemarks:
 *                     type: string
 *                   sentToCustomer:
 *                     type: boolean
 *                   sentToProcurement:
 *                     type: boolean
 *                   procurementSentAt:
 *                     type: string
 *                     format: date-time
 *                   sentToProcurementBy:
 *                     type: string
 *                   submittedAt:
 *                     type: string
 *                     format: date-time
 *                   adminReviewedAt:
 *                     type: string
 *                     format: date-time
 *                   customerReviewedAt:
 *                     type: string
 *                     format: date-time
 *                   version:
 *                     type: number
 *                   isSharedWithAnyProcurementTeam:
 *                     type: boolean
 *                     description: Indicates if the document has been shared with any procurement team
 *                     example: true
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

/**
 * @swagger
 * /projects/architect/proposals/{proposalId}:
 *   delete:
 *     summary: Delete a proposal submitted by the authenticated architect
 *     description: Allows an architect to delete their own proposal, but only if the proposal status is 'Pending'
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: proposalId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the proposal to delete
 *     responses:
 *       200:
 *         description: Proposal deleted successfully
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
 *                   example: Proposal deleted successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     deletedProposalId:
 *                       type: string
 *                       description: The ID of the deleted proposal
 *                     projectId:
 *                       type: string
 *                       description: The ID of the project that contained the proposal
 *                     projectName:
 *                       type: string
 *                       description: The name of the project
 *       400:
 *         description: Bad Request - Cannot delete proposal with current status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 0
 *                 message:
 *                   type: string
 *                   example: "Cannot delete proposal with status 'Accepted'. Only pending proposals can be deleted."
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not Found - Proposal not found or no permission
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 0
 *                 message:
 *                   type: string
 *                   example: "Proposal not found or you do not have permission to delete it"
 */

/**
 * @swagger
 * /projects/proposals/{proposalId}/reject:
 *   patch:
 *     summary: Reject a proposal by admin
 *     description: Allows an admin to reject an architect proposal with optional remarks
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: proposalId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the proposal to reject
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               remarks:
 *                 type: string
 *                 description: Optional remarks for the rejection
 *             example:
 *               remarks: "Proposal does not meet the project requirements"
 *     responses:
 *       200:
 *         description: Proposal rejected successfully
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
 *                   example: Proposal rejected successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     proposalId:
 *                       type: string
 *                       description: The ID of the rejected proposal
 *                     projectId:
 *                       type: string
 *                       description: The ID of the project
 *                     projectName:
 *                       type: string
 *                       description: The name of the project
 *                     architect:
 *                       type: string
 *                       description: The ID of the architect who submitted the proposal
 *                     status:
 *                       type: string
 *                       example: Rejected
 *                     rejectedAt:
 *                       type: string
 *                       format: date-time
 *                       description: When the proposal was rejected
 *                     rejectedBy:
 *                       type: string
 *                       description: The ID of the admin who rejected the proposal
 *                     adminRemarks:
 *                       type: string
 *                       description: Remarks provided by the admin
 *       400:
 *         description: Bad Request - Cannot reject proposal with current status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 0
 *                 message:
 *                   type: string
 *                   example: "Cannot reject an accepted proposal"
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not Found - Proposal not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 0
 *                 message:
 *                   type: string
 *                   example: "Proposal not found"
 */
