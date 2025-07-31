import Joi from 'joi';
import { objectId } from './custom.validation.js';

export const getWalletTransactions = {
    query: Joi.object().keys({
        userName: Joi.string().description('Filter by user name (case-insensitive)'),
        projectName: Joi.string().description('Filter by project name (case-insensitive)'),
        type: Joi.string().valid('SITE_ENGINEER_PAYMENT', 'ARCHITECT_PAYMENT', 'PROCURERMENT_PAYMENT').description('Filter by transaction type'),
        userId: Joi.string().custom(objectId).description('Filter by user ID'),
        project: Joi.string().custom(objectId).description('Filter by project ID'),
        minAmount: Joi.number().min(0).description('Minimum amount filter'),
        maxAmount: Joi.number().min(0).description('Maximum amount filter'),
        startDate: Joi.date().description('Start date for date range filter'),
        endDate: Joi.date().description('End date for date range filter'),
        sortBy: Joi.string(),
        limit: Joi.number().integer(),
        page: Joi.number().integer(),
    }),
};

export const getWalletTransaction = {
    params: Joi.object().keys({
        transactionId: Joi.string().custom(objectId).required(),
    }),
};

export const createWalletTransaction = {
    body: Joi.object().keys({
        userId: Joi.string().custom(objectId).required(),
        type: Joi.string().valid('SITE_ENGINEER_PAYMENT', 'ARCHITECT_PAYMENT', 'PROCURERMENT_PAYMENT').required(),
        amount: Joi.number().positive().required(),
        currency: Joi.string().valid('INR', 'USD', 'EUR').default('INR'),
        project: Joi.string().custom(objectId).optional(),
        forDate: Joi.date().optional(),
        siteVisit: Joi.string().custom(objectId).optional(),
        requirement: Joi.string().custom(objectId).optional(),
        description: Joi.string().required().trim(),
        notes: Joi.string().allow('').trim(),
        createdBy: Joi.string().custom(objectId).required(),
        createdByModel: Joi.string().valid('Admin', 'User').required(),
    }),
};

export const updateWalletTransaction = {
    params: Joi.object().keys({
        transactionId: Joi.string().custom(objectId).required(),
    }),
    body: Joi.object()
        .keys({
            amount: Joi.number().positive(),
            currency: Joi.string().valid('INR', 'USD', 'EUR'),
            description: Joi.string().trim(),
            notes: Joi.string().allow('').trim(),
        })
        .min(1),
};

export const deleteWalletTransaction = {
    params: Joi.object().keys({
        transactionId: Joi.string().custom(objectId).required(),
    }),
};

export const getUserTransactions = {
    params: Joi.object().keys({
        userId: Joi.string().custom(objectId).required(),
    }),
    query: Joi.object().keys({
        sortBy: Joi.string(),
        limit: Joi.number().integer(),
        page: Joi.number().integer(),
    }),
};

export const getProjectTransactions = {
    params: Joi.object().keys({
        projectId: Joi.string().custom(objectId).required(),
    }),
    query: Joi.object().keys({
        sortBy: Joi.string(),
        limit: Joi.number().integer(),
        page: Joi.number().integer(),
    }),
};

export const getMyWalletTransactions = {
    query: Joi.object().keys({
        sortBy: Joi.string(),
        limit: Joi.number().integer(),
        page: Joi.number().integer(),
    }),
};

export const getUserTotalReceivedAmount = {
    params: Joi.object().keys({
        userId: Joi.string().custom(objectId).required(),
    }),
    query: Joi.object().keys({
        project: Joi.string().custom(objectId).description('Filter by project ID'),
        startDate: Joi.date().description('Start date for date range filter'),
        endDate: Joi.date().description('End date for date range filter'),
    }),
};

export const getMyTotalReceivedAmount = {
    query: Joi.object().keys({
        type: Joi.string().valid('SITE_ENGINEER_PAYMENT', 'ARCHITECT_PAYMENT', 'PROCURERMENT_PAYMENT').description('Filter by transaction type'),
        project: Joi.string().custom(objectId).description('Filter by project ID'),
        startDate: Joi.date().description('Start date for date range filter'),
        endDate: Joi.date().description('End date for date range filter'),
    }),
}; 