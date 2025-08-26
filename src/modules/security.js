/**
 * Security Module
 * Provides comprehensive security features including input validation, CSP, and XSS protection
 */

import { logger, errorHandler } from '../utils/index.js';

class SecurityModule {
  constructor() {
    this.securityPolicies = new Map();
    this.sanitizers = new Map();
    this.validators = new Map();
    this.rateLimiters = new Map();
    this.cspViolations = [];
    this.maxCspViolations = 100;
    
    // Initialize security features
    this.initialize();
  }

  /**
   * Initialize security module
   */
  initialize() {
    try {
      logger.info('Initializing security module');
      
      // Register security policies
      this.registerSecurityPolicies();
      
      // Register sanitizers
      this.registerSanitizers();
      
      // Register validators
      this.registerValidators();
      
      // Setup CSP violation listener
      this.setupCSPViolationListener();
      
      // Setup security event listeners
      this.setupSecurityEventListeners();
      
      logger.info('Security module initialized successfully');
      
    } catch (error) {
      errorHandler.handleError(error, {
        action: 'security_module_initialize'
      });
    }
  }

  /**
   * Register security policies
   */
  registerSecurityPolicies() {
    // Content Security Policy
    this.registerSecurityPolicy('csp', {
      enabled: true,
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'", "'unsafe-inline'"],
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", 'data:', 'https:'],
        'connect-src': ["'self'", 'https://scp-wiki.wikidot.com', 'https://api.scp-wiki.net'],
        'font-src': ["'self'"],
        'object-src': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"]
      }
    });

    // XSS Protection
    this.registerSecurityPolicy('xss', {
      enabled: true,
      sanitizeDOM: true,
      escapeHTML: true,
      validateInput: true
    });

    // CSRF Protection
    this.registerSecurityPolicy('csrf', {
      enabled: true,
      useSameSiteCookies: true,
      validateToken: true
    });

