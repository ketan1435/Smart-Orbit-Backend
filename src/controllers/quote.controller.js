import {
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
    updateExpiredQuotes
} from '../services/quote.service.js';
import catchAsync from '../utils/catchAsync.js';
import ApiError from '../utils/ApiError.js';
import { logActivity } from '../middlewares/activityLog.middleware.js';
import Quote from '../models/quote.model.js';

/**
 * Create a new quote
 * @route POST /quotes
 * @access Private (Site Engineer, Planning Engineer)
 */
const createQuoteController = catchAsync(async (req, res) => {
    const quoteData = {
        ...req.body,
        siteEngineerId: req.user.id // Set from authenticated user
    };

    const quote = await createQuote(quoteData);

    res.status(201).json({
        status: 1,
        message: 'Quote created successfully',
        data: quote
    });
});

/**
 * Get quotes with pagination and filters
 * @route GET /quotes
 * @access Private
 */
const getQuotesController = catchAsync(async (req, res) => {
    const { query } = req;

    const result = await getQuotes({}, {
        page: parseInt(query.page) || 1,
        limit: parseInt(query.limit) || 10,
        sortBy: query.sortBy || 'createdAt',
        sortOrder: query.sortOrder || 'desc',
        bomId: query.bomId,
        projectId: query.projectId,
        vendorId: query.vendorId,
        siteEngineerId: query.siteEngineerId,
        status: query.status,
        isActive: query.isActive !== 'false'
    });

    res.status(200).json({
        status: 1,
        message: 'Quotes retrieved successfully',
        data: result.quotes,
        pagination: result.pagination
    });
});

/**
 * Get quote by ID
 * @route GET /quotes/:id
 * @access Private
 */
const getQuoteByIdController = catchAsync(async (req, res) => {
    const { id } = req.params;

    const quote = await getQuoteById(id);

    res.status(200).json({
        status: 1,
        message: 'Quote retrieved successfully',
        data: quote
    });
});

/**
 * Update quote
 * @route PUT /quotes/:id
 * @access Private (Site Engineer, Planning Engineer)
 */
const updateQuoteController = catchAsync(async (req, res) => {
    const { id } = req.params;
    const updateData = req.body;

    const quote = await updateQuote(id, updateData);

    res.status(200).json({
        status: 1,
        message: 'Quote updated successfully',
        data: quote
    });
});

/**
 * Delete quote (soft delete)
 * @route DELETE /quotes/:id
 * @access Private (Site Engineer, Planning Engineer)
 */
const deleteQuoteController = catchAsync(async (req, res) => {
    const { id } = req.params;

    const result = await deleteQuote(req, id);

    res.status(200).json({
        status: 1,
        message: result.message
    });
});

/**
 * Get quotes by BOM ID
 * @route GET /quotes/bom/:bomId
 * @access Private
 */
const getQuotesByBOMController = catchAsync(async (req, res) => {
    const { bomId } = req.params;

    const quotes = await getQuotesByBOM(bomId);

    res.status(200).json({
        status: 1,
        message: 'Quotes retrieved successfully',
        data: quotes
    });
});

/**
 * Get quote comparison for BOM items
 * @route GET /quotes/comparison/:bomId
 * @access Private
 */
const getQuoteComparisonController = catchAsync(async (req, res) => {
    const { bomId } = req.params;
    const { includeExpired } = req.query;

    const comparison = await getQuoteComparison(bomId, includeExpired === 'true');

    res.status(200).json({
        status: 1,
        message: 'Quote comparison retrieved successfully',
        data: comparison
    });
});

/**
 * Review quote (for planning engineer)
 * @route POST /quotes/:id/review
 * @access Private (Planning Engineer)
 */
const reviewQuoteController = catchAsync(async (req, res) => {
    const { id } = req.params;
    const reviewData = req.body;
    const reviewerId = req.user.id;

    const quote = await reviewQuote(req, id, reviewerId, reviewData);

    res.status(200).json({
        status: 1,
        message: 'Quote reviewed successfully',
        data: quote
    });
});

/**
 * Bulk create quotes
 * @route POST /quotes/bulk
 * @access Private (Site Engineer)
 */
const bulkCreateQuotesController = catchAsync(async (req, res) => {
    const bulkData = {
        ...req.body,
        siteEngineerId: req.user.id // Set from authenticated user
    };

    const quotes = await bulkCreateQuotes(bulkData);

    res.status(201).json({
        status: 1,
        message: `${quotes.length} quotes created successfully`,
        data: quotes
    });
});

/**
 * Get quote statistics
 * @route GET /quotes/stats
 * @access Private
 */
const getQuoteStatsController = catchAsync(async (req, res) => {
    const { query } = req;

    const filters = {
        bomId: query.bomId,
        projectId: query.projectId,
        siteEngineerId: query.siteEngineerId
    };

    const stats = await getQuoteStats(filters);

    res.status(200).json({
        status: 1,
        message: 'Quote statistics retrieved successfully',
        data: stats
    });
});

