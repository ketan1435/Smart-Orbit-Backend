import express from 'express';
import validate from '../../middlewares/validate.js';
import auth from '../../middlewares/auth.js';
import * as clientProposalValidation from '../../validations/clientProposal.validation.js';
import * as clientProposalController from '../../controllers/clientProposal.controller.js';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     CustomerInfo:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         name:
 *           type: string
 *           description: Customer name
 *           example: "John Doe"
 *         email:
 *           type: string
 *           format: email
 *           description: Customer email address
 *           example: "john.doe@example.com"
 *         phone:
 *           type: string
 *           description: Customer phone number
 *           example: "+1234567890"
 *         address:
 *           type: string
 *           description: Customer address
 *           example: "123 Main St, City, State 12345"
 *
 *     ClientProposal:
 *       type: object
 *       required:
 *         - project
 *         - customerInfo
 *       properties:
 *         id:
 *           type: string
 *           description: Client proposal ID
 *           example: "507f1f77bcf86cd799439011"
 *         project:
 *           type: string
 *           description: Project ID this proposal belongs to
 *           example: "507f1f77bcf86cd799439012"
 *         customerInfo:
 *           $ref: '#/components/schemas/CustomerInfo'
 *         proposalFor:
 *           type: string
 *           description: What the proposal is for
 *           example: "Residential Cottage Construction"
 *         projectLocation:
 *           type: string
 *           description: Location of the project
 *           example: "Downtown Area, City"
 *         projectType:
 *           type: string
 *           description: Type of project
 *           example: "Residential"
 *         unitCost:
 *           type: string
 *           description: Cost per unit
 *           example: "$150,000"
 *         manufacturingSupply:
 *           type: string
 *           description: Manufacturing and supply details (HTML content)
 *           example: "<p>High-quality materials from certified suppliers</p>"
 *         projectOverview:
 *           type: string
 *           description: Project overview (HTML content)
 *           example: "<h2>Project Overview</h2><p>Modern residential cottage...</p>"
 *         cottageSpecifications:
 *           type: string
 *           description: Cottage specifications (HTML content)
 *           example: "<h3>Specifications</h3><ul><li>3 bedrooms</li><li>2 bathrooms</li></ul>"
 *         materialDetails:
 *           type: string
 *           description: Material details (HTML content)
 *           example: "<h3>Materials</h3><p>Premium grade materials...</p>"
 *         costBreakdown:
 *           type: string
 *           description: Detailed cost breakdown (HTML content)
 *           example: "<h3>Cost Breakdown</h3><table>...</table>"
 *         paymentTerms:
 *           type: string
 *           description: Payment terms (HTML content)
 *           example: "<h3>Payment Terms</h3><p>30% upfront, 40% at midpoint...</p>"
 *         salesTerms:
 *           type: string
 *           description: Sales terms and conditions (HTML content)
 *           example: "<h3>Sales Terms</h3><p>Standard terms apply...</p>"
 *         contactInformation:
 *           type: string
 *           description: Contact information (HTML content)
 *           example: "<h3>Contact</h3><p>Phone: +1234567890</p>"
 *         status:
 *           type: string
 *           enum: [draft, sent, approved, rejected, archived]
 *           default: draft
 *           description: Current status of the proposal
 *           example: "draft"
 *         version:
 *           type: number
 *           default: 1
 *           description: Version number of the proposal
 *           example: 1
 *         createdBy:
 *           type: string
 *           description: ID of the user who created the proposal
 *           example: "507f1f77bcf86cd799439013"
 *         updatedBy:
 *           type: string
 *           description: ID of the user who last updated the proposal
 *           example: "507f1f77bcf86cd799439013"
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Creation timestamp
 *           example: "2024-01-15T10:30:00.000Z"
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 *           example: "2024-01-15T10:30:00.000Z"
 *
 *     ClientProposalList:
 *       type: object
 *       properties:
 *         results:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ClientProposal'
 *         page:
 *           type: number
 *           description: Current page number
 *           example: 1
 *         limit:
 *           type: number
 *           description: Number of items per page
 *           example: 10
 *         totalPages:
 *           type: number
 *           description: Total number of pages
 *           example: 5
 *         totalResults:
 *           type: number
 *           description: Total number of results
 *           example: 50
 */

