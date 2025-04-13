import Joi from 'joi';
import AppError from '../utils/appError.js';

// Auth validation
export const validateAuth = (req, res, next) => {
  const schema = Joi.object({
    name: Joi.string().min(3).max(50),
    email: Joi.string().email().required(),
    password: Joi.string()
      .min(8)
      .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)'))
      .required()
      .messages({
        'string.pattern.base': 'Password must contain uppercase, lowercase, and number'
      })
  });

  const { error } = schema.validate(req.body);
  if (error) return next(new AppError(error.details[0].message, 400));
  next();
};

// Password reset validation
export const validatePasswordReset = (req, res, next) => {
  const schema = Joi.object({
    password: Joi.string()
      .min(8)
      .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)'))
      .required()
  });

  const { error } = schema.validate(req.body);
  if (error) return next(new AppError(error.details[0].message, 400));
  next();
};

// Local storage data validation
export const validateLocalData = (req, res, next) => {
  const schema = Joi.object({
    key: Joi.string().required(),
    value: Joi.any().required()
  });

  const { error } = schema.validate(req.body);
  if (error) return next(new AppError(error.details[0].message, 400));
  next();
};