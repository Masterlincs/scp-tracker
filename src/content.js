/**
 * SCP Tracker Content Script
 * Main entry point that orchestrates all modules
 */

// Ensure browser.* API in Chrome via polyfill
import browserPolyfill from 'webextension-polyfill';
if (typeof globalThis.browser === 'undefined') {
  globalThis.browser = browserPolyfill;
}

// Ensure dynamic imports fetch chunks from the extension URL (not the page origin)
// Must be set before any dynamic import happens
try {
  // eslint-disable-next-line no-undef
  __webpack_public_path__ = browser.runtime.getURL('/');
} catch (e) {
  // Ignore if not available in test environments
}

import { logger, errorHandler, StorageManager } from './utils/index.js';
import { FEATURES, DEFAULTS, VALIDATION } from './config.js';

// Heavy modules loaded dynamically to reduce initial bundle size
let scpDetectorNS; // namespace object from scp-detector.js (UMD) { createDetector, utils, constants }
let detector; // instance created via createDetector
let detectorUnsubUpdate; // function to unsubscribe from updates
let uiComponents;
let dictionary;
let errorBoundary;
let securityModule;
let performanceModule;
let resourceManager;
let accessibilityModule;
let accessibilityCssEl;
let readerModule;
let linkPreviewsModule;
let linkPreviewsCssEl;


async function loadHeavyModules() {
  try {
    const [
      detectorMod,
      uiComponentsMod,
      dictionaryMod,
      errorBoundaryMod,
      securityMod,
      performanceMod,
      resourceManagerMod
    ] = await Promise.all([
      import(/* webpackChunkName: "scp-detector" */ './modules/scp-detector.js'),
      import(/* webpackChunkName: "ui-components" */ './modules/ui-components.js'),
      import(/* webpackChunkName: "dictionary" */ './modules/dictionary.js'),
      import(/* webpackChunkName: "error-boundary" */ './modules/error-boundary.js'),
      import(/* webpackChunkName: "security" */ './modules/security.js'),
      import(/* webpackChunkName: "performance" */ './modules/performance.js'),
      import(/* webpackChunkName: "resource-manager" */ './modules/resource-manager.js')
    ]);

    // scp-detector.js is UMD; esbuild may expose it as default or namespace
    scpDetectorNS = detectorMod && (detectorMod.default || detectorMod);
    // Create detector instance with DI for logger and errorHandler
    try {
      detector = scpDetectorNS && typeof scpDetectorNS.createDetector === 'function'
        ? scpDetectorNS.createDetector({ logger, errorHandler, observe: true, debounceMs: 150, allowedDomains: ['scp-wiki.wikidot.com'] })
        : null;
      if (detector && typeof detector.on === 'function') {
        detectorUnsubUpdate = detector.on('update', () => {
          // No-op for now; initial detection handled via retry. Kept for future real-time features.
        });
      }
    } catch (e) {
      logger.warn('Failed to initialize scp-detector instance:', e);
      detector = null;
    }
    uiComponents = uiComponentsMod.default;
    dictionary = dictionaryMod.default;
    errorBoundary = errorBoundaryMod.default;
    securityModule = securityMod.default;
    performanceModule = performanceMod.default;
    resourceManager = resourceManagerMod.default;
    
    logger.debug('All heavy modules loaded successfully');
  } catch (error) {
    logger.error('Failed to load heavy modules:', error);
    throw error;
  }
}

async function maybeEnableAccessibility() {
  try {
    if (!FEATURES.ENABLE_ACCESSIBILITY) {
      logger.debug('Accessibility feature disabled via flag');
      return;
    }
    if (!globalState.settings || globalState.settings.accessibilityEnabled === false) {
      logger.debug('Accessibility disabled via user settings');
      return;
    }

    const mod = await import(/* webpackChunkName: "accessibility" */ './modules/accessibility.js');
    accessibilityModule = mod.default;

    // Inject stylesheet
    const href = browser.runtime.getURL('accessibility.css');
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.id = 'scp-accessibility-css';
    document.documentElement.appendChild(link);
    accessibilityCssEl = link;

    // Initialize module if available
    if (accessibilityModule && typeof accessibilityModule.initialize === 'function') {
      await accessibilityModule.initialize();
    }

    logger.debug('Accessibility module loaded, initialized, and stylesheet injected');
  } catch (error) {
    logger.warn('Failed to enable accessibility module:', error);
  }
}