/**
 * @swagger
 * /client-proposals:
 *   post:
 *     summary: Create a new client proposal
 *     description: Create a new client proposal with all the required information including customer details, project specifications, and WYSIWYG content sections.
 *     tags: [Client Proposals]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - project
 *               - customerInfo
 *             properties:
 *               project:
 *                 type: string
 *                 description: Project ID this proposal belongs to
 *                 example: "507f1f77bcf86cd799439012"
 *               customerInfo:
 *                 $ref: '#/components/schemas/CustomerInfo'
 *               proposalFor:
 *                 type: string
 *                 description: What the proposal is for
 *                 example: "Residential Cottage Construction"
 *               projectLocation:
 *                 type: string
 *                 description: Location of the project
 *                 example: "Downtown Area, City"
 *               projectType:
 *                 type: string
 *                 description: Type of project
 *                 example: "Residential"
 *               unitCost:
 *                 type: string
 *                 description: Cost per unit
 *                 example: "$150,000"
 *               manufacturingSupply:
 *                 type: string
 *                 description: Manufacturing and supply details (HTML content)
 *                 example: "<p>High-quality materials from certified suppliers</p>"
 *               projectOverview:
 *                 type: string
 *                 description: Project overview (HTML content)
 *                 example: "<h2>Project Overview</h2><p>Modern residential cottage...</p>"
 *               cottageSpecifications:
 *                 type: string
 *                 description: Cottage specifications (HTML content)
 *                 example: "<h3>Specifications</h3><ul><li>3 bedrooms</li><li>2 bathrooms</li><li>Open concept living</li></ul>"
 *               materialDetails:
 *                 type: string
 *                 description: Material details (HTML content)
 *                 example: "<h3>Materials</h3><p>Premium grade materials including hardwood floors, granite countertops</p>"
 *               costBreakdown:
 *                 type: string
 *                 description: Detailed cost breakdown (HTML content)
 *                 example: "<h3>Cost Breakdown</h3><table><tr><td>Materials</td><td>$80,000</td></tr><tr><td>Labor</td><td>$50,000</td></tr><tr><td>Overhead</td><td>$20,000</td></tr></table>"
 *               paymentTerms:
 *                 type: string
 *                 description: Payment terms (HTML content)
 *                 example: "<h3>Payment Terms</h3><p>30% upfront, 40% at midpoint, 30% upon completion</p>"
 *               salesTerms:
 *                 type: string
 *                 description: Sales terms and conditions (HTML content)
 *                 example: "<h3>Sales Terms</h3><p>Standard terms apply. 1-year warranty included.</p>"
 *               contactInformation:
 *                 type: string
 *                 description: Contact information (HTML content)
 *                 example: "<h3>Contact</h3><p>Phone: +1234567890<br>Email: sales@company.com</p>"
 *               status:
 *                 type: string
 *                 enum: [draft, sent, approved, rejected, archived]
 *                 default: draft
 *                 description: Initial status of the proposal
 *                 example: "draft"
 *               version:
 *                 type: number
 *                 minimum: 1
 *                 default: 1
 *                 description: Version number of the proposal
 *                 example: 1
 *           example:
 *             project: "507f1f77bcf86cd799439012"
 *             customerInfo:
 *               name: "John Doe"
 *               email: "john.doe@example.com"
 *               phone: "+1234567890"
 *               address: "123 Main St, City, State 12345"
 *             proposalFor: "Residential Cottage Construction"
 *             projectLocation: "Downtown Area, City"
 *             projectType: "Residential"
 *             unitCost: "$150,000"
 *             manufacturingSupply: "<p>High-quality materials from certified suppliers</p>"
 *             projectOverview: "<h2>Project Overview</h2><p>Modern residential cottage with premium finishes</p>"
 *             cottageSpecifications: "<h3>Specifications</h3><ul><li>3 bedrooms</li><li>2 bathrooms</li><li>Open concept living</li></ul>"
 *             materialDetails: "<h3>Materials</h3><p>Premium grade materials including hardwood floors, granite countertops</p>"
 *             costBreakdown: "<h3>Cost Breakdown</h3><table><tr><td>Materials</td><td>$80,000</td></tr><tr><td>Labor</td><td>$50,000</td></tr><tr><td>Overhead</td><td>$20,000</td></tr></table>"
 *             paymentTerms: "<h3>Payment Terms</h3><p>30% upfront, 40% at midpoint, 30% upon completion</p>"
 *             salesTerms: "<h3>Sales Terms</h3><p>Standard terms apply. 1-year warranty included.</p>"
 *             contactInformation: "<h3>Contact</h3><p>Phone: +1234567890<br>Email: sales@company.com</p>"
 *             status: "draft"
 *             version: 1
 *     responses:
 *       "201":
 *         description: Client proposal created successfully
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
 *                   example: "Client proposal created successfully"
 *                 data:
 *                   $ref: '#/components/schemas/ClientProposal'
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *
 *   get:
 *     summary: Get all client proposals
 *     description: Retrieve all client proposals with pagination, sorting, and filtering options. Supports filtering by project, customer name, proposal type, location, status, and creator.
 *     tags: [Client Proposals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: project
 *         schema:
 *           type: string
 *         description: Filter by project ID
 *         example: "507f1f77bcf86cd799439012"
 *       - in: query
 *         name: customerInfo.name
 *         schema:
 *           type: string
 *         description: Filter by customer name
 *         example: "John Doe"
 *       - in: query
 *         name: proposalFor
 *         schema:
 *           type: string
 *         description: Filter by proposal purpose
 *         example: "Residential Cottage Construction"
 *       - in: query
 *         name: projectLocation
 *         schema:
 *           type: string
 *         description: Filter by project location
 *         example: "Downtown Area"
 *       - in: query
 *         name: projectType
 *         schema:
 *           type: string
 *         description: Filter by project type
 *         example: "Residential"
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, sent, approved, rejected, archived]
 *         description: Filter by proposal status
 *         example: "draft"
 *       - in: query
 *         name: createdBy
 *         schema:
 *           type: string
 *         description: Filter by creator user ID
 *         example: "507f1f77bcf86cd799439013"
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *         description: Sort field and direction (e.g., createdAt:desc, status:asc)
 *         example: "createdAt:desc"
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of items per page
 *         example: 10
 *       - in: query
 *         name: page
 *         schema:
 *           type: number
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *         example: 1
 *     responses:
 *       "200":
 *         description: Client proposals retrieved successfully
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
 *                   example: "Client proposals fetched successfully"
 *                 data:
 *                   $ref: '#/components/schemas/ClientProposalList'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 */

