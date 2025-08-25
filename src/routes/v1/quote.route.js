import express from 'express';
import {
    createQuoteController,
    getQuotesController,
    getQuoteByIdController,
    updateQuoteController,
    deleteQuoteController,
    getQuotesByBOMController,
    getQuoteComparisonController,
    reviewQuoteController,
    bulkCreateQuotesController,
    getQuoteStatsController,
    updateExpiredQuotesController,
    getMyQuotesController,
    getQuotesForReviewController,
    submitQuoteController,
    acceptQuoteController,
    rejectQuoteController
} from '../../controllers/quote.controller.js';
import {
    createQuoteService,
    updateQuoteService,
    bulkCreateQuotesService,
    createQuote
} from '../../services/quote.service.js';
import validate from '../../middlewares/validate.js';
import {
    createQuoteValidation,
    updateQuoteValidation,
    getQuotesValidation,
    getQuoteComparisonValidation,
    bulkQuoteValidation
} from '../../validations/quote.validation.js';
import auth from '../../middlewares/auth.js';
import quoteAuth from '../../middlewares/quoteAuth.js';
import { transactional } from '../../utils/transactional.js';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     QuoteItemAttachment:
 *       type: object
 *       properties:
 *         type:
 *           type: string
 *           enum: [quote-document, product-image, catalog, other]
 *           description: Type of attachment
 *         fileKey:
 *           type: string
 *           description: S3 file key (from Phase 1 upload)
 *         fileName:
 *           type: string
 *           description: Original file name
 *       required:
 *         - type
 *         - fileKey
 *         - fileName
 *     
 *     QuoteAttachment:
 *       type: object
 *       properties:
 *         type:
 *           type: string
 *           enum: [quote-document, catalog, terms, other]
 *           description: Type of quote attachment
 *         fileKey:
 *           type: string
 *           description: S3 file key (from Phase 1 upload)
 *         fileName:
 *           type: string
 *           description: Original file name
 *       required:
 *         - type
 *         - fileKey
 *         - fileName
 *     
 *     QuoteItem:
 *       type: object
 *       properties:
 *         bomItemId:
 *           type: string
 *           description: BOM item ID
 *         itemName:
 *           type: string
 *           description: Item name
 *         specification:
 *           type: string
 *           description: Item specification
 *         availabilityStatus:
 *           type: string
 *           enum: [available, not-available, limited, out-of-stock]
 *         availableQuantity:
 *           type: number
 *           minimum: 0
 *         restockTime:
 *           type: number
 *           minimum: 0
 *           description: Days until restock
 *         unitPrice:
 *           type: number
 *           minimum: 0
 *         quantity:
 *           type: number
 *           minimum: 1
 *         totalPrice:
 *           type: number
 *           minimum: 0
 *         currency:
 *           type: string
 *           default: INR
 *         priceType:
 *           type: string
 *           enum: [per-unit, bulk, negotiable]
 *         brand:
 *           type: string
 *         grade:
 *           type: string
 *         warranty:
 *           type: string
 *         certification:
 *           type: string
 *         deliveryTime:
 *           type: number
 *           minimum: 0
 *         deliveryCost:
 *           type: number
 *           minimum: 0
 *         minimumOrderQuantity:
 *           type: number
 *           minimum: 0
 *         paymentTerms:
 *           type: string
 *           enum: [advance, credit, cod, partial]
 *         creditDays:
 *           type: number
 *           minimum: 0
 *         notes:
 *           type: string
 *         alternatives:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               itemName:
 *                 type: string
 *               price:
 *                 type: number
 *               availability:
 *                 type: string
 *                 enum: [available, not-available, limited]
 *         attachments:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/QuoteItemAttachment'
 *       required:
 *         - bomItemId
 *         - itemName
 *         - availabilityStatus
 *         - unitPrice
 *         - quantity
 *         - totalPrice
 *     
 *     CreateQuoteRequest:
 *       type: object
 *       properties:
 *         bomId:
 *           type: string
 *           description: BOM ID
 *         projectId:
 *           type: string
 *           description: Project ID
 *         vendorId:
 *           type: string
 *           description: Vendor ID
 *         quoteTitle:
 *           type: string
 *           description: Quote title
 *         quoteItems:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/QuoteItem'
 *           minItems: 1
 *         totalAmount:
 *           type: number
 *           minimum: 0
 *         currency:
 *           type: string
 *           default: INR
 *         validityDays:
 *           type: number
 *           minimum: 1
 *           default: 30
 *         overallDeliveryTime:
 *           type: number
 *           minimum: 0
 *         overallDeliveryCost:
 *           type: number
 *           minimum: 0
 *         overallPaymentTerms:
 *           type: string
 *           enum: [advance, credit, cod, partial]
 *         overallCreditDays:
 *           type: number
 *           minimum: 0
 *         status:
 *           type: string
 *           enum: [draft, submitted, reviewed, accepted, rejected, expired]
 *           default: draft
 *         siteEngineerNotes:
 *           type: string
 *         notes:
 *           type: string
 *         quoteAttachments:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/QuoteAttachment'
 *       required:
 *         - bomId
 *         - projectId
 *         - vendorId
 *         - quoteTitle
 *         - quoteItems
 *         - totalAmount
 */

