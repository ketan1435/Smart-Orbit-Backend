import Attendance from '../models/attendance.model.js';
import User from '../models/user.model.js';
import Project from '../models/project.model.js';
import Sitework from '../models/sitework.model.js';
import storage from '../factory/storage.factory.js';
import ApiError from '../utils/ApiError.js';
import logger from '../config/logger.js';
import httpStatus from 'http-status';

export const clockInService = async (req, session) => {
    const { clockInTime, photoKey, projectId, siteworkId } = req.body;
    const fabricatorId = req.user.id;

    try {
        // Verify fabricator exists and is active
        const fabricator = await User.findById(fabricatorId).session(session);
        if (!fabricator) {
            throw new ApiError(httpStatus.NOT_FOUND, 'Fabricator not found');
        }

        if (!(fabricator.role === 'fabricator' || fabricator.role === 'custom')) {
            throw new ApiError(httpStatus.BAD_REQUEST, 'User is not allowed to use attendance');
        }

        // Validate project ID is provided
        if (!projectId) {
            throw new ApiError(httpStatus.BAD_REQUEST, 'Project ID is required');
        }

        // Verify project exists and is in-progress
        const project = await Project.findById(projectId).session(session);
        if (!project) {
            throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
        }

        if (project.status !== 'inprogress') {
            throw new ApiError(httpStatus.BAD_REQUEST, 'Only in-progress projects are allowed for attendance');
        }

        // Convert client time (Indian time) to UTC for storage
        const clientClockInTime = new Date(clockInTime);
        const currentTime = new Date();

        // Calculate time difference (accounting for timezone)
        const timeDifference = Math.abs(currentTime - clientClockInTime);

        // Allow up to 10 minutes difference between client and server time
        if (timeDifference > 10 * 60 * 1000) {
            throw new ApiError(httpStatus.BAD_REQUEST, 'Clock-in time is too far from current time');
        }

        // Check if clock-in is within reasonable working hours (5 AM to 11 PM) in Indian time
        const indianTime = new Date(clientClockInTime.getTime() + (5.5 * 60 * 60 * 1000)); // Convert to IST
        const hour = indianTime.getHours();
        if (hour < 5 || hour > 23) {
            throw new ApiError(httpStatus.BAD_REQUEST, 'Clock-in is only allowed between 5:00 AM and 11:00 PM IST');
        }

        // Check if fabricator has already clocked in today (regardless of status)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const existingAttendance = await Attendance.findOne({
            fabricator: fabricatorId,
            project: projectId,
            clockInTime: {
                $gte: today,
                $lt: tomorrow,
            },
        }).session(session);

        if (existingAttendance) {
            if (existingAttendance.status === 'clocked-in') {
                throw new ApiError(httpStatus.BAD_REQUEST, 'You are already clocked in today');
            } else if (existingAttendance.status === 'clocked-out') {
                throw new ApiError(httpStatus.BAD_REQUEST, 'You have already completed attendance for today');
            }
        }

        // Validate sitework if provided
        let sitework = null;
        let siteworkName = null;
        if (siteworkId) {
            sitework = await Sitework.findById(siteworkId).session(session);
            if (!sitework) {
                throw new ApiError(httpStatus.NOT_FOUND, 'Sitework not found');
            }
            
            // Verify sitework belongs to the project
            if (sitework.project.toString() !== projectId) {
                throw new ApiError(httpStatus.BAD_REQUEST, 'Sitework does not belong to the specified project');
            }
            
            // Verify fabricator is assigned to this sitework
            const isAssignedToSitework = sitework.assignedUsers.some(
                assignedUser => assignedUser.user.toString() === fabricatorId
            );
            if (!isAssignedToSitework) {
                throw new ApiError(httpStatus.FORBIDDEN, 'You are not assigned to this sitework');
            }
            
            siteworkName = sitework.name;
        }

        // Create attendance record - store client time as is (it's already in the correct timezone)
        const attendance = new Attendance({
            fabricator: fabricatorId,
            fabricatorName: fabricator.name,
            project: projectId,
            projectName: project.projectName,
            sitework: siteworkId || null,
            siteworkName: siteworkName || null,
            clockInTime: clientClockInTime,
            clockInPhotoKey: photoKey,
            status: 'clocked-in',
        });

        await attendance.save({ session });

        // File handling outside transaction
        try {
            // Move photo from temporary location to permanent location
            const permanentKey = `attendance/${attendance._id}/clock-in-photo.jpg`;
            await storage.copyFile(photoKey, permanentKey);

            // Update attendance record with permanent photo key
            attendance.clockInPhotoKey = permanentKey;
            await attendance.save({ session });

            // Delete temporary file
            await storage.deleteFile(photoKey);

        } catch (fileError) {
            logger.error(`Failed to process clock-in photo: ${fileError.message}`);
            // Cleanup: delete the attendance record
            await Attendance.deleteOne({ _id: attendance._id }).session(session);
            throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to process photo');
        }

        // Populate fabricator and project details
        await attendance.populate([
            { path: 'fabricator', select: 'name email role' },
            { path: 'project', select: 'projectName projectCode status' }
        ]);

        return {
            status: httpStatus.CREATED,
            body: {
                status: 1,
                message: 'Clock in successful',
                data: attendance,
            }
        };

    } catch (error) {
        throw error;
    }
};

