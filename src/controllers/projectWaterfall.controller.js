import ProjectWaterfall from '../models/projectWaterfall.model.js';
import Project from '../models/project.model.js';
import ApiError from '../utils/ApiError.js';
import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync.js';

// Get project waterfall progress
export const getProjectWaterfall = catchAsync(async (req, res) => {
    const { projectId } = req.params;
    
    let waterfall = await ProjectWaterfall.findOne({ projectId }).populate('projectId');
    
    if (!waterfall) {
        // Create new waterfall if doesn't exist
        const project = await Project.findById(projectId);
        if (!project) {
            throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
        }
        
        waterfall = new ProjectWaterfall({
            projectId,
            projectName: project.projectName || 'Untitled Project'
        });
        await waterfall.save();
    }
    
    const progressStats = waterfall.getProgressStats();
    
    res.status(httpStatus.OK).json({
        success: true,
        data: {
            waterfall,
            progressStats
        }
    });
});

// Move to next step
export const moveToNextStep = catchAsync(async (req, res) => {
    const { projectId } = req.params;
    const { performedBy, remarks, targetStep } = req.body;
    
    const waterfall = await ProjectWaterfall.findOne({ projectId });
    if (!waterfall) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Project waterfall not found');
    }
    
    // If targetStep is provided, jump to that step
    if (targetStep && targetStep > waterfall.currentStepNumber) {
        // Mark all steps between current and target as skipped
        for (let i = waterfall.currentStepNumber; i < targetStep; i++) {
            const step = waterfall.steps.find(s => s.stepNo === i);
            if (step && step.status !== 'completed') {
                step.status = 'skipped';
                step.history.push({
                    timestamp: new Date(),
                    performedBy,
                    action: 'skipped',
                    remarks: `Skipped due to jumping to step ${targetStep}`
                });
            }
        }
        
        // Mark target step as active
        const targetStepObj = waterfall.steps.find(s => s.stepNo === targetStep);
        if (targetStepObj) {
            targetStepObj.status = 'active';
            targetStepObj.history.push({
                timestamp: new Date(),
                performedBy,
                action: 'activated',
                remarks: `Jumped to step ${targetStep}`
            });
        }
        
        waterfall.currentStepNumber = targetStep;
    } else {
        // Move to next sequential step
        await waterfall.moveToNextStep(performedBy, remarks);
    }
    
    await waterfall.save();
    
    const progressStats = waterfall.getProgressStats();
    
    res.status(httpStatus.OK).json({
        success: true,
        message: `Moved to step ${waterfall.currentStepNumber}`,
        data: {
            waterfall,
            progressStats
        }
    });
});

// Get project history
export const getProjectHistory = catchAsync(async (req, res) => {
    const { projectId } = req.params;
    
    const waterfall = await ProjectWaterfall.findOne({ projectId });
    if (!waterfall) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Project waterfall not found');
    }
    
    // Collect all history from all steps
    const allHistory = [];
    waterfall.steps.forEach(step => {
        step.history.forEach(historyItem => {
            allHistory.push({
                stepNo: step.stepNo,
                stepName: step.stepName,
                ...historyItem
            });
        });
    });
    
    // Sort by timestamp
    allHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    res.status(httpStatus.OK).json({
        success: true,
        data: {
            history: allHistory,
            totalActions: allHistory.length
        }
    });
});

// Update step status manually
export const updateStepStatus = catchAsync(async (req, res) => {
    const { projectId } = req.params;
    const { stepNo, status, performedBy, remarks } = req.body;
    
    const waterfall = await ProjectWaterfall.findOne({ projectId });
    if (!waterfall) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Project waterfall not found');
    }
    
    const step = waterfall.steps.find(s => s.stepNo === stepNo);
    if (!step) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Step not found');
    }
    
    step.status = status;
    step.history.push({
        timestamp: new Date(),
        performedBy,
        action: status,
        remarks
    });
    
    if (status === 'completed') {
        step.completedAt = new Date();
        step.completedBy = performedBy;
    }
    
    await waterfall.save();
    
    res.status(httpStatus.OK).json({
        success: true,
        message: `Step ${stepNo} updated to ${status}`,
        data: { step }
    });
});

// Get all project waterfalls
export const getAllProjectWaterfalls = catchAsync(async (req, res) => {
    const { page = 1, limit = 10, status } = req.query;
    
    const filter = {};
    if (status) {
        filter['steps.status'] = status;
    }
    
    const waterfalls = await ProjectWaterfall.find(filter)
        .populate('projectId', 'projectName status')
        .sort({ updatedAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);
    
    const total = await ProjectWaterfall.countDocuments(filter);
    
    res.status(httpStatus.OK).json({
        success: true,
        data: {
            waterfalls,
            pagination: {
                current: page,
                pages: Math.ceil(total / limit),
                total
            }
        }
    });
});

// Reset project waterfall
export const resetProjectWaterfall = catchAsync(async (req, res) => {
    const { projectId } = req.params;
    
    const waterfall = await ProjectWaterfall.findOne({ projectId });
    if (!waterfall) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Project waterfall not found');
    }
    
    // Reset all steps to pending except step 1
    waterfall.steps.forEach(step => {
        if (step.stepNo === 1) {
            step.status = 'active';
        } else {
            step.status = 'pending';
        }
        step.completedAt = null;
        step.completedBy = null;
        step.history = [];
    });
    
    waterfall.currentStepNumber = 1;
    await waterfall.save();
    
    res.status(httpStatus.OK).json({
        success: true,
        message: 'Project waterfall reset successfully',
        data: { waterfall }
    });
});
