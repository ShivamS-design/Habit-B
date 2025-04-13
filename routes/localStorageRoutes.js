import express from 'express';
import { 
  saveLocalData,
  getLocalData,
  getAllLocalData,
  deleteLocalData,
  syncLocalData
} from '../controllers/localDataController.js';
import { verifyUser } from '../middleware/authMiddleware.js';
import { validateLocalData } from '../middleware/validationMiddleware.js';

const router = express.Router();

// Apply auth to all routes
router.use(verifyUser);

// Key-based operations
router.route('/:key')
  .post(validateLocalData, saveLocalData)  // Save data for specific key
  .get(getLocalData)                      // Get data for specific key
  .delete(deleteLocalData);               // Delete data for specific key

// Bulk operations
router.route('/')
  .get(getAllLocalData)                   // Get all data for user
  .post(syncLocalData);                   // Synchronize client-server data

export default router;