/**
 * Update expired quotes (cron job endpoint)
 * @route POST /quotes/update-expired
 * @access Private (Admin)
 */
const updateExpiredQuotesController = catchAsync(async (req, res) => {
    const result = await updateExpiredQuotes();

    res.status(200).json({
        status: 1,
        message: result.message,
        data: {
            modifiedCount: result.modifiedCount
        }
    });
});

/**
 * Get quotes for site engineer dashboard
 * @route GET /quotes/my-quotes
 * @access Private (Site Engineer)
 */
const getMyQuotesController = catchAsync(async (req, res) => {
    const { query } = req;
    const siteEngineerId = req.user.id;

    const result = await getQuotes({}, {
        page: parseInt(query.page) || 1,
        limit: parseInt(query.limit) || 10,
        sortBy: query.sortBy || 'createdAt',
        sortOrder: query.sortOrder || 'desc',
        siteEngineerId,
        status: query.status,
        isActive: true
    });

    res.status(200).json({
        status: 1,
        message: 'Your quotes retrieved successfully',
        data: result.quotes,
        pagination: result.pagination
    });
});

/**
 * Get quotes for planning engineer review
 * @route GET /quotes/for-review
 * @access Private (Planning Engineer)
 */
const getQuotesForReviewController = catchAsync(async (req, res) => {
    const { query } = req;

    const result = await getQuotes({}, {
        page: parseInt(query.page) || 1,
        limit: parseInt(query.limit) || 10,
        sortBy: query.sortBy || 'createdAt',
        sortOrder: query.sortOrder || 'desc',
        bomId: query.bomId,
        projectId: query.projectId,
        status: 'submitted', // Only submitted quotes for review
        isActive: true
    });

    res.status(200).json({
        status: 1,
        message: 'Quotes for review retrieved successfully',
        data: result.quotes,
        pagination: result.pagination
    });
});

/**
 * Submit quote for review
 * @route POST /quotes/:id/submit
 * @access Private (Site Engineer)
 */
