import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync.js';
import * as clientProposalService from '../services/clientProposal.service.js';
import pick from '../utils/pick.js';

export const createClientProposal = catchAsync(async (req, res) => {
    const clientProposal = await clientProposalService.createClientProposal(req.body, req.user.id);
    res.status(httpStatus.CREATED).send({
        status: 1,
        message: 'Client proposal created successfully',
        data: clientProposal,
    });
});

export const getClientProposals = catchAsync(async (req, res) => {
    const filter = pick(req.query, ['project', 'customerInfo.name', 'proposalFor', 'projectLocation', 'projectType', 'status', 'createdBy']);
    const options = pick(req.query, ['sortBy', 'limit', 'page']);
    const result = await clientProposalService.queryClientProposals(filter, options);
    res.status(httpStatus.OK).send({
        status: 1,
        message: 'Client proposals fetched successfully',
        data: result,
    });
});

export const getClientProposal = catchAsync(async (req, res) => {
    const clientProposal = await clientProposalService.getClientProposalById(req.params.clientProposalId);
    res.status(httpStatus.OK).send({
        status: 1,
        message: 'Client proposal fetched successfully',
        data: clientProposal,
    });
});

export const updateClientProposal = catchAsync(async (req, res) => {
    const clientProposal = await clientProposalService.updateClientProposalById(
        req.params.clientProposalId,
        req.body,
        req.user.id
    );
    res.status(httpStatus.OK).send({
        status: 1,
        message: 'Client proposal updated successfully',
        data: clientProposal,
    });
});

export const updateClientProposalStatus = catchAsync(async (req, res) => {
    const { status } = req.body;
    const clientProposal = await clientProposalService.updateClientProposalStatus(
        req.params.clientProposalId,
        status,
        req.user.id
    );
    res.status(httpStatus.OK).send({
        status: 1,
        message: `Client proposal status updated to ${status} successfully`,
        data: clientProposal,
    });
});

export const createNewVersion = catchAsync(async (req, res) => {
    const clientProposal = await clientProposalService.createNewVersion(
        req.params.clientProposalId,
        req.body,
        req.user.id
    );
    res.status(httpStatus.CREATED).send({
        status: 1,
        message: 'New version of client proposal created successfully',
        data: clientProposal,
    });
});

export const deleteClientProposal = catchAsync(async (req, res) => {
    await clientProposalService.deleteClientProposalById(req.params.clientProposalId, req.user.id);
    res.status(httpStatus.NO_CONTENT).send();
});

export const getMyClientProposals = catchAsync(async (req, res) => {
    const options = pick(req.query, ['sortBy', 'limit', 'page']);
    const result = await clientProposalService.getClientProposalsByUser(req.user.id, options);
    res.status(httpStatus.OK).send({
        status: 1,
        message: 'My client proposals fetched successfully',
        data: result,
    });
}); 