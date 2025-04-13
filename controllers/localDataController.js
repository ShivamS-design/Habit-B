import LocalData from '../models/LocalData.js';
import AppError from '../utils/appError.js';

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