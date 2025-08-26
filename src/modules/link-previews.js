/*
 * Link Previews module
 * Scans for SCP/tale links and shows a hover tooltip with metadata.
 */

// Ensure browser API is available (content script already polyfills, but be safe)
// eslint-disable-next-line no-undef
const browserApi = (typeof browser !== 'undefined') ? browser : (typeof globalThis !== 'undefined' ? globalThis.browser : null);

const DEFAULTS = {
  hoverDelay: 180,
  hideDelay: 120,
  metadataTimeout: 5000,
};

class LinkPreviewsModule {
  constructor(opts = {}) {
    this.config = { ...DEFAULTS, ...(opts || {}) };
    this._linkSelector = 'a[href]';
    this._handlers = new Map();
    this._tooltip = null;
    this._tooltipInner = null;
    this._activeAnchor = null;
    this._hoverTimer = null;
    this._hideTimer = null;
    this._boundOnMouseEnter = null;
    this._boundOnMouseLeave = null;
    this._boundTooltipEnter = null;
    this._boundTooltipLeave = null;
    this._prefetched = new Set();
  }

  async initialize() {
    this._installTooltip();
    this._bindAllLinks();
  }

  cleanup() {
    // Remove listeners from all tracked anchors
    this._handlers.forEach((handlers, el) => {
      try {
        el.removeEventListener('mouseenter', handlers.enter);
        el.removeEventListener('mouseleave', handlers.leave);
      } catch(_){}
    });
    this._handlers.clear();

    // Remove tooltip
    if (this._tooltip && this._tooltip.parentNode) {
      try {
        this._tooltip.removeEventListener('mouseenter', this._boundTooltipEnter);
        this._tooltip.removeEventListener('mouseleave', this._boundTooltipLeave);
      } catch(_){}
      this._tooltip.parentNode.removeChild(this._tooltip);
    }
    this._tooltip = null;
    this._tooltipInner = null;

    // Clear timers
    if (this._hoverTimer) clearTimeout(this._hoverTimer);
    if (this._hideTimer) clearTimeout(this._hideTimer);
  }

  _installTooltip() {
    const tip = document.createElement('div');
    tip.className = 'scp-link-preview';
    tip.style.position = 'absolute';
    tip.style.zIndex = '99999';
    tip.style.pointerEvents = 'auto';
    tip.style.display = 'none';

    const inner = document.createElement('div');
    inner.className = 'scp-link-preview__inner';
    tip.appendChild(inner);

    document.body.appendChild(tip);
    this._tooltip = tip;
    this._tooltipInner = inner;

    this._boundTooltipEnter = () => {
      if (this._hideTimer) {
        clearTimeout(this._hideTimer);
        this._hideTimer = null;
      }
    };
    this._boundTooltipLeave = () => {
      this._scheduleHide();
    };

    tip.addEventListener('mouseenter', this._boundTooltipEnter);
    tip.addEventListener('mouseleave', this._boundTooltipLeave);
  }

  _bindAllLinks() {
    const anchors = Array.from(document.querySelectorAll(this._linkSelector));
    anchors.forEach(a => this._bindLink(a));

    // Observe future links
    const mo = new MutationObserver(mutations => {
      for (const m of mutations) {
        for (const node of Array.from(m.addedNodes || [])) {
          if (node.nodeType === 1) {
            if (node.matches && node.matches(this._linkSelector)) {
              this._bindLink(node);
            }
            const more = node.querySelectorAll ? node.querySelectorAll(this._linkSelector) : [];
            more && more.forEach(n => this._bindLink(n));
          }
        }
      }
    });
    mo.observe(document.documentElement || document.body, { childList: true, subtree: true });
    this._mo = mo;
  }

