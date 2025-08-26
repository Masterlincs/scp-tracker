/**
 * UI Components Module
 * Handles all user interface elements and interactions
 */

import { logger, errorHandler, performanceMonitor } from '../utils/index.js';

class UIComponents {
  constructor() {
    this.components = new Map();
    this.globalState = {
      pageMarked: false,
      keyboardShortcutListener: null,
      dictionaryTooltipListeners: {
        mouseover: null,
        mouseout: null
      }
    };
    this.cleanupFunctions = new Set();
  }

  /**
   * Show visual feedback when page is marked as read
   */
  showReadFeedback() {
    try {
      performanceMonitor.startMeasure('showReadFeedback');
      
      // Remove any existing feedback
      const existingFeedback = document.getElementById('scp-reader-feedback');
      if (existingFeedback) {
        existingFeedback.remove();
      }
      
      // Create new feedback element with enhanced styling
      const feedback = document.createElement('div');
      feedback.id = 'scp-reader-feedback';
      feedback.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
          <span>Marked as read</span>
        </div>
      `;
      
      this.applyFeedbackStyles(feedback);
      document.body.appendChild(feedback);
      
      // Add animation
      this.addFeedbackAnimation();
      // Trigger fade-in and slide-in after insertion
      requestAnimationFrame(() => {
        feedback.style.opacity = '1';
        feedback.style.animation = 'slideIn 250ms ease-out forwards';
      });
      
      // Auto-remove after 3 seconds
      setTimeout(() => {
        feedback.style.animation = 'slideOut 250ms ease-in forwards';
        feedback.style.opacity = '0';
        setTimeout(() => feedback.remove(), 300);
      }, 3000);
      
      performanceMonitor.endMeasure('showReadFeedback');
      
    } catch (error) {
      errorHandler.handleError(error, {
        action: 'show_read_feedback'
      });
    }
  }

  /**
   * Apply styles to feedback element
   * @param {HTMLElement} element - Feedback element
   */
  applyFeedbackStyles(element) {
    element.style.position = 'fixed';
    element.style.bottom = '20px';
    element.style.right = '20px';
    element.style.backgroundColor = 'rgba(34, 197, 94, 0.95)';
    element.style.color = 'white';
    element.style.padding = '12px 16px';
    element.style.borderRadius = '8px';
    element.style.zIndex = '10000';
    element.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    element.style.fontSize = '14px';
    element.style.fontWeight = '500';
    element.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    element.style.opacity = '0';
    element.style.transition = 'opacity 0.3s ease-out';
    element.style.pointerEvents = 'none';
  }

  /**
   * Add CSS animation for feedback
   */
  addFeedbackAnimation() {
    if (!document.getElementById('scp-feedback-styles')) {
      const style = document.createElement('style');
      style.id = 'scp-feedback-styles';
      style.textContent = `
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        @keyframes slideOut {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(100%);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(style);
    }
  }

  /**
   * Add manual read button to page
   */
  addManualButton() {
    try {
      performanceMonitor.startMeasure('addManualButton');
      
      // Remove existing button
      const existingButton = document.getElementById('scp-manual-read-button');
      if (existingButton) {
        existingButton.remove();
      }
      
      const button = document.createElement('button');
      button.id = 'scp-manual-read-button';
      button.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 11l3 3L22 4"/>
          <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
        </svg>
        Mark as Read
      `;
      
      this.applyButtonStyles(button);
      document.body.appendChild(button);
      
      // Add click event
      button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.onManualButtonClick();
      });
      
      this.components.set('manualButton', button);
      performanceMonitor.endMeasure('addManualButton');
      
    } catch (error) {
      errorHandler.handleError(error, {
        action: 'add_manual_button'
      });
    }
  }

  /**
   * Apply styles to manual button
   * @param {HTMLElement} button - Button element
   */
  applyButtonStyles(button) {
    button.style.position = 'fixed';
    button.style.top = '20px';
    button.style.right = '20px';
    button.style.backgroundColor = '#ff3b30';
    button.style.color = 'white';
    button.style.border = 'none';
    button.style.padding = '10px 16px';
    button.style.borderRadius = '6px';
    button.style.zIndex = '9999';
    button.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    button.style.fontSize = '14px';
    button.style.fontWeight = '500';
    button.style.cursor = 'pointer';
    button.style.display = 'flex';
    button.style.alignItems = 'center';
    button.style.gap = '6px';
    button.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
    button.style.transition = 'all 0.2s ease';
    
    button.addEventListener('mouseenter', () => {
      button.style.backgroundColor = '#d70015';
      button.style.transform = 'translateY(-1px)';
      button.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
    });
    
    button.addEventListener('mouseleave', () => {
      button.style.backgroundColor = '#ff3b30';
      button.style.transform = 'translateY(0)';
      button.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
    });
  }

  /**
   * Handle manual button click
   */
  onManualButtonClick() {
    // Dispatch custom event for other modules to handle
    const event = new CustomEvent('scpManualRead', {
      bubbles: true,
      cancelable: true
    });
    document.dispatchEvent(event);
  }

  /**
   * Add progress indicator to page
   */
  addProgressIndicator() {
    try {
      performanceMonitor.startMeasure('addProgressIndicator');
      
      // Remove existing indicator
      const existingIndicator = document.getElementById('scp-progress-bar');
      if (existingIndicator) {
        existingIndicator.remove();
      }
      
      const indicator = document.createElement('div');
      indicator.id = 'scp-progress-bar';
      indicator.innerHTML = `
        <div class="scp-progress-container">
          <div class="scp-progress-bar"></div>
        </div>
      `;
      
      this.applyProgressStyles(indicator);
      document.body.appendChild(indicator);
      
      this.components.set('progressIndicator', indicator);
      performanceMonitor.endMeasure('addProgressIndicator');
      
      return () => {
        indicator.remove();
      };
      
    } catch (error) {
      errorHandler.handleError(error, {
        action: 'add_progress_indicator'
      });
      return () => {};
    }
  }

  /**
   * Apply styles to progress indicator
   * @param {HTMLElement} indicator - Indicator element
   */
  applyProgressStyles(indicator) {
    const container = indicator.querySelector('.scp-progress-container');
    const bar = indicator.querySelector('.scp-progress-bar');
    
    indicator.style.position = 'fixed';
    indicator.style.top = '0';
    indicator.style.left = '0';
    indicator.style.width = '100%';
    indicator.style.zIndex = '10001';
    indicator.style.pointerEvents = 'none';
    
    container.style.height = '4px';
    container.style.backgroundColor = 'rgba(255, 59, 48, 0.2)';
    container.style.overflow = 'hidden';
    
    bar.style.height = '100%';
    bar.style.width = '0%';
    bar.style.backgroundColor = '#ff3b30';
    bar.style.transition = 'width 0.3s ease';
  }

  /**
   * Update progress indicator
   * @param {number} percentage - Progress percentage (0-100)
   */
  updateProgress(percentage) {
    const indicator = this.components.get('progressIndicator');
    if (!indicator) return;
    
    const bar = indicator.querySelector('.scp-progress-bar');
    
    if (bar) {
      bar.style.width = `${Math.min(100, Math.max(0, percentage))}%`;
    }
  }

  /**
   * Display estimated reading time
   */
  displayReadingTime() {
    try {
      performanceMonitor.startMeasure('displayReadingTime');
      
      // Remove existing time display
      const existingTime = document.getElementById('scp-reading-time');
      if (existingTime) {
        existingTime.remove();
      }
      
      const estimatedTime = this.estimateReadingTime();
      if (estimatedTime > 0) {
        const timeDisplay = document.createElement('div');
        timeDisplay.id = 'scp-reading-time';
        timeDisplay.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          ~${estimatedTime} min read
        `;
        
        this.applyTimeDisplayStyles(timeDisplay);
        document.body.appendChild(timeDisplay);
        
        this.components.set('readingTime', timeDisplay);
      }
      
      performanceMonitor.endMeasure('displayReadingTime');
      
    } catch (error) {
      errorHandler.handleError(error, {
        action: 'display_reading_time'
      });
    }
  }

