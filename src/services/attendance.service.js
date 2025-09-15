import httpStatus from 'http-status';
import Attendance from '../models/attendance.model.js';
import User from '../models/user.model.js';
import storage from '../factory/storage.factory.js';
import ApiError from '../utils/ApiError.js';
import logger from '../config/logger.js';

export const clockInService = async (req, session) => {
    const { clockInTime, photoKey } = req.body;
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

        // Create attendance record - store client time as is (it's already in the correct timezone)
        const attendance = new Attendance({
            fabricator: fabricatorId,
            fabricatorName: fabricator.name,
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

        // Populate fabricator details
        await attendance.populate('fabricator', 'name email role');

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
    const { clockOutTime, photoKey } = req.body;
    const fabricatorId = req.user.id;

    try {
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

        const attendance = await Attendance.findOne({
            fabricator: fabricatorId,
            clockInTime: {
                $gte: today,
                $lt: tomorrow,
            },
        }).session(session);

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

        // Populate fabricator details
        await attendance.populate('fabricator', 'name email role');

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
        const { page = 1, limit = 10, fabricatorId, startDate, endDate } = req.query;
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
            populate: {
                path: 'fabricator',
                select: 'name email role',
            },
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

        // Find today's active attendance
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const attendance = await Attendance.findOne({
            fabricator: userId,
            clockInTime: {
                $gte: today,
                $lt: tomorrow,
            },
            status: 'clocked-in',
        }).populate('fabricator', 'name email role');

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
        const { fabricatorId, month, year } = req.query;
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

        // Get attendance records for the month
        const attendanceRecords = await Attendance.find({
            fabricator: targetFabricatorId,
            clockInTime: {
                $gte: startDate,
                $lte: endDate,
            },
            status: 'clocked-out',
        });

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
