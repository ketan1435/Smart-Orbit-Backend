import httpStatus from 'http-status';
import ProjectAssignmentPayment from '../models/projectAssignmentPaymant.model.js';
import ApiError from '../utils/ApiError.js';
import Project from '../models/project.model.js';
import User from '../models/user.model.js';
import Sitework from '../models/sitework.model.js';
import Attendance from '../models/attendance.model.js';

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
    if (filter.userId) {
        mongoFilter.user = filter.userId;
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
        .populate({
            path: 'sitework',
            select: 'name description startDate endDate workingHoursPerDay dateType status assignedUsers'
        })
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

    const totalResults = await ProjectAssignmentPayment.countDocuments(mongoFilter);

    console.log(`Found ${payments.length} payments out of ${totalResults} total`);

    // Enhance payments with attendance information for custom users
    const enhancedPayments = await Promise.all(payments.map(async (payment) => {
        // Only add attendance info for custom users
        if (payment.user && payment.user.role === 'custom') {
            // Find attendance records for this user and project
            const attendanceRecords = await Attendance.find({
                fabricator: payment.user._id,
                project: payment.project._id
            }).select('clockInTime clockOutTime workDuration sitework siteworkName status').lean();

            // If there's a specific sitework linked to this payment
            if (payment.sitework) {
                // Find attendance records for this specific sitework
                const siteworkAttendance = attendanceRecords.filter(att => 
                    att.sitework && att.sitework.toString() === payment.sitework._id.toString()
                );

                // Calculate time tracking for this sitework
                const totalWorkedMinutes = siteworkAttendance.reduce((total, att) => {
                    return total + (att.workDuration || 0);
                }, 0);

                // Calculate expected time based on sitework duration and working hours per day
                let expectedMinutes = 0;
                if (payment.sitework.startDate && payment.sitework.endDate) {
                    const startDate = new Date(payment.sitework.startDate);
                    const endDate = new Date(payment.sitework.endDate);
                    const diffInMs = endDate.getTime() - startDate.getTime();
                    const diffInDays = Math.ceil(diffInMs / (1000 * 60 * 60 * 24));
                    // Use workingHoursPerDay from sitework, default to 8 hours if not set
                    const workingHoursPerDay = payment.sitework.workingHoursPerDay || 8;
                    expectedMinutes = diffInDays * workingHoursPerDay * 60;
                }

                // Calculate time difference
                const timeDifference = totalWorkedMinutes - expectedMinutes;
                const timeDifferenceHours = Math.round((timeDifference / 60) * 10) / 10;

                // Get user's assignment details from sitework
                const userAssignment = payment.sitework.assignedUsers.find(au => 
                    au.user.toString() === payment.user._id.toString()
                );

                return {
                    ...payment,
                    siteworkInfo: {
                        siteworkId: payment.sitework._id,
                        siteworkName: payment.sitework.name,
                        siteworkDescription: payment.sitework.description,
                        startDate: payment.sitework.startDate,
                        endDate: payment.sitework.endDate,
                        workingHoursPerDay: payment.sitework.workingHoursPerDay || 8,
                        dateType: payment.sitework.dateType || 'range',
                        status: payment.sitework.status,
                        assignedAmount: userAssignment?.assignmentAmount || 0,
                        perDayAmount: userAssignment?.perDayAmount || 0,
                        expectedTimeHours: Math.round((expectedMinutes / 60) * 10) / 10,
                        actualTimeHours: Math.round((totalWorkedMinutes / 60) * 10) / 10,
                        timeDifferenceHours: timeDifferenceHours,
                        isOverTime: timeDifference > 0,
                        isUnderTime: timeDifference < 0,
                        attendanceRecords: siteworkAttendance.map(att => ({
                            clockInTime: att.clockInTime,
                            clockOutTime: att.clockOutTime,
                            workDuration: att.workDuration,
                            status: att.status,
                            siteworkName: att.siteworkName
                        }))
                    },
                    timeTrackingSummary: {
                        totalExpectedTimeHours: Math.round((expectedMinutes / 60) * 10) / 10,
                        totalActualTimeHours: Math.round((totalWorkedMinutes / 60) * 10) / 10,
                        overallTimeDifferenceHours: timeDifferenceHours,
                        isOverTime: timeDifference > 0,
                        isUnderTime: timeDifference < 0,
                        totalSiteworks: 1,
                        completedSiteworks: payment.sitework.status === 'completed' ? 1 : 0
                    }
                };
            } else {
                // If no specific sitework, show general attendance info
                const totalWorkedMinutes = attendanceRecords.reduce((total, att) => {
                    return total + (att.workDuration || 0);
                }, 0);

                return {
                    ...payment,
                    generalAttendanceInfo: {
                        totalActualTimeHours: Math.round((totalWorkedMinutes / 60) * 10) / 10,
                        totalAttendanceRecords: attendanceRecords.length,
                        attendanceRecords: attendanceRecords.map(att => ({
                            clockInTime: att.clockInTime,
                            clockOutTime: att.clockOutTime,
                            workDuration: att.workDuration,
                            status: att.status,
                            siteworkName: att.siteworkName
                        }))
                    }
                };
            }
        } else {
            // For non-custom users, return payment as is
            return payment;
        }
    }));

    // Compute totals for the current filter for pagination-friendly stats
    // Important: aggregation does not cast string IDs, so cast user to ObjectId explicitly when present
    const aggMatch = { ...mongoFilter };
    if (aggMatch.user && typeof aggMatch.user === 'string') {
        aggMatch.user = new (await import('mongoose')).default.Types.ObjectId(aggMatch.user);
    }

    const totalsAgg = await ProjectAssignmentPayment.aggregate([
        { $match: aggMatch },
        {
            $group: {
                _id: null,
                totalAssigned: { $sum: { $ifNull: ['$assignedAmount', 0] } },
                totalRemaining: { $sum: { $ifNull: ['$remainingAmount', { $ifNull: ['$assignedAmount', 0] }] } },
                count: { $sum: 1 }
            }
        }
    ]);

    const totals = totalsAgg[0] || { totalAssigned: 0, totalRemaining: 0, count: 0 };
    const totalPaid = Math.max(0, (totals.totalAssigned || 0) - (totals.totalRemaining || 0));

    return {
        results: enhancedPayments,
        page,
        limit,
        totalPages: Math.ceil(totalResults / limit),
        totalResults,
        totals: {
            totalAssigned: totals.totalAssigned || 0,
            totalRemaining: totals.totalRemaining || 0,
            totalPaid
        }
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
    paymentBody.remainingAmount=paymentBody.assignedAmount;
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