function disableAccessibility() {
  try {
    if (accessibilityModule && typeof accessibilityModule.cleanup === 'function') {
      accessibilityModule.cleanup();
    }
    if (accessibilityCssEl && accessibilityCssEl.parentNode) {
      accessibilityCssEl.parentNode.removeChild(accessibilityCssEl);
      accessibilityCssEl = null;
    }
    logger.debug('Accessibility module cleaned up and stylesheet removed');
  } catch (e) {
    logger.warn('Error disabling accessibility:', e);
  }
}

async function maybeEnableReader() {
  try {
    if (!FEATURES.ENABLE_READER) {
      logger.debug('Reader feature disabled via flag');
      return;
    }
    if (!globalState.settings || globalState.settings.readerEnabled !== true) {
      logger.debug('Reader disabled via user settings');
      return;
    }
    if (!readerModule) {
      const mod = await import(/* webpackChunkName: "reader" */ './modules/reader.js');
      readerModule = mod.default;
    }
    if (readerModule && typeof readerModule.initialize === 'function') {
      await readerModule.initialize({
        enabled: true,
        theme: globalState.settings.readerTheme,
        typography: globalState.settings.readerTypography,
        customCSS: globalState.settings.readerCustomCSS
      });
      readerModule.enable();
      logger.debug('Reader module initialized and enabled');
    }
  } catch (error) {
    logger.warn('Failed to enable reader module:', error);
  }
}

function disableReader() {
  try {
    if (readerModule && typeof readerModule.disable === 'function') {
      readerModule.disable();
    }
  } catch (e) {
    logger.warn('Error disabling reader:', e);
  }
}

async function maybeEnableLinkPreviews() {
  try {
    if (!FEATURES.ENABLE_LINK_PREVIEWS) {
      logger.debug('Link previews feature disabled via flag');
      return;
    }
    if (!globalState.settings || globalState.settings.linkPreviewsEnabled === false) {
      logger.debug('Link previews disabled via user settings');
      return;
    }
    if (!linkPreviewsModule) {
      const mod = await import(/* webpackChunkName: "link-previews" */ './modules/link-previews.js');
      linkPreviewsModule = mod.default;
    }
    // Inject stylesheet once
    if (!linkPreviewsCssEl) {
      const href = browser.runtime.getURL('styles/link-previews.css');
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.id = 'scp-link-previews-css';
      document.documentElement.appendChild(link);
      linkPreviewsCssEl = link;
    }
    if (linkPreviewsModule && typeof linkPreviewsModule.initialize === 'function') {
      await linkPreviewsModule.initialize();
    }
    logger.debug('Link previews module loaded and initialized');
  } catch (error) {
    logger.warn('Failed to enable link previews module:', error);
  }
}

function disableLinkPreviews() {
  try {
    if (linkPreviewsModule && typeof linkPreviewsModule.cleanup === 'function') {
      linkPreviewsModule.cleanup();
    }
    if (linkPreviewsCssEl && linkPreviewsCssEl.parentNode) {
      linkPreviewsCssEl.parentNode.removeChild(linkPreviewsCssEl);
      linkPreviewsCssEl = null;
    }
    logger.debug('Link previews module cleaned up and stylesheet removed');
  } catch (e) {
    logger.warn('Error disabling link previews:', e);
  }
}

// Global state
const globalState = {
  isInitialized: false,
  isProcessing: false,
  lastScrollPosition: 0,
  scrollThreshold: 0.8, // 80% of page height
  storageManager: null,
  settings: {
    dictionaryEnabled: true,
    navigatorEnabled: true,
    showProgress: true,
    showReadingTime: true,
    readerEnabled: false,
    readerTheme: 'default',
    readerTypography: { fontSize: '100%', lineHeight: 1.6, maxWidth: '800px' },
    readerCustomCSS: ''
  }
};

// Utils
const debounce = (fn, wait = 100) => {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
};

