import socketManager from '../config/socket.js';
import * as messageService from './message.service.js';
import * as projectService from './project.service.js';
import * as userService from './user.service.js';
import logger from '../config/logger.js';

class SocketService {
    // Message events
    async handleNewMessage(messageData) {
        try {
            const { projectId, senderId, content, files } = messageData;

            // Create message in database
            const message = await messageService.createMessage({
                project: projectId,
                sender: senderId,
                senderModel: messageData.senderModel || 'User',
                content,
                files: files || []
            });

            // Populate sender information
            const populatedMessage = await messageService.getMessageById(message._id);

            // Emit to project room
            socketManager.emitToProject(projectId, 'new-message', {
                message: populatedMessage,
                timestamp: new Date()
            });

            logger.info(`New message sent to project ${projectId}`);
            return populatedMessage;
        } catch (error) {
            logger.error('Error handling new message:', error);
            throw error;
        }
    }

    async handleMessageRead(messageId, userId) {
        try {
            const message = await messageService.updateMessageById(messageId, {
                isRead: true
            }, { user: { id: userId } });

            // Emit read receipt to sender
            socketManager.emitToUser(message.sender, 'message-read', {
                messageId,
                readBy: userId,
                timestamp: new Date()
            });

            logger.info(`Message ${messageId} marked as read by user ${userId}`);
            return message;
        } catch (error) {
            logger.error('Error handling message read:', error);
            throw error;
        }
    }

    // Project events
    async handleProjectUpdate(projectId, updateData) {
        try {
            const project = await projectService.updateProjectById(projectId, updateData);

            // Emit project update to all project members
            socketManager.emitToProject(projectId, 'project-updated', {
                project,
                updatedAt: new Date()
            });

            logger.info(`Project ${projectId} updated`);
            return project;
        } catch (error) {
            logger.error('Error handling project update:', error);
            throw error;
        }
    }

    async handleProjectStatusChange(projectId, newStatus) {
        try {
            const project = await projectService.updateProjectById(projectId, {
                status: newStatus
            });

            // Emit status change notification
            socketManager.emitToProject(projectId, 'project-status-changed', {
                projectId,
                newStatus,
                timestamp: new Date()
            });

            logger.info(`Project ${projectId} status changed to ${newStatus}`);
            return project;
        } catch (error) {
            logger.error('Error handling project status change:', error);
            throw error;
        }
    }

    // Notification events
    async handlePaymentNotification(paymentData) {
        try {
            const { userId, projectId, amount, type } = paymentData;

            // Emit to specific user
            socketManager.emitToUser(userId, 'payment-notification', {
                type: 'payment',
                projectId,
                amount,
                paymentType: type,
                timestamp: new Date()
            });

            // Also emit to project if applicable
            if (projectId) {
                socketManager.emitToProject(projectId, 'project-payment', {
                    userId,
                    amount,
                    type,
                    timestamp: new Date()
                });
            }

            logger.info(`Payment notification sent to user ${userId}`);
        } catch (error) {
            logger.error('Error handling payment notification:', error);
            throw error;
        }
    }

    async handleSiteVisitNotification(visitData) {
        try {
            const { projectId, visitType, userId } = visitData;

            // Emit to project members
            socketManager.emitToProject(projectId, 'site-visit-notification', {
                visitType,
                userId,
                timestamp: new Date()
            });

            logger.info(`Site visit notification sent for project ${projectId}`);
        } catch (error) {
            logger.error('Error handling site visit notification:', error);
            throw error;
        }
    }

    // User events
    async handleUserOnlineStatus(userId, isOnline) {
        try {
            // Update user's online status in database if needed
            // await userService.updateUserById(userId, { isOnline });

            // Emit to user's projects
            const userProjects = await projectService.getProjectsByUser(userId);

            userProjects.forEach(project => {
                socketManager.emitToProject(project._id, 'user-status-changed', {
                    userId,
                    isOnline,
                    timestamp: new Date()
                });
            });

            logger.info(`User ${userId} ${isOnline ? 'online' : 'offline'}`);
        } catch (error) {
            logger.error('Error handling user online status:', error);
            throw error;
        }
    }

    // System events
    async handleSystemNotification(userIds, notificationData) {
        try {
            const { title, message, type, data } = notificationData;

            userIds.forEach(userId => {
                socketManager.emitToUser(userId, 'system-notification', {
                    title,
                    message,
                    type,
                    data,
                    timestamp: new Date()
                });
            });

            logger.info(`System notification sent to ${userIds.length} users`);
        } catch (error) {
            logger.error('Error handling system notification:', error);
            throw error;
        }
    }

    // Get online users for a project
    async getOnlineUsersForProject(projectId) {
        try {
            const project = await projectService.getProjectById(projectId);
            const onlineUsers = [];

            // Check each project member's online status
            if (project.members) {
                for (const member of project.members) {
                    if (socketManager.isUserOnline(member.user)) {
                        onlineUsers.push({
                            userId: member.user,
                            role: member.role,
                            joinedAt: new Date()
                        });
                    }
                }
            }

            return onlineUsers;
        } catch (error) {
            logger.error('Error getting online users for project:', error);
            throw error;
        }
    }

    // Get connection statistics
    getConnectionStats() {
        return {
            connectedUsers: socketManager.getConnectedUsersCount(),
            totalRooms: socketManager.io.sockets.adapter.rooms.size
        };
    }
}

export default new SocketService(); 