/**
 * Resource Manager Module
 * Handles proper resource cleanup and memory leak prevention
 */

import { logger, errorHandler } from '../utils/index.js';

class ResourceManager {
  constructor() {
    this.resources = new Map();
    this.cleanupTasks = new Map();
    this.memoryMonitors = new Map();
    this.cleanupIntervals = new Map();
    this.eventListeners = new Map();
    this.timers = new Map();
    this.observers = new Map();
    this.caches = new Map();
    
    // Resource tracking
    this.resourceTypes = {
      'eventListener': { count: 0, cleanup: 'removeEventListener' },
      'timer': { count: 0, cleanup: 'clearTimeout/clearInterval' },
      'observer': { count: 0, cleanup: 'disconnect' },
      'cache': { count: 0, cleanup: 'clear' },
      'storage': { count: 0, cleanup: 'clear' },
      'dom': { count: 0, cleanup: 'remove' },
      'websocket': { count: 0, cleanup: 'close' },
      'worker': { count: 0, cleanup: 'terminate' }
    };
    
    // Memory thresholds
    this.memoryThresholds = {
      warning: 50 * 1024 * 1024, // 50MB
      critical: 100 * 1024 * 1024, // 100MB
      cleanup: 30 * 1024 * 1024 // 30MB
    };
    
    // Initialize resource management
    this.initialize();
  }

  /**
   * Initialize resource manager
   */
  initialize() {
    try {
      logger.info('Initializing resource manager');
      
      // Setup memory monitoring
      this.setupMemoryMonitoring();
      
      // Setup periodic cleanup
      this.setupPeriodicCleanup();
      
      // Setup page visibility change handler
      this.setupVisibilityHandler();
      
      // Setup before unload handler
      this.setupBeforeUnloadHandler();
      
      logger.info('Resource manager initialized successfully');
      
    } catch (error) {
      errorHandler.handleError(error, {
        action: 'resource_manager_initialize'
      });
    }
  }

  /**
   * Setup memory monitoring
   */
  setupMemoryMonitoring() {
    try {
      // Check memory usage periodically
      this.memoryMonitors.set('main', setInterval(() => {
        this.checkMemoryUsage();
      }, 30000)); // Check every 30 seconds
      
      // Monitor memory growth
      this.memoryMonitors.set('growth', setInterval(() => {
        this.checkMemoryGrowth();
      }, 60000)); // Check every minute
      
    } catch (error) {
      logger.warn('Failed to setup memory monitoring:', error);
    }
  }

  /**
   * Setup periodic cleanup
   */
  setupPeriodicCleanup() {
    try {
      // Clean up unused resources every 5 minutes
      this.cleanupIntervals.set('periodic', setInterval(() => {
        this.cleanupUnusedResources();
      }, 5 * 60 * 1000));
      
      // Clean up orphaned DOM elements every 2 minutes
      this.cleanupIntervals.set('dom', setInterval(() => {
        this.cleanupOrphanedDOM();
      }, 2 * 60 * 1000));
      
      // Clean up expired cache entries every minute
      this.cleanupIntervals.set('cache', setInterval(() => {
        this.cleanupExpiredCache();
      }, 60 * 1000));
      
    } catch (error) {
      logger.warn('Failed to setup periodic cleanup:', error);
    }
  }

