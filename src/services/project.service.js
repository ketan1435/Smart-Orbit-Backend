import Project from '../models/project.model.js';
import CustomerLead from '../models/customerLead.model.js';
import ApiError from '../utils/ApiError.js';
import { mongoose } from 'mongoose';

/**
 * Generates a unique project code.
 * The code format will be `PROJ-<timestamp>-<random-4-digits>`.
 * @returns {Promise<string>}
 */
const generateProjectCode = async () => {
    const timestamp = new Date().getTime().toString().slice(-6); // Last 6 digits of timestamp
    const random = Math.floor(1000 + Math.random() * 9000); // 4 random digits
    const projectCode = `PROJ-${timestamp}${random}`;

    // Check for uniqueness
    const existingProject = await Project.findOne({ projectCode });
    if (existingProject) {
        return generateProjectCode(); // Recurse if code already exists
    }
    return projectCode;
};


/**
 * Create a project
 * @param {Object} projectBody
 * @returns {Promise<Project>}
 */
export const createProject = async (projectBody, session) => {
    const projectCode = await generateProjectCode();
    const [project] = await Project.create([{ ...projectBody, projectCode }], { session });
    return project;
};

/**
 * Query for projects with pagination, sorting, and filtering
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @param {string} [options.sortBy] - Sort option in the format: field:(desc|asc)
 * @param {number} [options.limit] - Maximum number of results per page (default: 10)
 * @param {number} [options.page] - Current page (default: 1)
 * @returns {Promise<Object>}
 */
export const queryProjects = async (filter, options) => {
    const { limit = 10, page = 1, sortBy } = options;
    const { customerName, requirementType, projectName, ...directFilters } = filter;
    const sort = sortBy ? { [sortBy.split(':')[0]]: sortBy.split(':')[1] === 'desc' ? -1 : 1 } : { createdAt: -1 };

    const projectFilter = { ...directFilters };

    if (projectName) {
        projectFilter.projectName = { $regex: projectName, $options: 'i' };
    }

    if (customerName) {
        const leads = await CustomerLead.find({ customerName: { $regex: customerName, $options: 'i' } }).select('_id');
        const leadIds = leads.map(l => l._id);
        if (leadIds.length === 0) return { results: [], page, limit, totalPages: 0, totalResults: 0 };
        projectFilter.lead = { $in: leadIds };
    }

    if (requirementType) {
        const leadsWithMatchingReqs = await CustomerLead.find({ 'requirements.requirementType': requirementType }).select('requirements._id requirements.requirementType');
        const requirementIds = leadsWithMatchingReqs.flatMap(lead =>
            lead.requirements.filter(req => req.requirementType === requirementType).map(req => req._id)
        );
        if (requirementIds.length === 0) return { results: [], page, limit, totalPages: 0, totalResults: 0 };
        projectFilter.requirement = { $in: requirementIds };
    }

    const projects = await Project.find(projectFilter)
        .populate('lead')
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

    const totalResults = await Project.countDocuments(projectFilter);

    return {
        results: projects,
        page,
        limit,
        totalPages: Math.ceil(totalResults / limit),
        totalResults,
    };
}; 