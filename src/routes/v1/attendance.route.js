import express from 'express';
import auth from '../../middlewares/auth.js';
import validate from '../../middlewares/validate.js';
import { transactional } from '../../utils/transactional.js';
import * as attendanceValidation from '../../validations/attendance.validation.js';
import * as attendanceController from '../../controllers/attendance.controller.js';
import * as attendanceService from '../../services/attendance.service.js';

const router = express.Router();

/**
 * @swagger
 * /attendance/clock-in:
 *   post:
 *     summary: Clock in for fabricator
 *     tags: [Attendance]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - clockInTime
 *               - photoKey
 *             properties:
 *               clockInTime:
 *                 type: string
 *                 format: date-time
 *                 description: Clock in timestamp
 *               photoKey:
 *                 type: string
 *                 description: S3 key of the clock-in photo (from initiate-upload)
 *           example:
 *             clockInTime: "2023-12-01T09:00:00.000Z"
 *             photoKey: "uploads/tmp/attendance-photos/clock-in-photo.jpg"
 *     responses:
 *       201:
 *         description: Clock in successful
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
 *                   example: Clock in successful
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     fabricator:
 *                       type: string
 *                     fabricatorName:
 *                       type: string
 *                     clockInTime:
 *                       type: string
 *                       format: date-time
 *                     clockInPhotoKey:
 *                       type: string
 *                     status:
 *                       type: string
 *                       enum: [clocked-in, clocked-out]
 *       400:
 *         description: Invalid input or already clocked in
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Fabricator not found
 */
router.post('/clock-in', auth('manageAttendance'), validate(attendanceValidation.clockIn), transactional(attendanceService.clockInService));

/**
 * @swagger
 * /attendance/clock-out:
 *   post:
 *     summary: Clock out for fabricator
 *     tags: [Attendance]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - clockOutTime
 *               - photoKey
 *             properties:
 *               clockOutTime:
 *                 type: string
 *                 format: date-time
 *                 description: Clock out timestamp
 *               photoKey:
 *                 type: string
 *                 description: S3 key of the clock-out photo (from initiate-upload)
 *           example:
 *             clockOutTime: "2023-12-01T17:00:00.000Z"
 *             photoKey: "uploads/tmp/attendance-photos/clock-out-photo.jpg"
 *     responses:
 *       200:
 *         description: Clock out successful
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
 *                   example: Clock out successful
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     fabricator:
 *                       type: string
 *                     fabricatorName:
 *                       type: string
 *                     clockInTime:
 *                       type: string
 *                       format: date-time
 *                     clockOutTime:
 *                       type: string
 *                       format: date-time
 *                     clockInPhotoKey:
 *                       type: string
 *                     clockOutPhotoKey:
 *                       type: string
 *                     workDuration:
 *                       type: number
 *                       description: Work duration in minutes
 *                     formattedWorkDuration:
 *                       type: string
 *                       description: Formatted work duration (e.g., "8h 30m")
 *                     status:
 *                       type: string
 *                       enum: [clocked-in, clocked-out]
 *       400:
 *         description: Invalid input or no active clock-in found
 *       401:
 *         description: Unauthorized
 */
router.post('/clock-out', auth('manageAttendance'), validate(attendanceValidation.clockOut), transactional(attendanceService.clockOutService));

/**
 * @swagger
 * /attendance/records:
 *   get:
 *     summary: Get attendance records
 *     tags: [Attendance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Number of records per page
 *       - in: query
 *         name: fabricatorId
 *         schema:
 *           type: string
 *         description: Filter by fabricator ID
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date filter (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date filter (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Attendance records fetched successfully
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
 *                   example: Attendance records fetched successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       fabricator:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           email:
 *                             type: string
 *                           role:
 *                             type: string
 *                       fabricatorName:
 *                         type: string
 *                       clockInTime:
 *                         type: string
 *                         format: date-time
 *                       clockOutTime:
 *                         type: string
 *                         format: date-time
 *                       clockInPhotoKey:
 *                         type: string
 *                       clockOutPhotoKey:
 *                         type: string
 *                       workDuration:
 *                         type: number
 *                       formattedWorkDuration:
 *                         type: string
 *                       status:
 *                         type: string
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     pages:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 */
router.get('/records', auth('getAttendance'), validate(attendanceValidation.getAttendanceRecords), attendanceController.getAttendanceRecords);

/**
 * @swagger
 * /attendance/current:
 *   get:
 *     summary: Get current attendance status
 *     tags: [Attendance]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current attendance status fetched successfully
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
 *                   example: Current attendance fetched successfully
 *                 data:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     _id:
 *                       type: string
 *                     fabricator:
 *                       type: object
 *                     fabricatorName:
 *                       type: string
 *                     clockInTime:
 *                       type: string
 *                       format: date-time
 *                     clockInPhotoKey:
 *                       type: string
 *                     status:
 *                       type: string
 *                       enum: [clocked-in, clocked-out]
 *       401:
 *         description: Unauthorized
 */
router.get('/current', auth('getAttendance'), attendanceController.getCurrentAttendance);

