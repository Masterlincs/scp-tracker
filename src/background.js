// Ensure browser.* API in Chrome via polyfill
import browserPolyfill from 'webextension-polyfill';
if (typeof globalThis.browser === 'undefined') {
  globalThis.browser = browserPolyfill;
}

// Import utilities
import { logger, errorHandler, StorageManager, BrowserCompatibility } from './utils/index.js';

// Create global storage manager instances
const storageManager = new StorageManager('sync');
const localStorageManager = new StorageManager('local');

// Link preview metadata cache settings
const LINK_PREVIEW_CACHE_KEY = 'linkPreviewCache';
const LINK_PREVIEW_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

async function getCachedMetadata(url) {
  try {
    const res = await localStorageManager.get([LINK_PREVIEW_CACHE_KEY]);
    const cache = (res && res[LINK_PREVIEW_CACHE_KEY]) || {};
    const entry = cache[url];
    if (entry && entry.ts && (Date.now() - entry.ts) < LINK_PREVIEW_TTL_MS) {
      return entry.data;
    }
    return null;
  } catch (e) {
    errorHandler.handleError(e, { action: 'get_cached_metadata' });
    return null;
  }
}

async function setCachedMetadata(url, data) {
  try {
    const res = await localStorageManager.get([LINK_PREVIEW_CACHE_KEY]);
    const cache = (res && res[LINK_PREVIEW_CACHE_KEY]) || {};
    cache[url] = { data, ts: Date.now() };
    await localStorageManager.set({ [LINK_PREVIEW_CACHE_KEY]: cache });
  } catch (e) {
    errorHandler.handleError(e, { action: 'set_cached_metadata' });
  }
}

