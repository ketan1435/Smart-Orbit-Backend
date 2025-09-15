import { logActivity } from './activityLog.middleware.js';
import { detectChanges, createChangeDescription, filterSensitiveFields } from '../utils/changeDetection.js';

/**
 * Helper function to log embedded document operations
 * @param {Object} req - Express request object
 * @param {string} action - Action performed (add, update, remove)
 * @param {string} parentModel - Parent model name (e.g., 'Project')
 * @param {string} parentId - Parent document ID
 * @param {string} parentName - Parent document name
 * @param {string} embeddedField - Name of the embedded field (e.g., 'architectProposals')
 * @param {Object} embeddedDoc - The embedded document being modified
 * @param {Object} options - Additional options
 */
export const logEmbeddedDocumentOperation = async (req, action, parentModel, parentId, parentName, embeddedField, embeddedDoc, options = {}) => {
    try {
        const {
            customDescription,
            metadata = {},
            excludeFields = ['__v', 'updatedAt'],
            sensitiveFields = ['password', 'token', 'secret', 'key']
        } = options;

        // Create a unique target ID for the embedded document
        const embeddedDocId = embeddedDoc._id || embeddedDoc.id || `${parentId}_${embeddedField}_${Date.now()}`;
        const embeddedDocName = embeddedDoc.architect?.name || embeddedDoc.architect?.email || embeddedDoc.title || embeddedDoc.name || embeddedDocId;

        // Create description
        const description = customDescription || `${action} ${embeddedField} in ${parentModel}: ${parentName}`;

        // Create log data
        const logData = {
            action: action,
            targetModel: parentModel,
            targetId: parentId,
            targetName: parentName,
            description: description,
            metadata: {
                ...metadata,
                embeddedDocument: true,
                embeddedField: embeddedField,
                embeddedDocId: embeddedDocId,
                embeddedDocName: embeddedDocName,
                embeddedDocData: filterSensitiveFields(embeddedDoc, sensitiveFields),
                operationType: 'embedded_document_operation'
            }
        };

        await logActivity(req, logData);
    } catch (error) {
        console.error('Error in embedded document logging:', error);
    }
};

/**
 * Helper function to log embedded document array operations
 * @param {Object} req - Express request object
 * @param {string} action - Action performed (add, update, remove, reorder)
 * @param {string} parentModel - Parent model name
 * @param {string} parentId - Parent document ID
 * @param {string} parentName - Parent document name
 * @param {string} embeddedField - Name of the embedded field
 * @param {Array} originalArray - Original array of embedded documents
 * @param {Array} newArray - New array of embedded documents
 * @param {Object} options - Additional options
 */
export const logEmbeddedArrayOperation = async (req, action, parentModel, parentId, parentName, embeddedField, originalArray, newArray, options = {}) => {
    try {
        const {
            customDescription,
            metadata = {},
            excludeFields = ['__v', 'updatedAt'],
            sensitiveFields = ['password', 'token', 'secret', 'key']
        } = options;

        // Detect changes in the array
        const { changes, previousValues, newValues } = detectChanges(
            { [embeddedField]: originalArray },
            { [embeddedField]: newArray },
            excludeFields
        );

        // Create description
        const description = customDescription || `${action} ${embeddedField} in ${parentModel}: ${parentName} (${newArray.length} items)`;

        // Create log data
        const logData = {
            action: action,
            targetModel: parentModel,
            targetId: parentId,
            targetName: parentName,
            changes: changes,
            previousValues: previousValues,
            newValues: newValues,
            description: description,
            metadata: {
                ...metadata,
                embeddedDocument: true,
                embeddedField: embeddedField,
                arrayOperation: true,
                originalCount: originalArray.length,
                newCount: newArray.length,
                operationType: 'embedded_array_operation'
            }
        };

        await logActivity(req, logData);
    } catch (error) {
        console.error('Error in embedded array logging:', error);
    }
};