/**
 * @swagger
 * /attendance/stats:
 *   get:
 *     summary: Get attendance statistics
 *     tags: [Attendance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: fabricatorId
 *         schema:
 *           type: string
 *         description: Filter by fabricator ID
 *       - in: query
 *         name: month
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 12
 *         description: Month (1-12)
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *           minimum: 2020
 *           maximum: 2030
 *         description: Year
 *     responses:
 *       200:
 *         description: Attendance statistics fetched successfully
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
 *                   example: Attendance stats fetched successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     month:
 *                       type: integer
 *                     year:
 *                       type: integer
 *                     totalDays:
 *                       type: integer
 *                     totalWorkHours:
 *                       type: number
 *                     averageWorkHours:
 *                       type: number
 *                     attendanceRecords:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           date:
 *                             type: string
 *                             format: date-time
 *                           clockInTime:
 *                             type: string
 *                             format: date-time
 *                           clockOutTime:
 *                             type: string
 *                             format: date-time
 *                           workDuration:
 *                             type: number
 *                           formattedWorkDuration:
 *                             type: string
 *       401:
 *         description: Unauthorized
 */
router.get('/stats', auth('getAttendance'), validate(attendanceValidation.getAttendanceStats), attendanceController.getAttendanceStats);

/**
 * @swagger
 * /attendance/in-progress-projects:
 *   get:
 *     summary: Get in-progress projects for attendance
 *     tags: [Attendance]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: In-progress projects fetched successfully
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
 *                   example: In-progress projects fetched successfully
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
 *                         enum: [inprogress]
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Only fabricators and custom users can access this endpoint
 */
router.get('/in-progress-projects', auth('getAttendance'), attendanceController.getInProgressProjects);

/**
 * @swagger
 * /attendance/project/{projectId}/workers:
 *   get:
 *     summary: Get workers assigned to a project with today's clock-in status
 *     tags: [Attendance]
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
 *         description: Project workers fetched successfully
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
 *                   example: Project workers fetched successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       userId:
 *                         type: string
 *                       name:
 *                         type: string
 *                       email:
 *                         type: string
 *                       role:
 *                         type: string
 *                       phone:
 *                         type: string
 *                       assignments:
 *                         type: integer
 *                       assignmentAmountTotal:
 *                         type: number
 *                       perDayAmountAvg:
 *                         type: number
 *                       isClockedIn:
 *                         type: boolean
 *                       clockInTime:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                       clockOutTime:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                       attendanceId:
 *                         type: string
 *                         nullable: true
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/project/:projectId/workers', auth('getAttendance'), attendanceController.getProjectWorkersStatus);

// Debug endpoint to check all projects and assigned projects
router.get('/debug-projects', auth('getAttendance'), async (req, res, next) => {
    try {
        const Project = (await import('../../models/project.model.js')).default;
        const Sitework = (await import('../../models/sitework.model.js')).default;
        const userId = req.user.id;

        // Get all projects
        const allProjects = await Project.find({}).select('_id projectName projectCode status assignedSiteEngineer').sort({ projectName: 1 });

        // Get in-progress projects
        const inProgressProjects = await Project.find({
            status: 'inprogress'
        }).select('_id projectName projectCode status assignedSiteEngineer').sort({ projectName: 1 });

        // Get projects assigned to current user via assignedSiteEngineer
        const assignedProjects = await Project.find({
            assignedSiteEngineer: { $in: [userId] }
        }).select('_id projectName projectCode status assignedSiteEngineer').sort({ projectName: 1 });

        // Get in-progress projects assigned to current user via assignedSiteEngineer
        const assignedInProgressProjects = await Project.find({
            status: 'inprogress',
            assignedSiteEngineer: { $in: [userId] }
        }).select('_id projectName projectCode status assignedSiteEngineer').sort({ projectName: 1 });

        // Get siteworks assigned to current user
        const siteworks = await Sitework.find({ "assignedUsers.user": userId })
            .select('project name')
            .sort({ createdAt: -1 });

        const projectIds = [...new Set(siteworks.map(sw => sw.project.toString()))];

        // Get projects assigned via sitework
        const siteworkAssignedProjects = await Project.find({
            _id: { $in: projectIds }
        }).select('_id projectName projectCode status').sort({ projectName: 1 });

        // Get in-progress projects assigned via sitework
        const siteworkAssignedInProgressProjects = await Project.find({
            _id: { $in: projectIds },
            status: 'inprogress'
        }).select('_id projectName projectCode status').sort({ projectName: 1 });

        res.status(200).json({
            status: 1,
            message: 'Debug projects fetched successfully',
            data: {
                allProjects: {
                    count: allProjects.length,
                    projects: allProjects
                },
                inProgressProjects: {
                    count: inProgressProjects.length,
                    projects: inProgressProjects
                },
                assignedProjects: {
                    count: assignedProjects.length,
                    projects: assignedProjects
                },
                assignedInProgressProjects: {
                    count: assignedInProgressProjects.length,
                    projects: assignedInProgressProjects
                },
                siteworks: {
                    count: siteworks.length,
                    siteworks: siteworks
                },
                siteworkProjectIds: projectIds,
                siteworkAssignedProjects: {
                    count: siteworkAssignedProjects.length,
                    projects: siteworkAssignedProjects
                },
                siteworkAssignedInProgressProjects: {
                    count: siteworkAssignedInProgressProjects.length,
                    projects: siteworkAssignedInProgressProjects
                },
                currentUserId: userId
            }
        });
    } catch (error) {
        next(error);
    }
});

export default router;