function parseMetadataFromHtml(url, html) {
  try {
    const safe = (s) => (s || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    // Title: try #page-title first, then <title>
    let title = url;
    const h1Match = html.match(/id=["']page-title["'][^>]*>([\s\S]*?)<\//i);
    if (h1Match && h1Match[1]) {
      title = safe(h1Match[1]);
    } else {
      const tMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      if (tMatch && tMatch[1]) title = safe(tMatch[1]);
    }
    // Summary: first <p> inside #page-content, else first <p>
    let summary = '';
    const contentBlock = html.match(/id=["']page-content["'][\s\S]*?$/i);
    let pMatch = null;
    if (contentBlock && contentBlock[0]) {
      pMatch = contentBlock[0].match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    }
    if (!pMatch) {
      pMatch = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    }
    if (pMatch && pMatch[1]) summary = safe(pMatch[1]).slice(0, 400);
    // Rating: look for .rate-points content
    let rating = null;
    const rMatch = html.match(/class=["']rate-points["'][^>]*>(-?\d+)</i);
    if (rMatch && rMatch[1]) rating = parseInt(rMatch[1], 10);
    const type = /\/scp-(\d+)/i.test(url) ? 'scp' : 'tale';
    return { url, title, summary, rating, type };
  } catch (e) {
    errorHandler.handleError(e, { action: 'parse_metadata' });
    return { url, title: url, summary: '', rating: null, type: /\/scp-(\d+)/i.test(url) ? 'scp' : 'tale' };
  }
}

async function fetchMetadata(url) {
  try {
    const resp = await fetch(url, { credentials: 'omit', cache: 'force-cache', mode: 'cors' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const html = await resp.text();
    return parseMetadataFromHtml(url, html);
  } catch (e) {
    errorHandler.handleError(e, { action: 'fetch_metadata', url });
    return null;
  }
}

// Check browser compatibility
const compatibility = BrowserCompatibility.checkCompatibility();
if (!compatibility.compatible) {
  logger.error('Browser compatibility issue:', compatibility.reason);
}

// Sanitize and normalize tags array
function sanitizeTags(tags) {
  try {
    const set = new Set();
    (Array.isArray(tags) ? tags : []).forEach((t) => {
      if (typeof t !== 'string') return;
      const v = t.trim().toLowerCase();
      if (v) set.add(v);
    });
    return Array.from(set).sort();
  } catch (_) {
    return [];
  }
}

// Listen for messages from content script
browser.runtime.onMessage.addListener((message, sender) => {
  logger.info("Background received message:", message.action);
  
  if (message.action === "scpDetected") {
    // Validate message structure
    if (!message.scpNumber || !message.url) {
      logger.warn("Invalid scpDetected message:", message);
      return;
    }
    
    // Store that this SCP has been visited
    storageManager.get(['readSCPs']).then(result => {
      let readSCPs = result.readSCPs || {};
      
      if (!readSCPs[message.scpNumber]) {
        readSCPs[message.scpNumber] = {
          read: false, // Not marked as read yet
          detected: true,
          timestamp: Date.now(),
          title: message.scpTitle || `SCP-${message.scpNumber}`,
          url: message.url,
          type: message.type || 'unknown'
        };
        
        return storageManager.set({readSCPs: readSCPs});
      }
    }).catch(error => {
      errorHandler.handleError(error, {
        action: 'store_scp_detection',
        scpNumber: message.scpNumber
      });
    });
  }
  
  if (message.action === "bottomReached") {
    logger.info("Bottom reached message received");

    // Prefer message-provided fields; fallback to active tab parsing
    const msg = message || {};
    const msgUrl = typeof msg.url === 'string' ? msg.url : null;
    const msgType = typeof msg.type === 'string' ? msg.type : null;
    const msgNumber = typeof msg.scpNumber === 'string' || typeof msg.scpNumber === 'number' ? String(msg.scpNumber) : null;
    const msgTitle = typeof msg.scpTitle === 'string' ? msg.scpTitle : null;
    const msgTags = sanitizeTags(msg.tags);

    const tryPersist = (identifier, url, type, title, tags) => {
      if (!identifier || !url) {
        logger.warn('Cannot persist read entry: missing identifier or url');
        return;
      }
      storageManager.get(['readSCPs']).then(result => {
        const readSCPs = result.readSCPs || {};
        readSCPs[identifier] = {
          read: true,
          timestamp: Date.now(),
          title: title || `SCP-${identifier}`,
          url,
          type: type || (/\/scp-(\d+)/i.test(url) ? 'scp' : 'tale'),
          tags: tags || []
        };
        return storageManager.set({ readSCPs });
      }).then(() => {
        logger.info('Marked as read:', identifier);
      }).catch(error => {
        errorHandler.handleError(error, { action: 'mark_as_read', identifier });
      });
    };

    if (msgUrl) {
      // Derive identifier/type from message when possible
      let identifier = msgNumber || null;
      let type = msgType || 'unknown';
      if (!identifier) {
        const scpMatch = msgUrl.match(/scp-(\d+)/i);
        const taleMatch = msgUrl.match(/scp-wiki\.wikidot\.com\/(.*?)$/i);
        if (scpMatch && scpMatch[1]) {
          identifier = scpMatch[1];
          type = 'scp';
        } else if (taleMatch && taleMatch[1] && !taleMatch[1].includes('/') &&
                   taleMatch[1] !== '' && !taleMatch[1].startsWith('system:') &&
                   taleMatch[1] !== 'main' && taleMatch[1] !== 'forum' &&
                   taleMatch[1] !== 'nav:side') {
          identifier = taleMatch[1];
          type = 'tale';
        }
      }
      tryPersist(identifier, msgUrl, type, msgTitle, msgTags);
      return;
    }

    // Fallback: query active tab as before
    browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
      if (!tabs || !tabs[0]) {
        logger.warn('No active tab found');
        return;
      }
      const tab = tabs[0];
      const url = tab.url;
      if (!url || !url.includes('scp-wiki.wikidot.com')) {
        logger.warn('Invalid URL for bottomReached:', url);
        return;
      }
      const scpMatch = url.match(/scp-(\d+)/i);
      const taleMatch = url.match(/scp-wiki\.wikidot\.com\/(.*?)$/i);
      let identifier = null;
      let type = 'unknown';
      if (scpMatch && scpMatch[1]) {
        identifier = scpMatch[1];
        type = 'scp';
      } else if (taleMatch && taleMatch[1] && !taleMatch[1].includes('/') &&
                 taleMatch[1] !== '' && !taleMatch[1].startsWith('system:') &&
                 taleMatch[1] !== 'main' && taleMatch[1] !== 'forum' &&
                 taleMatch[1] !== 'nav:side') {
        identifier = taleMatch[1];
        type = 'tale';
      }
      tryPersist(identifier, url, type, tab.title || null, []);
    }).catch(error => {
      errorHandler.handleError(error, { action: 'bottomReached_tab_query' });
    });
  }
  
  if (message.action === "markUnread") {
    if (!message.scpNumber) {
      logger.warn("Invalid markUnread message: missing scpNumber");
      return;
    }
    
    storageManager.get(['readSCPs']).then(result => {
      let readSCPs = result.readSCPs || {};
      if (readSCPs[message.scpNumber]) {
        delete readSCPs[message.scpNumber];
        return storageManager.set({readSCPs: readSCPs});
      }
    }).catch(error => {
      errorHandler.handleError(error, {
        action: 'mark_unread',
        scpNumber: message.scpNumber
      });
    });
  }
  
  if (message.action === "getSettings") {
    return browser.storage.sync.get(null);
  }
  
  if (message.action === "saveSettings") {
    if (!message.settings || typeof message.settings !== 'object') {
      logger.warn("Invalid saveSettings message:", message);
      return Promise.reject(new Error('Invalid settings object'));
    }
    return browser.storage.sync.set(message.settings);
  }

  // Link preview: get metadata (with cache)
  if (message.action === 'linkPreview:getMetadata') {
    const url = message.url;
    if (!url || typeof url !== 'string') return Promise.resolve({ ok: false, error: 'invalid_url' });
    return (async () => {
      try {
        const cached = await getCachedMetadata(url);
        if (cached) return { ok: true, data: cached, cached: true };
        const data = await fetchMetadata(url);
        if (data) await setCachedMetadata(url, data);
        return data ? { ok: true, data } : { ok: false };
      } catch (e) {
        errorHandler.handleError(e, { action: 'link_preview_get_metadata' });
        return { ok: false };
      }
    })();
  }

  // Link preview: prefetch a batch of URLs
  if (message.action === 'linkPreview:prefetch') {
    const urls = Array.isArray(message.urls) ? message.urls : [];
    (async () => {
      for (const u of urls) {
        try {
          const cached = await getCachedMetadata(u);
          if (!cached) {
            const data = await fetchMetadata(u);
            if (data) await setCachedMetadata(u, data);
          }
        } catch (e) {
          // ignore individual failures
          logger.debug('Prefetch failed for', u, e);
        }
      }
    })();
    return; // no response expected
  }

  // Link preview: add to reading queue
  if (message.action === 'linkPreview:queue:add') {
    const item = message.item || {};
    const toStore = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      url: item.url,
      title: item.title,
      type: item.type || (/\/scp-(\d+)/i.test(item.url || '') ? 'scp' : 'tale'),
      addedAt: Date.now()
    };
    return storageManager.get(['readingQueue']).then(res => {
      const q = res.readingQueue || [];
      q.push(toStore);
      return storageManager.set({ readingQueue: q });
    })
      .then(() => {
        // Also open the URL in a new tab after queuing
        try {
          return browser.tabs.create({ url: toStore.url });
        } catch (_) {
          // ignore tab open failures and proceed
          return null;
        }
      })
      .then(() => ({ ok: true, item: toStore }))
      .catch(e => {
        errorHandler.handleError(e, { action: 'queue_add' });
        return { ok: false };
      });
  }
  
  // Analytics: receive events from popup and store in local storage
  if (message.action === 'analytics:event') {
    const ev = (message && message.event) || {};
    const entry = {
      ...ev,
      ts: Date.now(),
      sender: {
        tabId: (sender && sender.tab && sender.tab.id) || null,
        url: (sender && sender.tab && sender.tab.url) || null
      }
    };
    return localStorageManager.get(['analyticsEvents']).then(res => {
      const events = Array.isArray(res.analyticsEvents) ? res.analyticsEvents : [];
      events.push(entry);
      // Keep only the latest 500 events
      if (events.length > 500) {
        events.splice(0, events.length - 500);
      }
      return localStorageManager.set({ analyticsEvents: events });
    }).then(() => ({ ok: true }))
      .catch(e => {
        errorHandler.handleError(e, { action: 'analytics_event_store' });
        return { ok: false };
      });
  }
  
  // Unhandled message type
  logger.warn("Unhandled message action:", message.action);
});

// Check if this is the first time running the extension
function isFirstTimeRun() {
  return new Promise((resolve) => {
    browser.storage.local.get('firstRun').then(result => {
      resolve(!result.firstRun);
    });
  });
}

// Mark extension as run
function markAsRun() {
  browser.storage.local.set({ firstRun: true });
}

// Open settings page
function openSettingsPage() {
  browser.tabs.create({
    url: browser.runtime.getURL('pages/settings/settings.html')
  });
}

// Open onboarding page
function openOnboardingPage() {
  // Open the dedicated onboarding page
  browser.tabs.create({
    url: browser.runtime.getURL('pages/onboarding/onboarding.html')
  });
}

// Initialize default settings
browser.runtime.onInstalled.addListener(() => {
  logger.info("Extension installed/updated");
  
  const defaultSettings = {
    dictionaryEnabled: true,
    navigatorEnabled: true,
    accessibilityEnabled: true,
    linkPreviewsEnabled: true,
    readerEnabled: false,
    readerTheme: 'default',
    readerTypography: { fontSize: '100%', lineHeight: 1.6, maxWidth: '800px' },
    readerCustomCSS: ''
  };
  
  browser.storage.sync.get(Object.keys(defaultSettings)).then(settings => {
    const settingsToSave = {};
    let needsUpdate = false;
    
    for (const [key, value] of Object.entries(defaultSettings)) {
      if (settings[key] === undefined) {
        settingsToSave[key] = value;
        needsUpdate = true;
        logger.info(`Setting default for ${key}:`, value);
      }
    }
    
    if (needsUpdate) {
      return browser.storage.sync.set(settingsToSave);
    }
  }).catch(error => {
    errorHandler.handleError(error, {
      action: 'initialize_default_settings'
    });
  });
  
  // Initialize default weekly goal if missing
  // Removed: weekly goal initialization (deprecated)
  
  // Check if this is the first run and open settings page
  isFirstTimeRun().then(isFirstRun => {
    if (isFirstRun) {
      logger.info("First run detected, opening onboarding page");
      // Open the popup as onboarding and immediately mark as run
      setTimeout(() => {
        openOnboardingPage();
        try { markAsRun(); } catch (_) {}
      }, 500);
    }
  }).catch(error => {
    errorHandler.handleError(error, {
      action: 'check_first_run'
    });
  });
});

// Listen for extension icon click to open settings (MV3 uses browser.action)
// Listen for extension icon click to open settings (MV3 uses browser.action; MV2 uses browser.browserAction)
try {
  const actionApi = (typeof browser !== 'undefined' && browser.action)
    || (typeof browser !== 'undefined' && browser.browserAction)
    || null;
  if (actionApi && actionApi.onClicked && actionApi.onClicked.addListener) {
    actionApi.onClicked.addListener(() => {
      logger.info("Extension icon clicked");
      openSettingsPage();
    });
  }
} catch (e) {
  // Ignore if action APIs are unavailable
}

// Listen for storage changes and notify content scripts
browser.storage.onChanged.addListener((changes, areaName) => {
  // Only handle sync storage changes (where settings are stored)
  if (areaName === 'sync') {
    logger.debug("Storage changes detected:", changes);
    
    // Check if any of the settings we care about have changed
    const settingKeys = [
      'dictionaryEnabled',
      'navigatorEnabled',
      'accessibilityEnabled',
      'linkPreviewsEnabled',
      'readerEnabled',
      'readerTheme',
      'readerTypography',
      'readerCustomCSS'
    ];
    const changedSettings = {};
    let hasRelevantChanges = false;
    
    for (const key of settingKeys) {
      if (changes[key]) {
        changedSettings[key] = changes[key].newValue;
        hasRelevantChanges = true;
        logger.info(`Setting changed: ${key} =`, changes[key].newValue);
      }
    }
    
    // If relevant settings changed, notify all SCP Wiki tabs
    if (hasRelevantChanges) {
      browser.tabs.query({url: '*://scp-wiki.wikidot.com/*'}).then(tabs => {
        logger.info(`Notifying ${tabs.length} tabs about settings changes`);
        
        tabs.forEach(tab => {
          browser.tabs.sendMessage(tab.id, {
            action: "settingsChanged",
            settings: changedSettings
          }).catch(error => {
            // Ignore errors for tabs that don't have the content script loaded
            logger.debug('Could not send message to tab:', tab.id, error);
          });
        });
      }).catch(error => {
        errorHandler.handleError(error, {
          action: 'notify_tabs_settings_changed'
        });
      });
    }
  }
});

// Handle keyboard commands, e.g., Alt+R to toggle the Immersive Reader
try {
  if (browser.commands && browser.commands.onCommand) {
    browser.commands.onCommand.addListener(async (command) => {
      if (command === 'toggle-reader') {
        try {
          const curr = await browser.storage.sync.get(['readerEnabled']);
          const next = !(curr && curr.readerEnabled === true);
          await browser.storage.sync.set({ readerEnabled: next });
          logger.info('Toggled readerEnabled via command:', next);
        } catch (error) {
          errorHandler.handleError(error, { action: 'toggle_reader_command' });
        }
      }
    });
  }
} catch (e) {
  // Ignore if commands API is unavailable (e.g., some MV2 environments)
}

// MV3-friendly periodic tasks using alarms (service workers may be suspended)
function registerAlarms() {
  try {
    browser.alarms.create('resetErrorCounts', { periodInMinutes: 5 });
    logger.debug('Alarm registered: resetErrorCounts every 5 minutes');
  } catch (e) {
    logger.warn('Failed to create alarm', e);
  }
}

browser.alarms.onAlarm.addListener((alarm) => {
  if (alarm && alarm.name === 'resetErrorCounts' && errorHandler) {
    errorHandler.resetErrorCounts();
  }
});

// Ensure alarms are set on install and browser startup
browser.runtime.onInstalled.addListener(registerAlarms);
if (browser.runtime && browser.runtime.onStartup && browser.runtime.onStartup.addListener) {
  browser.runtime.onStartup.addListener(registerAlarms);
}

// Also attempt to register immediately in case the worker is active now
registerAlarms();