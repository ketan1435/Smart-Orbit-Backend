import express from 'express';
import auth from '../../middlewares/auth.js';
import validate from '../../middlewares/validate.js';
import {
    getLogs,
    getTargetLogs,
    getUserLogs,
    getStats,
    deleteLog,
    cleanupLogs,
    getLogById,
    getRecentActivity,
    getActivitySummary,
    getProjectLogsController,
    getProjectLogStatsController
} from '../../controllers/activityLog.controller.js';
import Joi from 'joi';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     ActivityLog:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         user:
 *           type: string
 *           description: User ID who performed the action
 *         userModel:
 *           type: string
 *           enum: [User, Admin]
 *         userName:
 *           type: string
 *         userEmail:
 *           type: string
 *         targetModel:
 *           type: string
 *           enum: [User, Admin, Project, ClientProposal, BOM, PO, Vendor, SiteVisit, Message, File, CustomerLead, Quote, Sitework, ProjectAssignmentPayment, WalletTransaction]
 *         targetId:
 *           type: string
 *         targetName:
 *           type: string
 *         action:
 *           type: string
 *           enum: [create, update, delete, activate, deactivate, approve, reject, send, convert, finalize]
 *         actionType:
 *           type: string
 *           enum: [CRUD, Status Change, Workflow, Communication, File Operation, System]
 *         changes:
 *           type: object
 *           description: Object containing field-level changes
 *         previousValues:
 *           type: object
 *           description: Previous values before change
 *         newValues:
 *           type: object
 *           description: New values after change
 *         description:
 *           type: string
 *           description: Human-readable description of the action
 *         ipAddress:
 *           type: string
 *         userAgent:
 *           type: string
 *         metadata:
 *           type: object
 *         timestamp:
 *           type: string
 *           format: date-time
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *         isActive:
 *           type: boolean
 */

/**
 * @swagger
 * /activity-logs:
 *   get:
 *     summary: Get activity logs with filtering and pagination
 *     tags: [ActivityLogs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: user
 *         schema:
 *           type: string
 *         description: Filter by user ID
 *       - in: query
 *         name: userModel
 *         schema:
 *           type: string
 *           enum: [User, Admin]
 *         description: Filter by user model type
 *       - in: query
 *         name: targetModel
 *         schema:
 *           type: string
 *           enum: [User, Admin, Project, ClientProposal, BOM, PO, Vendor, SiteVisit, Message, File, CustomerLead, Quote, Sitework, ProjectAssignmentPayment, WalletTransaction]
 *         description: Filter by target model
 *       - in: query
 *         name: targetId
 *         schema:
 *           type: string
 *         description: Filter by target ID
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *           enum: [create, update, delete, activate, deactivate, approve, reject, send, convert, finalize]
 *         description: Filter by action type
 *       - in: query
 *         name: actionType
 *         schema:
 *           type: string
 *           enum: [CRUD, Status Change, Workflow, Communication, File Operation, System]
 *         description: Filter by action type category
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by start date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by end date
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: Activity logs fetched successfully
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
 *                   example: Activity logs fetched successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ActivityLog'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 */
router.get('/', auth('admin'), getLogs);

/**
 * @swagger
 * /activity-logs/target/{targetModel}/{targetId}:
 *   get:
 *     summary: Get activity logs for a specific target
 *     tags: [ActivityLogs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: targetModel
 *         required: true
 *         schema:
 *           type: string
 *           enum: [User, Admin, Project, ClientProposal, BOM, PO, Vendor, SiteVisit, Message, File, CustomerLead, Quote, Sitework, ProjectAssignmentPayment, WalletTransaction]
 *         description: Target model name
 *       - in: path
 *         name: targetId
 *         required: true
 *         schema:
 *           type: string
 *         description: Target document ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 10
 *         description: Number of logs to return
 *     responses:
 *       200:
 *         description: Target activity logs fetched successfully
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
 *                   example: Target activity logs fetched successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ActivityLog'
 */
router.get('/target/:targetModel/:targetId', auth('admin'), getTargetLogs);

/**
 * @swagger
 * /activity-logs/user/{userId}/{userModel}:
 *   get:
 *     summary: Get activity logs for a specific user
 *     tags: [ActivityLogs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *       - in: path
 *         name: userModel
 *         required: true
 *         schema:
 *           type: string
 *           enum: [User, Admin]
 *         description: User model type
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 20
 *         description: Number of logs to return
 *     responses:
 *       200:
 *         description: User activity logs fetched successfully
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
 *                   example: User activity logs fetched successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ActivityLog'
 */