    // Rate Limiting
    this.registerSecurityPolicy('rate_limit', {
      enabled: true,
      defaultWindow: 60000, // 1 minute
      defaultMax: 100,
      endpoints: {
        'api': { window: 60000, max: 50 },
        'storage': { window: 10000, max: 20 },
        'ui': { window: 5000, max: 10 }
      }
    });
  }

  /**
   * Register security policy
   * @param {string} name - Policy name
   * @param {Object} config - Policy configuration
   */
  registerSecurityPolicy(name, config) {
    this.securityPolicies.set(name, {
      name,
      enabled: config.enabled !== false,
      config: config.config || config,
      violations: 0,
      lastViolation: null
    });
    
    logger.debug(`Registered security policy: ${name}`);
  }

  /**
   * Register sanitizers
   */
  registerSanitizers() {
    // HTML Sanitizer
    this.registerSanitizer('html', (input) => {
      return this.sanitizeHTML(input);
    });

    // CSS Sanitizer
    this.registerSanitizer('css', (input) => {
      return this.sanitizeCSS(input);
    });

    // URL Sanitizer
    this.registerSanitizer('url', (input) => {
      return this.sanitizeURL(input);
    });

    // JSON Sanitizer
    this.registerSanitizer('json', (input) => {
      return this.sanitizeJSON(input);
    });
  }

  /**
   * Register sanitizer
   * @param {string} name - Sanitizer name
   * @param {Function} sanitizer - Sanitizer function
   */
  registerSanitizer(name, sanitizer) {
    this.sanitizers.set(name, sanitizer);
    logger.debug(`Registered sanitizer: ${name}`);
  }

  /**
   * Register validators
   */
  registerValidators() {
    // Email Validator
    this.registerValidator('email', (input) => {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
    });

    // URL Validator
    this.registerValidator('url', (input) => {
      try {
        new URL(input);
        return true;
      } catch {
        return false;
      }
    });

    // SCP Number Validator
    this.registerValidator('scpNumber', (input) => {
      return /^\d{3,4}$/.test(input);
    });

    // Tale Name Validator
    this.registerValidator('taleName', (input) => {
      return /^[a-zA-Z0-9-]+$/.test(input);
    });

    // Settings Validator
    this.registerValidator('settings', (input) => {
      if (!input || typeof input !== 'object') return false;
      
      const allowedSettings = ['dictionaryEnabled', 'navigatorEnabled', 'showProgress', 'showReadingTime'];
      const keys = Object.keys(input);
      
      return keys.every(key => allowedSettings.includes(key) && typeof input[key] === 'boolean');
    });
  }

  /**
   * Register validator
   * @param {string} name - Validator name
   * @param {Function} validator - Validator function
   */
  registerValidator(name, validator) {
    this.validators.set(name, validator);
    logger.debug(`Registered validator: ${name}`);
  }

  /**
   * Setup CSP violation listener
   */
  setupCSPViolationListener() {
    try {
      // Add CSP violation listener if available
      if (typeof document !== 'undefined' && 'securityPolicy' in document) {
        document.addEventListener('securitypolicyviolation', (event) => {
          this.handleCSPViolation(event);
        });
      }
    } catch (error) {
      logger.warn('Failed to setup CSP violation listener:', error);
    }
  }

  /**
   * Setup security event listeners
   */
  setupSecurityEventListeners() {
    try {
      // Handle click events with rate limiting
      document.addEventListener('click', (event) => {
        this.handleSecurityEvent('click', event);
      }, { passive: true });

      // Handle form submissions
      document.addEventListener('submit', (event) => {
        this.handleSecurityEvent('submit', event);
      });

      // Handle keyboard events
      document.addEventListener('keydown', (event) => {
        this.handleSecurityEvent('keydown', event);
      }, { passive: true });

    } catch (error) {
      logger.warn('Failed to setup security event listeners:', error);
    }
  }

  /**
   * Handle CSP violation
   * @param {Event} event - CSP violation event
   */
  handleCSPViolation(event) {
    try {
      const violation = {
        timestamp: new Date().toISOString(),
        directive: event.disposition,
        blockedURL: event.blockedURL,
        originalPolicy: event.originalPolicy,
        sourceFile: event.sourceFile,
        lineNumber: event.lineNumber,
        columnNumber: event.columnNumber
      };

      this.cspViolations.push(violation);
      
      // Check violation limit
      if (this.cspViolations.length > this.maxCspViolations) {
        this.cspViolations.shift();
      }

      // Log violation
      logger.warn('CSP violation detected:', violation);

      // Update policy violation count
      const policy = this.securityPolicies.get('csp');
      if (policy) {
        policy.violations++;
        policy.lastViolation = violation.timestamp;
      }

      // Dispatch security event
      this.dispatchSecurityEvent('cspViolation', violation);

    } catch (error) {
      logger.error('Failed to handle CSP violation:', error);
    }
  }

  /**
   * Handle security events
   * @param {string} eventType - Event type
   * @param {Event} event - Event object
   */
  handleSecurityEvent(eventType, event) {
    try {
      // Apply rate limiting
      if (!this.checkRateLimit(eventType)) {
        logger.debug(`Rate limit exceeded for: ${eventType}`);
        event.preventDefault();
        event.stopPropagation();
        return false;
      }

      // Validate event data
      if (!this.validateEventData(eventType, event)) {
        logger.warn(`Invalid event data for: ${eventType}`);
        event.preventDefault();
        event.stopPropagation();
        return false;
      }

      return true;

    } catch (error) {
      logger.error('Failed to handle security event:', error);
      return false;
    }
  }

  /**
   * Check rate limit for action
   * @param {string} action - Action type
   * @param {Object} options - Rate limiting options
   * @returns {boolean} True if allowed
   */
  checkRateLimit(action, options = {}) {
    try {
      const policy = this.securityPolicies.get('rate_limit');
      if (!policy || !policy.enabled) return true;

      const config = policy.config;
      const actionConfig = config.endpoints[action] || {
        window: config.defaultWindow,
        max: config.defaultMax
      };

      const key = `rate_limit_${action}`;
      const now = Date.now();
      const windowStart = now - actionConfig.window;

      // Get or create rate limiter
      let limiter = this.rateLimiters.get(key);
      if (!limiter) {
        limiter = {
          timestamps: [],
          count: 0
        };
        this.rateLimiters.set(key, limiter);
      }

      // Clean old timestamps
      limiter.timestamps = limiter.timestamps.filter(timestamp => timestamp >= windowStart);
      limiter.count = limiter.timestamps.length;

      // Check limit
      if (limiter.count >= actionConfig.max) {
        logger.debug(`Rate limit exceeded for ${action}: ${limiter.count}/${actionConfig.max}`);
        return false;
      }

      // Add current timestamp
      limiter.timestamps.push(now);
      limiter.count++;

      return true;

    } catch (error) {
      logger.error('Rate limit check failed:', error);
      return true; // Allow action if rate limit check fails
    }
  }

  /**
   * Validate event data
   * @param {string} eventType - Event type
   * @param {Event} event - Event object
   * @returns {boolean} True if valid
   */
  validateEventData(eventType, event) {
    try {
      switch (eventType) {
        case 'click':
          return this.validateClickEvent(event);
        case 'submit':
          return this.validateSubmitEvent(event);
        case 'keydown':
          return this.validateKeyEvent(event);
        default:
          return true;
      }
    } catch (error) {
      logger.error('Event validation failed:', error);
      return false;
    }
  }

  /**
   * Validate click event
   * @param {Event} event - Click event
   * @returns {boolean} True if valid
   */
  validateClickEvent(event) {
    const target = event.target;
    
    // Check for potentially malicious attributes
    if (target.hasAttribute('onclick')) {
      const onclick = target.getAttribute('onclick');
      if (this.isPotentiallyMalicious(onclick)) {
        logger.warn('Potentially malicious onclick detected:', onclick);
        return false;
      }
    }

    // Check for dangerous protocols
    if (target.tagName === 'A' && target.href) {
      const href = target.href;
      if (href.startsWith('javascript:') || href.startsWith('data:')) {
        logger.warn('Dangerous href detected:', href);
        return false;
      }
    }

    return true;
  }

  /**
   * Validate submit event
   * @param {Event} event - Submit event
   * @returns {boolean} True if valid
   */
  validateSubmitEvent(event) {
    const form = event.target;
    
    // Check form action
    if (form.action) {
      try {
        const url = new URL(form.action);
        if (!url.origin.includes(window.location.origin)) {
          logger.warn('Form submission to external domain:', form.action);
          return false;
        }
      } catch (error) {
        logger.warn('Invalid form action URL:', form.action);
        return false;
      }
    }

    // Check for hidden inputs
    const hiddenInputs = form.querySelectorAll('input[type="hidden"]');
    hiddenInputs.forEach(input => {
      if (this.isPotentiallyMalicious(input.value)) {
        logger.warn('Potentially malicious hidden input value detected');
        return false;
      }
    });

    return true;
  }

  /**
   * Validate key event
   * @param {Event} event - Key event
   * @returns {boolean} True if valid
   */
  validateKeyEvent(event) {
    // Check for dangerous key combinations
    if (event.ctrlKey && event.shiftKey && event.key === 'I') {
      // Ctrl+Shift+I (Developer tools)
      logger.debug('Developer tools shortcut detected');
      return true; // Allow, but log
    }

    if (event.ctrlKey && event.shiftKey && event.key === 'C') {
      // Ctrl+Shift+C (Inspect element)
      logger.debug('Inspect element shortcut detected');
      return true; // Allow, but log
    }

    return true;
  }

  /**
   * Check if content is potentially malicious
   * @param {string} content - Content to check
   * @returns {boolean} True if potentially malicious
   */
  isPotentiallyMalicious(content) {
    if (!content || typeof content !== 'string') return false;

    const maliciousPatterns = [
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /eval\s*\(/gi,
      /document\./gi,
      /window\./gi,
      /alert\s*\(/gi,
      /confirm\s*\(/gi,
      /prompt\s*\(/gi
    ];

    return maliciousPatterns.some(pattern => pattern.test(content));
  }

  /**
   * Sanitize HTML content
   * @param {string} html - HTML to sanitize
   * @returns {string} Sanitized HTML
   */
  sanitizeHTML(html) {
    if (!html || typeof html !== 'string') return '';

    // Remove script tags and event handlers
    let sanitized = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .replace(/javascript:/gi, '');

    // Escape dangerous characters
    sanitized = sanitized
      .replace(/&/g, '&')
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/"/g, '"')
      .replace(/'/g, '&#x27;');

    return sanitized;
  }

  /**
   * Sanitize CSS content
   * @param {string} css - CSS to sanitize
   * @returns {string} Sanitized CSS
   */
  sanitizeCSS(css) {
    if (!css || typeof css !== 'string') return '';

    // Remove potentially dangerous CSS
    let sanitized = css
      .replace(/expression\(.*?\)/gi, '')
      .replace(/-moz-binding\s*:\s*url\(.*?\)/gi, '')
      .replace(/behavior\s*:\s*url\(.*?\)/gi, '');

    return sanitized;
  }

  /**
   * Sanitize URL
   * @param {string} url - URL to sanitize
   * @returns {string} Sanitized URL
   */
  sanitizeURL(url) {
    if (!url || typeof url !== 'string') return '';

    try {
      const urlObj = new URL(url);
      
      // Only allow safe protocols
      const allowedProtocols = ['http:', 'https:', 'mailto:', 'tel:', 'data:'];
      if (!allowedProtocols.includes(urlObj.protocol)) {
        logger.warn('Blocked URL with unsafe protocol:', url);
        return '';
      }

      // Remove dangerous parameters
      const dangerousParams = ['javascript:', 'data:'];
      const searchParams = new URLSearchParams(urlObj.search);
      searchParams.forEach((value, key) => {
        if (dangerousParams.some(param => value.includes(param))) {
          searchParams.delete(key);
        }
      });

      urlObj.search = searchParams.toString();
      return urlObj.toString();

    } catch (error) {
      logger.warn('Invalid URL:', url);
      return '';
    }
  }

  /**
   * Sanitize JSON
   * @param {string} json - JSON to sanitize
   * @returns {string} Sanitized JSON
   */
  sanitizeJSON(json) {
    if (!json || typeof json !== 'string') return '';

    try {
      const parsed = JSON.parse(json);
      
      // Recursively sanitize object
      const sanitize = (obj) => {
        if (typeof obj === 'string') {
          return this.sanitizeHTML(obj);
        } else if (Array.isArray(obj)) {
          return obj.map(sanitize);
        } else if (obj && typeof obj === 'object') {
          const sanitized = {};
          for (const [key, value] of Object.entries(obj)) {
            sanitized[key] = sanitize(value);
          }
          return sanitized;
        }
        return obj;
      };

      return JSON.stringify(sanitize(parsed));

    } catch (error) {
      logger.warn('Invalid JSON:', json);
      return '{}';
    }
  }

  /**
   * Validate input using registered validator
   * @param {string} type - Validator type
   * @param {any} input - Input to validate
   * @returns {boolean} True if valid
   */
  validate(type, input) {
    const validator = this.validators.get(type);
    if (!validator) {
      logger.warn(`No validator registered for type: ${type}`);
      return true;
    }

    try {
      const isValid = validator(input);
      if (!isValid) {
        logger.debug(`Validation failed for type: ${type}`, input);
      }
      return isValid;
    } catch (error) {
      logger.error(`Validation error for type: ${type}`, error);
      return false;
    }
  }

  /**
   * Sanitize input using registered sanitizer
   * @param {string} type - Sanitizer type
   * @param {any} input - Input to sanitize
   * @returns {any} Sanitized input
   */
  sanitize(type, input) {
    const sanitizer = this.sanitizers.get(type);
    if (!sanitizer) {
      logger.warn(`No sanitizer registered for type: ${type}`);
      return input;
    }

    try {
      return sanitizer(input);
    } catch (error) {
      logger.error(`Sanitization error for type: ${type}`, error);
      return input;
    }
  }

  /**
   * Get security policy status
   * @param {string} name - Policy name
   * @returns {Object} Policy status
   */
  getPolicyStatus(name) {
    const policy = this.securityPolicies.get(name);
    if (!policy) {
      return { exists: false };
    }

    return {
      exists: true,
      enabled: policy.enabled,
      violations: policy.violations,
      lastViolation: policy.lastViolation
    };
  }

  /**
   * Dispatch security event
   * @param {string} type - Event type
   * @param {Object} data - Event data
   */
  dispatchSecurityEvent(type, data) {
    try {
      const event = new CustomEvent('scpSecurityEvent', {
        detail: {
          type,
          data,
          timestamp: new Date().toISOString()
        },
        bubbles: true,
        cancelable: true
      });
      
      document.dispatchEvent(event);
    } catch (error) {
      logger.error('Failed to dispatch security event:', error);
    }
  }

  /**
   * Get security statistics
   * @returns {Object} Security statistics
   */
  getSecurityStats() {
    const stats = {
      policies: {},
      violations: {
        csp: this.cspViolations.length,
        rateLimit: Array.from(this.rateLimiters.values()).reduce((sum, limiter) => sum + limiter.count, 0)
      },
      sanitizers: this.sanitizers.size,
      validators: this.validators.size
    };

    // Get policy statistics
    this.securityPolicies.forEach((policy, name) => {
      stats.policies[name] = {
        enabled: policy.enabled,
        violations: policy.violations,
        lastViolation: policy.lastViolation
      };
    });

    return stats;
  }

  /**
   * Reset security statistics
   */
  resetStats() {
    this.securityPolicies.forEach(policy => {
      policy.violations = 0;
      policy.lastViolation = null;
    });

    this.cspViolations = [];
    this.rateLimiters.clear();

    logger.info('Security statistics reset');
  }

  /**
   * Cleanup security resources
   */
  cleanup() {
    try {
      this.securityPolicies.clear();
      this.sanitizers.clear();
      this.validators.clear();
      this.rateLimiters.clear();
      this.cspViolations = [];

      logger.info('Security module cleanup complete');
    } catch (error) {
      logger.error('Security module cleanup failed:', error);
    }
  }
}

// Export singleton instance
const securityModule = new SecurityModule();

export default securityModule;