import express from 'express';
import auth from '../../middlewares/auth.js';
import validate from '../../middlewares/validate.js';
import * as siteVisitValidation from '../../validations/siteVisit.validation.js';
import * as siteVisitController from '../../controllers/siteVisit.controller.js';

const router = express.Router();

router
    .route('/')
    .get(
        auth('getSiteVisits'), // Accessible by admin and sales-admin
        validate(siteVisitValidation.querySiteVisits),
        siteVisitController.getSiteVisits
    );

// Routes for a specific requirement's visits
router
    .route('/requirements/:requirementId/visits')
    .post(
        auth('manageSiteVisits'), // Or a more specific permission like 'scheduleSiteVisit'
        validate(siteVisitValidation.scheduleSiteVisit),
        siteVisitController.scheduleSiteVisit
    )
    .get(
        auth('getSiteVisits'),
        validate(siteVisitValidation.getSiteVisitsForRequirement),
        siteVisitController.getSiteVisitsForRequirement
    );

// Routes for a specific visit
router
    .route('/visits/:visitId')
    .get(
        auth('getSiteVisits'),
        validate(siteVisitValidation.getSiteVisitById),
        siteVisitController.getSiteVisitById
    );

router
    .route('/visits/:visitId/save')
    .patch(
        auth('manageSiteVisits'), // Site Engineers should have this right
        validate(siteVisitValidation.updateSiteVisit),
        siteVisitController.updateSiteVisit
    );

router
    .route('/visits/:visitId/complete')
    .put(
        auth('manageSiteVisits'), // Site Engineers should have this right
        validate(siteVisitValidation.getSiteVisitById), // Only needs visitId from params
        siteVisitController.completeSiteVisit
    );

router
    .route('/visits/:visitId/approve')
    .patch(
        auth('manageSiteVisits'), // Admins should have this right
        validate(siteVisitValidation.approveSiteVisit),
        siteVisitController.approveSiteVisit
    );

router
    .route('/visits/:visitId/documents')
    .post(
        auth('manageSiteVisits'), // Or a more specific permission
        validate(siteVisitValidation.addDocuments),
        siteVisitController.addDocumentsToSiteVisit
    )
    .get(
        auth('getSiteVisits'), // Assuming site engineers have this permission
        validate(siteVisitValidation.getSiteVisitDocuments),
        siteVisitController.getSiteVisitDocuments
    );

export default router;

/**
 * @swagger
 * tags:
 *   name: SiteVisits
 *   description: Site Visit management and approval
 */

/**
 * @swagger
 * /visits:
 *   get:
 *     summary: Get all site visits (for admins)
 *     description: Retrieves a paginated list of all site visits. Can be filtered by site engineer, project, and status. Accessible by users with 'getSiteVisits' permission (e.g., admin, sales-admin).
 *     tags: [SiteVisits]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: siteEngineer
 *         schema:
 *           type: string
 *         description: ID of the site engineer to filter by.
 *       - in: query
 *         name: project
 *         schema:
 *           type: string
 *         description: ID of the project to filter by.
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
 */

/**
 * @swagger
 * /requirements/{requirementId}/visits:
 *   post:
 *     summary: Schedule a new site visit for a requirement
 *     tags: [SiteVisits]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requirementId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the requirement
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - siteEngineerId
 *               - visitDate
 *             properties:
 *               siteEngineerId:
 *                 type: string
 *                 description: The ID of the site engineer to assign
 *               visitDate:
 *                 type: string
 *                 format: date-time
 *                 description: The scheduled date for the visit
 *               hasRequirementEditAccess:
 *                 type: boolean
 *                 description: Whether the site engineer has edit access to the requirement
 *             example:
 *               siteEngineerId: '60d0fe4f5311236168a109ca'
 *               visitDate: '2024-08-15T10:00:00.000Z'
 *               hasRequirementEditAccess: true
 *     responses:
 *       "201":
 *         description: Created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SiteVisit'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *
 *   get:
 *     summary: Get all site visits for a requirement
 *     tags: [SiteVisits]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requirementId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the requirement
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/SiteVisit'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 */

/**
 * @swagger
 * /visits/{visitId}:
 *   get:
 *     summary: Get a single site visit by ID
 *     tags: [SiteVisits]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: visitId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the site visit
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SiteVisit'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */

/**
 * @swagger
 * /visits/{visitId}/save:
 *   patch:
 *     summary: Save a site visit's progress (for site engineers)
 *     description: Allows a site engineer to save their progress (updatedData, remarks) without finalizing the visit. The visit status will be moved to 'InProgress'.
 *     tags: [SiteVisits]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: visitId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the site visit to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               updatedData:
 *                 type: object
 *                 description: The snapshot of updated SCP data
 *               remarks:
 *                 type: string
 *                 description: Any remarks or notes from the visit
 *             example:
 *               updatedData: { "plotSize": "5500 sqft" }
 *               remarks: "Customer wants to confirm the boundary."
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SiteVisit'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */

/**
 * @swagger
 * /visits/{visitId}/complete:
 *   put:
 *     summary: Complete a site visit (for site engineers)
 *     description: Finalizes a site visit after all data has been saved. This moves the status to 'Completed' and locks the record for admin approval. No request body is needed.
 *     tags: [SiteVisits]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: visitId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the site visit to complete
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SiteVisit'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */

/**
 * @swagger
 * /visits/{visitId}/documents:
 *   post:
 *     summary: Add documents to a site visit
 *     description: Allows a site engineer to upload documents (e.g., photos, measurement files) for a specific site visit.
 *     tags: [SiteVisits]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: visitId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the site visit
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - files
 *             properties:
 *               engineerFeedback:
 *                 type: string
 *                 description: Optional feedback or notes from the engineer regarding these documents.
 *               files:
 *                 type: array
 *                 description: An array of file objects that have been uploaded.
 *                 items:
 *                   type: object
 *                   required:
 *                     - key
 *                     - name
 *                     - type
 *                     - size
 *                   properties:
 *                     key:
 *                       type: string
 *                       description: The S3 key returned from the `/files/initiate-upload` endpoint.
 *                     name:
 *                       type: string
 *                       description: The original name of the file.
 *                     type:
 *                       type: string
 *                       description: The MIME type of the file.
 *                     size:
 *                       type: number
 *                       description: The size of the file in bytes.
 *                   example:
 *                     key: "uploads/tmp/site-visit-documents/some-uuid.jpg"
 *                     name: "site-photo-1.jpg"
 *                     type: "image/jpeg"
 *                     size: 102400
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SiteVisit'
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *
 *   get:
 *     summary: Get documents for a site visit (paginated)
 *     description: |
 *       Allows an assigned site engineer to retrieve a paginated list of documents for a specific site visit.
 *       The documents are sorted by the date they were added, with the most recent first.
 *     tags: [SiteVisits]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: visitId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the site visit
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: The page number for pagination.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: The number of documents to return per page.
 *     responses:
 *       "200":
 *         description: OK
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
 *                   example: "Documents fetched successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     docs:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/SiteVisitDocument'
 *                     totalDocs:
 *                       type: integer
 *                       example: 25
 *                     limit:
 *                       type: integer
 *                       example: 10
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     totalPages:
 *                       type: integer
 *                       example: 3
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */

/**
 * @swagger
 * /visits/{visitId}/approve:
 *   patch:
 *     summary: Approve a completed site visit (for admins)
 *     tags: [SiteVisits]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: visitId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the site visit to approve
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Requirement'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */ 