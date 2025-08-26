/**
 * Accessibility Module for SCP Tracker
 * Implements WCAG 2.1 compliance and accessibility features
 */

import { logger, errorHandler } from '../utils/index.js';

class AccessibilityModule {
  constructor() {
    this.config = {
      enabled: true,
      highContrast: false,
      reducedMotion: false,
      screenReader: false,
      fontSize: 'normal',
      colorScheme: 'auto',
      announcements: true,
      keyboardNavigation: true,
      skipLinks: true,
      ariaLabels: true,
      focusManagement: true
    };

    this.state = {
      currentFocus: null,
      lastAnnouncement: '',
      announcementQueue: [],
      keyboardShortcuts: new Map(),
      focusableElements: new Set()
    };

    this.initialize();
  }

  /**
   * Initialize accessibility module
   */
  async initialize() {
    try {
      logger.info('Initializing accessibility module');
      
      // Detect user preferences
      await this.detectUserPreferences();
      
      // Setup accessibility features
      this.setupAccessibilityFeatures();
      
      // Setup keyboard navigation
      this.setupKeyboardNavigation();
      
      // Setup focus management
      this.setupFocusManagement();
      
      // Setup ARIA labels
      this.setupARIALabels();
      
      // Setup skip links
      this.setupSkipLinks();
      
      // Setup announcements
      this.setupAnnouncements();
      
      // Setup color scheme detection
      this.setupColorSchemeDetection();
      
      // Setup font size detection
      this.setupFontSizeDetection();
      
      // Setup reduced motion detection
      this.setupReducedMotionDetection();
      
      // Setup high contrast detection
      this.setupHighContrastDetection();
      
      // Setup screen reader detection
      this.setupScreenReaderDetection();
      
      // Setup accessibility events
      this.setupAccessibilityEvents();
      
      // Setup periodic checks
      this.setupPeriodicChecks();
      
      logger.info('Accessibility module initialized successfully');
      
    } catch (error) {
      await errorHandler.handleError(error, {
        action: 'accessibility_initialize'
      });
    }
  }

