import httpStatus from 'http-status';
import * as attendanceService from '../services/attendance.service.js';

export const clockIn = async (req, res, next, session) => {
    await attendanceService.clockInService(req, session);
};

export const clockOut = async (req, res, next, session) => {
    await attendanceService.clockOutService(req, session);
};

export const getAttendanceRecords = async (req, res, next) => {
    await attendanceService.getAttendanceRecordsService(req, res, next);
};

export const getCurrentAttendance = async (req, res, next) => {
    await attendanceService.getCurrentAttendanceService(req, res, next);
};

export const getAttendanceStats = async (req, res, next) => {
    await attendanceService.getAttendanceStatsService(req, res, next);
};
