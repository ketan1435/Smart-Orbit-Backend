import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import config from './config.js';
import logger from './logger.js';

class SocketManager {
    constructor() {
        this.io = null;
        this.connectedUsers = new Map(); // userId -> socketId
        this.userRooms = new Map(); // userId -> Set of room names
    }

    initialize(server) {
        this.io = new Server(server, {
            cors: {
                origin: process.env.CLIENT_URL || "http://localhost:5173",
                methods: ["GET", "POST"],
                credentials: true
            },
            transports: ['websocket', 'polling']
        });

        this.setupMiddleware();
        this.setupEventHandlers();

        logger.info('Socket.IO server initialized');
    }

    setupMiddleware() {
        // Authentication middleware
        this.io.use(async (socket, next) => {
            try {
                const token = socket.handshake.auth.token || socket.handshake.headers.authorization;

                logger.info('Socket connection attempt - Token provided:', !!token);

                if (!token) {
                    logger.error('Socket authentication error: No token provided');
                    return next(new Error('Authentication error: No token provided'));
                }

                const cleanToken = token.replace('Bearer ', '');
                const decoded = jwt.verify(cleanToken, config.jwt.secret);

                socket.userId = decoded.sub;
                socket.userRole = decoded.role;

                socket.userModel = decoded.role === 'Admin' ? 'Admin' : 'User';

                logger.info(`Socket authentication successful for user: ${socket.userId}`);
                next();
            } catch (error) {
                logger.error('Socket authentication error:', error.message);
                next(new Error('Authentication error: Invalid token'));
            }
        });
    }

    setupEventHandlers() {
        this.io.on('connection', (socket) => {
            logger.info(`User connected: ${socket.userId} (${socket.userRole})`);

            // Store user connection
            this.connectedUsers.set(socket.userId, socket.id);

            // Join user to their personal room
            socket.join(`user:${socket.userId}`);

            // Handle user joining project rooms
            socket.on('join-project', (projectId) => {
                this.joinProjectRoom(socket, projectId);
            });

            // Handle user leaving project rooms
            socket.on('leave-project', (projectId) => {
                this.leaveProjectRoom(socket, projectId);
            });

            // Handle typing events
            socket.on('typing-start', (data) => {
                this.handleTypingStart(socket, data);
            });

            socket.on('typing-stop', (data) => {
                this.handleTypingStop(socket, data);
            });

            // Handle socket-based messaging
            socket.on('send-message', (data) => {
                this.handleSendMessage(socket, data);
            });

            socket.on('load-messages', (data) => {
                this.handleLoadMessages(socket, data);
            });

            socket.on('message-read', (data) => {
                this.handleMessageRead(socket, data);
            });

            // Handle disconnect
            socket.on('disconnect', () => {
                this.handleDisconnect(socket);
            });
        });
    }

    joinProjectRoom(socket, projectId) {
        const roomName = `project:${projectId}`;
        socket.join(roomName);

        // Track user's rooms
        if (!this.userRooms.has(socket.userId)) {
            this.userRooms.set(socket.userId, new Set());
        }
        this.userRooms.get(socket.userId).add(roomName);

        logger.info(`User ${socket.userId} joined project room: ${roomName}`);
    }

    leaveProjectRoom(socket, projectId) {
        const roomName = `project:${projectId}`;
        socket.leave(roomName);

        // Remove from tracking
        if (this.userRooms.has(socket.userId)) {
            this.userRooms.get(socket.userId).delete(roomName);
        }

        logger.info(`User ${socket.userId} left project room: ${roomName}`);
    }

    handleTypingStart(socket, data) {
        const { projectId } = data;
        socket.to(`project:${projectId}`).emit('user-typing-start', {
            userId: socket.userId,
            userName: socket.userName
        });
    }

    handleTypingStop(socket, data) {
        const { projectId } = data;
        socket.to(`project:${projectId}`).emit('user-typing-stop', {
            userId: socket.userId
        });
    }

    async handleSendMessage(socket, data) {
        try {
            const { projectId, content, files } = data;

            // Import message service dynamically to avoid circular dependency
            const messageService = await import('../services/message.service.js');

            // Create mock request object for message service
            const mockReq = {
                body: { project: projectId, content, files },
                user: {
                    id: socket.userId,
                    constructor: { modelName: socket.userModel }
                }
            };

            // Create message without transaction for socket-only approach
            const result = await messageService.createMessageSocket(mockReq);

            if (result.success) {
                // Emit to project room including sender
                this.io.to(`project:${projectId}`).emit('message-created', {
                    message: result.data,
                    timestamp: new Date()
                });
            } else {
                // Send error to sender
                socket.emit('message-error', {
                    error: result.error,
                    timestamp: new Date()
                });
            }
        } catch (error) {
            logger.error('Socket send message error:', error);
            socket.emit('message-error', {
                error: 'Failed to send message',
                timestamp: new Date()
            });
        }
    }

    async handleLoadMessages(socket, data) {
        try {
            const { projectId, page = 1, limit = 50 } = data;

            // Import message service dynamically
            const messageService = await import('../services/message.service.js');

            const result = await messageService.getProjectMessages(projectId, { page, limit, sortBy: 'createdAt:asc' });

            socket.emit('messages-loaded', {
                projectId,
                messages: result.results,
                pagination: {
                    page: result.page,
                    totalPages: result.totalPages,
                    totalResults: result.totalResults
                },
                timestamp: new Date()
            });
        } catch (error) {
            logger.error('Socket load messages error:', error);
            socket.emit('messages-error', {
                error: 'Failed to load messages',
                timestamp: new Date()
            });
        }
    }

    async handleMessageRead(socket, data) {
        try {
            const { messageId } = data;

            // Emit read receipt to project room
            const userRooms = this.userRooms.get(socket.userId);
            if (userRooms) {
                userRooms.forEach(roomName => {
                    if (roomName.startsWith('project:')) {
                        socket.to(roomName).emit('message-read-receipt', {
                            messageId,
                            userId: socket.userId,
                            timestamp: new Date()
                        });
                    }
                });
            }
        } catch (error) {
            logger.error('Socket message read error:', error);
        }
    }

    handleDisconnect(socket) {
        logger.info(`User disconnected: ${socket.userId}`);

        // Clean up user tracking
        this.connectedUsers.delete(socket.userId);
        this.userRooms.delete(socket.userId);
    }

    // Public methods for emitting events
    emitToUser(userId, event, data) {
        const socketId = this.connectedUsers.get(userId);
        if (socketId) {
            this.io.to(socketId).emit(event, data);
        }
    }

    emitToProject(projectId, event, data) {
        this.io.to(`project:${projectId}`).emit(event, data);
    }

    emitToAll(event, data) {
        this.io.emit(event, data);
    }

    // Get connected users count
    getConnectedUsersCount() {
        return this.connectedUsers.size;
    }

    // Check if user is online
    isUserOnline(userId) {
        return this.connectedUsers.has(userId);
    }
}

export default new SocketManager(); 