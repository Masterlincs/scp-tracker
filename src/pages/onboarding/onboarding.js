// SCP Foundation — Onboarding Logic
import browserPolyfill from 'webextension-polyfill';
if (typeof globalThis.browser === 'undefined') {
  globalThis.browser = browserPolyfill;
}

function byId(id) { return /** @type {HTMLElement} */ (document.getElementById(id)); }

async function markOnboarded() {
  try {
    await browser.storage.local.set({ firstRun: true });
  } catch (_) {
    // ignore
  }
}

async function openSettings() {
  try {
    await browser.tabs.create({ url: browser.runtime.getURL('pages/settings/settings.html') });
  } catch (_) {
    // ignore
  }
}

// Open a help page explaining how to pin the extension to the toolbar
async function openPinHelp() {
  try {
    const ua = navigator.userAgent || '';
    const isFirefox = /Firefox\//.test(ua);
    const url = isFirefox
      ? 'https://support.mozilla.org/en-US/kb/customize-firefox-controls-buttons-and-toolbars'
      : 'https://support.google.com/chrome_webstore/answer/2664769?hl=en#zippy=%2Cpin-or-unpin-an-extension';
    await browser.tabs.create({ url });
  } catch (_) {
    // ignore
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const begin = byId('begin');
  const pin = byId('pin');
  const skip = byId('skip');

  begin?.addEventListener('click', async () => {
    await markOnboarded();
    await openSettings();
    // attempt to close current tab (works only if permitted)
    try {
      window.close();
    } catch (_) {}
  });

  pin?.addEventListener('click', async () => {
    // Open platform help page to pin the extension to the toolbar
    await openPinHelp();
  });

  skip?.addEventListener('click', async () => {
    await markOnboarded();
    try {
      window.close();
    } catch (_) {}
  });
});
