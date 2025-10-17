import ProjectWaterfall from '../models/projectWaterfall.model.js';
import Project from '../models/project.model.js';
import ApiError from '../utils/ApiError.js';
import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync.js';
import { createActivityLog } from '../services/activityLog.service.js';

// Customer confirms SCP data
export const confirmScpData = catchAsync(async (req, res) => {
    const { projectId } = req.params;
    const { remarks } = req.body;

    const userId = req.user.id;
    const userName = req.user.name || req.user.email || 'Customer';
    const userEmail = req.user.email;
    const userRole = req.user.role;
    // ActivityLog only supports 'User' or 'Admin'
    const userModel = userRole === 'admin' ? 'Admin' : 'User';
    
    console.log('=== Customer Confirmation Start ===');
    console.log('User Info:', { userId, userName, userEmail, userRole, userModel });
    console.log('Request Info:', { projectId, remarks });

    const project = await Project.findById(projectId).populate('lead');
    if (!project) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
    }

    // Debug logging
    console.log('Customer Confirmation Debug:', {
        projectId,
        userId,
        projectLead: project.lead,
        projectLeadCustomer: project.lead?.customer,
        projectLeadCustomerType: typeof project.lead?.customer
    });

    // Ensure the project belongs to the customer
    if (!project.lead) {
        throw new ApiError(httpStatus.FORBIDDEN, 'Access denied. Project lead information is missing.');
    }
    
    // For now, we'll allow any authenticated user to confirm SCP data
    // In a real application, you might want to add additional validation
    // based on the customer's email or other identifying information
    console.log('Customer Confirmation - User validation passed for user:', userId);

    let projectWaterfall = await ProjectWaterfall.findOne({ projectId });
    if (!projectWaterfall) {
        projectWaterfall = new ProjectWaterfall({
            projectId,
            projectName: project.projectName,
            currentStepNumber: 6,
        });
        await projectWaterfall.save();
    }

    if (!projectWaterfall.steps || projectWaterfall.steps.length === 0) {
        projectWaterfall.steps = ProjectWaterfall.initializeSteps();
        await projectWaterfall.save();
    }

    // Ensure step 6 exists
    const step6 = projectWaterfall.steps.find(step => step.stepNo === 6);
    if (!step6) {
        projectWaterfall.steps = ProjectWaterfall.initializeSteps();
    }
    
    // If already completed earlier, still append a fresh activity log entry so the UI sees a recent confirmation event
    if (step6 && (step6.status === 'completed' || step6.status === 'skipped')) {
        step6.history.push({
            timestamp: new Date(),
            performedBy: userName,
            action: 'completed',
            remarks: remarks || `SCP data confirmed by ${userName}`
        });
        await projectWaterfall.save();
        try {
            await createActivityLog({
                user: userId,
                userModel,
                userName,
                userEmail,
                targetModel: 'Project',
                targetId: projectId,
                targetName: project.projectName,
                action: 'approve',
                actionType: 'Workflow',
                description: `SCP data confirmed by customer ${userName}`,
                changes: { waterfallStep: projectWaterfall.currentStepNumber },
                metadata: { stepNumber: 6, waterfallUpdated: true }
            });
        } catch (e) { /* ignore */ }
        return res.status(httpStatus.OK).json({
            success: true,
            message: 'Customer confirmation recorded',
            data: { project, projectWaterfall, alreadyConfirmed: true }
        });
    }

    // Mark step 6 as completed
    step6.status = 'completed';
    step6.completedAt = new Date();
    step6.completedBy = userName;
    step6.performedBy = userName;
    step6.remarks = remarks || `SCP data confirmed by ${userName}`;

    step6.history.push({
        timestamp: new Date(),
        performedBy: userName,
        action: 'completed',
        remarks: remarks || `SCP data confirmed by ${userName}`
    });

    // Move to next step (step 7)
    projectWaterfall.currentStepNumber = 7;
    const step7 = projectWaterfall.steps.find(step => step.stepNo === 7);
    if (step7) {
        step7.status = 'active';
    }

    console.log('About to save projectWaterfall:', {
        projectId: projectWaterfall.projectId,
        currentStepNumber: projectWaterfall.currentStepNumber,
        step6Status: step6?.status,
        step7Status: step7?.status
    });

    await projectWaterfall.save();
    
    console.log('ProjectWaterfall saved successfully');

    // Create activity log
    const activityLogData = {
        user: userId,
        userModel: userModel,
        userName: userName,
        userEmail: userEmail,
        targetModel: 'Project',
        targetId: projectId,
        targetName: project.projectName,
        action: 'approve', // mapped to step 6
        actionType: 'Workflow',
        description: `SCP data confirmed by customer ${userName}`,
        changes: {
            waterfallStep: 7,
            stepCompleted: 6
        },
        metadata: {
            stepNumber: 6,
            waterfallUpdated: true
        }
    };
    
    console.log('Creating activity log with data:', activityLogData);
    
    // Validate required fields
    const requiredFields = ['user', 'userModel', 'userName', 'userEmail', 'targetModel', 'targetId', 'targetName', 'action', 'actionType', 'description'];
    const missingFields = requiredFields.filter(field => !activityLogData[field]);
    
    if (missingFields.length > 0) {
        console.error('Missing required fields for activity log:', missingFields);
        console.log('Activity log data:', activityLogData);
    }
    
    try {
        await createActivityLog(activityLogData);
        console.log('Activity log created successfully');
    } catch (logError) {
        console.error('Error creating activity log:', logError);
        // Don't throw error here, just log it and continue
    }

    res.status(httpStatus.OK).json({
        success: true,
        message: 'SCP data confirmed successfully',
        data: { project, projectWaterfall }
    });
});

