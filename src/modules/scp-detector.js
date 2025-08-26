'use strict';

// scp-detector.js
// A standalone SCP Detector module with event-driven API, DOM scanning, normalization,
// page classification, deduplication, and MutationObserver-based updates.
// This file is implementation-agnostic and does not depend on other project files.

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else {
    root.SCPDetector = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this, function () {
  const VERSION = '1.0.0';

  // Simple event emitter
  class Emitter {
    constructor() {
      this._listeners = Object.create(null);
    }
    on(event, cb) {
      if (!this._listeners[event]) this._listeners[event] = new Set();
      this._listeners[event].add(cb);
      return () => this.off(event, cb);
    }
    off(event, cb) {
      const set = this._listeners[event];
      if (set) set.delete(cb);
    }
    emit(event, payload) {
      const set = this._listeners[event];
      if (!set || set.size === 0) return;
      for (const cb of set) {
        try { cb(payload); } catch (_) { /* swallow */ }
      }
    }
    removeAll() {
      this._listeners = Object.create(null);
    }
  }

  // Utilities
  function debounce(fn, delay) {
    let t = null;
    return function debounced() {
      const ctx = this;
      const args = arguments;
      if (t) clearTimeout(t);
      t = setTimeout(() => fn.apply(ctx, args), delay);
    };
  }

  function safeURL(href, base) {
    try {
      return new URL(href, base);
    } catch (_) {
      return null;
    }
  }

  // No-op logger to keep module dependency-free when not injected
  function createNoopLogger() {
    return {
      debug: function () {},
      info: function () {},
      warn: function () {},
      error: function () {}
    };
  }

  // Safe error handler that logs via provided logger if available
  function createSafeErrorHandler(logger) {
    return {
      handleError: function (error, context) {
        try {
          if (logger && typeof logger.error === 'function') {
            logger.error('new-detector error', error, context || {});
          }
        } catch (_) { /* swallow */ }
      }
    };
  }

  const DASH_CLASS = "\u2010\u2011\u2012\u2013\u2014\u2015-"; // hyphen variants
  const ID_INLINE_REGEX = new RegExp(
    // capture things like: SCP-173, SCP 173, SCP–173, SCP-049-J, SCP-3000-1, SCP-████
    `(?:^|[^A-Z0-9])((?:SCP)[\u0020${DASH_CLASS}]*((?:[0-9]{1,4})|(?:████))(?:-[0-9A-Za-z]+)*)`,
    'gi'
  );

  const DEFAULT_EXCLUDE_SELECTOR = [
    'script', 'style', 'pre', 'code', 'textarea', 'input', 'select', 'button',
    '[contenteditable="true"]', '[data-scp-detector-exclude]'
  ].join(',');

  const DEFAULT_INCLUDE_SELECTOR = [
    'a[href]',
    'p', 'li', 'span', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'blockquote', 'strong', 'em', 'small', 'figcaption', 'caption', 'td', 'th'
  ].join(',');

  const DEFAULT_DOMAIN_MAP = {
    'scp-wiki.wikidot.com': { site: 'scp-wiki', locale: 'en' },
    'www.scp-wiki.wikidot.com': { site: 'scp-wiki', locale: 'en' },
    'scpwiki.com': { site: 'scp-wiki', locale: 'en' },
    'www.scpwiki.com': { site: 'scp-wiki', locale: 'en' },
    // Common international/mirror domains (best-effort defaults)
    'scp-wiki-cn.wikidot.com': { site: 'scp-wiki', locale: 'zh-cn' },
    'scp-ru.wikidot.com': { site: 'scp-wiki', locale: 'ru' },
    'scpko.wikidot.com': { site: 'scp-wiki', locale: 'ko' },
    'scp-th.wikidot.com': { site: 'scp-wiki', locale: 'th' },
    'scp-pl.wikidot.com': { site: 'scp-wiki', locale: 'pl' },
    'scp-jp.wikidot.com': { site: 'scp-wiki', locale: 'ja' },
    'scp-es.com': { site: 'scp-wiki', locale: 'es' },
  };

  const DEFAULT_CONFIG = {
    observe: true,
    debounceMs: 120,
    includeSelectors: DEFAULT_INCLUDE_SELECTOR,
    excludeSelectors: DEFAULT_EXCLUDE_SELECTOR,
    domainMap: DEFAULT_DOMAIN_MAP,
    allowedDomains: null, // null => allow all domains; provide array to restrict
    strict: false, // if true, require hyphenated forms and avoid loose matches
    maxNodes: 5000,
    scanIframes: false,
    allowAllDomains: true, // kept for clarity; if allowedDomains provided, that wins
  };

  function unifyDashes(text) {
    if (!text) return text;
    return text.replace(new RegExp(`[${DASH_CLASS}]`, 'g'), '-');
  }

  function normalizeIdentifier(raw) {
    if (!raw) return null;
    let s = String(raw).trim();
    s = unifyDashes(s);
    // Normalize any spaces around hyphens (e.g., "SCP 049 - J" -> "SCP 049-J")
    s = s.replace(/\s*-\s*/g, '-');
    // Ensure SCP prefix normalization
    // Accept variants like "SCP 173" -> "SCP-173"
    const m = /^(?:SCP)\s*-?\s*((?:[0-9]{1,4})|(?:████))(?:-([0-9A-Za-z]+))?/i.exec(s);
    if (!m) return null;
    const base = m[1];
    const rest = m[2] || '';

    let id = base === '████' ? 'scp-unknown' : `scp-${base.replace(/^0+(?=\d)/, '') || '0'}`;
    if (rest) {
      // Keep suffixes; normalize to lowercase
      id += `-${rest.toLowerCase()}`;
    }

    // Map special variants to kinds
    let kind = 'scp';
    if (/^(?:scp-)?001\b/i.test(id.replace(/^scp-/, 'scp-'))) {
      // 001 proposals will be treated special at classification time, but mark as proposal-ish
      kind = 'proposal_or_article';
    }
    if (/-(?:j|ex|arc|d)\b/.test(id)) {
      kind = 'scp_variant';
    }

    return { id, kind };
  }

  function classifyPage(urlObj, documentTitle) {
    const url = urlObj || { hostname: '', pathname: '/', href: '' };
    const hostname = (url.hostname || '').toLowerCase();
    const pathname = (url.pathname || '/').toLowerCase();

    let site = 'unknown';
    let locale = 'unknown';

    // Site mapping
    site = DEFAULT_CONFIG.domainMap[hostname]?.site || 'unknown';
    locale = DEFAULT_CONFIG.domainMap[hostname]?.locale || 'unknown';

    // Page type heuristic
    let type = 'unknown';
    let confidence = 0.2;

    const title = (documentTitle || '').toLowerCase();

    const isSCPPath = /\/(?:scp-)?\d{1,4}(?:-[a-z0-9]+)*/.test(pathname);
    const isSCP001 = /\/scp-?001(?!\d)/.test(pathname);
    const looksLikeArticle = isSCPPath || /\bscp-\d{1,4}\b/.test(title);

    if (isSCP001) {
      type = 'proposal_or_index';
      confidence = 0.6;
    } else if (looksLikeArticle) {
      type = 'scp_article';
      confidence = isSCPPath ? 0.9 : 0.6;
    } else if (/\bseries\b/.test(pathname) || /series [ivx]+/i.test(title)) {
      type = 'series';
      confidence = 0.6;
    } else if (/\bhub\b/.test(pathname) || /hub/i.test(title)) {
      type = 'hub';
      confidence = 0.5;
    } else if (/\btale\b/.test(pathname) || /tale/i.test(title)) {
      type = 'tale';
      confidence = 0.4;
    } else {
      type = site === 'scp-wiki' ? 'non_scp' : 'unknown';
      confidence = site === 'scp-wiki' ? 0.3 : 0.1;
    }

    return {
      type,
      site,
      locale,
      canonicalUrl: url.href || '',
      confidence,
    };
  }

  function elementExcluded(el, excludeSelectors) {
    if (!el || !el.matches) return false;
    return el.matches(excludeSelectors);
  }

  function dedupeEntities(entities) {
    const byKey = new Map();
    for (const e of entities) {
      const key = `${e.id}|${e.url || ''}`;
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, e);
      } else {
        // Prefer higher confidence and link context
        const score = scoreEntity(e);
        const scoreExisting = scoreEntity(existing);
        if (score > scoreExisting) byKey.set(key, e);
      }
    }
    return Array.from(byKey.values());
  }

  function scoreEntity(e) {
    let score = 0;
    if (e.confidence === 'high') score += 3;
    if (e.confidence === 'medium') score += 2;
    if (e.confidence === 'low') score += 1;
    if (e.context === 'link') score += 1;
    return score;
  }

  function makeEntity({ id, kind, context, url, displayText, element, confidence }) {
    return { id, kind, context, url: url || null, displayText: displayText || null, element: element || null, confidence };
  }

  function scanLinks(doc, baseHref) {
    const out = [];
    const anchors = doc.querySelectorAll('a[href]');
    for (let i = 0; i < anchors.length; i++) {
      const a = anchors[i];
      if (elementExcluded(a, DEFAULT_CONFIG.excludeSelectors)) continue;
      const href = a.getAttribute('href');
      if (!href) continue;
      const urlObj = safeURL(href, baseHref);
      if (!urlObj) continue;
      const path = unifyDashes((urlObj.pathname || '').toLowerCase());
      // Try to parse path-based ids: /scp-173, /fragment:scp-173 (some wikis use fragments)
      const m = /(?:^|\/)scp-([0-9]{1,4}(?:-[0-9a-z]+)*)\b/.exec(path);
      if (m) {
        const numPart = m[1];
        const norm = normalizeIdentifier(`SCP-${numPart}`);
        if (norm) {
          out.push(makeEntity({
            id: norm.id,
            kind: norm.kind,
            context: 'link',
            url: urlObj.href,
            displayText: a.textContent ? a.textContent.trim() : '',
            element: a,
            confidence: 'high',
          }));
          continue;
        }
      }

      // Fallback to link text if it looks like an SCP mention
      const text = (a.textContent || '').trim();
      if (!text) continue;
      const textNorm = normalizeIdentifier(text.toUpperCase());
      if (textNorm) {
        out.push(makeEntity({
          id: textNorm.id,
          kind: textNorm.kind,
          context: 'link',
          url: urlObj.href,
          displayText: text,
          element: a,
          confidence: 'medium',
        }));
      }
    }
    return out;
  }

  function scanInline(doc, includeSelectors, maxNodes) {
    const out = [];
    const nodes = doc.querySelectorAll(includeSelectors);
    const total = Math.min(nodes.length, maxNodes);
    for (let i = 0; i < total; i++) {
      const el = nodes[i];
      if (elementExcluded(el, DEFAULT_CONFIG.excludeSelectors)) continue;
      const text = (el.textContent || '').trim();
      if (!text) continue;
      // Use regex to find inline occurrences
      ID_INLINE_REGEX.lastIndex = 0;
      let m;
      let safety = 0;
      while ((m = ID_INLINE_REGEX.exec(text)) && safety++ < 20) {
        const candidate = m[1];
        const norm = normalizeIdentifier(candidate);
        if (norm) {
          out.push(makeEntity({
            id: norm.id,
            kind: norm.kind,
            context: 'inline',
            url: null,
            displayText: candidate,
            element: el,
            confidence: 'low',
          }));
        }
      }
    }
    return out;
  }

  function isAllowedDomain(hostname, cfg) {
    if (!hostname) return true;
    if (Array.isArray(cfg.allowedDomains) && cfg.allowedDomains.length > 0) {
      return cfg.allowedDomains.includes(hostname);
    }
    return !!cfg.allowAllDomains;
  }

  function createDetector(options) {
    const cfg = Object.assign({}, DEFAULT_CONFIG, options || {});
    const emitter = new Emitter();

    const w = cfg.window || (typeof window !== 'undefined' ? window : undefined);
    const d = cfg.document || (typeof document !== 'undefined' ? document : undefined);

    // Optional DI: logger and errorHandler
    const logger = (cfg && cfg.logger && typeof cfg.logger.debug === 'function')
      ? cfg.logger
      : createNoopLogger();
    const errorHandler = (cfg && cfg.errorHandler && typeof cfg.errorHandler.handleError === 'function')
      ? cfg.errorHandler
      : createSafeErrorHandler(logger);

    let disposed = false;
    let observer = null;

    const state = {
      version: VERSION,
      page: {
        type: 'unknown', site: 'unknown', locale: 'unknown', canonicalUrl: '', confidence: 0,
      },
      entities: [],
      lastUpdatedAt: 0,
    };

    function compute() {
      if (disposed) return;
      try {
        if (!d) return;
        const base = (w && w.location && w.location.href) || (d && d.location && d.location.href) || '';
        const urlObj = safeURL(base, base) || { hostname: '', pathname: '/', href: base };

        if (!isAllowedDomain((urlObj.hostname || '').toLowerCase(), cfg)) {
          // Clear results if not allowed
          state.page = classifyPage(urlObj, d && d.title);
          state.entities = [];
          state.lastUpdatedAt = Date.now();
          logger.debug('domain:not-allowed', { hostname: (urlObj.hostname || '').toLowerCase() });
          emitter.emit('update', getResults());
          return;
        }

        // Page classification
        const page = classifyPage(urlObj, d && d.title);

        // Scan
        const linkEntities = scanLinks(d, urlObj.href);
        const inlineEntities = scanInline(d, cfg.includeSelectors, cfg.maxNodes);
        logger.debug('compute:scan', { links: linkEntities.length, inline: inlineEntities.length });
        const all = dedupeEntities([].concat(linkEntities, inlineEntities));
        logger.debug('compute:dedupe', { before: linkEntities.length + inlineEntities.length, after: all.length });

        state.page = page;
        state.entities = all;
        state.lastUpdatedAt = Date.now();

        emitter.emit('update', getResults());
      } catch (e) {
        errorHandler.handleError(e, { action: 'compute' });
      }
    }

    const scheduleCompute = debounce(compute, cfg.debounceMs);

    function refresh() { try { logger.debug('refresh:manual'); } catch (_) {} compute(); }

    function getPageClassification() { return Object.assign({}, state.page); }

    function getEntities() { return state.entities.slice(); }

    function getResults() {
      return {
        page: getPageClassification(),
        entities: getEntities(),
        lastUpdatedAt: state.lastUpdatedAt,
      };
    }

    function dispose() {
      disposed = true;
      if (observer) {
        try { observer.disconnect(); logger.debug('observer:disconnected'); } catch (_) { /* noop */ }
        observer = null;
      }
      emitter.removeAll();
    }

    function on(event, cb) { return emitter.on(event, cb); }

    function configure(nextCfg) {
      Object.assign(cfg, nextCfg || {});
      // Re-run computation with new config
      refresh();
    }

    // Observe DOM mutations for dynamic updates
    if (cfg.observe && d && d.body && typeof MutationObserver !== 'undefined') {
      observer = new MutationObserver(function () {
        try { scheduleCompute(); } catch (e) { errorHandler.handleError(e, { action: 'mutation_observer' }); }
      });
      try {
        observer.observe(d.body, { childList: true, subtree: true, characterData: true });
        logger.debug('observer:attached');
      } catch (_) {
        // ignore observer errors
      }
    }

    // Initial run
    if (cfg.autostart !== false) {
      // Use a microtask to allow caller to attach listeners before first update
      Promise.resolve().then(() => {
        try { logger.debug('autostart:scheduled'); } catch (_) {}
        scheduleCompute();
      });
    }

    return {
      version: VERSION,
      on,
      off: (event, cb) => emitter.off(event, cb),
      getPageClassification,
      getEntities,
      getResults,
      refresh,
      dispose,
      configure,
    };
  }

  // Public API
  return {
    createDetector,
    utils: {
      normalizeIdentifier,
      classifyPage,
      unifyDashes,
    },
    constants: {
      DEFAULT_CONFIG,
      DEFAULT_EXCLUDE_SELECTOR,
      DEFAULT_INCLUDE_SELECTOR,
    },
  };
});
