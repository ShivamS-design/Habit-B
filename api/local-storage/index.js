import express from 'express';
import LocalData from '../../models/LocalData.js';

const router = express.Router();

// Save local storage data
router.post('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    const userId = req.headers['x-user-id'] || 'anonymous';
    
    await LocalData.findOneAndUpdate(
      { userId, key },
      { userId, key, value },
      { upsert: true, new: true }
    );
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get local storage data
router.get('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const userId = req.headers['x-user-id'] || 'anonymous';
    
    const data = await LocalData.findOne({ userId, key });
    res.json({ success: true, value: data ? data.value : null });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all data for a user
router.get('/', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || 'anonymous';
    
    const data = await LocalData.getAllForUser(userId);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;