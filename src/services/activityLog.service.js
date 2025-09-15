import ActivityLog from '../models/activityLog.model.js';
import { EventEmitter } from 'events';

// Create event emitter instance
const activityEventEmitter = new EventEmitter();

// Export the event emitter for use in other parts of the application
export { activityEventEmitter };

/**
 * Create a new activity log entry
 * @param {Object} logData - The log data
 * @param {Object} logData.user - User object with _id, name, email
 * @param {String} logData.userModel - Model type ('User' or 'Admin')
 * @param {String} logData.targetModel - Target model name
 * @param {String} logData.targetId - Target document ID
 * @param {String} logData.targetName - Target document name/title
 * @param {String} logData.action - Action performed
 * @param {String} logData.actionType - Type of action
 * @param {Object} logData.changes - Changes made
 * @param {Object} logData.previousValues - Previous values
 * @param {Object} logData.newValues - New values
 * @param {String} logData.description - Human readable description
 * @param {String} logData.ipAddress - IP address
 * @param {String} logData.userAgent - User agent
 * @param {Object} logData.metadata - Additional metadata
 * @returns {Promise<Object>} Created activity log
 */
export const createActivityLog = async (logData) => {
    try {
        const activityLog = await ActivityLog.create(logData);

        // Emit event for real-time notifications or other services
        activityEventEmitter.emit('activity.created', {
            logId: activityLog._id,
            user: logData.user,
            targetModel: logData.targetModel,
            targetId: logData.targetId,
            action: logData.action,
            timestamp: activityLog.timestamp
        });

        return activityLog;
    } catch (error) {
        console.error('Error creating activity log:', error);
        throw error;
    }
};

/**
 * Get activity logs with filtering and pagination
 * @param {Object} filters - Filter options
 * @param {String} filters.user - User ID
 * @param {String} filters.userModel - User model type
 * @param {String} filters.targetModel - Target model
 * @param {String} filters.targetId - Target ID
 * @param {String} filters.action - Action type
 * @param {String} filters.actionType - Action type category
 * @param {Date} filters.startDate - Start date
 * @param {Date} filters.endDate - End date
 * @param {Number} filters.page - Page number
 * @param {Number} filters.limit - Items per page
 * @returns {Promise<Object>} Paginated activity logs
 */
