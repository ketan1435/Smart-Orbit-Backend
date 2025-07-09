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
    .get(auth('procurement', 'admin'), validate(bomValidation.getBOM), bomController.getBOM)
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
    .route('/boms/reusable')
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
    .route('/boms/submitted')
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
 * /boms/procurement-team:
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
    .route('/boms/procurement-team')
    .get(auth('getProcurementTeam'), validate(bomValidation.getProcurementTeam), bomController.getProcurementTeam);

export default router; 