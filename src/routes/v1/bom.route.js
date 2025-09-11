import express from 'express';
import auth from '../../middlewares/auth.js';
import validate from '../../middlewares/validate.js';
import * as bomValidation from '../../validations/bom.validation.js';
import * as bomController from '../../controllers/bom.controller.js';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     BOMItem:
 *       type: object
 *       required:
 *         - itemName
 *         - category
 *         - unit
 *         - quantity
 *         - estimatedUnitCost
 *       properties:
 *         itemName:
 *           type: string
 *           description: Name of the item
 *         description:
 *           type: string
 *           description: Description of the item
 *         brand:
 *           type: string
 *           description: Brand name of the item
 *         category:
 *           type: string
 *           enum: [Raw Materials, Hardware, Electrical, Plumbing, Finishing, Tools, Equipment, Other]
 *           description: Category of the item
 *         unit:
 *           type: string
 *           description: Unit of measurement (e.g., kg, pieces, meters)
 *         quantity:
 *           type: number
 *           minimum: 0
 *           description: Quantity required
 *         estimatedUnitCost:
 *           type: number
 *           minimum: 0
 *           description: Estimated cost per unit
 *         totalEstimatedCost:
 *           type: number
 *           minimum: 0
 *           description: Total estimated cost (auto-calculated)
 *         remarks:
 *           type: string
 *           description: Additional remarks for the item
 *         addedBy:
 *           type: string
 *           description: ID of the user who added the item
 *         addedAt:
 *           type: string
 *           format: date-time
 *           description: Date and time when item was added
 *
 *     BOM:
 *       type: object
 *       required:
 *         - projectId
 *         - items
 *         - createdBy
 *       properties:
 *         id:
 *           type: string
 *           description: BOM ID
 *         projectId:
 *           type: string
 *           description: Project ID this BOM belongs to
 *         proposalId:
 *           type: string
 *           description: Associated architect proposal ID
 *         sourceBOMId:
 *           type: string
 *           description: Source BOM ID if this is based on another BOM
 *         version:
 *           type: number
 *           description: Version number of the BOM
 *         isReusable:
 *           type: boolean
 *           description: Whether this BOM can be reused for other projects
 *         title:
 *           type: string
 *           description: Title/name for reusable BOMs (required when isReusable is true)
 *         status:
 *           type: string
 *           enum: [draft, submitted, approved, rejected]
 *           description: Current status of the BOM
 *         remarks:
 *           type: string
 *           description: General remarks for the BOM
 *         items:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/BOMItem'
 *           description: List of BOM items
 *         createdBy:
 *           type: string
 *           description: ID of the user who created the BOM
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: BOM creation date
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: BOM last update date
 *
 *     BOMList:
 *       type: object
 *       properties:
 *         results:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/BOM'
 *         page:
 *           type: number
 *         limit:
 *           type: number
 *         totalPages:
 *           type: number
 *         totalResults:
 *           type: number
 */

/**
 * @swagger
 * /projects/{projectId}/boms:
 *   post:
 *     summary: Create a new BOM for a project
 *     description: Create a new Bill of Materials for a specific project. Only procurement team members can create BOMs.
 *     tags: [BOM]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - items
 *             properties:
 *               proposalId:
 *                 type: string
 *                 description: Associated architect proposal ID
 *               sourceBOMId:
 *                 type: string
 *                 description: Source BOM ID if this is based on another BOM
 *               isReusable:
 *                 type: boolean
 *                 default: false
 *                 description: Whether this BOM can be reused for other projects
 *               title:
 *                 type: string
 *                 description: Title/name for reusable BOMs (required when isReusable is true)
 *               remarks:
 *                 type: string
 *                 description: General remarks for the BOM
 *               items:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   $ref: '#/components/schemas/BOMItem'
 *                 description: List of BOM items
 *     responses:
 *       "201":
 *         description: BOM created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: number
 *                   example: 1
 *                 message:
 *                   type: string
 *                   example: "BOM created successfully"
 *                 data:
 *                   $ref: '#/components/schemas/BOM'
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *
 *   get:
 *     summary: Get BOMs for a project
 *     description: Retrieve all BOMs for a specific project with pagination and filtering.
 *     tags: [BOM]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, submitted, approved, rejected]
 *         description: Filter by BOM status
 *       - in: query
 *         name: version
 *         schema:
 *           type: number
 *           minimum: 1
 *         description: Filter by BOM version
 *       - in: query
 *         name: isReusable
 *         schema:
 *           type: boolean
 *         description: Filter by reusable flag
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
 *         description: Maximum number of BOMs
 *       - in: query
 *         name: archetectDocumentId
 *         schema:
 *           type: string
 *         description: Filter by architect document ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *     responses:
 *       "200":
 *         description: BOMs fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: number
 *                   example: 1
 *                 message:
 *                   type: string
 *                   example: "BOMs fetched successfully"
 *                 data:
 *                   $ref: '#/components/schemas/BOMList'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */
router
    .route('/projects/:projectId/boms')
    .post(auth('createBoms'), validate(bomValidation.createBOM), bomController.createBOM)
    .get(auth('getBoms'), validate(bomValidation.getBOMs), bomController.getBOMs);

/**
 * @swagger
 * /boms/projects/{projectId}/finalized:
 *   post:
 *     summary: Finalize BOM with vendor assignments
 *     description: Update the original BOM with vendor assignments from quote analysis
 *     tags: [BOM]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - originalBomId
 *               - finalizedItems
 *             properties:
 *               originalBomId:
 *                 type: string
 *                 description: ID of the original BOM to be finalized
 *               finalizedItems:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - itemName
 *                     - category
 *                     - unit
 *                     - quantity
 *                     - estimatedUnitCost
 *                     - vendor
 *                   properties:
 *                     itemName:
 *                       type: string
 *                       description: Name of the item
 *                     description:
 *                       type: string
 *                       description: Description of the item
 *                     category:
 *                       type: string
 *                       enum: [Raw Materials, Hardware, Electrical, Plumbing, Finishing, Tools, Equipment, Other]
 *                       description: Category of the item
 *                     unit:
 *                       type: string
 *                       description: Unit of measurement
 *                     quantity:
 *                       type: number
 *                       minimum: 0
 *                       description: Quantity required
 *                     estimatedUnitCost:
 *                       type: number
 *                       minimum: 0
 *                       description: Original estimated cost per unit
 *                     finalPrice:
 *                       type: number
 *                       minimum: 0
 *                       description: Final price from selected quote
 *                     remarks:
 *                       type: string
 *                       description: Additional remarks
 *                     vendor:
 *                       type: string
 *                       description: Selected vendor ID
 *                     selectedQuoteId:
 *                       type: string
 *                       description: ID of the selected quote
 *                     brand:
 *                       type: string
 *                       description: Brand from quote
 *                     grade:
 *                       type: string
 *                       description: Grade from quote
 *                     warranty:
 *                       type: string
 *                       description: Warranty from quote
 *                     certification:
 *                       type: string
 *                       description: Certification from quote
 *                     deliveryTime:
 *                       type: string
 *                       description: Delivery time from quote
 *                     paymentTerms:
 *                       type: string
 *                       description: Payment terms from quote
 *                     vendorNotes:
 *                       type: string
 *                       description: Vendor notes from quote
 *     responses:
 *       "201":
 *         description: BOM finalized successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: number
 *                   example: 1
 *                 message:
 *                   type: string
 *                   example: "BOM finalized successfully with vendor assignments"
 *                 data:
 *                   $ref: '#/components/schemas/BOM'
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */
router
    .route('/projects/:projectId/finalized')
    .post(auth(), bomController.createFinalizedBOM);