export const clockOutService = async (req, session) => {
    const { clockOutTime, photoKey, projectId, siteworkId } = req.body;
    const fabricatorId = req.user.id;

    try {
        // Validate project ID is provided
        if (!projectId) {
            throw new ApiError(httpStatus.BAD_REQUEST, 'Project ID is required');
        }

        // Verify project exists and is in-progress
        const project = await Project.findById(projectId).session(session);
        if (!project) {
            throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
        }

        if (project.status !== 'inprogress') {
            throw new ApiError(httpStatus.BAD_REQUEST, 'Only in-progress projects are allowed for attendance');
        }

        // Convert client time (Indian time) to UTC for storage
        const clientClockOutTime = new Date(clockOutTime);
        const currentTime = new Date();

        // Calculate time difference (accounting for timezone)
        const timeDifference = Math.abs(currentTime - clientClockOutTime);

        // Allow up to 10 minutes difference between client and server time
        if (timeDifference > 10 * 60 * 1000) {
            throw new ApiError(httpStatus.BAD_REQUEST, 'Clock-out time is too far from current time');
        }

        // Clock out can happen at any time (people might work late or early)
        // No working hours restriction for clock out
        // Find today's attendance record
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const query = {
            fabricator: fabricatorId,
            project: projectId,
            clockInTime: {
                $gte: today,
                $lt: tomorrow,
            },
        };

        // If siteworkId is provided, filter by sitework
        if (siteworkId) {
            query.sitework = siteworkId;
        }

        const attendance = await Attendance.findOne(query).session(session);

        if (!attendance) {
            throw new ApiError(httpStatus.BAD_REQUEST, 'No clock-in record found for today. Please clock in first.');
        }

        if (attendance.status === 'clocked-out') {
            throw new ApiError(httpStatus.BAD_REQUEST, 'You have already clocked out today');
        }

        if (attendance.status !== 'clocked-in') {
            throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid attendance status. Please clock in first.');
        }

        // Validate that clock-out time is after clock-in time
        const clockInTime = new Date(attendance.clockInTime);
        if (clientClockOutTime <= clockInTime) {
            throw new ApiError(httpStatus.BAD_REQUEST, 'Clock-out time must be after clock-in time');
        }

        // Validate minimum working duration (at least 1 minute)
        const workDuration = clientClockOutTime - clockInTime;
        const minimumWorkDuration = 60 * 1000; // 1 minute in milliseconds
        if (workDuration < minimumWorkDuration) {
            throw new ApiError(httpStatus.BAD_REQUEST, 'Minimum working duration is 1 minute');
        }

        // Update attendance record - store client time as is
        attendance.clockOutTime = clientClockOutTime;
        attendance.clockOutPhotoKey = photoKey;
        attendance.status = 'clocked-out';

        await attendance.save({ session });

        // File handling outside transaction
        try {
            // Move photo from temporary location to permanent location
            const permanentKey = `attendance/${attendance._id}/clock-out-photo.jpg`;
            await storage.copyFile(photoKey, permanentKey);

            // Update attendance record with permanent photo key
            attendance.clockOutPhotoKey = permanentKey;
            await attendance.save({ session });

            // Delete temporary file
            await storage.deleteFile(photoKey);

        } catch (fileError) {
            logger.error(`Failed to process clock-out photo: ${fileError.message}`);
            // Revert the attendance record
            attendance.clockOutTime = null;
            attendance.clockOutPhotoKey = null;
            attendance.status = 'clocked-in';
            await attendance.save({ session });
            throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to process photo');
        }

        // Populate fabricator and project details
        await attendance.populate([
            { path: 'fabricator', select: 'name email role' },
            { path: 'project', select: 'projectName projectCode status' }
        ]);

        return {
            status: httpStatus.OK,
            body: {
                status: 1,
                message: 'Clock out successful',
                data: attendance,
            }
        };

    } catch (error) {
        throw error;
    }
};

export const getAttendanceRecordsService = async (req, res, next) => {
    try {
        const { page = 1, limit = 10, fabricatorId, projectId, siteworkId, startDate, endDate } = req.query;
        const userId = req.user.id;

        // Build query
        const query = {};

        // If fabricatorId is provided, filter by it
        if (fabricatorId) {
            query.fabricator = fabricatorId;
        } else {
            // If no fabricatorId provided, get records for current user if they are a fabricator/custom
            const user = await User.findById(userId);
            if (user && (user.role === 'fabricator' || user.role === 'custom')) {
                query.fabricator = userId;
            }
        }

        // If projectId is provided, filter by it
        if (projectId) {
            query.project = projectId;
        }

        // If siteworkId is provided, filter by it
        if (siteworkId) {
            query.sitework = siteworkId;
        }

        // Date range filter
        if (startDate || endDate) {
            query.clockInTime = {};
            if (startDate) {
                query.clockInTime.$gte = new Date(startDate);
            }
            if (endDate) {
                query.clockInTime.$lte = new Date(endDate);
            }
        }

        const options = {
            page: parseInt(page),
            limit: parseInt(limit),
            sort: { clockInTime: -1 },
            populate: [
                { path: 'fabricator', select: 'name email role' },
                { path: 'project', select: 'projectName projectCode status' },
                { path: 'sitework', select: 'name description status startDate endDate' }
            ],
        };

        const result = await Attendance.paginate(query, options);

        res.status(httpStatus.OK).json({
            status: 1,
            message: 'Attendance records fetched successfully',
            data: result.docs,
            pagination: {
                page: result.page,
                limit: result.limit,
                total: result.totalDocs,
                pages: result.totalPages,
            },
        });

    } catch (error) {
        next(error);
    }
};

export const getCurrentAttendanceService = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { projectId, siteworkId } = req.query;

        // Find today's active attendance
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const query = {
            fabricator: userId,
            clockInTime: {
                $gte: today,
                $lt: tomorrow,
            },
            status: 'clocked-in',
        };

        // If projectId is provided, filter by it
        if (projectId) {
            query.project = projectId;
        }

        // If siteworkId is provided, filter by it
        if (siteworkId) {
            query.sitework = siteworkId;
        }

        const attendance = await Attendance.findOne(query).populate([
            { path: 'fabricator', select: 'name email role' },
            { path: 'project', select: 'projectName projectCode status' },
            { path: 'sitework', select: 'name description status startDate endDate' }
        ]);

        if (!attendance) {
            return res.status(httpStatus.OK).json({
                status: 1,
                message: 'No active attendance found',
                data: null,
            });
        }

        res.status(httpStatus.OK).json({
            status: 1,
            message: 'Current attendance fetched successfully',
            data: attendance,
        });

    } catch (error) {
        next(error);
    }
};

