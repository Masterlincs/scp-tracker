/**
 * Performance Module
 * Implements lazy loading, efficient algorithms, and performance monitoring
 */

import { logger, errorHandler } from '../utils/index.js';

class PerformanceModule {
  constructor() {
    this.lazyLoaders = new Map();
    this.performanceMetrics = new Map();
    this.optimizationStrategies = new Map();
    this.cache = new Map();
    this.cacheSize = 100;
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    
    // Performance thresholds
    this.thresholds = {
      slowOperation: 100, // ms
      memoryWarning: 50 * 1024 * 1024, // 50MB
      cpuWarning: 80 // percentage
    };
    
    // Initialize performance monitoring
    this.initialize();
  }

  /**
   * Initialize performance module
   */
  initialize() {
    try {
      logger.info('Initializing performance module');
      
      // Register optimization strategies
      this.registerOptimizationStrategies();
      
      // Setup performance monitoring
      this.setupPerformanceMonitoring();
      
      // Setup lazy loading
      this.setupLazyLoading();
      
      // Setup caching
      this.setupCaching();
      
      logger.info('Performance module initialized successfully');
      
    } catch (error) {
      errorHandler.handleError(error, {
        action: 'performance_module_initialize'
      });
    }
  }

  /**
   * Register optimization strategies
   */
  registerOptimizationStrategies() {
    // Debounce strategy
    this.registerOptimizationStrategy('debounce', {
      enabled: true,
      defaultDelay: 300,
      strategies: {
        'scroll': 100,
        'resize': 250,
        'input': 500
      }
    });

    // Throttle strategy
    this.registerOptimizationStrategy('throttle', {
      enabled: true,
      defaultDelay: 100,
      strategies: {
        'mousemove': 16, // ~60fps
        'scroll': 50,
        'raf': 16
      }
    });

    // Lazy loading strategy
    this.registerOptimizationStrategy('lazyLoad', {
      enabled: true,
      rootMargin: '50px',
      threshold: 0.1
    });

    // Virtual scrolling strategy
    this.registerOptimizationStrategy('virtualScroll', {
      enabled: true,
      itemHeight: 50,
      bufferSize: 5
    });
  }

  /**
   * Register optimization strategy
   * @param {string} name - Strategy name
   * @param {Object} config - Strategy configuration
   */
  registerOptimizationStrategy(name, config) {
    this.optimizationStrategies.set(name, {
      name,
      enabled: config.enabled !== false,
      config: config.config || config,
      usageCount: 0,
      totalTime: 0,
      averageTime: 0
    });
    
    logger.debug(`Registered optimization strategy: ${name}`);
  }

