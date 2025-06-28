import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync.js';
import * as projectService from '../services/project.service.js';
import pick from '../utils/pick.js';

// Controller methods for Project will be added here.
// For example:
// const getProjects = catchAsync(async (req, res) => {
//   const filter = pick(req.query, ['name', 'status']);
//   const options = pick(req.query, ['sortBy', 'limit', 'page']);
//   const result = await projectService.queryProjects(filter, options);
//   res.send(result);
// });

export const getProjects = catchAsync(async (req, res) => {
    const filter = pick(req.query, ['projectName', 'status', 'projectCode', 'customerName', 'requirementType']);
    const options = pick(req.query, ['sortBy', 'limit', 'page']);
    const result = await projectService.queryProjects(filter, options);
    res.status(httpStatus.OK).send({ status: 1, message: 'Projects fetched successfully.', data: result });
});
