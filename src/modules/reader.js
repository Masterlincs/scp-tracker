// Immersive Reader module
// Handles enable/disable, theme application, typography, and custom CSS injection

import browserPolyfill from 'webextension-polyfill';
if (typeof globalThis.browser === 'undefined') {
  globalThis.browser = browserPolyfill;
}

const STATE = {
  enabled: false,
  theme: 'default',
  typography: {
    fontSize: '100%',
    lineHeight: 1.6,
    maxWidth: '800px'
  },
  customCSS: ''
};

let baseCssEl = null;
let themeCssEl = null;
let customStyleEl = null;

function getUrl(path) {
  try {
    return browser.runtime.getURL(path);
  } catch (e) {
    return path;
  }
}

function ensureBaseCss() {
  if (baseCssEl) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = getUrl('styles/reader.css');
  link.id = 'scp-reader-css';
  document.documentElement.appendChild(link);
  baseCssEl = link;
}

function applyTheme(theme) {
  const safeTheme = typeof theme === 'string' && theme ? theme : 'default';
  STATE.theme = safeTheme;
  document.documentElement.setAttribute('data-reader-theme', safeTheme);

  // load theme stylesheet
  const href = getUrl(`styles/themes/theme-${safeTheme}.css`);
  if (!themeCssEl) {
    themeCssEl = document.createElement('link');
    themeCssEl.rel = 'stylesheet';
    themeCssEl.id = 'scp-reader-theme-css';
    document.documentElement.appendChild(themeCssEl);
  }
  themeCssEl.href = href;
}

function applyTypography(typo = {}) {
  const { fontSize, lineHeight, maxWidth } = {
    fontSize: STATE.typography.fontSize,
    lineHeight: STATE.typography.lineHeight,
    maxWidth: STATE.typography.maxWidth,
    ...typo
  };
  STATE.typography = { fontSize, lineHeight, maxWidth };
  const root = document.documentElement;
  if (fontSize) root.style.setProperty('--reader-font-size', String(fontSize));
  if (lineHeight) root.style.setProperty('--reader-line-height', String(lineHeight));
  if (maxWidth) root.style.setProperty('--reader-max-width', String(maxWidth));
}

function sanitizeCustomCSS(css = '') {
  try {
    let out = String(css);
    // basic sanitization: remove at-imports and JS schemas
    out = out.replace(/@import[^;]+;/gi, '');
    out = out.replace(/expression\s*\(/gi, '');
    out = out.replace(/javascript\s*:/gi, '');
    // limit length to prevent abuse
    if (out.length > 50000) out = out.slice(0, 50000);
    return out;
  } catch (e) {
    return '';
  }
}

function applyCustomCSS(css = '') {
  const sanitized = sanitizeCustomCSS(css);
  STATE.customCSS = sanitized;
  if (!customStyleEl) {
    customStyleEl = document.createElement('style');
    customStyleEl.id = 'scp-reader-custom-css';
    document.documentElement.appendChild(customStyleEl);
  }
  customStyleEl.textContent = sanitized;
}

async function initialize(initialSettings = {}) {
  try {
    const {
      enabled = false,
      theme = 'default',
      typography = {},
      customCSS = ''
    } = initialSettings || {};

    if (enabled) {
      enable();
    } else {
      // prepare variables even when disabled so toggling is instant
      document.documentElement.style.setProperty('--reader-font-size', String(typography.fontSize || STATE.typography.fontSize));
      document.documentElement.style.setProperty('--reader-line-height', String(typography.lineHeight || STATE.typography.lineHeight));
      document.documentElement.style.setProperty('--reader-max-width', String(typography.maxWidth || STATE.typography.maxWidth));
      document.documentElement.setAttribute('data-reader-theme', theme || 'default');
    }

    applyTypography(typography);
    applyTheme(theme);
    if (customCSS) applyCustomCSS(customCSS);
  } catch (e) {
    // non-fatal
  }
}

function enable() {
  if (STATE.enabled) return;
  ensureBaseCss();
  document.documentElement.setAttribute('data-reader', 'on');
  STATE.enabled = true;
}

function disable() {
  if (!STATE.enabled) return;
  document.documentElement.removeAttribute('data-reader');
  STATE.enabled = false;
}

function toggle() {
  if (STATE.enabled) disable(); else enable();
}

function cleanup() {
  try {
    if (baseCssEl && baseCssEl.parentNode) baseCssEl.parentNode.removeChild(baseCssEl);
    if (themeCssEl && themeCssEl.parentNode) themeCssEl.parentNode.removeChild(themeCssEl);
    if (customStyleEl && customStyleEl.parentNode) customStyleEl.parentNode.removeChild(customStyleEl);
  } catch {}
  baseCssEl = null;
  themeCssEl = null;
  customStyleEl = null;
  document.documentElement.removeAttribute('data-reader');
  document.documentElement.style.removeProperty('--reader-font-size');
  document.documentElement.style.removeProperty('--reader-line-height');
  document.documentElement.style.removeProperty('--reader-max-width');
}

function getState() {
  return { ...STATE };
}

export default {
  initialize,
  enable,
  disable,
  toggle,
  applyTheme,
  applyTypography,
  applyCustomCSS,
  getState,
  cleanup
};
