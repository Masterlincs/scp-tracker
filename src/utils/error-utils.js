import { logger } from './logger.js';
import { DEFAULTS } from './config.js';

/**
 * Custom error class for SCP Tracker specific errors
 */
export class SCPTrackerError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'SCPTrackerError';
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

/**
 * Error handler middleware for async functions
 */
export const asyncHandler = (fn) => {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      return handleError(error, ...args);
    }
  };
};

/**
 * Centralized error handling
 */
export const handleError = (error, context = {}) => {
  // Log the error
  const errorInfo = {
    message: error.message,
    code: error.code || 'UNKNOWN_ERROR',
    stack: error.stack,
    context,
    timestamp: new Date().toISOString(),
  };

  // Log based on error type
  if (error.isOperational) {
    logger.warn('Operational error:', errorInfo);
  } else {
    logger.error('Unexpected error:', errorInfo);
  }

  // Return a safe error response
  return {
    success: false,
    error: {
      message: error.message || DEFAULTS.ERRORS.UNEXPECTED,
      code: error.code || 'UNKNOWN_ERROR',
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    },
  };
};

/**
 * Validation utilities
 */
export const validate = {
  scpNumber: (scpNumber) => {
    if (typeof scpNumber !== 'string') {
      throw new SCPTrackerError('SCP number must be a string', 'VALIDATION_ERROR');
    }
    if (!scpNumber) {
      throw new SCPTrackerError('SCP number is required', 'VALIDATION_ERROR');
    }
    // Further validation can be added here
    return true;
  },
  
  settings: (settings) => {
    if (typeof settings !== 'object' || settings === null) {
      throw new SCPTrackerError('Settings must be an object', 'VALIDATION_ERROR');
    }
    // Add more specific validation as needed
    return true;
  },
};

// Default export for backward compatibility
export default {
  SCPTrackerError,
  asyncHandler,
  handleError,
  validate,
};
