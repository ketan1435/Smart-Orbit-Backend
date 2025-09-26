import Joi from 'joi';

export const createService = {
  body: Joi.object().keys({
    name: Joi.string().required().trim(),
    description: Joi.string().required().trim(),
    category: Joi.string().valid('Project Management', 'Design', 'Procurement', 'Quality Control', 'Supervision', 'Equipment').default('Project Management'),
    status: Joi.string().valid('Active', 'Inactive', 'Draft').default('Active'),
    price: Joi.string().default('Contact for pricing'),
    duration: Joi.string().default('Flexible'),
  }),
};

export const getServices = {
  query: Joi.object().keys({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    search: Joi.string().allow(''),
    category: Joi.string().valid('Project Management', 'Design', 'Procurement', 'Quality Control', 'Supervision', 'Equipment'),
    status: Joi.string().valid('Active', 'Inactive', 'Draft'),
  }),
};

export const getServiceById = {
  params: Joi.object().keys({
    id: Joi.string().required(),
  }),
};

export const updateService = {
  params: Joi.object().keys({
    id: Joi.string().required(),
  }),
  body: Joi.object().keys({
    name: Joi.string().trim(),
    description: Joi.string().trim(),
    category: Joi.string().valid('Project Management', 'Design', 'Procurement', 'Quality Control', 'Supervision', 'Equipment'),
    status: Joi.string().valid('Active', 'Inactive', 'Draft'),
    price: Joi.string(),
    duration: Joi.string(),
  }).min(1),
};

export const deleteService = {
  params: Joi.object().keys({
    id: Joi.string().required(),
  }),
};

export const addServiceAttachment = {
  params: Joi.object().keys({
    serviceId: Joi.string().required(),
  }),
  body: Joi.object().keys({
    fileName: Joi.string().required(),
    fileType: Joi.string().required(),
    fileSize: Joi.number().required(),
    key: Joi.string().required(),
  }),
};

export const removeServiceAttachment = {
  params: Joi.object().keys({
    serviceId: Joi.string().required(),
    attachmentId: Joi.string().required(),
  }),
};
