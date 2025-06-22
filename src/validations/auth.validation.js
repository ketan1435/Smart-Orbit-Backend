import Joi from 'joi';
import { password } from './custom.validation.js';

const register = {
  body: Joi.object().keys({
    email: Joi.string().required().email(),
    password: Joi.string().required().custom(password),
    name: Joi.string().required(),
  }),
};

const login = {
  body: Joi.object().keys({
    email: Joi.string().required(),
    password: Joi.string().required(),
  }),
};

const logout = {
  body: Joi.object().keys({
    refreshToken: Joi.string().required(),
  }),
};

export { register, login, logout };

export const signup = {
  body: Joi.object().keys({
    email: Joi.string().email().required().messages({
      'string.empty': 'Email cannot be null',
      'string.email': 'Invalid email format',
    }),
    password: Joi.string().required(),
    confirmPassword: Joi.string().required(),
    mobileNumber: Joi.string().optional(),
    role: Joi.string().optional(),
    profilePicture: Joi.string().optional(),
    username: Joi.string().optional(),
    address: Joi.string().optional(),
    date: Joi.date().optional(),
    superAdmin: Joi.boolean().default(true),
  }),
};

export const refreshTokens = {
  body: Joi.object().keys({
    refreshToken: Joi.string().required(),
  }),
};

export const forgotPassword = {
  body: Joi.object().keys({
    email: Joi.string().email().required(),
  }),
};

export const resetPassword = {
  query: Joi.object().keys({
    token: Joi.string().required(),
  }),
  body: Joi.object().keys({
    password: Joi.string().required().custom(password),
  }),
};

export const verifyEmail = {
  query: Joi.object().keys({
    token: Joi.string().required(),
  }),
};
