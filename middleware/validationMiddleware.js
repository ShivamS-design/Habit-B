import Joi from 'joi';
import AppError from '../utils/appError.js';

// User update validation schema
const userUpdateSchema = Joi.object({
  name: Joi.string().min(3).max(50),
  email: Joi.string().email(),
  avatar: Joi.string(),  // This will be handled by multer
  bio: Joi.string().max(200)
});

// Middleware to validate user update data
export const validateUserUpdate = (req, res, next) => {
  // Skip validation if no body is provided
  if (!req.body || Object.keys(req.body).length === 0) {
    return next(new AppError('No data provided for update', 400));
  }

  // Validate the request body
  const { error } = userUpdateSchema.validate(req.body, {
    allowUnknown: true,  // Allow fields not in schema (like file uploads)
    stripUnknown: true   // Remove unknown fields
  });

  if (error) {
    return next(new AppError(error.details[0].message, 400));
  }

  next();
};

// Password reset validation schema
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

// Export all validations
export default {
  validateUserUpdate,
  validatePasswordReset
};
