import express from 'express';
import { 
  saveLocalData,
  getLocalData,
  getAllLocalData,
  deleteLocalData,
  syncLocalData
} from '../controllers/localDataController.js';
import { verifyToken } from '../middleware/authMiddleware.js';
import { validateLocalData } from '../middleware/validationMiddleware.js';

const router = express.Router();

// Apply auth to all routes
router.use(verifyToken);

// Key-based operations
router.route('/:key')
  .post(validateLocalData, saveLocalData)
  .get(getLocalData)
  .delete(deleteLocalData);

// Bulk operations
router.route('/')
  .get(getAllLocalData)
  .post(syncLocalData); // For client-server sync

export default router;
