/**
 * Normalizes markdown so that a bulleted list placed "between" ordered list items
 * is treated as a nested list under the preceding ordered item.
 *
 * Example input:
 * 2. Parent
 *
 * - Child
 * - Child
 *
 * 3. Next
 *
 * Output (children indented):
 * 2. Parent
 *
 *     - Child
 *     - Child
 *
 * 3. Next
 */
export function normalizeMarkdownForNestedLists(markdown: string): string {
  const lines = markdown.split(/\r?\n/);

  let fence: { marker: string; length: number } | null = null;
  let orderedIndent = 4;
  let lastNonEmptyWasTopLevelOrderedItem = false;
  let nestingBulletBlock = false;

  const isTopLevelOrderedItem = (line: string) => /^\d+\.\s+/.test(line);
  const isTopLevelBulletItem = (line: string) => /^[-*+]\s+/.test(line);
  const isAnyListLine = (line: string) => /^\s*(\d+\.|[-*+])\s+/.test(line);

  const out: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const fenceMatch = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (fence) {
      if (
        fenceMatch &&
        fenceMatch[1][0] === fence.marker &&
        fenceMatch[1].length >= fence.length &&
        fenceMatch[2].trim() === ''
      )
        fence = null;
      out.push(line);
      continue;
    }
    if (fenceMatch) {
      fence = { marker: fenceMatch[1][0], length: fenceMatch[1].length };
      nestingBulletBlock = false;
      lastNonEmptyWasTopLevelOrderedItem = false;
      out.push(line);
      continue;
    }

    if (isTopLevelOrderedItem(line)) orderedIndent = Math.max(4, /^\d+\.\s+/.exec(line)![0].length);

    const trimmed = line.trim();

    // End nesting as soon as we hit the next top-level ordered list item.
    if (nestingBulletBlock && isTopLevelOrderedItem(line)) {
      nestingBulletBlock = false;
      lastNonEmptyWasTopLevelOrderedItem = true;
      out.push(line);
      continue;
    }

    // Start nesting when a top-level bullet list appears after a top-level ordered item.
    if (!nestingBulletBlock && isTopLevelBulletItem(line) && lastNonEmptyWasTopLevelOrderedItem) {
      nestingBulletBlock = true;
    }

    if (
      nestingBulletBlock &&
      trimmed &&
      !isAnyListLine(line) &&
      /^\S/.test(line) &&
      (i === 0 || lines[i - 1].trim() === '')
    ) {
      nestingBulletBlock = false;
      lastNonEmptyWasTopLevelOrderedItem = false;
    }

    if (nestingBulletBlock) {
      // Move the whole block, preserving child indentation relative to its parent.
      out.push(trimmed === '' ? '' : `${' '.repeat(orderedIndent)}${line}`);

      // If we hit a non-list, non-empty line at top level, stop nesting.
      // This prevents accidentally nesting paragraphs unrelated to the list.
      if (trimmed !== '' && !isAnyListLine(line) && /^\S/.test(line)) {
        nestingBulletBlock = false;
        lastNonEmptyWasTopLevelOrderedItem = false;
      }

      continue;
    }

    // Track whether the last non-empty line was a top-level ordered item.
    if (trimmed !== '') {
      lastNonEmptyWasTopLevelOrderedItem = isTopLevelOrderedItem(line);
    }

    out.push(line);
  }

  return out.join('\n');
}
