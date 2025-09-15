import PO from '../models/po.model.js';
import storage from '../factory/storage.factory.js';
import { v4 as uuidv4 } from 'uuid';
import config from '../config/config.js';
import { logActivity } from '../middlewares/activityLog.middleware.js';
import ApiError from '../utils/ApiError.js';

export const createPOService = async (req, data) => {
    // 1. Create PO DB record first (documents will be empty for now)
    const { vendor, vendorName, vendorWhatsappNumber, project, name, description, notes, originalBomId, documents, items } = data;
    const po = await PO.create({
        vendor,
        vendorName,
        vendorWhatsappNumber,
        project,
        name,
        description,
        notes,
        originalBomId: originalBomId || null,
        items: items || [],
        documents: []
    });

    // Manual activity logging: PO created
    try {
        await logActivity(req, {
            action: 'create_po',
            targetModel: 'PO',
            targetId: po._id,
            targetName: po.name || 'PO',
            description: `PO ${po.name || po._id} created`,
            changes: {
                vendor: { from: null, to: vendor },
                vendorName: { from: null, to: vendorName },
                vendorWhatsappNumber: { from: null, to: vendorWhatsappNumber },
                project: { from: null, to: project },
                name: { from: null, to: name },
                description: { from: null, to: description || '' },
                notes: { from: null, to: notes || '' },
                originalBomId: { from: null, to: originalBomId || null },
                itemsCount: { from: 0, to: (items || []).length },
                documentsCount: { from: 0, to: (documents || []).length }
            },
            previousValues: {
                vendor: null,
                vendorName: null,
                vendorWhatsappNumber: null,
                project: null,
                name: null,
                description: null,
                notes: null,
                originalBomId: null,
                itemsCount: 0,
                documentsCount: 0
            },
            newValues: {
                vendor,
                vendorName,
                vendorWhatsappNumber,
                project,
                name,
                description: description || '',
                notes: notes || '',
                originalBomId: originalBomId || null,
                itemsCount: (items || []).length,
                documentsCount: (documents || []).length
            },
            metadata: {
                projectId: project,
                vendorId: vendor,
                items: (items || []).map((it, idx) => ({ index: idx, itemName: it.itemName, quantity: it.quantity, units: it.units, unitCost: it.unitCost })),
                tmpDocuments: (documents || []).map(d => ({ key: d.key, fileType: d.fileType }))
            }
        });
    } catch (error) {
        console.error('Error logging PO creation:', error);
    }

    const copiedFiles = [];
    try {
        // 2. For each file key, copy from tmp/ to permanent S3 location
        for (const doc of documents) {
            const fileName = doc.key.split('/').pop();
            const permanentKey = `po/${po._id}/${uuidv4()}-${fileName}`;
            await storage.copyFile(doc.key, permanentKey);
            copiedFiles.push({ ...doc, key: permanentKey });
        }
    } catch (err) {
        // 3. If any copy fails, delete all copied files and rethrow
        await Promise.all(
            copiedFiles.map(f => storage.deleteFile(f.key))
        );
        throw err;
    }

    // 4. Update PO record with permanent file keys
    po.documents = copiedFiles;
    await po.save();

    // 5. Delete all tmp/ files first
    await Promise.all(
        (documents || []).map(doc => storage.deleteFile(doc.key))
    );

    // 6. Send WhatsApp message
    try {
        await sendWhatsAppMessage(po, items);
        // Update PO with success status
        po.isSent = true;
        po.sentAt = new Date();
        await po.save();
    } catch (wabaError) {
        console.error('Failed to send WhatsApp message:', wabaError);
        // Update PO with failure status
        po.isSent = false;
        po.sentAt = null;
        await po.save();

        // Throw API error after cleanup
        throw new Error(`WhatsApp message failed: ${wabaError.message}`);
    }

    return po;
};

export const getPOsService = async (query) => {
    const { page = 1, limit = 10, vendor, project, name } = query;
    const filter = {};
    if (vendor) filter.vendor = vendor;
    if (project) filter.project = project;
    if (name) filter.name = { $regex: name, $options: 'i' };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [pos, total] = await Promise.all([
        PO.find(filter)
            .populate('vendor', 'name storeName email mobileNumber address city state')
            .populate('project', 'projectName projectCode')
            .populate('originalBomId', 'title status finalizedAt')
            .skip(skip)
            .limit(parseInt(limit))
            .sort({ createdAt: -1 }),
        PO.countDocuments(filter)
    ]);

    return {
        data: pos,
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
    };
};

