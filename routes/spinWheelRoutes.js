import express from 'express';
import { 
  spinWheel, 
  getSpinStats 
} from '../controllers/spinWheelController.js';
import { verifyUser } from '../middleware/authMiddleware.js';

const router = express.Router();

// Protect all spin wheel routes with authentication
router.use(verifyUser);

// Spin wheel routes
router.route('/')
  .post(spinWheel)      // POST: Spin the wheel (protected)
  .get(getSpinStats);   // GET: Get spin statistics (protected)

export default router;
