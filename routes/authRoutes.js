import express from 'express';
import { 
  registerUser, 
  loginUser,
  logoutUser,
  refreshToken
} from '../controllers/authController.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Public routes
router.post('/register', authLimiter, registerUser);
router.post('/login', authLimiter, loginUser);
router.post('/refresh-token', refreshToken);
router.post('/logout', logoutUser);

export default router;
