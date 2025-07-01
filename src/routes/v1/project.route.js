import express from 'express';
import auth from '../../middlewares/auth.js';
import validate from '../../middlewares/validate.js';
import * as projectValidation from '../../validations/project.validation.js';
import * as projectController from '../../controllers/project.controller.js';
// const projectValidation = require('../../validations/project.validation');
// const projectController = require('../../controllers/project.controller');

const router = express.Router();

router
    .route('/')
    .get(auth('getProjects'), validate(projectValidation.getProjects), projectController.getProjects);

router
    .route('/:projectId/visits')
    .get(auth('getProjects'), validate(projectValidation.getProjectSiteVisits), projectController.getProjectSiteVisits);

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