  _bindLink(a) {
    if (!(a && a.href)) return;
    // Ignore non-SCP Wiki hosts
    let url;
    try { url = new URL(a.getAttribute('href'), location.href); } catch(_) { return; }
    if (!/scp-wiki\.wikidot\.com$/i.test(url.host)) return;

    // Save handlers for cleanup
    const onEnter = (e) => this._onEnter(a, url.href, e);
    const onLeave = () => this._onLeave();
    a.addEventListener('mouseenter', onEnter);
    a.addEventListener('mouseleave', onLeave);
    this._handlers.set(a, { enter: onEnter, leave: onLeave });
  }

  _onEnter(anchor, href, _evt) {
    if (this._hideTimer) { clearTimeout(this._hideTimer); this._hideTimer = null; }
    if (this._hoverTimer) clearTimeout(this._hoverTimer);
    this._hoverTimer = setTimeout(async () => {
      this._activeAnchor = anchor;
      // Prefetch if not already
      if (!this._prefetched.has(href)) {
        this._prefetched.add(href);
        this._prefetch([href]).catch(() => {});
      }
      const meta = await this._getMetadata(href).catch(() => null);
      if (!meta) return;
      this._render(anchor, meta);
    }, this.config.hoverDelay);
  }

  _onLeave() {
    this._scheduleHide();
  }

  _scheduleHide() {
    if (this._hideTimer) clearTimeout(this._hideTimer);
    this._hideTimer = setTimeout(() => {
      if (this._tooltip) this._tooltip.style.display = 'none';
      this._activeAnchor = null;
    }, this.config.hideDelay);
  }

  async _getMetadata(url) {
    if (!browserApi || !browserApi.runtime || !browserApi.runtime.sendMessage) return null;
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), this.config.metadataTimeout);
    try {
      const res = await browserApi.runtime.sendMessage({ action: 'linkPreview:getMetadata', url, signalId: null });
      return res && res.ok ? res.data : null;
    } catch (e) {
      return null;
    } finally {
      clearTimeout(t);
    }
  }

  async _prefetch(urls) {
    if (!browserApi || !browserApi.runtime || !browserApi.runtime.sendMessage) return;
    try { await browserApi.runtime.sendMessage({ action: 'linkPreview:prefetch', urls }); } catch(_){}
  }

  _render(anchor, meta) {
    if (!this._tooltip || !this._tooltipInner) return;
    // Content
    const safe = (s) => String(s || '').slice(0, 500);
    const title = safe(meta.title || meta.url);
    const rating = meta.rating != null ? `Rating: ${meta.rating}` : '';
    const summary = safe(meta.summary || '');
    const type = meta.type || '';

    this._tooltipInner.innerHTML = '';
    const hdr = document.createElement('div');
    hdr.className = 'scp-link-preview__title';
    hdr.textContent = title;

    const info = document.createElement('div');
    info.className = 'scp-link-preview__meta';
    info.textContent = [type, rating].filter(Boolean).join(' \u00b7 ');

    const body = document.createElement('div');
    body.className = 'scp-link-preview__summary';
    body.textContent = summary;

    const actions = document.createElement('div');
    actions.className = 'scp-link-preview__actions';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'scp-link-preview__queue-btn';
    btn.textContent = 'Add to queue';
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (browserApi && browserApi.runtime && browserApi.runtime.sendMessage) {
        browserApi.runtime.sendMessage({ action: 'linkPreview:queue:add', item: { url: meta.url || anchor.href, title, type } }).catch(() => {});
      }
    });

    actions.appendChild(btn);

    this._tooltipInner.appendChild(hdr);
    this._tooltipInner.appendChild(info);
    if (summary) this._tooltipInner.appendChild(body);
    this._tooltipInner.appendChild(actions);

    // Position
    const rect = anchor.getBoundingClientRect();
    const top = window.scrollY + rect.bottom + 6;
    const left = Math.max(8, Math.min(window.scrollX + rect.left, window.scrollX + document.documentElement.clientWidth - 360));
    this._tooltip.style.left = `${left}px`;
    this._tooltip.style.top = `${top}px`;
    this._tooltip.style.display = 'block';
  }
}

export default new LinkPreviewsModule();
