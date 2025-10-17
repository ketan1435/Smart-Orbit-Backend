import ProjectWaterfall from '../models/projectWaterfall.model.js';
import Project from '../models/project.model.js';
import { createActivityLog } from '../services/activityLog.service.js';
import ApiError from '../utils/ApiError.js';
import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync.js';

// Get SCP data for admin review
export const getScpDataForReview = catchAsync(async (req, res) => {
    const { projectId } = req.params;
    
    const project = await Project.findById(projectId).populate('customerLeadId');
    if (!project) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
    }
    
    const waterfall = await ProjectWaterfall.findOne({ projectId });
    if (!waterfall) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Project waterfall not found');
    }
    
    // Check if current step is step 4 (SCP Updates Project Data)
    const currentStep = waterfall.steps.find(step => step.stepNo === waterfall.currentStepNumber);
    if (!currentStep || currentStep.stepNo !== 4) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Project is not at SCP data update stage');
    }
    
    // Get SCP updated data (this would come from SCP's data entry)
    const scpData = {
        projectId: project._id,
        projectName: project.projectName,
        customerLead: project.customerLeadId,
        siteData: project.siteData || {},
        customerData: project.customerData || {},
        requirementData: project.requirementData || {},
        updatedBy: project.updatedBy,
        updatedAt: project.updatedAt,
        scpNotes: project.scpNotes || '',
        // Add any other SCP-entered data fields
    };
    
    res.status(httpStatus.OK).json({
        success: true,
        data: {
            scpData,
            waterfall: {
                currentStep: currentStep.stepNo,
                stepName: currentStep.stepName,
                status: currentStep.status
            }
        }
    });
});

// Admin reviews SCP data and approves/rejects
export const adminReviewScpData = catchAsync(async (req, res) => {
    const { projectId } = req.params;
    const { action, feedback, remarks } = req.body; // action: 'approve' | 'reject'
    
    const project = await Project.findById(projectId);
    if (!project) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
    }
    
    const waterfall = await ProjectWaterfall.findOne({ projectId });
    if (!waterfall) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Project waterfall not found');
    }
    
    // Check if current step is step 4 (SCP Updates Project Data)
    const currentStep = waterfall.steps.find(step => step.stepNo === waterfall.currentStepNumber);
    if (!currentStep || currentStep.stepNo !== 4) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Project is not at SCP data update stage');
    }
    
    if (action === 'approve') {
        // Move to next step (Admin Review completed)
        await waterfall.moveToNextStep(req.user.name, `Admin approved SCP data: ${remarks || 'No additional remarks'}`);
        
        // Log admin approval
        await createActivityLog({
            user: { _id: req.user.id, name: req.user.name, email: req.user.email },
            userModel: req.user.role === 'Admin' ? 'Admin' : 'User',
            userName: req.user.name,
            userEmail: req.user.email,
            targetModel: 'Project',
            targetId: project._id,
            targetName: project.projectName,
            action: 'update',
            actionType: 'CRUD',
            description: 'Admin reviewed and approved SCP data entry',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            metadata: { 
                waterfallStep: 5,
                action: 'admin_review_approved',
                feedback,
                remarks 
            },
        });
        
        res.status(httpStatus.OK).json({
            success: true,
            message: 'SCP data approved successfully',
            data: {
                waterfall,
                nextStep: waterfall.steps.find(step => step.stepNo === waterfall.currentStepNumber)
            }
        });
        
    } else if (action === 'reject') {
        // Keep at current step but log rejection
        currentStep.history.push({
            timestamp: new Date(),
            performedBy: req.user.name,
            action: 'rejected',
            remarks: `Admin rejected SCP data: ${feedback || 'No feedback provided'}`
        });
        
        await waterfall.save();
        
        // Log admin rejection
        await createActivityLog({
            user: { _id: req.user.id, name: req.user.name, email: req.user.email },
            userModel: req.user.role === 'Admin' ? 'Admin' : 'User',
            userName: req.user.name,
            userEmail: req.user.email,
            targetModel: 'Project',
            targetId: project._id,
            targetName: project.projectName,
            action: 'update',
            actionType: 'CRUD',
            description: 'Admin reviewed and rejected SCP data entry',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            metadata: { 
                waterfallStep: 4,
                action: 'admin_review_rejected',
                feedback,
                remarks 
            },
        });
        
        res.status(httpStatus.OK).json({
            success: true,
            message: 'SCP data rejected. SCP needs to update data.',
            data: {
                waterfall,
                currentStep: waterfall.steps.find(step => step.stepNo === waterfall.currentStepNumber)
            }
        });
        
    } else {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid action. Must be "approve" or "reject"');
    }
});