const submitQuoteController = catchAsync(async (req, res) => {
    const { id } = req.params;
    const siteEngineerId = req.user.id;

    // Verify the quote belongs to the site engineer
    const quote = await getQuoteById(id);
    if (quote.siteEngineerId._id.toString() !== siteEngineerId) {
        throw new ApiError(403, 'You can only submit your own quotes');
    }

    // Store original status for change detection
    const originalStatus = quote.status;

    const updatedQuote = await updateQuote(id, { status: 'submitted' });

    // Log the quote submission activity
    try {
        // Get populated data for logging
        const populatedQuote = await Quote.findById(id)
            .populate('vendorId', 'storeName name mobileNumber email address city state')
            .populate('siteEngineerId', 'name email')
            .populate('bomId', 'title status projectId')
            .populate('projectId', 'projectName projectCode customerName')
            .populate('reviewedBy', 'name email');

        await logActivity(req, {
            action: 'submit_quote',
            targetModel: 'Quote',
            targetId: id,
            targetName: quote.quoteTitle || 'Quote',
            description: `${req.user?.role === 'admin' ? 'Admin' : req.user?.role === 'site-engineer' ? 'Site Engineer' : req.user?.role === 'planning-engineer' ? 'Planning Engineer' : 'User'} ${req.user?.name || 'Unknown'} (${req.user?.email || 'unknown@example.com'}) submitted quote "${quote.quoteTitle}" for review to vendor: ${populatedQuote?.vendorId?.storeName || 'Unknown Vendor'}`,
            changes: {
                status: {
                    from: originalStatus,
                    to: 'submitted'
                },
                submittedAt: {
                    from: null,
                    to: new Date()
                },
                updatedAt: {
                    from: quote.updatedAt,
                    to: new Date()
                }
            },
            previousValues: {
                status: originalStatus,
                submittedAt: null,
                updatedAt: quote.updatedAt
            },
            newValues: {
                status: 'submitted',
                submittedAt: new Date(),
                updatedAt: new Date()
            },
            metadata: {
                projectId: populatedQuote?.projectId?._id,
                user: {
                    userId: req.user?._id,
                    userName: req.user?.name,
                    userEmail: req.user?.email,
                    userRole: req.user?.role,
                    userType: req.user?.role === 'admin' ? 'Admin' : req.user?.role === 'site-engineer' ? 'Site Engineer' : req.user?.role === 'planning-engineer' ? 'Planning Engineer' : 'User',
                    userPhone: req.user?.phone
                },
                originalQuoteData: {
                    quoteId: quote._id,
                    quoteTitle: quote.quoteTitle,
                    bomId: quote.bomId,
                    projectId: quote.projectId,
                    vendorId: quote.vendorId,
                    siteEngineerId: quote.siteEngineerId,
                    createdBy: quote.createdBy,
                    creatorRole: quote.creatorRole,
                    totalAmount: quote.totalAmount,
                    currency: quote.currency,
                    validityDays: quote.validityDays,
                    validUntil: quote.validUntil,
                    overallDeliveryTime: quote.overallDeliveryTime,
                    overallDeliveryCost: quote.overallDeliveryCost,
                    overallPaymentTerms: quote.overallPaymentTerms,
                    overallCreditDays: quote.overallCreditDays,
                    status: originalStatus,
                    reviewedBy: quote.reviewedBy,
                    reviewedAt: quote.reviewedAt,
                    reviewNotes: quote.reviewNotes,
                    siteEngineerNotes: quote.siteEngineerNotes,
                    notes: quote.notes,
                    isActive: quote.isActive,
                    quoteItemsCount: quote.quoteItems?.length || 0,
                    quoteAttachmentsCount: quote.quoteAttachments?.length || 0,
                    createdAt: quote.createdAt,
                    updatedAt: quote.updatedAt
                },
                submittedQuoteData: {
                    quoteId: quote._id,
                    quoteTitle: quote.quoteTitle,
                    bomId: quote.bomId,
                    projectId: quote.projectId,
                    vendorId: quote.vendorId,
                    siteEngineerId: quote.siteEngineerId,
                    createdBy: quote.createdBy,
                    creatorRole: quote.creatorRole,
                    totalAmount: quote.totalAmount,
                    currency: quote.currency,
                    validityDays: quote.validityDays,
                    validUntil: quote.validUntil,
                    overallDeliveryTime: quote.overallDeliveryTime,
                    overallDeliveryCost: quote.overallDeliveryCost,
                    overallPaymentTerms: quote.overallPaymentTerms,
                    overallCreditDays: quote.overallCreditDays,
                    status: 'submitted',
                    reviewedBy: quote.reviewedBy,
                    reviewedAt: quote.reviewedAt,
                    reviewNotes: quote.reviewNotes,
                    siteEngineerNotes: quote.siteEngineerNotes,
                    notes: quote.notes,
                    isActive: quote.isActive,
                    quoteItemsCount: quote.quoteItems?.length || 0,
                    quoteAttachmentsCount: quote.quoteAttachments?.length || 0,
                    createdAt: quote.createdAt,
                    updatedAt: new Date()
                },
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
                quoteSubmission: {
                    quoteSubmitted: true,
                    submittedBy: req.user?._id,
                    submittedByModel: req.user?.role === 'admin' ? 'Admin' : req.user?.role === 'site-engineer' ? 'Site Engineer' : req.user?.role === 'planning-engineer' ? 'Planning Engineer' : 'User',
                    submittedAt: new Date(),
                    quoteTitle: quote.quoteTitle,
                    vendorName: populatedQuote?.vendorId?.storeName,
                    projectName: populatedQuote?.projectId?.projectName,
                    totalAmount: quote.totalAmount,
                    currency: quote.currency,
                    validityDays: quote.validityDays,
                    originalStatus: originalStatus,
                    newStatus: 'submitted',
                    statusChanged: originalStatus !== 'submitted',
                    submissionComplete: true
                },
                submissionData: {
                    submissionStatus: 'submitted',
                    submissionTimestamp: new Date(),
                    submissionComplete: true,
                    awaitingReview: true,
                    reviewRequired: true
                },
                financialData: {
                    totalAmount: quote.totalAmount,
                    currency: quote.currency,
                    overallDeliveryCost: quote.overallDeliveryCost,
                    overallPaymentTerms: quote.overallPaymentTerms,
                    overallCreditDays: quote.overallCreditDays,
                    validityDays: quote.validityDays,
                    validUntil: quote.validUntil
                },
                workflow: {
                    quoteSubmission: true,
                    quoteManagement: true,
                    procurementWorkflow: true,
                    vendorQuotation: true,
                    bomQuotation: true,
                    siteEngineerSubmission: true,
                    awaitingPlanningEngineerReview: true,
                    submissionComplete: true
                }
            }
        });
    } catch (error) {
        console.error('Error logging quote submission:', error);
    }

    res.status(200).json({
        status: 1,
        message: 'Quote submitted for review successfully',
        data: updatedQuote
    });
});

/**
 * Accept quote
 * @route POST /quotes/:id/accept
 * @access Private (Planning Engineer)
 */
const acceptQuoteController = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { reviewNotes } = req.body;
    const reviewerId = req.user.id;

    const quote = await reviewQuote(req, id, reviewerId, {
        status: 'accepted',
        reviewNotes
    });

    res.status(200).json({
        status: 1,
        message: 'Quote accepted successfully',
        data: quote
    });
});

/**
 * Reject quote
 * @route POST /quotes/:id/reject
 * @access Private (Planning Engineer)
 */
const rejectQuoteController = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { reviewNotes } = req.body;
    const reviewerId = req.user.id;

    const quote = await reviewQuote(req, id, reviewerId, {
        status: 'rejected',
        reviewNotes
    });

    res.status(200).json({
        status: 1,
        message: 'Quote rejected successfully',
        data: quote
    });
});

export {
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
};
