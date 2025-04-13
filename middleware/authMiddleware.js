import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import AppError from '../utils/appError.js';
import { promisify } from 'util';

// Promisify jwt.verify
const verifyToken = promisify(jwt.verify);

/**
 * @desc    Verify JWT and protect routes
 * @param   {Object} req - Express request object
 * @param   {Object} res - Express response object
 * @param   {Function} next - Express next middleware
 */
export const verifyUser = async (req, res, next) => {
  try {
    // 1. Get token from headers or cookies
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return next(new AppError('Authentication required', 401));
    }

    // 2. Verify token
    const decoded = await verifyToken(token, process.env.JWT_SECRET);

    // 3. Check if user still exists
    const currentUser = await User.findById(decoded.id).select('+active +passwordChangedAt');
    if (!currentUser || !currentUser.active) {
      return next(new AppError('User no longer exists', 401));
    }

    // 4. Check if user changed password after token was issued
    if (currentUser.passwordChangedAfter(decoded.iat)) {
      return next(new AppError('Password changed recently. Please log in again', 401));
    }

    // 5. Grant access to protected route
    req.user = currentUser;
    res.locals.user = currentUser; // For templates if needed
    next();
  } catch (error) {
    // Handle specific JWT errors
    if (error.name === 'TokenExpiredError') {
      return next(new AppError('Session expired. Please log in again', 401));
    }
    if (error.name === 'JsonWebTokenError') {
      return next(new AppError('Invalid authentication token', 401));
    }
    next(error);
  }
};

/**
 * @desc    Restrict access to specific roles
 * @param   {...String} roles - Allowed user roles
 * @return  {Function} Middleware function
 */
export const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission for this action', 403)
      );
    }
    next();
  };
};

/**
 * @desc    Optional authentication for non-critical routes
 */
export const verifyOptional = async (req, res, next) => {
  try {
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.token) {
      token = req.cookies.token;
    }

    if (token) {
      const decoded = await verifyToken(token, process.env.JWT_SECRET);
      const currentUser = await User.findById(decoded.id);
      
      if (currentUser?.active && !currentUser.passwordChangedAfter(decoded.iat)) {
        req.user = currentUser;
      }
    }
    next();
  } catch (error) {
    next();
  }
};

// Named exports
export { verifyUser, restrictTo, verifyOptional };

// Default export
export default {
  verifyUser,
  restrictTo,
  verifyOptional
};
