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
 * /users/site-engineers:
 *   get:
 *     summary: Get all site engineers
 *     description: Retrieve a list of all users with the 'site-engineer' role.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *         description: Filter by site engineer name
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
 *               $ref: '#/components/schemas/UserPagedResults'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/site-engineers', auth('getUsers'), userController.getSiteEngineers);

router.get('/me/site-visits', auth('getSiteVisits'), userController.getMySiteVisits);

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

/**
 * @swagger
 * /users/site-engineer/workers:
 *   post:
 *     summary: Create a worker or fabricator (Site Engineer only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - mobileNumber
 *               - role
 *             properties:
 *               name:
 *                 type: string
 *                 description: Full name of the worker/fabricator
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email address
 *               mobileNumber:
 *                 type: string
 *                 description: Mobile number
 *               role:
 *                 type: string
 *                 enum: [worker, fabricator]
 *                 description: Role of the user
 *               password:
 *                 type: string
 *                 description: Password (optional, will be auto-generated if not provided)
 *           example:
 *             name: "John Worker"
 *             email: "john.worker@example.com"
 *             mobileNumber: "+1234567890"
 *             role: "worker"
 *     responses:
 *       201:
 *         description: Worker created successfully
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
 *                   example: Worker created successfully
 *                 data:
 *                   type: object
 *       403:
 *         description: Only site engineers can create workers
 *       400:
 *         description: Invalid role or data
 */
router.post('/site-engineer/workers', auth('manageWorkers'), validate(userValidation.createWorkerBySiteEngineer), userController.createWorker);

/**
 * @swagger
 * /users/site-engineer/workers:
 *   get:
 *     summary: Get workers and fabricators created by the authenticated site engineer
 *     tags: [Users]
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
 *         name: role
 *         schema:
 *           type: string
 *           enum: [worker, fabricator]
 *         description: Filter by role
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *         description: Filter by name
 *       - in: query
 *         name: email
 *         schema:
 *           type: string
 *         description: Filter by email
 *       - in: query
 *         name: mobileNumber
 *         schema:
 *           type: string
 *         description: Filter by mobile number
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *     responses:
 *       200:
 *         description: Workers retrieved successfully
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
 *                   example: My workers retrieved successfully
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
 *                       mobileNumber:
 *                         type: string
 *                       role:
 *                         type: string
 *                       isActive:
 *                         type: boolean
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                 page:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 total:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 */
router.get('/site-engineer/workers', auth('getWorkers'), userController.getMyWorkers);

/**
 * @swagger
 * /users/site-engineer/workers/{id}:
 *   put:
 *     summary: Update a worker or fabricator (Site Engineer only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Worker ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Full name of the worker/fabricator
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email address
 *               mobileNumber:
 *                 type: string
 *                 description: Mobile number
 *               role:
 *                 type: string
 *                 enum: [worker, fabricator]
 *                 description: Role of the user
 *               isActive:
 *                 type: boolean
 *                 description: Active status
 *           example:
 *             name: "John Worker Updated"
 *             email: "john.updated@example.com"
 *             mobileNumber: "+1234567890"
 *             role: "fabricator"
 *             isActive: true
 *     responses:
 *       200:
 *         description: Worker updated successfully
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
 *                   example: Worker updated successfully
 *                 data:
 *                   type: object
 *       403:
 *         description: Only site engineers can update workers or worker not found
 *       404:
 *         description: Worker not found
 */
router.put('/site-engineer/workers/:id', auth('manageWorkers'), validate(userValidation.updateWorkerBySiteEngineer), userController.updateWorker);

/**
 * @swagger
 * /users/site-engineer/workers/{id}/activate:
 *   patch:
 *     summary: Activate a worker or fabricator (Site Engineer only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Worker ID
 *     responses:
 *       200:
 *         description: Worker activated successfully
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
 *                   example: Worker activated successfully
 *                 data:
 *                   type: object
 *       403:
 *         description: Only site engineers can activate workers or worker not found
 *       404:
 *         description: Worker not found
 */
router.patch('/site-engineer/workers/:id/activate', auth('manageWorkers'), userController.activateWorker);

/**
 * @swagger
 * /users/site-engineer/workers/{id}/deactivate:
 *   patch:
 *     summary: Deactivate a worker or fabricator (Site Engineer only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Worker ID
 *     responses:
 *       200:
 *         description: Worker deactivated successfully
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
 *                   example: Worker deactivated successfully
 *                 data:
 *                   type: object
 *       403:
 *         description: Only site engineers can deactivate workers or worker not found
 *       404:
 *         description: Worker not found
 */
router.patch('/site-engineer/workers/:id/deactivate', auth('manageWorkers'), userController.deactivateWorker);

/**
 * @swagger
 * /users/{userId}:
 *   patch:
 *     summary: Update a user
 *     description: >-
 *       Admin and Sales Admin can update any user. Site Engineer can update only workers/fabricators they created. Workers/fabricators cannot use this API.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The user ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/User'
 *           example:
 *             name: "John Doe"
 *             email: "john@example.com"
 *             phoneNumber: "1234567890"
 *             city: "New York"
 *             region: "NY"
 *             address: "123 Main St"
 *             education: "Masters in Architecture"
 *             experience: "5 years"
 *             profilePictureKey: "uploads/tmp/user-avatars/some-uuid.jpg"
 *             isActive: true
 *     responses:
 *       "200":
 *         description: User updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *
 * /users/{userId}/password:
 *   patch:
 *     summary: Reset a user's password
 *     description: >-
 *       Admin and Sales Admin can reset password for any user. Site Engineer can reset password for workers/fabricators they created. Workers/fabricators cannot use this API. This is a forced reset (no old password required).
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The user ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               password:
 *                 type: string
 *                 description: New password (must meet password rules)
 *           example:
 *             password: "newPassword123"
 *     responses:
 *       "200":
 *         description: Password reset successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */
router.patch(
  '/:userId',
  auth('manageUsers'),
  validate(userValidation.updateUser),
  userController.updateUserById
);

router.patch(
  '/:userId/password',
  auth('manageUsers'),
  validate(userValidation.resetUserPassword),
  userController.resetUserPasswordById
);

export default router; 