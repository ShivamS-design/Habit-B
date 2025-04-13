import AppError from '../utils/appError.js';

export default (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Development: Send full error stack
  if (process.env.NODE_ENV === 'development') {
    res.status(err.statusCode).json({
      status: err.status,
      error: err,
      message: err.message,
      stack: err.stack
    });
  } 
  // Production: Send simplified message
  else {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message
    });
  }
};