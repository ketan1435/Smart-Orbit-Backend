import ProjectWaterfall from '../models/projectWaterfall.model.js';
import Project from '../models/project.model.js';
import ApiError from '../utils/ApiError.js';
import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync.js';
import { createActivityLog } from '../services/activityLog.service.js';

// Send SCP data to customer for confirmation
export const sendScpDataToCustomer = catchAsync(async (req, res) => {
    console.log('=== SEND SCP DATA TO CUSTOMER API CALLED ===');
    console.log('Request params:', req.params);
    console.log('Request body:', req.body);
    console.log('Request user:', req.user);

    const { projectId } = req.params;
    const { remarks } = req.body;

    const userId = req.user.id;
    const userName = req.user.name || req.user.email || 'SCP User';
    const userEmail = req.user.email;
    const userRole = req.user.role;
    const userModel = userRole === 'scp-user' ? 'SCP' : 'User';

    console.log('User data extracted:', {
        userId,
        userName,
        userEmail,
        userRole,
        userModel
    });

    // Find the project
    const project = await Project.findById(projectId);
    if (!project) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
    }

    // Find or create project waterfall
    let projectWaterfall = await ProjectWaterfall.findOne({ projectId });
    if (!projectWaterfall) {
        console.log('Creating new waterfall for project:', projectId);
        projectWaterfall = new ProjectWaterfall({
            projectId,
            projectName: project.projectName,
            currentStepNumber: 4.5,
        });
        await projectWaterfall.save();
        console.log('Waterfall created with steps:', projectWaterfall.steps.length);
    } else {
        console.log('Existing waterfall found:', projectWaterfall._id);
    }

    // Initialize steps if missing
    if (!projectWaterfall.steps || projectWaterfall.steps.length === 0) {
        console.log('Initializing steps manually for waterfall');
        projectWaterfall.steps = ProjectWaterfall.initializeSteps();
        await projectWaterfall.save();
    }

    console.log('Waterfall info:', {
        projectId,
        currentStepNumber: projectWaterfall.currentStepNumber,
        totalSteps: projectWaterfall.steps.length,
        step4_5Exists: !!projectWaterfall.steps.find(step => step.stepNo === 4.5)
    });

    // Check if project is ready for sending to customer (should be at step 4 or 4.5)
    if (projectWaterfall.currentStepNumber < 4) {
        throw new ApiError(httpStatus.BAD_REQUEST, `Project is not ready to send to customer. Current step: ${projectWaterfall.currentStepNumber}. Must be at step 4 or later.`);
    }

    // Check if step 4.5 has already been completed
    let step4_5 = projectWaterfall.steps.find(step => step.stepNo === 4.5);
    
    // If step 4.5 doesn't exist, add it to the waterfall
    if (!step4_5) {
        console.log('Step 4.5 not found, adding it to waterfall');
        step4_5 = {
            stepNo: 4.5,
            stepName: 'SCP Data Sent to Customer',
            performedBy: 'SCP',
            nextStep: 'Admin Review',
            remarks: 'SCP data sent to customer for confirmation',
            status: 'pending',
            history: []
        };
        projectWaterfall.steps.push(step4_5);
        // Sort steps by stepNo to maintain order
        projectWaterfall.steps.sort((a, b) => a.stepNo - b.stepNo);
    }
    
    if (step4_5 && (step4_5.status === 'completed' || step4_5.status === 'skipped')) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'SCP data has already been sent to customer for this project.');
    }

    console.log('Step 4.5 before update:', {
        stepNo: step4_5.stepNo,
        stepName: step4_5.stepName,
        performedBy: step4_5.performedBy,
        nextStep: step4_5.nextStep,
        remarks: step4_5.remarks,
        status: step4_5.status
    });

    // Update step 4.5
    step4_5.status = 'completed';
    step4_5.completedAt = new Date();
    step4_5.completedBy = userName;
    step4_5.performedBy = userName || userEmail || 'SCP User';
    step4_5.remarks = remarks || `SCP data sent to customer by ${userName || userEmail || 'SCP User'}`;

    // Add to history
    step4_5.history.push({
        timestamp: new Date(),
        performedBy: userName || userEmail || 'SCP User',
        action: 'completed',
        remarks: remarks || `SCP data sent to customer by ${userName || userEmail || 'SCP User'}`
    });

    console.log('Step 4.5 after update:', {
        stepNo: step4_5.stepNo,
        stepName: step4_5.stepName,
        performedBy: step4_5.performedBy,
        status: step4_5.status,
        remarks: step4_5.remarks,
        historyCount: step4_5.history.length
    });

    // Move to next step (step 5 - Admin Review)
    projectWaterfall.currentStepNumber = 5;
    const step5 = projectWaterfall.steps.find(step => step.stepNo === 5);
    if (step5) {
        step5.status = 'active';
    }

    try {
        await projectWaterfall.save();
        console.log('Waterfall saved successfully');
        console.log('Final waterfall state:', {
            currentStepNumber: projectWaterfall.currentStepNumber,
            step4_5Status: projectWaterfall.steps.find(s => s.stepNo === 4.5)?.status,
            step5Status: projectWaterfall.steps.find(s => s.stepNo === 5)?.status
        });
    } catch (saveError) {
        console.error('Error saving waterfall:', saveError);
        throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, `Failed to save waterfall: ${saveError.message}`);
    }

    // Create activity log
    try {
        await createActivityLog({
            user: userId,
            userModel: userModel,
            userName: userName,
            userEmail: userEmail,
            targetModel: 'Project',
            targetId: projectId,
            targetName: project.projectName,
            action: 'send',
            actionType: 'Workflow',
            description: `SCP data sent to customer by ${userName}`,
            changes: {
                waterfallStep: projectWaterfall.currentStepNumber,
                stepCompleted: 4.5
            },
            metadata: {
                remarks: remarks,
                stepNumber: 4.5,
                waterfallUpdated: true
            }
        });
    } catch (logError) {
        console.error('Error creating activity log:', logError);
    }

    res.status(httpStatus.OK).json({
        success: true,
        message: 'SCP data sent to customer successfully',
        data: { 
            project, 
            projectWaterfall,
            currentStep: projectWaterfall.currentStepNumber,
            nextStep: 'Admin Review'
        }
    });
});

