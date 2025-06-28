import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync.js';
import * as siteVisitService from '../services/siteVisit.service.js';
import ApiError from '../utils/ApiError.js';

export const scheduleSiteVisit = catchAsync(async (req, res) => {
    const { requirementId } = req.params;
    const visit = await siteVisitService.scheduleSiteVisit(requirementId, req.body);
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