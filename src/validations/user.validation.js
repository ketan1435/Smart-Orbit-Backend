import Joi from 'joi';
import { password, objectId } from './custom.validation.js';
import { roles } from '../config/roles.js';

export const createUser = {
  body: Joi.object().keys({
    email: Joi.string().required().email(),
    password: Joi.string().required().custom(password),
    name: Joi.string().required(),
    role: Joi.string().required().valid(...roles),
    phoneNumber: Joi.string(),
    city: Joi.string(),
    region: Joi.string(),
    address: Joi.string(),
    education: Joi.string(),
    experience: Joi.string(),
    profilePictureKey: Joi.string(),
    isActive: Joi.boolean(),
  }),
};

export const getUsers = {
  query: Joi.object().keys({
    name: Joi.string(),
    isActive: Joi.string(),
    role: Joi.string(),
    experience: Joi.string(),
    region: Joi.string(),
    education: Joi.string(),
    sortBy: Joi.string(),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
  }),
};

export const getUser = {
  params: Joi.object().keys({
    userId: Joi.string().custom(objectId),
  }),
};

export const updateUser = {
  params: Joi.object().keys({
    userId: Joi.required().custom(objectId),
  }),
  body: Joi.object()
    .keys({
      email: Joi.string().email(),
      role: Joi.string().valid(...roles),
      password: Joi.string().custom(password),
      name: Joi.string(),
      phoneNumber: Joi.string(),
      city: Joi.string(),
      region: Joi.string(),
      address: Joi.string(),
      education: Joi.string(),
      experience: Joi.string(),
      profilePictureKey: Joi.string(),
      isActive: Joi.boolean(),
    })
    .min(1),
};

export const deleteUser = {
  params: Joi.object().keys({
    userId: Joi.string().custom(objectId),
  }),
};

export const searchUsers = {
  body: Joi.object().keys({
    name: Joi.string().allow(''),
    role: Joi.string().allow(''),
    experience: Joi.string().allow(''),
    region: Joi.string().allow(''),
    education: Joi.string().allow(''),
    sortBy: Joi.string().allow(''),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
  }),
};

export const createWorkerOrFabricatorSchema = Joi.object({
  name: Joi.string().required(),
  mobileNumber: Joi.string().optional(),
  role: Joi.string().valid('worker', 'fabricator').required(),
  phoneNumber: Joi.string().optional(),
  city: Joi.string().optional(),
  region: Joi.string().optional(),
  address: Joi.string().optional(),
  education: Joi.string().optional(),
  experience: Joi.string().optional(),
});

export const updateWorkerBySiteEngineer = {
  params: Joi.object().keys({
    id: Joi.string().custom(objectId).required(),
  }),
  body: Joi.object().keys({
    name: Joi.string().optional(),
    email: Joi.string().email().optional(),
    mobileNumber: Joi.string().optional(),
    role: Joi.string().valid('worker', 'fabricator').optional(),
    isActive: Joi.boolean().optional(),
  }),
};

export const deleteWorkerBySiteEngineer = {
  params: Joi.object().keys({
    id: Joi.string().custom(objectId).required(),
  }),
};

export const resetUserPassword = {
  params: Joi.object().keys({
    userId: Joi.required().custom(objectId),
  }),
  body: Joi.object().keys({
    password: Joi.string().required().custom(password),
  }),
};
