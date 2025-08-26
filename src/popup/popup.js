// Ensure browser.* API in Chrome via polyfill
import browserPolyfill from 'webextension-polyfill';
if (typeof globalThis.browser === 'undefined') {
  globalThis.browser = browserPolyfill;
}

// Import utilities
import { StorageManager } from '../utils/index.js';
import { FEATURES } from '../config.js';
import { computeAnalytics } from '../modules/analytics.js';

// Create global storage manager instance
const storageManager = new StorageManager();
document.addEventListener('DOMContentLoaded', function() {
  const scpList = document.getElementById('scpList');
  const readCount = document.getElementById('readCount');
  const searchInput = document.getElementById('searchInput');
  const markUnreadButton = document.getElementById('markUnread');
  const clearAllButton = document.getElementById('clearAll');
  const exportBtn = document.getElementById('exportBtn');
  const refreshBtn = document.getElementById('refreshBtn');
  const themeToggle = document.getElementById('themeToggle');
  const showSCPs = document.getElementById('showSCPs');
  const showTales = document.getElementById('showTales');
  const sortBy = document.getElementById('sortBy');
  const sortAsc = document.getElementById('sortAsc');
  const openSettingsBtn = document.getElementById('openSettings');
  const toastEl = document.getElementById('toast');
  // Analytics elements
  const analyticsSection = document.getElementById('analyticsSection');
  const lastReadStat = document.getElementById('lastReadStat');
  const typeSplitStats = document.getElementById('typeSplitStats');
  const tagStatsList = document.getElementById('tagStatsList');

  // Reading preference controls
  const dictionaryEnabled = document.getElementById('dictionaryEnabled');
  const navigatorEnabled = document.getElementById('navigatorEnabled');

  let currentSCPs = {};

  let currentTabUrl = '';

  // Simple debounce
  function debounce(fn, delay = 200) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(null, args), delay);
    };
  }

  // Toast helpers
  function showToast(message, type = 'success', duration = 2500) {
    if (!toastEl) return;
    toastEl.className = `toast ${type}`;
    toastEl.textContent = message;
    toastEl.hidden = false;
    if (duration > 0) {
      setTimeout(() => {
        toastEl.hidden = true;
      }, duration);
    }
  }

  function showActionToast(message, actions = []) {
    if (!toastEl) return () => {};
    toastEl.className = 'toast';
    toastEl.innerHTML = '';
    const text = document.createElement('span');
    text.textContent = message;
    toastEl.appendChild(text);
    if (Array.isArray(actions)) {
      actions.forEach(({ label, onClick, variant }) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = label;
        btn.style.marginLeft = '8px';
        if (variant === 'danger') btn.style.color = '#ff3b30';
        btn.addEventListener('click', () => {
          if (onClick) onClick();
          toastEl.hidden = true;
        });
        toastEl.appendChild(btn);
      });
    }
    toastEl.hidden = false;
    return () => (toastEl.hidden = true);
  }

  // Get current tab to check if we're on an SCP page
  browser.tabs.query({active: true, currentWindow: true}).then(tabs => {
    if (tabs[0]) {
      currentTabUrl = tabs[0].url;
    }
  });

  // Load and display SCPs
  function loadSCPs() {
    storageManager.get(['readSCPs']).then(result => {
      currentSCPs = (result && result.readSCPs) || {};
      updateSCPList(currentSCPs);
      readCount.textContent = Object.keys(currentSCPs).length;

      // Analytics
      if (FEATURES.ENABLE_ANALYTICS && analyticsSection) {
        renderAnalytics();
        analyticsSection.style.display = '';
      } else if (analyticsSection) {
        analyticsSection.style.display = 'none';
      }
    }).catch((e) => {
      console.error('Failed to load SCPs', e);
      showToast('Failed to load data', 'error');
    });
  }

  // --- Analytics rendering (new) ---
  function renderAnalytics() {
    const analytics = computeAnalytics(currentSCPs);
    if (!analytics) return;

    // Last read timestamp
    if (lastReadStat) {
      const ts = analytics.lastReadTs;
      lastReadStat.textContent = ts ? `Last read: ${new Date(ts).toLocaleString()}` : 'Last read: N/A';
    }

    // Type split summary
    if (typeSplitStats) {
      const { scp, tale, unknown, total, scpPercent, talePercent } = analytics.typeSplit || {};
      const parts = [];
      parts.push(`<div><strong>Total:</strong> ${total || 0}</div>`);
      parts.push(`<div>SCPs: ${scp || 0} (${scpPercent || 0}%)</div>`);
      parts.push(`<div>Tales: ${tale || 0} (${talePercent || 0}%)</div>`);
      if (unknown) parts.push(`<div>Unknown: ${unknown}</div>`);
      typeSplitStats.innerHTML = parts.join('');
    }

    // Tag stats (top 10)
    if (tagStatsList) {
      tagStatsList.innerHTML = '';
      const list = (analytics.tagStats && analytics.tagStats.counts) || [];
      const top = list.slice(0, 10);
      top.forEach(({ tag, count }) => {
        const li = document.createElement('li');
        li.textContent = `${tag} — ${count}`;
        tagStatsList.appendChild(li);
      });
      if (top.length === 0) {
        const li = document.createElement('li');
        li.textContent = 'No tags yet';
        li.style.color = '#888';
        tagStatsList.appendChild(li);
      }
    }
  }

  // Update the SCP list display
  function updateSCPList(scps) {
    scpList.innerHTML = '';

    const searchTerm = (searchInput.value || '').toLowerCase();
    const showSCPsChecked = showSCPs.checked;
    const showTalesChecked = showTales.checked;

    const filteredSCPs = Object.entries(scps).filter(([identifier, data = {}]) => {
      const titleLower = (data.title || '').toLowerCase();
      const matchesSearch = (identifier || '').toLowerCase().includes(searchTerm) || titleLower.includes(searchTerm);

      const isSCP = data.type === 'scp' || /^\d+$/.test(identifier);
      const isTale = data.type === 'tale' || !/^\d+$/.test(identifier);

      const typeFilter = (isSCP && showSCPsChecked) || (isTale && showTalesChecked);

      return matchesSearch && typeFilter;
    });

    // Apply sorting
    const sortField = sortBy.value;
    const ascending = sortAsc.checked;

    filteredSCPs.sort(([aKey, aData = {}], [bKey, bData = {}]) => {
      if (sortField === 'number') {
        const aNum = /^\d+$/.test(aKey) ? parseInt(aKey, 10) : Number.POSITIVE_INFINITY;
        const bNum = /^\d+$/.test(bKey) ? parseInt(bKey, 10) : Number.POSITIVE_INFINITY;
        return ascending ? aNum - bNum : bNum - aNum;
      }
      if (sortField === 'date') {
        const aTs = typeof aData.timestamp === 'number' ? aData.timestamp : 0;
        const bTs = typeof bData.timestamp === 'number' ? bData.timestamp : 0;
        return ascending ? aTs - bTs : bTs - aTs;
      }
      // title
      const aTitle = (aData.title || '').toString();
      const bTitle = (bData.title || '').toString();
      return ascending ? aTitle.localeCompare(bTitle) : bTitle.localeCompare(aTitle);
    });

    filteredSCPs.forEach(([identifier, data]) => {
      const li = document.createElement('li');

      const numberSpan = document.createElement('span');
      numberSpan.className = 'scp-number';

      const isSCP = data.type === 'scp' || /^\d+$/.test(identifier);
      if (isSCP) {
        numberSpan.textContent = `SCP-${identifier}`;
      } else {
        numberSpan.textContent = identifier;
      }

      // Add visual indicator for read status
      if (!data.read) {
        numberSpan.style.opacity = '0.7';
        numberSpan.title = 'Detected but not fully read';
      }

      const typeSpan = document.createElement('span');
      typeSpan.className = 'scp-type';
      typeSpan.textContent = isSCP ? 'SCP' : 'TALE';

      const titleSpan = document.createElement('span');
      titleSpan.textContent = data.title || (isSCP ? `SCP-${identifier}` : identifier);
      titleSpan.className = 'scp-title';

      const dateSpan = document.createElement('span');
      const ts = typeof data.timestamp === 'number' ? data.timestamp : 0;
      dateSpan.textContent = ts ? new Date(ts).toLocaleDateString() : '';
      dateSpan.className = 'scp-date';

      li.setAttribute('role', 'listitem');
      li.tabIndex = 0;

      li.appendChild(numberSpan);
      li.appendChild(typeSpan);
      li.appendChild(titleSpan);
      li.appendChild(dateSpan);

      // Add click to open the SCP
      li.addEventListener('click', () => {
        if (data.url) {
          browser.tabs.create({
            url: data.url
          });
        } else if (isSCP) {
          browser.tabs.create({
            url: `https://scp-wiki.wikidot.com/scp-${identifier}`
          });
        } else {
          browser.tabs.create({
            url: `https://scp-wiki.wikidot.com/${identifier}`
          });
        }
      });

      // Keyboard activate
      li.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          li.click();
        }
      });

      scpList.appendChild(li);
    });

    if (filteredSCPs.length === 0) {
      const li = document.createElement('li');
      li.textContent = 'No SCPs/Tales found';
      li.style.color = '#888';
      scpList.appendChild(li);
    }
  }

  // Legacy series progress and general statistics removed
  
  
  
  // Toggle theme
  function toggleTheme() {
    document.body.classList.toggle('light-theme');
    const isLightTheme = document.body.classList.contains('light-theme');
    storageManager.set({ theme: isLightTheme ? 'light' : 'dark' });
    if (themeToggle) themeToggle.setAttribute('aria-pressed', String(isLightTheme));
  }
  
  // Update reading preferences
  function updateReadingPreference(setting, value) {
    browser.runtime.sendMessage({
      action: "saveSettings",
      settings: { [setting]: value }
    }).then(() => {
      // Send message to content script to apply the setting
      browser.tabs.query({active: true, currentWindow: true}).then(tabs => {
        if (tabs[0] && tabs[0].url.includes('scp-wiki.wikidot.com')) {
          browser.tabs.sendMessage(tabs[0].id, {
            action: "applySetting",
            setting: setting,
            value: value
          }).catch(error => console.error('Error sending message to tab:', error));
        }
      });
    });
  }
  
  // Mark current SCP as unread
  markUnreadButton.addEventListener('click', () => {
    // Extract identifier from current tab URL
    const scpMatch = currentTabUrl.match(/scp-(\d+)/i);
    const taleMatch = currentTabUrl.match(/scp-wiki\.wikidot\.com\/(.*?)$/i);
    
    let identifier = null;
    
    if (scpMatch && scpMatch[1]) {
      identifier = scpMatch[1];
    } else if (taleMatch && taleMatch[1] && !taleMatch[1].includes('/')) {
      identifier = taleMatch[1];
    }
    
    if (identifier) {
      storageManager.get(['readSCPs']).then(result => {
        const readSCPs = (result && result.readSCPs) || {};
        if (readSCPs[identifier]) {
          delete readSCPs[identifier];
          storageManager.set({ readSCPs }).then(() => {
            loadSCPs();
            showToast('Marked as unread', 'success');
          });
        } else {
          showToast('This page is not marked as read.', 'error');
        }
      }).catch((e) => console.error('markUnread error', e));
    } else {
      showToast('Not on an SCP or Tale page', 'error');
    }
  });
  
  // Clear all SCPs
  clearAllButton.addEventListener('click', () => {
    const hide = showActionToast('Clear all read items?', [
      { label: 'Cancel' },
      { label: 'Clear', variant: 'danger', onClick: () => {
          storageManager.set({ readSCPs: {} }).then(() => {
            loadSCPs();
            showToast('Cleared', 'success');
          });
        } }
    ]);
    // Auto-hide after 6s if no action
    setTimeout(() => hide && hide(), 6000);
  });
  
  // Export data
  exportBtn.addEventListener('click', () => {
    storageManager.get(['readSCPs']).then(result => {
      const data = JSON.stringify(result.readSCPs || {}, null, 2);
      const blob = new Blob([data], {type: 'application/json'});
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = 'scp-reading-data.json';
      a.click();
      
      URL.revokeObjectURL(url);
    });
  });
  
  // Refresh data
  refreshBtn.addEventListener('click', () => {
    loadSCPs();
  });
  
  // Toggle theme
  themeToggle.addEventListener('click', toggleTheme);
  
  
  // Search functionality
  const debouncedUpdate = debounce(() => {
    updateSCPList(currentSCPs);
    // persist state
    storageManager.set({ popupState: {
      search: searchInput.value,
      showSCPs: showSCPs.checked,
      showTales: showTales.checked,
      sortBy: sortBy.value,
      sortAsc: sortAsc.checked
    } });
  }, 200);
  searchInput.addEventListener('input', debouncedUpdate);
  
  // Filter functionality
  showSCPs.addEventListener('change', debouncedUpdate);
  
  showTales.addEventListener('change', debouncedUpdate);
  
  // Sorting functionality
  sortBy.addEventListener('change', debouncedUpdate);
  
  sortAsc.addEventListener('change', debouncedUpdate);
  
  // Reading preference changes
  dictionaryEnabled.addEventListener('change', () => {
    updateReadingPreference('dictionaryEnabled', dictionaryEnabled.checked);
  });
  
  navigatorEnabled.addEventListener('change', () => {
    updateReadingPreference('navigatorEnabled', navigatorEnabled.checked);
  });

  
  // Load saved theme
  browser.storage.local.get('theme').then(result => {
    if (result.theme === 'light') {
      document.body.classList.add('light-theme');
    }
    if (themeToggle) themeToggle.setAttribute('aria-pressed', String(document.body.classList.contains('light-theme')));
  });
  
  
  // Load reading preferences
  browser.storage.sync.get([
    'dictionaryEnabled', 'navigatorEnabled'
  ]).then(settings => {
    if (settings.dictionaryEnabled !== undefined) dictionaryEnabled.checked = settings.dictionaryEnabled;
    if (settings.navigatorEnabled !== undefined) navigatorEnabled.checked = settings.navigatorEnabled;
  });

  // Restore popup UI state
  storageManager.get(['popupState']).then(({ popupState }) => {
    if (!popupState) return;
    if (typeof popupState.search === 'string') searchInput.value = popupState.search;
    if (typeof popupState.showSCPs === 'boolean') showSCPs.checked = popupState.showSCPs;
    if (typeof popupState.showTales === 'boolean') showTales.checked = popupState.showTales;
    if (typeof popupState.sortBy === 'string') sortBy.value = popupState.sortBy;
    if (typeof popupState.sortAsc === 'boolean') sortAsc.checked = popupState.sortAsc;
  }).finally(() => updateSCPList(currentSCPs));

  // Open settings page
  if (openSettingsBtn) {
    openSettingsBtn.addEventListener('click', () => {
      if (browser?.runtime?.openOptionsPage) {
        browser.runtime.openOptionsPage();
      } else {
        // Fallback: open in new tab
        browser.tabs.create({ url: browser.runtime.getURL('pages/settings/settings.html') });
      }
    });
  }
  
  // Initial load
  loadSCPs();
});