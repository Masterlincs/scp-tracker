/* eslint-env jest */
'use strict';

const Detector = require('../src/modules/scp-detector.js');

describe('new-detector utils', () => {
  test('normalizeIdentifier handles common forms', () => {
    const n1 = Detector.utils.normalizeIdentifier('SCP-173');
    expect(n1).toEqual({ id: 'scp-173', kind: 'scp' });

    const n2 = Detector.utils.normalizeIdentifier('SCP 049 - J');
    expect(n2).toEqual({ id: 'scp-49-j', kind: 'scp_variant' });

    const n3 = Detector.utils.normalizeIdentifier('SCP–████'); // en dash
    expect(n3).toEqual({ id: 'scp-unknown', kind: 'scp' });
  });

  test('classifyPage identifies scp_article on canonical paths', () => {
    const url = new URL('https://scp-wiki.wikidot.com/scp-173');
    const cls = Detector.utils.classifyPage(url, 'SCP-173');
    expect(cls.type).toBe('scp_article');
    expect(cls.site).toBe('scp-wiki');
  });

  test('classifyPage returns unknown for non-scp domains', () => {
    const url = new URL('https://example.com/whatever');
    const cls = Detector.utils.classifyPage(url, 'Example');
    expect(cls.type).toBe('unknown');
    expect(cls.site).toBe('unknown');
  });
});

describe('new-detector end-to-end (no observers)', () => {
  beforeEach(() => {
    document.title = 'Test Page';
    document.body.innerHTML = '';
  });

  test('detects SCPs from links and inline text; dedupes identical links', () => {
    // Two identical links -> should dedupe to one link entity
    const a1 = document.createElement('a');
    a1.href = '/scp-173';
    a1.textContent = 'SCP-173';
    const a2 = document.createElement('a');
    a2.href = '/scp-173';
    a2.textContent = 'Peanut';
    const p = document.createElement('p');
    p.textContent = 'See also SCP-049-J for more fun.';

    document.body.appendChild(a1);
    document.body.appendChild(a2);
    document.body.appendChild(p);

    const detector = Detector.createDetector({
      document,
      window: { location: { href: 'https://scp-wiki.wikidot.com/test' } },
      observe: false,
      autostart: false,
    });

    detector.refresh();
    const { entities } = detector.getResults();

    // Should include one high-confidence link entity for scp-173
    const link173 = entities.filter(e => e.id === 'scp-173' && e.context === 'link');
    expect(link173.length).toBe(1);
    expect(link173[0].confidence).toBe('high');

    // Should include inline entity for 049-J
    const inline049j = entities.find(e => e.id === 'scp-49-j' && e.context === 'inline');
    expect(inline049j).toBeTruthy();

    detector.dispose();
  });

  test('respects allowedDomains and returns empty when not allowed', () => {
    const a = document.createElement('a');
    a.href = '/scp-173';
    a.textContent = 'SCP-173';
    document.body.appendChild(a);

    const detector = Detector.createDetector({
      document,
      window: { location: { href: 'https://example.com/page' } },
      allowedDomains: ['scp-wiki.wikidot.com'],
      observe: false,
      autostart: false,
    });

    detector.refresh();
    const { entities } = detector.getResults();
    expect(entities).toHaveLength(0);

    detector.dispose();
  });
});