const sanitizeSCP = (info) => {
  if (!info) return null;
  try {
    return {
      number: securityModule ? securityModule.sanitize('text', info.number) : info.number,
      title: securityModule ? securityModule.sanitize('text', info.title) : info.title,
      type: securityModule ? securityModule.sanitize('text', info.type) : info.type,
      url: securityModule ? securityModule.sanitize('url', info.url) : info.url
    };
  } catch (error) {
    logger.warn('Error sanitizing SCP info, using raw data:', error);
    return info;
  }
};

// Sanitize and normalize tags array
const sanitizeTags = (tags) => {
  try {
    const set = new Set();
    (Array.isArray(tags) ? tags : []).forEach((t) => {
      let v = typeof t === 'string' ? t.trim().toLowerCase() : '';
      if (!v) return;
      v = securityModule ? securityModule.sanitize('text', v) : v;
      if (v) set.add(v);
    });
    return Array.from(set).sort();
  } catch (e) {
    logger.warn('Error sanitizing tags, returning empty:', e);
    return [];
  }
};

// Keep a reference to debounced handlers for cleanup
let debouncedHandleScroll;

// Extract tags from DOM (replaces legacy scpDetector.extractTags)
function extractTagsFromDOM() {
  try {
    const selectors = [
      '.page-tags a',
      '.page-tags-list a',
      '.tags a',
      '#page-tags a'
    ];
    const set = new Set();
    for (const sel of selectors) {
      const nodes = (document && document.querySelectorAll) ? document.querySelectorAll(sel) : [];
      nodes.forEach((n) => {
        const txt = (n && n.textContent) ? n.textContent.trim().toLowerCase() : '';
        if (txt) set.add(txt);
      });
    }
    return Array.from(set).sort();
  } catch (e) {
    logger.warn('Error extracting tags from DOM:', e);
    return [];
  }
}

// Generic title extractor that prefers on-page title elements, falls back to provided default
function extractPageTitle(defaultTitle) {
  try {
    const candidates = [
      '#page-title',
      'h1',
      '.page-title',
      '.title',
      '#page-title h1',
      'h1.title',
      '.content h1',
      'title'
    ];
    for (const selector of candidates) {
      const el = selector === 'title' ? document.querySelector('title') : document.querySelector(selector);
      if (el && el.textContent) {
        const text = el.textContent.trim();
        if (text && (!defaultTitle || text !== defaultTitle)) {
          return text;
        }
      }
    }
    return defaultTitle || '';
  } catch (e) {
    logger.warn('Error extracting page title:', e);
    return defaultTitle || '';
  }
}

// Determine if a tale-like slug is valid (ported from legacy)
function isValidTalePath(slug) {
  if (!slug || slug === '') return false;
  if (slug.includes('/')) return false;
  const s = String(slug).toLowerCase();
  const baseBlockedPrefixes = [
    'system:', 'forum:', 'user:', 'fragment:', 'component:', 'sandbox:', 'theme:', 'nav:', 'admin:'
  ];
  const baseBlockedExact = new Set([
    'main', 'forum', 'login', 'logout', 'start', 'about', 'help', 'guide', 'contact',
    'license', 'image-license', 'image-licensing', 'policy', 'tags', 'page-tags',
    'list-all-pages', 'recent-changes', 'random', 'history', 'edit', 'notify', 'search',
    'site-manager', 'nav:side', 'nav:top', 'members', 'join', 'signup', 'profile'
  ]);
  if (baseBlockedPrefixes.some(p => s.startsWith(p))) return false;
  if (baseBlockedExact.has(s)) return false;
  if (/^scp-\d+/i.test(s)) return false; // looks like SCP entry
  if (/^series-[ivx]+$/i.test(s)) return false;
  return /^[a-z0-9-]+$/i.test(s);
}

