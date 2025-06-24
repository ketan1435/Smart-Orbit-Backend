import express from 'express';
import auth from '../../middlewares/auth.js';
import validate from '../../middlewares/validate.js';
import { userValidation } from '../../validations/index.js';
import { userController } from '../../controllers/index.js';
import { getMySharedRequirementsController } from '../../controllers/customerLead.controller.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User management and retrieval
 */

router
  .route('/')
  /**
   * @swagger
   * /users:
   *   post:
   *     summary: Create a user
   *     description: Only admins can create other users.
   *     tags: [Users]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/User'
   *           example:
   *             name: "John Doe"
   *             email: "architect@example.com"
   *             password: "password1"
   *             role: "architect"
   *             phoneNumber: "1234567890"
   *             city: "New York"
   *             region: "NY"
   *             address: "123 Main St"
   *             education: "Masters in Architecture"
   *             experience: "5 years"
   *             profilePictureKey: "uploads/tmp/user-avatars/some-uuid.jpg"
   *     responses:
   *       "201":
   *         description: Created
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/User'
   *       "400":
   *         $ref: '#/components/responses/DuplicateEmail'
   *       "401":
   *         $ref: '#/components/responses/Unauthorized'
   *       "403":
   *         $ref: '#/components/responses/Forbidden'
   */
  .post(auth('manageUsers'), validate(userValidation.createUser), userController.createUser)
  /**
   * @swagger
   * /users:
   *   get:
   *     summary: Get all users
   *     description: Only admins can retrieve all users.
   *     tags: [Users]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: name
   *         schema:
   *           type: string
   *         description: User name
   *       - in: query
   *         name: role
   *         schema:
   *           type: string
   *         description: User role
   *       - in: query
   *         name: experience
   *         schema:
   *           type: string
   *         description: User experience
   *       - in: query
   *         name: region
   *         schema:
   *           type: string
   *         description: User region
   *       - in: query
   *         name: education
   *         schema:
   *           type: string
   *         description: User education
   *       - in: query
   *         name: isActive
   *         schema:
   *           type: boolean
   *         description: Filter by active status
   *       - in: query
   *         name: sortBy
   *         schema:
   *           type: string
   *         description: sort by query in the form of field:desc/asc (ex. name:asc)
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           minimum: 1
   *         default: 10
   *         description: Maximum number of users
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           minimum: 1
   *           default: 1
   *         description: Page number
   *     responses:
   *       "200":
   *         description: OK
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 results:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/User'
   *                 page:
   *                   type: integer
   *                   example: 1
   *                 limit:
   *                   type: integer
   *                   example: 10
   *                 totalPages:
   *                   type: integer
   *                   example: 1
   *                 totalResults:
   *                   type: integer
   *                   example: 1
   *       "401":
   *         $ref: '#/components/responses/Unauthorized'
   *       "403":
   *         $ref: '#/components/responses/Forbidden'
   */
  .get(auth('getUsers'), validate(userValidation.getUsers), userController.getUsers);

/**
 * @swagger
 * /users/search:
 *   post:
 *     summary: Search for users with optional filters
 *     description: Retrieve a list of users based on search criteria in the request body.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               role:
 *                 type: string
 *               experience:
 *                 type: string
 *               region:
 *                 type: string
 *               education:
 *                 type: string
 *               sortBy:
 *                 type: string
 *                 description: "Sort order, e.g., name:asc"
 *               limit:
 *                 type: integer
 *               page:
 *                 type: integer
 *           example:
 *             name: "John"
 *             role: "architect"
 *             page: 1
 *             limit: 10
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserPagedResults'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post('/search', auth('getUsers'), validate(userValidation.searchUsers), userController.searchUsers);

/**
 * @swagger
 * /users/export:
 *   get:
 *     summary: Export users to an Excel file
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *         description: Filter by user name (case insensitive)
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *         description: Filter by a single role or comma-separated roles
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *       - in: query
 *         name: dateFilterType
 *         schema:
 *           type: string
 *           enum: [all, specific, range]
 *         description: Type of date filter
 *       - in: query
 *         name: specificDate
 *         schema:
 *           type: string
 *           format: date
 *         description: The specific date to filter by (e.g., YYYY-MM-DD)
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: The start date for the range filter (e.g., YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: The end date for the range filter (e.g., YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: An Excel file containing the users.
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         description: No users found for the selected criteria.
 */
router.get('/export', auth('getUsers'), userController.exportUsersController);

/**
 * @swagger
 * /users/me/shared-requirements:
 *   get:
 *     summary: Get all requirements shared with the currently logged-in user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of requirements shared with the user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: integer
 *                   example: 1
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       401:
 *         description: Unauthorized
 */
router.get('/me/shared-requirements', auth(), getMySharedRequirementsController);

router
  .route('/:userId')
  /**
   * @swagger
   * /users/{id}:
   *   get:
   *     summary: Get a user
   *     description: Logged in users can fetch only their own user information. Only admins can fetch other users.
   *     tags: [Users]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: User id
   *     responses:
   *       "200":
   *         description: OK
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/User'
   *       "401":
   *         $ref: '#/components/responses/Unauthorized'
   *       "403":
   *         $ref: '#/components/responses/Forbidden'
   *       "404":
   *         $ref: '#/components/responses/NotFound'
   */
  .get(auth('getUsers'), validate(userValidation.getUser), userController.getUser)
  /**
   * @swagger
   * /users/{id}:
   *   put:
   *     summary: Update a user
   *     description: Logged in users can only update their own information. Only admins can update other users.
   *     tags: [Users]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: User id
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *               email:
   *                 type: string
   *                 format: email
   *                 description: must be unique
   *               password:
   *                 type: string
   *                 format: password
   *                 minLength: 8
   *                 description: At least one number and one letter
   *             example:
   *               name: fake name
   *               email: fake@example.com
   *               password: password1
   *     responses:
   *       "200":
   *         description: OK
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/User'
   *       "400":
   *         $ref: '#/components/responses/DuplicateEmail'
   *       "401":
   *         $ref: '#/components/responses/Unauthorized'
   *       "403":
   *         $ref: '#/components/responses/Forbidden'
   *       "404":
   *         $ref: '#/components/responses/NotFound'
   */
  .put(auth('manageUsers'), validate(userValidation.updateUser), userController.updateUser)
  /**
   * @swagger
   * /users/{id}:
   *   delete:
   *     summary: Delete a user
   *     description: Logged in users can delete only themselves. Only admins can delete other users.
   *     tags: [Users]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: User id
   *     responses:
   *       "204":
   *         description: No content
   *       "401":
   *         $ref: '#/components/responses/Unauthorized'
   *       "403":
   *         $ref: '#/components/responses/Forbidden'
   *       "404":
   *         $ref: '#/components/responses/NotFound'
   */
  .delete(auth('manageUsers'), validate(userValidation.deleteUser), userController.deleteUser);

/**
 * @swagger
 * /users/{userId}/activate:
 *   patch:
 *     summary: Activate a user
 *     description: Only admins can activate a user.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User id
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *                $ref: '#/components/schemas/User'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */
router.patch('/:userId/activate', auth('manageUsers'), validate(userValidation.getUser), userController.activateUserController);

/**
 * @swagger
 * /users/{userId}/deactivate:
 *   patch:
 *     summary: Deactivate a user
 *     description: Only admins can deactivate a user.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User id
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *                $ref: '#/components/schemas/User'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */
router.patch('/:userId/deactivate', auth('manageUsers'), validate(userValidation.getUser), userController.deactivateUserController);

export default router; 