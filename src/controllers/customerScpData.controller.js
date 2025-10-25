import ProjectWaterfall from '../models/projectWaterfall.model.js';
import Project from '../models/project.model.js';
import ApiError from '../utils/ApiError.js';
import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync.js';

// Get SCP data for customer review
export const getScpDataForCustomer = catchAsync(async (req, res) => {
    console.log('=== GET SCP DATA FOR CUSTOMER API CALLED ===');
    console.log('Request params:', req.params);
    console.log('Request user:', req.user);

    const { projectId } = req.params;

    // Find the project
    const project = await Project.findById(projectId);
    if (!project) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
    }

    // Find project waterfall
    const projectWaterfall = await ProjectWaterfall.findOne({ projectId });
    if (!projectWaterfall) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Project waterfall not found');
    }

    // Check if step 4.5 (SCP Data Sent to Customer) has been completed
    const step4_5 = projectWaterfall.steps.find(step => step.stepNo === 4.5);
    if (!step4_5 || step4_5.status !== 'completed') {
        throw new ApiError(httpStatus.BAD_REQUEST, 'SCP data has not been sent to customer yet.');
    }

    // Get SCP data from project requirement
    const scpData = project.requirement?.scpData;
    if (!scpData) {
        throw new ApiError(httpStatus.NOT_FOUND, 'SCP data not found for this project');
    }

    // Get step 4.5 history to show when it was sent
    const sendHistory = step4_5.history || [];
    const lastSent = sendHistory.length > 0 ? sendHistory[sendHistory.length - 1] : null;

    res.status(httpStatus.OK).json({
        success: true,
        data: {
            project: {
                _id: project._id,
                projectName: project.projectName,
                projectCode: project.projectCode
            },
            scpData,
            sentInfo: {
                sentAt: lastSent?.timestamp || step4_5.completedAt,
                sentBy: lastSent?.performedBy || step4_5.performedBy,
                remarks: lastSent?.remarks || step4_5.remarks
            },
            waterfallStep: {
                stepNo: step4_5.stepNo,
                stepName: step4_5.stepName,
                status: step4_5.status,
                nextStep: step4_5.nextStep
            }
        }
    });
});

// Get all projects with SCP data for customer
export const getCustomerProjectsWithScpData = catchAsync(async (req, res) => {
    console.log('=== GET CUSTOMER PROJECTS WITH SCP DATA API CALLED ===');
    console.log('Request user:', req.user);

    const userId = req.user.id;

    // Find all projects for this customer
    const projects = await Project.find({ 
        'lead.customerId': userId 
    }).populate('requirement').populate('lead');

    // Filter projects that have SCP data sent to customer
    const projectsWithScpData = [];
    
    for (const project of projects) {
        const projectWaterfall = await ProjectWaterfall.findOne({ projectId: project._id });
        if (projectWaterfall) {
            const step4_5 = projectWaterfall.steps.find(step => step.stepNo === 4.5);
            if (step4_5 && step4_5.status === 'completed' && project.requirement?.scpData) {
                projectsWithScpData.push({
                    _id: project._id,
                    projectName: project.projectName,
                    projectCode: project.projectCode,
                    status: project.status,
                    scpDataSent: true,
                    sentAt: step4_5.completedAt,
                    sentBy: step4_5.performedBy,
                    currentStep: projectWaterfall.currentStepNumber
                });
            }
        }
    }

    res.status(httpStatus.OK).json({
        success: true,
        data: {
            projects: projectsWithScpData,
            total: projectsWithScpData.length
        }
    });
});



































