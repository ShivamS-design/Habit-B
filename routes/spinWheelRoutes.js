import express from 'express';
import { spinWheel } from '../controllers/spinWheelController.js';
import { verifyToken } from '../middleware/authMiddleware.js';


const router = express.Router();

// Spin the wheel to earn XP
router.post('/', verifyToken, spinWheel);

export default router;