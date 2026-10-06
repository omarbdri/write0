import { AppSettings, Document } from '../types';

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
  focusMode: false,
  typewriterMode: false,
  styleCheck: false,
  showPreview: false,
  showSidebar: true,
  highlightPastedText: true,
};

export function restoreSettings(saved: unknown): AppSettings {
  const settings = { ...DEFAULT_SETTINGS };
  if (!saved || typeof saved !== 'object') return settings;
  for (const key of Object.keys(settings) as Array<keyof AppSettings>) {
    const value = (saved as Record<string, unknown>)[key];
    if (key === 'theme') {
      if (value === 'light' || value === 'dark') settings.theme = value;
    } else if (typeof value === 'boolean') {
      settings[key] = value;
    }
  }
  return settings;
}

export function restoreDocuments(saved: unknown, fallback: Document[]): Document[] {
  if (!Array.isArray(saved)) return fallback;
  const ids = new Set<string>();
  const documents: Document[] = [];
  for (const doc of saved) {
    if (
      !doc ||
      typeof doc !== 'object' ||
      typeof doc.id !== 'string' ||
      !doc.id ||
      ids.has(doc.id) ||
      typeof doc.title !== 'string' ||
      typeof doc.content !== 'string' ||
      typeof doc.folderId !== 'string' ||
      typeof doc.updatedAt !== 'number' ||
      !Number.isFinite(doc.updatedAt)
    )
      return fallback;
    ids.add(doc.id);
    documents.push({
      ...doc,
      hasCustomTitle: doc.hasCustomTitle === true,
      pastedRanges: Array.isArray(doc.pastedRanges)
        ? doc.pastedRanges.filter((range: unknown) => {
            if (!range || typeof range !== 'object') return false;
            const { start, end } = range as { start?: number; end?: number };
            return (
              Number.isInteger(start) &&
              Number.isInteger(end) &&
              start >= 0 &&
              end > start &&
              end <= doc.content.length
            );
          })
        : [],
    });
  }
  return documents;
}