/**
 * @swagger
 * /projects/{projectId}/boms/{bomId}:
 *   get:
 *     summary: Get a specific BOM
 *     description: Retrieve a specific BOM by its ID.
 *     tags: [BOM]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID
 *       - in: path
 *         name: bomId
 *         required: true
 *         schema:
 *           type: string
 *         description: BOM ID
 *     responses:
 *       "200":
 *         description: BOM fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: number
 *                   example: 1
 *                 message:
 *                   type: string
 *                   example: "BOM fetched successfully"
 *                 data:
 *                   $ref: '#/components/schemas/BOM'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *
 *   patch:
 *     summary: Update a BOM
 *     description: Update a BOM. Only BOMs in draft status can be updated.
 *     tags: [BOM]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID
 *       - in: path
 *         name: bomId
 *         required: true
 *         schema:
 *           type: string
 *         description: BOM ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             minProperties: 1
 *             properties:
 *               proposalId:
 *                 type: string
 *                 description: Associated architect proposal ID
 *               isReusable:
 *                 type: boolean
 *                 description: Whether this BOM can be reused for other projects
 *               title:
 *                 type: string
 *                 description: Title/name for reusable BOMs (required when isReusable is true)
 *               remarks:
 *                 type: string
 *                 description: General remarks for the BOM
 *               items:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   $ref: '#/components/schemas/BOMItem'
 *                 description: List of BOM items
 *     responses:
 *       "200":
 *         description: BOM updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: number
 *                   example: 1
 *                 message:
 *                   type: string
 *                   example: "BOM updated successfully"
 *                 data:
 *                   $ref: '#/components/schemas/BOM'
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *
 *   delete:
 *     summary: Delete a BOM
 *     description: Delete a BOM. Only BOMs in draft status can be deleted.
 *     tags: [BOM]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID
 *       - in: path
 *         name: bomId
 *         required: true
 *         schema:
 *           type: string
 *         description: BOM ID
 *     responses:
 *       "204":
 *         description: BOM deleted successfully
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */
router
    .route('/projects/:projectId/boms/:bomId')
    .get(auth('procurement', 'admin', 'site-engineer'), validate(bomValidation.getBOM), bomController.getBOM)
    .patch(auth('procurement'), validate(bomValidation.updateBOM), bomController.updateBOM)
    .delete(auth('procurement'), validate(bomValidation.deleteBOM), bomController.deleteBOM);

/**
 * @swagger
 * /projects/{projectId}/boms/{bomId}/status:
 *   patch:
 *     summary: Update BOM status
 *     description: Update the status of a BOM (submit, approve, reject).
 *     tags: [BOM]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID
 *       - in: path
 *         name: bomId
 *         required: true
 *         schema:
 *           type: string
 *         description: BOM ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [draft, submitted, approved, rejected]
 *                 description: New status for the BOM
 *               remarks:
 *                 type: string
 *                 description: Remarks for the status change
 *     responses:
 *       "200":
 *         description: BOM status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: number
 *                   example: 1
 *                 message:
 *                   type: string
 *                   example: "BOM status updated successfully"
 *                 data:
 *                   $ref: '#/components/schemas/BOM'
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */
router
    .route('/projects/:projectId/boms/:bomId/status')
    .patch(auth('admin', 'procurement'), validate(bomValidation.updateBOMStatus), bomController.updateBOMStatus);

/**
 * @swagger
 * /boms/reusable:
 *   get:
 *     summary: Get reusable BOMs
 *     description: Retrieve all BOMs that are marked as reusable and approved.
 *     tags: [BOM]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *         description: Maximum number of BOMs
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *     responses:
 *       "200":
 *         description: Reusable BOMs fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: number
 *                   example: 1
 *                 message:
 *                   type: string
 *                   example: "Reusable BOMs fetched successfully"
 *                 data:
 *                   $ref: '#/components/schemas/BOMList'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 */
router
    .route('/reusable')
    .get(auth('getReusableBOMs'), bomController.getReusableBOMs);

