import express from 'express';
import auth from '../../middlewares/auth.js';
import validate from '../../middlewares/validate.js';
import * as walletTransactionValidation from '../../validations/walletTransaction.validation.js';
import * as walletTransactionController from '../../controllers/walletTransaction.controller.js';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     WalletTransaction:
 *       type: object
 *       required:
 *         - userId
 *         - type
 *         - amount
 *         - description
 *         - createdBy
 *         - createdByModel
 *       properties:
 *         _id:
 *           type: string
 *           description: The auto-generated id of the transaction
 *         userId:
 *           type: string
 *           description: The user ID who owns this transaction
 *         type:
 *           type: string
 *           enum: [SITE_ENGINEER_PAYMENT, ARCHITECT_PAYMENT, PROCURERMENT_PAYMENT]
 *           description: The type of transaction
 *         amount:
 *           type: number
 *           description: The transaction amount
 *         currency:
 *           type: string
 *           enum: [INR, USD, EUR]
 *           default: INR
 *           description: The currency of the transaction
 *         project:
 *           type: string
 *           description: The project ID (required for SITE_ENGINEER_PAYMENT and ARCHITECT_PAYMENT)
 *         siteVisit:
 *           type: string
 *           description: The site visit ID (required for SITE_ENGINEER_PAYMENT)
 *         requirement:
 *           type: string
 *           description: The requirement ID (required for SITE_ENGINEER_PAYMENT)
 *         description:
 *           type: string
 *           description: Transaction description
 *         notes:
 *           type: string
 *           description: Additional notes about the transaction
 *         createdBy:
 *           type: string
 *           description: The ID of the user who created this transaction
 *         createdByModel:
 *           type: string
 *           enum: [Admin, User]
 *           description: The model type of the creator
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: The date the transaction was created
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: The date the transaction was last updated
 *         formattedAmount:
 *           type: string
 *           description: The formatted amount with currency symbol
 */

/**
 * @swagger
 * /v1/wallet-transactions:
 *   get:
 *     summary: Get all wallet transactions
 *     description: Retrieve a list of all wallet transactions with filtering and pagination
 *     tags: [Wallet Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userName
 *         schema:
 *           type: string
 *         description: Filter by user name (case-insensitive search)
 *       - in: query
 *         name: projectName
 *         schema:
 *           type: string
 *         description: Filter by project name (case-insensitive search)
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [SITE_ENGINEER_PAYMENT, ARCHITECT_PAYMENT, PROCURERMENT_PAYMENT]
 *         description: Filter by transaction type
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Filter by user ID
 *       - in: query
 *         name: project
 *         schema:
 *           type: string
 *         description: Filter by project ID
 *       - in: query
 *         name: minAmount
 *         schema:
 *           type: number
 *         description: Minimum amount filter
 *       - in: query
 *         name: maxAmount
 *         schema:
 *           type: number
 *         description: Maximum amount filter
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for date range filter
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for date range filter
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *         description: Sort field and order (e.g., createdAt:desc)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of results per page
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *     responses:
 *       200:
 *         description: List of wallet transactions
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
 *                   example: Wallet transactions fetched successfully.
 *                 data:
 *                   type: object
 *                   properties:
 *                     results:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/WalletTransaction'
 *                     totalResults:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *                     currentPage:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *   post:
 *     summary: Create a new wallet transaction
 *     description: Create a new wallet transaction record
 *     tags: [Wallet Transactions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - type
 *               - amount
 *               - description
 *               - createdBy
 *               - createdByModel
 *             properties:
 *               userId:
 *                 type: string
 *                 description: The user ID who owns this transaction
 *               type:
 *                 type: string
 *                 enum: [SITE_ENGINEER_PAYMENT, ARCHITECT_PAYMENT, PROCURERMENT_PAYMENT]
 *                 description: The type of transaction
 *               amount:
 *                 type: number
 *                 description: The transaction amount
 *               currency:
 *                 type: string
 *                 enum: [INR, USD, EUR]
 *                 default: INR
 *                 description: The currency of the transaction
 *               project:
 *                 type: string
 *                 description: The project ID (required for SITE_ENGINEER_PAYMENT and ARCHITECT_PAYMENT)
 *               siteVisit:
 *                 type: string
 *                 description: The site visit ID (required for SITE_ENGINEER_PAYMENT)
 *               requirement:
 *                 type: string
 *                 description: The requirement ID (required for SITE_ENGINEER_PAYMENT)
 *               description:
 *                 type: string
 *                 description: Transaction description
 *               notes:
 *                 type: string
 *                 description: Additional notes about the transaction
 *               createdBy:
 *                 type: string
 *                 description: The ID of the user who created this transaction
 *               createdByModel:
 *                 type: string
 *                 enum: [Admin, User]
 *                 description: The model type of the creator
 *           examples:
 *             siteEngineerPayment:
 *               summary: Site Engineer Payment
 *               value:
 *                 userId: "60d0fe4f5311236168a109ca"
 *                 type: "SITE_ENGINEER_PAYMENT"
 *                 amount: 5000
 *                 currency: "INR"
 *                 project: "60d0fe4f5311236168a109cb"
 *                 siteVisit: "60d0fe4f5311236168a109cc"
 *                 requirement: "60d0fe4f5311236168a109cd"
 *                 description: "Site visit assignment payment"
 *                 notes: "Payment for site visit completion"
 *                 createdBy: "60d0fe4f5311236168a109ce"
 *                 createdByModel: "Admin"
 *             architectPayment:
 *               summary: Architect Payment
 *               value:
 *                 userId: "60d0fe4f5311236168a109cf"
 *                 type: "ARCHITECT_PAYMENT"
 *                 amount: 15000
 *                 currency: "INR"
 *                 project: "60d0fe4f5311236168a109cb"
 *                 description: "Architect design payment"
 *                 notes: "Payment for architectural design work"
 *                 createdBy: "60d0fe4f5311236168a109ce"
 *                 createdByModel: "Admin"
 *     responses:
 *       201:
 *         description: Wallet transaction created successfully
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
 *                   example: Wallet transaction created successfully.
 *                 data:
 *                   $ref: '#/components/schemas/WalletTransaction'
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */

router
    .route('/')
    .get(auth(), validate(walletTransactionValidation.getWalletTransactions), walletTransactionController.getWalletTransactions)
    .post(auth(), validate(walletTransactionValidation.createWalletTransaction), walletTransactionController.createWalletTransaction);

/**
 * @swagger
 * /v1/wallet-transactions/{transactionId}:
 *   get:
 *     summary: Get a wallet transaction by ID
 *     description: Retrieve a specific wallet transaction by its ID
 *     tags: [Wallet Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: string
 *         description: The transaction ID
 *     responses:
 *       200:
 *         description: Wallet transaction details
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
 *                   example: Wallet transaction fetched successfully.
 *                 data:
 *                   $ref: '#/components/schemas/WalletTransaction'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Transaction not found
 *   patch:
 *     summary: Update a wallet transaction
 *     description: Update an existing wallet transaction
 *     tags: [Wallet Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: string
 *         description: The transaction ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *                 description: The transaction amount
 *               currency:
 *                 type: string
 *                 enum: [INR, USD, EUR]
 *                 description: The currency of the transaction
 *               description:
 *                 type: string
 *                 description: Transaction description
 *               notes:
 *                 type: string
 *                 description: Additional notes about the transaction
 *     responses:
 *       200:
 *         description: Wallet transaction updated successfully
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
 *                   example: Wallet transaction updated successfully.
 *                 data:
 *                   $ref: '#/components/schemas/WalletTransaction'
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Transaction not found
 *   delete:
 *     summary: Delete a wallet transaction
 *     description: Delete a wallet transaction by its ID
 *     tags: [Wallet Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: string
 *         description: The transaction ID
 *     responses:
 *       204:
 *         description: Wallet transaction deleted successfully
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
 *                   example: Wallet transaction deleted successfully.
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Transaction not found
 */

router
    .route('/:transactionId')
    .get(auth(), validate(walletTransactionValidation.getWalletTransaction), walletTransactionController.getWalletTransaction)
    .patch(auth(), validate(walletTransactionValidation.updateWalletTransaction), walletTransactionController.updateWalletTransaction)
    .delete(auth(), validate(walletTransactionValidation.deleteWalletTransaction), walletTransactionController.deleteWalletTransaction);

/**
 * @swagger
 * /v1/wallet-transactions/user/{userId}:
 *   get:
 *     summary: Get wallet transactions for a specific user
 *     description: Retrieve all wallet transactions for a specific user
 *     tags: [Wallet Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The user ID
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *         description: Sort field and order (e.g., createdAt:desc)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of results per page
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *     responses:
 *       200:
 *         description: User wallet transactions
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
 *                   example: User wallet transactions fetched successfully.
 *                 data:
 *                   type: object
 *                   properties:
 *                     results:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/WalletTransaction'
 *                     totalResults:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *                     currentPage:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: User not found
 */

/**
 * @swagger
 * /v1/wallet-transactions/project/{projectId}:
 *   get:
 *     summary: Get wallet transactions for a specific project
 *     description: Retrieve all wallet transactions for a specific project
 *     tags: [Wallet Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: The project ID
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *         description: Sort field and order (e.g., createdAt:desc)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of results per page
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *     responses:
 *       200:
 *         description: Project wallet transactions
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
 *                   example: Project wallet transactions fetched successfully.
 *                 data:
 *                   type: object
 *                   properties:
 *                     results:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/WalletTransaction'
 *                     totalResults:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *                     currentPage:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Project not found
 */