router.get('/user/:userId/:userModel', auth('admin'), getUserLogs);

/**
 * @swagger
 * /activity-logs/stats:
 *   get:
 *     summary: Get activity statistics
 *     tags: [ActivityLogs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by start date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by end date
 *     responses:
 *       200:
 *         description: Activity statistics fetched successfully
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
 *                   example: Activity statistics fetched successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalLogs:
 *                       type: integer
 *                     actionStats:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           count:
 *                             type: integer
 *                     userStats:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           count:
 *                             type: integer
 *                     targetStats:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           count:
 *                             type: integer
 */
router.get('/stats', auth('admin'), getStats);

/**
 * @swagger
 * /activity-logs/recent:
 *   get:
 *     summary: Get recent activity (last 24 hours)
 *     tags: [ActivityLogs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 50
 *         description: Number of logs to return
 *       - in: query
 *         name: targetModel
 *         schema:
 *           type: string
 *           enum: [User, Admin, Project, ClientProposal, BOM, PO, Vendor, SiteVisit, Message, File, CustomerLead, Quote, Sitework, ProjectAssignmentPayment, WalletTransaction]
 *         description: Filter by target model
 *       - in: query
 *         name: targetId
 *         schema:
 *           type: string
 *         description: Filter by target ID
 *     responses:
 *       200:
 *         description: Recent activity fetched successfully
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
 *                   example: Recent activity fetched successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ActivityLog'
 */
router.get('/recent', auth('admin'), getRecentActivity);

/**
 * @swagger
 * /activity-logs/summary:
 *   get:
 *     summary: Get activity summary for dashboard
 *     tags: [ActivityLogs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 7
 *         description: Number of days to include in summary
 *     responses:
 *       200:
 *         description: Activity summary fetched successfully
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
 *                   example: Activity summary fetched successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalLogs:
 *                       type: integer
 *                     recentLogs:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/ActivityLog'
 *                     topUsers:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: object
 *                             properties:
 *                               user:
 *                                 type: string
 *                               userModel:
 *                                 type: string
 *                           count:
 *                             type: integer
 *                     topActions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           count:
 *                             type: integer
 *                     topTargets:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           count:
 *                             type: integer
 *                     period:
 *                       type: string
 */
router.get('/summary', auth('admin'), getActivitySummary);

/**
 * @swagger
 * /activity-logs/{logId}:
 *   get:
 *     summary: Get activity log by ID
 *     tags: [ActivityLogs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: logId
 *         required: true
 *         schema:
 *           type: string
 *         description: Activity log ID
 *     responses:
 *       200:
 *         description: Activity log fetched successfully
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
 *                   example: Activity log fetched successfully
 *                 data:
 *                   $ref: '#/components/schemas/ActivityLog'
 *       404:
 *         description: Activity log not found
 */
router.get('/:logId', auth('admin'), getLogById);

/**
 * @swagger
 * /activity-logs/{logId}:
 *   delete:
 *     summary: Delete activity log (soft delete)
 *     tags: [ActivityLogs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: logId
 *         required: true
 *         schema:
 *           type: string
 *         description: Activity log ID
 *     responses:
 *       200:
 *         description: Activity log deleted successfully
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
 *                   example: Activity log deleted successfully
 *                 data:
 *                   $ref: '#/components/schemas/ActivityLog'
 */
router.delete('/:logId', auth('admin'), deleteLog);

/**
 * @swagger
 * /activity-logs/cleanup:
 *   post:
 *     summary: Clean up old activity logs
 *     tags: [ActivityLogs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: daysOld
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 365
 *         description: Number of days old logs to delete
 *     responses:
 *       200:
 *         description: Old activity logs cleaned up successfully
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
 *                   example: Cleaned up 150 old activity logs
 *                 data:
 *                   type: object
 *                   properties:
 *                     deletedCount:
 *                       type: integer
 */
router.post('/cleanup', auth('admin'), cleanupLogs);

