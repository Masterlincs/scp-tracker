/**
 * Dictionary Module
 * Handles SCP terminology tooltips and dictionary functionality
 */

import { logger, errorHandler, performanceMonitor } from '../utils/index.js';

class Dictionary {
  constructor() {
    this.terms = new Map();
    this.trie = {}; // term/alias trie for fast matching
    this.tooltip = null;
    this.activeTerm = null;
    this.tooltipTimeout = null;
    this.hideTimeout = null;
    this.isInitialized = false;
    this.cleanupFunctions = new Set();
    this.observer = null;
    this.highlightClass = 'scp-term';
    this.markerAttr = 'data-scp-dict';
    this._posRaf = null;
    this._posX = 0;
    this._posY = 0;
  }

  /**
   * Setup delegated mouse handlers for tooltip showing/hiding
   * Uses a single set of listeners for all highlights to reduce overhead
   */
  setupDelegatedTooltipHandlers() {
    try {
      if (this._delegatedHandlers) return;
      const selector = `.${this.highlightClass}[${this.markerAttr}="1"]`;

      this._onOver = (e) => {
        const target = e.target.closest(selector);
        if (!target) return;
        if (this.hideTimeout) clearTimeout(this.hideTimeout);
        if (this.tooltipTimeout) clearTimeout(this.tooltipTimeout);
        this.tooltipTimeout = setTimeout(() => {
          this.showTooltipFromTarget(target, e.clientX, e.clientY);
        }, 200);
      };

      this._onMove = (e) => {
        const target = e.target.closest(selector);
        if (!target) return;
        this.updateTooltipPosition(e.clientX, e.clientY);
      };

      this._onOut = (e) => {
        const target = e.target.closest(selector);
        if (!target) return;
        this.hideTooltip();
      };

      document.addEventListener('mouseover', this._onOver, { passive: true });
      document.addEventListener('mousemove', this._onMove, { passive: true });
      document.addEventListener('mouseout', this._onOut, { passive: true });

      this.cleanupFunctions.add(() => {
        try {
          document.removeEventListener('mouseover', this._onOver);
          document.removeEventListener('mousemove', this._onMove);
          document.removeEventListener('mouseout', this._onOut);
        } catch {}
        this._delegatedHandlers = false;
      });

      this._delegatedHandlers = true;
    } catch (error) {
      errorHandler.handleError(error, { action: 'dictionary_setup_delegated_handlers' });
    }
  }

  /**
   * Initialize dictionary with terms from JSON file
   */
  async initialize() {
    try {
      performanceMonitor.startMeasure('dictionaryInitialize');
      
      if (this.isInitialized) {
        performanceMonitor.endMeasure('dictionaryInitialize');
        return;
      }

      logger.debug('Initializing dictionary module');
      
      // Load dictionary terms
      await this.loadDictionaryTerms();

      // Build search trie
      this.buildTrie();

      // Initial pass: highlight existing content
      this.processRoot(document.body);

      // Observe DOM for changes
      this.setupDOMObserver();
      // Setup delegated events for tooltips (single listeners)
      this.setupDelegatedTooltipHandlers();
      
      this.isInitialized = true;
      logger.info('Dictionary module initialized successfully');
      
      performanceMonitor.endMeasure('dictionaryInitialize');
      
    } catch (error) {
      errorHandler.handleError(error, {
        action: 'dictionary_initialize'
      });
      performanceMonitor.endMeasure('dictionaryInitialize');
    }
  }

