import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync.js';
import pick from '../utils/pick.js';
import * as messageService from '../services/message.service.js';

/**
 * Get messages
 */
export const getMessages = catchAsync(async (req, res) => {
    const filter = pick(req.query, ['project', 'sender', 'senderModel', 'isRead', 'startDate', 'endDate']);
    const options = pick(req.query, ['sortBy', 'limit', 'page']);
    const result = await messageService.queryMessages(filter, options);
    res.status(httpStatus.OK).send({
        status: 1,
        message: 'Messages fetched successfully.',
        data: result
    });
});

/**
 * Get message by id
 */
export const getMessage = catchAsync(async (req, res) => {
    const message = await messageService.getMessageById(req.params.messageId);
    res.status(httpStatus.OK).send({
        status: 1,
        message: 'Message fetched successfully.',
        data: message
    });
});

/**
 * Create message
 */
export const createMessage = catchAsync(async (req, res) => {
    const message = await messageService.createMessage(req.body, req);
    res.status(httpStatus.CREATED).send({
        status: 1,
        message: 'Message created successfully.',
        data: message
    });
});

/**
 * Delete message by id
 */
export const deleteMessage = catchAsync(async (req, res) => {
    await messageService.deleteMessageById(req.params.messageId, req);
    res.status(httpStatus.NO_CONTENT).send({
        status: 1,
        message: 'Message deleted successfully.'
    });
});

/**
 * Get messages for a specific project
 */
export const getProjectMessages = catchAsync(async (req, res) => {
    const options = pick(req.query, ['sortBy', 'limit', 'page']);
    const result = await messageService.getProjectMessages(req.params.projectId, options);
    res.status(httpStatus.OK).send({
        status: 1,
        message: 'Project messages fetched successfully.',
        data: result
    });
});

/**
 * Mark message as read
 */
export const markMessageAsRead = catchAsync(async (req, res) => {
    const message = await messageService.markMessageAsRead(req.params.messageId, req.user.id);
    res.status(httpStatus.OK).send({
        status: 1,
        message: 'Message marked as read successfully.',
        data: message
    });
});

/**
 * Mark multiple messages as read
 */
export const markMessagesAsRead = catchAsync(async (req, res) => {
    const { messageIds } = req.body;

    if (!messageIds || !Array.isArray(messageIds)) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Message IDs array is required');
    }

    const result = await messageService.markMessagesAsRead(messageIds, req.user.id);
    res.status(httpStatus.OK).send({
        status: 1,
        message: 'Messages marked as read successfully.',
        data: result
    });
});

/**
 * Get unread message count
 */
export const getUnreadMessageCount = catchAsync(async (req, res) => {
    const { projectId } = req.query;
    const result = await messageService.getUnreadMessageCount(req.user.id, projectId);
    res.status(httpStatus.OK).send({
        status: 1,
        message: 'Unread message count fetched successfully.',
        data: result
    });
});

/**
 * Get unread message counts by project
 */
export const getUnreadMessageCountsByProject = catchAsync(async (req, res) => {
    const result = await messageService.getUnreadMessageCountsByProject(req.user.id);
    res.status(httpStatus.OK).send({
        status: 1,
        message: 'Unread message counts by project fetched successfully.',
        data: result
    });
});

/**
 * Get taggable users for a project
 */
export const getTaggableUsers = catchAsync(async (req, res) => {
    console.log('getTaggableUsers called with projectId:', req.params.projectId);
    console.log('getTaggableUsers called with userId:', req.user.id);

    const result = await messageService.getTaggableUsers(req.params.projectId, req.user.id);

    console.log('getTaggableUsers result:', result);

    res.status(httpStatus.OK).send({
        status: 1,
        message: 'Taggable users fetched successfully.',
        data: result
    });
}); 