// Compute current page info using new-detector utils + URL/DOM
function computeCurrentSCPInfo() {
  try {
    const href = window.location.href;
    const urlObj = new URL(href);
    const path = (urlObj.pathname || '/').replace(/^\/+/, '').toLowerCase();
    const isSCPPathExact = /^scp-(\d{1,4})$/i.test(path);
    const seriesMatch = /^series-([ivx]+)$/i.exec(path);

    if (isSCPPathExact) {
      const num = path.match(/^scp-(\d{1,4})$/i)[1];
      const title = extractPageTitle(`SCP-${num}`);
      return { number: num, title, type: 'scp', url: href };
    }

    if (seriesMatch && seriesMatch[1]) {
      const roman = seriesMatch[1];
      const title = extractPageTitle(`Series ${roman.toUpperCase()}`);
      return { number: roman, title, type: 'series', url: href };
    }

    if (isValidTalePath(path)) {
      const title = extractPageTitle(path);
      return { number: path, title, type: 'tale', url: href };
    }

    // As a final check, try new-detector classification to guard false positives
    try {
      if (scpDetectorNS && scpDetectorNS.utils && typeof scpDetectorNS.utils.classifyPage === 'function') {
        const cls = scpDetectorNS.utils.classifyPage(urlObj, document.title);
        if (cls && cls.type === 'scp_article') {
          const m = /(?:^|\/)scp-(\d{1,4})(?:\b|$)/i.exec(path);
          if (m && m[1]) {
            const title = extractPageTitle(`SCP-${m[1]}`);
            return { number: m[1], title, type: 'scp', url: href };
          }
        }
      }
    } catch (_) { /* ignore classification errors */ }

    return null;
  } catch (e) {
    errorHandler.handleError(e, { action: 'compute_current_scp_info' });
    return null;
  }
}

// Initialize content script
async function initialize() {
  try {
    logger.info('Initializing SCP Tracker content script');
    // Load heavy modules lazily
    await loadHeavyModules();

    // Register error boundary for content script
    errorBoundary.registerErrorBoundary('content_script', {
      maxErrors: 10,
      resetTimeout: 60000,
      recoveryStrategy: 'ui_error'
    });
    
    // Initialize security module
    await securityModule.initialize();
    
    // Initialize performance module
    await performanceModule.initialize();
    
    // Initialize resource manager
    await resourceManager.initialize();
    
    // Check if we're on SCP Wiki
    if (!window.location.href.includes('scp-wiki.wikidot.com')) {
      logger.debug('Not on SCP Wiki, skipping initialization');
      return;
    }
    
    // Initialize storage manager
    globalState.storageManager = new StorageManager('local');
    
    // Load settings
    await loadSettings();
    
    // Initialize modules
    await initializeModules();

    // Conditionally enable accessibility features
    await maybeEnableAccessibility();
    // Conditionally enable reader features
    await maybeEnableReader();
    // Conditionally enable link previews
    await maybeEnableLinkPreviews();
    
    // Setup event listeners with performance optimization
    setupEventListeners();
    
    // Initial SCP detection with retry (handles late DOM readiness for #page-title)
    await detectWithRetry(8, 300);
    
    globalState.isInitialized = true;
    logger.info('SCP Tracker content script initialized successfully');
    
  } catch (error) {
    await errorBoundary.handleError(error, {
      action: 'content_script_initialize',
      boundaryId: 'content_script'
    });
  }
}

// Retry initial detection a few times to handle slow DOM readiness
async function detectWithRetry(retries = 6, delayMs = 500) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const info = sanitizeSCP(computeCurrentSCPInfo());
      if (info) {
        logger.debug(`Initial detection succeeded (attempt ${attempt}/${retries})`);
        await handleSCPDetected(info);
        return true;
      }
      logger.debug(`Initial detection empty (attempt ${attempt}/${retries})`);
    } catch (error) {
      errorHandler.handleError(error, {
        action: 'detect_with_retry',
        attempt
      });
    }
    // wait before next attempt
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  logger.debug('Initial detection did not find SCP info after retries');
  return false;
}

