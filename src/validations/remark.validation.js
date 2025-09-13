import Joi from 'joi';

const createRemark = {
    body: Joi.object().keys({
        projectId: Joi.string().required().custom((value, helpers) => {
            if (!value.match(/^[0-9a-fA-F]{24}$/)) {
                return helpers.error('any.invalid');
            }
            return value;
        }),
        text: Joi.string().required().trim().min(1).max(1000)
    })
};

const updateRemark = {
    params: Joi.object().keys({
        remarkId: Joi.string().required().custom((value, helpers) => {
            if (!value.match(/^[0-9a-fA-F]{24}$/)) {
                return helpers.error('any.invalid');
            }
            return value;
        })
    }),
    body: Joi.object().keys({
        text: Joi.string().required().trim().min(1).max(1000)
    })
};

const getRemarks = {
    params: Joi.object().keys({
        projectId: Joi.string().required().custom((value, helpers) => {
            if (!value.match(/^[0-9a-fA-F]{24}$/)) {
                return helpers.error('any.invalid');
            }
            return value;
        })
    }),
    query: Joi.object().keys({
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number().integer().min(1).max(100).default(10),
        sortBy: Joi.string().valid('addedAt', 'updatedAt').default('addedAt'),
        sortOrder: Joi.string().valid('asc', 'desc').default('desc')
    })
};

export { createRemark, updateRemark, getRemarks };
