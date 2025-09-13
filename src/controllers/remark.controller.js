import httpStatus from 'http-status';
import pick from '../utils/pick.js';
import ApiError from '../utils/ApiError.js';
import catchAsync from '../utils/catchAsync.js';
import { remarkService } from '../services/index.js';

const createRemark = catchAsync(async (req, res) => {
    const remarkBody = {
        ...req.body,
        addedBy: req.user.id,
        addedByModel: req.user.role === 'admin' ? 'Admin' : 'User'
    };
    
    const remark = await remarkService.createRemark(remarkBody);
    res.status(httpStatus.CREATED).send({
        status: 1,
        message: 'Remark created successfully',
        data: remark
    });
});

const getRemarks = catchAsync(async (req, res) => {
    const filter = { projectId: req.params.projectId };
    const options = pick(req.query, ['page', 'limit', 'sortBy', 'sortOrder']);
    
    const result = await remarkService.getRemarksByProjectId(filter, options);
    res.send({
        status: 1,
        message: 'Remarks retrieved successfully',
        ...result
    });
});

const getRemark = catchAsync(async (req, res) => {
    const remark = await remarkService.getRemarkById(req.params.remarkId);
    res.send({
        status: 1,
        message: 'Remark retrieved successfully',
        data: remark
    });
});

const updateRemark = catchAsync(async (req, res) => {
    const remark = await remarkService.updateRemarkById(req.params.remarkId, req.body);
    res.send({
        status: 1,
        message: 'Remark updated successfully',
        data: remark
    });
});

const deleteRemark = catchAsync(async (req, res) => {
    await remarkService.deleteRemarkById(req.params.remarkId);
    res.send({
        status: 1,
        message: 'Remark deleted successfully'
    });
});

export {
    createRemark,
    getRemarks,
    getRemark,
    updateRemark,
    deleteRemark
};