/**
 * Helper function to log embedded document field updates
 * @param {Object} req - Express request object
 * @param {string} parentModel - Parent model name
 * @param {string} parentId - Parent document ID
 * @param {string} parentName - Parent document name
 * @param {string} embeddedField - Name of the embedded field
 * @param {Object} originalEmbeddedDoc - Original embedded document
 * @param {Object} updatedEmbeddedDoc - Updated embedded document
 * @param {Object} options - Additional options
 */
export const logEmbeddedDocumentUpdate = async (req, parentModel, parentId, parentName, embeddedField, originalEmbeddedDoc, updatedEmbeddedDoc, options = {}) => {
    try {
        const {
            customDescription,
            metadata = {},
            excludeFields = ['__v', 'updatedAt'],
            sensitiveFields = ['password', 'token', 'secret', 'key']
        } = options;

        // Detect changes in the embedded document
        const { changes, previousValues, newValues } = detectChanges(
            originalEmbeddedDoc,
            updatedEmbeddedDoc,
            excludeFields
        );

        // Filter sensitive fields
        const filteredChanges = filterSensitiveFields(changes, sensitiveFields);

        // Create description
        const embeddedDocName = updatedEmbeddedDoc.architect?.name || updatedEmbeddedDoc.architect?.email || updatedEmbeddedDoc.title || updatedEmbeddedDoc.name || 'Unknown';
        const description = customDescription || `Updated ${embeddedField} in ${parentModel}: ${parentName} - ${embeddedDocName}`;

        // Create log data
        const logData = {
            action: 'update',
            targetModel: parentModel,
            targetId: parentId,
            targetName: parentName,
            changes: filteredChanges,
            previousValues: previousValues,
            newValues: newValues,
            description: description,
            metadata: {
                ...metadata,
                embeddedDocument: true,
                embeddedField: embeddedField,
                embeddedDocId: updatedEmbeddedDoc._id || updatedEmbeddedDoc.id,
                embeddedDocName: embeddedDocName,
                changeCount: Object.keys(filteredChanges).length,
                updatedFields: Object.keys(filteredChanges),
                operationType: 'embedded_document_update'
            }
        };

        await logActivity(req, logData);
    } catch (error) {
        console.error('Error in embedded document update logging:', error);
    }
};

/**
 * Helper function to log embedded document status changes
 * @param {Object} req - Express request object
 * @param {string} action - Action performed (approve, reject, activate, deactivate)
 * @param {string} parentModel - Parent model name
 * @param {string} parentId - Parent document ID
 * @param {string} parentName - Parent document name
 * @param {string} embeddedField - Name of the embedded field
 * @param {Object} embeddedDoc - The embedded document being modified
 * @param {Object} options - Additional options
 */
export const logEmbeddedDocumentStatusChange = async (req, action, parentModel, parentId, parentName, embeddedField, embeddedDoc, options = {}) => {
    try {
        const {
            customDescription,
            metadata = {},
            sensitiveFields = ['password', 'token', 'secret', 'key']
        } = options;

        // Create description
        const embeddedDocName = embeddedDoc.architect?.name || embeddedDoc.architect?.email || embeddedDoc.title || embeddedDoc.name || 'Unknown';
        const description = customDescription || `${action} ${embeddedField} in ${parentModel}: ${parentName} - ${embeddedDocName}`;

        // Create log data
        const logData = {
            action: action,
            targetModel: parentModel,
            targetId: parentId,
            targetName: parentName,
            description: description,
            metadata: {
                ...metadata,
                embeddedDocument: true,
                embeddedField: embeddedField,
                embeddedDocId: embeddedDoc._id || embeddedDoc.id,
                embeddedDocName: embeddedDocName,
                statusChange: true,
                previousStatus: embeddedDoc.status,
                newStatus: action === 'approve' ? 'Approved' : action === 'reject' ? 'Rejected' : action === 'activate' ? 'Active' : 'Inactive',
                operationType: 'embedded_document_status_change'
            }
        };

        await logActivity(req, logData);
    } catch (error) {
        console.error('Error in embedded document status change logging:', error);
    }
};

