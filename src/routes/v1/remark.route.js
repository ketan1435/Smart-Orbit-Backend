import express from 'express';
import auth from '../../middlewares/auth.js';
import validate from '../../middlewares/validate.js';
import { remarkValidation } from '../../validations/index.js';
import { remarkController } from '../../controllers/index.js';

const router = express.Router();

router
    .route('/')
    .post(
        auth(),
        validate(remarkValidation.createRemark),
        remarkController.createRemark
    );

router
    .route('/project/:projectId')
    .get(
        auth(),
        validate(remarkValidation.getRemarks),
        remarkController.getRemarks
    );

router
    .route('/:remarkId')
    .get(
        auth(),
        remarkController.getRemark
    )
    .put(
        auth(),
        validate(remarkValidation.updateRemark),
        remarkController.updateRemark
    )
    .delete(
        auth(),
        remarkController.deleteRemark
    );

export default router;