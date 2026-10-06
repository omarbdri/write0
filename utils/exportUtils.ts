import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { normalizeMarkdownForNestedLists } from './markdownUtils';

/** Use the same safe Markdown renderer as the preview, including GFM. */
export function renderMarkdownHTML(content: string): string {
  return renderToStaticMarkup(
    createElement(ReactMarkdown, {
      remarkPlugins: [remarkGfm],
      children: normalizeMarkdownForNestedLists(content),
    }),
  );
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function toSafeFilename(title: string, fallbackBaseName: string): string {
  const base = title.trim() || fallbackBaseName;
  // Windows reserved characters: <>:"/\|?*
  const sanitized = base
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '_')
    .replace(/\.+$/g, '')
    .trim();
  return sanitized.length > 0 ? sanitized : fallbackBaseName;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    a.click();
  } finally {
    // Keep the URL alive until the browser has started the download.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/**
 * Builds a complete HTML document optimized for printing/PDF export.
 */
export const buildPrintHTML = (title: string, htmlContent: string): string => {
  const escapedTitle = escapeHtml(title);
  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${escapedTitle}</title>
<style>
/* Page setup for printing - larger margins to accommodate browser chrome */
@page {
    size: A4;
    margin: 25mm 20mm 25mm 20mm;
}

@media print {
    body {
    margin: 0 !important;
    padding: 0 !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
    }
}

/* Base styles */
* {
    box-sizing: border-box;
}

body {
    font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    color: #374151;
    line-height: 1.75;
    font-size: 12pt;
    max-width: 100%;
    margin: 0;
    padding: 0;
}

/* Title */
.document-title {
    font-size: 24pt;
    font-weight: 700;
    color: #111827;
    text-align: center;
    margin-bottom: 24pt;
    padding-bottom: 12pt;
    border-bottom: 1px solid #e5e7eb;
}

/* Headings */
h1, h2, h3, h4, h5, h6 {
    color: #111827;
    font-weight: 700;
    line-height: 1.3;
    margin-top: 1.5em;
    margin-bottom: 0.5em;
    page-break-after: avoid;
}
h1 { font-size: 2em; }
h2 { font-size: 1.5em; }
h3 { font-size: 1.25em; }
h4 { font-size: 1.1em; }
h5 { font-size: 1em; }
h6 { font-size: 0.9em; font-style: italic; }

/* Body text */
p {
    margin-top: 0.75em;
    margin-bottom: 0.75em;
    orphans: 3;
    widows: 3;
}

/* Links */
a {
    color: #2563eb;
    text-decoration: underline;
}

/* Lists */
ul, ol {
    margin-top: 0.75em;
    margin-bottom: 0.75em;
    padding-left: 1.5em;
}
li {
    margin-top: 0.25em;
    margin-bottom: 0.25em;
}
li > p {
    margin: 0;
    display: inline;
}

/* Blockquotes */
blockquote {
    font-style: italic;
    color: #4b5563;
    border-left: 4px solid #d1d5db;
    margin: 1em 0;
    padding-left: 1em;
    page-break-inside: avoid;
}

/* Code */
code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.9em;
    background-color: #f3f4f6;
    padding: 0.15em 0.3em;
    border-radius: 3px;
}

pre {
    background-color: #1f2937;
    color: #e5e7eb;
    padding: 12pt;
    border-radius: 6px;
    overflow-x: auto;
    font-size: 0.85em;
    line-height: 1.5;
    page-break-inside: avoid;
    margin: 1em 0;
}

pre code {
    background: none;
    padding: 0;
    color: inherit;
}

/* Tables */
table {
    width: 100%;
    border-collapse: collapse;
    margin: 1em 0;
    font-size: 0.9em;
    page-break-inside: avoid;
}

thead {
    background-color: #f9fafb;
}

th, td {
    border: 1px solid #d1d5db;
    padding: 8pt 10pt;
    text-align: left;
}

th {
    font-weight: 600;
    color: #111827;
}

/* Horizontal rule */
hr {
    border: none;
    border-top: 1px solid #e5e7eb;
    margin: 2em 0;
}

/* Images */
img {
    max-width: 100%;
    height: auto;
    page-break-inside: avoid;
}

/* Strikethrough */
del, s, strike {
    text-decoration: line-through;
}

/* When exporting HTML (not printing), add comfortable page padding */
@media screen {
  body {
    padding: 24px;
    max-width: 900px;
    margin-left: auto;
    margin-right: auto;
  }
}
</style>
</head>
<body>
<div class="document-title">${escapedTitle}</div>
${htmlContent}
</body>
</html>`;
};

export const exportToHTML = (title: string, content: string) => {
  try {
    const htmlContent = renderMarkdownHTML(content);
    const html = buildPrintHTML(title, htmlContent);
    const fileBase = toSafeFilename(title, 'document');
    downloadBlob(new Blob([html], { type: 'text/html' }), `${fileBase}.html`);
  } catch (error) {
    console.error('Failed to export HTML:', error);
    alert('Export failed while generating HTML. See console for details.');
  }
};

export const exportToText = (title: string, content: string) => {
  try {
    const fileBase = toSafeFilename(title, 'document');
    downloadBlob(new Blob([content], { type: 'text/plain' }), `${fileBase}.md`);
  } catch (error) {
    console.error('Failed to export Markdown:', error);
    alert('Export failed while generating Markdown. See console for details.');
  }
};

export const exportToPDF = (
  title: string,
  content: string,
  printWindow: Window | null = window.open('', '_blank', 'width=800,height=600'),
) => {
  try {
    const htmlContent = renderMarkdownHTML(content);

    // Build full HTML document with print-optimized styles
    const printHTML = buildPrintHTML(title, htmlContent);

    // Open in new window and trigger print dialog
    if (!printWindow) {
      alert('Popup was blocked. Allow popups for this site to export PDF (Print).');
      return;
    }

    printWindow.opener = null;
    printWindow.document.write(printHTML);
    printWindow.document.close();

    let hasPrinted = false;
    const triggerPrint = () => {
      if (hasPrinted || printWindow.closed) return;
      hasPrinted = true;
      try {
        printWindow.focus();
        printWindow.print();
      } catch (error) {
        console.error('Failed to trigger print dialog:', error);
        alert('Export failed while opening the print dialog. See console for details.');
      }
    };

    // Wait for content to load before printing
    printWindow.addEventListener('load', triggerPrint, { once: true });
    // document.close() may finish loading before the listener is installed.
    if (printWindow.document.readyState === 'complete') triggerPrint();
  } catch (error) {
    console.error('Failed to export PDF:', error);
    alert('Export failed while generating PDF (Print). See console for details.');
  }
};
