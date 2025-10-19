import { generateProjectReport, generatePDFReport, shareReport, sendReportToCustomer, getReceivedReportsForCustomer, getReceivedReportById } from '../services/projectReport.service.js';
import catchAsync from '../utils/catchAsync.js';
import ApiError from '../utils/ApiError.js';
import httpStatus from 'http-status';

/**
 * Get project report data
 */
const getProjectReport = catchAsync(async (req, res) => {
    const { projectId } = req.params;
    const user = req.user;

    if (!projectId) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Project ID is required');
    }

    const reportData = await generateProjectReport(projectId);

    res.status(httpStatus.OK).json({
        status: 1,
        message: 'Project report generated successfully',
        data: reportData
    });
});

/**
 * Generate PDF report
 */
const generatePDF = catchAsync(async (req, res) => {
    const { projectId } = req.params;
    const user = req.user;

    if (!projectId) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Project ID is required');
    }

    const result = await generatePDFReport(projectId, user);

    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="project-report-${projectId}.pdf"`);

    // For now, return success message
    // In a real implementation, you would generate the actual PDF here
    res.status(httpStatus.OK).json({
        status: 1,
        message: 'PDF report generated successfully',
        data: result
    });
});

/**
 * Share report
 */
const shareProjectReport = catchAsync(async (req, res) => {
    const { projectId } = req.params;
    const user = req.user;

    if (!projectId) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Project ID is required');
    }

    const result = await shareReport(projectId, user);

    res.status(httpStatus.OK).json({
        status: 1,
        message: 'Report shared successfully',
        data: result
    });
});

/**
 * Get shared report (for public access)
 */
const getSharedReport = catchAsync(async (req, res) => {
    const { shareToken } = req.params;

    if (!shareToken) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Share token is required');
    }

    // In a real implementation, you would validate the share token
    // and get the project ID from it
    // For now, we'll return an error
    throw new ApiError(httpStatus.NOT_FOUND, 'Shared report not found or expired');
});

/**
 * Send report to customer
 */
const sendReportToCustomerController = catchAsync(async (req, res) => {
    const { projectId } = req.params;
    const { customerId, message } = req.body;
    const user = req.user;

    if (!projectId) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Project ID is required');
    }

    if (!customerId) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Customer ID is required');
    }

    const result = await sendReportToCustomer(projectId, customerId, message, user);

    res.status(httpStatus.OK).json({
        status: 1,
        message: 'Report sent to customer successfully',
        data: result
    });
});

/**
 * Get received reports for customer
 */
const getReceivedReports = catchAsync(async (req, res) => {
    const { customerId } = req.params;
    const user = req.user;

    if (!customerId) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Customer ID is required');
    }

    // Verify the customer is requesting their own reports
    if (user._id.toString() !== customerId) {
        throw new ApiError(httpStatus.FORBIDDEN, 'Access denied');
    }

    const reports = await getReceivedReportsForCustomer(customerId);

    res.status(httpStatus.OK).json({
        status: 1,
        message: 'Received reports retrieved successfully',
        data: reports
    });
});

/**
 * Get received report by ID for customer
 */
const getReceivedReport = catchAsync(async (req, res) => {
    const { reportId } = req.params;
    const user = req.user;

    if (!reportId) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Report ID is required');
    }

    const report = await getReceivedReportById(reportId, user._id);

    res.status(httpStatus.OK).json({
        status: 1,
        message: 'Report retrieved successfully',
        data: report
    });
});

export {
    getProjectReport,
    generatePDF,
    shareProjectReport,
    getSharedReport,
    sendReportToCustomerController,
    getReceivedReports,
    getReceivedReport
};