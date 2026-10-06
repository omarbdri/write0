import { PastedRange } from '../types';

/** Map surviving pasted text through a replacement; newly typed text stays unmarked. */
export function updatePastedRanges(
  ranges: PastedRange[],
  start: number,
  deletedLength: number,
  insertedLength: number,
): PastedRange[] {
  const end = start + deletedLength;
  const delta = insertedLength - deletedLength;
  return ranges.flatMap((range) => {
    if (range.end <= start) return [range];
    if (range.start >= end) return [{ start: range.start + delta, end: range.end + delta }];
    const parts: PastedRange[] = [];
    if (range.start < start) parts.push({ start: range.start, end: start });
    if (range.end > end) parts.push({ start: start + insertedLength, end: range.end + delta });
    return parts;
  });
}

/** Compare the actual values so IME, autocorrect, and word deletion use the same path. */
export function getTextChange(previous: string, next: string, caret: number) {
  // Prefer the actual caret boundary, which disambiguates edits in repeated text.
  let end = Math.max(0, Math.min(caret, next.length));
  let previousEnd = end + previous.length - next.length;
  if (previousEnd < 0 || previous.slice(previousEnd) !== next.slice(end)) {
    end = next.length;
    previousEnd = previous.length;
    while (end > 0 && previousEnd > 0 && next[end - 1] === previous[previousEnd - 1]) {
      end--;
      previousEnd--;
    }
  }
  let start = 0;
  while (start < end && start < previousEnd && previous[start] === next[start]) start++;
  return { start, deletedLength: previousEnd - start, insertedLength: end - start };
}

/** Build highlight segments from boundaries rather than searching ranges for every character. */
export function getPastedSegments(text: string, offset: number, ranges: PastedRange[]) {
  const segments: Array<{ text: string; isPasted: boolean }> = [];
  const sorted = ranges
    .filter((range) => range.end > offset && range.start < offset + text.length)
    .map((range) => ({
      start: Math.max(0, range.start - offset),
      end: Math.min(text.length, range.end - offset),
    }))
    .sort((a, b) => a.start - b.start);
  let cursor = 0;
  for (const range of sorted) {
    if (range.end <= cursor) continue;
    if (range.start > cursor)
      segments.push({ text: text.slice(cursor, range.start), isPasted: false });
    segments.push({ text: text.slice(Math.max(cursor, range.start), range.end), isPasted: true });
    cursor = range.end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), isPasted: false });
  return segments;
}
