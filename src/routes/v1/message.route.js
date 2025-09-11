import express from 'express';
import auth from '../../middlewares/auth.js';
import validate from '../../middlewares/validate.js';
import { transactional } from '../../utils/transactional.js';
import * as messageValidation from '../../validations/message.validation.js';
import * as messageController from '../../controllers/message.controller.js';
import * as messageService from '../../services/message.service.js';

const router = express.Router();

router
    .route('/')
    .get(auth(), validate(messageValidation.getMessages), messageController.getMessages)
    .post(auth(), validate(messageValidation.createMessage), transactional(messageService.createMessage));

router
    .route('/unread-count')
    .get(auth(), messageController.getUnreadMessageCount);

router
    .route('/unread-counts-by-project')
    .get(auth(), messageController.getUnreadMessageCountsByProject);

router
    .route('/project/:projectId/taggable-users')
    .get(auth(), messageController.getTaggableUsers);

router
    .route('/project/:projectId')
    .get(auth(), validate(messageValidation.getProjectMessages), messageController.getProjectMessages);

router
    .route('/mark-read')
    
    .patch(auth(), messageController.markMessagesAsRead);

router
    .route('/:messageId/read')
    .patch(auth(), messageController.markMessageAsRead);

router
    .route('/:messageId')
    .get(auth(), validate(messageValidation.getMessage), messageController.getMessage)
    .delete(auth(), validate(messageValidation.deleteMessage), messageController.deleteMessage);



export default router; 