import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync.js';
import * as projectService from '../services/project.service.js';
import * as siteVisitService from '../services/siteVisit.service.js';
import pick from '../utils/pick.js';
import { assignSiteEngineersService, getAssignedSiteEngineersService, getAssignedProjectsForSiteEngineerService, getProjectsForUserAssignedInSiteworkService } from '../services/project.service.js';
import ApiError from '../utils/ApiError.js';

// Controller methods for Project will be added here.
// For example:
// const getProjects = catchAsync(async (req, res) => {
//   const filter = pick(req.query, ['name', 'status']);
//   const options = pick(req.query, ['sortBy', 'limit', 'page']);
//   const result = await projectService.queryProjects(filter, options);
//   res.send(result);
// });

export const getProjects = catchAsync(async (req, res) => {
    const filter = pick(req.query, ['projectName', 'status', 'projectCode', 'customerName', 'requirementType']);
    const options = pick(req.query, ['sortBy', 'limit', 'page']);
    const result = await projectService.queryProjects(filter, options);
    res.status(httpStatus.OK).send({ status: 1, message: 'Projects fetched successfully.', data: result });
});

export const getProjectSiteVisits = catchAsync(async (req, res) => {
    const filter = pick(req.query, ['status', 'siteEngineer']);
    filter.project = req.params.projectId;
    const options = pick(req.query, ['sortBy', 'limit', 'page']);
    const result = await siteVisitService.querySiteVisits(filter, options);
    res.send(result);
});

export const submitProposal = catchAsync(async (req, res) => {
    const project = await projectService.addArchitectProposal(req.params.projectId, req.user, req.body);
    res.status(httpStatus.CREATED).send(project);
});

export const acceptProposal = catchAsync(async (req, res) => {
    const { projectId, proposalId } = req.params;
    const project = await projectService.acceptArchitectProposal(projectId, proposalId, req.user);
    res.send(project);
});

export const getProposalsForProject = catchAsync(async (req, res) => {
    const proposals = await projectService.getProposalsForProject(req.params.projectId);
    res.send(proposals);
});

export const submitArchitectDocument = async (req, session) => {
    const project = await projectService.submitArchitectDocument(req.params.projectId, req.user, req.body, session);
    return {
        status: httpStatus.CREATED,
        body: project,
        message: 'Document submitted successfully'
    };
};

export const getArchitectDocuments = catchAsync(async (req, res) => {
    const documents = await projectService.getArchitectDocuments(req.params.projectId);
    res.send(documents);
});

export const getProjectsForCustomer = catchAsync(async (req, res) => {
    const options = pick(req.query, ['sortBy', 'limit', 'page']);
    const result = await projectService.getProjectsForCustomer(req.user, options);
    res.status(httpStatus.OK).send({ status: 1, message: 'Your projects fetched successfully.', data: result });
});

export const getProjectsForArchitect = catchAsync(async (req, res) => {
    const options = pick(req.query, ['sortBy', 'limit', 'page']);
    const result = await projectService.getProjectsForArchitect(req.user, options);
    res.status(httpStatus.OK).send({ status: 1, message: 'Your projects fetched successfully.', data: result });
});

export const getMyProposals = catchAsync(async (req, res) => {
    const options = pick(req.query, ['sortBy', 'limit', 'page', 'status', 'projectName', 'startDate', 'endDate']);
    const result = await projectService.getMyProposals(req.user, options);
    res.status(httpStatus.OK).send({ status: 1, message: 'Your proposals fetched successfully.', data: result });
});

export const deleteMyProposal = catchAsync(async (req, res) => {
    const result = await projectService.deleteMyProposal(req.params.proposalId, req.user);
    res.status(httpStatus.OK).send({ status: 1, message: 'Proposal deleted successfully.', data: result });
});

export const rejectProposal = catchAsync(async (req, res) => {
    const result = await projectService.rejectProposal(req.params.proposalId, req.user, req.body);
    res.status(httpStatus.OK).send({ status: 1, message: 'Proposal rejected successfully.', data: result });
});