  /**
   * Setup visibility change handler
   */
  setupVisibilityHandler() {
    try {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.handlePageHidden();
        } else {
          this.handlePageVisible();
        }
      });
      
    } catch (error) {
      logger.warn('Failed to setup visibility handler:', error);
    }
  }

  /**
   * Setup before unload handler
   */
  setupBeforeUnloadHandler() {
    try {
      window.addEventListener('beforeunload', () => {
        this.handleBeforeUnload();
      });
      
    } catch (error) {
      logger.warn('Failed to setup before unload handler:', error);
    }
  }

  /**
   * Track a resource
   * @param {string} id - Resource ID
   * @param {string} type - Resource type
   * @param {any} resource - Resource object
   * @param {Object} options - Resource options
   */
  trackResource(id, type, resource, options = {}) {
    try {
      if (!this.resourceTypes[type]) {
        logger.warn(`Unknown resource type: ${type}`);
        return;
      }
      
      const resourceInfo = {
        id,
        type,
        resource,
        options,
        timestamp: Date.now(),
        lastAccessed: Date.now(),
        accessCount: 0,
        size: this.estimateResourceSize(resource)
      };
      
      this.resources.set(id, resourceInfo);
      this.resourceTypes[type].count++;
      
      logger.debug(`Tracked resource: ${id} (${type})`);
      
    } catch (error) {
      logger.error('Failed to track resource:', error);
    }
  }

  /**
   * Untrack a resource
   * @param {string} id - Resource ID
   */
  untrackResource(id) {
    try {
      const resourceInfo = this.resources.get(id);
      if (resourceInfo) {
        this.resourceTypes[resourceInfo.type].count--;
        this.resources.delete(id);
        logger.debug(`Untracked resource: ${id}`);
      }
    } catch (error) {
      logger.error('Failed to untrack resource:', error);
    }
  }

  /**
   * Register event listener
   * @param {string} id - Listener ID
   * @param {Element|Window} target - Event target
   * @param {string} event - Event type
   * @param {Function} handler - Event handler
   * @param {Object} options - Event options
   */
  registerEventListener(id, target, event, handler, options = {}) {
    try {
      target.addEventListener(event, handler, options);
      
      this.trackResource(id, 'eventListener', {
        target,
        event,
        handler,
        options
      });
      
      // Store for cleanup
      if (!this.eventListeners.has(target)) {
        this.eventListeners.set(target, new Map());
      }
      this.eventListeners.get(target).set(event, new Map());
      this.eventListeners.get(target).get(event).set(id, handler);
      
    } catch (error) {
      logger.error('Failed to register event listener:', error);
    }
  }

  /**
   * Unregister event listener
   * @param {string} id - Listener ID
   */
  unregisterEventListener(id) {
    try {
      const resourceInfo = this.resources.get(id);
      if (resourceInfo && resourceInfo.type === 'eventListener') {
        const { target, event, handler } = resourceInfo.resource;
        target.removeEventListener(event, handler);
        this.untrackResource(id);
      }
    } catch (error) {
      logger.error('Failed to unregister event listener:', error);
    }
  }

  /**
   * Register timer
   * @param {string} id - Timer ID
   * @param {number} delay - Delay in milliseconds
   * @param {Function} callback - Timer callback
   * @param {boolean} recurring - Whether timer is recurring
   */
  registerTimer(id, delay, callback, recurring = false) {
    try {
      const timerId = recurring ? setInterval(callback, delay) : setTimeout(callback, delay);
      
      this.trackResource(id, 'timer', {
        timerId,
        recurring,
        callback
      });
      
      this.timers.set(id, timerId);
      
    } catch (error) {
      logger.error('Failed to register timer:', error);
    }
  }

  /**
   * Unregister timer
   * @param {string} id - Timer ID
   */
  unregisterTimer(id) {
    try {
      const timerId = this.timers.get(id);
      if (timerId) {
        if (typeof timerId === 'number') {
          clearTimeout(timerId);
        } else {
          clearInterval(timerId);
        }
        this.timers.delete(id);
        this.untrackResource(id);
      }
    } catch (error) {
      logger.error('Failed to unregister timer:', error);
    }
  }

  /**
   * Register observer
   * @param {string} id - Observer ID
   * @param {IntersectionObserver|MutationObserver} observer - Observer instance
   * @param {Object} options - Observer options
   */
  registerObserver(id, observer, options = {}) {
    try {
      this.trackResource(id, 'observer', {
        observer,
        options
      });
      
      this.observers.set(id, observer);
      
    } catch (error) {
      logger.error('Failed to register observer:', error);
    }
  }

  /**
   * Unregister observer
   * @param {string} id - Observer ID
   */
  unregisterObserver(id) {
    try {
      const observer = this.observers.get(id);
      if (observer && typeof observer.disconnect === 'function') {
        observer.disconnect();
        this.observers.delete(id);
        this.untrackResource(id);
      }
    } catch (error) {
      logger.error('Failed to unregister observer:', error);
    }
  }

  /**
   * Register cache
   * @param {string} id - Cache ID
   * @param {Map|Object} cache - Cache instance
   * @param {Object} options - Cache options
   */
  registerCache(id, cache, options = {}) {
    try {
      this.trackResource(id, 'cache', {
        cache,
        options
      });
      
      this.caches.set(id, {
        cache,
        options,
        timestamp: Date.now()
      });
      
    } catch (error) {
      logger.error('Failed to register cache:', error);
    }
  }

  /**
   * Unregister cache
   * @param {string} id - Cache ID
   */
  unregisterCache(id) {
    try {
      const cacheInfo = this.caches.get(id);
      if (cacheInfo && typeof cacheInfo.cache.clear === 'function') {
        cacheInfo.cache.clear();
        this.caches.delete(id);
        this.untrackResource(id);
      }
    } catch (error) {
      logger.error('Failed to unregister cache:', error);
    }
  }

  /**
   * Register DOM element
   * @param {string} id - Element ID
   * @param {Element} element - DOM element
   * @param {Object} options - Element options
   */
  registerDOMElement(id, element, options = {}) {
    try {
      this.trackResource(id, 'dom', {
        element,
        options
      });
      
      // Add data attribute for tracking
      element.setAttribute('data-resource-id', id);
      
    } catch (error) {
      logger.error('Failed to register DOM element:', error);
    }
  }

  /**
   * Unregister DOM element
   * @param {string} id - Element ID
   */
  unregisterDOMElement(id) {
    try {
      const resourceInfo = this.resources.get(id);
      if (resourceInfo && resourceInfo.type === 'dom') {
        const { element } = resourceInfo.resource;
        if (element && element.parentNode) {
          element.parentNode.removeChild(element);
        }
        element.removeAttribute('data-resource-id');
        this.untrackResource(id);
      }
    } catch (error) {
      logger.error('Failed to unregister DOM element:', error);
    }
  }

  /**
   * Register cleanup task
   * @param {string} id - Task ID
   * @param {Function} cleanupFn - Cleanup function
   * @param {Object} options - Task options
   */
  registerCleanupTask(id, cleanupFn, options = {}) {
    try {
      this.cleanupTasks.set(id, {
        cleanupFn,
        options,
        timestamp: Date.now(),
        executed: false
      });
      
    } catch (error) {
      logger.error('Failed to register cleanup task:', error);
    }
  }

  /**
   * Execute cleanup task
   * @param {string} id - Task ID
   */
  executeCleanupTask(id) {
    try {
      const task = this.cleanupTasks.get(id);
      if (task && !task.executed) {
        task.cleanupFn();
        task.executed = true;
        this.cleanupTasks.delete(id);
        logger.debug(`Executed cleanup task: ${id}`);
      }
    } catch (error) {
      logger.error('Failed to execute cleanup task:', error);
    }
  }

  /**
   * Check memory usage
   */
  checkMemoryUsage() {
    try {
      if (performance.memory) {
        const usedJSHeapSize = performance.memory.usedJSHeapSize;
        const totalJSHeapSize = performance.memory.totalJSHeapSize;
        const jsHeapSizeLimit = performance.memory.jsHeapSizeLimit;
        
        const memoryUsage = {
          used: usedJSHeapSize,
          total: totalJSHeapSize,
          limit: jsHeapSizeLimit,
          percentage: (usedJSHeapSize / jsHeapSizeLimit) * 100
        };
        
        // Log memory usage
        logger.debug('Memory usage:', memoryUsage);
        
        // Check thresholds
        if (usedJSHeapSize > this.memoryThresholds.critical) {
          logger.warn('Critical memory usage detected:', memoryUsage);
          this.emergencyCleanup();
        } else if (usedJSHeapSize > this.memoryThresholds.warning) {
          logger.warn('High memory usage detected:', memoryUsage);
          this.aggressiveCleanup();
        }
        
        return memoryUsage;
      }
    } catch (error) {
      logger.error('Failed to check memory usage:', error);
    }
  }

  /**
   * Check memory growth
   */
  checkMemoryGrowth() {
    try {
      if (performance.memory) {
        const currentUsage = performance.memory.usedJSHeapSize;
        const lastCheck = this.lastMemoryCheck || currentUsage;
        const growth = currentUsage - lastCheck;
        
        this.lastMemoryCheck = currentUsage;
        
        // If memory is growing rapidly, trigger cleanup
        if (growth > 10 * 1024 * 1024) { // 10MB growth
          logger.warn('Rapid memory growth detected:', { growth });
          this.aggressiveCleanup();
        }
      }
    } catch (error) {
      logger.error('Failed to check memory growth:', error);
    }
  }

  /**
   * Cleanup unused resources
   */
  cleanupUnusedResources() {
    try {
      const now = Date.now();
      const unusedThreshold = 5 * 60 * 1000; // 5 minutes
      
      for (const [id, resourceInfo] of this.resources.entries()) {
        const timeSinceAccess = now - resourceInfo.lastAccessed;
        
        if (timeSinceAccess > unusedThreshold) {
          this.cleanupResource(id);
        }
      }
      
    } catch (error) {
      logger.error('Failed to cleanup unused resources:', error);
    }
  }

  /**
   * Cleanup orphaned DOM elements
   */
  cleanupOrphanedDOM() {
    try {
      // Find orphaned elements with resource tracking
      const orphanedElements = document.querySelectorAll('[data-resource-id]');
      
      orphanedElements.forEach(element => {
        const resourceId = element.getAttribute('data-resource-id');
        const resourceInfo = this.resources.get(resourceId);
        
        // Check if element is actually orphaned
        if (!element.parentNode || !document.contains(element)) {
          this.unregisterDOMElement(resourceId);
        }
      });
      
    } catch (error) {
      logger.error('Failed to cleanup orphaned DOM:', error);
    }
  }

  /**
   * Cleanup expired cache entries
   */
  cleanupExpiredCache() {
    try {
      const now = Date.now();
      const expiredThreshold = 10 * 60 * 1000; // 10 minutes
      
      for (const [id, cacheInfo] of this.caches.entries()) {
        const age = now - cacheInfo.timestamp;
        
        if (age > expiredThreshold) {
          this.unregisterCache(id);
        }
      }
      
    } catch (error) {
      logger.error('Failed to cleanup expired cache:', error);
    }
  }

  /**
   * Cleanup a specific resource
   * @param {string} id - Resource ID
   */
  cleanupResource(id) {
    try {
      const resourceInfo = this.resources.get(id);
      if (!resourceInfo) return;
      
      switch (resourceInfo.type) {
        case 'eventListener':
          this.unregisterEventListener(id);
          break;
        case 'timer':
          this.unregisterTimer(id);
          break;
        case 'observer':
          this.unregisterObserver(id);
          break;
        case 'cache':
          this.unregisterCache(id);
          break;
        case 'dom':
          this.unregisterDOMElement(id);
          break;
        default:
          this.untrackResource(id);
      }
      
      logger.debug(`Cleaned up resource: ${id}`);
      
    } catch (error) {
      logger.error('Failed to cleanup resource:', error);
    }
  }

  /**
   * Emergency cleanup for critical memory situations
   */
  emergencyCleanup() {
    try {
      logger.warn('Performing emergency cleanup');
      
      // Stop all periodic cleanup
      this.cleanupIntervals.forEach((intervalId, key) => {
        clearInterval(intervalId);
        this.cleanupIntervals.delete(key);
      });
      
      // Clean up all resources
      for (const id of this.resources.keys()) {
        this.cleanupResource(id);
      }
      
      // Force garbage collection hint
      if (window.gc) {
        window.gc();
      }
      
      // Dispatch emergency cleanup event
      this.dispatchResourceEvent('emergencyCleanup', {
        reason: 'critical_memory_usage'
      });
      
    } catch (error) {
      logger.error('Emergency cleanup failed:', error);
    }
  }

  /**
   * Aggressive cleanup for high memory usage
   */
  aggressiveCleanup() {
    try {
      logger.warn('Performing aggressive cleanup');
      
      // Clean up unused resources
      this.cleanupUnusedResources();
      
      // Clean up caches
      this.caches.forEach((cacheInfo, id) => {
        this.unregisterCache(id);
      });
      
      // Clean up timers
      this.timers.forEach((timerId, id) => {
        this.unregisterTimer(id);
      });
      
      // Dispatch aggressive cleanup event
      this.dispatchResourceEvent('aggressiveCleanup', {
        reason: 'high_memory_usage'
      });
      
    } catch (error) {
      logger.error('Aggressive cleanup failed:', error);
    }
  }

  /**
   * Handle page hidden
   */
  handlePageHidden() {
    try {
      logger.debug('Page hidden, pausing resource usage');
      
      // Pause periodic cleanup
      this.cleanupIntervals.forEach((intervalId, key) => {
        clearInterval(intervalId);
        this.pausedIntervals = this.pausedIntervals || new Map();
        this.pausedIntervals.set(key, intervalId);
      });
      
      // Pause memory monitoring
      this.memoryMonitors.forEach((intervalId, key) => {
        clearInterval(intervalId);
        this.pausedMonitors = this.pausedMonitors || new Map();
        this.pausedMonitors.set(key, intervalId);
      });
      
    } catch (error) {
      logger.error('Failed to handle page hidden:', error);
    }
  }

  /**
   * Handle page visible
   */
  handlePageVisible() {
    try {
      logger.debug('Page visible, resuming resource usage');
      
      // Resume periodic cleanup
      if (this.pausedIntervals) {
        this.pausedIntervals.forEach((intervalId, key) => {
          const newIntervalId = setInterval(() => {
            this.cleanupUnusedResources();
          }, 5 * 60 * 1000);
          this.cleanupIntervals.set(key, newIntervalId);
        });
        this.pausedIntervals.clear();
      }
      
      // Resume memory monitoring
      if (this.pausedMonitors) {
        this.pausedMonitors.forEach((intervalId, key) => {
          const newIntervalId = setInterval(() => {
            this.checkMemoryUsage();
          }, 30000);
          this.memoryMonitors.set(key, newIntervalId);
        });
        this.pausedMonitors.clear();
      }
      
    } catch (error) {
      logger.error('Failed to handle page visible:', error);
    }
  }

  /**
   * Handle before unload
   */
  handleBeforeUnload() {
    try {
      logger.debug('Before unload, performing final cleanup');
      
      // Execute all cleanup tasks
      for (const [id, task] of this.cleanupTasks.entries()) {
        if (!task.executed) {
          this.executeCleanupTask(id);
        }
      }
      
      // Clean up all resources
      for (const id of this.resources.keys()) {
        this.cleanupResource(id);
      }
      
      // Clear all intervals and timeouts
      this.cleanupIntervals.forEach((intervalId, key) => {
        clearInterval(intervalId);
      });
      this.timers.forEach((timerId, id) => {
        this.unregisterTimer(id);
      });
      
    } catch (error) {
      logger.error('Failed to handle before unload:', error);
    }
  }

  /**
   * Estimate resource size
   * @param {any} resource - Resource to estimate
   * @returns {number} Estimated size in bytes
   */
  estimateResourceSize(resource) {
    try {
      if (typeof resource === 'string') {
        return resource.length * 2; // Rough estimate for strings
      } else if (typeof resource === 'object' && resource !== null) {
        // Rough estimate for objects
        return JSON.stringify(resource).length * 2;
      }
      return 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Dispatch resource event
   * @param {string} type - Event type
   * @param {Object} data - Event data
   */
  dispatchResourceEvent(type, data) {
    try {
      const event = new CustomEvent('scpResourceEvent', {
        detail: {
          type,
          data,
          timestamp: Date.now()
        },
        bubbles: true,
        cancelable: true
      });
      
      document.dispatchEvent(event);
    } catch (error) {
      logger.error('Failed to dispatch resource event:', error);
    }
  }

  /**
   * Get resource statistics
   * @returns {Object} Resource statistics
   */
  getResourceStats() {
    const stats = {
      totalResources: this.resources.size,
      byType: {},
      memoryUsage: null,
      cleanupTasks: this.cleanupTasks.size,
      eventListeners: 0,
      timers: this.timers.size,
      observers: this.observers.size,
      caches: this.caches.size
    };
    
    // Count by type
    this.resourceTypes.forEach((config, type) => {
      stats.byType[type] = {
        count: config.count,
        cleanupMethod: config.cleanup
      };
    });
    
    // Count event listeners
    this.eventListeners.forEach((targetMap) => {
      targetMap.forEach((eventMap) => {
        stats.eventListeners += eventMap.size;
      });
    });
    
    // Get memory usage
    if (performance.memory) {
      stats.memoryUsage = {
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit,
        percentage: (performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100
      };
    }
    
    return stats;
  }

  /**
   * Reset resource statistics
   */
  resetStats() {
    this.resources.clear();
    this.cleanupTasks.clear();
    this.eventListeners.clear();
    this.timers.clear();
    this.observers.clear();
    this.caches.clear();
    
    // Reset resource type counts
    Object.keys(this.resourceTypes).forEach(type => {
      this.resourceTypes[type].count = 0;
    });
    
    logger.info('Resource statistics reset');
  }

  /**
   * Cleanup all resources
   */
  cleanup() {
    try {
      logger.info('Performing complete resource cleanup');
      
      // Handle before unload
      this.handleBeforeUnload();
      
      // Clear all maps
      this.resources.clear();
      this.cleanupTasks.clear();
      this.eventListeners.clear();
      this.timers.clear();
      this.observers.clear();
      this.caches.clear();
      this.cleanupIntervals.clear();
      this.memoryMonitors.clear();
      
      // Reset resource type counts
      Object.keys(this.resourceTypes).forEach(type => {
        this.resourceTypes[type].count = 0;
      });
      
      logger.info('Resource cleanup complete');
      
    } catch (error) {
      logger.error('Resource cleanup failed:', error);
    }
  }
}

// Export singleton instance
const resourceManager = new ResourceManager();

export default resourceManager;