  /**
   * Apply styles to reading time display
   * @param {HTMLElement} element - Time display element
   */
  applyTimeDisplayStyles(element) {
    element.style.position = 'fixed';
    element.style.top = '20px';
    element.style.left = '20px';
    element.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    element.style.color = 'white';
    element.style.padding = '8px 12px';
    element.style.borderRadius = '6px';
    element.style.zIndex = '9999';
    element.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    element.style.fontSize = '12px';
    element.style.fontWeight = '400';
    element.style.display = 'flex';
    element.style.alignItems = 'center';
    element.style.gap = '6px';
    element.style.pointerEvents = 'none';
  }

  /**
   * Estimate reading time based on content length
   * @returns {number} Estimated reading time in minutes
   */
  estimateReadingTime() {
    try {
      const content = document.querySelector('#page-content, .content, main');
      if (!content) return 0;
      
      const text = content.textContent || content.innerText || '';
      const wordsPerMinute = 200; // Average reading speed
      const wordCount = text.trim().split(/\s+/).length;
      
      return Math.ceil(wordCount / wordsPerMinute);
    } catch (error) {
      logger.warn('Error estimating reading time:', error);
      return 0;
    }
  }

  /**
   * Setup keyboard shortcuts
   */
  setupKeyboardShortcuts() {
    try {
      performanceMonitor.startMeasure('setupKeyboardShortcuts');
      
      const handleKeyPress = (e) => {
        // Rate limit keyboard events
        if (!this.rateLimit('keydown', 5, 1000)) {
          return;
        }
        
        // Ctrl/Cmd + Shift + M to mark as read
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'M') {
          e.preventDefault();
          this.onManualButtonClick();
        }
      };
      
      document.addEventListener('keydown', handleKeyPress);
      this.globalState.keyboardShortcutListener = handleKeyPress;
      
      this.cleanupFunctions.add(() => {
        document.removeEventListener('keydown', handleKeyPress);
      });
      
      performanceMonitor.endMeasure('setupKeyboardShortcuts');
      
    } catch (error) {
      errorHandler.handleError(error, {
        action: 'setup_keyboard_shortcuts'
      });
    }
  }

  /**
   * Rate limiting for user actions
   * @param {string} action - Action type
   * @param {number} maxActions - Maximum actions allowed
   * @param {number} timeWindow - Time window in milliseconds
   * @returns {boolean} True if action is allowed
   */
  rateLimit(action, maxActions = 5, timeWindow = 1000) {
    const now = Date.now();
    const actionKey = `rate_limit_${action}`;
    
    if (!this.rateLimitData) {
      this.rateLimitData = {};
    }
    
    if (!this.rateLimitData[actionKey]) {
      this.rateLimitData[actionKey] = [];
    }
    
    // Remove old actions outside time window
    this.rateLimitData[actionKey] = this.rateLimitData[actionKey].filter(
      timestamp => now - timestamp < timeWindow
    );
    
    // Check if limit exceeded
    if (this.rateLimitData[actionKey].length >= maxActions) {
      return false;
    }
    
    // Add current action
    this.rateLimitData[actionKey].push(now);
    return true;
  }

  /**
   * Clean up all UI components
   */
  cleanupAll() {
    try {
      performanceMonitor.startMeasure('cleanupAllUI');
      
      // Remove all components
      this.components.forEach((component, key) => {
        if (component && component.parentNode) {
          component.remove();
        }
        this.components.delete(key);
      });
      
      // Remove all event listeners
      this.cleanupFunctions.forEach(cleanup => {
        try {
          cleanup();
        } catch (error) {
          logger.warn('Error during cleanup:', error);
        }
      });
      this.cleanupFunctions.clear();
      
      // Clear global state
      this.globalState = {
        pageMarked: false,
        keyboardShortcutListener: null,
        dictionaryTooltipListeners: {
          mouseover: null,
          mouseout: null
        }
      };
      
      performanceMonitor.endMeasure('cleanupAllUI');
      
    } catch (error) {
      errorHandler.handleError(error, {
        action: 'cleanup_all_ui'
      });
    }
  }

  /**
   * Get component by name
   * @param {string} name - Component name
   * @returns {HTMLElement|null} Component element or null
   */
  getComponent(name) {
    return this.components.get(name) || null;
  }

  /**
   * Get global state
   * @returns {Object} Global state object
   */
  getGlobalState() {
    return { ...this.globalState };
  }

  /**
   * Set global state
   * @param {Object} state - State to set
   */
  setGlobalState(state) {
    this.globalState = { ...this.globalState, ...state };
  }
}

// Export singleton instance
const uiComponents = new UIComponents();

export default uiComponents;