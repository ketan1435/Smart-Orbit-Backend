import httpStatus from 'http-status';
import WalletTransaction from '../models/walletTransaction.model.js';
import ApiError from '../utils/ApiError.js';
import Project from '../models/project.model.js';
import User from '../models/user.model.js';
import mongoose from 'mongoose';

/**
 * Query wallet transactions
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @param {string} [options.sortBy] - Sort option in the format: sortField:(desc|asc)
 * @param {number} [options.limit] - Maximum number of results per page (default = 10)
 * @param {number} [options.page] - Current page (default = 1)
 * @returns {Promise<QueryResult>}
 */
export const queryWalletTransactions = async (filter, options) => {
    const { limit = 10, page = 1, sortBy } = options;

    let sort;
    if (typeof sortBy === 'string') {
        const [field, order] = sortBy.split(':');
        sort = { [field]: order === 'desc' ? -1 : 1 };
    } else if (typeof sortBy === 'object' && sortBy !== null) {
        sort = sortBy;
    } else {
        sort = { createdAt: -1 };
    }

    // Build the filter object
    const mongoFilter = {};

    // Handle user name filtering
    if (filter.userName) {
        const users = await User.find({
            name: { $regex: filter.userName, $options: 'i' }
        }).select('_id');
        const userIds = users.map(u => u._id);
        mongoFilter.userId = { $in: userIds };
    }

    // Handle project name filtering
    if (filter.projectName) {
        const projects = await Project.find({
            projectName: { $regex: filter.projectName, $options: 'i' }
        }).select('_id');
        const projectIds = projects.map(p => p._id);
        mongoFilter.project = { $in: projectIds };
    }

    // Handle transaction type filtering
    if (filter.type) {
        mongoFilter.type = filter.type;
    }

    // Handle user ID filtering
    if (filter.userId) {
        mongoFilter.userId = filter.userId;
    }

    // Handle project ID filtering
    if (filter.project) {
        mongoFilter.project = filter.project;
    }

    // Handle amount range filtering
    if (filter.minAmount || filter.maxAmount) {
        mongoFilter.amount = {};
        if (filter.minAmount) {
            mongoFilter.amount.$gte = parseFloat(filter.minAmount);
        }
        if (filter.maxAmount) {
            mongoFilter.amount.$lte = parseFloat(filter.maxAmount);
        }
    }

    // Handle date range filtering
    if (filter.startDate || filter.endDate) {
        mongoFilter.createdAt = {};
        if (filter.startDate) {
            mongoFilter.createdAt.$gte = new Date(filter.startDate);
        }
        if (filter.endDate) {
            mongoFilter.createdAt.$lte = new Date(filter.endDate);
        }
    }

    const transactions = await WalletTransaction.find(mongoFilter)
        .populate({
            path: 'userId',
            select: 'name email role phoneNumber'
        })
        .populate({
            path: 'project',
            select: 'projectName projectCode status budget',
            populate: {
                path: 'lead',
                select: 'customerName mobileNumber email'
            }
        })
        .populate({
            path: 'siteVisit',
            select: 'visitDate status'
        })
        .populate({
            path: 'requirement',
            select: 'requirementType requirementDescription'
        })
        .populate({
            path: 'createdBy',
            select: 'name email role'
        })
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

    const totalResults = await WalletTransaction.countDocuments(mongoFilter);

    return {
        results: transactions,
        page,
        limit,
        totalPages: Math.ceil(totalResults / limit),
        totalResults,
    };
};

/**
 * Get wallet transaction by id
 * @param {ObjectId} id
 * @returns {Promise<WalletTransaction>}
 */
export const getWalletTransactionById = async (id) => {
    const transaction = await WalletTransaction.findById(id)
        .populate('userId', 'name email role phoneNumber')
        .populate('project', 'projectName projectCode status budget')
        .populate('siteVisit', 'visitDate status')
        .populate('requirement', 'requirementType requirementDescription')
        .populate('createdBy', 'name email role');

    if (!transaction) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Wallet transaction not found');
    }
    return transaction;
};

/**
 * Create wallet transaction
 * @param {Object} transactionBody
 * @returns {Promise<WalletTransaction>}
 */
export const createWalletTransaction = async (transactionBody) => {
    const transaction = await WalletTransaction.create(transactionBody);
    return transaction;
};

/**
 * Update wallet transaction by id
 * @param {ObjectId} transactionId
 * @param {Object} updateBody
 * @returns {Promise<WalletTransaction>}
 */
export const updateWalletTransactionById = async (transactionId, updateBody) => {
    const transaction = await getWalletTransactionById(transactionId);
    Object.assign(transaction, updateBody);
    await transaction.save();
    return transaction;
};

/**
 * Delete wallet transaction by id
 * @param {ObjectId} transactionId
 * @returns {Promise<WalletTransaction>}
 */
export const deleteWalletTransactionById = async (transactionId) => {
    const transaction = await getWalletTransactionById(transactionId);
    await WalletTransaction.deleteOne({ _id: transactionId });
    return transaction;
};

/**
 * Get wallet transactions for a specific user
 * @param {ObjectId} userId
 * @param {Object} options
 * @returns {Promise<QueryResult>}
 */
export const getUserWalletTransactions = async (userId, options) => {
    const filter = { userId };
    return queryWalletTransactions(filter, options);
};

/**
 * Get wallet transactions for a specific project
 * @param {ObjectId} projectId
 * @param {Object} options
 * @returns {Promise<QueryResult>}
 */
export const getProjectWalletTransactions = async (projectId, options) => {
    const filter = { project: projectId };
    return queryWalletTransactions(filter, options);
};

/**
 * Get total received amount for a user
 * @param {ObjectId} userId
 * @param {Object} filter - Optional filters for date range, transaction type, etc.
 * @returns {Promise<Object>}
 */
export const getUserTotalReceivedAmount = async (userId, filter = {}) => {
    const mongoUserId = new mongoose.Types.ObjectId(userId);

    const mongoFilter = { userId: mongoUserId };

    // Optional: filter by project
    if (filter.project) {
        mongoFilter.project = new mongoose.Types.ObjectId(filter.project);
    }

    // Optional: filter by createdAt date range
    if (filter.startDate || filter.endDate) {
        const dateFilter = {};
        if (filter.startDate) dateFilter.$gte = new Date(filter.startDate);
        if (filter.endDate) dateFilter.$lte = new Date(filter.endDate);

        if (Object.keys(dateFilter).length > 0) {
            mongoFilter.createdAt = dateFilter;
        }
    }

    // Aggregate total amount and count
    const result = await WalletTransaction.aggregate([
        { $match: mongoFilter },
        {
            $group: {
                _id: null,
                totalAmount: { $sum: '$amount' },
                totalTransactions: { $sum: 1 },
                currency: { $first: '$currency' }
            }
        }
    ]);

    const totalData = result[0] || {
        totalAmount: 0,
        totalTransactions: 0,
        currency: 'INR'
    };

    // Breakdown by type
    const typeBreakdown = await WalletTransaction.aggregate([
        { $match: mongoFilter },
        {
            $group: {
                _id: '$type',
                amount: { $sum: '$amount' },
                count: { $sum: 1 }
            }
        },
        { $sort: { amount: -1 } }
    ]);

    // Recent transactions
    const recentTransactions = await WalletTransaction.find(mongoFilter)
        .populate('project', 'projectName projectCode')
        .populate('createdBy', 'name email role')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean();

    return {
        userId,
        totalAmount: totalData.totalAmount,
        totalTransactions: totalData.totalTransactions,
        currency: totalData.currency,
        typeBreakdown,
        recentTransactions,
        filter
    };
};