// Load settings from storage
async function loadSettings() {
  try {
    const settings = await globalState.storageManager.get([
      'dictionaryEnabled',
      'navigatorEnabled',
      'showProgress',
      'showReadingTime',
      'accessibilityEnabled',
      'linkPreviewsEnabled',
      'readerEnabled',
      'readerTheme',
      'readerTypography',
      'readerCustomCSS',
      'scrollThreshold'
    ]);

    const {
      dictionaryEnabled,
      navigatorEnabled,
      showProgress,
      showReadingTime,
      accessibilityEnabled,
      linkPreviewsEnabled,
      readerEnabled,
      readerTheme,
      readerTypography,
      readerCustomCSS,
      scrollThreshold
    } = settings || {};

    // Apply settings with defaults
    globalState.settings = {
      dictionaryEnabled: dictionaryEnabled ?? true,
      navigatorEnabled: navigatorEnabled ?? true,
      showProgress: showProgress ?? true,
      showReadingTime: showReadingTime ?? true,
      accessibilityEnabled: accessibilityEnabled ?? FEATURES.ENABLE_ACCESSIBILITY,
      linkPreviewsEnabled: linkPreviewsEnabled ?? FEATURES.ENABLE_LINK_PREVIEWS,
      readerEnabled: readerEnabled ?? false,
      readerTheme: readerTheme ?? 'default',
      readerTypography: readerTypography ?? { fontSize: '100%', lineHeight: 1.6, maxWidth: '800px' },
      readerCustomCSS: readerCustomCSS ?? ''
    };
    // Apply scroll threshold with validation
    try {
      const def = (DEFAULTS && DEFAULTS.SETTINGS && typeof DEFAULTS.SETTINGS.SCROLL_THRESHOLD === 'number') ? DEFAULTS.SETTINGS.SCROLL_THRESHOLD : 0.8;
      const min = (VALIDATION && VALIDATION.SETTINGS && typeof VALIDATION.SETTINGS.SCROLL_THRESHOLD.MIN === 'number') ? VALIDATION.SETTINGS.SCROLL_THRESHOLD.MIN : 0.1;
      const max = (VALIDATION && VALIDATION.SETTINGS && typeof VALIDATION.SETTINGS.SCROLL_THRESHOLD.MAX === 'number') ? VALIDATION.SETTINGS.SCROLL_THRESHOLD.MAX : 1.0;
      const val = parseFloat(scrollThreshold);
      const clamped = Number.isFinite(val) ? Math.min(max, Math.max(min, val)) : def;
      globalState.scrollThreshold = clamped;
    } catch (e) {
      // Fallback to existing value on any error
    }
    
    logger.debug('Settings loaded:', globalState.settings);
    
  } catch (error) {
    errorHandler.handleError(error, {
      action: 'load_settings'
    });
  }
}

// Initialize all modules
async function initializeModules() {
  try {
    // Initialize dictionary if enabled
    if (globalState.settings.dictionaryEnabled) {
      await dictionary.initialize();
      logger.debug('Dictionary module initialized');
    }
    
    // Initialize UI components
    uiComponents.setGlobalState({
      dictionaryEnabled: globalState.settings.dictionaryEnabled,
      navigatorEnabled: globalState.settings.navigatorEnabled
    });
    
    // Add UI components based on settings
    if (globalState.settings.showProgress) {
      uiComponents.addProgressIndicator();
    }
    
    if (globalState.settings.showReadingTime) {
      uiComponents.displayReadingTime();
    }
    
    // Add manual read button
    uiComponents.addManualButton();
    
    // Setup keyboard shortcuts
    uiComponents.setupKeyboardShortcuts();
    
    logger.debug('All modules initialized');
    
  } catch (error) {
    errorHandler.handleError(error, {
      action: 'initialize_modules'
    });
  }
}

// Setup event listeners
function setupEventListeners() {
  try {
    // Handle manual read button clicks
    document.addEventListener('scpManualRead', handleManualRead);
    
    // Handle scroll events for bottom detection (debounced)
    debouncedHandleScroll = debounce(handleScroll, 100);
    window.addEventListener('scroll', debouncedHandleScroll);
    
    // Handle page visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Handle page unload
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Handle messages from background script
    browser.runtime.onMessage.addListener(handleBackgroundMessage);
    
    logger.debug('Event listeners setup complete');
    
  } catch (error) {
    errorHandler.handleError(error, {
      action: 'setup_event_listeners'
    });
  }
}

 

// Handle scroll events
function handleScroll() {
  try {
    if (globalState.isProcessing) return;
    
    const scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight;
    const clientHeight = document.documentElement.clientHeight;
    
    // Calculate scroll progress
    const scrollProgress = scrollPosition / (scrollHeight - clientHeight);
    
    // Update progress indicator
    if (globalState.settings.showProgress) {
      uiComponents.updateProgress(scrollProgress * 100);
    }
    
    // Check if bottom is reached
    if (scrollProgress >= globalState.scrollThreshold) {
      handleBottomReached();
    }
    
    globalState.lastScrollPosition = scrollPosition;
    
  } catch (error) {
    errorHandler.handleError(error, {
      action: 'handle_scroll'
    });
  }
}