  /**
   * Detect user preferences
   */
  async detectUserPreferences() {
    try {
      // Detect reduced motion preference
      if (window.matchMedia) {
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        this.config.reducedMotion = prefersReducedMotion.matches;
        prefersReducedMotion.addEventListener('change', (e) => {
          this.config.reducedMotion = e.matches;
          this.applyReducedMotion();
        });
      }
      
      // Detect high contrast preference
      if (window.matchMedia) {
        const prefersHighContrast = window.matchMedia('(prefers-contrast: high)');
        this.config.highContrast = prefersHighContrast.matches;
        prefersHighContrast.addEventListener('change', (e) => {
          this.config.highContrast = e.matches;
          this.applyHighContrast();
        });
      }
      
      // Detect dark mode preference
      if (window.matchMedia) {
        const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)');
        this.config.colorScheme = prefersDarkMode.matches ? 'dark' : 'light';
        prefersDarkMode.addEventListener('change', (e) => {
          this.config.colorScheme = e.matches ? 'dark' : 'light';
          this.applyColorScheme();
        });
      }
      
      // Detect screen reader
      this.config.screenReader = this.detectScreenReader();
      
    } catch (error) {
      logger.warn('Failed to detect user preferences:', error);
    }
  }

  /**
   * Setup accessibility features
   */
  setupAccessibilityFeatures() {
    try {
      // Apply initial accessibility settings
      this.applyAccessibilitySettings();
      
      // Add accessibility attributes to body
      document.body.setAttribute('role', 'application');
      document.body.setAttribute('aria-label', 'SCP Tracker');
      
      // Add lang attribute if not present
      if (!document.documentElement.hasAttribute('lang')) {
        document.documentElement.setAttribute('lang', 'en');
      }
      
      // Add skip to main content link
      if (this.config.skipLinks) {
        this.addSkipLink();
      }
      
    } catch (error) {
      logger.error('Failed to setup accessibility features:', error);
    }
  }

  /**
   * Setup keyboard navigation
   */
  setupKeyboardNavigation() {
    try {
      if (!this.config.keyboardNavigation) return;
      
      // Add keyboard event listeners
      document.addEventListener('keydown', this.handleKeyDown.bind(this));
      document.addEventListener('keyup', this.handleKeyUp.bind(this));
      
      // Add keyboard shortcuts
      this.registerKeyboardShortcut('Escape', this.handleEscape.bind(this));
      this.registerKeyboardShortcut('Tab', this.handleTab.bind(this));
      this.registerKeyboardShortcut('Shift+Tab', this.handleShiftTab.bind(this));
      this.registerKeyboardShortcut('Enter', this.handleEnter.bind(this));
      this.registerKeyboardShortcut('Space', this.handleSpace.bind(this));
      
      // Focus visible elements
      this.focusVisibleElements();
      
    } catch (error) {
      logger.error('Failed to setup keyboard navigation:', error);
    }
  }

  /**
   * Setup focus management
   */
  setupFocusManagement() {
    try {
      if (!this.config.focusManagement) return;
      
      // Track focusable elements
      this.updateFocusableElements();
      
      // Setup focus trap for modals
      this.setupFocusTrap();
      
      // Setup focus visible
      this.setupFocusVisible();
      
    } catch (error) {
      logger.error('Failed to setup focus management:', error);
    }
  }

  /**
   * Setup ARIA labels
   */
  setupARIALabels() {
    try {
      if (!this.config.ariaLabels) return;
      
      // Add ARIA labels to interactive elements
      this.addARIALabels();
      
      // Add ARIA live regions
      this.addLiveRegions();
      
    } catch (error) {
      logger.error('Failed to setup ARIA labels:', error);
    }
  }

  /**
   * Setup skip links
   */
  setupSkipLinks() {
    try {
      if (!this.config.skipLinks) return;
      
      // Add skip links
      this.addSkipLinks();
      
    } catch (error) {
      logger.error('Failed to setup skip links:', error);
    }
  }

  /**
   * Setup announcements
   */
  setupAnnouncements() {
    try {
      if (!this.config.announcements) return;
      
      // Create announcement container
      this.createAnnouncementContainer();
      
      // Setup announcement queue
      this.setupAnnouncementQueue();
      
    } catch (error) {
      logger.error('Failed to setup announcements:', error);
    }
  }

  /**
   * Setup color scheme detection
   */
  setupColorSchemeDetection() {
    try {
      if (!window.matchMedia) return;
      
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', (e) => {
        this.config.colorScheme = e.matches ? 'dark' : 'light';
        this.applyColorScheme();
      });
      
    } catch (error) {
      logger.warn('Failed to setup color scheme detection:', error);
    }
  }

  /**
   * Setup font size detection
   */
  setupFontSizeDetection() {
    try {
      // Detect base font size
      const computedStyle = window.getComputedStyle(document.documentElement);
      const fontSize = parseFloat(computedStyle.fontSize);
      
      if (fontSize < 14) {
        this.config.fontSize = 'small';
      } else if (fontSize > 18) {
        this.config.fontSize = 'large';
      } else {
        this.config.fontSize = 'normal';
      }
      
      // Setup font size change detection
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
            const newFontSize = parseFloat(window.getComputedStyle(document.documentElement).fontSize);
            if (newFontSize !== fontSize) {
              this.config.fontSize = newFontSize < 14 ? 'small' : 
                                   newFontSize > 18 ? 'large' : 'normal';
              this.applyFontSize();
            }
          }
        });
      });
      
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['style']
      });
      
    } catch (error) {
      logger.warn('Failed to setup font size detection:', error);
    }
  }

  /**
   * Setup reduced motion detection
   */
  setupReducedMotionDetection() {
    try {
      if (!window.matchMedia) return;
      
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      mediaQuery.addEventListener('change', (e) => {
        this.config.reducedMotion = e.matches;
        this.applyReducedMotion();
      });
      
    } catch (error) {
      logger.warn('Failed to setup reduced motion detection:', error);
    }
  }

  /**
   * Setup high contrast detection
   */
  setupHighContrastDetection() {
    try {
      if (!window.matchMedia) return;
      
      const mediaQuery = window.matchMedia('(prefers-contrast: high)');
      mediaQuery.addEventListener('change', (e) => {
        this.config.highContrast = e.matches;
        this.applyHighContrast();
      });
      
    } catch (error) {
      logger.warn('Failed to setup high contrast detection:', error);
    }
  }

  /**
   * Setup screen reader detection
   */
  setupScreenReaderDetection() {
    try {
      // Initial detection
      this.config.screenReader = this.detectScreenReader();
      
      // Setup periodic detection
      setInterval(() => {
        const wasScreenReader = this.config.screenReader;
        this.config.screenReader = this.detectScreenReader();
        
        if (wasScreenReader !== this.config.screenReader) {
          this.handleScreenReaderChange();
        }
      }, 1000);
      
    } catch (error) {
      logger.warn('Failed to setup screen reader detection:', error);
    }
  }

  /**
   * Setup accessibility events
   */
  setupAccessibilityEvents() {
    try {
      // Listen for visibility changes
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.handlePageHidden();
        } else {
          this.handlePageVisible();
        }
      });
      
      // Listen for focus changes
      document.addEventListener('focusin', (e) => {
        this.handleFocusIn(e);
      });
      
      document.addEventListener('focusout', (e) => {
        this.handleFocusOut(e);
      });
      
      // Listen for click events
      document.addEventListener('click', (e) => {
        this.handleClick(e);
      });
      
    } catch (error) {
      logger.error('Failed to setup accessibility events:', error);
    }
  }

  /**
   * Setup periodic checks
   */
  setupPeriodicChecks() {
    try {
      // Check for accessibility issues periodically
      setInterval(() => {
        this.checkAccessibilityIssues();
      }, 30000); // Check every 30 seconds
      
    } catch (error) {
      logger.warn('Failed to setup periodic checks:', error);
    }
  }

  /**
   * Detect screen reader
   */
  detectScreenReader() {
    try {
      // Check for common screen reader indicators
      const indicators = [
        'navigator-screen-reader-only',
        'sr-only',
        'visually-hidden',
        'a11y-speak-region'
      ];
      
      // Check if any screen reader specific classes are present
      const hasScreenReaderClass = indicators.some(indicator => 
        document.body.classList.contains(indicator)
      );
      
      // Check for screen reader specific attributes
      const hasScreenReaderAttr = document.body.hasAttribute('aria-live') ||
                                 document.body.hasAttribute('aria-atomic');
      
      // Check for screen reader specific elements
      const hasScreenReaderElements = document.querySelectorAll('[role="alert"], [role="status"], [role="log"]').length > 0;
      
      return hasScreenReaderClass || hasScreenReaderAttr || hasScreenReaderElements;
      
    } catch (error) {
      logger.warn('Failed to detect screen reader:', error);
      return false;
    }
  }

  /**
   * Register keyboard shortcut
   */
  registerKeyboardShortcut(key, handler) {
    try {
      this.state.keyboardShortcuts.set(key, handler);
    } catch (error) {
      logger.error('Failed to register keyboard shortcut:', error);
    }
  }

  /**
   * Handle key down event
   */
  handleKeyDown(event) {
    try {
      const key = this.getKeyIdentifier(event);
      
      // Check for registered shortcuts
      if (this.state.keyboardShortcuts.has(key)) {
        event.preventDefault();
        this.state.keyboardShortcuts.get(key)(event);
      }
      
      // Handle navigation keys
      if (['Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
        this.handleNavigationKey(event);
      }
      
    } catch (error) {
      logger.error('Failed to handle key down:', error);
    }
  }

  /**
   * Handle key up event
   */
  handleKeyUp(event) {
    try {
      const key = this.getKeyIdentifier(event);
      
      // Handle key up events
      if (key === 'Escape') {
        this.handleEscapeUp(event);
      }
      
    } catch (error) {
      logger.error('Failed to handle key up:', error);
    }
  }

  /**
   * Get key identifier
   */
  getKeyIdentifier(event) {
    try {
      let key = event.key;
      
      // Add modifiers
      if (event.ctrlKey) key = `Ctrl+${key}`;
      if (event.altKey) key = `Alt+${key}`;
      if (event.shiftKey) key = `Shift+${key}`;
      if (event.metaKey) key = `Meta+${key}`;
      
      return key;
      
    } catch (error) {
      logger.error('Failed to get key identifier:', error);
      return event.key;
    }
  }

  /**
   * Handle escape key
   */
  handleEscape(event) {
    try {
      // Close modals and dialogs
      const modals = document.querySelectorAll('[role="dialog"]');
      modals.forEach(modal => {
        if (modal.getAttribute('aria-modal') === 'true') {
          this.closeModal(modal);
        }
      });
      
      // Close menus
      const menus = document.querySelectorAll('[role="menu"]');
      menus.forEach(menu => {
        this.closeMenu(menu);
      });
      
    } catch (error) {
      logger.error('Failed to handle escape:', error);
    }
  }

  /**
   * Handle tab key
   */
  handleTab(event) {
    try {
      // Handle tab navigation
      this.handleTabNavigation(event);
      
    } catch (error) {
      logger.error('Failed to handle tab:', error);
    }
  }

  /**
   * Handle shift tab key
   */
  handleShiftTab(event) {
    try {
      // Handle shift tab navigation
      this.handleShiftTabNavigation(event);
      
    } catch (error) {
      logger.error('Failed to handle shift tab:', error);
    }
  }

  /**
   * Handle enter key
   */
  handleEnter(event) {
    try {
      // Handle enter key activation
      if (event.target.matches('button, [role="button"], a, input[type="submit"]')) {
        event.preventDefault();
        event.target.click();
      }
      
    } catch (error) {
      logger.error('Failed to handle enter:', error);
    }
  }

  /**
   * Handle space key
   */
  handleSpace(event) {
    try {
      // Handle space key activation
      if (event.target.matches('button, [role="button"], input[type="checkbox"], input[type="radio"]')) {
        event.preventDefault();
        event.target.click();
      }
      
    } catch (error) {
      logger.error('Failed to handle space:', error);
    }
  }

  /**
   * Handle navigation key
   */
  handleNavigationKey(event) {
    try {
      const key = event.key;
      const target = event.target;
      
      // Handle arrow keys in lists
      if (target.matches('li, [role="listitem"]')) {
        this.handleArrowKeyInList(event, key);
      }
      
      // Handle arrow keys in grids
      if (target.matches('[role="grid"], [role="tree"]')) {
        this.handleArrowKeyInGrid(event, key);
      }
      
    } catch (error) {
      logger.error('Failed to handle navigation key:', error);
    }
  }

  /**
   * Handle arrow key in list
   */
  handleArrowKeyInList(event, key) {
    try {
      const list = event.target.closest('ul, ol, [role="list"]');
      if (!list) return;
      
      const items = list.querySelectorAll('li, [role="listitem"]');
      const currentIndex = Array.from(items).indexOf(event.target);
      
      let newIndex = currentIndex;
      
      switch (key) {
        case 'ArrowUp':
          newIndex = Math.max(0, currentIndex - 1);
          break;
        case 'ArrowDown':
          newIndex = Math.min(items.length - 1, currentIndex + 1);
          break;
        case 'ArrowLeft':
          newIndex = Math.max(0, currentIndex - 1);
          break;
        case 'ArrowRight':
          newIndex = Math.min(items.length - 1, currentIndex + 1);
          break;
      }
      
      if (newIndex !== currentIndex) {
        items[newIndex].focus();
        event.preventDefault();
      }
      
    } catch (error) {
      logger.error('Failed to handle arrow key in list:', error);
    }
  }

  /**
   * Handle arrow key in grid
   */
  handleArrowKeyInGrid(event, key) {
    try {
      const grid = event.target.closest('[role="grid"], [role="tree"]');
      if (!grid) return;
      
      const cells = grid.querySelectorAll('[role="gridcell"], [role="treeitem"]');
      const currentIndex = Array.from(cells).indexOf(event.target);
      
      let newIndex = currentIndex;
      
      switch (key) {
        case 'ArrowUp':
          newIndex = Math.max(0, currentIndex - grid.querySelector('tr, [role="row"]').childElementCount);
          break;
        case 'ArrowDown':
          newIndex = Math.min(cells.length - 1, currentIndex + grid.querySelector('tr, [role="row"]').childElementCount);
          break;
        case 'ArrowLeft':
          newIndex = Math.max(0, currentIndex - 1);
          break;
        case 'ArrowRight':
          newIndex = Math.min(cells.length - 1, currentIndex + 1);
          break;
      }
      
      if (newIndex !== currentIndex) {
        cells[newIndex].focus();
        event.preventDefault();
      }
      
    } catch (error) {
      logger.error('Failed to handle arrow key in grid:', error);
    }
  }

  /**
   * Handle tab navigation
   */
  handleTabNavigation(event) {
    try {
      const focusable = this.getFocusableElements();
      const focusedElement = document.activeElement;
      
      // If we're at the end of focusable elements, go to the beginning
      if (focusedElement === focusable[focusable.length - 1]) {
        event.preventDefault();
        focusable[0].focus();
      }
      
    } catch (error) {
      logger.error('Failed to handle tab navigation:', error);
    }
  }

  /**
   * Handle shift tab navigation
   */
  handleShiftTabNavigation(event) {
    try {
      const focusable = this.getFocusableElements();
      const focusedElement = document.activeElement;
      
      // If we're at the beginning of focusable elements, go to the end
      if (focusedElement === focusable[0]) {
        event.preventDefault();
        focusable[focusable.length - 1].focus();
      }
      
    } catch (error) {
      logger.error('Failed to handle shift tab navigation:', error);
    }
  }

  /**
   * Handle focus in event
   */
  handleFocusIn(event) {
    try {
      this.state.currentFocus = event.target;
      
      // Add focus visible class
      if (this.isFocusVisible(event.target)) {
        event.target.classList.add('focus-visible');
      }
      
      // Announce focus change for screen readers
      if (this.config.screenReader) {
        this.announceFocusChange(event.target);
      }
      
    } catch (error) {
      logger.error('Failed to handle focus in:', error);
    }
  }

  /**
   * Handle focus out event
   */
  handleFocusOut(event) {
    try {
      // Remove focus visible class
      if (event.target.classList.contains('focus-visible')) {
        event.target.classList.remove('focus-visible');
      }
      
    } catch (error) {
      logger.error('Failed to handle focus out:', error);
    }
  }

  /**
   * Handle click event
   */
  handleClick(event) {
    try {
      // Handle click for screen readers
      if (this.config.screenReader) {
        this.handleClickForScreenReader(event);
      }
      
    } catch (error) {
      logger.error('Failed to handle click:', error);
    }
  }

  /**
   * Handle click for screen reader
   */
  handleClickForScreenReader(event) {
    try {
      const target = event.target;
      
      // Announce button clicks
      if (target.matches('button, [role="button"]')) {
        const buttonText = target.textContent.trim();
        this.announce(`Button clicked: ${buttonText}`);
      }
      
      // Announce link clicks
      if (target.matches('a')) {
        const linkText = target.textContent.trim();
        this.announce(`Link clicked: ${linkText}`);
      }
      
    } catch (error) {
      logger.error('Failed to handle click for screen reader:', error);
    }
  }

  /**
   * Handle escape up event
   */
  handleEscapeUp(event) {
    try {
      // Handle escape key up
      this.announce('Escape key pressed');
      
    } catch (error) {
      logger.error('Failed to handle escape up:', error);
    }
  }

  /**
   * Update focusable elements
   */
  updateFocusableElements() {
    try {
      const focusable = this.getFocusableElements();
      this.state.focusableElements = new Set(focusable);
      
    } catch (error) {
      logger.error('Failed to update focusable elements:', error);
    }
  }

  /**
   * Get focusable elements
   */
  getFocusableElements() {
    try {
      const selector = [
        'a[href]',
        'button:not([disabled])',
        'textarea:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
        '[contenteditable="true"]',
        '[role="button"]',
        '[role="link"]',
        '[role="checkbox"]',
        '[role="radio"]',
        '[role="switch"]'
      ].join(', ');
      
      return document.querySelectorAll(selector);
      
    } catch (error) {
      logger.error('Failed to get focusable elements:', error);
      return [];
    }
  }

  /**
   * Focus visible elements
   */
  focusVisibleElements() {
    try {
      const focusable = this.getFocusableElements();
      
      // Add focus visible styles
      focusable.forEach(element => {
        element.addEventListener('mousedown', () => {
          element.classList.remove('focus-visible');
        });
        
        element.addEventListener('keydown', () => {
          element.classList.add('focus-visible');
        });
      });
      
    } catch (error) {
      logger.error('Failed to focus visible elements:', error);
    }
  }

  /**
   * Setup focus trap
   */
  setupFocusTrap() {
    try {
      // Setup focus trap for modals
      const modals = document.querySelectorAll('[role="dialog"]');
      modals.forEach(modal => {
        this.setupModalFocusTrap(modal);
      });
      
    } catch (error) {
      logger.error('Failed to setup focus trap:', error);
    }
  }

  /**
   * Setup modal focus trap
   */
  setupModalFocusTrap(modal) {
    try {
      const focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      const firstFocusable = focusable[0];
      const lastFocusable = focusable[focusable.length - 1];
      
      modal.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
          if (e.shiftKey) {
            if (document.activeElement === firstFocusable) {
              e.preventDefault();
              lastFocusable.focus();
            }
          } else {
            if (document.activeElement === lastFocusable) {
              e.preventDefault();
              firstFocusable.focus();
            }
          }
        }
      });
      
    } catch (error) {
      logger.error('Failed to setup modal focus trap:', error);
    }
  }

  /**
   * Setup focus visible
   */
  setupFocusVisible() {
    try {
      // Setup focus visible for all elements
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
          document.body.classList.add('using-keyboard');
        }
      });
      
      document.addEventListener('mousedown', () => {
        document.body.classList.remove('using-keyboard');
      });
      
    } catch (error) {
      logger.error('Failed to setup focus visible:', error);
    }
  }

  /**
   * Check if element is focus visible
   */
  isFocusVisible(element) {
    try {
      return document.body.classList.contains('using-keyboard') || 
             element.matches(':focus-visible');
      
    } catch (error) {
      logger.error('Failed to check focus visible:', error);
      return false;
    }
  }

  /**
   * Add ARIA labels
   */
  addARIALabels() {
    try {
      // Add ARIA labels to buttons
      const buttons = document.querySelectorAll('button');
      buttons.forEach(button => {
        if (!button.hasAttribute('aria-label') && !button.hasAttribute('aria-labelledby')) {
          const buttonText = button.textContent.trim();
          if (buttonText) {
            button.setAttribute('aria-label', buttonText);
          }
        }
      });
      
      // Add ARIA labels to links
      const links = document.querySelectorAll('a');
      links.forEach(link => {
        if (!link.hasAttribute('aria-label') && !link.hasAttribute('aria-labelledby')) {
          const linkText = link.textContent.trim();
          if (linkText) {
            link.setAttribute('aria-label', linkText);
          }
        }
      });
      
      // Add ARIA labels to images
      const images = document.querySelectorAll('img');
      images.forEach(img => {
        if (!img.hasAttribute('alt') && !img.hasAttribute('aria-label')) {
          img.setAttribute('aria-label', 'Image');
        }
      });
      
    } catch (error) {
      logger.error('Failed to add ARIA labels:', error);
    }
  }

  /**
   * Add live regions
   */
  addLiveRegions() {
    try {
      // Create live region for announcements
      const liveRegion = document.createElement('div');
      liveRegion.setAttribute('role', 'status');
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.setAttribute('aria-atomic', 'true');
      liveRegion.style.position = 'absolute';
      liveRegion.style.width = '1px';
      liveRegion.style.height = '1px';
      liveRegion.style.padding = '0';
      liveRegion.style.border = 'none';
      liveRegion.style.overflow = 'hidden';
      liveRegion.style.clip = 'rect(0, 0, 0, 0)';
      liveRegion.style.whiteSpace = 'nowrap';
      liveRegion.style.wordWrap = 'normal';
      
      document.body.appendChild(liveRegion);
      this.state.liveRegion = liveRegion;
      
    } catch (error) {
      logger.error('Failed to add live regions:', error);
    }
  }

  /**
   * Add skip link
   */
  addSkipLink() {
    try {
      const skipLink = document.createElement('a');
      skipLink.href = '#main-content';
      skipLink.textContent = 'Skip to main content';
      skipLink.style.position = 'absolute';
      skipLink.style.top = '-40px';
      skipLink.style.left = '0';
      skipLink.style.zIndex = '1000';
      skipLink.style.padding = '8px';
      skipLink.style.background = '#000';
      skipLink.style.color = '#fff';
      skipLink.style.textDecoration = 'none';
      skipLink.style.borderRadius = '0 0 4px 0';
      
      skipLink.addEventListener('focus', () => {
        skipLink.style.top = '0';
      });
      
      skipLink.addEventListener('blur', () => {
        skipLink.style.top = '-40px';
      });
      
      document.body.insertBefore(skipLink, document.body.firstChild);
      
    } catch (error) {
      logger.error('Failed to add skip link:', error);
    }
  }

  /**
   * Add skip links
   */
  addSkipLinks() {
    try {
      // Add skip to navigation
      const skipNav = document.createElement('a');
      skipNav.href = '#navigation';
      skipNav.textContent = 'Skip to navigation';
      skipNav.className = 'skip-link';
      skipNav.style.position = 'absolute';
      skipNav.style.top = '-40px';
      skipNav.style.left = '0';
      skipNav.style.zIndex = '1000';
      skipNav.style.padding = '8px';
      skipNav.style.background = '#000';
      skipNav.style.color = '#fff';
      skipNav.style.textDecoration = 'none';
      skipNav.style.borderRadius = '0 0 4px 0';
      
      skipNav.addEventListener('focus', () => {
        skipNav.style.top = '0';
      });
      
      skipNav.addEventListener('blur', () => {
        skipNav.style.top = '-40px';
      });
      
      document.body.insertBefore(skipNav, document.body.firstChild);
      
      // Add skip to main content
      const skipMain = document.createElement('a');
      skipMain.href = '#main-content';
      skipMain.textContent = 'Skip to main content';
      skipMain.className = 'skip-link';
      skipMain.style.position = 'absolute';
      skipMain.style.top = '-40px';
      skipMain.style.left = '0';
      skipMain.style.zIndex = '1000';
      skipMain.style.padding = '8px';
      skipMain.style.background = '#000';
      skipMain.style.color = '#fff';
      skipMain.style.textDecoration = 'none';
      skipMain.style.borderRadius = '0 0 4px 0';
      skipMain.style.marginTop = '32px';
      
      skipMain.addEventListener('focus', () => {
        skipMain.style.top = '0';
      });
      
      skipMain.addEventListener('blur', () => {
        skipMain.style.top = '-40px';
      });
      
      document.body.insertBefore(skipMain, skipNav.nextSibling);
      
    } catch (error) {
      logger.error('Failed to add skip links:', error);
    }
  }

  /**
   * Create announcement container
   */
  createAnnouncementContainer() {
    try {
      const container = document.createElement('div');
      container.id = 'announcement-container';
      container.setAttribute('role', 'status');
      container.setAttribute('aria-live', 'polite');
      container.setAttribute('aria-atomic', 'true');
      container.style.position = 'absolute';
      container.style.width = '1px';
      container.style.height = '1px';
      container.style.padding = '0';
      container.style.border = 'none';
      container.style.overflow = 'hidden';
      container.style.clip = 'rect(0, 0, 0, 0)';
      container.style.whiteSpace = 'nowrap';
      container.style.wordWrap = 'normal';
      
      document.body.appendChild(container);
      this.state.announcementContainer = container;
      
    } catch (error) {
      logger.error('Failed to create announcement container:', error);
    }
  }

  /**
   * Setup announcement queue
   */
  setupAnnouncementQueue() {
    try {
      // Process announcement queue
      setInterval(() => {
        this.processAnnouncementQueue();
      }, 100);
      
    } catch (error) {
      logger.error('Failed to setup announcement queue:', error);
    }
  }

  /**
   * Process announcement queue
   */
  processAnnouncementQueue() {
    try {
      if (this.state.announcementQueue.length === 0) return;
      
      const announcement = this.state.announcementQueue.shift();
      this.announce(announcement);
      
    } catch (error) {
      logger.error('Failed to process announcement queue:', error);
    }
  }

  /**
   * Announce message
   */
  announce(message) {
    try {
      if (!this.config.announcements || !this.state.announcementContainer) return;
      
      // Prevent duplicate announcements
      if (message === this.state.lastAnnouncement) return;
      
      this.state.lastAnnouncement = message;
      
      // Update live region
      this.state.announcementContainer.textContent = message;
      
      // Log announcement
      logger.debug('Accessibility announcement:', message);
      
    } catch (error) {
      logger.error('Failed to announce:', error);
    }
  }

  /**
   * Announce focus change
   */
  announceFocusChange(element) {
    try {
      if (!this.config.announcements) return;
      
      let announcement = '';
      
      if (element.matches('button, [role="button"]')) {
        announcement = `Button: ${element.textContent.trim()}`;
      } else if (element.matches('a')) {
        announcement = `Link: ${element.textContent.trim()}`;
      } else if (element.matches('input, textarea, select')) {
        announcement = `Input field: ${element.getAttribute('placeholder') || element.getAttribute('aria-label') || 'form field'}`;
      } else if (element.matches('[role="heading"]')) {
        announcement = `Heading: ${element.textContent.trim()}`;
      } else if (element.matches('[role="navigation"]')) {
        announcement = 'Navigation';
      } else if (element.matches('[role="main"]')) {
        announcement = 'Main content';
      } else {
        announcement = `Element: ${element.tagName.toLowerCase()}`;
      }
      
      this.announce(announcement);
      
    } catch (error) {
      logger.error('Failed to announce focus change:', error);
    }
  }

  /**
   * Apply accessibility settings
   */
  applyAccessibilitySettings() {
    try {
      // Apply reduced motion
      this.applyReducedMotion();
      
      // Apply high contrast
      this.applyHighContrast();
      
      // Apply color scheme
      this.applyColorScheme();
      
      // Apply font size
      this.applyFontSize();
      
    } catch (error) {
      logger.error('Failed to apply accessibility settings:', error);
    }
  }

  /**
   * Apply reduced motion
   */
  applyReducedMotion() {
    try {
      if (this.config.reducedMotion) {
        document.documentElement.classList.add('reduce-motion');
        document.documentElement.style.setProperty('--animation-duration', '0.01ms');
        document.documentElement.style.setProperty('--transition-duration', '0.01ms');
      } else {
        document.documentElement.classList.remove('reduce-motion');
        document.documentElement.style.setProperty('--animation-duration', '');
        document.documentElement.style.setProperty('--transition-duration', '');
      }
      
    } catch (error) {
      logger.error('Failed to apply reduced motion:', error);
    }
  }

  /**
   * Apply high contrast
   */
  applyHighContrast() {
    try {
      if (this.config.highContrast) {
        document.documentElement.classList.add('high-contrast');
        document.documentElement.style.setProperty('--text-color', '#000');
        document.documentElement.style.setProperty('--background-color', '#fff');
        document.documentElement.style.setProperty('--border-color', '#000');
        document.documentElement.style.setProperty('--link-color', '#0000ff');
        document.documentElement.style.setProperty('--hover-color', '#0000cc');
      } else {
        document.documentElement.classList.remove('high-contrast');
        document.documentElement.style.setProperty('--text-color', '');
        document.documentElement.style.setProperty('--background-color', '');
        document.documentElement.style.setProperty('--border-color', '');
        document.documentElement.style.setProperty('--link-color', '');
        document.documentElement.style.setProperty('--hover-color', '');
      }
      
    } catch (error) {
      logger.error('Failed to apply high contrast:', error);
    }
  }

  /**
   * Apply color scheme
   */
  applyColorScheme() {
    try {
      if (this.config.colorScheme === 'dark') {
        document.documentElement.classList.add('dark-mode');
        document.documentElement.classList.remove('light-mode');
      } else if (this.config.colorScheme === 'light') {
        document.documentElement.classList.add('light-mode');
        document.documentElement.classList.remove('dark-mode');
      } else {
        // Auto mode - let browser decide
        document.documentElement.classList.remove('dark-mode', 'light-mode');
      }
      
    } catch (error) {
      logger.error('Failed to apply color scheme:', error);
    }
  }

  /**
   * Apply font size
   */
  applyFontSize() {
    try {
      document.documentElement.classList.remove('font-small', 'font-normal', 'font-large');
      
      switch (this.config.fontSize) {
        case 'small':
          document.documentElement.classList.add('font-small');
          break;
        case 'large':
          document.documentElement.classList.add('font-large');
          break;
        default:
          document.documentElement.classList.add('font-normal');
      }
      
    } catch (error) {
      logger.error('Failed to apply font size:', error);
    }
  }

  /**
   * Handle screen reader change
   */
  handleScreenReaderChange() {
    try {
      if (this.config.screenReader) {
        this.announce('Screen reader mode enabled');
        this.setupScreenReaderMode();
      } else {
        this.announce('Screen reader mode disabled');
        this.teardownScreenReaderMode();
      }
      
    } catch (error) {
      logger.error('Failed to handle screen reader change:', error);
    }
  }

  /**
   * Setup screen reader mode
   */
  setupScreenReaderMode() {
    try {
      // Add screen reader specific styles
      const style = document.createElement('style');
      style.textContent = `
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }
      `;
      document.head.appendChild(style);
      
      // Add screen reader specific attributes
      const interactiveElements = document.querySelectorAll('button, a, input, select, textarea');
      interactiveElements.forEach(element => {
        if (!element.hasAttribute('aria-label') && !element.hasAttribute('aria-labelledby')) {
          element.setAttribute('aria-label', element.textContent.trim());
        }
      });
      
    } catch (error) {
      logger.error('Failed to setup screen reader mode:', error);
    }
  }

  /**
   * Teardown screen reader mode
   */
  teardownScreenReaderMode() {
    try {
      // Remove screen reader specific styles
      const style = document.querySelector('style[data-screen-reader]');
      if (style) {
        style.remove();
      }
      
      // Remove screen reader specific attributes
      const interactiveElements = document.querySelectorAll('button, a, input, select, textarea');
      interactiveElements.forEach(element => {
        if (element.hasAttribute('aria-label') && element.getAttribute('aria-label') === element.textContent.trim()) {
          element.removeAttribute('aria-label');
        }
      });
      
    } catch (error) {
      logger.error('Failed to teardown screen reader mode:', error);
    }
  }

  /**
   * Check accessibility issues
   */
  checkAccessibilityIssues() {
    try {
      const issues = [];
      
      // Check for missing alt text
      const images = document.querySelectorAll('img:not([alt]):not([aria-label])');
      if (images.length > 0) {
        issues.push(`${images.length} images missing alt text`);
      }
      
      // Check for missing labels
      const inputs = document.querySelectorAll('input:not([aria-label]):not([aria-labelledby])');
      if (inputs.length > 0) {
        issues.push(`${inputs.length} inputs missing labels`);
      }
      
      // Check for color contrast
      const lowContrastElements = this.checkColorContrast();
      if (lowContrastElements.length > 0) {
        issues.push(`${lowContrastElements.length} elements with low color contrast`);
      }
      
      // Check for keyboard accessibility
      const keyboardIssues = this.checkKeyboardAccessibility();
      if (keyboardIssues.length > 0) {
        issues.push(...keyboardIssues);
      }
      
      // Log issues
      if (issues.length > 0) {
        logger.warn('Accessibility issues detected:', issues);
        this.announce(`Accessibility issues detected: ${issues.join(', ')}`);
      }
      
    } catch (error) {
      logger.error('Failed to check accessibility issues:', error);
    }
  }

  /**
   * Check color contrast
   */
  checkColorContrast() {
    try {
      const issues = [];
      
      // This is a simplified check - in production, you'd use a proper color contrast library
      const elements = document.querySelectorAll('p, div, span');
      elements.forEach(element => {
        const style = window.getComputedStyle(element);
        const color = style.color;
        const backgroundColor = style.backgroundColor;
        
        // Simple contrast check (not accurate)
        if (color && backgroundColor && 
            color.toLowerCase() === '#ffffff' && 
            backgroundColor.toLowerCase() === '#ffffff') {
          issues.push(element);
        }
      });
      
      return issues;
      
    } catch (error) {
      logger.error('Failed to check color contrast:', error);
      return [];
    }
  }

  /**
   * Check keyboard accessibility
   */
  checkKeyboardAccessibility() {
    try {
      const issues = [];
      
      // Check for non-focusable interactive elements
      const interactiveElements = document.querySelectorAll('button, a, input, select, textarea');
      interactiveElements.forEach(element => {
        if (!element.matches(':focus') && !element.matches('[tabindex]')) {
          issues.push(`Interactive element not keyboard accessible: ${element.tagName}`);
        }
      });
      
      return issues;
      
    } catch (error) {
      logger.error('Failed to check keyboard accessibility:', error);
      return [];
    }
  }

  /**
   * Handle page hidden
   */
  handlePageHidden() {
    try {
      // Pause accessibility features
      this.state.isPaused = true;
      
    } catch (error) {
      logger.error('Failed to handle page hidden:', error);
    }
  }

  /**
   * Handle page visible
   */
  handlePageVisible() {
    try {
      // Resume accessibility features
      this.state.isPaused = false;
      
    } catch (error) {
      logger.error('Failed to handle page visible:', error);
    }
  }

  /**
   * Close modal
   */
  closeModal(modal) {
    try {
      if (modal.hasAttribute('aria-modal')) {
        modal.setAttribute('aria-modal', 'false');
      }
      
      // Focus back to trigger element
      const trigger = modal.getAttribute('data-trigger');
      if (trigger) {
        const triggerElement = document.querySelector(trigger);
        if (triggerElement) {
          triggerElement.focus();
        }
      }
      
      this.announce('Modal closed');
      
    } catch (error) {
      logger.error('Failed to close modal:', error);
    }
  }

  /**
   * Close menu
   */
  closeMenu(menu) {
    try {
      if (menu.hasAttribute('aria-expanded')) {
        menu.setAttribute('aria-expanded', 'false');
      }
      
      this.announce('Menu closed');
      
    } catch (error) {
      logger.error('Failed to close menu:', error);
    }
  }

  /**
   * Get accessibility report
   */
  getAccessibilityReport() {
    try {
      const report = {
        enabled: this.config.enabled,
        settings: {
          highContrast: this.config.highContrast,
          reducedMotion: this.config.reducedMotion,
          screenReader: this.config.screenReader,
          fontSize: this.config.fontSize,
          colorScheme: this.config.colorScheme,
          announcements: this.config.announcements,
          keyboardNavigation: this.config.keyboardNavigation,
          skipLinks: this.config.skipLinks,
          ariaLabels: this.config.ariaLabels,
          focusManagement: this.config.focusManagement
        },
        state: {
          currentFocus: this.state.currentFocus,
          lastAnnouncement: this.state.lastAnnouncement,
          announcementQueue: this.state.announcementQueue.length,
          keyboardShortcuts: this.state.keyboardShortcuts.size,
          focusableElements: this.state.focusableElements.size
        },
        issues: [],
        recommendations: []
      };
      
      // Check for issues
      this.checkAccessibilityIssues();
      
      // Add recommendations
      if (!this.config.highContrast) {
        report.recommendations.push('Enable high contrast mode for better visibility');
      }
      
      if (!this.config.reducedMotion) {
        report.recommendations.push('Enable reduced motion to prevent motion sickness');
      }
      
      if (!this.config.skipLinks) {
        report.recommendations.push('Add skip links for keyboard navigation');
      }
      
      return report;
      
    } catch (error) {
      logger.error('Failed to get accessibility report:', error);
      return null;
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig) {
    try {
      this.config = { ...this.config, ...newConfig };
      this.applyAccessibilitySettings();
      
    } catch (error) {
      logger.error('Failed to update configuration:', error);
    }
  }

  /**
   * Cleanup
   */
  cleanup() {
    try {
      // Remove event listeners
      document.removeEventListener('keydown', this.handleKeyDown.bind(this));
      document.removeEventListener('keyup', this.handleKeyUp.bind(this));
      document.removeEventListener('focusin', this.handleFocusIn.bind(this));
      document.removeEventListener('focusout', this.handleFocusOut.bind(this));
      document.removeEventListener('click', this.handleClick.bind(this));
      
      // Remove skip links
      const skipLinks = document.querySelectorAll('.skip-link');
      skipLinks.forEach(link => link.remove());
      
      // Remove announcement container
      if (this.state.announcementContainer) {
        this.state.announcementContainer.remove();
      }
      
      // Remove live region
      if (this.state.liveRegion) {
        this.state.liveRegion.remove();
      }
      
      // Clear state
      this.state = {
        currentFocus: null,
        lastAnnouncement: '',
        announcementQueue: [],
        keyboardShortcuts: new Map(),
        focusableElements: new Set()
      };
      
      logger.info('Accessibility module cleaned up');
      
    } catch (error) {
      logger.error('Failed to cleanup accessibility module:', error);
    }
  }
}

// Export singleton instance
const accessibilityModule = new AccessibilityModule();

export default accessibilityModule;