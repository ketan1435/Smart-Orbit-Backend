import express from 'express';
import {
  registerAdmin,
  loginAdmin, getAdminProfile, updateAdminProfile, getPendingApprovals, getInProgressProjects, getDashboardSummary
  // getAdminProfile,
  // updateAdminProfile,
  // getMyStores,
  // setSelectedStore
} from '../../controllers/admin.controller.js';
import auth from '../../middlewares/auth.js';

const router = express.Router();
/**
 * @swagger
 * /admin/auth/register:
 *   post:
 *     summary: Register a new Admin
 *     tags: [Admin Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - adminName
 *               - email
 *               - password
 *             properties:
 *               adminName:
 *                 type: string
 *                 example: John Doe
 *               email:
 *                 type: string
 *                 example: admin@example.com
 *               password:
 *                 type: string
 *                 example: admin1234
 *               mobileNo:
 *                 type: string
 *                 example: "9876543210"
 *               alternateMobileNo:
 *                 type: string
 *                 example: "9123456789"
 *     responses:
 *       201:
 *         description: Admin registered successfully
 *       400:
 *         description: Validation error or email already taken
 */
router.post('/auth/register', registerAdmin);

/**
 * @swagger
 * /admin/auth/login:
 *   post:
 *     summary: Login as an Admin
 *     tags: [Admin Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 example: admin@example.com
 *               password:
 *                 type: string
 *                 example: admin1234
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 token:
 *                   type: string
 *                 admin:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     email:
 *                       type: string
 *                     adminName:
 *                       type: string
 *                     role:
 *                       type: string
 *       401:
 *         description: Invalid credentials
 *       404:
 *         description: Admin not found
 */
router.post('/auth/login', loginAdmin);

// Protected routes

/**
 * @swagger
 * /admin/me:
 *   get:
 *     summary: Get current Admin profile
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Admin profile fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 adminName:
 *                   type: string
 *                 email:
 *                   type: string
 *                 role:
 *                   type: string
 *       401:
 *         description: Unauthorized or invalid token
 */
router.get('/me', auth(), getAdminProfile);

/**
 * @swagger
 * /admin/me:
 *   put:
 *     summary: Update current Admin profile
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               adminName:
 *                 type: string
 *               mobileNo:
 *                 type: string
 *               alternateMobileNo:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated
 *       401:
 *         description: Unauthorized
 */
router.put('/me', auth(), updateAdminProfile);

/**
 * @swagger
 * /admin/dashboard/pending-approvals:
 *   get:
 *     summary: Get pending approvals count for admin dashboard
 *     description: Retrieve the total number of documents pending admin approval across all document types (BOM, Architect Documents, Architect Proposals, Sitework Documents)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Pending approvals fetched successfully
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
 *                   example: "Pending approvals fetched successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     bomDocuments:
 *                       type: integer
 *                       description: Number of BOM documents with status 'submitted'
 *                       example: 5
 *                     architectDocuments:
 *                       type: integer
 *                       description: Number of architect documents with adminStatus 'Pending'
 *                       example: 3
 *                     architectProposals:
 *                       type: integer
 *                       description: Number of architect proposals with status 'Pending'
 *                       example: 8
 *                     siteworkDocuments:
 *                       type: integer
 *                       description: Number of sitework documents with adminStatus 'Pending'
 *                       example: 12
 *                     total:
 *                       type: integer
 *                       description: Total number of pending approvals across all document types
 *                       example: 28
 *                   example:
 *                     bomDocuments: 5
 *                     architectDocuments: 3
 *                     architectProposals: 8
 *                     siteworkDocuments: 12
 *                     total: 28
 *       "401":
 *         description: Unauthorized - Invalid or missing token
 *       "500":
 *         description: Internal server error
 */
router.get('/dashboard/pending-approvals', auth(), getPendingApprovals);

/**
 * @swagger
 * /admin/dashboard/in-progress-projects:
 *   get:
 *     summary: Get in-progress projects stats for admin dashboard
 *     description: Retrieve statistics about in-progress and active projects, including total counts, breakdown by type, and recent projects.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: In-progress projects stats fetched successfully
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
 *                   example: "In-progress projects stats fetched successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                       description: Total number of in-progress and active projects
 *                       example: 12
 *                     active:
 *                       type: integer
 *                       description: Number of active projects
 *                       example: 8
 *                     inprogress:
 *                       type: integer
 *                       description: Number of in-progress projects
 *                       example: 4
 *                     projectsByType:
 *                       type: array
 *                       description: Breakdown of projects by requirement type
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                             description: Requirement type name
 *                             example: "Cottage"
 *                           count:
 *                             type: integer
 *                             description: Number of projects of this type
 *                             example: 5
 *                     recentProjects:
 *                       type: array
 *                       description: List of 5 most recent projects
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                             description: Project ID
 *                           projectName:
 *                             type: string
 *                             description: Project name
 *                           projectCode:
 *                             type: string
 *                             description: Project code
 *                           customerName:
 *                             type: string
 *                             description: Customer name
 *                           status:
 *                             type: string
 *                             description: Project status
 *                             enum: [active, inprogress]
 *                           requirementType:
 *                             type: string
 *                             description: Type of requirement
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                             description: Project creation date
 *                   example:
 *                     total: 12
 *                     active: 8
 *                     inprogress: 4
 *                     projectsByType:
 *                       - _id: "Cottage"
 *                         count: 5
 *                       - _id: "House"
 *                         count: 4
 *                       - _id: "Commercial"
 *                         count: 3
 *                     recentProjects:
 *                       - _id: "64f31a7b7e5d6e001f7e1234"
 *                         projectName: "Modern Cottage Design"
 *                         projectCode: "PRJ-001"
 *                         customerName: "John Doe"
 *                         status: "active"
 *                         requirementType: "Cottage"
 *                         createdAt: "2024-01-15T10:00:00.000Z"
 *       "401":
 *         description: Unauthorized - Invalid or missing token
 *       "500":
 *         description: Internal server error
 */
router.get('/dashboard/in-progress-projects', auth(), getInProgressProjects);

/**
 * @swagger
 * /admin/dashboard/summary:
 *   get:
 *     summary: Get combined dashboard summary for admin
 *     description: Returns pending approvals and in-progress projects in a single payload
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Dashboard summary fetched successfully
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
 *                   example: Dashboard summary fetched successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     pendingApprovals:
 *                       type: object
 *                       properties:
 *                         bomDocuments: { type: integer, example: 0 }
 *                         architectDocuments: { type: integer, example: 0 }
 *                         architectProposals: { type: integer, example: 0 }
 *                         siteworkDocuments: { type: integer, example: 0 }
 *                         total: { type: integer, example: 0 }
 *                     inProgress:
 *                       type: object
 *                       properties:
 *                         total: { type: integer, example: 2 }
 *                         active: { type: integer, example: 0 }
 *                         inprogress: { type: integer, example: 2 }
 *                         projectsByType:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               _id: { type: string, example: Cottage / Structure Proposal }
 *                               count: { type: integer, example: 2 }
 *                         recentProjects:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               _id: { type: string }
 *                               projectName: { type: string }
 *                               projectCode: { type: string }
 *                               customerName: { type: string }
 *                               status: { type: string }
 *                               requirementType: { type: string }
 *                               createdAt: { type: string, format: date-time }
 */
router.get('/dashboard/summary', auth(), getDashboardSummary);

export default router;
