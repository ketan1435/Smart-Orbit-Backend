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
  numUnits: Joi.string().allow('', null),
  usageType: Joi.string().allow('', null),
  avgStayDuration: Joi.string().allow('', null),
  additionalFeatures: Joi.string().allow('', null),
  designIdeas: Joi.string().allow('', null),
  drawingStatus: Joi.string().allow('', null),
  architectStatus: Joi.string().allow('', null),
  roomRequirements: Joi.string().allow('', null),
  tokenAdvance: Joi.string().allow(null, ''),
  financing: Joi.string().allow(null, ''),
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
  projectName: Joi.string().required(), // Only projectName is required for draft
  requirementType: Joi.string().allow('', null), // requirementType is optional for draft
});

export const createCustomerLead = {
  body: Joi.object({
    status: Joi.string().valid(...STATUS_VALUES).optional(), // Make status optional, backend will set default

    // For draft status: only email and projectName are required
    // For inprogress status (default): all fields are required
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
    email: Joi.string().email().required(), // Email is always required
    preferredLanguage: Joi.array().items(Joi.string()),
    state: Joi.string().allow('', null),
    city: Joi.string().allow('', null),
    townVillage: Joi.string().allow('', null),
    town: Joi.string().allow('', null), // Allow both town and townVillage for compatibility
    googleLocationLink: Joi.string().uri().allow('', null),
    password: Joi.string().custom(password),

    requirements: Joi.when('status', {
      is: STATUS_ENUM.DRAFT,
      then: Joi.array().items(requirementSchemaDraft).min(1), // Only projectName required in requirements
      otherwise: Joi.array().items(requirementSchema).min(1), // All fields required in requirements
    }),
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
    town: Joi.string().allow('', null), // Allow both town and townVillage for compatibility
    status: Joi.string().valid(...STATUS_VALUES),
    googleLocationLink: Joi.string().uri().allow('', null),
    requirementsToUpdate: Joi.array().items(Joi.object({
      _id: Joi.string().required(),
      projectName: Joi.string(),
      requirementType: Joi.string(),
      otherRequirement: Joi.string().allow('', null),
      requirementDescription: Joi.string(),
      urgency: Joi.string().allow('', null),
      budget: Joi.string().allow('', null),
      scpData: Joi.object().allow(null),
      // Allow sharing fields during updates
      sendToScp: Joi.boolean(),
      selectedScpUser: Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string())).allow('', null),
    })).optional(),
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
    documentId: Joi.string().optional(),
    shouldSendToEngineer: Joi.boolean().optional(),
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

export const updateCustomerStatusWithCascade = {
  params: Joi.object().keys({
    id: Joi.string().required().custom(objectId),
  }),
  body: Joi.object().keys({
    status: Joi.string().valid(...STATUS_VALUES).required(),
  }),
};

export const recalculateCustomerStatus = {
  params: Joi.object().keys({
    id: Joi.string().required().custom(objectId),
  }),
};

export const getCustomerStatusSummary = {
  params: Joi.object().keys({
    id: Joi.string().required().custom(objectId),
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
  updateCustomerStatusWithCascade,
  recalculateCustomerStatus,
  getCustomerStatusSummary,
}; 