/**
 * @swagger
 * /client-proposals/my-proposals:
 *   get:
 *     summary: Get current user's client proposals
 *     description: Retrieve all client proposals created by the currently authenticated user. This endpoint automatically filters proposals to show only those created by the logged-in user.
 *     tags: [Client Proposals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *         description: Sort field and direction (e.g., createdAt:desc, status:asc, version:desc)
 *         example: "createdAt:desc"
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of items per page
 *         example: 10
 *       - in: query
 *         name: page
 *         schema:
 *           type: number
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *         example: 1
 *     responses:
 *       "200":
 *         description: User's client proposals retrieved successfully
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
 *                   example: "My client proposals fetched successfully"
 *                 data:
 *                   $ref: '#/components/schemas/ClientProposalList'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 */

/**
 * @swagger
 * /client-proposals/sent-to-me:
 *   get:
 *     summary: Get proposals sent to the current user for approval
 *     description: Retrieve all client proposals that have been sent to the currently authenticated user (customer) for approval. Supports pagination and sorting.
 *     tags: [Client Proposals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *         description: Sort field and direction (e.g., createdAt:desc, status:asc)
 *         example: "createdAt:desc"
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of items per page
 *         example: 10
 *       - in: query
 *         name: page
 *         schema:
 *           type: number
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *         example: 1
 *     responses:
 *       "200":
 *         description: Proposals sent to the user fetched successfully
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
 *                   example: "Proposals sent to me fetched successfully"
 *                 data:
 *                   $ref: '#/components/schemas/ClientProposalList'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 */

/**
 * @swagger
 * /client-proposals/{clientProposalId}:
 *   get:
 *     summary: Get a specific client proposal
 *     description: Retrieve detailed information about a specific client proposal by its ID. Returns the complete proposal data including all WYSIWYG content sections, customer information, and metadata.
 *     tags: [Client Proposals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clientProposalId
 *         required: true
 *         schema:
 *           type: string
 *         description: Client proposal ID
 *         example: "507f1f77bcf86cd799439011"
 *     responses:
 *       "200":
 *         description: Client proposal retrieved successfully
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
 *                   example: "Client proposal fetched successfully"
 *                 data:
 *                   $ref: '#/components/schemas/ClientProposal'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         description: Client proposal not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: number
 *                   example: 0
 *                 message:
 *                   type: string
 *                   example: "Client proposal not found"
 *                 data:
 *                   type: null
 *                   example: null
 */

/**
 * @swagger
 * /client-proposals/{clientProposalId}/pdf:
 *   get:
 *     summary: Generate PDF for a client proposal
 *     description: Generate and download a PDF version of a specific client proposal. The PDF includes all proposal details, customer information, and formatted content sections.
 *     tags: [Client Proposals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clientProposalId
 *         required: true
 *         schema:
 *           type: string
 *         description: Client proposal ID
 *         example: "507f1f77bcf86cd799439011"
 *     responses:
 *       "200":
 *         description: PDF generated successfully
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *             example: "PDF binary data"
 *         headers:
 *           Content-Disposition:
 *             description: Filename for download
 *             schema:
 *               type: string
 *               example: "attachment; filename=client-proposal-507f1f77bcf86cd799439011.pdf"
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         description: Client proposal not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: number
 *                   example: 0
 *                 message:
 *                   type: string
 *                   example: "Client proposal not found"
 *                 data:
 *                   type: null
 *                   example: null
 *       "500":
 *         description: PDF generation failed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: number
 *                   example: 0
 *                 message:
 *                   type: string
 *                   example: "PDF generation failed: Internal server error"
 *                 data:
 *                   type: null
 *                   example: null
 */