// Handle bottom reached
async function handleBottomReached() {
  try {
    if (globalState.isProcessing) return;
    
    globalState.isProcessing = true;
    
    // Extract SCP info
    const scpInfo = sanitizeSCP(computeCurrentSCPInfo());
    if (scpInfo) {
      await handleSCPRead(scpInfo);
    }
    
    globalState.isProcessing = false;
    
  } catch (error) {
    globalState.isProcessing = false;
    errorHandler.handleError(error, {
      action: 'handle_bottom_reached'
    });
  }
}

// Handle SCP detection
async function handleSCPDetected(scpInfo) {
  try {
    logger.debug('SCP detected:', scpInfo);
    
    // Send message to background script
    browser.runtime.sendMessage({
      action: 'scpDetected',
      scpNumber: scpInfo.number,
      scpTitle: scpInfo.title,
      url: scpInfo.url,
      type: scpInfo.type
    }).catch(error => {
      logger.warn('Failed to send scpDetected message:', error);
    });
    
  } catch (error) {
    errorHandler.handleError(error, {
      action: 'handle_scp_detected',
      scpNumber: scpInfo.number
    });
  }
}

// Handle SCP read (when bottom is reached)
async function handleSCPRead(scpInfo) {
  try {
    logger.debug('SCP read:', scpInfo);
    
    // Check if already marked as read
    const existingData = await globalState.storageManager.get(['readSCPs']);
    const readSCPs = existingData.readSCPs || {};
    
    if (readSCPs[scpInfo.number] && readSCPs[scpInfo.number].read) {
      logger.debug('SCP already marked as read:', scpInfo.number);
      return;
    }
    
    // Extract and sanitize tags from page
    const rawTags = extractTagsFromDOM();
    const tags = sanitizeTags(rawTags);

    // Mark as read
    readSCPs[scpInfo.number] = {
      read: true,
      timestamp: Date.now(),
      title: scpInfo.title,
      url: scpInfo.url,
      type: scpInfo.type,
      tags
    };
    
    await globalState.storageManager.set({ readSCPs });
    
    // Show feedback
    uiComponents.showReadFeedback();
    
    // Send message to background script
    browser.runtime.sendMessage({
      action: 'bottomReached',
      scpNumber: scpInfo.number,
      scpTitle: scpInfo.title,
      url: scpInfo.url,
      type: scpInfo.type,
      tags
    }).catch(error => {
      logger.warn('Failed to send bottomReached message:', error);
    });
    
    logger.info('SCP marked as read:', scpInfo.number);
    
  } catch (error) {
    errorHandler.handleError(error, {
      action: 'handle_scp_read',
      scpNumber: scpInfo.number
    });
  }
}

// Handle manual read
async function handleManualRead() {
  try {
    const scpInfo = sanitizeSCP(computeCurrentSCPInfo());
    if (scpInfo) {
      await handleSCPRead(scpInfo);
    } else {
      logger.warn('No SCP info extracted for manual read');
      // Show feedback even if no SCP detected
      uiComponents.showReadFeedback();
    }
  } catch (error) {
    errorHandler.handleError(error, {
      action: 'handle_manual_read'
    });
  }
}

// Handle visibility changes
function handleVisibilityChange() {
  try {
    if (document.hidden) {
      logger.debug('Page hidden, pausing monitoring');
      // Pause any active monitoring
    } else {
      logger.debug('Page visible, resuming monitoring');
      // Resume monitoring
      handleScroll(); // Check current scroll position
    }
  } catch (error) {
    errorHandler.handleError(error, {
      action: 'handle_visibility_change'
    });
  }
}

// Handle before unload
function handleBeforeUnload() {
  try {
    // Flush any pending storage writes
    if (globalState.storageManager) {
      globalState.storageManager.flush();
    }
    
    // Clean up resources
    cleanup();
  } catch (error) {
    logger.warn('Error during before unload cleanup:', error);
  }
}