export const getArchitectDocumentsForCustomer = catchAsync(async (req, res) => {
    const documents = await projectService.getArchitectDocumentsForCustomer(req.params.projectId, req.user);
    res.status(httpStatus.OK).send(documents);
});

export const reviewArchitectDocument = catchAsync(async (req, res) => {
    const project = await projectService.reviewArchitectDocument(
        req.params.projectId,
        req.params.documentId,
        req.body,
        req.user
    );
    res.send(project);
});

export const sendDocumentToCustomer = catchAsync(async (req, res) => {
    const project = await projectService.sendDocumentToCustomer(
        req.params.projectId,
        req.params.documentId,
        req.user
    );
    res.send(project);
});

export const customerReviewDocument = catchAsync(async (req, res) => {
    const project = await projectService.customerReviewDocument(
        req.params.projectId,
        req.params.documentId,
        req.body
    );
    res.send(project);
});

export const sendDocumentToProcurement = catchAsync(async (req, res) => {
    const project = await projectService.sendDocumentToProcurement(
        req.params.projectId,
        req.params.documentId,
        req.user
    );
    res.status(httpStatus.OK).send({
        status: 1,
        message: 'Document sent to procurement successfully.',
        data: project
    });
});

export const getApprovedDocumentsForProcurement = catchAsync(async (req, res) => {
    const filter = pick(req.query, ['projectName']);
    const options = pick(req.query, ['sortBy', 'limit', 'page']);
    const result = await projectService.getApprovedDocumentsForProcurement(filter, options);
    res.status(httpStatus.OK).send({
        status: 1,
        message: 'Approved documents for procurement fetched successfully.',
        data: result
    });
});

export const getProjectsForProcurement = catchAsync(async (req, res) => {
    const options = pick(req.query, ['sortBy', 'limit', 'page']);
    const result = await projectService.getProjectsForProcurement(req.user, options);
    res.status(httpStatus.OK).send({
        status: 1,
        message: 'Projects for procurement fetched successfully.',
        data: result
    });
});

export const getProjectDocumentsForProcurement = catchAsync(async (req, res) => {
    const result = await projectService.getProjectDocumentsForProcurement(req.params.projectId, req.user);
    res.status(httpStatus.OK).send({
        status: 1,
        message: 'Project documents for procurement fetched successfully.',
        data: result
    });
});

export const getProjectById = catchAsync(async (req, res) => {
    const project = await projectService.getProjectById(req.params.projectId);
    res.status(httpStatus.OK).send({ status: 1, message: 'Project fetched successfully.', data: project });
});

export const assignSiteEngineers = catchAsync(async (req, res) => {
    const { siteEngineerIds } = req.body;
    const project = await assignSiteEngineersService(req.params.projectId, siteEngineerIds);

    if (!project) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
    }

    res.status(httpStatus.OK).json({
        status: 1,
        message: 'Site engineers assigned successfully',
        data: project
    });
});

export const getAssignedSiteEngineers = catchAsync(async (req, res) => {
    const siteEngineers = await getAssignedSiteEngineersService(req.params.projectId);

    res.status(httpStatus.OK).json({
        status: 1,
        message: 'Assigned site engineers retrieved successfully',
        data: siteEngineers
    });
});

export const getMyAssignedProjects = catchAsync(async (req, res) => {
    const result = await getAssignedProjectsForSiteEngineerService(req.user.id, req.query);
    res.status(httpStatus.OK).json({
        status: 1,
        message: 'My assigned projects retrieved successfully',
        ...result
    });
});

export const getMySiteworkProjects = catchAsync(async (req, res) => {
    const result = await getProjectsForUserAssignedInSiteworkService(req.user.id, req.query);
    res.status(httpStatus.OK).json({
        status: 1,
        message: 'My sitework projects retrieved successfully',
        ...result
    });
});
