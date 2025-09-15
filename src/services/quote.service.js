import Quote from '../models/quote.model.js';
import BOM from '../models/bom.model.js';
import Vendor from '../models/vendor.model.js';
import User from '../models/user.model.js';
import ApiError from '../utils/ApiError.js';
import catchAsync from '../utils/catchAsync.js';
import mongoose from 'mongoose';
import storage from '../factory/storage.factory.js';
import logger from '../config/logger.js';
import { logActivity } from '../middlewares/activityLog.middleware.js';

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
const deleteQuote = async (req, quoteId) => {
    // Get original quote data for change detection
    const originalQuote = await Quote.findById(quoteId)
        .populate('vendorId', 'storeName name mobileNumber email address city state')
        .populate('siteEngineerId', 'name email')
        .populate('bomId', 'title status projectId')
        .populate('projectId', 'projectName projectCode customerName')
        .populate('reviewedBy', 'name email');

    if (!originalQuote) {
        throw new ApiError(404, 'Quote not found');
    }

    // Store original values for change detection
    const originalIsActive = originalQuote.isActive;
    const originalUpdatedAt = originalQuote.updatedAt;

    // Soft delete the quote
    originalQuote.isActive = false;
    originalQuote.deletedAt = new Date();
    originalQuote.deletedBy = req.user?._id;
    originalQuote.deletedByModel = req.user?.role === 'admin' ? 'Admin' : req.user?.role === 'site-engineer' ? 'Site Engineer' : req.user?.role === 'planning-engineer' ? 'Planning Engineer' : 'User';
    await originalQuote.save();

    // Log the quote deletion activity
    try {
        // Detect changes between original and deleted quote
        const changes = {};
        const previousValues = {};
        const newValues = {};

        // Check for isActive change
        if (originalIsActive !== false) {
            changes.isActive = {
                from: originalIsActive,
                to: false
            };
            previousValues.isActive = originalIsActive;
            newValues.isActive = false;
        }

        // Add deletion timestamp
        changes.deletedAt = {
            from: null,
            to: new Date()
        };
        previousValues.deletedAt = null;
        newValues.deletedAt = new Date();

        // Add deleted by information
        changes.deletedBy = {
            from: null,
            to: req.user?._id
        };
        previousValues.deletedBy = null;
        newValues.deletedBy = req.user?._id;

        changes.deletedByModel = {
            from: null,
            to: req.user?.role === 'admin' ? 'Admin' : req.user?.role === 'site-engineer' ? 'Site Engineer' : req.user?.role === 'planning-engineer' ? 'Planning Engineer' : 'User'
        };
        previousValues.deletedByModel = null;
        newValues.deletedByModel = req.user?.role === 'admin' ? 'Admin' : req.user?.role === 'site-engineer' ? 'Site Engineer' : req.user?.role === 'planning-engineer' ? 'Planning Engineer' : 'User';

        // Add update timestamp
        changes.updatedAt = {
            from: originalUpdatedAt,
            to: new Date()
        };
        previousValues.updatedAt = originalUpdatedAt;
        newValues.updatedAt = new Date();

        await logActivity(req, {
            action: 'delete_quote',
            targetModel: 'Quote',
            targetId: quoteId,
            targetName: originalQuote.quoteTitle || 'Quote',
            description: `${req.user?.role === 'admin' ? 'Admin' : req.user?.role === 'site-engineer' ? 'Site Engineer' : req.user?.role === 'planning-engineer' ? 'Planning Engineer' : 'User'} ${req.user?.name || 'Unknown'} (${req.user?.email || 'unknown@example.com'}) deleted quote "${originalQuote.quoteTitle}" for vendor: ${originalQuote?.vendorId?.storeName || 'Unknown Vendor'}`,
            changes,
            previousValues,
            newValues,
            metadata: {
                user: {
                    userId: req.user?._id,
                    userName: req.user?.name,
                    userEmail: req.user?.email,
                    userRole: req.user?.role,
                    userType: req.user?.role === 'admin' ? 'Admin' : req.user?.role === 'site-engineer' ? 'Site Engineer' : req.user?.role === 'planning-engineer' ? 'Planning Engineer' : 'User',
                    userPhone: req.user?.phone
                },
                originalQuoteData: {
                    quoteId: originalQuote._id,
                    quoteTitle: originalQuote.quoteTitle,
                    bomId: originalQuote.bomId,
                    projectId: originalQuote.projectId,
                    vendorId: originalQuote.vendorId,
                    siteEngineerId: originalQuote.siteEngineerId,
                    createdBy: originalQuote.createdBy,
                    creatorRole: originalQuote.creatorRole,
                    totalAmount: originalQuote.totalAmount,
                    currency: originalQuote.currency,
                    validityDays: originalQuote.validityDays,
                    validUntil: originalQuote.validUntil,
                    overallDeliveryTime: originalQuote.overallDeliveryTime,
                    overallDeliveryCost: originalQuote.overallDeliveryCost,
                    overallPaymentTerms: originalQuote.overallPaymentTerms,
                    overallCreditDays: originalQuote.overallCreditDays,
                    status: originalQuote.status,
                    reviewedBy: originalQuote.reviewedBy,
                    reviewedAt: originalQuote.reviewedAt,
                    reviewNotes: originalQuote.reviewNotes,
                    siteEngineerNotes: originalQuote.siteEngineerNotes,
                    notes: originalQuote.notes,
                    isActive: originalIsActive,
                    quoteItemsCount: originalQuote.quoteItems?.length || 0,
                    quoteAttachmentsCount: originalQuote.quoteAttachments?.length || 0,
                    createdAt: originalQuote.createdAt,
                    updatedAt: originalUpdatedAt
                },
                deletedQuoteData: {
                    quoteId: originalQuote._id,
                    quoteTitle: originalQuote.quoteTitle,
                    bomId: originalQuote.bomId,
                    projectId: originalQuote.projectId,
                    vendorId: originalQuote.vendorId,
                    siteEngineerId: originalQuote.siteEngineerId,
                    createdBy: originalQuote.createdBy,
                    creatorRole: originalQuote.creatorRole,
                    totalAmount: originalQuote.totalAmount,
                    currency: originalQuote.currency,
                    validityDays: originalQuote.validityDays,
                    validUntil: originalQuote.validUntil,
                    overallDeliveryTime: originalQuote.overallDeliveryTime,
                    overallDeliveryCost: originalQuote.overallDeliveryCost,
                    overallPaymentTerms: originalQuote.overallPaymentTerms,
                    overallCreditDays: originalQuote.overallCreditDays,
                    status: originalQuote.status,
                    reviewedBy: originalQuote.reviewedBy,
                    reviewedAt: originalQuote.reviewedAt,
                    reviewNotes: originalQuote.reviewNotes,
                    siteEngineerNotes: originalQuote.siteEngineerNotes,
                    notes: originalQuote.notes,
                    isActive: false,
                    deletedAt: new Date(),
                    deletedBy: req.user?._id,
                    deletedByModel: req.user?.role === 'admin' ? 'Admin' : req.user?.role === 'site-engineer' ? 'Site Engineer' : req.user?.role === 'planning-engineer' ? 'Planning Engineer' : 'User',
                    quoteItemsCount: originalQuote.quoteItems?.length || 0,
                    quoteAttachmentsCount: originalQuote.quoteAttachments?.length || 0,
                    createdAt: originalQuote.createdAt,
                    updatedAt: new Date()
                },
                projectId: originalQuote?.projectId?._id,
                projectData: {
                    projectId: originalQuote?.projectId?._id,
                    projectName: originalQuote?.projectId?.projectName,
                    projectCode: originalQuote?.projectId?.projectCode,
                    customerName: originalQuote?.projectId?.customerName
                },
                bomData: {
                    bomId: originalQuote?.bomId?._id,
                    bomTitle: originalQuote?.bomId?.title,
                    bomStatus: originalQuote?.bomId?.status
                },
                vendorData: {
                    vendorId: originalQuote?.vendorId?._id,
                    vendorName: originalQuote?.vendorId?.name,
                    storeName: originalQuote?.vendorId?.storeName,
                    mobileNumber: originalQuote?.vendorId?.mobileNumber,
                    email: originalQuote?.vendorId?.email,
                    address: originalQuote?.vendorId?.address,
                    city: originalQuote?.vendorId?.city,
                    state: originalQuote?.vendorId?.state
                },
                siteEngineerData: {
                    siteEngineerId: originalQuote?.siteEngineerId?._id,
                    siteEngineerName: originalQuote?.siteEngineerId?.name,
                    siteEngineerEmail: originalQuote?.siteEngineerId?.email
                },
                reviewerData: {
                    reviewerId: originalQuote?.reviewedBy?._id,
                    reviewerName: originalQuote?.reviewedBy?.name,
                    reviewerEmail: originalQuote?.reviewedBy?.email,
                    reviewerRole: originalQuote?.reviewedBy?.role
                },
                quoteDeletion: {
                    quoteDeleted: true,
                    deletedBy: req.user?._id,
                    deletedByModel: req.user?.role === 'admin' ? 'Admin' : req.user?.role === 'site-engineer' ? 'Site Engineer' : req.user?.role === 'planning-engineer' ? 'Planning Engineer' : 'User',
                    deletedAt: new Date(),
                    quoteTitle: originalQuote.quoteTitle,
                    vendorName: originalQuote?.vendorId?.storeName,
                    projectName: originalQuote?.projectId?.projectName,
                    totalAmount: originalQuote.totalAmount,
                    currency: originalQuote.currency,
                    validityDays: originalQuote.validityDays,
                    status: originalQuote.status,
                    deletionType: 'soft_delete',
                    deletionComplete: true
                },
                deletionData: {
                    deletionStatus: 'deleted',
                    deletionTimestamp: new Date(),
                    deletionType: 'soft_delete',
                    deletionComplete: true,
                    isActive: false,
                    deletedBy: req.user?._id,
                    deletedByModel: req.user?.role === 'admin' ? 'Admin' : req.user?.role === 'site-engineer' ? 'Site Engineer' : req.user?.role === 'planning-engineer' ? 'Planning Engineer' : 'User'
                },
                financialData: {
                    totalAmount: originalQuote.totalAmount,
                    currency: originalQuote.currency,
                    overallDeliveryCost: originalQuote.overallDeliveryCost,
                    overallPaymentTerms: originalQuote.overallPaymentTerms,
                    overallCreditDays: originalQuote.overallCreditDays,
                    validityDays: originalQuote.validityDays,
                    validUntil: originalQuote.validUntil
                },
                workflow: {
                    quoteDeletion: true,
                    quoteManagement: true,
                    procurementWorkflow: true,
                    vendorQuotation: true,
                    bomQuotation: true,
                    softDelete: true,
                    deletionComplete: true
                }
            }
        });
    } catch (error) {
        console.error('Error logging quote deletion:', error);
    }

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
 * @param {Object} req - Express request object
 * @param {string} quoteId - Quote ID
 * @param {string} reviewerId - Reviewer ID
 * @param {Object} reviewData - Review data
 * @returns {Promise<Object>} Reviewed quote
 */
const reviewQuote = async (req, quoteId, reviewerId, reviewData) => {
    // Get original quote data for change detection
    const originalQuote = await Quote.findById(quoteId)
        .populate('vendorId', 'storeName name mobileNumber email address city state')
        .populate('siteEngineerId', 'name email')
        .populate('bomId', 'title status projectId')
        .populate('projectId', 'projectName projectCode customerName')
        .populate('reviewedBy', 'name email');

    if (!originalQuote) {
        throw new ApiError(404, 'Quote not found');
    }

    // Validate reviewer exists
    const reviewer = await User.findById(reviewerId);
    if (!reviewer) {
        throw new ApiError(404, 'Reviewer not found');
    }

    // Store original values for change detection
    const originalStatus = originalQuote.status;
    const originalReviewedBy = originalQuote.reviewedBy;
    const originalReviewedAt = originalQuote.reviewedAt;
    const originalReviewNotes = originalQuote.reviewNotes;

    // Update quote with review information
    originalQuote.status = reviewData.status || 'reviewed';
    originalQuote.reviewedBy = reviewerId;
    originalQuote.reviewedAt = new Date();
    originalQuote.reviewNotes = reviewData.reviewNotes;

    await originalQuote.save();

    // Populate references for response
    await originalQuote.populate([
        { path: 'vendorId', select: 'storeName name mobileNumber email address city state' },
        { path: 'siteEngineerId', select: 'name email' },
        { path: 'bomId', select: 'title status' },
        { path: 'reviewedBy', select: 'name email' }
    ]);

    // Log the quote review activity
    try {
        // Detect changes between original and reviewed quote
        const changes = {};
        const previousValues = {};
        const newValues = {};

        // Check for status change
        if (originalStatus !== (reviewData.status || 'reviewed')) {
            changes.status = {
                from: originalStatus,
                to: reviewData.status || 'reviewed'
            };
            previousValues.status = originalStatus;
            newValues.status = reviewData.status || 'reviewed';
        }

        // Check for reviewer change
        if (originalReviewedBy !== reviewerId) {
            changes.reviewedBy = {
                from: originalReviewedBy,
                to: reviewerId
            };
            previousValues.reviewedBy = originalReviewedBy;
            newValues.reviewedBy = reviewerId;
        }

        // Check for review notes change
        if (originalReviewNotes !== reviewData.reviewNotes) {
            changes.reviewNotes = {
                from: originalReviewNotes,
                to: reviewData.reviewNotes
            };
            previousValues.reviewNotes = originalReviewNotes;
            newValues.reviewNotes = reviewData.reviewNotes;
        }

        // Add review timestamp
        changes.reviewedAt = {
            from: originalReviewedAt,
            to: new Date()
        };
        previousValues.reviewedAt = originalReviewedAt;
        newValues.reviewedAt = new Date();

        // Add update timestamp
        changes.updatedAt = {
            from: originalQuote.updatedAt,
            to: new Date()
        };
        previousValues.updatedAt = originalQuote.updatedAt;
        newValues.updatedAt = new Date();

        await logActivity(req, {
            action: 'review_quote',
            targetModel: 'Quote',
            targetId: quoteId,
            targetName: originalQuote.quoteTitle || 'Quote',
            description: `${req.user?.role === 'admin' ? 'Admin' : req.user?.role === 'site-engineer' ? 'Site Engineer' : req.user?.role === 'planning-engineer' ? 'Planning Engineer' : 'User'} ${req.user?.name || 'Unknown'} (${req.user?.email || 'unknown@example.com'}) reviewed quote "${originalQuote.quoteTitle}" for vendor: ${originalQuote?.vendorId?.storeName || 'Unknown Vendor'}`,
            changes,
            previousValues,
            newValues,
            metadata: {
                user: {
                    userId: req.user?._id,
                    userName: req.user?.name,
                    userEmail: req.user?.email,
                    userRole: req.user?.role,
                    userType: req.user?.role === 'admin' ? 'Admin' : req.user?.role === 'site-engineer' ? 'Site Engineer' : req.user?.role === 'planning-engineer' ? 'Planning Engineer' : 'User',
                    userPhone: req.user?.phone
                },
                originalQuoteData: {
                    quoteId: originalQuote._id,
                    quoteTitle: originalQuote.quoteTitle,
                    bomId: originalQuote.bomId,
                    projectId: originalQuote.projectId,
                    vendorId: originalQuote.vendorId,
                    siteEngineerId: originalQuote.siteEngineerId,
                    createdBy: originalQuote.createdBy,
                    creatorRole: originalQuote.creatorRole,
                    totalAmount: originalQuote.totalAmount,
                    currency: originalQuote.currency,
                    validityDays: originalQuote.validityDays,
                    validUntil: originalQuote.validUntil,
                    overallDeliveryTime: originalQuote.overallDeliveryTime,
                    overallDeliveryCost: originalQuote.overallDeliveryCost,
                    overallPaymentTerms: originalQuote.overallPaymentTerms,
                    overallCreditDays: originalQuote.overallCreditDays,
                    status: originalStatus,
                    reviewedBy: originalReviewedBy,
                    reviewedAt: originalReviewedAt,
                    reviewNotes: originalReviewNotes,
                    siteEngineerNotes: originalQuote.siteEngineerNotes,
                    notes: originalQuote.notes,
                    isActive: originalQuote.isActive,
                    quoteItemsCount: originalQuote.quoteItems?.length || 0,
                    quoteAttachmentsCount: originalQuote.quoteAttachments?.length || 0,
                    createdAt: originalQuote.createdAt,
                    updatedAt: originalQuote.updatedAt
                },
                reviewedQuoteData: {
                    quoteId: originalQuote._id,
                    quoteTitle: originalQuote.quoteTitle,
                    bomId: originalQuote.bomId,
                    projectId: originalQuote.projectId,
                    vendorId: originalQuote.vendorId,
                    siteEngineerId: originalQuote.siteEngineerId,
                    createdBy: originalQuote.createdBy,
                    creatorRole: originalQuote.creatorRole,
                    totalAmount: originalQuote.totalAmount,
                    currency: originalQuote.currency,
                    validityDays: originalQuote.validityDays,
                    validUntil: originalQuote.validUntil,
                    overallDeliveryTime: originalQuote.overallDeliveryTime,
                    overallDeliveryCost: originalQuote.overallDeliveryCost,
                    overallPaymentTerms: originalQuote.overallPaymentTerms,
                    overallCreditDays: originalQuote.overallCreditDays,
                    status: reviewData.status || 'reviewed',
                    reviewedBy: reviewerId,
                    reviewedAt: new Date(),
                    reviewNotes: reviewData.reviewNotes,
                    siteEngineerNotes: originalQuote.siteEngineerNotes,
                    notes: originalQuote.notes,
                    isActive: originalQuote.isActive,
                    quoteItemsCount: originalQuote.quoteItems?.length || 0,
                    quoteAttachmentsCount: originalQuote.quoteAttachments?.length || 0,
                    createdAt: originalQuote.createdAt,
                    updatedAt: new Date()
                },
                projectId: originalQuote?.projectId?._id,
                projectData: {
                    projectId: originalQuote?.projectId?._id,
                    projectName: originalQuote?.projectId?.projectName,
                    projectCode: originalQuote?.projectId?.projectCode,
                    customerName: originalQuote?.projectId?.customerName
                },
                bomData: {
                    bomId: originalQuote?.bomId?._id,
                    bomTitle: originalQuote?.bomId?.title,
                    bomStatus: originalQuote?.bomId?.status
                },
                vendorData: {
                    vendorId: originalQuote?.vendorId?._id,
                    vendorName: originalQuote?.vendorId?.name,
                    storeName: originalQuote?.vendorId?.storeName,
                    mobileNumber: originalQuote?.vendorId?.mobileNumber,
                    email: originalQuote?.vendorId?.email,
                    address: originalQuote?.vendorId?.address,
                    city: originalQuote?.vendorId?.city,
                    state: originalQuote?.vendorId?.state
                },
                siteEngineerData: {
                    siteEngineerId: originalQuote?.siteEngineerId?._id,
                    siteEngineerName: originalQuote?.siteEngineerId?.name,
                    siteEngineerEmail: originalQuote?.siteEngineerId?.email
                },
                reviewerData: {
                    reviewerId: reviewerId,
                    reviewerName: reviewer.name,
                    reviewerEmail: reviewer.email,
                    reviewerRole: reviewer.role
                },
                originalReviewerData: {
                    reviewerId: originalReviewedBy?._id,
                    reviewerName: originalReviewedBy?.name,
                    reviewerEmail: originalReviewedBy?.email,
                    reviewerRole: originalReviewedBy?.role
                },
                quoteReview: {
                    quoteReviewed: true,
                    reviewedBy: req.user?._id,
                    reviewedByModel: req.user?.role === 'admin' ? 'Admin' : req.user?.role === 'site-engineer' ? 'Site Engineer' : req.user?.role === 'planning-engineer' ? 'Planning Engineer' : 'User',
                    reviewedAt: new Date(),
                    quoteTitle: originalQuote.quoteTitle,
                    vendorName: originalQuote?.vendorId?.storeName,
                    projectName: originalQuote?.projectId?.projectName,
                    totalAmount: originalQuote.totalAmount,
                    currency: originalQuote.currency,
                    validityDays: originalQuote.validityDays,
                    originalStatus: originalStatus,
                    newStatus: reviewData.status || 'reviewed',
                    statusChanged: originalStatus !== (reviewData.status || 'reviewed'),
                    reviewNotes: reviewData.reviewNotes,
                    hasReviewNotes: !!reviewData.reviewNotes,
                    reviewerChanged: originalReviewedBy !== reviewerId
                },
                reviewData: {
                    reviewStatus: reviewData.status || 'reviewed',
                    reviewNotes: reviewData.reviewNotes,
                    reviewDecision: reviewData.status || 'reviewed',
                    reviewTimestamp: new Date(),
                    reviewComplete: true
                },
                financialData: {
                    totalAmount: originalQuote.totalAmount,
                    currency: originalQuote.currency,
                    overallDeliveryCost: originalQuote.overallDeliveryCost,
                    overallPaymentTerms: originalQuote.overallPaymentTerms,
                    overallCreditDays: originalQuote.overallCreditDays,
                    validityDays: originalQuote.validityDays,
                    validUntil: originalQuote.validUntil
                },
                workflow: {
                    quoteReview: true,
                    quoteManagement: true,
                    procurementWorkflow: true,
                    vendorQuotation: true,
                    bomQuotation: true,
                    planningEngineerReview: true,
                    reviewComplete: true
                }
            }
        });
    } catch (error) {
        console.error('Error logging quote review:', error);
    }

    return originalQuote;
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

    // Log the quote creation activity
    try {
        // Get populated data for logging
        const populatedQuote = await Quote.findById(quote.body.data._id)
            .populate('vendorId', 'storeName name mobileNumber email address city state')
            .populate('siteEngineerId', 'name email')
            .populate('bomId', 'title status projectId')
            .populate('projectId', 'projectName projectCode customerName');

        await logActivity(req, {
            action: 'create_quote',
            targetModel: 'Quote',
            targetId: quote.body.data._id,
            targetName: quoteData.quoteTitle || 'Quote',
            description: `${req.user?.role === 'admin' ? 'Admin' : req.user?.role === 'site-engineer' ? 'Site Engineer' : req.user?.role === 'planning-engineer' ? 'Planning Engineer' : 'User'} ${req.user?.name || 'Unknown'} (${req.user?.email || 'unknown@example.com'}) created quote "${quoteData.quoteTitle}" for vendor: ${populatedQuote?.vendorId?.storeName || 'Unknown Vendor'}`,
            changes: {
                quoteCreated: true,
                quoteTitle: quoteData.quoteTitle,
                bomId: quoteData.bomId,
                projectId: quoteData.projectId,
                vendorId: quoteData.vendorId,
                siteEngineerId: quoteData.siteEngineerId,
                createdBy: quoteData.createdBy,
                creatorRole: quoteData.creatorRole,
                totalAmount: quoteData.totalAmount,
                currency: quoteData.currency,
                validityDays: quoteData.validityDays,
                status: quoteData.status,
                quoteItemsCount: quoteData.quoteItems?.length || 0,
                quoteAttachmentsCount: quoteData.quoteAttachments?.length || 0,
                createdAt: new Date()
            },
            metadata: {
                user: {
                    userId: req.user?._id,
                    userName: req.user?.name,
                    userEmail: req.user?.email,
                    userRole: req.user?.role,
                    userType: req.user?.role === 'admin' ? 'Admin' : req.user?.role === 'site-engineer' ? 'Site Engineer' : req.user?.role === 'planning-engineer' ? 'Planning Engineer' : 'User',
                    userPhone: req.user?.phone
                },
                quoteData: {
                    quoteId: quote.body.data._id,
                    quoteTitle: quoteData.quoteTitle,
                    bomId: quoteData.bomId,
                    projectId: quoteData.projectId,
                    vendorId: quoteData.vendorId,
                    siteEngineerId: quoteData.siteEngineerId,
                    createdBy: quoteData.createdBy,
                    creatorRole: quoteData.creatorRole,
                    totalAmount: quoteData.totalAmount,
                    currency: quoteData.currency,
                    validityDays: quoteData.validityDays,
                    validUntil: quoteData.validUntil,
                    overallDeliveryTime: quoteData.overallDeliveryTime,
                    overallDeliveryCost: quoteData.overallDeliveryCost,
                    overallPaymentTerms: quoteData.overallPaymentTerms,
                    overallCreditDays: quoteData.overallCreditDays,
                    status: quoteData.status,
                    siteEngineerNotes: quoteData.siteEngineerNotes,
                    notes: quoteData.notes,
                    isActive: quoteData.isActive,
                    createdAt: new Date(),
                    updatedAt: new Date()
                },
                projectId: populatedQuote?.projectId?._id,
                projectData: {
                    projectId: populatedQuote?.projectId?._id,
                    projectName: populatedQuote?.projectId?.projectName,
                    projectCode: populatedQuote?.projectId?.projectCode,
                    customerName: populatedQuote?.projectId?.customerName
                },
                bomData: {
                    bomId: populatedQuote?.bomId?._id,
                    bomTitle: populatedQuote?.bomId?.title,
                    bomStatus: populatedQuote?.bomId?.status
                },
                vendorData: {
                    vendorId: populatedQuote?.vendorId?._id,
                    vendorName: populatedQuote?.vendorId?.name,
                    storeName: populatedQuote?.vendorId?.storeName,
                    mobileNumber: populatedQuote?.vendorId?.mobileNumber,
                    email: populatedQuote?.vendorId?.email,
                    address: populatedQuote?.vendorId?.address,
                    city: populatedQuote?.vendorId?.city,
                    state: populatedQuote?.vendorId?.state
                },
                siteEngineerData: {
                    siteEngineerId: populatedQuote?.siteEngineerId?._id,
                    siteEngineerName: populatedQuote?.siteEngineerId?.name,
                    siteEngineerEmail: populatedQuote?.siteEngineerId?.email
                },
                quoteCreation: {
                    quoteCreated: true,
                    createdBy: req.user?._id,
                    createdByModel: req.user?.role === 'admin' ? 'Admin' : req.user?.role === 'site-engineer' ? 'Site Engineer' : req.user?.role === 'planning-engineer' ? 'Planning Engineer' : 'User',
                    createdAt: new Date(),
                    quoteTitle: quoteData.quoteTitle,
                    vendorName: populatedQuote?.vendorId?.storeName,
                    projectName: populatedQuote?.projectId?.projectName,
                    totalAmount: quoteData.totalAmount,
                    currency: quoteData.currency,
                    validityDays: quoteData.validityDays,
                    status: quoteData.status,
                    creatorRole: quoteData.creatorRole
                },
                quoteItemsData: {
                    totalItems: quoteData.quoteItems?.length || 0,
                    itemsWithAttachments: quoteData.quoteItems?.filter(item => item.attachments && item.attachments.length > 0).length || 0,
                    totalAttachments: quoteData.quoteItems?.reduce((sum, item) => sum + (item.attachments?.length || 0), 0) || 0,
                    itemsWithAlternatives: quoteData.quoteItems?.filter(item => item.alternatives && item.alternatives.length > 0).length || 0,
                    averageItemPrice: quoteData.quoteItems?.length > 0 ? quoteData.totalAmount / quoteData.quoteItems.length : 0
                },
                attachmentsData: {
                    quoteAttachments: quoteData.quoteAttachments?.length || 0,
                    itemAttachments: quoteData.quoteItems?.reduce((sum, item) => sum + (item.attachments?.length || 0), 0) || 0,
                    totalAttachments: (quoteData.quoteAttachments?.length || 0) + (quoteData.quoteItems?.reduce((sum, item) => sum + (item.attachments?.length || 0), 0) || 0)
                },
                financialData: {
                    totalAmount: quoteData.totalAmount,
                    currency: quoteData.currency,
                    overallDeliveryCost: quoteData.overallDeliveryCost,
                    overallPaymentTerms: quoteData.overallPaymentTerms,
                    overallCreditDays: quoteData.overallCreditDays,
                    validityDays: quoteData.validityDays,
                    validUntil: quoteData.validUntil
                },
                workflow: {
                    quoteCreation: true,
                    quoteManagement: true,
                    procurementWorkflow: true,
                    vendorQuotation: true,
                    bomQuotation: true,
                    creationComplete: true
                }
            }
        });
    } catch (error) {
        console.error('Error logging quote creation:', error);
    }

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

    // Get original quote data for change detection
    const originalQuote = await Quote.findById(id)
        .populate('vendorId', 'storeName name mobileNumber email address city state')
        .populate('siteEngineerId', 'name email')
        .populate('bomId', 'title status projectId')
        .populate('projectId', 'projectName projectCode customerName')
        .populate('reviewedBy', 'name email');

    if (!originalQuote) {
        throw new ApiError(404, 'Quote not found');
    }

    const quote = await updateQuote(id, updateData, session);

    // Log the quote update activity
    try {
        // Get updated quote data for logging
        const updatedQuote = await Quote.findById(id)
            .populate('vendorId', 'storeName name mobileNumber email address city state')
            .populate('siteEngineerId', 'name email')
            .populate('bomId', 'title status projectId')
            .populate('projectId', 'projectName projectCode customerName')
            .populate('reviewedBy', 'name email');

        // Detect changes between original and updated quote
        const changes = {};
        const previousValues = {};
        const newValues = {};

        // Check for changes in basic fields
        const fieldsToCheck = [
            'quoteTitle', 'bomId', 'projectId', 'vendorId', 'siteEngineerId',
            'totalAmount', 'currency', 'validityDays', 'validUntil',
            'overallDeliveryTime', 'overallDeliveryCost', 'overallPaymentTerms',
            'overallCreditDays', 'status', 'reviewedBy', 'reviewedAt',
            'reviewNotes', 'siteEngineerNotes', 'notes', 'isActive'
        ];

        fieldsToCheck.forEach(field => {
            if (updateData.hasOwnProperty(field) && originalQuote[field] !== updateData[field]) {
                changes[field] = {
                    from: originalQuote[field],
                    to: updateData[field]
                };
                previousValues[field] = originalQuote[field];
                newValues[field] = updateData[field];
            }
        });

        // Check for quote items changes
        if (updateData.quoteItems) {
            changes.quoteItems = {
                from: originalQuote.quoteItems?.length || 0,
                to: updateData.quoteItems.length
            };
            previousValues.quoteItems = originalQuote.quoteItems?.length || 0;
            newValues.quoteItems = updateData.quoteItems.length;
        }

        // Check for quote attachments changes
        if (updateData.quoteAttachments) {
            changes.quoteAttachments = {
                from: originalQuote.quoteAttachments?.length || 0,
                to: updateData.quoteAttachments.length
            };
            previousValues.quoteAttachments = originalQuote.quoteAttachments?.length || 0;
            newValues.quoteAttachments = updateData.quoteAttachments.length;
        }

        // Add update timestamp
        changes.updatedAt = {
            from: originalQuote.updatedAt,
            to: new Date()
        };
        previousValues.updatedAt = originalQuote.updatedAt;
        newValues.updatedAt = new Date();

        await logActivity(req, {
            action: 'update_quote',
            targetModel: 'Quote',
            targetId: id,
            targetName: originalQuote.quoteTitle || 'Quote',
            description: `${req.user?.role === 'admin' ? 'Admin' : req.user?.role === 'site-engineer' ? 'Site Engineer' : req.user?.role === 'planning-engineer' ? 'Planning Engineer' : 'User'} ${req.user?.name || 'Unknown'} (${req.user?.email || 'unknown@example.com'}) updated quote "${originalQuote.quoteTitle}" for vendor: ${originalQuote?.vendorId?.storeName || 'Unknown Vendor'}`,
            changes,
            previousValues,
            newValues,
            metadata: {
                user: {
                    userId: req.user?._id,
                    userName: req.user?.name,
                    userEmail: req.user?.email,
                    userRole: req.user?.role,
                    userType: req.user?.role === 'admin' ? 'Admin' : req.user?.role === 'site-engineer' ? 'Site Engineer' : req.user?.role === 'planning-engineer' ? 'Planning Engineer' : 'User',
                    userPhone: req.user?.phone
                },
                originalQuoteData: {
                    quoteId: originalQuote._id,
                    quoteTitle: originalQuote.quoteTitle,
                    bomId: originalQuote.bomId,
                    projectId: originalQuote.projectId,
                    vendorId: originalQuote.vendorId,
                    siteEngineerId: originalQuote.siteEngineerId,
                    createdBy: originalQuote.createdBy,
                    creatorRole: originalQuote.creatorRole,
                    totalAmount: originalQuote.totalAmount,
                    currency: originalQuote.currency,
                    validityDays: originalQuote.validityDays,
                    validUntil: originalQuote.validUntil,
                    overallDeliveryTime: originalQuote.overallDeliveryTime,
                    overallDeliveryCost: originalQuote.overallDeliveryCost,
                    overallPaymentTerms: originalQuote.overallPaymentTerms,
                    overallCreditDays: originalQuote.overallCreditDays,
                    status: originalQuote.status,
                    reviewedBy: originalQuote.reviewedBy,
                    reviewedAt: originalQuote.reviewedAt,
                    reviewNotes: originalQuote.reviewNotes,
                    siteEngineerNotes: originalQuote.siteEngineerNotes,
                    notes: originalQuote.notes,
                    isActive: originalQuote.isActive,
                    quoteItemsCount: originalQuote.quoteItems?.length || 0,
                    quoteAttachmentsCount: originalQuote.quoteAttachments?.length || 0,
                    createdAt: originalQuote.createdAt,
                    updatedAt: originalQuote.updatedAt
                },
                updatedQuoteData: {
                    quoteId: updatedQuote?._id,
                    quoteTitle: updatedQuote?.quoteTitle,
                    bomId: updatedQuote?.bomId,
                    projectId: updatedQuote?.projectId,
                    vendorId: updatedQuote?.vendorId,
                    siteEngineerId: updatedQuote?.siteEngineerId,
                    createdBy: updatedQuote?.createdBy,
                    creatorRole: updatedQuote?.creatorRole,
                    totalAmount: updatedQuote?.totalAmount,
                    currency: updatedQuote?.currency,
                    validityDays: updatedQuote?.validityDays,
                    validUntil: updatedQuote?.validUntil,
                    overallDeliveryTime: updatedQuote?.overallDeliveryTime,
                    overallDeliveryCost: updatedQuote?.overallDeliveryCost,
                    overallPaymentTerms: updatedQuote?.overallPaymentTerms,
                    overallCreditDays: updatedQuote?.overallCreditDays,
                    status: updatedQuote?.status,
                    reviewedBy: updatedQuote?.reviewedBy,
                    reviewedAt: updatedQuote?.reviewedAt,
                    reviewNotes: updatedQuote?.reviewNotes,
                    siteEngineerNotes: updatedQuote?.siteEngineerNotes,
                    notes: updatedQuote?.notes,
                    isActive: updatedQuote?.isActive,
                    quoteItemsCount: updatedQuote?.quoteItems?.length || 0,
                    quoteAttachmentsCount: updatedQuote?.quoteAttachments?.length || 0,
                    createdAt: updatedQuote?.createdAt,
                    updatedAt: updatedQuote?.updatedAt
                },
                projectId: originalQuote?.projectId?._id,
                projectData: {
                    projectId: originalQuote?.projectId?._id,
                    projectName: originalQuote?.projectId?.projectName,
                    projectCode: originalQuote?.projectId?.projectCode,
                    customerName: originalQuote?.projectId?.customerName
                },
                bomData: {
                    bomId: originalQuote?.bomId?._id,
                    bomTitle: originalQuote?.bomId?.title,
                    bomStatus: originalQuote?.bomId?.status
                },
                vendorData: {
                    vendorId: originalQuote?.vendorId?._id,
                    vendorName: originalQuote?.vendorId?.name,
                    storeName: originalQuote?.vendorId?.storeName,
                    mobileNumber: originalQuote?.vendorId?.mobileNumber,
                    email: originalQuote?.vendorId?.email,
                    address: originalQuote?.vendorId?.address,
                    city: originalQuote?.vendorId?.city,
                    state: originalQuote?.vendorId?.state
                },
                siteEngineerData: {
                    siteEngineerId: originalQuote?.siteEngineerId?._id,
                    siteEngineerName: originalQuote?.siteEngineerId?.name,
                    siteEngineerEmail: originalQuote?.siteEngineerId?.email
                },
                reviewerData: {
                    reviewerId: originalQuote?.reviewedBy?._id,
                    reviewerName: originalQuote?.reviewedBy?.name,
                    reviewerEmail: originalQuote?.reviewedBy?.email
                },
                quoteUpdate: {
                    quoteUpdated: true,
                    updatedBy: req.user?._id,
                    updatedByModel: req.user?.role === 'admin' ? 'Admin' : req.user?.role === 'site-engineer' ? 'Site Engineer' : req.user?.role === 'planning-engineer' ? 'Planning Engineer' : 'User',
                    updatedAt: new Date(),
                    quoteTitle: originalQuote.quoteTitle,
                    vendorName: originalQuote?.vendorId?.storeName,
                    projectName: originalQuote?.projectId?.projectName,
                    totalAmount: updatedQuote?.totalAmount,
                    currency: updatedQuote?.currency,
                    validityDays: updatedQuote?.validityDays,
                    status: updatedQuote?.status,
                    fieldsChanged: Object.keys(changes).length,
                    hasItemsChanged: updateData.quoteItems ? true : false,
                    hasAttachmentsChanged: updateData.quoteAttachments ? true : false
                },
                quoteItemsData: {
                    originalItemsCount: originalQuote.quoteItems?.length || 0,
                    updatedItemsCount: updateData.quoteItems?.length || originalQuote.quoteItems?.length || 0,
                    itemsChanged: updateData.quoteItems ? true : false,
                    originalAttachmentsCount: originalQuote.quoteItems?.reduce((sum, item) => sum + (item.attachments?.length || 0), 0) || 0,
                    updatedAttachmentsCount: updateData.quoteItems?.reduce((sum, item) => sum + (item.attachments?.length || 0), 0) || originalQuote.quoteItems?.reduce((sum, item) => sum + (item.attachments?.length || 0), 0) || 0,
                    itemsWithAlternatives: updateData.quoteItems?.filter(item => item.alternatives && item.alternatives.length > 0).length || originalQuote.quoteItems?.filter(item => item.alternatives && item.alternatives.length > 0).length || 0,
                    averageItemPrice: updateData.quoteItems?.length > 0 ? (updateData.totalAmount || originalQuote.totalAmount) / updateData.quoteItems.length : originalQuote.quoteItems?.length > 0 ? originalQuote.totalAmount / originalQuote.quoteItems.length : 0
                },
                attachmentsData: {
                    originalQuoteAttachments: originalQuote.quoteAttachments?.length || 0,
                    updatedQuoteAttachments: updateData.quoteAttachments?.length || originalQuote.quoteAttachments?.length || 0,
                    quoteAttachmentsChanged: updateData.quoteAttachments ? true : false,
                    originalItemAttachments: originalQuote.quoteItems?.reduce((sum, item) => sum + (item.attachments?.length || 0), 0) || 0,
                    updatedItemAttachments: updateData.quoteItems?.reduce((sum, item) => sum + (item.attachments?.length || 0), 0) || originalQuote.quoteItems?.reduce((sum, item) => sum + (item.attachments?.length || 0), 0) || 0,
                    itemAttachmentsChanged: updateData.quoteItems ? true : false,
                    totalAttachments: (updateData.quoteAttachments?.length || originalQuote.quoteAttachments?.length || 0) + (updateData.quoteItems?.reduce((sum, item) => sum + (item.attachments?.length || 0), 0) || originalQuote.quoteItems?.reduce((sum, item) => sum + (item.attachments?.length || 0), 0) || 0)
                },
                financialData: {
                    originalTotalAmount: originalQuote.totalAmount,
                    updatedTotalAmount: updatedQuote?.totalAmount,
                    amountChanged: originalQuote.totalAmount !== updatedQuote?.totalAmount,
                    currency: updatedQuote?.currency,
                    originalDeliveryCost: originalQuote.overallDeliveryCost,
                    updatedDeliveryCost: updatedQuote?.overallDeliveryCost,
                    originalPaymentTerms: originalQuote.overallPaymentTerms,
                    updatedPaymentTerms: updatedQuote?.overallPaymentTerms,
                    originalCreditDays: originalQuote.overallCreditDays,
                    updatedCreditDays: updatedQuote?.overallCreditDays,
                    originalValidityDays: originalQuote.validityDays,
                    updatedValidityDays: updatedQuote?.validityDays,
                    originalValidUntil: originalQuote.validUntil,
                    updatedValidUntil: updatedQuote?.validUntil
                },
                workflow: {
                    quoteUpdate: true,
                    quoteManagement: true,
                    procurementWorkflow: true,
                    vendorQuotation: true,
                    bomQuotation: true,
                    updateComplete: true
                }
            }
        });
    } catch (error) {
        console.error('Error logging quote update:', error);
    }

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

    // Log the bulk quote creation activity
    try {
        // Get populated data for logging
        const populatedQuotes = await Quote.find({ _id: { $in: quotes.map(q => q._id) } })
            .populate('vendorId', 'storeName name mobileNumber email address city state')
            .populate('siteEngineerId', 'name email')
            .populate('bomId', 'title status projectId')
            .populate('projectId', 'projectName projectCode customerName');

        // Get BOM and project data for context
        const bom = await BOM.findById(bulkData.bomId)
            .populate('projectId', 'projectName projectCode customerName');
        const project = bom?.projectId;

        // Calculate summary statistics
        const totalAmount = quotes.reduce((sum, quote) => sum + (quote.totalAmount || 0), 0);
        const totalItems = quotes.reduce((sum, quote) => sum + (quote.quoteItems?.length || 0), 0);
        const totalAttachments = quotes.reduce((sum, quote) => {
            const quoteAttachments = quote.quoteAttachments?.length || 0;
            const itemAttachments = quote.quoteItems?.reduce((itemSum, item) => itemSum + (item.attachments?.length || 0), 0) || 0;
            return sum + quoteAttachments + itemAttachments;
        }, 0);

        // Group quotes by vendor for analysis
        const quotesByVendor = {};
        quotes.forEach(quote => {
            const vendorId = quote.vendorId?._id?.toString() || 'unknown';
            if (!quotesByVendor[vendorId]) {
                quotesByVendor[vendorId] = {
                    vendor: quote.vendorId,
                    quotes: [],
                    totalAmount: 0,
                    totalItems: 0
                };
            }
            quotesByVendor[vendorId].quotes.push(quote);
            quotesByVendor[vendorId].totalAmount += quote.totalAmount || 0;
            quotesByVendor[vendorId].totalItems += quote.quoteItems?.length || 0;
        });

        await logActivity(req, {
            action: 'bulk_create_quotes',
            targetModel: 'Quote',
            targetId: `bulk_${Date.now()}`,
            targetName: `Bulk Quotes for BOM: ${bom?.title || 'Unknown'}`,
            description: `${req.user?.role === 'admin' ? 'Admin' : req.user?.role === 'site-engineer' ? 'Site Engineer' : req.user?.role === 'planning-engineer' ? 'Planning Engineer' : 'User'} ${req.user?.name || 'Unknown'} (${req.user?.email || 'unknown@example.com'}) created ${quotes.length} quotes in bulk for BOM "${bom?.title}" and project "${project?.projectName || 'Unknown'}"`,
            changes: {
                quotesCreated: {
                    from: 0,
                    to: quotes.length
                },
                totalAmount: {
                    from: 0,
                    to: totalAmount
                },
                totalItems: {
                    from: 0,
                    to: totalItems
                },
                totalAttachments: {
                    from: 0,
                    to: totalAttachments
                },
                createdAt: {
                    from: null,
                    to: new Date()
                }
            },
            previousValues: {
                quotesCreated: 0,
                totalAmount: 0,
                totalItems: 0,
                totalAttachments: 0,
                createdAt: null
            },
            newValues: {
                quotesCreated: quotes.length,
                totalAmount: totalAmount,
                totalItems: totalItems,
                totalAttachments: totalAttachments,
                createdAt: new Date()
            },
            metadata: {
                user: {
                    userId: req.user?._id,
                    userName: req.user?.name,
                    userEmail: req.user?.email,
                    userRole: req.user?.role,
                    userType: req.user?.role === 'admin' ? 'Admin' : req.user?.role === 'site-engineer' ? 'Site Engineer' : req.user?.role === 'planning-engineer' ? 'Planning Engineer' : 'User',
                    userPhone: req.user?.phone
                },
                bulkData: {
                    bomId: bulkData.bomId,
                    projectId: bulkData.projectId,
                    createdBy: bulkData.createdBy,
                    creatorRole: bulkData.creatorRole,
                    siteEngineerId: bulkData.siteEngineerId,
                    quotesCount: bulkData.quotes?.length || 0,
                    createdAt: new Date()
                },
                projectId: project?._id,
                projectData: {
                    projectId: project?._id,
                    projectName: project?.projectName,
                    projectCode: project?.projectCode,
                    customerName: project?.customerName
                },
                bomData: {
                    bomId: bom?._id,
                    bomTitle: bom?.title,
                    bomStatus: bom?.status
                },
                bulkQuoteCreation: {
                    bulkQuotesCreated: true,
                    createdBy: req.user?._id,
                    createdByModel: req.user?.role === 'admin' ? 'Admin' : req.user?.role === 'site-engineer' ? 'Site Engineer' : req.user?.role === 'planning-engineer' ? 'Planning Engineer' : 'User',
                    createdAt: new Date(),
                    bomTitle: bom?.title,
                    projectName: project?.projectName,
                    quotesCreated: quotes.length,
                    totalAmount: totalAmount,
                    totalItems: totalItems,
                    totalAttachments: totalAttachments,
                    averageAmountPerQuote: quotes.length > 0 ? totalAmount / quotes.length : 0,
                    averageItemsPerQuote: quotes.length > 0 ? totalItems / quotes.length : 0,
                    averageAttachmentsPerQuote: quotes.length > 0 ? totalAttachments / quotes.length : 0,
                    creationComplete: true
                },
                quotesSummary: {
                    totalQuotes: quotes.length,
                    totalAmount: totalAmount,
                    totalItems: totalItems,
                    totalAttachments: totalAttachments,
                    averageAmountPerQuote: quotes.length > 0 ? totalAmount / quotes.length : 0,
                    averageItemsPerQuote: quotes.length > 0 ? totalItems / quotes.length : 0,
                    averageAttachmentsPerQuote: quotes.length > 0 ? totalAttachments / quotes.length : 0,
                    quotesWithAttachments: quotes.filter(quote => (quote.quoteAttachments?.length || 0) > 0).length,
                    quotesWithItemAttachments: quotes.filter(quote => quote.quoteItems?.some(item => item.attachments?.length > 0)).length,
                    quotesWithAlternatives: quotes.filter(quote => quote.quoteItems?.some(item => item.alternatives?.length > 0)).length
                },
                quotesByVendor: Object.values(quotesByVendor).map(vendorData => ({
                    vendorId: vendorData.vendor?._id,
                    vendorName: vendorData.vendor?.name,
                    storeName: vendorData.vendor?.storeName,
                    quotesCount: vendorData.quotes.length,
                    totalAmount: vendorData.totalAmount,
                    totalItems: vendorData.totalItems,
                    averageAmountPerQuote: vendorData.quotes.length > 0 ? vendorData.totalAmount / vendorData.quotes.length : 0
                })),
                individualQuotes: quotes.map(quote => ({
                    quoteId: quote._id,
                    quoteTitle: quote.quoteTitle,
                    vendorId: quote.vendorId?._id,
                    vendorName: quote.vendorId?.storeName,
                    totalAmount: quote.totalAmount,
                    currency: quote.currency,
                    validityDays: quote.validityDays,
                    status: quote.status,
                    quoteItemsCount: quote.quoteItems?.length || 0,
                    quoteAttachmentsCount: quote.quoteAttachments?.length || 0,
                    itemAttachmentsCount: quote.quoteItems?.reduce((sum, item) => sum + (item.attachments?.length || 0), 0) || 0,
                    hasAlternatives: quote.quoteItems?.some(item => item.alternatives?.length > 0) || false
                })),
                financialData: {
                    totalAmount: totalAmount,
                    currency: quotes[0]?.currency || 'INR',
                    averageAmountPerQuote: quotes.length > 0 ? totalAmount / quotes.length : 0,
                    minAmount: Math.min(...quotes.map(q => q.totalAmount || 0)),
                    maxAmount: Math.max(...quotes.map(q => q.totalAmount || 0)),
                    totalDeliveryCost: quotes.reduce((sum, quote) => sum + (quote.overallDeliveryCost || 0), 0),
                    averageDeliveryCost: quotes.length > 0 ? quotes.reduce((sum, quote) => sum + (quote.overallDeliveryCost || 0), 0) / quotes.length : 0
                },
                workflow: {
                    bulkQuoteCreation: true,
                    quoteManagement: true,
                    procurementWorkflow: true,
                    vendorQuotation: true,
                    bomQuotation: true,
                    bulkOperation: true,
                    creationComplete: true
                }
            }
        });
    } catch (error) {
        console.error('Error logging bulk quote creation:', error);
    }

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
