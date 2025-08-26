// Ensure browser.* API in Chrome via polyfill
import browserPolyfill from 'webextension-polyfill';
if (typeof globalThis.browser === 'undefined') {
  globalThis.browser = browserPolyfill;
}

// Import utilities
import { StorageManager } from '../../utils/index.js';
import { FEATURES, DEFAULTS, VALIDATION } from '../../config.js';

// Create global storage manager instance
const storageManager = new StorageManager('local');

// DOM elements
const dictionaryEnabled = document.getElementById('dictionaryEnabled');
const navigatorEnabled = document.getElementById('navigatorEnabled');
const accessibilityEnabled = document.getElementById('accessibilityEnabled');
const linkPreviewsEnabled = document.getElementById('linkPreviewsEnabled');
const showProgress = document.getElementById('showProgress');
const showReadingTime = document.getElementById('showReadingTime');
const readerSection = document.getElementById('readingPreferences');
const readerEnabled = document.getElementById('readerEnabled');
const readerTheme = document.getElementById('readerTheme');
const readerFontSize = document.getElementById('readerFontSize');
const readerLineHeight = document.getElementById('readerLineHeight');
const readerMaxWidth = document.getElementById('readerMaxWidth');
const readerCustomCSS = document.getElementById('readerCustomCSS');
const resetReaderDefaults = document.getElementById('resetReaderDefaults');
const saveSettings = document.getElementById('saveSettings');
const closeSettings = document.getElementById('closeSettings');
const exportData = document.getElementById('exportData');
const clearData = document.getElementById('clearData');
const scrollThresholdInput = document.getElementById('scrollThreshold');

// Helper: enable/disable reader inputs based on toggle
function setReaderInputsDisabled(disabled) {
  if (!FEATURES || !FEATURES.ENABLE_READER) return;
  if (readerTheme) readerTheme.disabled = disabled;
  if (readerFontSize) readerFontSize.disabled = disabled;
  if (readerLineHeight) readerLineHeight.disabled = disabled;
  if (readerMaxWidth) readerMaxWidth.disabled = disabled;
  if (readerCustomCSS) readerCustomCSS.disabled = disabled;
  if (resetReaderDefaults) resetReaderDefaults.disabled = disabled;
}

// Show success message
function showSuccessMessage(message) {
  const successDiv = document.createElement('div');
  successDiv.className = 'success-message';
  successDiv.textContent = message;
  successDiv.setAttribute('role', 'status');
  successDiv.setAttribute('aria-live', 'polite');
  successDiv.setAttribute('aria-atomic', 'true');
  document.body.appendChild(successDiv);
  
  setTimeout(() => {
    successDiv.classList.add('show');
  }, 100);
  
  setTimeout(() => {
    successDiv.classList.remove('show');
    setTimeout(() => {
      document.body.removeChild(successDiv);
    }, 300);
  }, 3000);
}

// Show error message
function showErrorMessage(message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message';
  errorDiv.textContent = message;
  errorDiv.setAttribute('role', 'alert');
  errorDiv.setAttribute('aria-live', 'assertive');
  errorDiv.setAttribute('aria-atomic', 'true');
  document.body.appendChild(errorDiv);
  
  setTimeout(() => {
    errorDiv.classList.add('show');
  }, 100);
  
  setTimeout(() => {
    errorDiv.classList.remove('show');
    setTimeout(() => {
      document.body.removeChild(errorDiv);
    }, 300);
  }, 5000);
}

// Load current settings
async function loadSettings() {
  try {
    const settings = await storageManager.get([
      'dictionaryEnabled', 'navigatorEnabled',
      'accessibilityEnabled',
      'linkPreviewsEnabled',
      'showProgress', 'showReadingTime',
      'scrollThreshold',
      'readerEnabled', 'readerTheme', 'readerTypography', 'readerCustomCSS'
    ]);
    
    if (settings.dictionaryEnabled !== undefined) dictionaryEnabled.checked = settings.dictionaryEnabled;
    if (settings.navigatorEnabled !== undefined) navigatorEnabled.checked = settings.navigatorEnabled;
    if (settings.accessibilityEnabled !== undefined) accessibilityEnabled.checked = settings.accessibilityEnabled;
    if (settings.linkPreviewsEnabled !== undefined) linkPreviewsEnabled.checked = settings.linkPreviewsEnabled;
    if (showProgress && settings.showProgress !== undefined) showProgress.checked = settings.showProgress;
    if (showReadingTime && settings.showReadingTime !== undefined) showReadingTime.checked = settings.showReadingTime;
    if (scrollThresholdInput) {
      const def = (DEFAULTS && DEFAULTS.SETTINGS && typeof DEFAULTS.SETTINGS.SCROLL_THRESHOLD === 'number') ? DEFAULTS.SETTINGS.SCROLL_THRESHOLD : 0.8;
      const min = (VALIDATION && VALIDATION.SETTINGS && typeof VALIDATION.SETTINGS.SCROLL_THRESHOLD.MIN === 'number') ? VALIDATION.SETTINGS.SCROLL_THRESHOLD.MIN : 0.1;
      const max = (VALIDATION && VALIDATION.SETTINGS && typeof VALIDATION.SETTINGS.SCROLL_THRESHOLD.MAX === 'number') ? VALIDATION.SETTINGS.SCROLL_THRESHOLD.MAX : 1.0;
      const val = parseFloat(settings.scrollThreshold);
      const clamped = Number.isFinite(val) ? Math.min(max, Math.max(min, val)) : def;
      scrollThresholdInput.value = String(clamped);
    }
    
    // Reader settings (feature-gated)
    if (FEATURES && FEATURES.ENABLE_READER) {
      if (readerSection) readerSection.style.display = '';
      const enabled = settings.readerEnabled;
      const theme = settings.readerTheme;
      const typography = settings.readerTypography;
      const customCSS = settings.readerCustomCSS;

      if (readerEnabled && enabled !== undefined) readerEnabled.checked = enabled === true;
      if (readerTheme && typeof theme === 'string') readerTheme.value = theme;
      if (typography && typeof typography === 'object') {
        if (readerFontSize && typeof typography.fontSize === 'string') {
          const val = parseInt(String(typography.fontSize).replace('%', ''), 10);
          if (!Number.isNaN(val)) readerFontSize.value = String(val);
        }
        if (readerLineHeight && (typeof typography.lineHeight === 'number' || typeof typography.lineHeight === 'string')) {
          const lh = parseFloat(typography.lineHeight);
          if (!Number.isNaN(lh)) readerLineHeight.value = String(lh);
        }
        if (readerMaxWidth && typeof typography.maxWidth === 'string') {
          const mw = parseInt(String(typography.maxWidth).replace('px', ''), 10);
          if (!Number.isNaN(mw)) readerMaxWidth.value = String(mw);
        }
      }
      if (readerCustomCSS && typeof customCSS === 'string') {
        readerCustomCSS.value = customCSS;
      }
      // Gate controls based on toggle state
      if (readerEnabled) {
        setReaderInputsDisabled(!readerEnabled.checked);
      }
    } else if (readerSection) {
      readerSection.style.display = 'none';
    }
  } catch (error) {
    console.error('Error loading settings:', error);
    showErrorMessage('Failed to load settings');
  }
}

// Save settings
async function saveSettingsHandler() {
  try {
    const settings = {
      dictionaryEnabled: dictionaryEnabled.checked,
      navigatorEnabled: navigatorEnabled.checked,
      accessibilityEnabled: accessibilityEnabled.checked,
      linkPreviewsEnabled: linkPreviewsEnabled.checked,
      showProgress: !!showProgress?.checked,
      showReadingTime: !!showReadingTime?.checked
    };
    // Reader settings (only when feature is enabled)
    if (FEATURES && FEATURES.ENABLE_READER && readerEnabled) {
      const fs = Math.min(200, Math.max(80, parseInt(readerFontSize?.value || '100', 10)));
      const lh = Math.min(3.0, Math.max(1.0, parseFloat(readerLineHeight?.value || '1.6')));
      const mw = Math.min(1200, Math.max(600, parseInt(readerMaxWidth?.value || '800', 10)));

      Object.assign(settings, {
        readerEnabled: !!readerEnabled.checked,
        readerTheme: readerTheme?.value || 'default',
        readerTypography: {
          fontSize: `${fs}%`,
          lineHeight: lh,
          maxWidth: `${mw}px`
        },
        readerCustomCSS: readerCustomCSS?.value || ''
      });
    }
    // Scroll threshold
    if (scrollThresholdInput) {
      const def = (DEFAULTS && DEFAULTS.SETTINGS && typeof DEFAULTS.SETTINGS.SCROLL_THRESHOLD === 'number') ? DEFAULTS.SETTINGS.SCROLL_THRESHOLD : 0.8;
      const min = (VALIDATION && VALIDATION.SETTINGS && typeof VALIDATION.SETTINGS.SCROLL_THRESHOLD.MIN === 'number') ? VALIDATION.SETTINGS.SCROLL_THRESHOLD.MIN : 0.1;
      const max = (VALIDATION && VALIDATION.SETTINGS && typeof VALIDATION.SETTINGS.SCROLL_THRESHOLD.MAX === 'number') ? VALIDATION.SETTINGS.SCROLL_THRESHOLD.MAX : 1.0;
      const raw = parseFloat(scrollThresholdInput.value);
      const clamped = Number.isFinite(raw) ? Math.min(max, Math.max(min, raw)) : def;
      settings.scrollThreshold = clamped;
    }
    
    await storageManager.set(settings);
    
    // Save to sync storage for content script access
    await browser.storage.sync.set(settings);
    
    showSuccessMessage('Settings saved successfully!');
    
    // Close settings after a short delay
    setTimeout(() => {
      closeSettingsHandler();
    }, 1500);
    
  } catch (error) {
    console.error('Error saving settings:', error);
    showErrorMessage('Failed to save settings');
  }
}