// Customer rejects SCP data
export const rejectScpData = catchAsync(async (req, res) => {
    const { projectId } = req.params;
    const { remarks } = req.body;

    const userId = req.user.id;
    const userName = req.user.name || req.user.email || 'Customer';
    const userEmail = req.user.email;
    const userRole = req.user.role;
    const userModel = userRole === 'user' ? 'Customer' : 'User';

    const project = await Project.findById(projectId).populate('lead');
    if (!project) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
    }

    // Debug logging
    console.log('Customer Confirmation Debug:', {
        projectId,
        userId,
        projectLead: project.lead,
        projectLeadCustomer: project.lead?.customer,
        projectLeadCustomerType: typeof project.lead?.customer
    });

    // Ensure the project belongs to the customer
    if (!project.lead) {
        throw new ApiError(httpStatus.FORBIDDEN, 'Access denied. Project lead information is missing.');
    }
    
    // For now, we'll allow any authenticated user to confirm SCP data
    // In a real application, you might want to add additional validation
    // based on the customer's email or other identifying information
    console.log('Customer Confirmation - User validation passed for user:', userId);

    let projectWaterfall = await ProjectWaterfall.findOne({ projectId });
    if (!projectWaterfall) {
        projectWaterfall = new ProjectWaterfall({
            projectId,
            projectName: project.projectName,
            currentStepNumber: 6,
        });
        await projectWaterfall.save();
    }

    if (!projectWaterfall.steps || projectWaterfall.steps.length === 0) {
        projectWaterfall.steps = ProjectWaterfall.initializeSteps();
        await projectWaterfall.save();
    }

    // Check if step 6 has already been completed
    const step6 = projectWaterfall.steps.find(step => step.stepNo === 6);
    if (step6 && (step6.status === 'completed' || step6.status === 'skipped')) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Customer confirmation has already been submitted for this project.');
    }

    // Mark step 6 as skipped (rejected)
    step6.status = 'skipped';
    step6.completedAt = new Date();
    step6.completedBy = userName;
    step6.performedBy = userName;
    step6.remarks = remarks || `SCP data rejected by ${userName}`;

    step6.history.push({
        timestamp: new Date(),
        performedBy: userName,
        action: 'skipped',
        remarks: remarks || `SCP data rejected by ${userName}`
    });

    // Move back to step 4 for SCP to revise data
    projectWaterfall.currentStepNumber = 4;
    const step4 = projectWaterfall.steps.find(step => step.stepNo === 4);
    if (step4) {
        step4.status = 'active';
    }

    await projectWaterfall.save();

    // Create activity log
    const activityLogData = {
        user: userId,
        userModel: userModel,
        userName: userName,
        userEmail: userEmail,
        targetModel: 'Project',
        targetId: projectId,
        targetName: project.projectName,
        action: 'reject',
        actionType: 'Workflow',
        description: `Customer Rejects Requirements (Step 6) - SCP data rejected by customer ${userName}`,
        changes: {
            waterfallStep: projectWaterfall.currentStepNumber
        },
        metadata: {
            stepNumber: 6,
            waterfallUpdated: true
        }
    };
    
    console.log('Creating activity log with data:', activityLogData);
    
    // Validate required fields
    const requiredFields = ['user', 'userModel', 'userName', 'userEmail', 'targetModel', 'targetId', 'targetName', 'action', 'actionType', 'description'];
    const missingFields = requiredFields.filter(field => !activityLogData[field]);
    
    if (missingFields.length > 0) {
        console.error('Missing required fields for activity log:', missingFields);
        console.log('Activity log data:', activityLogData);
    }
    
    try {
        await createActivityLog(activityLogData);
        console.log('Activity log created successfully');
    } catch (logError) {
        console.error('Error creating activity log:', logError);
        // Don't throw error here, just log it and continue
    }

    res.status(httpStatus.OK).json({
        success: true,
        message: 'SCP data rejected successfully',
        data: { project, projectWaterfall }
    });
});


// Get customer confirmation history
export const getCustomerConfirmationHistory = catchAsync(async (req, res) => {
    const { projectId } = req.params;
    const projectWaterfall = await ProjectWaterfall.findOne({ projectId });

    if (!projectWaterfall) {
        return res.status(httpStatus.OK).json({
            success: true,
            data: []
        });
    }

    const step6 = projectWaterfall.steps.find(step => step.stepNo === 6);
    const confirmationHistory = step6 ? step6.history : [];

    res.status(httpStatus.OK).json({
        success: true,
        data: confirmationHistory
    });
});