/**
 * @swagger
 * /projects/{projectId}/boms/{bomId}/submit:
 *   patch:
 *     summary: Submit BOM for admin review
 *     description: Submit a BOM for admin review. Changes status from draft to submitted.
 *     tags: [BOM]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID
 *       - in: path
 *         name: bomId
 *         required: true
 *         schema:
 *           type: string
 *         description: BOM ID
 *     responses:
 *       "200":
 *         description: BOM submitted for review successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: number
 *                   example: 1
 *                 message:
 *                   type: string
 *                   example: "BOM submitted for review successfully"
 *                 data:
 *                   $ref: '#/components/schemas/BOM'
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */
router
    .route('/projects/:projectId/boms/:bomId/submit')
    .patch(auth('submitBOM'), validate(bomValidation.submitBOM), bomController.submitBOM);

/**
 * @swagger
 * /boms/submitted:
 *   get:
 *     summary: Get submitted BOMs for admin review
 *     description: Retrieve all BOMs that are submitted and waiting for admin review. Can filter by specific procurement team member.
 *     tags: [BOM]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: createdBy
 *         schema:
 *           type: string
 *         description: Filter by procurement team member ID (user ID who created the BOM)
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *         description: sort by query in the form of field:desc/asc (ex. updatedAt:desc)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *         default: 10
 *         description: Maximum number of BOMs
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *     responses:
 *       "200":
 *         description: Submitted BOMs fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: number
 *                   example: 1
 *                 message:
 *                   type: string
 *                   example: "Submitted BOMs fetched successfully"
 *                 data:
 *                   $ref: '#/components/schemas/BOMList'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 */
router
    .route('/submitted')
    .get(auth('getBoms'), validate(bomValidation.getSubmittedBOMs), bomController.getSubmittedBOMs);

/**
 * @swagger
 * /projects/{projectId}/boms/{bomId}/review:
 *   patch:
 *     summary: Review BOM (admin approve/reject)
 *     description: Admin can approve or reject a submitted BOM with remarks.
 *     tags: [BOM]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID
 *       - in: path
 *         name: bomId
 *         required: true
 *         schema:
 *           type: string
 *         description: BOM ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *               - adminRemarks
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [approved, rejected]
 *                 description: Review decision
 *               adminRemarks:
 *                 type: string
 *                 description: Admin remarks for the review decision
 *     responses:
 *       "200":
 *         description: BOM reviewed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: number
 *                   example: 1
 *                 message:
 *                   type: string
 *                   example: "BOM approved successfully"
 *                 data:
 *                   $ref: '#/components/schemas/BOM'
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */
router
    .route('/projects/:projectId/boms/:bomId/review')
    .patch(auth('reviewBOM'), validate(bomValidation.reviewBOM), bomController.reviewBOM);

/**
 * @swagger
 * /boms/planning-engineer:
 *   get:
 *     summary: Get procurement team members
 *     description: Retrieve all active procurement team members for filtering and selection purposes.
 *     tags: [BOM]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *           maximum: 100
 *         default: 50
 *         description: Maximum number of team members
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *     responses:
 *       "200":
 *         description: Procurement team members fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: number
 *                   example: 1
 *                 message:
 *                   type: string
 *                   example: "Procurement team members fetched successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     results:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                             description: User ID
 *                           name:
 *                             type: string
 *                             description: User name
 *                           email:
 *                             type: string
 *                             description: User email
 *                     page:
 *                       type: number
 *                     limit:
 *                       type: number
 *                     totalPages:
 *                       type: number
 *                     totalResults:
 *                       type: number
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 */
router
    .route('/planning-engineer')
    .get(auth('getProcurementTeam'), validate(bomValidation.getProcurementTeam), bomController.getProcurementTeam);

/**
 * @swagger
 * /boms:
 *   get:
 *     summary: Get all BOMs
 *     description: Retrieve all BOMs with optional filtering and pagination.
 *     tags: [BOM]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Maximum number of BOMs
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *         description: Sort by query in the form of field:desc/asc (ex. createdAt:desc)
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, submitted, pending, approved, rejected]
 *         description: Filter by BOM status
 *       - in: query
 *         name: projectId
 *         schema:
 *           type: string
 *         description: Filter by project ID
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in BOM title or description
 *     responses:
 *       "200":
 *         description: BOMs fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: number
 *                   example: 1
 *                 message:
 *                   type: string
 *                   example: "BOMs fetched successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     results:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/BOM'
 *                     page:
 *                       type: number
 *                     limit:
 *                       type: number
 *                     totalPages:
 *                       type: number
 *                     totalResults:
 *                       type: number
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 */
router
    .route('/')
    .get(auth('getBoms'), validate(bomValidation.getAllBOMs), bomController.getAllBOMs);