// Handle background messages
function handleBackgroundMessage(message, sender, sendResponse) {
  try {
    logger.debug('Received background message:', message);
    
    switch (message.action) {
      case 'applySetting':
        handleApplySetting(message);
        break;
      case 'settingsChanged': {
        const changed = message.settings || {};
        Object.entries(changed).forEach(([key, value]) => {
          handleApplySetting({ setting: key, value });
        });
        break;
      }
      case 'getSettings':
        sendResponse(globalState.settings);
        break;
      default:
        logger.warn('Unknown message action:', message.action);
    }
    
  } catch (error) {
    errorHandler.handleError(error, {
      action: 'handle_background_message',
      messageAction: message.action
    });
  }
}

// Apply settings from background script
function handleApplySetting(message) {
  try {
    const { setting, value } = message;
    
    if (Object.prototype.hasOwnProperty.call(globalState.settings, setting)) {
      globalState.settings[setting] = value;
      
      // Apply setting changes
      switch (setting) {
        case 'dictionaryEnabled':
          if (value) {
            dictionary.initialize();
          } else {
            dictionary.cleanup();
          }
          break;
        case 'accessibilityEnabled':
          if (value) {
            maybeEnableAccessibility();
          } else {
            disableAccessibility();
          }
          break;
        case 'linkPreviewsEnabled':
          if (value) {
            maybeEnableLinkPreviews();
          } else {
            disableLinkPreviews();
          }
          break;
        case 'showProgress':
          if (value) {
            uiComponents.addProgressIndicator();
          } else {
            const indicator = uiComponents.getComponent('progressIndicator');
            if (indicator) {
              indicator.remove();
            }
          }
          break;
          
        case 'showReadingTime':
          if (value) {
            uiComponents.displayReadingTime();
          } else {
            const timeDisplay = uiComponents.getComponent('readingTime');
            if (timeDisplay) {
              timeDisplay.remove();
            }
          }
          break;

        case 'scrollThreshold': {
          try {
            const def = (DEFAULTS && DEFAULTS.SETTINGS && typeof DEFAULTS.SETTINGS.SCROLL_THRESHOLD === 'number') ? DEFAULTS.SETTINGS.SCROLL_THRESHOLD : 0.8;
            const min = (VALIDATION && VALIDATION.SETTINGS && typeof VALIDATION.SETTINGS.SCROLL_THRESHOLD.MIN === 'number') ? VALIDATION.SETTINGS.SCROLL_THRESHOLD.MIN : 0.1;
            const max = (VALIDATION && VALIDATION.SETTINGS && typeof VALIDATION.SETTINGS.SCROLL_THRESHOLD.MAX === 'number') ? VALIDATION.SETTINGS.SCROLL_THRESHOLD.MAX : 1.0;
            const raw = parseFloat(value);
            const clamped = Number.isFinite(raw) ? Math.min(max, Math.max(min, raw)) : def;
            globalState.scrollThreshold = clamped;
          } catch (e) {
            // ignore invalid values
          }
          break;
        }

        case 'readerEnabled':
          if (!FEATURES.ENABLE_READER) break;
          if (value) {
            // lazy-load module if needed
            Promise.resolve().then(async () => {
              try {
                if (!readerModule) {
                  const mod = await import(/* webpackChunkName: "reader" */ './modules/reader.js');
                  readerModule = mod.default;
                }
                await readerModule.initialize({
                  enabled: true,
                  theme: globalState.settings.readerTheme,
                  typography: globalState.settings.readerTypography,
                  customCSS: globalState.settings.readerCustomCSS
                });
                readerModule.enable();
              } catch (e) {
                logger.warn('Failed to enable reader on toggle:', e);
              }
            });
          } else {
            disableReader();
          }
          break;

        case 'readerTheme':
          if (!FEATURES.ENABLE_READER) break;
          Promise.resolve().then(async () => {
            try {
              if (!readerModule) {
                const mod = await import(/* webpackChunkName: "reader" */ './modules/reader.js');
                readerModule = mod.default;
                await readerModule.initialize({ enabled: false });
              }
              readerModule.applyTheme(value);
            } catch (e) { logger.warn('Failed to apply reader theme:', e); }
          });
          break;

        case 'readerTypography':
          if (!FEATURES.ENABLE_READER) break;
          Promise.resolve().then(async () => {
            try {
              if (!readerModule) {
                const mod = await import(/* webpackChunkName: "reader" */ './modules/reader.js');
                readerModule = mod.default;
                await readerModule.initialize({ enabled: false });
              }
              readerModule.applyTypography(value);
            } catch (e) { logger.warn('Failed to apply reader typography:', e); }
          });
          break;

        case 'readerCustomCSS':
          if (!FEATURES.ENABLE_READER) break;
          Promise.resolve().then(async () => {
            try {
              if (!readerModule) {
                const mod = await import(/* webpackChunkName: "reader" */ './modules/reader.js');
                readerModule = mod.default;
                await readerModule.initialize({ enabled: false });
              }
              readerModule.applyCustomCSS(value);
            } catch (e) { logger.warn('Failed to apply reader custom CSS:', e); }
          });
          break;
      }
      
      logger.debug('Setting applied:', setting, value);
    }
    
  } catch (error) {
    errorHandler.handleError(error, {
      action: 'apply_setting',
      setting: message.setting
    });
  }
}

