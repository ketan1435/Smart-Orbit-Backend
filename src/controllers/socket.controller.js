import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync.js';
import pick from '../utils/pick.js';
import socketService from '../services/socket.service.js';
import socketManager from '../config/socket.js';
import ApiError from '../utils/ApiError.js';

/**
 * Get socket connection statistics
 */
export const getSocketStats = catchAsync(async (req, res) => {
    const stats = socketService.getConnectionStats();

    res.status(httpStatus.OK).json({
        status: 'success',
        message: 'Socket statistics retrieved successfully',
        data: stats
    });
});

/**
 * Get online users for a project
 */
export const getOnlineUsersForProject = catchAsync(async (req, res) => {
    const { projectId } = req.params;
    const onlineUsers = await socketService.getOnlineUsersForProject(projectId);

    res.status(httpStatus.OK).json({
        status: 'success',
        message: 'Online users retrieved successfully',
        data: onlineUsers
    });
});

/**
 * Send system notification to users
 */
export const sendSystemNotification = catchAsync(async (req, res) => {
    const { userIds, notificationData } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'User IDs array is required');
    }

    if (!notificationData || !notificationData.title || !notificationData.message) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Notification data with title and message is required');
    }

    await socketService.handleSystemNotification(userIds, notificationData);

    res.status(httpStatus.OK).json({
        status: 'success',
        message: 'System notification sent successfully'
    });
});

/**
 * Check if a user is online
 */
export const checkUserOnlineStatus = catchAsync(async (req, res) => {
    const { userId } = req.params;
    const isOnline = socketManager.isUserOnline(userId);

    res.status(httpStatus.OK).json({
        status: 'success',
        message: 'User online status retrieved successfully',
        data: {
            userId,
            isOnline
        }
    });
});

/**
 * Get connected users count
 */
export const getConnectedUsersCount = catchAsync(async (req, res) => {
    const count = socketManager.getConnectedUsersCount();

    res.status(httpStatus.OK).json({
        status: 'success',
        message: 'Connected users count retrieved successfully',
        data: {
            connectedUsers: count
        }
    });
});

/**
 * Force disconnect a user (admin only)
 */
export const forceDisconnectUser = catchAsync(async (req, res) => {
    const { userId } = req.params;

    // Check if user is admin
    if (req.user.role !== 'admin') {
        throw new ApiError(httpStatus.FORBIDDEN, 'Only admins can force disconnect users');
    }

    const socketId = socketManager.connectedUsers.get(userId);
    if (socketId) {
        socketManager.io.sockets.sockets.get(socketId)?.disconnect();
    }

    res.status(httpStatus.OK).json({
        status: 'success',
        message: 'User disconnected successfully'
    });
}); 