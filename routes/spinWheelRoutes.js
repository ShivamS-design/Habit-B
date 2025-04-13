import express from 'express';
import { spinWheel, getSpinStats } from '../controllers/spinWheelController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(verifyToken);

router.route('/')
  .post(spinWheel)
  .get(getSpinStats);

export default router;