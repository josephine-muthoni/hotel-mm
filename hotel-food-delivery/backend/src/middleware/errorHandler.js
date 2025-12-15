/**
 * Global error handling middleware
 */
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error for debugging
  console.error('❌ Error:', {
    message: err.message,
    stack: err.stack,
    name: err.name,
    code: err.code,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
  });

  // Prisma errors
  if (err.code === 'P2002') {
    const field = err.meta?.target?.[0] || 'field';
    error.message = `Duplicate value entered for ${field}`;
    error.statusCode = 409; // Conflict
  }

  if (err.code === 'P2025') {
    error.message = 'Record not found';
    error.statusCode = 404;
  }

  if (err.code === 'P2003') {
    error.message = 'Foreign key constraint failed';
    error.statusCode = 400;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error.message = 'Invalid token';
    error.statusCode = 401;
  }

  if (err.name === 'TokenExpiredError') {
    error.message = 'Token expired';
    error.statusCode = 401;
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(val => val.message);
    error.message = messages.join(', ');
    error.statusCode = 400;
  }

  // Cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    error.message = 'Invalid ID format';
    error.statusCode = 400;
  }

  // Multer errors (file upload)
  if (err.code === 'LIMIT_FILE_SIZE') {
    error.message = 'File too large. Maximum size is 5MB';
    error.statusCode = 400;
  }

  if (err.code === 'LIMIT_FILE_COUNT') {
    error.message = 'Too many files';
    error.statusCode = 400;
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    error.message = 'Invalid file type';
    error.statusCode = 400;
  }

  // Default to 500 server error
  error.statusCode = error.statusCode || 500;
  error.message = error.message || 'Server Error';

  // Don't leak stack trace in production
  const response = {
    success: false,
    message: error.message,
  };

  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
    response.error = err;
  }

  res.status(error.statusCode).json(response);
};

module.exports = errorHandler;