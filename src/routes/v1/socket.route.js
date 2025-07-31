import express from 'express';
import auth from '../../middlewares/auth.js';
import validate from '../../middlewares/validate.js';
import * as socketValidation from '../../validations/socket.validation.js';
import * as socketController from '../../controllers/socket.controller.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Socket
 *   description: Socket.IO related endpoints
 */

/**
 * @swagger
 * /socket/stats:
 *   get:
 *     summary: Get socket connection statistics
 *     tags: [Socket]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Socket statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     connectedUsers:
 *                       type: number
 *                     totalRooms:
 *                       type: number
 */
router.get('/stats', auth(), socketController.getSocketStats);

/**
 * @swagger
 * /socket/projects/{projectId}/online-users:
 *   get:
 *     summary: Get online users for a project
 *     tags: [Socket]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID
 *     responses:
 *       200:
 *         description: Online users retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 message:
 *                   type: string
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       userId:
 *                         type: string
 *                       role:
 *                         type: string
 *                       joinedAt:
 *                         type: string
 *                         format: date-time
 */
router.get('/projects/:projectId/online-users', auth(), socketController.getOnlineUsersForProject);

/**
 * @swagger
 * /socket/users/{userId}/online-status:
 *   get:
 *     summary: Check if a user is online
 *     tags: [Socket]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User online status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: string
 *                     isOnline:
 *                       type: boolean
 */
router.get('/users/:userId/online-status', auth(), socketController.checkUserOnlineStatus);

/**
 * @swagger
 * /socket/connected-users-count:
 *   get:
 *     summary: Get total connected users count
 *     tags: [Socket]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Connected users count retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     connectedUsers:
 *                       type: number
 */
router.get('/connected-users-count', auth(), socketController.getConnectedUsersCount);

/**
 * @swagger
 * /socket/notifications/system:
 *   post:
 *     summary: Send system notification to users
 *     tags: [Socket]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userIds
 *               - notificationData
 *             properties:
 *               userIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of user IDs to send notification to
 *               notificationData:
 *                 type: object
 *                 required:
 *                   - title
 *                   - message
 *                 properties:
 *                   title:
 *                     type: string
 *                     description: Notification title
 *                   message:
 *                     type: string
 *                     description: Notification message
 *                   type:
 *                     type: string
 *                     description: Notification type (info, warning, error, success)
 *                   data:
 *                     type: object
 *                     description: Additional data for the notification
 *     responses:
 *       200:
 *         description: System notification sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 message:
 *                   type: string
 */
router.post('/notifications/system',
    auth(),
    validate(socketValidation.sendSystemNotification),
    socketController.sendSystemNotification
);

/**
 * @swagger
 * /socket/users/{userId}/disconnect:
 *   delete:
 *     summary: Force disconnect a user (admin only)
 *     tags: [Socket]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID to disconnect
 *     responses:
 *       200:
 *         description: User disconnected successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 message:
 *                   type: string
 *       403:
 *         description: Only admins can force disconnect users
 */
router.delete('/users/:userId/disconnect', auth(), socketController.forceDisconnectUser);

export default router; 