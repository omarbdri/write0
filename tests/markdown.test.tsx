import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Preview } from '../components/Preview';
import { buildPrintHTML, exportToPDF, renderMarkdownHTML } from '../utils/exportUtils';
import { normalizeMarkdownForNestedLists } from '../utils/markdownUtils';

describe('Markdown consistency and safety', () => {
  it('escapes raw HTML and filters unsafe links in exports', () => {
    const html = renderMarkdownHTML(
      '<script>alert(1)</script>\n\n[click](javascript:alert%281%29)\n\n<img src="x" onerror="alert(2)">',
    );
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(doc.querySelector('script')).toBeNull();
    expect(doc.querySelector('[onerror]')).toBeNull();
    expect(doc.querySelector('a')?.getAttribute('href')).toBe('');
    expect(buildPrintHTML('<title> & "quote"', html)).toContain(
      '&lt;title&gt; &amp; &quot;quote&quot;',
    );
  });

  it('preserves GFM tables, tasks, and ordered-list start values in exports', () => {
    const html = renderMarkdownHTML(
      '5. Start here\n6. Next\n\n- [x] Done\n\n| A | B |\n| - | - |\n| 1 | 2 |',
    );
    expect(html).toContain('<ol start="5">');
    expect(html).toContain('<table>');
    expect(html).toContain('type="checkbox"');
  });

  it.each(['~~~', '````'])('does not normalize list-looking text in %s fences', (fence) => {
    const markdown = `${fence}\n1. example\n- literal\n\`\`\`\n- still literal\n${fence}\n\n- outside`;
    expect(normalizeMarkdownForNestedLists(markdown)).toBe(markdown);
  });

  it('does not indent unrelated paragraphs after a nested bullet list', () => {
    expect(normalizeMarkdownForNestedLists('1. Parent\n\n- Child\n\nUnrelated paragraph')).toBe(
      '1. Parent\n\n    - Child\n\nUnrelated paragraph',
    );
  });

  it('keeps grandchildren nested under a bullet moved into an ordered list', () => {
    expect(normalizeMarkdownForNestedLists('1. Parent\n- Child\n  - Grandchild\n2. Next')).toBe(
      '1. Parent\n    - Child\n      - Grandchild\n2. Next',
    );
  });

  it('dims other nested list items without multiplying ancestor opacity', () => {
    const { container } = render(
      <Preview content={'- Parent\n  - First\n  - Second'} focusMode={true} focusLine={2} />,
    );
    const items = container.querySelectorAll('li');
    expect(items[0].className).toContain('opacity-100');
    expect(items[1].className).toContain('opacity-100');
    expect(items[2].className).toContain('opacity-25');
  });
});

describe('printing', () => {
  it('prints once even if a load event follows an already-complete document', () => {
    const print = vi.fn();
    const events = new EventTarget();
    const printWindow = {
      closed: false,
      opener: window,
      document: { write: vi.fn(), close: vi.fn(), readyState: 'complete' },
      focus: vi.fn(),
      print,
      addEventListener: events.addEventListener.bind(events),
    };
    vi.spyOn(window, 'open').mockReturnValue(printWindow as unknown as Window);
    exportToPDF('Test', '# Hello');
    events.dispatchEvent(new Event('load'));
    expect(print).toHaveBeenCalledTimes(1);
    expect(printWindow.opener).toBeNull();
  });

  it('waits for document load instead of printing unloaded images', () => {
    const print = vi.fn();
    const events = new EventTarget();
    vi.spyOn(window, 'open').mockReturnValue({
      closed: false,
      document: { write: vi.fn(), close: vi.fn(), readyState: 'loading' },
      focus: vi.fn(),
      print,
      addEventListener: events.addEventListener.bind(events),
    } as unknown as Window);
    exportToPDF('Test', '![image](https://example.com/image.png)');
    expect(print).not.toHaveBeenCalled();
    events.dispatchEvent(new Event('load'));
    expect(print).toHaveBeenCalledOnce();
  });
});
