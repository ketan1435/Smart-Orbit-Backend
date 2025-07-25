import express from 'express';
import { createVendor, getVendors, activateVendor, deactivateVendor, getVendorsDropdown } from '../../controllers/vendor.controller.js';
import auth from '../../middlewares/auth.js';

const router = express.Router();

/**
 * @swagger
 * /vendors/dropdown:
 *   get:
 *     summary: Get all vendors for dropdown (with optional filters)
 *     tags: [Vendors]
 *     parameters:
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *         description: Filter by vendor name (case-insensitive)
 *       - in: query
 *         name: storeName
 *         schema:
 *           type: string
 *         description: Filter by store name (case-insensitive)
 *       - in: query
 *         name: city
 *         schema:
 *           type: string
 *         description: Filter by city (case-insensitive)
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *         description: Filter by state (case-insensitive)
 *       - in: query
 *         name: country
 *         schema:
 *           type: string
 *         description: Filter by country (case-insensitive)
 *       - in: query
 *         name: gstNo
 *         schema:
 *           type: string
 *         description: Filter by GST number (case-insensitive)
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *     responses:
 *       200:
 *         description: List of vendors for dropdown
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
 *                     properties:
 *                       _id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       storeName:
 *                         type: string
 */
router.get('/dropdown', getVendorsDropdown);

/**
 * @swagger
 * /vendors:
 *   get:
 *     summary: Get a list of vendors with pagination and filters
 *     tags: [Vendors]
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
 *         name: name
 *         schema:
 *           type: string
 *         description: Filter by vendor name (case-insensitive)
 *       - in: query
 *         name: storeName
 *         schema:
 *           type: string
 *         description: Filter by store name (case-insensitive)
 *       - in: query
 *         name: city
 *         schema:
 *           type: string
 *         description: Filter by city (case-insensitive)
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *         description: Filter by state (case-insensitive)
 *       - in: query
 *         name: country
 *         schema:
 *           type: string
 *         description: Filter by country (case-insensitive)
 *       - in: query
 *         name: gstNo
 *         schema:
 *           type: string
 *         description: Filter by GST number (case-insensitive)
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *     responses:
 *       200:
 *         description: List of vendors
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
router.get('/', auth(), getVendors);

/**
 * @swagger
 * /vendors:
 *   post:
 *     summary: Create a new vendor
 *     tags: [Vendors]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - storeName
 *               - mobileNumber
 *               - email
 *               - address
 *               - city
 *               - state
 *               - country
 *             properties:
 *               name:
 *                 type: string
 *               storeName:
 *                 type: string
 *               mobileNumber:
 *                 type: string
 *               email:
 *                 type: string
 *               address:
 *                 type: string
 *               city:
 *                 type: string
 *               state:
 *                 type: string
 *               country:
 *                 type: string
 *               gstNo:
 *                 type: string
 *                 description: GST number (optional)
 *           example:
 *             name: "Vendor Name"
 *             storeName: "Store Name"
 *             mobileNumber: "1234567890"
 *             email: "vendor@example.com"
 *             address: "123 Main St"
 *             city: "City"
 *             state: "State"
 *             country: "Country"
 *             gstNo: "GST1234"
 *     responses:
 *       201:
 *         description: Vendor created successfully
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
 *                   example: Vendor created successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     storeName:
 *                       type: string
 *                     mobileNumber:
 *                       type: string
 *                     email:
 *                       type: string
 *                     address:
 *                       type: string
 *                     city:
 *                       type: string
 *                     state:
 *                       type: string
 *                     country:
 *                       type: string
 *                     gstNo:
 *                       type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 */
router.post('/', auth(), createVendor);

/**
 * @swagger
 * /vendors/{id}/activate:
 *   patch:
 *     summary: Activate a vendor
 *     tags: [Vendors]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The vendor ID
 *     responses:
 *       200:
 *         description: Vendor activated
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
 *                   example: Vendor activated
 *                 data:
 *                   type: object
 *       404:
 *         description: Vendor not found
 */
router.patch('/:id/activate', auth(), activateVendor);

/**
 * @swagger
 * /vendors/{id}/deactivate:
 *   patch:
 *     summary: Deactivate a vendor
 *     tags: [Vendors]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The vendor ID
 *     responses:
 *       200:
 *         description: Vendor deactivated
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
 *                   example: Vendor deactivated
 *                 data:
 *                   type: object
 *       404:
 *         description: Vendor not found
 */
router.patch('/:id/deactivate', auth(), deactivateVendor);

export default router; 