/**
 * @swagger
 * /client-proposals/{clientProposalId}/send-to-customer:
 *   post:
 *     summary: Send client proposal to customer
 *     description: Send an approved client proposal to the customer for review. This changes the proposal status to 'sent' and marks it as sent to customer.
 *     tags: [Client Proposals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clientProposalId
 *         required: true
 *         schema:
 *           type: string
 *         description: Client proposal ID
 *         example: "507f1f77bcf86cd799439011"
 *     responses:
 *       "200":
 *         description: Client proposal sent to customer successfully
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
 *                   example: "Client proposal sent to customer successfully"
 *                 data:
 *                   $ref: '#/components/schemas/ClientProposal'
 *       "400":
 *         description: Only approved proposals can be sent to customers
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: number
 *                   example: 0
 *                 message:
 *                   type: string
 *                   example: "Only approved proposals can be sent to customers"
 *                 data:
 *                   type: null
 *                   example: null
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *
 * @swagger
 * /client-proposals/{clientProposalId}/customer-review:
 *   patch:
 *     summary: Customer review of client proposal
 *     description: Allow customers to review and approve/reject a client proposal that has been sent to them.
 *     tags: [Client Proposals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clientProposalId
 *         required: true
 *         schema:
 *           type: string
 *         description: Client proposal ID
 *         example: "507f1f77bcf86cd799439011"
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
 *                 enum: [approved, rejected]
 *                 description: Customer's decision on the proposal
 *                 example: "approved"
 *               remarks:
 *                 type: string
 *                 description: Customer's remarks (required if status is rejected)
 *                 example: "The proposal looks good, but we need some modifications to the payment terms."
 *           example:
 *             status: "approved"
 *             remarks: "The proposal looks good, but we need some modifications to the payment terms."
 *     responses:
 *       "200":
 *         description: Customer review submitted successfully
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
 *                   example: "Client proposal approved successfully"
 *                 data:
 *                   $ref: '#/components/schemas/ClientProposal'
 *       "400":
 *         description: Proposal has not been sent to customer or remarks required for rejection
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: number
 *                   example: 0
 *                 message:
 *                   type: string
 *                   example: "Proposal has not been sent to customer"
 *                 data:
 *                   type: null
 *                   example: null
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */

router
    .route('/')
    .post(
        auth(),
        validate(clientProposalValidation.createClientProposal),
        clientProposalController.createClientProposal
    )
    .get(
        auth(),
        validate(clientProposalValidation.getClientProposals),
        clientProposalController.getClientProposals
    );

router
    .route('/my-proposals')
    .get(
        auth(),
        clientProposalController.getMyClientProposals
    );

router
    .route('/sent-to-me')
    .get(
        auth(),
        clientProposalController.getSentToMeProposals
    );

router
    .route('/:clientProposalId')
    .get(
        auth(),
        validate(clientProposalValidation.getClientProposal),
        clientProposalController.getClientProposal
    )
    .patch(
        auth(),
        validate(clientProposalValidation.updateClientProposal),
        clientProposalController.updateClientProposal
    )
    .delete(
        auth(),
        validate(clientProposalValidation.deleteClientProposal),
        clientProposalController.deleteClientProposal
    );

router
    .route('/:clientProposalId/status')
    .patch(
        auth(),
        validate(clientProposalValidation.updateClientProposalStatus),
        clientProposalController.updateClientProposalStatus
    );

router
    .route('/:clientProposalId/versions')
    .post(
        auth(),
        validate(clientProposalValidation.createNewVersion),
        clientProposalController.createNewVersion
    );

router
    .route('/:clientProposalId/pdf')
    .get(
        auth(),
        validate(clientProposalValidation.getClientProposalPDF),
        clientProposalController.getClientProposalPDF
    );

router
    .route('/:clientProposalId/send-to-customer')
    .post(
        auth(),
        validate(clientProposalValidation.sendToCustomer),
        clientProposalController.sendToCustomer
    );

router
    .route('/:clientProposalId/customer-review')
    .patch(
        auth(),
        validate(clientProposalValidation.customerReview),
        clientProposalController.customerReview
    );

export default router;
