/**
 * Configuration constants for SCP Tracker
 */

export const DEFAULTS = {
  // Storage keys
  STORAGE_KEYS: {
    READ_SCPS: 'readSCPs',
    SETTINGS: 'settings',
    STATS: 'stats',
    FIRST_RUN: 'firstRun',
  },
  
  // Default settings
  SETTINGS: {
    DICTIONARY_ENABLED: true,
    NAVIGATOR_ENABLED: true,
    SHOW_PROGRESS: true,
    SHOW_READING_TIME: true,
    AUTO_MARK_READ: false,
    SCROLL_THRESHOLD: 0.8,
  },
  
  // API endpoints
  API: {
    BASE_URL: 'https://api.scp-wiki.net',
    ENDPOINTS: {
      SCP_INFO: '/scp/',
      RELATED_CONTENT: '/related/',
    },
  },
  
  // UI constants
  UI: {
    NOTIFICATION_DURATION: 3000, // ms
    DEBOUNCE_DELAY: 300, // ms
    MAX_RECENT_ITEMS: 10,
  },
  
  // Performance
  PERFORMANCE: {
    BATCH_UPDATE_DELAY: 1000, // ms
    MAX_BATCH_SIZE: 10,
  },
  
  // Error messages
  ERRORS: {
    STORAGE: 'Failed to access storage',
    NETWORK: 'Network request failed',
    PERMISSION: 'Insufficient permissions',
    VALIDATION: 'Invalid input',
  },
};

// Content Security Policy configuration
export const CSP = {
  DIRECTIVES: {
    DEFAULT_SRC: ["'self'"],
    SCRIPT_SRC: ["'self'"],
    STYLE_SRC: ["'self'"],
    IMG_SRC: ["'self'", 'data:', 'https:'],
    CONNECT_SRC: [
      'https://scp-wiki.wikidot.com',
      'https://api.scp-wiki.net',
    ],
  },
  getCSPString() {
    return Object.entries(this.DIRECTIVES)
      .map(([directive, sources]) => {
        return `${directive} ${sources.join(' ')}`;
      })
      .join('; ');
  },
};

// Feature flags
export const FEATURES = {
  DEBUG_MODE: process.env.NODE_ENV === 'development',
  ENABLE_ANALYTICS: true, // Analytics implemented
  ENABLE_OFFLINE: true,
  ENABLE_ACCESSIBILITY: true,
  ENABLE_READER: true,
  ENABLE_LINK_PREVIEWS: true,
};

// Validation patterns
export const VALIDATION = {
  SCP_NUMBER: /^SCP-\d{3,4}(?:-\w+)?$/i,
  URL: /^https?:\/\/scp-wiki\.wikidot\.com\/.*$/i,
  SETTINGS: {
    SCROLL_THRESHOLD: {
      MIN: 0.1,
      MAX: 1.0,
    },
  },
};

export default {
  DEFAULTS,
  CSP,
  FEATURES,
  VALIDATION,
};
