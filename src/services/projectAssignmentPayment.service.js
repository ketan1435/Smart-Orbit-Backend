import httpStatus from 'http-status';
import ProjectAssignmentPayment from '../models/projectAssignmentPaymant.model.js';
import ApiError from '../utils/ApiError.js';
import Project from '../models/project.model.js';
import User from '../models/user.model.js';

/**
 * Query project assignment payments
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @param {string} [options.sortBy] - Sort option in the format: sortField:(desc|asc)
 * @param {number} [options.limit] - Maximum number of results per page (default = 10)
 * @param {number} [options.page] - Current page (default = 1)
 * @returns {Promise<QueryResult>}
 */
export const queryProjectAssignmentPayments = async (filter, options) => {
    const { limit = 10, page = 1, sortBy } = options;

    let sort;
    if (typeof sortBy === 'string') {
        const [field, order] = sortBy.split(':');
        sort = { [field]: order === 'desc' ? -1 : 1 };
    } else if (typeof sortBy === 'object' && sortBy !== null) {
        sort = sortBy;
    } else {
        sort = { createdAt: -1 };
    }

    // Check if there are any ProjectAssignmentPayment records at all
    const totalRecords = await ProjectAssignmentPayment.countDocuments({});
    console.log(`Total ProjectAssignmentPayment records in database: ${totalRecords}`);

    // Build the filter object
    const mongoFilter = {};

    // Handle project name filtering
    if (filter.projectName) {
        const projects = await Project.find({
            projectName: { $regex: filter.projectName, $options: 'i' }
        }).select('_id');
        const projectIds = projects.map(p => p._id);
        mongoFilter.project = { $in: projectIds };
    }

    // Handle user name filtering
    if (filter.userName) {
        const users = await User.find({
            name: { $regex: filter.userName, $options: 'i' }
        }).select('_id');
        const userIds = users.map(u => u._id);
        mongoFilter.user = { $in: userIds };
    }

    // Handle user role filtering
    if (filter.userRole) {
        const usersWithRole = await User.find({
            role: filter.userRole
        }).select('_id');
        const userIds = usersWithRole.map(u => u._id);

        console.log(`Filtering by role: ${filter.userRole}`);
        console.log(`Found ${userIds.length} users with role ${filter.userRole}`);

        // Only add the filter if we found users with this role
        if (userIds.length > 0) {
            mongoFilter.user = { $in: userIds };
        } else {
            // If no users found with this role, return empty results
            console.log(`No users found with role ${filter.userRole}, returning empty results`);
            return {
                results: [],
                page,
                limit,
                totalPages: 0,
                totalResults: 0,
            };
        }
    }

    // Handle other filters
    if (filter.createdBy) {
        mongoFilter.createdBy = filter.createdBy;
    }
    if (filter.createdByModel) {
        mongoFilter.createdByModel = filter.createdByModel;
    }

    console.log('Final mongoFilter:', JSON.stringify(mongoFilter, null, 2));

    const payments = await ProjectAssignmentPayment.find(mongoFilter)
        .populate({
            path: 'project',
            select: 'projectName projectCode status budget',
            populate: {
                path: 'lead',
                select: 'customerName mobileNumber email'
            }
        })
        .populate({
            path: 'user',
            select: 'name email role phoneNumber'
        })
        .populate({
            path: 'createdBy',
            select: 'name email role'
        })
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

    const totalResults = await ProjectAssignmentPayment.countDocuments(mongoFilter);

    console.log(`Found ${payments.length} payments out of ${totalResults} total`);

    return {
        results: payments,
        page,
        limit,
        totalPages: Math.ceil(totalResults / limit),
        totalResults,
    };
};

/**
 * Get project assignment payment by id
 * @param {ObjectId} id
 * @returns {Promise<ProjectAssignmentPayment>}
 */
export const getProjectAssignmentPaymentById = async (id) => {
    const payment = await ProjectAssignmentPayment.findById(id)
        .populate('project', 'projectName projectCode status budget')
        .populate('user', 'name email role phoneNumber')
        .populate('createdBy', 'name email role');

    if (!payment) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Project assignment payment not found');
    }
    return payment;
};

/**
 * Create project assignment payment
 * @param {Object} paymentBody
 * @returns {Promise<ProjectAssignmentPayment>}
 */
export const createProjectAssignmentPayment = async (paymentBody) => {
    const payment = await ProjectAssignmentPayment.create(paymentBody);
    return payment;
};

/**
 * Update project assignment payment by id
 * @param {ObjectId} paymentId
 * @param {Object} updateBody
 * @returns {Promise<ProjectAssignmentPayment>}
 */
export const updateProjectAssignmentPaymentById = async (paymentId, updateBody) => {
    const payment = await getProjectAssignmentPaymentById(paymentId);
    Object.assign(payment, updateBody);
    await payment.save();
    return payment;
};

/**
 * Delete project assignment payment by id
 * @param {ObjectId} paymentId
 * @returns {Promise<ProjectAssignmentPayment>}
 */
export const deleteProjectAssignmentPaymentById = async (paymentId) => {
    const payment = await getProjectAssignmentPaymentById(paymentId);
    await ProjectAssignmentPayment.deleteOne({ _id: paymentId });
    return payment;
}; 