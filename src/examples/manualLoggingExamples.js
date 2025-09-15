/**
 * Comprehensive Manual Logging Examples
 * 
 * This file demonstrates how to use the manual logging system
 * for different types of operations across various models.
 */

import {
    logActivity,
    logCRUDOperation,
    logStatusChange,
    logWorkflowAction,
    logCommunicationAction,
    logFileOperation
} from '../middlewares/activityLog.middleware.js';
import { detectChanges } from '../utils/changeDetection.js';

// ============================================================================
// VENDOR OPERATIONS EXAMPLES
// ============================================================================

/**
 * Example: Log vendor creation
 */
export const logVendorCreation = async (req, vendor) => {
    await logActivity(req, {
        action: 'create',
        targetModel: 'Vendor',
        targetId: vendor._id,
        targetName: vendor.storeName || vendor.name,
        description: `Created vendor: ${vendor.storeName} (${vendor.name})`,
        metadata: {
            vendorData: {
                name: vendor.name,
                storeName: vendor.storeName,
                email: vendor.email,
                city: vendor.city,
                state: vendor.state,
                country: vendor.country
            }
        }
    });
};

/**
 * Example: Log vendor update with change detection
 */
export const logVendorUpdate = async (req, originalVendor, updatedVendor) => {
    // Detect changes
    const { changes, previousValues, newValues } = detectChanges(
        originalVendor,
        updatedVendor,
        ['__v', 'updatedAt']
    );

    await logActivity(req, {
        action: 'update',
        targetModel: 'Vendor',
        targetId: updatedVendor._id,
        targetName: updatedVendor.storeName || updatedVendor.name,
        changes,
        previousValues,
        newValues,
        description: `Updated vendor: ${updatedVendor.storeName} (${updatedVendor.name})`,
        metadata: {
            changeCount: Object.keys(changes).length,
            updatedFields: Object.keys(changes)
        }
    });
};

/**
 * Example: Log vendor deletion
 */
export const logVendorDeletion = async (req, vendor) => {
    await logActivity(req, {
        action: 'delete',
        targetModel: 'Vendor',
        targetId: vendor._id,
        targetName: vendor.storeName || vendor.name,
        description: `Deleted vendor: ${vendor.storeName} (${vendor.name})`,
        metadata: {
            deletionType: 'soft_delete',
            vendorData: {
                name: vendor.name,
                storeName: vendor.storeName,
                email: vendor.email
            }
        }
    });
};

/**
 * Example: Log vendor status change
 */
export const logVendorStatusChange = async (req, vendor, action) => {
    await logStatusChange(req, action, 'Vendor', vendor, {
        customDescription: `${action} vendor: ${vendor.storeName} (${vendor.name})`,
        metadata: {
            reason: 'Admin action',
            previousStatus: vendor.isActive,
            newStatus: action === 'activate'
        }
    });
};

// ============================================================================
// PROJECT OPERATIONS EXAMPLES
// ============================================================================

/**
 * Example: Log project creation
 */
export const logProjectCreation = async (req, project) => {
    await logActivity(req, {
        action: 'create',
        targetModel: 'Project',
        targetId: project._id,
        targetName: project.projectName,
        description: `Created project: ${project.projectName} (${project.projectCode})`,
        metadata: {
            projectData: {
                projectName: project.projectName,
                projectCode: project.projectCode,
                status: project.status,
                budget: project.budget
            }
        }
    });
};

/**
 * Example: Log project status update
 */
export const logProjectStatusUpdate = async (req, project, newStatus, reason) => {
    await logActivity(req, {
        action: 'update',
        targetModel: 'Project',
        targetId: project._id,
        targetName: project.projectName,
        changes: {
            status: {
                from: project.status,
                to: newStatus,
                type: 'modified'
            }
        },
        description: `Updated project status: ${project.projectName} - ${project.status} → ${newStatus}`,
        metadata: {
            statusChange: true,
            reason: reason,
            previousStatus: project.status,
            newStatus: newStatus
        }
    });
};

// ============================================================================
// CLIENT PROPOSAL OPERATIONS EXAMPLES
// ============================================================================