  /**
   * Setup performance monitoring
   */
  setupPerformanceMonitoring() {
    try {
      // Monitor long tasks
      if ('PerformanceLongTaskTiming' in window) {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.handleLongTask(entry);
          }
        });
        observer.observe({ entryTypes: ['longtask'] });
      }

      // Monitor paint timing
      if ('PerformancePaintTiming' in window) {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.handlePaintTiming(entry);
          }
        });
        observer.observe({ entryTypes: ['paint'] });
      }

      // Monitor resource timing
      if ('PerformanceResourceTiming' in window) {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.handleResourceTiming(entry);
          }
        });
        observer.observe({ entryTypes: ['resource'] });
      }

      // Monitor memory usage
      if (performance.memory) {
        setInterval(() => {
          this.checkMemoryUsage();
        }, 10000); // Check every 10 seconds
      }

      // Monitor CPU usage
      if ('measureUserAgentSpecificMemory' in performance) {
        setInterval(() => {
          this.checkCPUUsage();
        }, 30000); // Check every 30 seconds
      }

    } catch (error) {
      logger.warn('Failed to setup performance monitoring:', error);
    }
  }

  /**
   * Setup lazy loading
   */
  setupLazyLoading() {
    try {
      // Create intersection observer for lazy loading
      this.intersectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            this.handleLazyLoad(entry.target);
          }
        });
      }, {
        rootMargin: '50px',
        threshold: 0.1
      });

      // Setup mutation observer for dynamic content
      this.mutationObserver = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              this.setupLazyLoadElements(node);
            }
          });
        });
      });

      // Start observing the document
      this.mutationObserver.observe(document.body, {
        childList: true,
        subtree: true
      });

    } catch (error) {
      logger.warn('Failed to setup lazy loading:', error);
    }
  }

  /**
   * Setup caching
   */
  setupCaching() {
    // Setup cache cleanup interval
    setInterval(() => {
      this.cleanupCache();
    }, this.cacheTimeout);
  }

  /**
   * Handle long task detection
   * @param {PerformanceEntry} entry - Long task entry
   */
  handleLongTask(entry) {
    try {
      const metric = {
        type: 'longtask',
        duration: entry.duration,
        startTime: entry.startTime,
        name: entry.name,
        attribution: entry.attribution
      };

      this.recordPerformanceMetric('longtask', metric);

      if (entry.duration > this.thresholds.slowOperation) {
        logger.warn('Long task detected:', metric);
        this.dispatchPerformanceEvent('longtask', metric);
      }

    } catch (error) {
      logger.error('Failed to handle long task:', error);
    }
  }

  /**
   * Handle paint timing
   * @param {PerformanceEntry} entry - Paint timing entry
   */
  handlePaintTiming(entry) {
    try {
      const metric = {
        type: 'paint',
        name: entry.name,
        startTime: entry.startTime,
        duration: entry.duration
      };

      this.recordPerformanceMetric('paint', metric);

      if (entry.name === 'first-contentful-paint' && entry.startTime > 2000) {
        logger.warn('Slow first contentful paint:', metric);
      }

    } catch (error) {
      logger.error('Failed to handle paint timing:', error);
    }
  }

  /**
   * Handle resource timing
   * @param {PerformanceEntry} entry - Resource timing entry
   */
  handleResourceTiming(entry) {
    try {
      const metric = {
        type: 'resource',
        name: entry.name,
        duration: entry.duration,
        size: entry.transferSize,
        initiatorType: entry.initiatorType
      };

      this.recordPerformanceMetric('resource', metric);

      if (entry.duration > 1000) {
        logger.warn('Slow resource load:', metric);
      }

    } catch (error) {
      logger.error('Failed to handle resource timing:', error);
    }
  }

  /**
   * Check memory usage
   */
  checkMemoryUsage() {
    try {
      if (performance.memory) {
        const memory = performance.memory;
        const usedJSHeapSize = memory.usedJSHeapSize;
        const totalJSHeapSize = memory.totalJSHeapSize;
        const jsHeapSizeLimit = memory.jsHeapSizeLimit;

        const memoryUsage = {
          used: usedJSHeapSize,
          total: totalJSHeapSize,
          limit: jsHeapSizeLimit,
          percentage: (usedJSHeapSize / jsHeapSizeLimit) * 100
        };

        this.recordPerformanceMetric('memory', memoryUsage);

        if (usedJSHeapSize > this.thresholds.memoryWarning) {
          logger.warn('High memory usage detected:', memoryUsage);
          this.dispatchPerformanceEvent('memoryWarning', memoryUsage);
        }
      }

    } catch (error) {
      logger.error('Failed to check memory usage:', error);
    }
  }

  /**
   * Check CPU usage
   */
  checkCPUUsage() {
    try {
      if ('measureUserAgentSpecificMemory' in performance) {
        const memory = performance.measureUserAgentSpecificMemory();
        const cpuUsage = {
          bytes: memory.bytes,
          limit: memory.jsHeapSizeLimit
        };

        this.recordPerformanceMetric('cpu', cpuUsage);

        if (cpuUsage.bytes > this.thresholds.memoryWarning) {
          logger.warn('High CPU usage detected:', cpuUsage);
          this.dispatchPerformanceEvent('cpuWarning', cpuUsage);
        }
      }

    } catch (error) {
      logger.error('Failed to check CPU usage:', error);
    }
  }

  /**
   * Record performance metric
   * @param {string} type - Metric type
   * @param {Object} metric - Metric data
   */
  recordPerformanceMetric(type, metric) {
    if (!this.performanceMetrics.has(type)) {
      this.performanceMetrics.set(type, []);
    }

    const metrics = this.performanceMetrics.get(type);
    metrics.push({
      ...metric,
      timestamp: Date.now()
    });

    // Keep only recent metrics
    if (metrics.length > 100) {
      metrics.shift();
    }
  }

  /**
   * Setup lazy load elements
   * @param {Element} element - Element to setup
   */
  setupLazyLoadElements(element) {
    try {
      const lazyElements = element.querySelectorAll('[data-lazy]');
      lazyElements.forEach(el => {
        this.intersectionObserver.observe(el);
      });
    } catch (error) {
      logger.error('Failed to setup lazy load elements:', error);
    }
  }

  /**
   * Handle lazy load
   * @param {Element} element - Element to lazy load
   */
  handleLazyLoad(element) {
    try {
      const lazyType = element.getAttribute('data-lazy');
      const src = element.getAttribute('data-src') || element.getAttribute('src');

      if (lazyType === 'image' && src) {
        element.src = src;
        element.removeAttribute('data-lazy');
        element.removeAttribute('data-src');
        this.intersectionObserver.unobserve(element);
      }

      if (lazyType === 'component') {
        this.loadLazyComponent(element);
      }

    } catch (error) {
      logger.error('Failed to handle lazy load:', error);
    }
  }

  /**
   * Load lazy component
   * @param {Element} element - Element to load component for
   */
  async loadLazyComponent(element) {
    try {
      const componentName = element.getAttribute('data-component');
      let component = await this.getFromCache(`component:${componentName}`);

      if (!component) {
        // Load component dynamically
        // Restrict dynamic imports to a safelisted set of components to avoid
        // bundling every file in this directory (e.g., legacy scp-detector.js)
        const loaders = {
          'accessibility': () => import('./accessibility.js'),
          'analytics': () => import('./analytics.js'),
          'dictionary': () => import('./dictionary.js'),
          'error-boundary': () => import('./error-boundary.js'),
          'link-previews': () => import('./link-previews.js'),
          'reader': () => import('./reader.js'),
          'resource-manager': () => import('./resource-manager.js'),
          'security': () => import('./security.js'),
          'ui-components': () => import('./ui-components.js')
        };

        const loader = loaders[componentName];
        if (!loader) {
          logger.warn(`Unknown lazy component: ${componentName}`);
          return;
        }

        const module = await loader();
        component = module.default;
        this.setCache(`component:${componentName}`, component);
      }

      // Render component
      if (typeof component === 'function') {
        const rendered = component(element);
        element.innerHTML = rendered;
      }

      element.removeAttribute('data-lazy');
      element.removeAttribute('data-component');
      this.intersectionObserver.unobserve(element);

    } catch (error) {
      logger.error('Failed to load lazy component:', error);
    }
  }

  /**
   * Debounce function
   * @param {Function} func - Function to debounce
   * @param {number} delay - Delay in milliseconds
   * @param {string} strategy - Strategy name
   * @returns {Function} Debounced function
   */
  debounce(func, delay = 300, strategy = 'default') {
    const strategyConfig = this.optimizationStrategies.get('debounce');
    const actualDelay = strategyConfig.strategies[strategy] || strategyConfig.defaultDelay;

    let timeoutId;
    
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        func.apply(this, args);
      }, actualDelay);
    };
  }

  /**
   * Throttle function
   * @param {Function} func - Function to throttle
   * @param {number} delay - Delay in milliseconds
   * @param {string} strategy - Strategy name
   * @returns {Function} Throttled function
   */
  throttle(func, delay = 100, strategy = 'default') {
    const strategyConfig = this.optimizationStrategies.get('throttle');
    const actualDelay = strategyConfig.strategies[strategy] || strategyConfig.defaultDelay;

    let lastCall = 0;
    
    return (...args) => {
      const now = Date.now();
      if (now - lastCall >= actualDelay) {
        lastCall = now;
        func.apply(this, args);
      }
    };
  }

  /**
   * Virtual scrolling implementation
   * @param {Object} options - Virtual scrolling options
   * @returns {Object} Virtual scrolling API
   */
  createVirtualScroller(options = {}) {
    const {
      container,
      itemHeight = 50,
      bufferSize = 5,
      renderItem
    } = options;

    const state = {
      scrollTop: 0,
      containerHeight: container.clientHeight,
      totalItems: 0,
      visibleItems: [],
      startIndex: 0,
      endIndex: 0
    };

    const updateVisibleItems = () => {
      const visibleCount = Math.ceil(state.containerHeight / itemHeight) + bufferSize;
      state.startIndex = Math.max(0, Math.floor(state.scrollTop / itemHeight) - bufferSize);
      state.endIndex = Math.min(state.totalItems, state.startIndex + visibleCount);
      
      state.visibleItems = Array.from({ length: state.endIndex - state.startIndex }, (_, i) => ({
        index: state.startIndex + i,
        top: (state.startIndex + i) * itemHeight,
        height: itemHeight
      }));

      // Render visible items
      container.innerHTML = '';
      state.visibleItems.forEach(item => {
        const element = renderItem(item.index);
        element.style.position = 'absolute';
        element.style.top = `${item.top}px`;
        element.style.height = `${item.height}px`;
        container.appendChild(element);
      });

      // Update container height
      container.style.height = `${state.totalItems * itemHeight}px`;
    };

    const scrollToIndex = (index) => {
      state.scrollTop = index * itemHeight;
      container.scrollTop = state.scrollTop;
      updateVisibleItems();
    };

    const updateItemCount = (count) => {
      state.totalItems = count;
      updateVisibleItems();
    };

    // Setup scroll listener
    container.addEventListener('scroll', this.throttle(() => {
      state.scrollTop = container.scrollTop;
      updateVisibleItems();
    }, 16, 'scroll'));

    return {
      scrollToIndex,
      updateItemCount,
      getVisibleItems: () => state.visibleItems,
      getTotalItems: () => state.totalItems
    };
  }

  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {any} Cached value
   */
  getFromCache(key) {
    const item = this.cache.get(key);
    if (item && Date.now() - item.timestamp < this.cacheTimeout) {
      return item.value;
    }
    return null;
  }

  /**
   * Set value in cache
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   */
  setCache(key, value) {
    if (this.cache.size >= this.cacheSize) {
      // Remove oldest item
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
  }

  /**
   * Cleanup expired cache items
   */
  cleanupCache() {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > this.cacheTimeout) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Dispatch performance event
   * @param {string} type - Event type
   * @param {Object} data - Event data
   */
  dispatchPerformanceEvent(type, data) {
    try {
      const event = new CustomEvent('scpPerformanceEvent', {
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
      logger.error('Failed to dispatch performance event:', error);
    }
  }

  /**
   * Get performance statistics
   * @returns {Object} Performance statistics
   */
  getPerformanceStats() {
    const stats = {
      metrics: {},
      cache: {
        size: this.cache.size,
        maxSize: this.cacheSize,
        hitRate: this.calculateCacheHitRate()
      },
      optimization: {}
    };

    // Get metrics
    this.performanceMetrics.forEach((metrics, type) => {
      stats.metrics[type] = {
        count: metrics.length,
        average: this.calculateAverage(metrics),
        max: this.calculateMax(metrics),
        min: this.calculateMin(metrics)
      };
    });

    // Get optimization stats
    this.optimizationStrategies.forEach((strategy, name) => {
      stats.optimization[name] = {
        enabled: strategy.enabled,
        usageCount: strategy.usageCount,
        averageTime: strategy.averageTime
      };
    });

    return stats;
  }

  /**
   * Calculate cache hit rate
   * @returns {number} Hit rate percentage
   */
  calculateCacheHitRate() {
    // This would need to be tracked with cache hits/misses
    // For now, return a placeholder
    return 0;
  }

  /**
   * Calculate average of metrics
   * @param {Array} metrics - Array of metrics
   * @returns {number} Average value
   */
  calculateAverage(metrics) {
    if (metrics.length === 0) return 0;
    const sum = metrics.reduce((acc, metric) => acc + (metric.duration || 0), 0);
    return sum / metrics.length;
  }

  /**
   * Calculate maximum of metrics
   * @param {Array} metrics - Array of metrics
   * @returns {number} Maximum value
   */
  calculateMax(metrics) {
    if (metrics.length === 0) return 0;
    return Math.max(...metrics.map(metric => metric.duration || 0));
  }

  /**
   * Calculate minimum of metrics
   * @param {Array} metrics - Array of metrics
   * @returns {number} Minimum value
   */
  calculateMin(metrics) {
    if (metrics.length === 0) return 0;
    return Math.min(...metrics.map(metric => metric.duration || 0));
  }

  /**
   * Cleanup performance resources
   */
  cleanup() {
    try {
      if (this.intersectionObserver) {
        this.intersectionObserver.disconnect();
      }
      
      if (this.mutationObserver) {
        this.mutationObserver.disconnect();
      }
      
      this.performanceMetrics.clear();
      this.cache.clear();
      this.optimizationStrategies.clear();

      logger.info('Performance module cleanup complete');
    } catch (error) {
      logger.error('Performance module cleanup failed:', error);
    }
  }
}

// Export singleton instance
const performanceModule = new PerformanceModule();

export default performanceModule;