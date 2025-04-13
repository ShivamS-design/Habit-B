import rateLimit from 'express-rate-limit';
import AppError from '../utils/appError.js';

// Auth-specific rate limiter (stricter than global)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 requests per window
  handler: (req, res, next) => {
    next(new AppError('Too many login attempts. Please try again later.', 429));
  },
  skip: (req) => {
    // Skip rate limiting for these conditions
    return process.env.NODE_ENV === 'test' || 
           req.ip === '127.0.0.1' || 
           req.user?.role === 'admin';
  }
});

// API-wide rate limiter (already in server.js)
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300
});