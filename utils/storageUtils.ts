export const STORAGE_KEYS = {
  documents: 'write0_docs',
  activeDocumentId: 'write0_active',
  settings: 'write0_settings',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

export function readJson<T>(key: StorageKey, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(
  key: StorageKey,
  value: unknown,
): { ok: true } | { ok: false; reason: 'unavailable' | 'quota' | 'unknown' } {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return { ok: true };
  } catch (error) {
    const maybeDomException = error as { name?: string };
    if (maybeDomException?.name === 'SecurityError') {
      return { ok: false, reason: 'unavailable' };
    }
    if (maybeDomException?.name === 'QuotaExceededError') {
      return { ok: false, reason: 'quota' };
    }
    return { ok: false, reason: 'unknown' };
  }
}