/**
 * Helper function to log embedded document bulk operations
 * @param {Object} req - Express request object
 * @param {string} action - Action performed (bulk_add, bulk_update, bulk_remove)
 * @param {string} parentModel - Parent model name
 * @param {string} parentId - Parent document ID
 * @param {string} parentName - Parent document name
 * @param {string} embeddedField - Name of the embedded field
 * @param {Array} items - Array of items being processed
 * @param {Object} options - Additional options
 */
export const logEmbeddedDocumentBulkOperation = async (req, action, parentModel, parentId, parentName, embeddedField, items, options = {}) => {
    try {
        const {
            customDescription,
            metadata = {},
            sensitiveFields = ['password', 'token', 'secret', 'key']
        } = options;

        // Create description
        const description = customDescription || `${action} ${items.length} ${embeddedField} in ${parentModel}: ${parentName}`;

        // Create log data
        const logData = {
            action: action,
            targetModel: parentModel,
            targetId: parentId,
            targetName: parentName,
            description: description,
            metadata: {
                ...metadata,
                embeddedDocument: true,
                embeddedField: embeddedField,
                bulkOperation: true,
                itemCount: items.length,
                itemIds: items.map(item => item._id || item.id),
                operationType: 'embedded_document_bulk_operation'
            }
        };

        await logActivity(req, logData);
    } catch (error) {
        console.error('Error in embedded document bulk operation logging:', error);
    }
};

/**
 * Helper function to get embedded document activity logs
 * @param {string} parentModel - Parent model name
 * @param {string} parentId - Parent document ID
 * @param {string} embeddedField - Name of the embedded field
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of activity logs
 */
export const getEmbeddedDocumentLogs = async (parentModel, parentId, embeddedField, options = {}) => {
    try {
        const { activityLogService } = await import('../services/activityLog.service.js');

        const filter = {
            targetModel: parentModel,
            targetId: parentId,
            'metadata.embeddedDocument': true,
            'metadata.embeddedField': embeddedField
        };

        const logs = await activityLogService.queryActivityLogs(filter, options);
        return logs;
    } catch (error) {
        console.error('Error getting embedded document logs:', error);
        return [];
    }
};

/**
 * Helper function to get all embedded document logs for a parent
 * @param {string} parentModel - Parent model name
 * @param {string} parentId - Parent document ID
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of activity logs
 */
export const getAllEmbeddedDocumentLogs = async (parentModel, parentId, options = {}) => {
    try {
        const { activityLogService } = await import('../services/activityLog.service.js');

        const filter = {
            targetModel: parentModel,
            targetId: parentId,
            'metadata.embeddedDocument': true
        };

        const logs = await activityLogService.queryActivityLogs(filter, options);
        return logs;
    } catch (error) {
        console.error('Error getting all embedded document logs:', error);
        return [];
    }
};

/**
 * Helper function to get embedded document logs by action
 * @param {string} parentModel - Parent model name
 * @param {string} parentId - Parent document ID
 * @param {string} embeddedField - Name of the embedded field
 * @param {string} action - Action to filter by
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of activity logs
 */
export const getEmbeddedDocumentLogsByAction = async (parentModel, parentId, embeddedField, action, options = {}) => {
    try {
        const { activityLogService } = await import('../services/activityLog.service.js');

        const filter = {
            targetModel: parentModel,
            targetId: parentId,
            'metadata.embeddedDocument': true,
            'metadata.embeddedField': embeddedField,
            action: action
        };

        const logs = await activityLogService.queryActivityLogs(filter, options);
        return logs;
    } catch (error) {
        console.error('Error getting embedded document logs by action:', error);
        return [];
    }
};
