import Joi from 'joi';
import { objectId } from './custom.validation.js';

export const updateCustomerLead = {
  params: Joi.object().keys({
    id: Joi.string().custom(objectId).required(),
  }),
  body: Joi.object()
    .keys({
      leadSource: Joi.string(),
      customerName: Joi.string(),
      mobileNumber: Joi.string(),
      whatsappNumber: Joi.string(),
      email: Joi.string().email(),
      preferredLanguage: Joi.string(),
      state: Joi.string(),
      city: Joi.string(),
      googleLocationLink: Joi.string().uri(),
      requirementType: Joi.string(),
      otherRequirement: Joi.string(),
      requirementDescription: Joi.string(),
      urgency: Joi.string(),
      budget: Joi.string(),
      hasDrawing: Joi.boolean(),
      needsArchitect: Joi.boolean(),
      requestSiteVisit: Joi.boolean(),
      isActive: Joi.boolean(),
    })
    .min(1), // Ensure at least one field is being updated
}; 