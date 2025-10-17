import POVerification from '../models/poVerification.model.js';
import PO from '../models/po.model.js';
import { logActivity } from '../middlewares/activityLog.middleware.js';

export const createPOVerificationService = async (req, data) => {
    console.log('createPOVerificationService called with data:', JSON.stringify(data, null, 2));
    const { poId, items, verificationNotes, attachments } = data;
    
    // Validate required fields
    if (!poId) {
        throw new Error('PO ID is required');
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
        throw new Error('Items array is required and must not be empty');
    }
    
    // Validate each item has required fields
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item.itemId || !item.itemName || item.quantity === undefined || !item.units || item.unitCost === undefined) {
            throw new Error(`Item at index ${i} is missing required fields (itemId, itemName, quantity, units, unitCost)`);
        }
    }
    
    // Get PO details
    const po = await PO.findById(poId).populate('project', 'projectName projectCode');
    if (!po) {
        throw new Error('Purchase Order not found');
    }

    // Create verification request
    const verification = await POVerification.create({
        poId,
        projectId: po.project,
        qualityInspectorId: req.user._id,
        qualityInspectorName: req.user.name,
        items: items.map(item => ({
            itemId: item.itemId,
            itemName: item.itemName,
            quantity: item.quantity,
            units: item.units,
            unitCost: item.unitCost,
            isVerified: item.isVerified,
            verificationNotes: item.verificationNotes,
            verifiedAt: item.isVerified ? new Date() : null,
        })),
        verificationNotes,
        attachments: attachments || [],
        status: 'pending',
    });

    // Mark PO as verified
    await PO.findByIdAndUpdate(poId, {
        isVerified: true,
        verifiedAt: new Date(),
    });

    // Log activity
    await logActivity(req, {
        action: 'po_verification_created',
        targetModel: 'POVerification',
        targetId: verification._id,
        targetName: `PO Verification for ${po.name}`,
        projectId: po.project,
        description: `Quality Inspector Submitted PO verification request`,
        changes: { status: 'pending' },
        metadata: { 
            poId: po._id, 
            projectId: po.project,
            verificationId: verification._id 
        },
    });

    return verification;
};

export const getPOVerificationsService = async (req, params) => {
    const { page = 1, limit = 10, status, projectId } = params;
    const query = { isActive: true };
    
    if (status) query.status = status;
    if (projectId) query.projectId = projectId;
    
    // For Quality Inspectors, only show their own verifications
    if (req.user.role === 'quality-inspector') {
        query.qualityInspectorId = req.user._id;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [verifications, total] = await Promise.all([
        POVerification.find(query)
            .populate('poId', 'name vendorName createdAt')
            .populate('projectId', 'projectName projectCode')
            .populate('qualityInspectorId', 'name email')
            .populate('adminReviewedBy', 'name email')
            .skip(skip)
            .limit(parseInt(limit))
            .sort({ createdAt: -1 }),
        POVerification.countDocuments(query)
    ]);

    return {
        data: verifications,
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
    };
};

export const updatePOVerificationService = async (req, verificationId, data) => {
    const { status, adminNotes } = data;
    
    const verification = await POVerification.findById(verificationId);
    if (!verification) {
        throw new Error('Verification request not found');
    }

    // Update verification
    verification.status = status;
    verification.adminNotes = adminNotes;
    verification.adminReviewedAt = new Date();
    verification.adminReviewedBy = req.user._id;
    await verification.save();

    // Log activity
    await logActivity(req, {
        action: 'po_verification_reviewed',
        targetModel: 'POVerification',
        targetId: verification._id,
        targetName: `PO Verification for ${verification.poId}`,
        projectId: verification.projectId,
        description: `Admin ${status} PO verification request`,
        changes: { status },
        metadata: { 
            poId: verification.poId, 
            projectId: verification.projectId,
            verificationId: verification._id 
        },
    });

    return verification;
};
