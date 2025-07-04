import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync.js';
import * as siteVisitService from '../services/siteVisit.service.js';
import ApiError from '../utils/ApiError.js';
import pick from '../utils/pick.js';

export const getSiteVisits = catchAsync(async (req, res) => {
    const filter = pick(req.query, ['siteEngineer', 'project', 'status']);
    const options = pick(req.query, ['sortBy', 'limit', 'page']);
    const result = await siteVisitService.querySiteVisits(filter, options);
    res.send(result);
});

export const scheduleSiteVisit = catchAsync(async (req, res) => {
    const { requirementId } = req.params;
    const visit = await siteVisitService.scheduleSiteVisit(requirementId, req.body, req.user);
    res.status(httpStatus.CREATED).send(visit);
});

export const getSiteVisitsForRequirement = catchAsync(async (req, res) => {
    const { requirementId } = req.params;
    const visits = await siteVisitService.getSiteVisitsForRequirement(requirementId);
    res.send(visits);
});

export const getSiteVisitById = catchAsync(async (req, res) => {
    const visit = await siteVisitService.getSiteVisitById(req.params.visitId);
    if (!visit) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Site visit not found');
    }
    res.send(visit);
});

export const updateSiteVisit = catchAsync(async (req, res) => {
    const visit = await siteVisitService.updateSiteVisit(req.params.visitId, req.body);
    res.send(visit);
});

export const completeSiteVisit = catchAsync(async (req, res) => {
    const visit = await siteVisitService.completeSiteVisit(req.params.visitId);
    res.send(visit);
});

export const approveSiteVisit = catchAsync(async (req, res) => {
    const updatedRequirement = await siteVisitService.approveSiteVisit(req.params.visitId, req.user.id);
    res.send(updatedRequirement);
});

export const addDocumentsToSiteVisit = catchAsync(async (req, res) => {
    const visit = await siteVisitService.addDocumentsToSiteVisit(req.params.visitId, req.body, req.user);
    res.send({
        status: 1,
        message: 'Documents added successfully',
        data: visit,
    });
});

export const getSiteVisitDocuments = catchAsync(async (req, res) => {
    const result = await siteVisitService.getSiteVisitDocuments(req.params.visitId, req.user, req.query);
    res.status(httpStatus.OK).send({
        status: 1,
        message: 'Documents fetched successfully',
        data: result,
    });
});

export const reviewDocument = catchAsync(async (req, res) => {
    const { visitId, documentId } = req.params;
    const visit = await siteVisitService.reviewSiteVisitDocument(visitId, documentId, req.body, req.user);
    res.send(visit);
});

export const addRemark = catchAsync(async (req, res) => {
    const { visitId } = req.params;
    const visit = await siteVisitService.addRemarkToSiteVisit(visitId, req.body, req.user);
    res.send(visit);
}); 