import LocalData from '../models/LocalData.js';
import AppError from '../utils/appError.js';

// Save data for a specific key
export const saveLocalData = async (req, res, next) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    
    const data = await LocalData.findOneAndUpdate(
      { userId: req.user.id, key },
      { value },
      { new: true, upsert: true }
    );
    
    res.status(200).json({
      status: 'success',
      data
    });
  } catch (err) {
    next(err);
  }
};

// Get data for a specific key
export const getLocalData = async (req, res, next) => {
  try {
    const { key } = req.params;
    const data = await LocalData.findOne({ 
      userId: req.user.id, 
      key 
    });
    
    if (!data) {
      return next(new AppError('No data found for this key', 404));
    }
    
    res.status(200).json({
      status: 'success',
      data
    });
  } catch (err) {
    next(err);
  }
};

// Get all data for the user
export const getAllLocalData = async (req, res, next) => {
  try {
    const data = await LocalData.find({ userId: req.user.id });
    res.status(200).json({
      status: 'success',
      results: data.length,
      data
    });
  } catch (err) {
    next(err);
  }
};

// Delete data for a specific key
export const deleteLocalData = async (req, res, next) => {
  try {
    const { key } = req.params;
    await LocalData.findOneAndDelete({ 
      userId: req.user.id, 
      key 
    });
    
    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (err) {
    next(err);
  }
};

// Synchronize client and server data
export const syncLocalData = async (req, res, next) => {
  try {
    const clientData = req.body;
    const syncedData = await LocalData.syncUserData(req.user.id, clientData);
    
    res.status(200).json({
      status: 'success',
      results: syncedData.length,
      data: syncedData
    });
  } catch (err) {
    next(err);
  }
};
