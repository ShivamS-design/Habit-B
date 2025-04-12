import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

export const verifyToken = async (req, res, next) => {
  try {
    // 1. Get token
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authorization token required' });
    }

    const token = authHeader.split(' ')[1];
    
    // 2. Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // 3. Check if user still exists
    const currentUser = await User.findById(decoded.id);
    if (!currentUser) {
      return res.status(401).json({ message: 'User no longer exists' });
    }

    // 4. Check if user changed password after token was issued
    if (currentUser.passwordChangedAfter(decoded.iat)) {
      return res.status(401).json({ message: 'Password changed. Please log in again' });
    }

    // 5. Attach user to request
    req.user = {
      id: currentUser._id,
      name: currentUser.name,
      email: currentUser.email,
      role: currentUser.role
    };

    next();
  } catch (error) {
    console.error('Authentication Error:', error.message);

    const response = {
      message: 'Authentication failed',
      suggestion: 'Please log in again'
    };

    if (process.env.NODE_ENV === 'development') {
      response.error = error.message;
      response.stack = error.stack;
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        ...response,
        message: 'Session expired',
        suggestion: 'Please log in again' 
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        ...response,
        message: 'Invalid token' 
      });
    }

    res.status(401).json(response);
  }
};

// Add to User model:
// passwordChangedAfter: function(JWTTimestamp) {
//   if (this.passwordChangedAt) {
//     const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
//     return JWTTimestamp < changedTimestamp;
//   }
//   return false;
// }