/**
 * @swagger
 * /projects/{projectId}/boms/{bomId}/assign-site-engineer:
 *   post:
 *     summary: Assign BOM to site engineer
 *     description: Assign a rough BOM to a site engineer for review and updates.
 *     tags: [BOM]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID
 *       - in: path
 *         name: bomId
 *         required: true
 *         schema:
 *           type: string
 *         description: BOM ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - siteEngineerId
 *             properties:
 *               siteEngineerId:
 *                 type: string
 *                 description: ID of the site engineer to assign the BOM to
 *     responses:
 *       "200":
 *         description: BOM assigned successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: number
 *                   example: 1
 *                 message:
 *                   type: string
 *                   example: "BOM assigned to site engineer successfully"
 *                 data:
 *                   $ref: '#/components/schemas/BOM'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */
router
    .route('/projects/:projectId/boms/:bomId/assign-site-engineer')
    .post(auth('assignBOMToSiteEngineer'), bomController.assignBOMToSiteEngineer);

/**
 * @swagger
 * /boms/site-engineer:
 *   get:
 *     summary: Get BOMs assigned to site engineer
 *     description: Retrieve BOMs that are assigned to the authenticated site engineer.
 *     tags: [BOM]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Maximum number of BOMs
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *         description: Sort by query in the form of field:desc/asc (ex. assignedAt:desc)
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [site_engineer_review, site_engineer_updated]
 *         description: Filter by BOM status
 *       - in: query
 *         name: projectId
 *         schema:
 *           type: string
 *         description: Filter by project ID
 *     responses:
 *       "200":
 *         description: Site engineer BOMs fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: number
 *                   example: 1
 *                 message:
 *                   type: string
 *                   example: "Site engineer BOMs fetched successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     results:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/BOM'
 *                     page:
 *                       type: number
 *                     limit:
 *                       type: number
 *                     totalPages:
 *                       type: number
 *                     totalResults:
 *                       type: number
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 */
router
    .route('/site-engineer')
    .get(auth('getSiteEngineerBOMs'), bomController.getSiteEngineerBOMs);

/**
 * @swagger
 * /boms/site-engineer/{bomId}:
 *   get:
 *     summary: Get BOM details for site engineer
 *     description: Retrieve details of a specific BOM assigned to the authenticated site engineer.
 *     tags: [BOM]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bomId
 *         required: true
 *         schema:
 *           type: string
 *         description: BOM ID
 *     responses:
 *       "200":
 *         description: BOM details fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: number
 *                   example: 1
 *                 message:
 *                   type: string
 *                   example: "BOM fetched successfully"
 *                 data:
 *                   $ref: '#/components/schemas/BOM'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */
router
    .route('/site-engineer/:bomId')
    .get(auth('getSiteEngineerBOMs'), bomController.getBOMForSiteEngineer);

/**
 * @swagger
 * /projects/{projectId}/boms/{bomId}/update-by-site-engineer:
 *   put:
 *     summary: Update BOM by site engineer
 *     description: Update a BOM that is assigned to the authenticated site engineer.
 *     tags: [BOM]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID
 *       - in: path
 *         name: bomId
 *         required: true
 *         schema:
 *           type: string
 *         description: BOM ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/BOMItem'
 *                 description: Updated BOM items
 *               remarks:
 *                 type: string
 *                 description: General remarks for the BOM
 *               siteEngineerRemarks:
 *                 type: string
 *                 description: Site engineer specific remarks
 *     responses:
 *       "200":
 *         description: BOM updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: number
 *                   example: 1
 *                 message:
 *                   type: string
 *                   example: "BOM updated by site engineer successfully"
 *                 data:
 *                   $ref: '#/components/schemas/BOM'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */
router
    .route('/projects/:projectId/boms/:bomId/update-by-site-engineer')
    .put(auth('updateBOMBySiteEngineer'), bomController.updateBOMBySiteEngineer);

/**
 * @swagger
 * /projects/{projectId}/boms/{bomId}/submit-to-planning:
 *   post:
 *     summary: Submit updated BOM to planning engineer
 *     description: Submit an updated BOM from site engineer to planning engineer for review.
 *     tags: [BOM]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: Project ID
 *       - in: path
 *         name: bomId
 *         required: true
 *         schema:
 *           type: string
 *         description: BOM ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 description: Title for the updated BOM
 *               remarks:
 *                 type: string
 *                 description: Remarks for the planning engineer
 *     responses:
 *       "200":
 *         description: Updated BOM submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: number
 *                   example: 1
 *                 message:
 *                   type: string
 *                   example: "Updated BOM submitted to planning engineer successfully"
 *                 data:
 *                   $ref: '#/components/schemas/BOM'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */
router
    .route('/projects/:projectId/boms/:bomId/submit-to-planning')
    .post(auth('submitUpdatedBOMToPlanning'), bomController.submitUpdatedBOMToPlanning);

/**
 * @swagger
 * /boms/planning-review:
 *   get:
 *     summary: Get rough BOMs for planning engineer review
 *     description: Retrieve BOMs that are ready for planning engineer review.
 *     tags: [BOM]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Maximum number of BOMs
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *         description: Sort by query in the form of field:desc/asc (ex. createdAt:desc)
 *       - in: query
 *         name: projectId
 *         schema:
 *           type: string
 *         description: Filter by project ID
 *     responses:
 *       "200":
 *         description: Rough BOMs for planning review fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: number
 *                   example: 1
 *                 message:
 *                   type: string
 *                   example: "Rough BOMs for planning review fetched successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     results:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/BOM'
 *                     page:
 *                       type: number
 *                     limit:
 *                       type: number
 *                     totalPages:
 *                       type: number
 *                     totalResults:
 *                       type: number
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 */
router
    .route('/planning-review')
    .get(auth('getRoughBOMsForPlanning'), bomController.getRoughBOMsForPlanning);

/**
 * @swagger
 * /boms/site-engineers:
 *   get:
 *     summary: Get site engineers list
 *     description: Retrieve list of all site engineers.
 *     tags: [BOM]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Maximum number of site engineers
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *         description: Sort by query in the form of field:desc/asc (ex. name:asc)
 *     responses:
 *       "200":
 *         description: Site engineers fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: number
 *                   example: 1
 *                 message:
 *                   type: string
 *                   example: "Site engineers fetched successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     results:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           email:
 *                             type: string
 *                           phone:
 *                             type: string
 *                           role:
 *                             type: string
 *                     page:
 *                       type: number
 *                     limit:
 *                       type: number
 *                     totalPages:
 *                       type: number
 *                     totalResults:
 *                       type: number
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 */
router
    .route('/site-engineers')
    .get(auth('getSiteEngineers'), bomController.getSiteEngineers);

/**
 * @swagger
 * /boms/finalized:
 *   get:
 *     summary: Get finalized BOMs for selection
 *     description: Retrieve all finalized BOMs that can be used as templates for new BOMs.
 *     tags: [BOM]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Maximum number of BOMs
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *         description: Sort by query in the form of field:desc/asc (ex. finalizedAt:desc)
 *       - in: query
 *         name: projectId
 *         schema:
 *           type: string
 *         description: Filter by project ID
 *     responses:
 *       "200":
 *         description: Finalized BOMs fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: number
 *                   example: 1
 *                 message:
 *                   type: string
 *                   example: "Finalized BOMs fetched successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     results:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/BOM'
 *                     page:
 *                       type: number
 *                     limit:
 *                       type: number
 *                     totalPages:
 *                       type: number
 *                     totalResults:
 *                       type: number
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 */
router
    .route('/finalized')
    .get(auth('getBoms'), bomController.getFinalizedBOMs);

export default router; 