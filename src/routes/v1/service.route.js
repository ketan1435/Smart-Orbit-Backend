import express from 'express';
import auth from '../../middlewares/auth.js';
import validate from '../../middlewares/validate.js';
import * as serviceValidation from '../../validations/service.validation.js';
import * as serviceController from '../../controllers/service.controller.js';

const router = express.Router();

// All routes require authentication
router.use(auth());

// Service CRUD routes
router
  .route('/')
  .get(validate(serviceValidation.getServices), serviceController.getServices)
  .post(validate(serviceValidation.createService), serviceController.createService);

router
  .route('/:id')
  .get(validate(serviceValidation.getServiceById), serviceController.getServiceById)
  .put(validate(serviceValidation.updateService), serviceController.updateService)
  .delete(validate(serviceValidation.deleteService), serviceController.deleteService);

// Service attachment routes
router
  .route('/:serviceId/attachments')
  .post(validate(serviceValidation.addServiceAttachment), serviceController.addServiceAttachment);

router
  .route('/:serviceId/attachments/:attachmentId')
  .delete(validate(serviceValidation.removeServiceAttachment), serviceController.removeServiceAttachment);

export default router;