/**
 * @swagger
 * /quotes:
 *   post:
 *     summary: Create a new quote
 *     description: |
 *       Creates a new quote with file attachments. Files must be uploaded first using the file upload endpoint.
 *       The request body should contain file keys (not actual files) that reference previously uploaded files.
 *     tags: [Quotes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateQuoteRequest'
 *           example:
 *             bomId: "507f1f77bcf86cd799439011"
 *             projectId: "507f1f77bcf86cd799439012"
 *             vendorId: "507f1f77bcf86cd799439013"
 *             quoteTitle: "Steel and Cement Quote"
 *             quoteItems:
 *               - bomItemId: "507f1f77bcf86cd799439014"
 *                 itemName: "Steel TMT 500D"
 *                 specification: "Grade 500D, 12mm diameter"
 *                 availabilityStatus: "available"
 *                 availableQuantity: 1000
 *                 unitPrice: 45000
 *                 quantity: 500
 *                 totalPrice: 22500000
 *                 currency: "INR"
 *                 priceType: "per-unit"
 *                 brand: "Tata Steel"
 *                 deliveryTime: 7
 *                 paymentTerms: "advance"
 *                 attachments:
 *                   - type: "product-image"
 *                     fileKey: "uploads/tmp/quote-images/steel-image-123.jpg"
 *                     fileName: "steel-image.jpg"
 *             totalAmount: 22500000
 *             currency: "INR"
 *             validityDays: 30
 *             overallDeliveryTime: 7
 *             overallPaymentTerms: "advance"
 *             quoteAttachments:
 *               - type: "quote-document"
 *                 fileKey: "uploads/tmp/quote-documents/quote-pdf-456.pdf"
 *                 fileName: "quote-document.pdf"
 *     responses:
 *       201:
 *         description: Quote created successfully
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
 *                   example: "Quote created successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Quote'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: BOM, Vendor, or User not found
 *       500:
 *         description: Internal server error
 */
router.post('/', quoteAuth(), validate(createQuoteValidation), transactional(createQuoteService));
router.get('/', auth(), validate(getQuotesValidation), getQuotesController);
router.get('/:id', auth(), getQuoteByIdController);
/**
 * @swagger
 * /quotes/{id}:
 *   put:
 *     summary: Update a quote
 *     description: |
 *       Updates an existing quote with file attachments. Files must be uploaded first using the file upload endpoint.
 *       The request body should contain file keys (not actual files) that reference previously uploaded files.
 *     tags: [Quotes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Quote ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateQuoteRequest'
 *           example:
 *             quoteTitle: "Updated Steel and Cement Quote"
 *             quoteItems:
 *               - bomItemId: "507f1f77bcf86cd799439014"
 *                 itemName: "Steel TMT 500D"
 *                 specification: "Grade 500D, 12mm diameter"
 *                 availabilityStatus: "available"
 *                 availableQuantity: 1000
 *                 unitPrice: 45000
 *                 quantity: 500
 *                 totalPrice: 22500000
 *                 currency: "INR"
 *                 priceType: "per-unit"
 *                 brand: "Tata Steel"
 *                 deliveryTime: 7
 *                 paymentTerms: "advance"
 *                 attachments:
 *                   - type: "product-image"
 *                     fileKey: "uploads/tmp/quote-images/updated-steel-image-789.jpg"
 *                     fileName: "updated-steel-image.jpg"
 *             totalAmount: 22500000
 *             currency: "INR"
 *             validityDays: 30
 *             overallDeliveryTime: 7
 *             overallPaymentTerms: "advance"
 *             quoteAttachments:
 *               - type: "quote-document"
 *                 fileKey: "uploads/tmp/quote-documents/updated-quote-pdf-101.pdf"
 *                 fileName: "updated-quote-document.pdf"
 *     responses:
 *       200:
 *         description: Quote updated successfully
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
 *                   example: "Quote updated successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Quote'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Quote not found
 *       500:
 *         description: Internal server error
 */