/**
 * @swagger
 * /v1/wallet-transactions/my:
 *   get:
 *     summary: Get my wallet transactions
 *     description: Retrieve wallet transactions for the authenticated user
 *     tags: [Wallet Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *         description: Sort field and order (e.g., createdAt:desc)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of results per page
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *     responses:
 *       200:
 *         description: My wallet transactions
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
 *                   example: My wallet transactions fetched successfully.
 *                 data:
 *                   type: object
 *                   properties:
 *                     results:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/WalletTransaction'
 *                     totalResults:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *                     currentPage:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */

router
    .route('/user/:userId')
    .get(auth(), validate(walletTransactionValidation.getUserTransactions), walletTransactionController.getUserTransactions);

router
    .route('/project/:projectId')
    .get(auth(), validate(walletTransactionValidation.getProjectTransactions), walletTransactionController.getProjectTransactions);

router
    .route('/my')
    .get(auth(), validate(walletTransactionValidation.getMyWalletTransactions), walletTransactionController.getMyWalletTransactions);

/**
 * @swagger
 * /v1/wallet-transactions/user/{userId}/total:
 *   get:
 *     summary: Get total received amount for a specific user
 *     description: Calculate and return the total amount received by a user from wallet transactions with optional filtering
 *     tags: [Wallet Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The user ID
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [SITE_ENGINEER_PAYMENT, ARCHITECT_PAYMENT, PROCURERMENT_PAYMENT]
 *         description: Filter by transaction type
 *       - in: query
 *         name: project
 *         schema:
 *           type: string
 *         description: Filter by project ID
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for date range filter
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for date range filter
 *     responses:
 *       200:
 *         description: User total received amount
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
 *                   example: User total received amount fetched successfully.
 *                 data:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: string
 *                       description: The user ID
 *                     totalAmount:
 *                       type: number
 *                       description: Total amount received
 *                       example: 25000
 *                     totalTransactions:
 *                       type: integer
 *                       description: Total number of transactions
 *                       example: 5
 *                     currency:
 *                       type: string
 *                       description: Currency of the transactions
 *                       example: INR
 *                     typeBreakdown:
 *                       type: array
 *                       description: Breakdown of amounts by transaction type
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                             description: Transaction type
 *                             example: SITE_ENGINEER_PAYMENT
 *                           amount:
 *                             type: number
 *                             description: Total amount for this type
 *                             example: 15000
 *                           count:
 *                             type: integer
 *                             description: Number of transactions for this type
 *                             example: 3
 *                     recentTransactions:
 *                       type: array
 *                       description: Recent 5 transactions for context
 *                       items:
 *                         $ref: '#/components/schemas/WalletTransaction'
 *                     filter:
 *                       type: object
 *                       description: Applied filters
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: User not found
 */

/**
 * @swagger
 * /v1/wallet-transactions/my/total:
 *   get:
 *     summary: Get my total received amount
 *     description: Calculate and return the total amount received by the authenticated user from wallet transactions
 *     tags: [Wallet Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [SITE_ENGINEER_PAYMENT, ARCHITECT_PAYMENT, PROCURERMENT_PAYMENT]
 *         description: Filter by transaction type
 *       - in: query
 *         name: project
 *         schema:
 *           type: string
 *         description: Filter by project ID
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for date range filter
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for date range filter
 *     responses:
 *       200:
 *         description: My total received amount
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
 *                   example: My total received amount fetched successfully.
 *                 data:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: string
 *                       description: The user ID
 *                     totalAmount:
 *                       type: number
 *                       description: Total amount received
 *                       example: 25000
 *                     totalTransactions:
 *                       type: integer
 *                       description: Total number of transactions
 *                       example: 5
 *                     currency:
 *                       type: string
 *                       description: Currency of the transactions
 *                       example: INR
 *                     typeBreakdown:
 *                       type: array
 *                       description: Breakdown of amounts by transaction type
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                             description: Transaction type
 *                             example: SITE_ENGINEER_PAYMENT
 *                           amount:
 *                             type: number
 *                             description: Total amount for this type
 *                             example: 15000
 *                           count:
 *                             type: integer
 *                             description: Number of transactions for this type
 *                             example: 3
 *                     recentTransactions:
 *                       type: array
 *                       description: Recent 5 transactions for context
 *                       items:
 *                         $ref: '#/components/schemas/WalletTransaction'
 *                     filter:
 *                       type: object
 *                       description: Applied filters
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */

router
    .route('/user/:userId/total')
    .get(auth(), validate(walletTransactionValidation.getUserTotalReceivedAmount), walletTransactionController.getUserTotalReceivedAmount);

router
    .route('/my/total')
    .get(auth(), validate(walletTransactionValidation.getMyTotalReceivedAmount), walletTransactionController.getMyTotalReceivedAmount);

export default router; 