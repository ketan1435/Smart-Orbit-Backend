import express from 'express';
import auth from '../../middlewares/auth.js';
import validate from '../../middlewares/validate.js';
import * as projectValidation from '../../validations/project.validation.js';
import * as projectController from '../../controllers/project.controller.js';
// const projectValidation = require('../../validations/project.validation');
// const projectController = require('../../controllers/project.controller');

const router = express.Router();

router
    .route('/')
    .get(auth('getProjects'), validate(projectValidation.getProjects), projectController.getProjects);

// Define project routes here later
// For example:
// router
//   .route('/')
//   .get(auth('getProjects'), validate(projectValidation.getProjects), projectController.getProjects)
//   .post(auth('manageProjects'), validate(projectValidation.createProject), projectController.createProject);

export default router; 