export const getAttendanceStatsService = async (req, res, next) => {
    try {
        const { fabricatorId, projectId, siteworkId, month, year } = req.query;
        const userId = req.user.id;

        // Determine fabricator ID
        let targetFabricatorId = fabricatorId;
        if (!targetFabricatorId) {
            const user = await User.findById(userId);
            if (user && (user.role === 'fabricator' || user.role === 'custom')) {
                targetFabricatorId = userId;
            }
        }

        if (!targetFabricatorId) {
            throw new ApiError(httpStatus.BAD_REQUEST, 'Fabricator ID is required');
        }

        // Build date range
        const currentDate = new Date();
        const targetMonth = month ? parseInt(month) : currentDate.getMonth() + 1;
        const targetYear = year ? parseInt(year) : currentDate.getFullYear();

        const startDate = new Date(targetYear, targetMonth - 1, 1);
        const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59);

        // Build query for attendance records
        const query = {
            fabricator: targetFabricatorId,
            clockInTime: {
                $gte: startDate,
                $lte: endDate,
            },
            status: 'clocked-out',
        };

        // If projectId is provided, filter by it
        if (projectId) {
            query.project = projectId;
        }

        // If siteworkId is provided, filter by it
        if (siteworkId) {
            query.sitework = siteworkId;
        }

        // Get attendance records for the month
        const attendanceRecords = await Attendance.find(query);

        // Calculate stats
        const totalDays = attendanceRecords.length;
        const totalWorkHours = attendanceRecords.reduce((sum, record) => {
            return sum + (record.workDuration || 0);
        }, 0);

        const averageWorkHours = totalDays > 0 ? totalWorkHours / totalDays : 0;

        res.status(httpStatus.OK).json({
            status: 1,
            message: 'Attendance stats fetched successfully',
            data: {
                month: targetMonth,
                year: targetYear,
                totalDays,
                totalWorkHours: Math.round(totalWorkHours),
                averageWorkHours: Math.round(averageWorkHours),
                attendanceRecords: attendanceRecords.map(record => ({
                    date: record.clockInTime,
                    clockInTime: record.clockInTime,
                    clockOutTime: record.clockOutTime,
                    workDuration: record.workDuration,
                    formattedWorkDuration: record.formattedWorkDuration,
                })),
            },
        });

    } catch (error) {
        next(error);
    }
};

export const getInProgressProjectsService = async (req, res, next) => {
    try {
        const userId = req.user.id;
        console.log('getInProgressProjectsService called by user:', userId);

        // Verify user is custom or fabricator
        const user = await User.findById(userId);
        console.log('User found:', user ? { id: user._id, role: user.role, name: user.name } : 'User not found');

        if (!user || !(user.role === 'fabricator' || user.role === 'custom')) {
            console.log('Access denied for user role:', user?.role);
            return res.status(httpStatus.FORBIDDEN).json({
                status: 0,
                message: 'Access denied. Only fabricators and custom users can access this endpoint.',
            });
        }

        // Get in-progress projects assigned to the current user through sitework assignments
        console.log('Searching for projects with status: inprogress assigned to user through sitework:', userId);

        // 1. Find all siteworks where user is assigned
        const siteworks = await Sitework.find({ "assignedUsers.user": userId })
            .select('project name')
            .sort({ createdAt: -1 });

        console.log('Found siteworks for user:', siteworks.length, siteworks);

        const projectIds = [...new Set(siteworks.map(sw => sw.project.toString()))];
        console.log('Project IDs from siteworks:', projectIds);

        if (projectIds.length === 0) {
            console.log('No projects found through sitework assignments');
            return res.status(httpStatus.OK).json({
                status: 1,
                message: 'No assigned projects found',
                data: [],
            });
        }

        // 2. Get in-progress projects from those project IDs
        const projects = await Project.find({
            _id: { $in: projectIds },
            status: 'inprogress'
        }).select('_id projectName projectCode status').sort({ projectName: 1 });

        // 3. Get siteworks for each project
        const projectsWithSiteworks = await Promise.all(projects.map(async (project) => {
            const projectSiteworks = await Sitework.find({
                project: project._id,
                'assignedUsers.user': userId
            }).select('_id name description status startDate endDate').sort({ name: 1 });
            
            return {
                ...project.toObject(),
                siteworks: projectSiteworks
            };
        }));

        console.log('Found assigned in-progress projects with siteworks:', projectsWithSiteworks.length, projectsWithSiteworks);

        res.status(httpStatus.OK).json({
            status: 1,
            message: 'In-progress projects with siteworks fetched successfully',
            data: projectsWithSiteworks,
        });

    } catch (error) {
        console.error('Error in getInProgressProjectsService:', error);
        next(error);
    }
};

