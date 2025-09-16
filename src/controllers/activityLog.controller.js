import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync.js';
import ApiError from '../utils/ApiError.js';
import ActivityLog from '../models/activityLog.model.js';
import {
    getActivityLogs,
    getTargetActivityLogs,
    getUserActivityLogs,
    getActivityStats,
    deleteActivityLog,
    cleanupOldLogs,
    getProjectLogs,
    getProjectLogStats
} from '../services/activityLog.service.js';

/**
 * Get activity logs with filtering and pagination
 */
const getLogs = catchAsync(async (req, res) => {
    const filters = {
        user: req.query.user,
        userModel: req.query.userModel,
        targetModel: req.query.targetModel,
        targetId: req.query.targetId,
        action: req.query.action,
        actionType: req.query.actionType,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20
    };

    const result = await getActivityLogs(filters);

    res.status(httpStatus.OK).json({
        status: 1,
        message: 'Activity logs fetched successfully',
        data: result.logs,
        pagination: result.pagination
    });
});

/**
 * Get activity logs for a specific target
 */
const getTargetLogs = catchAsync(async (req, res) => {
    const { targetModel, targetId } = req.params;
    const limit = parseInt(req.query.limit) || 10;

    const logs = await getTargetActivityLogs(targetModel, targetId, limit);

    res.status(httpStatus.OK).json({
        status: 1,
        message: 'Target activity logs fetched successfully',
        data: logs
    });
});

/**
 * Get activity logs for a specific user
 */
const getUserLogs = catchAsync(async (req, res) => {
    const { userId, userModel } = req.params;
    const limit = parseInt(req.query.limit) || 20;

    const logs = await getUserActivityLogs(userId, userModel, limit);

    res.status(httpStatus.OK).json({
        status: 1,
        message: 'User activity logs fetched successfully',
        data: logs
    });
});

/**
 * Get activity statistics
 */
const getStats = catchAsync(async (req, res) => {
    const filters = {
        startDate: req.query.startDate,
        endDate: req.query.endDate
    };

    const stats = await getActivityStats(filters);

    res.status(httpStatus.OK).json({
        status: 1,
        message: 'Activity statistics fetched successfully',
        data: stats
    });
});

/**
 * Delete activity log (soft delete)
 */
const deleteLog = catchAsync(async (req, res) => {
    const { logId } = req.params;

    const log = await deleteActivityLog(logId);

    res.status(httpStatus.OK).json({
        status: 1,
        message: 'Activity log deleted successfully',
        data: log
    });
});

/**
 * Clean up old activity logs
 */
const cleanupLogs = catchAsync(async (req, res) => {
    const daysOld = parseInt(req.query.daysOld) || 365;

    const deletedCount = await cleanupOldLogs(daysOld);

    res.status(httpStatus.OK).json({
        status: 1,
        message: `Cleaned up ${deletedCount} old activity logs`,
        data: { deletedCount }
    });
});

/**
 * Get activity log by ID
 */
const getLogById = catchAsync(async (req, res) => {
    const { logId } = req.params;

    const log = await ActivityLog.findById(logId)
        .populate('user', 'name email')
        .lean();

    if (!log) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Activity log not found');
    }

    res.status(httpStatus.OK).json({
        status: 1,
        message: 'Activity log fetched successfully',
        data: log
    });
});

/**
 * Get recent activity (last 24 hours)
 */
const getRecentActivity = catchAsync(async (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    const targetModel = req.query.targetModel;
    const targetId = req.query.targetId;

    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const query = {
        timestamp: { $gte: oneDayAgo },
        isActive: true
    };

    if (targetModel) query.targetModel = targetModel;
    if (targetId) query.targetId = targetId;

    const logs = await ActivityLog.find(query)
        .populate('user', 'name email')
        .sort({ timestamp: -1 })
        .limit(limit)
        .lean();

    res.status(httpStatus.OK).json({
        status: 1,
        message: 'Recent activity fetched successfully',
        data: logs
    });
});

/**
 * Get activity summary for dashboard
 */
const getActivitySummary = catchAsync(async (req, res) => {
    const { days = 7 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const [
        totalLogs,
        recentLogs,
        topUsers,
        topActions,
        topTargets
    ] = await Promise.all([
        ActivityLog.countDocuments({
            timestamp: { $gte: startDate },
            isActive: true
        }),
        ActivityLog.find({
            timestamp: { $gte: startDate },
            isActive: true
        })
            .populate('user', 'name email')
            .sort({ timestamp: -1 })
            .limit(10)
            .lean(),
        ActivityLog.aggregate([
            { $match: { timestamp: { $gte: startDate }, isActive: true } },
            { $group: { _id: { user: '$user', userModel: '$userModel' }, count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 }
        ]),
        ActivityLog.aggregate([
            { $match: { timestamp: { $gte: startDate }, isActive: true } },
            { $group: { _id: '$action', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 }
        ]),
        ActivityLog.aggregate([
            { $match: { timestamp: { $gte: startDate }, isActive: true } },
            { $group: { _id: '$targetModel', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 }
        ])
    ]);

    res.status(httpStatus.OK).json({
        status: 1,
        message: 'Activity summary fetched successfully',
        data: {
            totalLogs,
            recentLogs,
            topUsers,
            topActions,
            topTargets,
            period: `${days} days`
        }
    });
});

/**
 * Get comprehensive project logs with guarantee
 */
const getProjectLogsController = catchAsync(async (req, res) => {
    const { projectId } = req.params;
    const {
        startDate,
        endDate,
        action,
        actionType,
        user,
        includeEmbedded = 'true',
        includeRelated = 'true',
        page = 1,
        limit = 100
    } = req.query;

    const options = {
        startDate,
        endDate,
        action,
        actionType,
        user,
        includeEmbedded: includeEmbedded === 'true',
        includeRelated: includeRelated === 'true',
        page: parseInt(page),
        limit: parseInt(limit)
    };

    const result = await getProjectLogs(projectId, options);

    res.status(httpStatus.OK).json({
        status: 1,
        message: 'Project logs fetched successfully',
        data: result
    });
});

/**
 * Get project log statistics
 */
const getProjectLogStatsController = catchAsync(async (req, res) => {
    const { projectId } = req.params;
    const { startDate, endDate } = req.query;

    const options = { startDate, endDate };
    const stats = await getProjectLogStats(projectId, options);

    res.status(httpStatus.OK).json({
        status: 1,
        message: 'Project log statistics fetched successfully',
        data: stats
    });
});

export {
    getLogs,
    getTargetLogs,
    getUserLogs,
    getStats,
    deleteLog,
    cleanupLogs,
    getLogById,
    getRecentActivity,
    getActivitySummary,
    getProjectLogsController,
    getProjectLogStatsController
};
