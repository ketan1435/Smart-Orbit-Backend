import Joi from 'joi';

export const initiateUpload = {
  body: Joi.object().keys({
    fileName: Joi.string().required(),
    fileType: Joi.string().required(),
    fileCategory: Joi.string().required(),
  }),
}; 