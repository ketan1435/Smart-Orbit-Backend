import express from 'express';
import auth from '../../middlewares/auth.js';
import validate from '../../middlewares/validate.js';
import * as siteVisitValidation from '../../validations/siteVisit.validation.js';
import * as siteVisitController from '../../controllers/siteVisit.controller.js';

const router = express.Router();

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
    .route('/visits/:visitId/complete')
    .put(
        auth('manageSiteVisits'), // Site Engineers should have this right
        validate(siteVisitValidation.completeSiteVisit),
        siteVisitController.completeSiteVisit
    );

router
    .route('/visits/:visitId/approve')
    .patch(
        auth('manageSiteVisits'), // Admins should have this right
        validate(siteVisitValidation.approveSiteVisit),
        siteVisitController.approveSiteVisit
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
 *             example:
 *               siteEngineerId: '60d0fe4f5311236168a109ca'
 *               visitDate: '2024-08-15T10:00:00.000Z'
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
 * /visits/{visitId}/complete:
 *   put:
 *     summary: Complete a site visit (for site engineers)
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - updatedData
 *             properties:
 *               updatedData:
 *                 type: object
 *                 description: The snapshot of updated SCP data
 *               remarks:
 *                 type: string
 *                 description: Any remarks or notes from the visit
 *             example:
 *               updatedData: { "plotSize": "5500 sqft", "roadWidth": "15 feet" }
 *               remarks: "Customer confirmed the plot size and new road width."
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