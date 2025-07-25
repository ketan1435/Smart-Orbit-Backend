import express from 'express';
import { createPO, getPOs, activatePO, deactivatePO } from '../../controllers/po.controller.js';
import auth from '../../middlewares/auth.js';

const router = express.Router();

/**
 * @swagger
 * /pos:
 *   get:
 *     summary: Get a list of purchase orders (POs) with pagination and filters
 *     tags: [POs]
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
 *         name: vendor
 *         schema:
 *           type: string
 *         description: Filter by vendor ID
 *       - in: query
 *         name: project
 *         schema:
 *           type: string
 *         description: Filter by project ID
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *         description: Filter by PO name (case-insensitive)
 *     responses:
 *       200:
 *         description: List of POs
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
 *                 page:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 total:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 */
router.get('/', auth(), getPOs);

/**
 * @swagger
 * /pos:
 *   post:
 *     summary: Create a new purchase order (PO)
 *     tags: [POs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - vendor
 *               - project
 *               - name
 *               - documents
 *             properties:
 *               vendor:
 *                 type: string
 *                 description: Vendor ID
 *               project:
 *                 type: string
 *                 description: Project ID
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *                 description: Optional description
 *               documents:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - key
 *                     - fileType
 *                   properties:
 *                     key:
 *                       type: string
 *                       description: S3 key from initiate-upload
 *                     fileType:
 *                       type: string
 *                       description: File type (e.g., pdf, document)
 *                 description: Array of file references (not binary)
 *           example:
 *             vendor: "64f31a7b7e5d6e001f7e1234"
 *             project: "64f31a7b7e5d6e001f7e5678"
 *             name: "PO for Steel"
 *             description: "Urgent steel order"
 *             documents:
 *               - key: "uploads/tmp/po-files/uuid1.pdf"
 *                 fileType: "pdf"
 *               - key: "uploads/tmp/po-files/uuid2.pdf"
 *                 fileType: "pdf"
 *     responses:
 *       201:
 *         description: PO created successfully
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
 *                   example: PO created successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     vendor:
 *                       type: string
 *                     project:
 *                       type: string
 *                     name:
 *                       type: string
 *                     description:
 *                       type: string
 *                     documents:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           key:
 *                             type: string
 *                           fileType:
 *                             type: string
 *                           uploadedAt:
 *                             type: string
 *                             format: date-time
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 */
router.post('/', auth(), createPO);

// /**
//  * @swagger
//  * /pos/{id}:
//  *   delete:
//  *     summary: Delete a purchase order (PO) by ID
//  *     tags: [POs]
//  *     security:
//  *       - bearerAuth: []
//  *     parameters:
//  *       - in: path
//  *         name: id
//  *         required: true
//  *         schema:
//  *           type: string
//  *         description: The PO ID
//  *     responses:
//  *       200:
//  *         description: PO deleted successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 status:
//  *                   type: integer
//  *                   example: 1
//  *                 message:
//  *                   type: string
//  *                   example: PO deleted successfully
//  *                 data:
//  *                   type: object
//  *       404:
//  *         description: PO not found
//  */
// router.delete('/:id', auth(), deletePO);

/**
 * @swagger
 * /pos/{id}/activate:
 *   patch:
 *     summary: Activate a purchase order (PO)
 *     tags: [POs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The PO ID
 *     responses:
 *       200:
 *         description: PO activated
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
 *                   example: PO activated
 *                 data:
 *                   type: object
 *       404:
 *         description: PO not found
 */
router.patch('/:id/activate', auth(), activatePO);

/**
 * @swagger
 * /pos/{id}/deactivate:
 *   patch:
 *     summary: Deactivate a purchase order (PO)
 *     tags: [POs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The PO ID
 *     responses:
 *       200:
 *         description: PO deactivated
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
 *                   example: PO deactivated
 *                 data:
 *                   type: object
 *       404:
 *         description: PO not found
 */
router.patch('/:id/deactivate', auth(), deactivatePO);

export default router; 