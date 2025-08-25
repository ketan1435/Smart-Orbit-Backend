import Quote from '../models/quote.model.js';
import BOM from '../models/bom.model.js';
import Vendor from '../models/vendor.model.js';
import User from '../models/user.model.js';
import ApiError from '../utils/ApiError.js';
import catchAsync from '../utils/catchAsync.js';
import mongoose from 'mongoose';
import storage from '../factory/storage.factory.js';
import logger from '../config/logger.js';

/**
 * Create a new quote with file handling
 * @param {Object} quoteData - Quote data
 * @param {Object} session - Database session
 * @returns {Promise<Object>} Created quote
 */
const createQuote = async (quoteData, session) => {
    // Validate that BOM exists
    const bom = await BOM.findById(quoteData.bomId);
    if (!bom) {
        throw new ApiError(404, 'BOM not found');
    }

    // Validate that vendor exists
    const vendor = await Vendor.findById(quoteData.vendorId);
    if (!vendor) {
        throw new ApiError(404, 'Vendor not found');
    }

    // Validate that creator exists
    const creator = await User.findById(quoteData.createdBy);
    if (!creator) {
        throw new ApiError(404, 'Creator not found');
    }

    // Calculate total amount from quote items
    const totalAmount = quoteData.quoteItems.reduce((sum, item) => sum + item.totalPrice, 0);
    quoteData.totalAmount = totalAmount;

    // Create the quote first (inside transaction)
    const quote = new Quote(quoteData);
    await quote.save({ session });

    // Process files in try-catch block (outside transaction)
    const tempFileKeysToDelete = [];
    const newlyCopiedFiles = [];

    try {
        // Process quote attachments
        if (quoteData.quoteAttachments && quoteData.quoteAttachments.length > 0) {
            for (const attachment of quoteData.quoteAttachments) {
                if (attachment.fileKey && attachment.fileKey.startsWith('uploads/tmp/')) {
                    const permanentKey = `quotes/${quote._id}/attachments/${attachment.fileKey.split('/').pop()}`;

                    await storage.copyFile(attachment.fileKey, permanentKey);
                    newlyCopiedFiles.push(attachment.fileKey);

                    // Update the file key to permanent location
                    attachment.fileKey = permanentKey;
                }
            }
        }

        // Process quote item attachments
        if (quoteData.quoteItems) {
            for (const item of quoteData.quoteItems) {
                if (item.attachments && item.attachments.length > 0) {
                    for (const attachment of item.attachments) {
                        if (attachment.fileKey && attachment.fileKey.startsWith('uploads/tmp/')) {
                            const permanentKey = `quotes/${quote._id}/items/${item.bomItemId}/attachments/${attachment.fileKey.split('/').pop()}`;

                            await storage.copyFile(attachment.fileKey, permanentKey);
                            newlyCopiedFiles.push(attachment.fileKey);

                            // Update the file key to permanent location
                            attachment.fileKey = permanentKey;
                        }
                    }
                }
            }
        }

        // Update quote with permanent file locations
        await Quote.findByIdAndUpdate(
            quote._id,
            {
                quoteAttachments: quoteData.quoteAttachments,
                quoteItems: quoteData.quoteItems
            },
            { session }
        );

        // Delete temporary files
        for (const tempKey of newlyCopiedFiles) {
            try {
                await storage.deleteFile(tempKey);
            } catch (deleteError) {
                logger.warn(`Failed to delete temporary file ${tempKey}: ${deleteError.message}`);
            }
        }

    } catch (fileError) {
        // Compensating action: delete successfully copied files
        for (const copiedKey of newlyCopiedFiles) {
            try {
                await storage.deleteFile(copiedKey);
            } catch (deleteError) {
                logger.error(`Failed to delete copied file ${copiedKey} during rollback: ${deleteError.message}`);
            }
        }

        // Re-throw the error to trigger transaction rollback
        throw fileError;
    }

    // Populate references for response
    await quote.populate([
        { path: 'vendorId', select: 'storeName name mobileNumber email address city state' },
        { path: 'siteEngineerId', select: 'name email' },
        { path: 'bomId', select: 'title status' }
    ]);

    return {
        status: 201,
        body: {
            status: 1,
            message: 'Quote created successfully',
            data: quote
        }
    };
};

/**
 * Get quotes with pagination and filters
 * @param {Object} filters - Query filters
 * @param {Object} options - Pagination options
 * @returns {Promise<Object>} Quotes with pagination
 */
