import Joi from 'joi';
import { objectId } from './custom.validation.js';

const createClientProposal = {
    body: Joi.object().keys({
        project: Joi.string().required(),
        customerInfo: Joi.object().keys({
            name: Joi.string().required(),
            email: Joi.string().email().optional(),
            phone: Joi.string().optional(),
            address: Joi.string().optional(),
        }).required(),
        proposalFor: Joi.string().optional(),
        projectLocation: Joi.string().optional(),
        projectType: Joi.string().optional(),
        unitCost: Joi.string().optional(),
        manufacturingSupply: Joi.string().optional(),
        projectOverview: Joi.string().optional(),
        cottageSpecifications: Joi.string().optional(),
        materialDetails: Joi.string().optional(),
        costBreakdown: Joi.string().optional(),
        paymentTerms: Joi.string().optional(),
        salesTerms: Joi.string().optional(),
        contactInformation: Joi.string().optional(),
        status: Joi.string().valid('draft', 'sent', 'approved', 'rejected', 'archived').optional(),
        version: Joi.number().integer().min(1).optional(),
    }),
};

const getClientProposals = {
    query: Joi.object().keys({
        project: Joi.string(),
        'customerInfo.name': Joi.string(),
        proposalFor: Joi.string(),
        projectLocation: Joi.string(),
        projectType: Joi.string(),
        status: Joi.string().valid('draft', 'sent', 'approved', 'rejected', 'archived'),
        createdBy: Joi.string().custom(objectId),
        sortBy: Joi.string(),
        limit: Joi.number().integer(),
        page: Joi.number().integer(),
    }),
};

const getClientProposal = {
    params: Joi.object().keys({
        clientProposalId: Joi.string().custom(objectId).required(),
    }),
};

const updateClientProposal = {
    params: Joi.object().keys({
        clientProposalId: Joi.string().custom(objectId).required(),
    }),
    body: Joi.object()
        .keys({
            project: Joi.string(),
            customerInfo: Joi.object().keys({
                name: Joi.string(),
                email: Joi.string().email(),
                phone: Joi.string(),
                address: Joi.string(),
            }),
            proposalFor: Joi.string(),
            projectLocation: Joi.string(),
            projectType: Joi.string(),
            unitCost: Joi.string(),
            manufacturingSupply: Joi.string(),
            projectOverview: Joi.string(),
            cottageSpecifications: Joi.string(),
            materialDetails: Joi.string(),
            costBreakdown: Joi.string(),
            paymentTerms: Joi.string(),
            salesTerms: Joi.string(),
            contactInformation: Joi.string(),
            status: Joi.string().valid('draft', 'sent', 'approved', 'rejected', 'archived'),
            version: Joi.number().integer().min(1),
        })
        .min(1),
};

const updateClientProposalStatus = {
    params: Joi.object().keys({
        clientProposalId: Joi.string().custom(objectId).required(),
    }),
    body: Joi.object().keys({
        status: Joi.string().valid('draft', 'sent', 'approved', 'rejected', 'archived').required(),
    }),
};

const createNewVersion = {
    params: Joi.object().keys({
        clientProposalId: Joi.string().custom(objectId).required(),
    }),
    body: Joi.object().keys({
        project: Joi.string(),
        customerInfo: Joi.object().keys({
            name: Joi.string(),
            email: Joi.string().email(),
            phone: Joi.string(),
            address: Joi.string(),
        }),
        proposalFor: Joi.string(),
        projectLocation: Joi.string(),
        projectType: Joi.string(),
        unitCost: Joi.string(),
        manufacturingSupply: Joi.string(),
        projectOverview: Joi.string(),
        cottageSpecifications: Joi.string(),
        materialDetails: Joi.string(),
        costBreakdown: Joi.string(),
        paymentTerms: Joi.string(),
        salesTerms: Joi.string(),
        contactInformation: Joi.string(),
    }),
};

const deleteClientProposal = {
    params: Joi.object().keys({
        clientProposalId: Joi.string().custom(objectId).required(),
    }),
};

export default {
    createClientProposal,
    getClientProposals,
    getClientProposal,
    updateClientProposal,
    updateClientProposalStatus,
    createNewVersion,
    deleteClientProposal,
}; 