export const activatePOService = async (req, id) => {
    const existingPO = await PO.findById(id);
    if (!existingPO) throw new ApiError(404, 'PO not found');

    const updatedPO = await PO.findByIdAndUpdate(id, { isActive: true }, { new: true });

    // Manual activity logging (non-blocking)
    try {
        await logActivity(req, {
            action: 'activate_po',
            targetModel: 'PO',
            targetId: updatedPO._id,
            targetName: updatedPO.name || 'PO',
            description: `PO ${updatedPO.name || updatedPO._id} activated`,
            changes: {
                isActive: { from: existingPO.isActive ?? false, to: true }
            },
            previousValues: { isActive: existingPO.isActive ?? false },
            newValues: { isActive: true },
            metadata: {
                projectId: existingPO.project || updatedPO.project,
                vendor: existingPO.vendor || updatedPO.vendor,
                isSent: updatedPO.isSent || false,
                sentAt: updatedPO.sentAt || null,
                documentsCount: Array.isArray(updatedPO.documents) ? updatedPO.documents.length : 0,
                itemsCount: Array.isArray(updatedPO.items) ? updatedPO.items.length : 0
            }
        });
    } catch (error) {
        console.error('Error logging PO activation:', error);
    }

    return updatedPO;
};

export const deactivatePOService = async (req, id) => {
    const existingPO = await PO.findById(id);
    if (!existingPO) throw new ApiError(404, 'PO not found');

    const updatedPO = await PO.findByIdAndUpdate(id, { isActive: false }, { new: true });

    // Manual activity logging (non-blocking)
    try {
        await logActivity(req, {
            action: 'deactivate_po',
            targetModel: 'PO',
            targetId: updatedPO._id,
            targetName: updatedPO.name || 'PO',
            description: `PO ${updatedPO.name || updatedPO._id} deactivated`,
            changes: {
                isActive: { from: existingPO.isActive ?? true, to: false }
            },
            previousValues: { isActive: existingPO.isActive ?? true },
            newValues: { isActive: false },
            metadata: {
                projectId: existingPO.project || updatedPO.project,
                vendor: existingPO.vendor || updatedPO.vendor,
                isSent: updatedPO.isSent || false,
                sentAt: updatedPO.sentAt || null,
                documentsCount: Array.isArray(updatedPO.documents) ? updatedPO.documents.length : 0,
                itemsCount: Array.isArray(updatedPO.items) ? updatedPO.items.length : 0
            }
        });
    } catch (error) {
        console.error('Error logging PO deactivation:', error);
    }

    return updatedPO;
};

// Helper function to send WhatsApp message
const sendWhatsAppMessage = async (po, items) => {
    try {
        // Format items list for WhatsApp message
        const itemsList = items
            .map(item => `- ${item.itemName} x${item.quantity}`)
            .join('\n');

        // Prepare the message payload
        const messagePayload = {
            template_name: "order_update",
            language: "en_US",
            recipient: po.vendorWhatsappNumber,
            variables: [
                po.vendorName, // {{1}} - Vendor name
                itemsList || "No items specified" // {{2}} - Items list
            ]
        };

        // Send the message to N8N webhook
        const response = await fetch(config.n8n.webhookUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(messagePayload)
        });

        if (!response.ok) {
            // Try to get error details from response
            let errorMessage = `WhatsApp message failed: ${response.status} ${response.statusText}`;
            try {
                const errorData = await response.json();
                if (errorData.message || errorData.error) {
                    errorMessage = `WhatsApp message failed: ${errorData.message || errorData.error}`;
                }
            } catch (parseError) {
                // If response is not JSON, use the default error message
                console.log('Could not parse error response as JSON');
            }
            throw new Error(errorMessage);
        }

        // Check if response contains error information
        try {
            const responseData = await response.json();
            if (responseData.error || responseData.success === false) {
                throw new Error(`WhatsApp message failed: ${responseData.message || responseData.error || 'Unknown error'}`);
            }
            console.log('WhatsApp message sent successfully to:', po.vendorWhatsappNumber);
            return responseData;
        } catch (parseError) {
            // If response is not JSON or parsing fails, assume success
            console.log('WhatsApp message sent successfully to:', po.vendorWhatsappNumber);
            return response;
        }
    } catch (error) {
        console.error('Error sending WhatsApp message:', error);
        throw error;
    }
}; 