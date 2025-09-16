import { createActivityLog } from '../services/activityLog.service.js';
import { detectChanges, createChangeDescription, filterSensitiveFields } from '../utils/changeDetection.js';

/**
 * Get action type category
 * @param {string} action - Action name
 * @returns {string} Action type
 */
const getActionType = (action) => {
    const actionTypeMap = {
        'create': 'CRUD',
        'update': 'CRUD',
        'delete': 'CRUD',
        'activate': 'Status Change',
        'deactivate': 'Status Change',
        'approve': 'Workflow',
        'reject': 'Workflow',
        'send': 'Communication',
        'convert': 'Workflow',
        'finalize': 'Workflow'
    };
    return actionTypeMap[action] || 'System';
};

/**
 * Manual logging function for custom operations
 * @param {Object} req - Express request object
 * @param {Object} options - Logging options
 * @param {string} options.action - Action performed
 * @param {string} options.targetModel - Target model name
 * @param {string} options.targetId - Target document ID
 * @param {string} options.targetName - Target document name
 * @param {Object} options.changes - Changes made
 * @param {Object} options.previousValues - Previous values
 * @param {Object} options.newValues - New values
 * @param {string} options.description - Custom description
 * @param {Object} options.metadata - Additional metadata
 */
export const logActivity = async (req, options = {}) => {
    try {
        const {
            action,
            targetModel,
            targetId,
            targetName,
            changes = {},
            previousValues = {},
            newValues = {},
            description,
            metadata = {}
        } = options;

        if (!action || !targetModel || !targetId || !targetName) {
            throw new Error('Missing required logging parameters');
        }

        const userInfo = {
            user: req.user?._id,
            userModel: req.user?.role === 'admin' ? 'Admin' : 'User',
            userName: req.user?.name || 'Unknown',
            userEmail: req.user?.email || 'unknown@example.com'
        };

        const logData = {
            ...userInfo,
            targetModel,
            targetId,
            targetName,
            action,
            actionType: getActionType(action),
            changes,
            previousValues,
            newValues,
            description: description || createChangeDescription(changes, action, targetName),
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent'),
            metadata: {
                ...metadata,
                method: req.method,
                url: req.url,
                timestamp: new Date()
            }
        };

        await createActivityLog(logData);
    } catch (error) {
        console.error('Error in manual activity logging:', error);
    }
};

/**
 * Helper function to log CRUD operations with change detection
 * @param {Object} req - Express request object
 * @param {string} action - Action performed
 * @param {string} targetModel - Target model name
 * @param {Object} originalDoc - Original document (for updates)
 * @param {Object} newDoc - New/updated document
 * @param {Object} options - Additional options
 */
export const logCRUDOperation = async (req, action, targetModel, originalDoc, newDoc, options = {}) => {
    try {
        const {
            excludeFields = ['__v', 'updatedAt'],
            sensitiveFields = ['password', 'token', 'secret', 'key'],
            customDescription,
            metadata = {}
        } = options;

        let changes = {};
        let previousValues = {};
        let newValues = {};
        let targetId = newDoc?._id || originalDoc?._id;
        let targetName = newDoc?.name || newDoc?.title || newDoc?.storeName || targetId?.toString() || 'Unknown';

        // Detect changes for update operations
        if (action === 'update' && originalDoc && newDoc) {
            const changeResult = detectChanges(originalDoc, newDoc, excludeFields);
            changes = filterSensitiveFields(changeResult.changes, sensitiveFields);
            previousValues = changeResult.previousValues;
            newValues = changeResult.newValues;
        }

        // Create description
        const description = customDescription || createChangeDescription(changes, action, targetName);

        await logActivity(req, {
            action,
            targetModel,
            targetId,
            targetName,
            changes,
            previousValues,
            newValues,
            description,
            metadata
        });
    } catch (error) {
        console.error('Error in CRUD operation logging:', error);
    }
};

/**
 * Helper function to log status changes
 * @param {Object} req - Express request object
 * @param {string} action - Action performed (activate, deactivate, etc.)
 * @param {string} targetModel - Target model name
 * @param {Object} doc - Document being modified
 * @param {Object} options - Additional options
 */
export const logStatusChange = async (req, action, targetModel, doc, options = {}) => {
    try {
        const {
            customDescription,
            metadata = {}
        } = options;

        const targetId = doc._id;
        const targetName = doc.name || doc.title || doc.storeName || targetId.toString();

        const description = customDescription || `${action} ${targetModel}: ${targetName}`;

        await logActivity(req, {
            action,
            targetModel,
            targetId,
            targetName,
            description,
            metadata: {
                ...metadata,
                statusChange: true,
                previousStatus: doc.isActive,
                newStatus: action === 'activate' ? true : action === 'deactivate' ? false : undefined
            }
        });
    } catch (error) {
        console.error('Error in status change logging:', error);
    }
};

/**
 * Helper function to log workflow actions
 * @param {Object} req - Express request object
 * @param {string} action - Action performed (approve, reject, convert, finalize, etc.)
 * @param {string} targetModel - Target model name
 * @param {Object} doc - Document being modified
 * @param {Object} options - Additional options
 */
export const logWorkflowAction = async (req, action, targetModel, doc, options = {}) => {
    try {
        const {
            customDescription,
            metadata = {}
        } = options;

        const targetId = doc._id;
        const targetName = doc.name || doc.title || doc.storeName || doc.projectName || targetId.toString();

        const description = customDescription || `${action} ${targetModel}: ${targetName}`;

        await logActivity(req, {
            action,
            targetModel,
            targetId,
            targetName,
            description,
            metadata: {
                ...metadata,
                workflowAction: true,
                actionPerformed: action
            }
        });
    } catch (error) {
        console.error('Error in workflow action logging:', error);
    }
};

/**
 * Helper function to log communication actions
 * @param {Object} req - Express request object
 * @param {string} action - Action performed (send, notify, etc.)
 * @param {string} targetModel - Target model name
 * @param {Object} doc - Document being modified
 * @param {Object} options - Additional options
 */
export const logCommunicationAction = async (req, action, targetModel, doc, options = {}) => {
    try {
        const {
            customDescription,
            metadata = {}
        } = options;

        const targetId = doc._id;
        const targetName = doc.name || doc.title || doc.storeName || targetId.toString();

        const description = customDescription || `${action} ${targetModel}: ${targetName}`;

        await logActivity(req, {
            action,
            targetModel,
            targetId,
            targetName,
            description,
            metadata: {
                ...metadata,
                communicationAction: true,
                actionPerformed: action
            }
        });
    } catch (error) {
        console.error('Error in communication action logging:', error);
    }
};

/**
 * Helper function to log file operations
 * @param {Object} req - Express request object
 * @param {string} action - Action performed (upload, download, delete, etc.)
 * @param {string} targetModel - Target model name
 * @param {Object} doc - Document being modified
 * @param {Object} options - Additional options
 */
export const logFileOperation = async (req, action, targetModel, doc, options = {}) => {
    try {
        const {
            customDescription,
            metadata = {}
        } = options;

        const targetId = doc._id;
        const targetName = doc.name || doc.title || doc.filename || targetId.toString();

        const description = customDescription || `${action} ${targetModel}: ${targetName}`;

        await logActivity(req, {
            action,
            targetModel,
            targetId,
            targetName,
            description,
            metadata: {
                ...metadata,
                fileOperation: true,
                actionPerformed: action
            }
        });
    } catch (error) {
        console.error('Error in file operation logging:', error);
    }
};