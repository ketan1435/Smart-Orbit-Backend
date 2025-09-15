import express from 'express';
import { createPO, getPOs, activatePO, deactivatePO } from '../../controllers/po.controller.js';
import auth from '../../middlewares/auth.js';
import validate from '../../middlewares/validate.js';
import * as poValidation from '../../validations/po.validation.js';

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
router.get('/', auth('procurement'), validate(poValidation.getPOs), getPOs);

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
 *               vendorName:
 *                 type: string
 *                 description: Vendor name
 *               vendorWhatsappNumber:
 *                 type: string
 *                 description: Vendor WhatsApp number
 *               project:
 *                 type: string
 *                 description: Project ID
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *                 description: Optional description
 *               notes:
 *                 type: string
 *                 description: Optional notes
 *               originalBomId:
 *                 type: string
 *                 description: Original BOM ID (optional)
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
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - itemName
 *                     - units
 *                     - quantity
 *                     - unitCost
 *                   properties:
 *                     itemName:
 *                       type: string
 *                       description: Name of the item
 *                     units:
 *                       type: string
 *                       description: Unit of measurement
 *                     quantity:
 *                       type: number
 *                       minimum: 0
 *                       description: Quantity of the item
 *                     unitCost:
 *                       type: number
 *                       minimum: 0
 *                       description: Cost per unit
 *                     originalBomItemId:
 *                       type: string
 *                       description: Original BOM item ID (optional)
 *                     vendor:
 *                       type: string
 *                       description: Vendor ID for this item
 *                     vendorName:
 *                       type: string
 *                       description: Vendor name for this item
 *                     vendorWhatsappNumber:
 *                       type: string
 *                       description: Vendor WhatsApp number for this item
 *                     selected:
 *                       type: boolean
 *                       default: true
 *                       description: Whether this item is selected for the PO
 *                 description: Array of PO items
 *           example:
 *             vendor: "64f31a7b7e5d6e001f7e1234"
 *             vendorName: "John Doe"
 *             vendorWhatsappNumber: "9876543210"
 *             project: "64f31a7b7e5d6e001f7e5678"
 *             name: "PO for Steel"
 *             description: "Urgent steel order"
 *             notes: "Please deliver by end of week"
 *             originalBomId: "64f31a7b7e5d6e001f7e9999"
 *             documents:
 *               - key: "uploads/tmp/po-files/uuid1.pdf"
 *                 fileType: "pdf"
 *               - key: "uploads/tmp/po-files/uuid2.pdf"
 *                 fileType: "pdf"
 *             items:
 *               - originalBomItemId: "64f31a7b7e5d6e001f7e8888"
 *                 itemName: "Steel Rods"
 *                 units: "kg"
 *                 quantity: 100
 *                 unitCost: 50.00
 *                 vendor: "64f31a7b7e5d6e001f7e1234"
 *                 vendorName: "John Doe"
 *                 vendorWhatsappNumber: "9876543210"
 *                 selected: true
 *               - originalBomItemId: "64f31a7b7e5d6e001f7e8889"
 *                 itemName: "Cement"
 *                 units: "bags"
 *                 quantity: 50
 *                 unitCost: 300.00
 *                 vendor: "64f31a7b7e5d6e001f7e1234"
 *                 vendorName: "John Doe"
 *                 vendorWhatsappNumber: "9876543210"
 *                 selected: true
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
router.post('/', auth('procurement'), validate(poValidation.createPO), createPO);

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
router.patch('/:id/activate', auth('procurement'), validate(poValidation.activatePO), activatePO);

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
router.patch('/:id/deactivate', auth('procurement'), validate(poValidation.deactivatePO), deactivatePO);

export default router; 