/**
 * Example: Log proposal conversion to work order
 */
export const logProposalToWorkOrderConversion = async (req, proposal) => {
    await logWorkflowAction(req, 'convert', 'ClientProposal', proposal, {
        customDescription: `Converted proposal to work order: ${proposal.projectName}`,
        metadata: {
            conversionType: 'proposal_to_workorder',
            proposalId: proposal._id,
            projectName: proposal.projectName,
            conversionReason: 'Client approved proposal'
        }
    });
};

/**
 * Example: Log work order sent to planning engineer
 */
export const logWorkOrderSentToPlanning = async (req, proposal, project) => {
    await logWorkflowAction(req, 'send', 'ClientProposal', proposal, {
        customDescription: `Sent work order to planning engineer: ${proposal.projectName}`,
        metadata: {
            workflowStep: 'sent_to_planning_engineer',
            projectId: project._id,
            projectName: project.projectName,
            sentAt: new Date()
        }
    });
};

// ============================================================================
// PURCHASE ORDER OPERATIONS EXAMPLES
// ============================================================================

/**
 * Example: Log PO creation
 */
export const logPOCreation = async (req, po) => {
    await logActivity(req, {
        action: 'create',
        targetModel: 'PO',
        targetId: po._id,
        targetName: po.name,
        description: `Created purchase order: ${po.name} for vendor ${po.vendorName}`,
        metadata: {
            poData: {
                name: po.name,
                vendorName: po.vendorName,
                projectId: po.project,
                itemCount: po.items?.length || 0,
                totalAmount: po.items?.reduce((sum, item) => sum + (item.unitCost * item.quantity), 0) || 0
            }
        }
    });
};

/**
 * Example: Log PO WhatsApp message sent
 */
export const logPOWhatsAppSent = async (req, po) => {
    await logCommunicationAction(req, 'send', 'PO', po, {
        customDescription: `Sent WhatsApp message for PO: ${po.name} to ${po.vendorName}`,
        metadata: {
            communicationType: 'whatsapp',
            recipient: po.vendorWhatsappNumber,
            vendorName: po.vendorName,
            sentAt: po.sentAt,
            isSent: po.isSent
        }
    });
};

// ============================================================================
// BOM OPERATIONS EXAMPLES
// ============================================================================

/**
 * Example: Log BOM finalization
 */
export const logBOMFinalization = async (req, bom) => {
    await logWorkflowAction(req, 'finalize', 'BOM', bom, {
        customDescription: `Finalized BOM: ${bom.title}`,
        metadata: {
            finalizationData: {
                title: bom.title,
                itemCount: bom.items?.length || 0,
                finalizedBy: bom.finalizedBy,
                finalizedAt: bom.finalizedAt
            }
        }
    });
};

// ============================================================================
// USER OPERATIONS EXAMPLES
// ============================================================================

/**
 * Example: Log user creation
 */
export const logUserCreation = async (req, user) => {
    await logActivity(req, {
        action: 'create',
        targetModel: 'User',
        targetId: user._id,
        targetName: user.name,
        description: `Created user: ${user.name} (${user.email})`,
        metadata: {
            userData: {
                name: user.name,
                email: user.email,
                role: user.role,
                isActive: user.isActive
            }
        }
    });
};

/**
 * Example: Log user role change
 */
export const logUserRoleChange = async (req, user, oldRole, newRole) => {
    await logActivity(req, {
        action: 'update',
        targetModel: 'User',
        targetId: user._id,
        targetName: user.name,
        changes: {
            role: {
                from: oldRole,
                to: newRole,
                type: 'modified'
            }
        },
        description: `Changed user role: ${user.name} - ${oldRole} → ${newRole}`,
        metadata: {
            roleChange: true,
            previousRole: oldRole,
            newRole: newRole,
            changedBy: req.user?.name
        }
    });
};

// ============================================================================
// FILE OPERATIONS EXAMPLES
// ============================================================================

/**
 * Example: Log file upload
 */
export const logFileUpload = async (req, file, targetModel, targetId) => {
    await logFileOperation(req, 'upload', 'File', file, {
        customDescription: `Uploaded file: ${file.filename} for ${targetModel}`,
        metadata: {
            fileData: {
                filename: file.filename,
                fileType: file.fileType,
                size: file.size,
                targetModel: targetModel,
                targetId: targetId
            }
        }
    });
};

