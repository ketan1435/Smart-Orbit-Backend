import Project from '../models/project.model.js';
import ProjectWaterfall from '../models/projectWaterfall.model.js';
import ApiError from '../utils/ApiError.js';
import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync.js';
import { createActivityLog } from '../services/activityLog.service.js';

// Submit project review
export const submitProjectReview = catchAsync(async (req, res) => {
    console.log('=== PROJECT REVIEW API CALLED ===');
    console.log('Request params:', req.params);
    console.log('Request body:', req.body);
    console.log('Request user:', req.user);

    const { projectId } = req.params;
    const { status, remarks } = req.body; // status: 'approved' or 'rejected'

    // Validate status
    if (!status || !['approved', 'rejected'].includes(status)) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Status must be either "approved" or "rejected"');
    }

    const userId = req.user.id;
    const userName = req.user.name || req.user.email || 'Admin';
    const userEmail = req.user.email;
    const userRole = req.user.role;

    // Determine user model based on role
    const userModel = userRole === 'admin' ? 'Admin' : 'User';

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
        // Create waterfall if it doesn't exist
        projectWaterfall = new ProjectWaterfall({
            projectId,
            projectName: project.projectName,
            currentStepNumber: 5, // Admin Review step
        });
        await projectWaterfall.save();
        console.log('Waterfall created with steps:', projectWaterfall.steps.length);
        console.log('New waterfall created with ID:', projectWaterfall._id);
    } else {
        console.log('Existing waterfall found:', projectWaterfall._id);
    }

    // Ensure waterfall has steps (should be initialized by pre-save hook)
    if (!projectWaterfall.steps || projectWaterfall.steps.length === 0) {
        console.log('Initializing steps manually for waterfall');
        // Manually initialize steps if not done by pre-save hook
        projectWaterfall.steps = ProjectWaterfall.initializeSteps();
        await projectWaterfall.save();
        console.log('Steps initialized:', projectWaterfall.steps.length);
    }

    // Debug: Log waterfall info
    console.log('Waterfall info:', {
        projectId,
        currentStepNumber: projectWaterfall.currentStepNumber,
        totalSteps: projectWaterfall.steps.length,
        step5Exists: !!projectWaterfall.steps.find(step => step.stepNo === 5)
    });

    // Check if project is ready for admin review (should be at step 5)
    // EDGE CASE: If waterfall exists but is at step < 5, check if prerequisites are met
    if (projectWaterfall.currentStepNumber < 5) {
        const step4 = projectWaterfall.steps.find(step => step.stepNo === 4);
        const step4_5 = projectWaterfall.steps.find(step => step.stepNo === 4.5);

        // Debug logging
        console.log('Admin review prerequisite check:', {
            currentStepNumber: projectWaterfall.currentStepNumber,
            currentStepNumberType: typeof projectWaterfall.currentStepNumber,
            currentStepNumberAsNumber: Number(projectWaterfall.currentStepNumber),
            step4Exists: !!step4,
            step4Status: step4?.status,
            step4_5Exists: !!step4_5,
            step4_5Status: step4_5?.status
        });

        // Check if SCP has completed step 4 (updated data) OR step 4.5 (sent to customer)
        // If currentStepNumber is 4.5 (using loose comparison to handle string/number), it means we've progressed past step 4
        const step4Completed = step4 && (step4.status === 'completed' || step4.status === 'active');
        const step4_5Completed = step4_5 && (step4_5.status === 'completed' || step4_5.status === 'active');
        // Use loose comparison and explicit number conversion for step 4.5
        const currentStep = Number(projectWaterfall.currentStepNumber);
        const atStep4_5 = Math.abs(currentStep - 4.5) < 0.01 || currentStep === 4.5 || projectWaterfall.currentStepNumber === 4.5 || projectWaterfall.currentStepNumber === '4.5';

        console.log('Prerequisite evaluation:', {
            step4Completed,
            step4_5Completed,
            atStep4_5,
            willAutoAdvance: step4Completed || step4_5Completed || atStep4_5
        });

        if (step4Completed || step4_5Completed || atStep4_5) {
            // If we're at step 4.5 but step 4 isn't marked completed, mark it now (safeguard)
            if (atStep4_5 && step4 && step4.status !== 'completed' && step4.status !== 'active') {
                console.log('Marking step 4 as completed (safeguard - waterfall is at 4.5)');
                step4.status = 'completed';
                step4.completedAt = new Date();
                step4.history.push({
                    timestamp: new Date(),
                    performedBy: 'System',
                    action: 'completed',
                    remarks: 'Marked as completed due to waterfall being at step 4.5'
                });
            }

            // Auto-advance to step 5 since prerequisites are met
            console.log('Auto-advancing waterfall from step', projectWaterfall.currentStepNumber, 'to step 5 (prerequisites met)');
            projectWaterfall.currentStepNumber = 5;
            const step5 = projectWaterfall.steps.find(step => step.stepNo === 5);
            if (step5 && step5.status === 'pending') {
                step5.status = 'active';
            }
            await projectWaterfall.save();
            console.log('Waterfall auto-advanced to step 5');
        } else {
            // Project is truly not ready - prerequisites not met
            throw new ApiError(httpStatus.BAD_REQUEST, `Project is not ready for admin review. Current step: ${projectWaterfall.currentStepNumber}. Must complete SCP data update (step 4) or SCP data send to customer (step 4.5) first.`);
        }
    }

    // Check if step 5 has already been completed (review already submitted)
    const step5 = projectWaterfall.steps.find(step => step.stepNo === 5);
    if (step5 && (step5.status === 'completed' || step5.status === 'skipped')) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Admin review has already been submitted for this project. Cannot change review status.');
    }

    // Update project status based on review
    const newProjectStatus = status === 'approved' ? 'inprogress' : 'inactive';
    project.status = newProjectStatus;
    await project.save();

    // Update waterfall step 5 (Admin Review)
    if (!step5) {
        console.error('Step 5 not found in waterfall steps. Available steps:',
            projectWaterfall.steps.map(s => ({ stepNo: s.stepNo, stepName: s.stepName }))
        );
        throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Step 5 (Admin Review) not found in waterfall. Please ensure waterfall is properly initialized.');
    }

    if (step5) {
        console.log('Step 5 before update:', {
            stepNo: step5.stepNo,
            stepName: step5.stepName,
            performedBy: step5.performedBy,
            nextStep: step5.nextStep,
            remarks: step5.remarks,
            status: step5.status,
            hasHistory: !!step5.history,
            historyLength: step5.history ? step5.history.length : 0
        });

        // Update step status and completion info
        const newStatus = status === 'approved' ? 'completed' : 'skipped';
        console.log('Updating step 5 status from', step5.status, 'to', newStatus);
        step5.status = newStatus;
        step5.completedAt = new Date();
        step5.completedBy = userName;

        // Update performedBy to the actual user who performed the action
        step5.performedBy = userName || userEmail || 'Admin';

        // Update remarks - ensure it's never empty since it's required
        step5.remarks = remarks || `Project ${status} by ${userName}`;

        // Add to history
        step5.history.push({
            timestamp: new Date(),
            performedBy: userName || userEmail || 'Admin',
            action: status === 'approved' ? 'completed' : 'skipped',
            remarks: remarks || `Project ${status} by ${userName || userEmail || 'Admin'}`
        });

        console.log('Step 5 after update:', {
            stepNo: step5.stepNo,
            stepName: step5.stepName,
            performedBy: step5.performedBy,
            status: step5.status,
            remarks: step5.remarks,
            historyCount: step5.history.length
        });

        console.log('Waterfall currentStepNumber before save:', projectWaterfall.currentStepNumber);
        console.log('Step 5 status after update:', step5.status);
    } else {
        console.error('Step 5 not found in waterfall steps');
        throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Step 5 (Admin Review) not found in waterfall');
    }

    // Validate required fields before saving
    console.log('Validating step 5 before save:', {
        stepNo: step5.stepNo,
        stepName: step5.stepName,
        performedBy: step5.performedBy,
        nextStep: step5.nextStep,
        remarks: step5.remarks,
        status: step5.status
    });

    // Ensure all required fields are set (don't throw error, just fix them)
    if (!step5.performedBy) {
        console.log('Setting missing performedBy field');
        step5.performedBy = userName || userEmail || 'Admin';
    }
    if (!step5.remarks) {
        console.log('Setting missing remarks field');
        step5.remarks = `Project ${status} by ${userName || userEmail || 'Admin'}`;
    }
    if (!step5.nextStep) {
        console.log('Setting missing nextStep field');
        step5.nextStep = 'Customer Confirmation';
    }

    console.log('Step 5 final validation:', {
        stepNo: step5.stepNo,
        stepName: step5.stepName,
        performedBy: step5.performedBy,
        nextStep: step5.nextStep,
        remarks: step5.remarks,
        status: step5.status
    });

    // If approved, move to next step (step 6 - Customer Confirmation)
    if (status === 'approved') {
        projectWaterfall.currentStepNumber = 6;
        const step6 = projectWaterfall.steps.find(step => step.stepNo === 6);
        if (step6) {
            step6.status = 'active';
        }
    } else if (status === 'rejected') {
        // For rejection, move to step 5.5 (Admin Rejection Feedback)
        projectWaterfall.currentStepNumber = 5.5;
        const step5_5 = projectWaterfall.steps.find(step => step.stepNo === 5.5);
        if (step5_5) {
            step5_5.status = 'active';
        }
    }

    try {
        await projectWaterfall.save();
        console.log('Waterfall saved successfully');
        console.log('Final waterfall state:', {
            currentStepNumber: projectWaterfall.currentStepNumber,
            step5Status: projectWaterfall.steps.find(s => s.stepNo === 5)?.status,
            step6Status: projectWaterfall.steps.find(s => s.stepNo === 6)?.status
        });

        // Verify the step was actually updated in the database
        const updatedWaterfall = await ProjectWaterfall.findById(projectWaterfall._id);
        console.log('Database verification - Step 5 status:', updatedWaterfall.steps.find(s => s.stepNo === 5)?.status);
    } catch (saveError) {
        console.error('Error saving waterfall:', saveError);
        console.error('Step 5 data at save time:', {
            stepNo: step5.stepNo,
            stepName: step5.stepName,
            performedBy: step5.performedBy,
            nextStep: step5.nextStep,
            remarks: step5.remarks,
            status: step5.status
        });
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
            action: status === 'approved' ? 'approve' : 'reject',
            actionType: 'Workflow',
            description: status === 'approved' ? `Project approved by ${userName}` : `Project rejected by ${userName}`,
            changes: {
                reviewStatus: status,
                projectStatus: newProjectStatus,
                waterfallStep: projectWaterfall.currentStepNumber
            },
            metadata: {
                reviewStatus: status,
                remarks: remarks,
                stepNumber: status === 'approved' ? 5 : 5.5,
                waterfallUpdated: true
            }
        });
    } catch (logError) {
        console.error('Error creating activity log:', logError);
        // Don't fail the entire operation if logging fails
    }

    res.status(httpStatus.OK).json({
        success: true,
        message: `Project ${status} successfully`,
        data: {
            projectId,
            status: newProjectStatus,
            reviewStatus: status,
            currentStep: projectWaterfall.currentStepNumber,
            stepDetails: step5
        }
    });
});

