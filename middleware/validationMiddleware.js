import Joi from 'joi';
import AppError from '../utils/appError.js';

// Base validation schema for local data
const localDataSchema = Joi.object({
  value: Joi.any().required().messages({
    'any.required': 'Data value is required'
  }),
  namespace: Joi.string().default('default').max(50).messages({
    'string.max': 'Namespace cannot exceed 50 characters'
  }),
  valueType: Joi.string().valid(
    'string', 
    'number', 
    'boolean', 
    'object', 
    'array', 
    'binary'
  ).optional(),
  encryption: Joi.object({
    enabled: Joi.boolean().default(false),
    algorithm: Joi.string().valid('aes-256-cbc', 'aes-128-cbc').optional()
  }).optional(),
  ttl: Joi.date().min('now').optional().messages({
    'date.min': 'TTL must be in the future'
  }),
  tags: Joi.array().items(
    Joi.string().max(30).messages({
      'string.max': 'Tags cannot exceed 30 characters'
    })
  ).max(10).messages({
    'array.max': 'Maximum 10 tags allowed'
  }),
  syncStatus: Joi.string().valid(
    'pending', 
    'synced', 
    'conflict', 
    'local-only'
  ).optional()
}).options({ allowUnknown: true });

/**
 * Validate local data before saving
 */
export const validateLocalData = (req, res, next) => {
  const { error } = localDataSchema.validate(req.body, {
    abortEarly: false
  });

  if (error) {
    const messages = error.details.map(detail => detail.message);
    return next(new AppError(messages.join('; '), 400));
  }

  // Auto-detect value type if not provided
  if (!req.body.valueType) {
    req.body.valueType = Array.isArray(req.body.value) 
      ? 'array' 
      : typeof req.body.value;
  }

  next();
};

/**
 * Validate sync data (array of local data items)
 */
export const validateSyncData = (req, res, next) => {
  const schema = Joi.array().items(
    localDataSchema.keys({
      key: Joi.string().required().max(100).messages({
        'string.max': 'Key cannot exceed 100 characters',
        'any.required': 'Key is required for sync'
      }),
      updatedAt: Joi.date().required()
    })
  ).max(100).messages({
    'array.max': 'Cannot sync more than 100 items at once'
  });

  const { error } = schema.validate(req.body, {
    abortEarly: false
  });

  if (error) {
    const messages = error.details.map(detail => detail.message);
    return next(new AppError(messages.join('; '), 400));
  }

  next();
};

/**
 * Validate key parameter
 */
export const validateKeyParam = (req, res, next) => {
  const schema = Joi.string()
    .required()
    .max(100)
    .pattern(/^[a-zA-Z0-9_-]+$/)
    .messages({
      'string.max': 'Key cannot exceed 100 characters',
      'string.pattern.base': 'Key can only contain letters, numbers, hyphens and underscores',
      'any.required': 'Key parameter is required'
    });

  const { error } = schema.validate(req.params.key);

  if (error) {
    return next(new AppError(error.details[0].message, 400));
  }

  next();
};

export default {
  validateLocalData,
  validateSyncData,
  validateKeyParam
};
