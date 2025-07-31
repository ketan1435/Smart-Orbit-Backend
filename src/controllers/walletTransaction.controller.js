import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync.js';
import pick from '../utils/pick.js';
import * as walletTransactionService from '../services/walletTransaction.service.js';

/**
 * Get wallet transactions
 */
export const getWalletTransactions = catchAsync(async (req, res) => {
    const filter = pick(req.query, ['userName', 'projectName', 'type', 'userId', 'project', 'minAmount', 'maxAmount', 'startDate', 'endDate']);
    const options = pick(req.query, ['sortBy', 'limit', 'page']);
    const result = await walletTransactionService.queryWalletTransactions(filter, options);
    res.status(httpStatus.OK).send({
        status: 1,
        message: 'Wallet transactions fetched successfully.',
        data: result
    });
});

/**
 * Get wallet transaction by id
 */
export const getWalletTransaction = catchAsync(async (req, res) => {
    const transaction = await walletTransactionService.getWalletTransactionById(req.params.transactionId);
    res.status(httpStatus.OK).send({
        status: 1,
        message: 'Wallet transaction fetched successfully.',
        data: transaction
    });
});

/**
 * Create wallet transaction
 */
export const createWalletTransaction = catchAsync(async (req, res) => {
    const transaction = await walletTransactionService.createWalletTransaction(req.body);
    res.status(httpStatus.CREATED).send({
        status: 1,
        message: 'Wallet transaction created successfully.',
        data: transaction
    });
});

/**
 * Update wallet transaction by id
 */
export const updateWalletTransaction = catchAsync(async (req, res) => {
    const transaction = await walletTransactionService.updateWalletTransactionById(req.params.transactionId, req.body);
    res.status(httpStatus.OK).send({
        status: 1,
        message: 'Wallet transaction updated successfully.',
        data: transaction
    });
});

/**
 * Delete wallet transaction by id
 */
export const deleteWalletTransaction = catchAsync(async (req, res) => {
    await walletTransactionService.deleteWalletTransactionById(req.params.transactionId);
    res.status(httpStatus.NO_CONTENT).send({
        status: 1,
        message: 'Wallet transaction deleted successfully.'
    });
});

/**
 * Get wallet transactions for a specific user
 */
export const getUserTransactions = catchAsync(async (req, res) => {
    const options = pick(req.query, ['sortBy', 'limit', 'page']);
    const result = await walletTransactionService.getUserWalletTransactions(req.params.userId, options);
    res.status(httpStatus.OK).send({
        status: 1,
        message: 'User wallet transactions fetched successfully.',
        data: result
    });
});

/**
 * Get wallet transactions for a specific project
 */
export const getProjectTransactions = catchAsync(async (req, res) => {
    const options = pick(req.query, ['sortBy', 'limit', 'page']);
    const result = await walletTransactionService.getProjectWalletTransactions(req.params.projectId, options);
    res.status(httpStatus.OK).send({
        status: 1,
        message: 'Project wallet transactions fetched successfully.',
        data: result
    });
});

/**
 * Get my wallet transactions (for authenticated user)
 */
export const getMyWalletTransactions = catchAsync(async (req, res) => {
    const options = pick(req.query, ['sortBy', 'limit', 'page']);
    const result = await walletTransactionService.getUserWalletTransactions(req.user.id, options);
    res.status(httpStatus.OK).send({
        status: 1,
        message: 'My wallet transactions fetched successfully.',
        data: result
    });
});

/**
 * Get total received amount for a user
 */
export const getUserTotalReceivedAmount = catchAsync(async (req, res) => {
    const filter = pick(req.query, ['project', 'startDate', 'endDate']);
    const result = await walletTransactionService.getUserTotalReceivedAmount(req.params.userId, filter);
    res.status(httpStatus.OK).send({
        status: 1,
        message: 'User total received amount fetched successfully.',
        data: result
    });
});

/**
 * Get my total received amount (for authenticated user)
 */
export const getMyTotalReceivedAmount = catchAsync(async (req, res) => {
    const filter = pick(req.query, ['type', 'project', 'startDate', 'endDate']);
    const result = await walletTransactionService.getUserTotalReceivedAmount(req.user.id, filter);
    res.status(httpStatus.OK).send({
        status: 1,
        message: 'My total received amount fetched successfully.',
        data: result
    });
}); 