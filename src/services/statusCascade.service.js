import Project from '../models/project.model.js';
import CustomerLead from '../models/customerLead.model.js';
import { getCustomerStatusFromProjects, STATUS_ENUM } from '../config/enums/status.enum.js';
import ApiError from '../utils/ApiError.js';
import httpStatus from 'http-status';

/**
 * Update customer status and cascade to all projects
 * @param {string} customerId - Customer lead ID
 * @param {string} newStatus - New status for customer
 * @param {Object} session - MongoDB session for transaction
 * @returns {Promise<Object>} Updated customer and projects count
 */
export const updateCustomerStatusWithCascade = async (customerId, newStatus, session = null) => {
  // Validate status
  if (!Object.values(STATUS_ENUM).includes(newStatus)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid status value');
  }

  // Update customer status
  const customer = await CustomerLead.findByIdAndUpdate(
    customerId,
    { status: newStatus },
    { new: true, session }
  );

  if (!customer) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Customer not found');
  }

  // Cascade to all projects under this customer
  const updateResult = await Project.updateMany(
    { lead: customerId },
    { status: newStatus },
    { session }
  );

  return {
    customer,
    projectsUpdated: updateResult.modifiedCount
  };
};

/**
 * Update project status and reflect to customer
 * @param {string} projectId - Project ID
 * @param {string} newStatus - New status for project
 * @param {Object} session - MongoDB session for transaction
 * @returns {Promise<Object>} Updated project and customer
 */
export const updateProjectStatusWithReflection = async (projectId, newStatus, session = null) => {
  // Validate status
  if (!Object.values(STATUS_ENUM).includes(newStatus)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid status value');
  }

  // Update project status
  const project = await Project.findByIdAndUpdate(
    projectId,
    { status: newStatus },
    { new: true, session }
  );

  if (!project) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
  }

  // Get all projects for this customer
  const allProjects = await Project.find({ lead: project.lead }).select('status');
  
  // Calculate new customer status based on all project statuses
  const projectStatuses = allProjects.map(p => p.status);
  const newCustomerStatus = getCustomerStatusFromProjects(projectStatuses);

  // Update customer status
  const customer = await CustomerLead.findByIdAndUpdate(
    project.lead,
    { status: newCustomerStatus },
    { new: true, session }
  );

  return {
    project,
    customer,
    newCustomerStatus
  };
};

/**
 * Recalculate customer status based on all its projects
 * @param {string} customerId - Customer lead ID
 * @param {Object} session - MongoDB session for transaction
 * @returns {Promise<Object>} Updated customer
 */
export const recalculateCustomerStatus = async (customerId, session = null) => {
  // Get all projects for this customer
  const projects = await Project.find({ lead: customerId }).select('status');
  
  // Calculate new customer status based on all project statuses
  const projectStatuses = projects.map(p => p.status);
  const newCustomerStatus = getCustomerStatusFromProjects(projectStatuses);

  // Update customer status
  const customer = await CustomerLead.findByIdAndUpdate(
    customerId,
    { status: newCustomerStatus },
    { new: true, session }
  );

  return {
    customer,
    newCustomerStatus,
    projectsCount: projects.length
  };
};

/**
 * Get customer status summary with project breakdown
 * @param {string} customerId - Customer lead ID
 * @returns {Promise<Object>} Customer status summary
 */
export const getCustomerStatusSummary = async (customerId) => {
  const customer = await CustomerLead.findById(customerId);
  if (!customer) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Customer not found');
  }

  const projects = await Project.find({ lead: customerId }).select('status projectName');
  
  // Count projects by status
  const statusBreakdown = {};
  Object.values(STATUS_ENUM).forEach(status => {
    statusBreakdown[status] = 0;
  });

  projects.forEach(project => {
    statusBreakdown[project.status] = (statusBreakdown[project.status] || 0) + 1;
  });

  // Calculate derived status
  const projectStatuses = projects.map(p => p.status);
  const derivedStatus = getCustomerStatusFromProjects(projectStatuses);

  return {
    customer,
    projects,
    statusBreakdown,
    derivedStatus,
    isStatusConsistent: customer.status === derivedStatus
  };
};


