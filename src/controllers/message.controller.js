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