// Clean up resources
function cleanup() {
  try {
    logger.debug('Cleaning up content script resources');
    
    // Clean up modules
    if (dictionary && typeof dictionary.cleanup === 'function') {
      dictionary.cleanup();
    }
    if (uiComponents && typeof uiComponents.cleanupAll === 'function') {
      uiComponents.cleanupAll();
    }
    
    // Remove event listeners
    document.removeEventListener('scpManualRead', handleManualRead);
    if (debouncedHandleScroll) {
      window.removeEventListener('scroll', debouncedHandleScroll);
    } else {
      window.removeEventListener('scroll', handleScroll);
    }
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('beforeunload', handleBeforeUnload);
    browser.runtime.onMessage.removeListener(handleBackgroundMessage);

    // Detector cleanup
    try {
      if (detectorUnsubUpdate) {
        detectorUnsubUpdate();
        detectorUnsubUpdate = null;
      }
      if (detector && typeof detector.dispose === 'function') {
        detector.dispose();
      }
    } catch (e) {
      logger.warn('Error during detector cleanup:', e);
    }

    // Accessibility cleanup
    try {
      if (accessibilityModule && typeof accessibilityModule.cleanup === 'function') {
        accessibilityModule.cleanup();
      }
      if (accessibilityCssEl && accessibilityCssEl.parentNode) {
        accessibilityCssEl.parentNode.removeChild(accessibilityCssEl);
      }
    } catch (e) {
      logger.warn('Error during accessibility cleanup:', e);
    }
    // Reader cleanup
    try {
      if (readerModule && typeof readerModule.cleanup === 'function') {
        readerModule.cleanup();
      }
    } catch (e) {
      logger.warn('Error during reader cleanup:', e);
    }
    // Link previews cleanup
    try {
      if (linkPreviewsModule && typeof linkPreviewsModule.cleanup === 'function') {
        linkPreviewsModule.cleanup();
      }
      if (linkPreviewsCssEl && linkPreviewsCssEl.parentNode) {
        linkPreviewsCssEl.parentNode.removeChild(linkPreviewsCssEl);
        linkPreviewsCssEl = null;
      }
    } catch (e) {
      logger.warn('Error during link previews cleanup:', e);
    }
    
    // Reset global state
    globalState.isInitialized = false;
    globalState.isProcessing = false;
    
    logger.debug('Cleanup complete');
    
  } catch (error) {
    logger.warn('Error during cleanup:', error);
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

// Handle page unload
window.addEventListener('unload', cleanup);

// Export for debugging
window.SCPTracker = {
  initialize,
  cleanup,
  getSettings: () => globalState.settings,
  getStats: () => ({
    isInitialized: globalState.isInitialized,
    isProcessing: globalState.isProcessing,
    dictionary: (dictionary && typeof dictionary.getStats === 'function') ? dictionary.getStats() : {},
    ui: (uiComponents && typeof uiComponents.getGlobalState === 'function') ? uiComponents.getGlobalState() : {}
  })
};

logger.info('SCP Tracker content script loaded');
