import express from 'express';
import { 
  registerUser, 
  loginUser,
  logoutUser,
  refreshToken,
  verifyEmail,
  requestPasswordReset,
  resetPassword
} from '../controllers/authController.js';
import { 
  validateAuth, 
  validatePasswordReset 
} from '../middleware/validationMiddleware.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Public routes
router.post('/register', authLimiter, validateAuth, registerUser);
router.post('/login', authLimiter, validateAuth, loginUser);
router.post('/refresh-token', refreshToken);
router.post('/logout', logoutUser);

// Password reset flow
router.post('/forgot-password', authLimiter, requestPasswordReset);
router.patch('/reset-password/:token', validatePasswordReset, resetPassword);

// Email verification
router.get('/verify-email/:token', verifyEmail);

export default router;