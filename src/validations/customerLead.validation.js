import Joi from 'joi';
import { password, objectId } from './custom.validation.js';
import { STATUS_VALUES, STATUS_ENUM } from '../config/enums/status.enum.js';

const fileSchema = Joi.object({
  fileType: Joi.string().required(),
  key: Joi.string().required(),
  originalName: Joi.string(),
  uploadedAt: Joi.date(),
});

const scpDataSchema = Joi.object({
  siteAddress: Joi.string().allow('', null),
  googleLocationLink: Joi.string().uri().allow('', null),
  siteType: Joi.string().allow('', null),
  plotSize: Joi.string().allow('', null),
  totalArea: Joi.string().allow('', null),
  plinthStatus: Joi.string().allow('', null),
  structureType: Joi.string().allow('', null),
  numUnits: Joi.number().allow('', null),
  usageType: Joi.string().allow('', null),
  avgStayDuration: Joi.string().allow('', null),
  additionalFeatures: Joi.string().allow('', null),
  designIdeas: Joi.string().allow('', null),
  drawingStatus: Joi.string().allow('', null),
  architectStatus: Joi.string().allow('', null),
  roomRequirements: Joi.string().allow('', null),
  tokenAdvance: Joi.boolean().allow(null, ''),
  financing: Joi.boolean().allow(null, ''),
  roadWidth: Joi.string().allow('', null),
  targetCompletionDate: Joi.date().allow(null, ''),
  siteVisitDate: Joi.date().allow(null, ''),
  siteVisitStartDate: Joi.date().allow(null, ''),
  siteVisitEndDate: Joi.date().allow(null, ''),
  assignmentAmount: Joi.number().allow(null),
  siteEngineers: Joi.array().items(Joi.object({
    userId: Joi.string().required(),
    name: Joi.string(),
    hasRequirementEditAccess: Joi.boolean(),
  })),
  siteVisits: Joi.array().items(Joi.object({
    siteEngineer: Joi.string().required(),
    visitDate: Joi.date(),
    visitStartDate: Joi.date(),
    visitEndDate: Joi.date(),
    hasRequirementEditAccess: Joi.boolean(),
    assignmentAmount: Joi.number(),
  })),
  assignedSiteEngineer: Joi.string().allow('', null), // Legacy field
  scpRemarks: Joi.string().allow('', null),
});

const requirementBaseSchema = {
  id: Joi.any(), // Frontend-only temporary ID
  otherRequirement: Joi.string().allow('', null),
  requirementDescription: Joi.string().allow('', null),
  urgency: Joi.string().allow('', null),
  budget: Joi.string().allow('', null),
  scpData: scpDataSchema.optional(),
  selectedScpUser: Joi.string().allow('', null),
  sendToScp: Joi.boolean(),
  imageUrlKeys: Joi.array().items(Joi.string()),
  videoUrlKeys: Joi.array().items(Joi.string()),
  voiceMessageUrlKeys: Joi.array().items(Joi.string()),
  sketchUrlKeys: Joi.array().items(Joi.string()),
};

const requirementSchema = Joi.object({
  ...requirementBaseSchema,
  projectName: Joi.string().required(),
  requirementType: Joi.string().required(),
});

const requirementSchemaDraft = Joi.object({
  ...requirementBaseSchema,
  projectName: Joi.string().allow('', null),
  requirementType: Joi.string().allow('', null),
});

export const createCustomerLead = {
  body: Joi.object({
    status: Joi.string().valid(...STATUS_VALUES).required(),

    leadSource: Joi.string().when('status', {
        is: STATUS_ENUM.DRAFT,
        then: Joi.string().allow('', null),
        otherwise: Joi.string().required(),
    }),
    customerName: Joi.string().when('status', {
        is: STATUS_ENUM.DRAFT,
        then: Joi.string().allow('', null),
        otherwise: Joi.string().required(),
    }),
    mobileNumber: Joi.string().when('status', {
      is: STATUS_ENUM.DRAFT,
      then: Joi.string().allow('', null),
      otherwise: Joi.string().required(),
    }),
    alternateContactNumber: Joi.string().allow('', null),
    whatsappNumber: Joi.string().allow('', null),
    email: Joi.string().email().allow('', null),
    preferredLanguage: Joi.array().items(Joi.string()),
    state: Joi.string().allow('', null),
    city: Joi.string().allow('', null),
    townVillage: Joi.string().allow('', null),
    googleLocationLink: Joi.string().uri().allow('', null),
    password: Joi.string().custom(password),
    confirmPassword: Joi.string().valid(Joi.ref('password')).when('password', {
        is: Joi.exist(),
        then: Joi.required(),
    }),
    status: Joi.string().valid(...STATUS_VALUES),
    requirements: Joi.when('status', {
      is: STATUS_ENUM.DRAFT,
      then: Joi.array().items(requirementSchemaDraft).min(1),
      otherwise: Joi.array().items(requirementSchema).min(1),
    }),
  }).when(Joi.object({ status: Joi.string().valid(STATUS_ENUM.DRAFT).required() }).unknown(), {
    then: Joi.object({
        email: Joi.string().email().optional(),
        mobileNumber: Joi.string().optional(),
        customerName: Joi.string().optional(),
        state: Joi.string().optional(),
        city: Joi.string().optional(),
        townVillage: Joi.string().optional(),
        requirements: Joi.array().items(requirementSchema).optional()
    })
})
};