  /**
   * Load dictionary terms from JSON file
   */
  async loadDictionaryTerms() {
    try {
      const response = await fetch(browser.runtime.getURL('dictionary.json'));
      if (!response.ok) {
        throw new Error(`Failed to load dictionary: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Process terms: support string or object { def/definition, aliases }
      Object.entries(data).forEach(([term, value]) => {
        let definition = '';
        let aliases = [];
        if (value && typeof value === 'object') {
          definition = value.definition || value.def || '';
          if (Array.isArray(value.aliases)) aliases = value.aliases;
        } else {
          definition = String(value);
        }
        const aliasSet = new Set([...(aliases || []), ...this.generateTermAliases(term)]);
        this.terms.set(term.toLowerCase(), {
          term,
          definition,
          aliases: Array.from(aliasSet)
        });
      });
      
      logger.debug(`Loaded ${this.terms.size} dictionary terms`);
      
    } catch (error) {
      logger.warn('Failed to load dictionary terms:', error);
      // Use fallback terms
      this.loadFallbackTerms();
    }
  }

  /**
   * Load a minimal set of fallback terms if the JSON cannot be fetched
   */
  loadFallbackTerms() {
    try {
      const fallback = {
        'SCP': 'Special Containment Procedures',
        'Safe': 'SCP object class',
        'Euclid': 'SCP object class',
        'Keter': 'SCP object class',
        'Thaumiel': 'SCP object class'
      };
      Object.entries(fallback).forEach(([term, definition]) => {
        const aliasSet = new Set(this.generateTermAliases(term));
        this.terms.set(term.toLowerCase(), {
          term,
          definition,
          aliases: Array.from(aliasSet)
        });
      });
      logger.debug(`Loaded fallback terms: ${this.terms.size}`);
    } catch (e) {
      errorHandler.handleError(e, { action: 'dictionary_load_fallback_terms' });
    }
  }

  /**
   * Generate aliases for better term matching
   * @param {string} term - Original term
   * @returns {Array} Array of aliases
   */
  generateTermAliases(term) {
    const aliases = [];
    
    // Add common variations
    if (term.includes('Class')) {
      const classType = term.replace('Class', '').trim();
      aliases.push(`${classType} Class`);
      aliases.push(`${classType}-class`);
    }
    
    // Add acronym variations
    if (term.length > 3 && term.includes('.')) {
      const acronym = term.replace(/\./g, '');
      aliases.push(acronym);
    }
    
    // Add lowercase variations
    aliases.push(term.toLowerCase());
    
    return aliases;
  }

  /**
   * Setup event listeners for dictionary functionality
   */
  setupDOMObserver() {
    try {
      if (this.observer) return;
      this.observer = new MutationObserver((mutations) => {
        try {
          for (const m of mutations) {
            if (m.type === 'childList') {
              m.addedNodes.forEach((n) => {
                if (n.nodeType === Node.TEXT_NODE) {
                  this.processTextNode(n);
                } else if (n.nodeType === Node.ELEMENT_NODE) {
                  this.processRoot(n);
                }
              });
            } else if (m.type === 'characterData') {
              this.processTextNode(m.target);
            }
          }
        } catch (e) {
          logger.warn('Dictionary observer error:', e);
        }
      });
      this.observer.observe(document.body, { childList: true, subtree: true, characterData: true });
      this.cleanupFunctions.add(() => {
        try { this.observer.disconnect(); } catch (e) { /* noop */ }
        this.observer = null;
      });
    } catch (error) {
      errorHandler.handleError(error, {
        action: 'dictionary_setup_observer'
      });
    }
  }

  /**
   * Find dictionary terms in text
   * @param {string} text - Text to search
   * @returns {Array} Array of found terms
   */
  findTermsInText(text) {
    const foundTerms = [];
    if (!text) return foundTerms;
    const lower = text.toLowerCase();
    const len = lower.length;
    for (let i = 0; i < len; i++) {
      let node = this.trie;
      let j = i;
      let lastMatch = null;
      while (j < len && node && node[lower[j]]) {
        node = node[lower[j]];
        j++;
        if (node.$) lastMatch = node.$;
      }
      if (lastMatch) {
        const start = i;
        const end = i + lastMatch.length;
        if (this.validBoundary(lower, start, end)) {
          foundTerms.push({
            term: lastMatch.term,
            definition: lastMatch.definition,
            index: start,
            length: lastMatch.length
          });
        }
      }
    }
    // Sort by position and remove overlaps
    foundTerms.sort((a, b) => a.index - b.index || b.length - a.length);
    return this.removeOverlappingTerms(foundTerms);
  }

  /**
   * Remove overlapping terms
   * @param {Array} terms - Array of terms
   * @returns {Array} Filtered array without overlaps
   */
  removeOverlappingTerms(terms) {
    const filtered = [];
    let lastEnd = -1;
    
    terms.forEach(term => {
      if (term.index >= lastEnd) {
        filtered.push(term);
        lastEnd = term.index + term.length;
      }
    });
    
    return filtered;
  }

  /**
   * Build trie from terms and aliases
   */
  buildTrie() {
    this.trie = {};
    this.terms.forEach((data, key) => {
      const variants = new Set([key, ...((data.aliases || []).map(a => a.toLowerCase()))]);
      variants.forEach((v) => {
        const s = (v || '').trim();
        if (!s) return;
        let node = this.trie;
        for (const ch of s) {
          if (!node[ch]) node[ch] = {};
          node = node[ch];
        }
        node.$ = { term: data.term, definition: data.definition, length: s.length };
      });
    });
  }

  /**
   * Check if boundary chars are word characters (letters/digits)
   */
  isWordChar(ch) {
    return !!ch && /[A-Za-z0-9]/.test(ch);
  }

  /**
   * Validate word boundary for a match
   */
  validBoundary(text, start, end) {
    const before = start - 1 >= 0 ? text[start - 1] : '';
    const after = end < text.length ? text[end] : '';
    const beforeOk = !this.isWordChar(before);
    const afterOk = !this.isWordChar(after);
    return beforeOk && afterOk;
  }

  /**
   * Process a root element subtree for highlighting
   */
  processRoot(element) {
    try {
      if (!element || element.closest?.('.scp-tooltip')) return;
      const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );
      const nodes = [];
      let node;
      while ((node = walker.nextNode())) nodes.push(node);
      nodes.forEach((textNode) => this.processTextNode(textNode));
    } catch (error) {
      errorHandler.handleError(error, { action: 'dictionary_process_root' });
    }
  }

  /**
   * Process a single text node
   */
  processTextNode(textNode) {
    try {
      if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return;
      const parent = textNode.parentNode;
      if (!parent) return;
      const tag = parent.nodeName;
      if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT'].includes(tag)) return;
      if (parent.closest && parent.closest(`[${this.markerAttr}="1"], .scp-tooltip`)) return;
      const matches = this.findTermsInText(textNode.textContent || '');
      if (matches.length > 0) {
        this.highlightTextNodes(textNode, matches);
      }
    } catch (error) {
      errorHandler.handleError(error, { action: 'dictionary_process_textnode' });
    }
  }

  /**
   * Highlight text nodes
   * @param {Text} textNode - Text node to highlight
   * @param {Array} terms - Terms to highlight
   */
  highlightTextNodes(textNode, terms) {
    const parent = textNode.parentNode;
    const text = textNode.textContent;
    let lastIndex = 0;
    
    // Create fragment for new nodes
    const fragment = document.createDocumentFragment();
    
    terms.forEach(term => {
      const termStart = term.index;
      const termEnd = termStart + term.length;
      
      // Add text before term
      if (termStart > lastIndex) {
        fragment.appendChild(document.createTextNode(text.substring(lastIndex, termStart)));
      }
      
      // Create term element
      const termElement = document.createElement('span');
      termElement.className = this.highlightClass;
      termElement.textContent = text.substring(termStart, termEnd);
      termElement.dataset.term = term.term;
      termElement.dataset.definition = term.definition;
      termElement.setAttribute(this.markerAttr, '1');
      
      fragment.appendChild(termElement);
      lastIndex = termEnd;
    });
    
    // Add remaining text
    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
    }
    
    // Replace original text node
    parent.replaceChild(fragment, textNode);
  }

  

  /**
   * Hide tooltip
   */
  hideTooltip() {
    try {
      // Clear existing timeout
      if (this.hideTimeout) {
        clearTimeout(this.hideTimeout);
      }
      
      // Hide tooltip after short delay
      this.hideTimeout = setTimeout(() => {
        if (this.tooltip && this.tooltip.parentNode) {
          this.tooltip.remove();
          this.tooltip = null;
          this.activeTerm = null;
        }
      }, 200);
      
    } catch (error) {
      errorHandler.handleError(error, {
        action: 'dictionary_hide_tooltip'
      });
    }
  }

  /** Ensure tooltip exists and attached */
  ensureTooltip() {
    if (this.tooltip && this.tooltip.parentNode) return this.tooltip;
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'scp-tooltip';
    // Pre-create content nodes to avoid innerHTML reparse
    this._termEl = document.createElement('div');
    this._termEl.className = 'scp-tooltip-term';
    this._defEl = document.createElement('div');
    this._defEl.className = 'scp-tooltip-definition';
    this.tooltip.appendChild(this._termEl);
    this.tooltip.appendChild(this._defEl);
    document.body.appendChild(this.tooltip);
    return this.tooltip;
  }

  /**
   * Show tooltip for a highlighted target using its dataset
   */
  showTooltipFromTarget(target, x, y) {
    try {
      const term = target?.dataset?.term || '';
      const definition = target?.dataset?.definition || '';
      this.ensureTooltip();
      if (this._termEl) this._termEl.textContent = term;
      if (this._defEl) this._defEl.textContent = definition;
      this.updateTooltipPosition(x, y);
      this.activeTerm = { term, definition };
    } catch (error) {
      errorHandler.handleError(error, { action: 'dictionary_show_tooltip_target' });
    }
  }

  /**
   * Update tooltip position
   * @param {number} x - Mouse X coordinate
   * @param {number} y - Mouse Y coordinate
   */
  updateTooltipPosition(x, y) {
    if (!this.tooltip) return;
    this._posX = x;
    this._posY = y;
    if (this._posRaf) return;
    this._posRaf = requestAnimationFrame(() => {
      try {
        const tooltipRect = this.tooltip.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        // Calculate position
        let left = this._posX + 15;
        let top = this._posY - tooltipRect.height - 10;
        // Adjust if tooltip goes off screen horizontally
        if (left + tooltipRect.width > viewportWidth) {
          left = this._posX - tooltipRect.width - 15;
        }
        // Adjust vertically
        if (top < 0) {
          top = this._posY + 15;
        }
        this.tooltip.style.left = `${left}px`;
        this.tooltip.style.top = `${top}px`;
      } finally {
        this._posRaf = null;
      }
    });
  }

  /**
   * Remove all highlights by unwrapping marked spans back to text nodes
   * @param {Element} root
   */
  unwrapHighlights(root = document.body) {
    try {
      if (!root) return;
      const highlighted = root.querySelectorAll(`[${this.markerAttr}="1"]`);
      highlighted.forEach((el) => {
        try {
          const text = document.createTextNode(el.textContent || '');
          el.replaceWith(text);
        } catch (e) {
          // If replaceWith not supported or fails, fallback
          const parent = el.parentNode;
          if (parent) {
            parent.insertBefore(document.createTextNode(el.textContent || ''), el);
            parent.removeChild(el);
          }
        }
      });
    } catch (error) {
      logger.warn('Error unwrapping highlights:', error);
    }
  }

  /**
   * Check if dictionary is enabled
   * @returns {boolean} True if enabled
   */
  isEnabled() {
    return this.isInitialized;
  }

  /**
   * Get dictionary statistics
   * @returns {Object} Dictionary statistics
   */
  getStats() {
    return {
      termCount: this.terms.size,
      isInitialized: this.isInitialized,
      hasTooltip: this.tooltip !== null
    };
  }

  /**
   * Clean up dictionary resources
   */
  cleanup() {
    try {
      // Remove tooltip
      if (this.tooltip && this.tooltip.parentNode) {
        this.tooltip.remove();
      }
      
      // Clear timeouts
      if (this.tooltipTimeout) {
        clearTimeout(this.tooltipTimeout);
      }
      if (this.hideTimeout) {
        clearTimeout(this.hideTimeout);
      }
      // Cancel any pending rAF for tooltip position
      if (this._posRaf) {
        try { cancelAnimationFrame(this._posRaf); } catch {}
        this._posRaf = null;
      }
      
      // Remove event listeners
      this.cleanupFunctions.forEach(cleanup => {
        try {
          cleanup();
        } catch (error) {
          logger.warn('Error during dictionary cleanup:', error);
        }
      });
      this.cleanupFunctions.clear();

      // Unwrap all highlighted spans
      this.unwrapHighlights(document.body);
      
      // Reset state
      this.tooltip = null;
      this.activeTerm = null;
      this.isInitialized = false;
      
    } catch (error) {
      errorHandler.handleError(error, {
        action: 'dictionary_cleanup'
      });
    }
  }
}

// Export singleton instance
const dictionary = new Dictionary();

export default dictionary;