// Get project review history
export const getProjectReviewHistory = catchAsync(async (req, res) => {
    const { projectId } = req.params;

    const projectWaterfall = await ProjectWaterfall.findOne({ projectId });
    if (!projectWaterfall) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Project waterfall not found');
    }

    // Get step 5 (Admin Review) history
    const step5 = projectWaterfall.steps.find(step => step.stepNo === 5);
    const reviewHistory = step5 ? step5.history : [];

    res.status(httpStatus.OK).json({
        success: true,
        data: {
            projectId,
            reviewHistory,
            currentStatus: step5?.status || 'pending',
            performedBy: step5?.performedBy,
            remarks: step5?.remarks
        }
    });
});

// Get project review status
export const getProjectReviewStatus = catchAsync(async (req, res) => {
    const { projectId } = req.params;

    const projectWaterfall = await ProjectWaterfall.findOne({ projectId });
    if (!projectWaterfall) {
        return res.status(httpStatus.OK).json({
            success: true,
            data: {
                projectId,
                hasReview: false,
                status: 'pending',
                canReview: true
            }
        });
    }

    const step5 = projectWaterfall.steps.find(step => step.stepNo === 5);
    const hasReview = step5 && step5.status !== 'pending';
    const canReview = projectWaterfall.currentStepNumber >= 5 && (!hasReview || step5.status === 'skipped');

    res.status(httpStatus.OK).json({
        success: true,
        data: {
            projectId,
            hasReview,
            status: step5?.status || 'pending',
            performedBy: step5?.performedBy,
            remarks: step5?.remarks,
            canReview,
            currentStep: projectWaterfall.currentStepNumber
        }
    });
});
