import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync.js';
import { createSiteworkService, updateSiteworkService, getSiteworksByProjectService, addSiteworkDocumentService, approveOrRejectSiteworkDocumentService, getSiteworkDocumentsService } from '../services/sitework.service.js';
import ApiError from '../utils/ApiError.js';

export const createSitework = catchAsync(async (req, res) => {
    const sitework = await createSiteworkService(req.body, req.user);
    res.status(httpStatus.CREATED).json({
        status: 1,
        message: 'Sitework created successfully',
        data: sitework
    });
});

export const updateSitework = catchAsync(async (req, res) => {
    const sitework = await updateSiteworkService(req.params.id, req.body, req.user);
    res.status(httpStatus.OK).json({
        status: 1,
        message: 'Sitework updated successfully',
        data: sitework
    });
});

export const getSiteworksByProject = catchAsync(async (req, res) => {
    const siteworks = await getSiteworksByProjectService(req.params.projectId, req.user);
    res.status(httpStatus.OK).json({
        status: 1,
        message: 'Siteworks fetched successfully',
        data: siteworks
    });
});

export const addSiteworkDocument = catchAsync(async (req, res) => {
    const newDoc = await addSiteworkDocumentService(req.params.siteworkId, req.body, req.user);
    res.status(httpStatus.CREATED).json({
        status: 1,
        message: 'Sitework document added successfully',
        data: newDoc
    });
});

export const approveOrRejectSiteworkDocument = catchAsync(async (req, res) => {
    const doc = await approveOrRejectSiteworkDocumentService(
        req.params.siteworkId,
        req.params.docId,
        req.body,
        req.user
    );
    res.status(httpStatus.OK).json({
        status: 1,
        message: 'Document status updated successfully',
        data: doc
    });
});

export const getSiteworkDocuments = catchAsync(async (req, res) => {
    const { siteworkId } = req.params;
    const user = req.user;
    const documents = await getSiteworkDocumentsService(siteworkId, user);
    res.status(200).json({ status: 1, message: 'Sitework documents fetched successfully', data: documents });
}); 