// Get admin review history for a project
export const getAdminReviewHistory = catchAsync(async (req, res) => {
    const { projectId } = req.params;
    
    const waterfall = await ProjectWaterfall.findOne({ projectId });
    if (!waterfall) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Project waterfall not found');
    }
    
    // Get all admin review activities from step 4 and 5
    const adminReviewActivities = [];
    
    // Get activities from step 4 (SCP Updates Project Data)
    const step4 = waterfall.steps.find(step => step.stepNo === 4);
    if (step4) {
        step4.history.forEach(activity => {
            if (activity.action === 'rejected' || activity.action === 'admin_review') {
                adminReviewActivities.push({
                    stepNo: 4,
                    stepName: step4.stepName,
                    ...activity
                });
            }
        });
    }
    
    // Get activities from step 5 (Admin Reviews SCP Input)
    const step5 = waterfall.steps.find(step => step.stepNo === 5);
    if (step5) {
        step5.history.forEach(activity => {
            adminReviewActivities.push({
                stepNo: 5,
                stepName: step5.stepName,
                ...activity
            });
        });
    }
    
    // Sort by timestamp
    adminReviewActivities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    res.status(httpStatus.OK).json({
        success: true,
        data: {
            activities: adminReviewActivities,
            total: adminReviewActivities.length
        }
    });
});

// Update project data (for SCP to update data)
export const updateProjectData = catchAsync(async (req, res) => {
    const { projectId } = req.params;
    const { siteData, customerData, requirementData, scpNotes } = req.body;
    
    const project = await Project.findById(projectId);
    if (!project) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
    }
    
    const waterfall = await ProjectWaterfall.findOne({ projectId });
    if (!waterfall) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Project waterfall not found');
    }
    
    // Check if current step is step 4 (SCP Updates Project Data)
    const currentStep = waterfall.steps.find(step => step.stepNo === waterfall.currentStepNumber);
    if (!currentStep || currentStep.stepNo !== 4) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Project is not at SCP data update stage');
    }
    
    // Update project data
    const updateData = {};
    if (siteData) updateData.siteData = siteData;
    if (customerData) updateData.customerData = customerData;
    if (requirementData) updateData.requirementData = requirementData;
    if (scpNotes) updateData.scpNotes = scpNotes;
    
    updateData.updatedBy = req.user.name;
    updateData.updatedAt = new Date();
    
    await Project.findByIdAndUpdate(projectId, updateData);
    
    // Log SCP data update
    await createActivityLog({
        user: { _id: req.user.id, name: req.user.name, email: req.user.email },
        userModel: req.user.role === 'Admin' ? 'Admin' : 'User',
        userName: req.user.name,
        userEmail: req.user.email,
        targetModel: 'Project',
        targetId: project._id,
        targetName: project.projectName,
        action: 'update',
        actionType: 'CRUD',
        description: 'SCP updated project data - site, customer, and requirement information',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: { 
            waterfallStep: 4,
            action: 'scp_data_update',
            updatedFields: Object.keys(updateData)
        },
    });
    
    // Update waterfall step history
    currentStep.history.push({
        timestamp: new Date(),
        performedBy: req.user.name,
        action: 'updated',
        remarks: 'SCP updated project data with site, customer, and requirement information'
    });
    
    await waterfall.save();
    
    res.status(httpStatus.OK).json({
        success: true,
        message: 'Project data updated successfully',
        data: {
            project: await Project.findById(projectId),
            waterfall
        }
    });
});