// Close settings page
function closeSettingsHandler() {
  window.close();
}

// Export reading data
async function exportDataHandler() {
  try {
    const data = await storageManager.get([
      'readSCPs',
      'dictionaryEnabled', 'navigatorEnabled', 'showProgress', 'showReadingTime',
      'accessibilityEnabled', 'linkPreviewsEnabled',
      'readerEnabled', 'readerTheme', 'readerTypography', 'readerCustomCSS',
      'scrollThreshold'
    ]);
    const exportPayload = {
      readSCPs: data.readSCPs || {},
      settings: {
        dictionaryEnabled: data.dictionaryEnabled ?? true,
        navigatorEnabled: data.navigatorEnabled ?? true,
        showProgress: data.showProgress ?? true,
        showReadingTime: data.showReadingTime ?? true,
        accessibilityEnabled: data.accessibilityEnabled ?? true,
        linkPreviewsEnabled: data.linkPreviewsEnabled ?? true,
        readerEnabled: data.readerEnabled ?? false,
        readerTheme: data.readerTheme ?? 'default',
        readerTypography: data.readerTypography ?? { fontSize: '100%', lineHeight: 1.6, maxWidth: '800px' },
        readerCustomCSS: data.readerCustomCSS ?? '',
        scrollThreshold: data.scrollThreshold ?? (DEFAULTS?.SETTINGS?.SCROLL_THRESHOLD ?? 0.8),
      }
    };
    const jsonData = JSON.stringify(exportPayload, null, 2);
    
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `scp-reading-data-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
    showSuccessMessage('Data exported successfully!');
    
  } catch (error) {
    console.error('Error exporting data:', error);
    showErrorMessage('Failed to export data');
  }
}

// Clear all data
async function clearDataHandler() {
  if (confirm('Are you sure you want to clear all reading data? This action cannot be undone.')) {
    try {
      await storageManager.set({ readSCPs: {} });
      
      showSuccessMessage('All data cleared successfully!');
      
      // Close settings after a short delay
      setTimeout(() => {
        closeSettingsHandler();
      }, 1500);
      
    } catch (error) {
      console.error('Error clearing data:', error);
      showErrorMessage('Failed to clear data');
    }
  }
}

// Reset reader settings to defaults
async function resetReaderDefaultsHandler() {
  try {
    if (!(FEATURES && FEATURES.ENABLE_READER)) {
      return;
    }
    // Defaults from content.js globalState.settings
    const defaults = {
      readerEnabled: false,
      readerTheme: 'default',
      readerTypography: { fontSize: '100%', lineHeight: 1.6, maxWidth: '800px' },
      readerCustomCSS: ''
    };

    // Update UI inputs
    if (readerEnabled) readerEnabled.checked = false;
    if (readerTheme) readerTheme.value = 'default';
    if (readerFontSize) readerFontSize.value = '100';
    if (readerLineHeight) readerLineHeight.value = '1.6';
    if (readerMaxWidth) readerMaxWidth.value = '800';
    if (readerCustomCSS) readerCustomCSS.value = '';

    // Persist to local and sync storage
    await storageManager.set(defaults);
    await browser.storage.sync.set(defaults);

    showSuccessMessage('Reader settings reset to defaults');
  } catch (error) {
    console.error('Error resetting reader settings:', error);
    showErrorMessage('Failed to reset reader settings');
  }
}

// Event listeners
saveSettings.addEventListener('click', saveSettingsHandler);
closeSettings.addEventListener('click', closeSettingsHandler);
if (exportData) exportData.addEventListener('click', exportDataHandler);
if (clearData) clearData.addEventListener('click', clearDataHandler);
if (resetReaderDefaults && FEATURES && FEATURES.ENABLE_READER) {
  resetReaderDefaults.addEventListener('click', resetReaderDefaultsHandler);
}
if (readerEnabled && FEATURES && FEATURES.ENABLE_READER) {
  readerEnabled.addEventListener('change', () => {
    setReaderInputsDisabled(!readerEnabled.checked);
  });
}

// Initialize settings page
document.addEventListener('DOMContentLoaded', () => {
  // Apply saved theme like popup
  try {
    browser.storage.local.get('theme').then(result => {
      if (result && result.theme === 'light') {
        document.body.classList.add('light-theme');
      }
    });
  } catch (_) {}
  // Populate extension version if About section exists
  try {
    const manifest = typeof browser !== 'undefined' && browser.runtime && typeof browser.runtime.getManifest === 'function'
      ? browser.runtime.getManifest()
      : null;
    const versionEl = document.getElementById('extVersion');
    if (versionEl && manifest && manifest.version) {
      versionEl.textContent = manifest.version;
    }
  } catch (_) {}
  loadSettings();
});
