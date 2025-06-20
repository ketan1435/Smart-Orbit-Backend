import express from 'express';
import {
  registerAdmin,
  loginAdmin, getAdminProfile, updateAdminProfile
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

export default router;
