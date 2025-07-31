import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync.js';
import pick from '../utils/pick.js';
import * as projectAssignmentPaymentService from '../services/projectAssignmentPayment.service.js';
import User from '../models/user.model.js';

/**
 * Debug endpoint to check users by role
 */
export const debugUsersByRole = catchAsync(async (req, res) => {
    const { role } = req.query;
    const users = await User.find({ role }).select('name email role');
    res.status(httpStatus.OK).send({
        status: 1,
        message: `Users with role ${role}`,
        data: {
            role,
            count: users.length,
            users
        }
    });
});

/**
 * Debug endpoint to check all project assignment payments
 */
export const debugAllPayments = catchAsync(async (req, res) => {
    const ProjectAssignmentPayment = (await import('../models/projectAssignmentPaymant.model.js')).default;
    const payments = await ProjectAssignmentPayment.find({})
        .populate('project', 'projectName projectCode')
        .populate('user', 'name email role')
        .populate('createdBy', 'name email role')
        .lean();

    res.status(httpStatus.OK).send({
        status: 1,
        message: 'All project assignment payments',
        data: {
            count: payments.length,
            payments
        }
    });
});

/**
 * Debug endpoint to check all site visits
 */
export const debugAllSiteVisits = catchAsync(async (req, res) => {
    const SiteVisit = (await import('../models/siteVisit.model.js')).default;
    const visits = await SiteVisit.find({})
        .populate('siteEngineer', 'name email role')
        .populate('project', 'projectName projectCode')
        .lean();

    res.status(httpStatus.OK).send({
        status: 1,
        message: 'All site visits',
        data: {
            count: visits.length,
            visits
        }
    });
});

/**
 * Get project assignment payments
 */
export const getProjectAssignmentPayments = catchAsync(async (req, res) => {
    const filter = pick(req.query, ['projectName', 'userName', 'userRole', 'createdBy', 'createdByModel']);
    const options = pick(req.query, ['sortBy', 'limit', 'page']);
    const result = await projectAssignmentPaymentService.queryProjectAssignmentPayments(filter, options);
    res.status(httpStatus.OK).send({
        status: 1,
        message: 'Project assignment payments fetched successfully.',
        data: result
    });
});

/**
 * Get project assignment payment by id
 */
export const getProjectAssignmentPayment = catchAsync(async (req, res) => {
    const payment = await projectAssignmentPaymentService.getProjectAssignmentPaymentById(req.params.paymentId);
    res.status(httpStatus.OK).send({
        status: 1,
        message: 'Project assignment payment fetched successfully.',
        data: payment
    });
});

/**
 * Create project assignment payment
 */
export const createProjectAssignmentPayment = catchAsync(async (req, res) => {
    const payment = await projectAssignmentPaymentService.createProjectAssignmentPayment(req.body);
    res.status(httpStatus.CREATED).send({
        status: 1,
        message: 'Project assignment payment created successfully.',
        data: payment
    });
});

/**
 * Update project assignment payment by id
 */
export const updateProjectAssignmentPayment = catchAsync(async (req, res) => {
    const payment = await projectAssignmentPaymentService.updateProjectAssignmentPaymentById(req.params.paymentId, req.body);
    res.status(httpStatus.OK).send({
        status: 1,
        message: 'Project assignment payment updated successfully.',
        data: payment
    });
});

/**
 * Delete project assignment payment by id
 */
export const deleteProjectAssignmentPayment = catchAsync(async (req, res) => {
    await projectAssignmentPaymentService.deleteProjectAssignmentPaymentById(req.params.paymentId);
    res.status(httpStatus.NO_CONTENT).send({
        status: 1,
        message: 'Project assignment payment deleted successfully.'
    });
});

/**
 * Test endpoint to create a sample payment
 */
export const createTestPayment = catchAsync(async (req, res) => {
    const ProjectAssignmentPayment = (await import('../models/projectAssignmentPaymant.model.js')).default;
    const User = (await import('../models/user.model.js')).default;
    const Project = (await import('../models/project.model.js')).default;

    // Get first user with architect role
    const architect = await User.findOne({ role: 'architect' });
    if (!architect) {
        return res.status(404).send({
            status: 0,
            message: 'No architect found in database'
        });
    }

    // Get first project
    const project = await Project.findOne({});
    if (!project) {
        return res.status(404).send({
            status: 0,
            message: 'No project found in database'
        });
    }

    // Create test payment
    const payment = await ProjectAssignmentPayment.create({
        project: project._id,
        user: architect._id,
        assignedAmount: 5000,
        note: "Test payment for architect",
        createdBy: architect._id,
        createdByModel: 'User'
    });

    res.status(201).send({
        status: 1,
        message: 'Test payment created successfully',
        data: payment
    });
}); 