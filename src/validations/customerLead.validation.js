import Joi from 'joi';
import { objectId } from './custom.validation.js';

const siteVisitSchema = Joi.object({
  siteEngineer: Joi.string().custom(objectId).required(),
  visitDate: Joi.date().required(),
  hasRequirementEditAccess: Joi.boolean().default(false),
});

const scpDataSchema = Joi.object({
  siteAddress: Joi.string().allow(''),
  googleLocationLink: Joi.string().uri({ allowRelative: false }).allow(''),
  siteType: Joi.string().allow(''),
  plotSize: Joi.string().allow(''),
  totalArea: Joi.string().allow(''),
  plinthStatus: Joi.string().allow(''),
  structureType: Joi.string().allow(''),
  numUnits: Joi.string().allow(null, ''),
  usageType: Joi.string().allow(''),
  avgStayDuration: Joi.string().allow(''),
  additionalFeatures: Joi.string().allow(''),
  designIdeas: Joi.string().allow(''),
  drawingStatus: Joi.string().allow(''),
  architectStatus: Joi.string().allow(''),
  roomRequirements: Joi.string().allow(''),
  tokenAdvance: Joi.string().allow(''),
  financing: Joi.string().allow(''),
  roadWidth: Joi.string().allow(''),
  targetCompletionDate: Joi.string().allow(''),
  siteEngineer: Joi.string().allow(null, ''), // Keep for backward compatibility
  siteVisitDate: Joi.date().allow(null, ''), // Keep for backward compatibility
  siteVisits: Joi.array().items(siteVisitSchema), // New field for multiple site visits
  scpRemarks: Joi.string().allow(''),
});

const requirementSchema = Joi.object({
  projectName: Joi.string().required().min(3),
  requirementType: Joi.string().allow(''),
  otherRequirement: Joi.string().allow(''),
  requirementDescription: Joi.string().allow(''),
  urgency: Joi.string().allow(''),
  budget: Joi.string().allow(''),
  scpData: scpDataSchema,
  imageUrlKeys: Joi.array().items(Joi.string()),
  videoUrlKeys: Joi.array().items(Joi.string()),
  voiceMessageUrlKeys: Joi.array().items(Joi.string()),
  sketchUrlKeys: Joi.array().items(Joi.string()),
});

export const createCustomerLead = {
  body: Joi.object().keys({
    leadSource: Joi.string().required(),
    customerName: Joi.string().required(),
    mobileNumber: Joi.string().required(),
    alternateContactNumber: Joi.string().allow(''),
    whatsappNumber: Joi.string().allow(''),
    email: Joi.string().email().allow(''),
    preferredLanguage: Joi.string().allow(''),
    state: Joi.string().allow(''),
    city: Joi.string().allow(''),
    googleLocationLink: Joi.string().uri({ allowRelative: false }).allow(''),
    requirements: Joi.array().items(requirementSchema).min(1).required(),
  }),
};

export const getCustomerLeads = {
  query: Joi.object().keys({
    customerName: Joi.string(),
    leadSource: Joi.string(),
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
    id: Joi.string().custom(objectId).required(),
  }),
  body: Joi.object()
    .keys({
      leadSource: Joi.string(),
      customerName: Joi.string(),
      mobileNumber: Joi.string(),
      alternateContactNumber: Joi.string().allow(''),
      whatsappNumber: Joi.string().allow(''),
      email: Joi.string().email().allow(''),
      preferredLanguage: Joi.string().allow(''),
      state: Joi.string().allow(''),
      city: Joi.string().allow(''),
      isActive: Joi.boolean(),
      requirements: Joi.forbidden(),
      googleLocationLink: Joi.forbidden(),
    })
    .min(1),
};

export const shareRequirement = {
  params: Joi.object().keys({
    leadId: Joi.string().custom(objectId).required(),
    requirementId: Joi.string().custom(objectId).required(),
  }),
  body: Joi.object().keys({
    userIds: Joi.array().items(Joi.string().custom(objectId)).min(1).required(),
  }),
}; 