/**
 * Example: Log file deletion
 */
export const logFileDeletion = async (req, file) => {
    await logFileOperation(req, 'delete', 'File', file, {
        customDescription: `Deleted file: ${file.filename}`,
        metadata: {
            fileData: {
                filename: file.filename,
                fileType: file.fileType,
                deletedAt: new Date()
            }
        }
    });
};

// ============================================================================
// CUSTOM OPERATIONS EXAMPLES
// ============================================================================

/**
 * Example: Log custom business operation
 */
export const logCustomOperation = async (req, operation, targetModel, targetId, targetName, details) => {
    await logActivity(req, {
        action: 'custom',
        targetModel: targetModel,
        targetId: targetId,
        targetName: targetName,
        description: `Custom operation: ${operation} on ${targetModel}`,
        metadata: {
            customOperation: true,
            operationType: operation,
            details: details,
            performedAt: new Date()
        }
    });
};

/**
 * Example: Log bulk operation
 */
export const logBulkOperation = async (req, action, targetModel, items, operationDetails) => {
    await logActivity(req, {
        action: action,
        targetModel: targetModel,
        targetId: 'bulk_operation',
        targetName: `Bulk ${action} - ${items.length} items`,
        description: `Bulk ${action}: ${items.length} ${targetModel} items`,
        metadata: {
            bulkOperation: true,
            itemCount: items.length,
            itemIds: items.map(item => item._id),
            operationDetails: operationDetails
        }
    });
};

// ============================================================================
// ERROR LOGGING EXAMPLES
// ============================================================================

/**
 * Example: Log operation failure
 */
export const logOperationFailure = async (req, action, targetModel, targetId, targetName, error) => {
    await logActivity(req, {
        action: 'error',
        targetModel: targetModel,
        targetId: targetId,
        targetName: targetName,
        description: `Failed to ${action} ${targetModel}: ${error.message}`,
        metadata: {
            errorOperation: true,
            attemptedAction: action,
            errorMessage: error.message,
            errorStack: error.stack,
            failedAt: new Date()
        }
    });
};

// ============================================================================
// INTEGRATION EXAMPLES
// ============================================================================

/**
 * Example: How to integrate logging into a service function
 */
export const exampleVendorServiceWithLogging = async (req, vendorData) => {
    try {
        // Create vendor
        const vendor = await Vendor.create(vendorData);

        // Log the creation
        await logVendorCreation(req, vendor);

        return vendor;
    } catch (error) {
        // Log the error
        await logOperationFailure(req, 'create', 'Vendor', null, 'Unknown', error);
        throw error;
    }
};

/**
 * Example: How to integrate logging into an update service function
 */
export const exampleVendorUpdateWithLogging = async (req, vendorId, updateData) => {
    try {
        // Get original vendor
        const originalVendor = await Vendor.findById(vendorId).lean();
        if (!originalVendor) {
            throw new Error('Vendor not found');
        }

        // Update vendor
        const updatedVendor = await Vendor.findByIdAndUpdate(vendorId, updateData, { new: true });

        // Log the update
        await logVendorUpdate(req, originalVendor, updatedVendor);

        return updatedVendor;
    } catch (error) {
        // Log the error
        await logOperationFailure(req, 'update', 'Vendor', vendorId, 'Unknown', error);
        throw error;
    }
};

/**
 * Example: How to integrate logging into a status change service function
 */
export const exampleVendorStatusChangeWithLogging = async (req, vendorId, action) => {
    try {
        // Update vendor status
        const vendor = await Vendor.findByIdAndUpdate(
            vendorId,
            { isActive: action === 'activate' },
            { new: true }
        );

        if (!vendor) {
            throw new Error('Vendor not found');
        }

        // Log the status change
        await logVendorStatusChange(req, vendor, action);

        return vendor;
    } catch (error) {
        // Log the error
        await logOperationFailure(req, action, 'Vendor', vendorId, 'Unknown', error);
        throw error;
    }
};
