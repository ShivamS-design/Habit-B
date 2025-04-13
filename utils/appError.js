class AppError extends Error {
  constructor(message, statusCode, errorType = 'operational', details = null) {
    super(message);
    
    // Standard properties
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    this.errorType = errorType; // 'operational' or 'programmatic'
    this.timestamp = new Date().toISOString();
    this.details = details;
    
    // Capture stack trace (excluding constructor call)
    Error.captureStackTrace(this, this.constructor);
    
    // Additional metadata for different error types
    if (errorType === 'validation') {
      this.errors = details;
      this.message = 'Validation failed';
    }
    
    if (errorType === 'database') {
      this.operation = details?.operation || 'unknown';
      this.collection = details?.collection || 'unknown';
    }
    
    // HTTP-specific properties
    if (details?.path) {
      this.path = details.path;
    }
    
    if (details?.method) {
      this.method = details.method;
    }
  }
  
  // Factory methods for common error types
  static badRequest(message, details) {
    return new AppError(message, 400, 'operational', details);
  }
  
  static unauthorized(message = 'Unauthorized') {
    return new AppError(message, 401);
  }
  
  static forbidden(message = 'Forbidden') {
    return new AppError(message, 403);
  }
  
  static notFound(message = 'Resource not found') {
    return new AppError(message, 404);
  }
  
  static conflict(message = 'Conflict occurred') {
    return new AppError(message, 409);
  }
  
  static validationError(errors, details) {
    return new AppError('Validation Error', 422, 'validation', {
      errors,
      ...details
    });
  }
  
  static databaseError(error, operation, collection) {
    return new AppError(
      'Database operation failed', 
      500, 
      'database', 
      { error, operation, collection }
    );
  }
  
  static serviceUnavailable(message = 'Service temporarily unavailable') {
    return new AppError(message, 503);
  }
  
  // Serialization for API responses
  toJSON() {
    return {
      status: this.status,
      statusCode: this.statusCode,
      message: this.message,
      ...(this.errorType === 'validation' && { errors: this.errors }),
      ...(this.details && { details: this.details }),
      ...(process.env.NODE_ENV === 'development' && {
        stack: this.stack,
        type: this.errorType
      })
    };
  }
  
  // Log formatting
  toLog() {
    return {
      timestamp: this.timestamp,
      message: this.message,
      statusCode: this.statusCode,
      type: this.errorType,
      stack: this.stack,
      ...(this.details && { details: this.details })
    };
  }
}

export default AppError;