export const getActivityLogs = async (filters = {}) => {
    try {
        const {
            user,
            userModel,
            targetModel,
            targetId,
            action,
            actionType,
            startDate,
            endDate,
            page = 1,
            limit = 20
        } = filters;

        // Build query
        const query = { isActive: true };

        if (user) query.user = user;
        if (userModel) query.userModel = userModel;
        if (targetModel) query.targetModel = targetModel;
        if (targetId) query.targetId = targetId;
        if (action) query.action = action;
        if (actionType) query.actionType = actionType;

        if (startDate || endDate) {
            query.timestamp = {};
            if (startDate) query.timestamp.$gte = new Date(startDate);
            if (endDate) query.timestamp.$lte = new Date(endDate);
        }

        // Calculate pagination
        const skip = (page - 1) * limit;

        // Execute query
        const [logs, total] = await Promise.all([
            ActivityLog.find(query)
                .populate('user', 'name email')
                .sort({ timestamp: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            ActivityLog.countDocuments(query)
        ]);

        return {
            logs,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        };
    } catch (error) {
        console.error('Error fetching activity logs:', error);
        throw error;
    }
};

/**
 * Get activity logs for a specific target
 * @param {String} targetModel - Target model name
 * @param {String} targetId - Target document ID
 * @param {Number} limit - Number of logs to return
 * @returns {Promise<Array>} Activity logs for the target
 */
export const getTargetActivityLogs = async (targetModel, targetId, limit = 10) => {
    try {
        const logs = await ActivityLog.find({
            targetModel,
            targetId,
            isActive: true
        })
            .populate('user', 'name email')
            .sort({ timestamp: -1 })
            .limit(limit)
            .lean();

        return logs;
    } catch (error) {
        console.error('Error fetching target activity logs:', error);
        throw error;
    }
};

/**
 * Get user activity logs
 * @param {String} userId - User ID
 * @param {String} userModel - User model type
 * @param {Number} limit - Number of logs to return
 * @returns {Promise<Array>} User activity logs
 */
export const getUserActivityLogs = async (userId, userModel, limit = 20) => {
    try {
        const logs = await ActivityLog.find({
            user: userId,
            userModel,
            isActive: true
        })
            .populate('user', 'name email')
            .sort({ timestamp: -1 })
            .limit(limit)
            .lean();

        return logs;
    } catch (error) {
        console.error('Error fetching user activity logs:', error);
        throw error;
    }
};

/**
 * Get activity statistics
 * @param {Object} filters - Filter options
 * @returns {Promise<Object>} Activity statistics
 */
export const getActivityStats = async (filters = {}) => {
    try {
        const query = { isActive: true };

        if (filters.startDate || filters.endDate) {
            query.timestamp = {};
            if (filters.startDate) query.timestamp.$gte = new Date(filters.startDate);
            if (filters.endDate) query.timestamp.$lte = new Date(filters.endDate);
        }

        const [
            totalLogs,
            actionStats,
            userStats,
            targetStats
        ] = await Promise.all([
            ActivityLog.countDocuments(query),
            ActivityLog.aggregate([
                { $match: query },
                { $group: { _id: '$action', count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ]),
            ActivityLog.aggregate([
                { $match: query },
                { $group: { _id: '$userModel', count: { $sum: 1 } } }
            ]),
            ActivityLog.aggregate([
                { $match: query },
                { $group: { _id: '$targetModel', count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ])
        ]);

        return {
            totalLogs,
            actionStats,
            userStats,
            targetStats
        };
    } catch (error) {
        console.error('Error fetching activity stats:', error);
        throw error;
    }
};

/**
 * Delete activity log (soft delete)
 * @param {String} logId - Log ID
 * @returns {Promise<Object>} Updated log
 */
export const deleteActivityLog = async (logId) => {
    try {
        const log = await ActivityLog.findByIdAndUpdate(
            logId,
            { isActive: false },
            { new: true }
        );

        if (!log) {
            throw new Error('Activity log not found');
        }

        // Emit event
        activityEventEmitter.emit('activity.deleted', {
            logId: log._id,
            timestamp: new Date()
        });

        return log;
    } catch (error) {
        console.error('Error deleting activity log:', error);
        throw error;
    }
};

/**
 * Get comprehensive project logs with guarantee
 * @param {String} projectId - Project ID
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Comprehensive project logs
 */
export const getProjectLogs = async (projectId, options = {}) => {
    try {
        const {
            startDate,
            endDate,
            action,
            actionType,
            user,
            includeEmbedded = true,
            includeRelated = true,
            page = 1,
            limit = 100
        } = options;

        // Build base query for direct project logs
        const baseQuery = {
            isActive: true,
            $or: [
                { targetModel: 'Project', targetId: projectId }
            ]
        };

        // Add additional filters
        if (startDate || endDate) {
            baseQuery.timestamp = {};
            if (startDate) baseQuery.timestamp.$gte = new Date(startDate);
            if (endDate) baseQuery.timestamp.$lte = new Date(endDate);
        }
        if (action) baseQuery.action = action;
        if (actionType) baseQuery.actionType = actionType;
        if (user) baseQuery.user = user;

        // If including related entities, expand the query
        if (includeRelated) {
            // Get related entities that might have logs
            const relatedQueries = [
                { targetModel: 'CustomerLead', 'metadata.projectId': projectId },
                { targetModel: 'ClientProposal', 'metadata.projectId': projectId },
                { targetModel: 'BOM', 'metadata.projectId': projectId },
                { targetModel: 'PO', 'metadata.projectId': projectId },
                { targetModel: 'Quote', 'metadata.projectId': projectId },
                { targetModel: 'Sitework', 'metadata.projectId': projectId },
                // { targetModel: 'SiteVisit', 'metadata.projectId': projectId },
                // { targetModel: 'File', 'metadata.projectId': projectId }
            ];

            baseQuery.$or = baseQuery.$or.concat(relatedQueries);
        }

        // If including embedded documents, add embedded document queries
        if (includeEmbedded) {
            const embeddedQueries = [
                { 'metadata.embeddedDocument': 'architectProposal', 'metadata.projectId': projectId },
                { 'metadata.embeddedDocument': 'architectDocument', 'metadata.projectId': projectId },
                { 'metadata.embeddedDocument': 'proposal', 'metadata.projectId': projectId },
                { 'metadata.embeddedDocument': 'siteworkDocument', 'metadata.projectId': projectId }
            ];

            baseQuery.$or = baseQuery.$or.concat(embeddedQueries);
        }

        // Calculate pagination
        const skip = (page - 1) * limit;

        // Execute comprehensive query
        const [logs, total, stats] = await Promise.all([
            ActivityLog.find(baseQuery)
                .populate('user', 'name email role')
                .sort({ timestamp: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            ActivityLog.countDocuments(baseQuery),
            getProjectLogStats(projectId, { startDate, endDate })
        ]);

        // Group logs by category for better organization
        const categorizedLogs = categorizeProjectLogs(logs);

        return {
            logs,
            categorizedLogs,
            stats,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            },
            projectId,
            queryOptions: {
                startDate,
                endDate,
                action,
                actionType,
                user,
                includeEmbedded,
                includeRelated
            }
        };
    } catch (error) {
        console.error('Error fetching project logs:', error);
        throw error;
    }
};

/**
 * Get project log statistics
 * @param {String} projectId - Project ID
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Project log statistics
 */
export const getProjectLogStats = async (projectId, options = {}) => {
    try {
        const { startDate, endDate } = options;

        const baseQuery = {
            isActive: true,
            $or: [
                { targetModel: 'Project', targetId: projectId },
                { 'metadata.projectId': projectId }
            ]
        };

        if (startDate || endDate) {
            baseQuery.timestamp = {};
            if (startDate) baseQuery.timestamp.$gte = new Date(startDate);
            if (endDate) baseQuery.timestamp.$lte = new Date(endDate);
        }

        const [
            totalLogs,
            actionStats,
            userStats,
            targetStats,
            timelineStats,
            embeddedStats
        ] = await Promise.all([
            ActivityLog.countDocuments(baseQuery),
            ActivityLog.aggregate([
                { $match: baseQuery },
                { $group: { _id: '$action', count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ]),
            ActivityLog.aggregate([
                { $match: baseQuery },
                { $group: { _id: { user: '$user', userModel: '$userModel' }, count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 10 }
            ]),
            ActivityLog.aggregate([
                { $match: baseQuery },
                { $group: { _id: '$targetModel', count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ]),
            ActivityLog.aggregate([
                { $match: baseQuery },
                {
                    $group: {
                        _id: {
                            year: { $year: '$timestamp' },
                            month: { $month: '$timestamp' },
                            day: { $dayOfMonth: '$timestamp' }
                        },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { '_id.year': -1, '_id.month': -1, '_id.day': -1 } },
                { $limit: 30 }
            ]),
            ActivityLog.aggregate([
                { $match: { ...baseQuery, 'metadata.embeddedDocument': { $exists: true } } },
                { $group: { _id: '$metadata.embeddedDocument', count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ])
        ]);

        return {
            totalLogs,
            actionStats,
            userStats,
            targetStats,
            timelineStats,
            embeddedStats,
            projectId
        };
    } catch (error) {
        console.error('Error fetching project log stats:', error);
        throw error;
    }
};

/**
 * Categorize project logs for better organization
 * @param {Array} logs - Array of log entries
 * @returns {Object} Categorized logs
 */
const categorizeProjectLogs = (logs) => {
    const categories = {
        project: [],
        customerLead: [],
        clientProposal: [],
        bom: [],
        po: [],
        quote: [],
        sitework: [],
        siteVisit: [],
        file: [],
        embedded: {
            architectProposal: [],
            architectDocument: [],
            proposal: [],
            siteworkDocument: []
        },
        workflow: [],
        communication: [],
        crud: [],
        statusChange: []
    };

    logs.forEach(log => {
        // Categorize by target model
        switch (log.targetModel) {
            case 'Project':
                categories.project.push(log);
                break;
            case 'CustomerLead':
                categories.customerLead.push(log);
                break;
            case 'ClientProposal':
                categories.clientProposal.push(log);
                break;
            case 'BOM':
                categories.bom.push(log);
                break;
            case 'PO':
                categories.po.push(log);
                break;
            case 'Quote':
                categories.quote.push(log);
                break;
            case 'Sitework':
                categories.sitework.push(log);
                break;
            case 'SiteVisit':
                categories.siteVisit.push(log);
                break;
            case 'File':
                categories.file.push(log);
                break;
        }

        // Categorize embedded documents
        if (log.metadata?.embeddedDocument) {
            const embeddedType = log.metadata.embeddedDocument;
            if (categories.embedded[embeddedType]) {
                categories.embedded[embeddedType].push(log);
            }
        }

        // Categorize by action type
        switch (log.actionType) {
            case 'Workflow':
                categories.workflow.push(log);
                break;
            case 'Communication':
                categories.communication.push(log);
                break;
            case 'CRUD':
                categories.crud.push(log);
                break;
            case 'Status Change':
                categories.statusChange.push(log);
                break;
        }
    });

    return categories;
};

/**
 * Clean up old activity logs (hard delete)
 * @param {Number} daysOld - Number of days old logs to delete
 * @returns {Promise<Number>} Number of deleted logs
 */
export const cleanupOldLogs = async (daysOld = 365) => {
    try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);

        const result = await ActivityLog.deleteMany({
            timestamp: { $lt: cutoffDate },
            isActive: false
        });

        console.log(`Cleaned up ${result.deletedCount} old activity logs`);
        return result.deletedCount;
    } catch (error) {
        console.error('Error cleaning up old logs:', error);
        throw error;
    }
};