router.put('/:id', quoteAuth(), validate(updateQuoteValidation), transactional(updateQuoteService));
router.delete('/:id', auth(), deleteQuoteController);

// BOM-specific operations
router.get('/bom/:bomId', auth(), getQuotesByBOMController);
router.get('/comparison/:bomId', auth(), getQuoteComparisonController);

// Review operations
router.post('/:id/review', auth(), reviewQuoteController);
router.post('/:id/submit', auth(), submitQuoteController);
router.post('/:id/accept', auth(), acceptQuoteController);
router.post('/:id/reject', auth(), rejectQuoteController);

/**
 * @swagger
 * /quotes/bulk:
 *   post:
 *     summary: Bulk create quotes
 *     description: |
 *       Creates multiple quotes in a single request with file attachments. Files must be uploaded first using the file upload endpoint.
 *       The request body should contain file keys (not actual files) that reference previously uploaded files.
 *     tags: [Quotes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               bomId:
 *                 type: string
 *                 description: BOM ID
 *               projectId:
 *                 type: string
 *                 description: Project ID
 *               quotes:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/CreateQuoteRequest'
 *                 minItems: 1
 *             required:
 *               - bomId
 *               - projectId
 *               - quotes
 *           example:
 *             bomId: "507f1f77bcf86cd799439011"
 *             projectId: "507f1f77bcf86cd799439012"
 *             quotes:
 *               - vendorId: "507f1f77bcf86cd799439013"
 *                 quoteTitle: "Vendor A Quote"
 *                 quoteItems:
 *                   - bomItemId: "507f1f77bcf86cd799439014"
 *                     itemName: "Steel TMT 500D"
 *                     availabilityStatus: "available"
 *                     unitPrice: 45000
 *                     quantity: 500
 *                     totalPrice: 22500000
 *                     attachments:
 *                       - type: "product-image"
 *                         fileKey: "uploads/tmp/quote-images/vendor-a-steel-123.jpg"
 *                         fileName: "vendor-a-steel.jpg"
 *                 totalAmount: 22500000
 *                 quoteAttachments:
 *                   - type: "quote-document"
 *                     fileKey: "uploads/tmp/quote-documents/vendor-a-quote-456.pdf"
 *                     fileName: "vendor-a-quote.pdf"
 *               - vendorId: "507f1f77bcf86cd799439015"
 *                 quoteTitle: "Vendor B Quote"
 *                 quoteItems:
 *                   - bomItemId: "507f1f77bcf86cd799439014"
 *                     itemName: "Steel TMT 500D"
 *                     availabilityStatus: "available"
 *                     unitPrice: 44000
 *                     quantity: 500
 *                     totalPrice: 22000000
 *                     attachments:
 *                       - type: "product-image"
 *                         fileKey: "uploads/tmp/quote-images/vendor-b-steel-789.jpg"
 *                         fileName: "vendor-b-steel.jpg"
 *                 totalAmount: 22000000
 *                 quoteAttachments:
 *                   - type: "quote-document"
 *                     fileKey: "uploads/tmp/quote-documents/vendor-b-quote-101.pdf"
 *                     fileName: "vendor-b-quote.pdf"
 *     responses:
 *       201:
 *         description: Quotes created successfully
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
 *                   example: "2 quotes created successfully"
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Quote'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: BOM, Vendor, or User not found
 *       500:
 *         description: Internal server error
 */
router.post('/bulk', quoteAuth(), validate(bulkQuoteValidation), transactional(bulkCreateQuotesService));

// Statistics and utilities
router.get('/stats', auth(), getQuoteStatsController);
router.post('/update-expired', auth(), updateExpiredQuotesController);

// User-specific operations
router.get('/my-quotes', auth(), getMyQuotesController);
router.get('/for-review', auth(), getQuotesForReviewController);

export default router;