const getQuotes = async (filters = {}, options = {}) => {
    const {
        page = 1,
        limit = 10,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        bomId,
        projectId,
        vendorId,
        siteEngineerId,
        status,
        isActive
    } = options;

    // Build query
    const query = { isActive: isActive !== false }; // Default to active quotes

    if (bomId) query.bomId = bomId;
    if (projectId) query.projectId = projectId;
    if (vendorId) query.vendorId = vendorId;
    if (siteEngineerId) query.siteEngineerId = siteEngineerId;
    if (status) query.status = status;

    // Calculate skip
    const skip = (page - 1) * limit;

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query
    const [quotes, total] = await Promise.all([
        Quote.find(query)
            .populate('vendorId', 'storeName name mobileNumber email address city state')
            .populate('siteEngineerId', 'name email')
            .populate('bomId', 'title status')
            .populate('reviewedBy', 'name email')
            .sort(sort)
            .skip(skip)
            .limit(limit),
        Quote.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
        quotes,
        pagination: {
            page,
            limit,
            total,
            totalPages
        }
    };
};

/**
 * Get quote by ID
 * @param {string} quoteId - Quote ID
 * @returns {Promise<Object>} Quote details
 */
const getQuoteById = async (quoteId) => {
    const quote = await Quote.findById(quoteId)
        .populate('vendorId', 'storeName name mobileNumber email address city state')
        .populate('createdBy', 'name email role')
        .populate('siteEngineerId', 'name email')
        .populate('bomId', 'title status items')
        .populate('reviewedBy', 'name email');

    if (!quote) {
        throw new ApiError(404, 'Quote not found');
    }

    return quote;
};

/**
 * Update quote with file handling
 * @param {string} quoteId - Quote ID
 * @param {Object} updateData - Update data
 * @param {Object} session - Database session
 * @returns {Promise<Object>} Updated quote
 */
const updateQuote = async (quoteId, updateData, session) => {
    const quote = await Quote.findById(quoteId);
    if (!quote) {
        throw new ApiError(404, 'Quote not found');
    }

    // If quote items are being updated, recalculate total amount
    if (updateData.quoteItems) {
        const totalAmount = updateData.quoteItems.reduce((sum, item) => sum + item.totalPrice, 0);
        updateData.totalAmount = totalAmount;
    }

    // Update the quote first (inside transaction)
    Object.assign(quote, updateData);
    await quote.save({ session });

    // Process files in try-catch block (outside transaction)
    const newlyCopiedFiles = [];
    const filesToDelete = [];

    try {
        // Process quote attachments
        if (updateData.quoteAttachments && updateData.quoteAttachments.length > 0) {
            for (const attachment of updateData.quoteAttachments) {
                if (attachment.fileKey && attachment.fileKey.startsWith('uploads/tmp/')) {
                    const permanentKey = `quotes/${quoteId}/attachments/${attachment.fileKey.split('/').pop()}`;

                    await storage.copyFile(attachment.fileKey, permanentKey);
                    newlyCopiedFiles.push(attachment.fileKey);
                    filesToDelete.push(attachment.fileKey);

                    // Update the file key to permanent location
                    attachment.fileKey = permanentKey;
                }
            }
        }

        // Process quote item attachments
        if (updateData.quoteItems) {
            for (const item of updateData.quoteItems) {
                if (item.attachments && item.attachments.length > 0) {
                    for (const attachment of item.attachments) {
                        if (attachment.fileKey && attachment.fileKey.startsWith('uploads/tmp/')) {
                            const permanentKey = `quotes/${quoteId}/items/${item.bomItemId}/attachments/${attachment.fileKey.split('/').pop()}`;

                            await storage.copyFile(attachment.fileKey, permanentKey);
                            newlyCopiedFiles.push(attachment.fileKey);
                            filesToDelete.push(attachment.fileKey);

                            // Update the file key to permanent location
                            attachment.fileKey = permanentKey;
                        }
                    }
                }
            }
        }

        // Update quote with permanent file locations if files were processed
        if (newlyCopiedFiles.length > 0) {
            await Quote.findByIdAndUpdate(
                quoteId,
                {
                    quoteAttachments: updateData.quoteAttachments,
                    quoteItems: updateData.quoteItems
                },
                { session }
            );
        }

        // Delete temporary files
        for (const tempKey of filesToDelete) {
            try {
                await storage.deleteFile(tempKey);
            } catch (deleteError) {
                logger.warn(`Failed to delete temporary file ${tempKey}: ${deleteError.message}`);
            }
        }

    } catch (fileError) {
        // Compensating action: delete successfully copied files
        for (const copiedKey of newlyCopiedFiles) {
            try {
                await storage.deleteFile(copiedKey);
            } catch (deleteError) {
                logger.error(`Failed to delete copied file ${copiedKey} during rollback: ${deleteError.message}`);
            }
        }

        // Re-throw the error to trigger transaction rollback
        throw fileError;
    }

    // Populate references for response
    await quote.populate([
        { path: 'vendorId', select: 'storeName name mobileNumber email address city state' },
        { path: 'siteEngineerId', select: 'name email' },
        { path: 'bomId', select: 'title status' },
        { path: 'reviewedBy', select: 'name email' }
    ]);

    return quote;
};

/**
 * Delete quote (soft delete)
 * @param {string} quoteId - Quote ID
 * @returns {Promise<Object>} Deleted quote
 */
const deleteQuote = async (quoteId) => {
    const quote = await Quote.findById(quoteId);
    if (!quote) {
        throw new ApiError(404, 'Quote not found');
    }

    quote.isActive = false;
    await quote.save();

    return { message: 'Quote deleted successfully' };
};

/**
 * Get quotes by BOM ID
 * @param {string} bomId - BOM ID
 * @returns {Promise<Array>} Quotes for the BOM
 */
const getQuotesByBOM = async (bomId) => {
    const quotes = await Quote.getQuotesByBOM(bomId);
    return quotes;
};

/**
 * Get quote comparison for BOM items
 * @param {string} bomId - BOM ID
 * @param {boolean} includeExpired - Include expired quotes
 * @returns {Promise<Array>} Quote comparison data
 */
const getQuoteComparison = async (bomId, includeExpired = false) => {
    let matchQuery = { bomId: new mongoose.Types.ObjectId(bomId), isActive: true };

    if (!includeExpired) {
        matchQuery.validUntil = { $gte: new Date() };
    }

    const comparison = await Quote.aggregate([
        { $match: matchQuery },
        { $unwind: '$quoteItems' },
        {
            $group: {
                _id: '$quoteItems.bomItemId',
                itemName: { $first: '$quoteItems.itemName' },
                quotes: {
                    $push: {
                        quoteId: '$_id',
                        vendorId: '$vendorId',
                        vendorName: '$vendorInfo.storeName',
                        vendorLocation: '$vendorInfo.city',
                        vendorContact: '$vendorInfo.mobileNumber',
                        price: '$quoteItems.unitPrice',
                        totalPrice: '$quoteItems.totalPrice',
                        availability: '$quoteItems.availabilityStatus',
                        deliveryTime: '$quoteItems.deliveryTime',
                        paymentTerms: '$quoteItems.paymentTerms',
                        brand: '$quoteItems.brand',
                        grade: '$quoteItems.grade',
                        warranty: '$quoteItems.warranty',
                        certification: '$quoteItems.certification',
                        minimumOrderQuantity: '$quoteItems.minimumOrderQuantity',
                        notes: '$quoteItems.notes',
                        quoteDate: '$quoteItems.quotedAt',
                        validUntil: '$validUntil',
                        status: '$status'
                    }
                }
            }
        },
        { $sort: { 'quotes.price': 1 } }
    ]);

    return comparison;
};

/**
 * Review quote (for planning engineer)
 * @param {string} quoteId - Quote ID
 * @param {string} reviewerId - Reviewer ID
 * @param {Object} reviewData - Review data
 * @returns {Promise<Object>} Reviewed quote
 */
const reviewQuote = async (quoteId, reviewerId, reviewData) => {
    const quote = await Quote.findById(quoteId);
    if (!quote) {
        throw new ApiError(404, 'Quote not found');
    }

    // Validate reviewer exists
    const reviewer = await User.findById(reviewerId);
    if (!reviewer) {
        throw new ApiError(404, 'Reviewer not found');
    }

    // Update quote with review information
    quote.status = reviewData.status || 'reviewed';
    quote.reviewedBy = reviewerId;
    quote.reviewedAt = new Date();
    quote.reviewNotes = reviewData.reviewNotes;

    await quote.save();

    // Populate references for response
    await quote.populate([
        { path: 'vendorId', select: 'storeName name mobileNumber email address city state' },
        { path: 'siteEngineerId', select: 'name email' },
        { path: 'bomId', select: 'title status' },
        { path: 'reviewedBy', select: 'name email' }
    ]);

    return quote;
};

/**
 * Bulk create quotes with file handling
 * @param {Object} bulkData - Bulk quote data
 * @param {Object} session - Database session
 * @returns {Promise<Array>} Created quotes
 */
const bulkCreateQuotes = async (bulkData, session) => {
    const { bomId, projectId, createdBy, quotes } = bulkData;

    // Validate that BOM exists
    const bom = await BOM.findById(bomId);
    if (!bom) {
        throw new ApiError(404, 'BOM not found');
    }

    // Validate that creator exists
    const creator = await User.findById(createdBy);
    if (!creator) {
        throw new ApiError(404, 'Creator not found');
    }

    const createdQuotes = [];
    const allNewlyCopiedFiles = [];
    const allFilesToDelete = [];

    for (const quoteData of quotes) {
        // Validate that vendor exists
        const vendor = await Vendor.findById(quoteData.vendorId);
        if (!vendor) {
            throw new ApiError(404, `Vendor not found: ${quoteData.vendorId}`);
        }

        // Calculate total amount
        const totalAmount = quoteData.quoteItems.reduce((sum, item) => sum + item.totalPrice, 0);

        // Create quote first (inside transaction)
        const quote = new Quote({
            ...quoteData,
            bomId,
            projectId,
            createdBy,
            totalAmount
        });

        await quote.save({ session });

        // Process files for this quote (outside transaction)
        const newlyCopiedFiles = [];
        const filesToDelete = [];

        try {
            // Process quote attachments
            if (quoteData.quoteAttachments && quoteData.quoteAttachments.length > 0) {
                for (const attachment of quoteData.quoteAttachments) {
                    if (attachment.fileKey && attachment.fileKey.startsWith('uploads/tmp/')) {
                        const permanentKey = `quotes/${quote._id}/attachments/${attachment.fileKey.split('/').pop()}`;

                        await storage.copyFile(attachment.fileKey, permanentKey);
                        newlyCopiedFiles.push(attachment.fileKey);
                        filesToDelete.push(attachment.fileKey);

                        // Update the file key to permanent location
                        attachment.fileKey = permanentKey;
                    }
                }
            }

            // Process quote item attachments
            if (quoteData.quoteItems) {
                for (const item of quoteData.quoteItems) {
                    if (item.attachments && item.attachments.length > 0) {
                        for (const attachment of item.attachments) {
                            if (attachment.fileKey && attachment.fileKey.startsWith('uploads/tmp/')) {
                                const permanentKey = `quotes/${quote._id}/items/${item.bomItemId}/attachments/${attachment.fileKey.split('/').pop()}`;

                                await storage.copyFile(attachment.fileKey, permanentKey);
                                newlyCopiedFiles.push(attachment.fileKey);
                                filesToDelete.push(attachment.fileKey);

                                // Update the file key to permanent location
                                attachment.fileKey = permanentKey;
                            }
                        }
                    }
                }
            }

            // Update quote with permanent file locations if files were processed
            if (newlyCopiedFiles.length > 0) {
                await Quote.findByIdAndUpdate(
                    quote._id,
                    {
                        quoteAttachments: quoteData.quoteAttachments,
                        quoteItems: quoteData.quoteItems
                    },
                    { session }
                );
            }

            // Track files for cleanup
            allNewlyCopiedFiles.push(...newlyCopiedFiles);
            allFilesToDelete.push(...filesToDelete);

        } catch (fileError) {
            // Compensating action: delete successfully copied files for this quote
            for (const copiedKey of newlyCopiedFiles) {
                try {
                    await storage.deleteFile(copiedKey);
                } catch (deleteError) {
                    logger.error(`Failed to delete copied file ${copiedKey} during rollback: ${deleteError.message}`);
                }
            }

            // Re-throw the error to trigger transaction rollback
            throw fileError;
        }

        await quote.populate([
            { path: 'vendorId', select: 'storeName name mobileNumber email address city state' },
            { path: 'siteEngineerId', select: 'name email' },
            { path: 'bomId', select: 'title status' }
        ]);

        createdQuotes.push(quote);
    }

    // Delete all temporary files after successful creation
    for (const tempKey of allFilesToDelete) {
        try {
            await storage.deleteFile(tempKey);
        } catch (deleteError) {
            logger.warn(`Failed to delete temporary file ${tempKey}: ${deleteError.message}`);
        }
    }

    return createdQuotes;
};

/**
 * Get quote statistics
 * @param {Object} filters - Query filters
 * @returns {Promise<Object>} Quote statistics
 */
const getQuoteStats = async (filters = {}) => {
    const query = { isActive: true };

    if (filters.bomId) query.bomId = filters.bomId;
    if (filters.projectId) query.projectId = filters.projectId;
    if (filters.siteEngineerId) query.siteEngineerId = filters.siteEngineerId;

    const stats = await Quote.aggregate([
        { $match: query },
        {
            $group: {
                _id: null,
                totalQuotes: { $sum: 1 },
                totalAmount: { $sum: '$totalAmount' },
                avgAmount: { $avg: '$totalAmount' },
                statusCounts: {
                    $push: '$status'
                }
            }
        },
        {
            $project: {
                _id: 0,
                totalQuotes: 1,
                totalAmount: 1,
                avgAmount: { $round: ['$avgAmount', 2] },
                statusBreakdown: {
                    draft: { $size: { $filter: { input: '$statusCounts', cond: { $eq: ['$$this', 'draft'] } } } },
                    submitted: { $size: { $filter: { input: '$statusCounts', cond: { $eq: ['$$this', 'submitted'] } } } },
                    reviewed: { $size: { $filter: { input: '$statusCounts', cond: { $eq: ['$$this', 'reviewed'] } } } },
                    accepted: { $size: { $filter: { input: '$statusCounts', cond: { $eq: ['$$this', 'accepted'] } } } },
                    rejected: { $size: { $filter: { input: '$statusCounts', cond: { $eq: ['$$this', 'rejected'] } } } },
                    expired: { $size: { $filter: { input: '$statusCounts', cond: { $eq: ['$$this', 'expired'] } } } }
                }
            }
        }
    ]);

    return stats[0] || {
        totalQuotes: 0,
        totalAmount: 0,
        avgAmount: 0,
        statusBreakdown: {
            draft: 0,
            submitted: 0,
            reviewed: 0,
            accepted: 0,
            rejected: 0,
            expired: 0
        }
    };
};

/**
 * Check for expired quotes and update their status
 * @returns {Promise<Object>} Update result
 */
const updateExpiredQuotes = async () => {
    const result = await Quote.updateMany(
        {
            validUntil: { $lt: new Date() },
            status: { $nin: ['expired', 'accepted', 'rejected'] },
            isActive: true
        },
        {
            $set: { status: 'expired' }
        }
    );

    return {
        message: `Updated ${result.modifiedCount} expired quotes`,
        modifiedCount: result.modifiedCount
    };
};

// Service functions for direct route handling with transactional middleware
const createQuoteService = async (req, session) => {
    const quoteData = {
        ...req.body,
        createdBy: req.user.id, // Set from authenticated user
        creatorRole: req.user.role, // Set from authenticated user
        siteEngineerId: req.user.id // Legacy field for backward compatibility
    };

    const quote = await createQuote(quoteData, session);

    return {
        status: 201,
        body: {
            status: 1,
            message: 'Quote created successfully',
            data: quote
        }
    };
};

const updateQuoteService = async (req, session) => {
    const { id } = req.params;
    const updateData = req.body;

    const quote = await updateQuote(id, updateData, session);

    return {
        status: 200,
        body: {
            status: 1,
            message: 'Quote updated successfully',
            data: quote
        }
    };
};

const bulkCreateQuotesService = async (req, session) => {
    const bulkData = {
        ...req.body,
        createdBy: req.user.id, // Set from authenticated user
        creatorRole: req.user.role, // Set from authenticated user
        siteEngineerId: req.user.id // Legacy field for backward compatibility
    };

    const quotes = await bulkCreateQuotes(bulkData, session);

    return {
        status: 201,
        body: {
            status: 1,
            message: `${quotes.length} quotes created successfully`,
            data: quotes
        }
    };
};

export {
    createQuote,
    getQuotes,
    getQuoteById,
    updateQuote,
    deleteQuote,
    getQuotesByBOM,
    getQuoteComparison,
    reviewQuote,
    bulkCreateQuotes,
    getQuoteStats,
    updateExpiredQuotes,
    // Service functions for transactional routes
    createQuoteService,
    updateQuoteService,
    bulkCreateQuotesService
};