/**
 * @swagger
 * /activity-logs/project/{projectId}:
 *   get:
 *     summary: Get comprehensive project logs with guarantee
 *     description: Retrieves all activity logs related to a specific project, including direct project logs, related entity logs, and embedded document logs
 *     tags: [ActivityLogs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by start date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by end date
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *           enum: [create, update, delete, activate, deactivate, approve, reject, send, convert, finalize]
 *         description: Filter by action type
 *       - in: query
 *         name: actionType
 *         schema:
 *           type: string
 *           enum: [CRUD, Status Change, Workflow, Communication, File Operation, System]
 *         description: Filter by action type category
 *       - in: query
 *         name: user
 *         schema:
 *           type: string
 *         description: Filter by user ID
 *       - in: query
 *         name: includeEmbedded
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Include embedded document logs
 *       - in: query
 *         name: includeRelated
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Include related entity logs
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 500
 *           default: 100
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: Project logs fetched successfully
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
 *                   example: Project logs fetched successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     logs:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/ActivityLog'
 *                     categorizedLogs:
 *                       type: object
 *                       properties:
 *                         project:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/ActivityLog'
 *                         customerLead:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/ActivityLog'
 *                         clientProposal:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/ActivityLog'
 *                         bom:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/ActivityLog'
 *                         po:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/ActivityLog'
 *                         quote:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/ActivityLog'
 *                         sitework:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/ActivityLog'
 *                         siteVisit:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/ActivityLog'
 *                         file:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/ActivityLog'
 *                         embedded:
 *                           type: object
 *                           properties:
 *                             architectProposal:
 *                               type: array
 *                               items:
 *                                 $ref: '#/components/schemas/ActivityLog'
 *                             architectDocument:
 *                               type: array
 *                               items:
 *                                 $ref: '#/components/schemas/ActivityLog'
 *                             proposal:
 *                               type: array
 *                               items:
 *                                 $ref: '#/components/schemas/ActivityLog'
 *                             siteworkDocument:
 *                               type: array
 *                               items:
 *                                 $ref: '#/components/schemas/ActivityLog'
 *                         workflow:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/ActivityLog'
 *                         communication:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/ActivityLog'
 *                         crud:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/ActivityLog'
 *                         statusChange:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/ActivityLog'
 *                     stats:
 *                       type: object
 *                       properties:
 *                         totalLogs:
 *                           type: integer
 *                         actionStats:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               _id:
 *                                 type: string
 *                               count:
 *                                 type: integer
 *                         userStats:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               _id:
 *                                 type: object
 *                                 properties:
 *                                   user:
 *                                     type: string
 *                                   userModel:
 *                                     type: string
 *                               count:
 *                                 type: integer
 *                         targetStats:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               _id:
 *                                 type: string
 *                               count:
 *                                 type: integer
 *                         timelineStats:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               _id:
 *                                 type: object
 *                                 properties:
 *                                   year:
 *                                     type: integer
 *                                   month:
 *                                     type: integer
 *                                   day:
 *                                     type: integer
 *                               count:
 *                                 type: integer
 *                         embeddedStats:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               _id:
 *                                 type: string
 *                               count:
 *                                 type: integer
 *                         projectId:
 *                           type: string
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         totalPages:
 *                           type: integer
 *                     projectId:
 *                       type: string
 *                     queryOptions:
 *                       type: object
 *                       properties:
 *                         startDate:
 *                           type: string
 *                           format: date
 *                         endDate:
 *                           type: string
 *                           format: date
 *                         action:
 *                           type: string
 *                         actionType:
 *                           type: string
 *                         user:
 *                           type: string
 *                         includeEmbedded:
 *                           type: boolean
 *                         includeRelated:
 *                           type: boolean
 */
router.get('/project/:projectId', auth('getProjects'), getProjectLogsController);

/**
 * @swagger
 * /activity-logs/project/{projectId}/stats:
 *   get:
 *     summary: Get project log statistics
 *     description: Retrieves comprehensive statistics for all activity logs related to a specific project
 *     tags: [ActivityLogs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by start date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by end date
 *     responses:
 *       200:
 *         description: Project log statistics fetched successfully
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
 *                   example: Project log statistics fetched successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalLogs:
 *                       type: integer
 *                     actionStats:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           count:
 *                             type: integer
 *                     userStats:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: object
 *                             properties:
 *                               user:
 *                                 type: string
 *                               userModel:
 *                                 type: string
 *                           count:
 *                             type: integer
 *                     targetStats:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           count:
 *                             type: integer
 *                     timelineStats:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: object
 *                             properties:
 *                                 year:
 *                                   type: integer
 *                                 month:
 *                                   type: integer
 *                                 day:
 *                                   type: integer
 *                           count:
 *                             type: integer
 *                     embeddedStats:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           count:
 *                             type: integer
 *                     projectId:
 *                       type: string
 */
router.get('/project/:projectId/stats', auth('getProjects'), getProjectLogStatsController);

export default router;