// Admin: Get workers assigned to a project (via siteworks) with today's clock-in status
export const getProjectWorkersStatusService = async (req, res, next) => {
    try {
        const { projectId } = req.params;
        const requester = req.user;

        // Validate project exists
        const project = await Project.findById(projectId).select('_id projectName status');
        if (!project) {
            throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
        }

        // Get all siteworks for the project and gather assigned users
        const siteworks = await Sitework.find({ project: projectId }).select('assignedUsers');
        const assignedUserEntries = siteworks.flatMap(sw => sw.assignedUsers || []);

        if (assignedUserEntries.length === 0) {
            return res.status(httpStatus.OK).json({ status: 1, message: 'No assigned workers for this project', data: [] });
        }

        // Aggregate per user: amounts and assignment counts
        const perUserAggregation = new Map();
        for (const entry of assignedUserEntries) {
            const userId = entry.user?.toString();
            if (!userId) continue;
            const existing = perUserAggregation.get(userId) || { assignmentAmountTotal: 0, perDayAmountAvg: 0, assignments: 0 };
            existing.assignmentAmountTotal += entry.assignmentAmount || 0;
            // For perDayAmount, keep the latest non-null or average; we'll average over assignments where set
            if (typeof entry.perDayAmount === 'number') {
                existing.perDayAmountSum = (existing.perDayAmountSum || 0) + entry.perDayAmount;
                existing.perDayAmountCount = (existing.perDayAmountCount || 0) + 1;
            }
            existing.assignments += 1;
            perUserAggregation.set(userId, existing);
        }

        const userIds = Array.from(perUserAggregation.keys());

        // Fetch basic user info
        const users = await User.find({ _id: { $in: userIds } }).select('_id name email role phone');
        const userMap = new Map(users.map(u => [u._id.toString(), u]));

        // Build today date range
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Fetch today attendance records for these users on this project
        const todaysAttendance = await Attendance.find({
            fabricator: { $in: userIds },
            project: projectId,
            clockInTime: { $gte: today, $lt: tomorrow },
        }).select('_id fabricator status clockInTime clockOutTime sitework siteworkName').populate('sitework', 'name description status');

        const attendanceMap = new Map();
        for (const rec of todaysAttendance) {
            attendanceMap.set(rec.fabricator.toString(), rec);
        }

        // Compose response list
        const data = userIds.map(userId => {
            const agg = perUserAggregation.get(userId) || {};
            const u = userMap.get(userId);
            const att = attendanceMap.get(userId);
            const perDayAmountAvg = agg.perDayAmountCount ? (agg.perDayAmountSum || 0) / agg.perDayAmountCount : 0;
            return {
                userId,
                name: u?.name || '',
                email: u?.email || '',
                role: u?.role || '',
                phone: u?.phone || '',
                assignments: agg.assignments || 0,
                assignmentAmountTotal: Math.round((agg.assignmentAmountTotal || 0) * 100) / 100,
                perDayAmountAvg: Math.round((perDayAmountAvg || 0) * 100) / 100,
                isClockedIn: att ? att.status === 'clocked-in' : false,
                isClockedOut: att ? att.status === 'clocked-out' : false,
                clockInTime: att?.clockInTime || null,
                clockOutTime: att?.clockOutTime || null,
                attendanceId: att?._id || null,
                sitework: att?.sitework || null,
                siteworkName: att?.siteworkName || null,
            };
        }).sort((a, b) => a.name.localeCompare(b.name));

        return res.status(httpStatus.OK).json({
            status: 1,
            message: 'Project workers fetched successfully',
            data,
        });
    } catch (error) {
        next(error);
    }
};
