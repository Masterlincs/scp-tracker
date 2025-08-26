/**
 * Error Boundary Module
 * Provides comprehensive error handling, recovery mechanisms, and error boundaries
 */

import { logger, errorHandler } from '../utils/index.js';

class ErrorBoundary {
  constructor() {
    this.errorHandlers = new Map();
    this.errorBoundaries = new Map();
    this.globalErrorCount = 0;
    this.maxGlobalErrors = 50;
    this.errorRecoveryStrategies = new Map();
    this.circuitBreakers = new Map();
    
    // Setup global error handlers
    this.setupGlobalHandlers();
    
    // Register default recovery strategies
    this.registerDefaultStrategies();
  }

  /**
   * Setup global error handlers
   */
  setupGlobalHandlers() {
    try {
      // Handle uncaught errors
      window.addEventListener('error', (event) => {
        this.handleError(event.error, {
          source: event.filename,
          line: event.lineno,
          column: event.colno,
          action: 'global_error',
          type: 'uncaught'
        });
      });

      // Handle unhandled promise rejections
      window.addEventListener('unhandledrejection', (event) => {
        this.handleError(event.reason, {
          action: 'unhandled_promise_rejection',
          type: 'promise'
        });
      });

      // Handle extension-specific errors
      if (typeof browser !== 'undefined') {
        browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
          if (message.type === 'error') {
            this.handleError(message.error, {
              action: 'runtime_error',
              sender: sender
            });
          }
        });
      }

    } catch (error) {
      logger.error('Failed to setup global error handlers:', error);
    }
  }

  /**
   * Register default recovery strategies
   */
  registerDefaultStrategies() {
    // Storage error recovery
    this.registerRecoveryStrategy('storage_error', async (error, context) => {
      logger.info('Attempting storage error recovery');
      
      if (error.name === 'QuotaExceededError') {
        // Clear some storage space
        await this.clearStorageSpace();
        return { success: true, message: 'Storage space cleared' };
      }
      
      if (error.name === 'NS_ERROR_STORAGE_BUSY') {
        // Retry after delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        return { success: true, message: 'Storage retry completed' };
      }
      
      return { success: false, message: 'Storage recovery failed' };
    });

    // Network error recovery
    this.registerRecoveryStrategy('network_error', async (error, context) => {
      logger.info('Attempting network error recovery');
      
      if (context.retryCount < 3) {
        // Exponential backoff retry
        const delay = Math.pow(2, context.retryCount) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        return { success: true, message: 'Network retry completed' };
      }
      
      return { success: false, message: 'Network recovery failed' };
    });

    // UI error recovery
    this.registerRecoveryStrategy('ui_error', async (error, context) => {
      logger.info('Attempting UI error recovery');
      
      // Reset UI state
      if (context.component) {
        this.resetUIComponent(context.component);
      }
      
      return { success: true, message: 'UI state reset' };
    });
  }

  /**
   * Register error handler for specific error type
   * @param {string} errorType - Type of error to handle
   * @param {Function} handler - Error handler function
   */
  registerErrorHandler(errorType, handler) {
    this.errorHandlers.set(errorType, handler);
    logger.debug(`Registered error handler for: ${errorType}`);
  }

  /**
   * Register error boundary for specific component or module
   * @param {string} boundaryId - Boundary identifier
   * @param {Object} config - Boundary configuration
   */
  registerErrorBoundary(boundaryId, config = {}) {
    const boundary = {
      id: boundaryId,
      enabled: config.enabled !== false,
      maxErrors: config.maxErrors || 5,
      resetTimeout: config.resetTimeout || 30000,
      recoveryStrategy: config.recoveryStrategy || 'default',
      errorCount: 0,
      lastErrorTime: 0,
      isActive: true
    };

    this.errorBoundaries.set(boundaryId, boundary);
    logger.debug(`Registered error boundary: ${boundaryId}`);
  }

  /**
   * Register recovery strategy
   * @param {string} strategyName - Strategy name
   * @param {Function} strategy - Recovery strategy function
   */
  registerRecoveryStrategy(strategyName, strategy) {
    this.errorRecoveryStrategies.set(strategyName, strategy);
    logger.debug(`Registered recovery strategy: ${strategyName}`);
  }

  /**
   * Handle error with recovery
   * @param {Error} error - Error object
   * @param {Object} context - Error context
   */
  async handleError(error, context = {}) {
    try {
      this.globalErrorCount++;
      
      // Check global error limit
      if (this.globalErrorCount > this.maxGlobalErrors) {
        logger.error('Global error limit exceeded, entering safe mode');
        this.enterSafeMode();
        return;
      }

      // Determine error type
      const errorType = this.determineErrorType(error, context);
      
      // Get error boundary
      const boundaryId = context.boundaryId || 'global';
      const boundary = this.errorBoundaries.get(boundaryId);
      
      // Check boundary state
      if (boundary && !boundary.isActive) {
        logger.warn(`Error boundary ${boundaryId} is inactive, skipping error handling`);
        return;
      }

      // Log error
      logger.errorWithContext(error, {
        ...context,
        type: errorType,
        boundaryId: boundaryId,
        globalErrorCount: this.globalErrorCount
      });

      // Update boundary error count
      if (boundary) {
        boundary.errorCount++;
        boundary.lastErrorTime = Date.now();
        
        // Check if boundary should be deactivated
        if (boundary.errorCount >= boundary.maxErrors) {
          this.deactivateErrorBoundary(boundaryId);
        }
      }

      // Execute error handler
      const handler = this.errorHandlers.get(errorType);
      if (handler) {
        try {
          await handler(error, context);
        } catch (handlerError) {
          logger.error('Error handler failed:', handlerError);
        }
      }

      // Attempt recovery
      const recoveryResult = await this.attemptRecovery(errorType, error, context);
      
      // Notify UI if needed
      this.notifyUI(error, context, recoveryResult);

      return recoveryResult;

    } catch (handlingError) {
      logger.error('Error handling failed:', handlingError);
      // Fallback to basic error handling
      this.fallbackErrorHandling(error, context);
    }
  }

  /**
   * Determine error type
   * @param {Error} error - Error object
   * @param {Object} context - Error context
   * @returns {string} Error type
   */
  determineErrorType(error, context) {
    const errorName = error.name || '';
    const errorMessage = error.message || '';
    
    // Check context first
    if (context.type) {
      return context.type;
    }
    
    // Check error name
    if (errorName.includes('Storage') || errorName.includes('Quota')) {
      return 'storage_error';
    }
    
    if (errorName.includes('Network') || errorMessage.includes('network')) {
      return 'network_error';
    }
    
    if (errorName.includes('DOM') || errorName.includes('UI')) {
      return 'ui_error';
    }
    
    if (errorName.includes('Syntax') || errorName.includes('Parse')) {
      return 'syntax_error';
    }
    
    // Default to unknown
    return 'unknown_error';
  }

  /**
   * Attempt error recovery
   * @param {string} errorType - Type of error
   * @param {Error} error - Error object
   * @param {Object} context - Error context
   * @returns {Object} Recovery result
   */
  async attemptRecovery(errorType, error, context) {
    try {
      // Get recovery strategy
      const strategyName = context.recoveryStrategy || this.getRecoveryStrategy(errorType);
      const strategy = this.errorRecoveryStrategies.get(strategyName);
      
      if (!strategy) {
        return { success: false, message: 'No recovery strategy available' };
      }

      // Check circuit breaker
      const circuitBreaker = this.circuitBreakers.get(strategyName);
      if (circuitBreaker && circuitBreaker.isTripped) {
        return { success: false, message: 'Circuit breaker tripped' };
      }

      // Execute recovery strategy
      const result = await strategy(error, {
        ...context,
        retryCount: (context.retryCount || 0) + 1
      });

      // Update circuit breaker
      this.updateCircuitBreaker(strategyName, result.success);

      return result;

    } catch (recoveryError) {
      logger.error('Recovery attempt failed:', recoveryError);
      return { success: false, message: 'Recovery failed' };
    }
  }

  /**
   * Get recovery strategy for error type
   * @param {string} errorType - Error type
   * @returns {string} Strategy name
   */
  getRecoveryStrategy(errorType) {
    const strategyMap = {
      'storage_error': 'storage_error',
      'network_error': 'network_error',
      'ui_error': 'ui_error',
      'syntax_error': 'default'
    };
    
    return strategyMap[errorType] || 'default';
  }

  /**
   * Update circuit breaker state
   * @param {string} strategyName - Strategy name
   * @param {boolean} success - Whether operation was successful
   */
  updateCircuitBreaker(strategyName, success) {
    let breaker = this.circuitBreakers.get(strategyName);
    
    if (!breaker) {
      breaker = {
        failures: 0,
        successes: 0,
        isTripped: false,
        lastFailureTime: 0
      };
      this.circuitBreakers.set(strategyName, breaker);
    }

    if (success) {
      breaker.successes++;
      breaker.failures = 0;
      
      // Reset breaker if enough successes
      if (breaker.successes >= 3) {
        breaker.isTripped = false;
        breaker.successes = 0;
      }
    } else {
      breaker.failures++;
      breaker.lastFailureTime = Date.now();
      
      // Trip breaker if too many failures
      if (breaker.failures >= 5) {
        breaker.isTripped = true;
      }
    }
  }

  /**
   * Clear storage space
   */
  async clearStorageSpace() {
    try {
      const keys = await browser.storage.local.get(null);
      const allKeys = Object.keys(keys);
      
      // Remove oldest 20% of entries
      const keysToRemove = allKeys.slice(-Math.floor(allKeys.length * 0.2));
      
      await browser.storage.local.remove(keysToRemove);
      logger.info(`Cleared ${keysToRemove.length} storage entries`);
      
    } catch (error) {
      logger.error('Failed to clear storage space:', error);
      throw error;
    }
  }

  /**
   * Reset UI component
   * @param {string} component - Component name
   */
  resetUIComponent(component) {
    try {
      // Dispatch reset event
      const event = new CustomEvent('scpUIReset', {
        detail: { component: component }
      });
      document.dispatchEvent(event);
      
      logger.debug(`Reset UI component: ${component}`);
      
    } catch (error) {
      logger.error('Failed to reset UI component:', error);
    }
  }

  /**
   * Deactivate error boundary
   * @param {string} boundaryId - Boundary identifier
   */
  deactivateErrorBoundary(boundaryId) {
    const boundary = this.errorBoundaries.get(boundaryId);
    if (boundary) {
      boundary.isActive = false;
      logger.warn(`Deactivated error boundary: ${boundaryId}`);
      
      // Schedule automatic reactivation
      setTimeout(() => {
        this.reactivateErrorBoundary(boundaryId);
      }, boundary.resetTimeout);
    }
  }

  /**
   * Reactivate error boundary
   * @param {string} boundaryId - Boundary identifier
   */
  reactivateErrorBoundary(boundaryId) {
    const boundary = this.errorBoundaries.get(boundaryId);
    if (boundary) {
      boundary.isActive = true;
      boundary.errorCount = 0;
      logger.info(`Reactivated error boundary: ${boundaryId}`);
    }
  }

  /**
   * Enter safe mode
   */
  enterSafeMode() {
    try {
      logger.warn('Entering safe mode');
      
      // Dispatch safe mode event
      const event = new CustomEvent('scpSafeMode', {
        detail: { reason: 'error_limit_exceeded' }
      });
      document.dispatchEvent(event);
      
      // Disable non-essential features
      this.disableNonEssentialFeatures();
      
    } catch (error) {
      logger.error('Failed to enter safe mode:', error);
    }
  }

  /**
   * Disable non-essential features
   */
  disableNonEssentialFeatures() {
    try {
      // Disable dictionary and other heavy features
      const event = new CustomEvent('scpDisableFeatures', {
        detail: { features: ['dictionary', 'navigator', 'progress'] }
      });
      document.dispatchEvent(event);
      
      logger.info('Disabled non-essential features');
      
    } catch (error) {
      logger.error('Failed to disable features:', error);
    }
  }

  /**
   * Notify UI about error
   * @param {Error} error - Error object
   * @param {Object} context - Error context
   * @param {Object} recoveryResult - Recovery result
   */
  notifyUI(error, context, recoveryResult) {
    try {
      const event = new CustomEvent('scpErrorHandled', {
        detail: {
          error: error.name,
          message: error.message,
          context: context,
          recovery: recoveryResult
        }
      });
      document.dispatchEvent(event);
      
    } catch (notificationError) {
      logger.error('Failed to notify UI:', notificationError);
    }
  }

  /**
   * Fallback error handling
   * @param {Error} error - Error object
   * @param {Object} context - Error context
   */
  fallbackErrorHandling(error, context) {
    try {
      // Basic error logging
      logger.error('Fallback error handling:', error);
      
      // Show user-friendly message
      if (typeof window !== 'undefined') {
        const message = 'An error occurred. Some features may not work properly.';
        window.dispatchEvent(new CustomEvent('scpError', {
          detail: { message, error: error.name }
        }));
      }
      
    } catch (fallbackError) {
      logger.error('Fallback error handling failed:', fallbackError);
    }
  }

  /**
   * Get error statistics
   * @returns {Object} Error statistics
   */
  getErrorStats() {
    return {
      globalErrorCount: this.globalErrorCount,
      maxGlobalErrors: this.maxGlobalErrors,
      activeBoundaries: Array.from(this.errorBoundaries.values())
        .filter(b => b.isActive).length,
      totalBoundaries: this.errorBoundaries.size,
      circuitBreakers: Array.from(this.circuitBreakers.entries())
        .map(([name, breaker]) => ({
          name,
          isTripped: breaker.isTripped,
          failures: breaker.failures,
          successes: breaker.successes
        }))
    };
  }

  /**
   * Reset error statistics
   */
  resetStats() {
    this.globalErrorCount = 0;
    this.errorBoundaries.forEach(boundary => {
      boundary.errorCount = 0;
      boundary.isActive = true;
    });
    this.circuitBreakers.forEach(breaker => {
      breaker.failures = 0;
      breaker.successes = 0;
      breaker.isTripped = false;
    });
    
    logger.info('Error statistics reset');
  }

  /**
   * Cleanup error boundary resources
   */
  cleanup() {
    try {
      this.errorHandlers.clear();
      this.errorBoundaries.clear();
      this.errorRecoveryStrategies.clear();
      this.circuitBreakers.clear();
      
      logger.info('Error boundary cleanup complete');
      
    } catch (error) {
      logger.error('Error boundary cleanup failed:', error);
    }
  }
}

// Export singleton instance
const errorBoundary = new ErrorBoundary();

export default errorBoundary;