// Get SCP data send status
export const getScpDataSendStatus = catchAsync(async (req, res) => {
    const { projectId } = req.params;

    const projectWaterfall = await ProjectWaterfall.findOne({ projectId });
    if (!projectWaterfall) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Project waterfall not found');
    }

    const step4_5 = projectWaterfall.steps.find(step => step.stepNo === 4.5);
    const hasSent = step4_5 && step4_5.status !== 'pending';
    const canSend = projectWaterfall.currentStepNumber >= 4 && (!hasSent || step4_5.status === 'skipped');

    res.status(httpStatus.OK).json({
        success: true,
        data: {
            hasSent,
            canSend,
            currentStep: projectWaterfall.currentStepNumber,
            step4_5Status: step4_5?.status,
            performedBy: step4_5?.performedBy,
            completedAt: step4_5?.completedAt
        }
    });
});

// Get SCP data send history
export const getScpDataSendHistory = catchAsync(async (req, res) => {
    const { projectId } = req.params;

    const projectWaterfall = await ProjectWaterfall.findOne({ projectId });
    if (!projectWaterfall) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Project waterfall not found');
    }

    const step4_5 = projectWaterfall.steps.find(step => step.stepNo === 4.5);
    const sendHistory = step4_5 ? step4_5.history : [];

    res.status(httpStatus.OK).json({
        success: true,
        data: {
            step4_5,
            sendHistory,
            currentStep: projectWaterfall.currentStepNumber
        }
    });
});
