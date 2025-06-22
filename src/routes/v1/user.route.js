import express from 'express';
import auth from '../../middlewares/auth.js';
import validate from '../../middlewares/validate.js';
import { userValidation } from '../../validations/index.js';
import { userController } from '../../controllers/index.js';

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

export default router; 