export const getCustomerLeads = {
  query: Joi.object().keys({
    search: Joi.string(),
    customerName: Joi.string(),
    leadSource: Joi.string(),
    mobileNumber: Joi.string(),
    email: Joi.string(),
    state: Joi.string(),
    city: Joi.string(),
    sortBy: Joi.string(),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
    isActive: Joi.boolean(),
  }),
};

export const getCustomerLead = {
  params: Joi.object().keys({
    id: Joi.string().custom(objectId).required(),
  }),
};

export const updateCustomerLead = {
  params: Joi.object().keys({
        id: Joi.string().required().custom(objectId),
    }),
    body: Joi.object().keys({
        leadSource: Joi.string(),
        customerName: Joi.string(),
        mobileNumber: Joi.string(),
        alternateContactNumber: Joi.string().allow('', null),
        whatsappNumber: Joi.string().allow('', null),
        email: Joi.string().email(),
        preferredLanguage: Joi.array().items(Joi.string()),
        state: Joi.string(),
        city: Joi.string(),
        townVillage: Joi.string().allow('', null),
        status: Joi.string().valid(...STATUS_VALUES),
        googleLocationLink: Joi.string().uri().allow('', null),
    }).min(1),
};

export const updateCustomerLeadStatus = {
  params: Joi.object().keys({
    id: Joi.string().required().custom(objectId),
  }),
  body: Joi.object().keys({
    status: Joi.string().valid(...STATUS_VALUES).required(),
  }),
};

export const shareRequirementWithUsers = {
  params: Joi.object({
    leadId: Joi.string().required(),
    requirementId: Joi.string().required(),
  }),
  body: Joi.object({
    userIds: Joi.array().items(Joi.string()).required(),
  }),
};

export const shareRequirementWithScpUsers = {
  params: Joi.object({
    leadId: Joi.string().required(),
    requirementId: Joi.string().required(),
  }),
  body: Joi.object({
    scpUserIds: Joi.array().items(Joi.string()).min(1).required(),
  }),
};

export const updateScpData = {
  params: Joi.object({
    leadId: Joi.string().required(),
    requirementId: Joi.string().required(),
  }),
  body: Joi.object({
    scpData: Joi.object().required(),
    files: Joi.array().items(Joi.object({
      fileType: Joi.string().required(),
        key: Joi.string().required(),
      originalName: Joi.string(),
    })).optional(),
  }),
};

export const getScpUserAssignedRequirements = {
  query: Joi.object().keys({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    sortBy: Joi.string().valid('sharedAt:asc', 'sharedAt:desc', 'updatedAt:asc', 'updatedAt:desc', 'projectName:asc', 'projectName:desc', 'customerName:asc', 'customerName:desc').default('sharedAt:desc'),
    search: Joi.string().allow(''),
    projectName: Joi.string().allow(''),
    customerName: Joi.string().allow(''),
    requirementType: Joi.string().allow(''),
    status: Joi.string().valid('pending', 'updated', 'all').default('all'),
  }),
};

export const deleteFile = {
  params: Joi.object({
    leadId: Joi.string().required(),
    requirementId: Joi.string().required(),
    fileKey: Joi.string().required(),
  }),
};

export const deleteMultipleFiles = {
  params: Joi.object({
    leadId: Joi.string().required(),
    requirementId: Joi.string().required(),
  }),
  body: Joi.object({
    fileKeys: Joi.array().items(Joi.string()).min(1).required(),
  }),
};

export default {
  createCustomerLead,
  updateCustomerLead,
  updateCustomerLeadStatus,
  shareRequirementWithUsers,
  shareRequirementWithScpUsers,
  updateScpData,
  getScpUserAssignedRequirements,
  deleteMultipleFiles,
  deleteFile,
}; 