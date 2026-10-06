import React from 'react';
import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { readJson, writeJson, STORAGE_KEYS } from '../utils/storageUtils';
import { DEFAULT_SETTINGS, restoreDocuments, restoreSettings } from '../utils/stateUtils';
import { usePersistentStorage } from '../hooks/usePersistentStorage';

describe('storage recovery', () => {
  it('reads existing writing even when storage cannot accept another write', () => {
    localStorage.setItem(STORAGE_KEYS.documents, JSON.stringify([{ content: 'Keep this' }]));
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Full', 'QuotaExceededError');
    });
    expect(readJson(STORAGE_KEYS.documents, [])).toEqual([{ content: 'Keep this' }]);
    expect(writeJson(STORAGE_KEYS.documents, [])).toEqual({ ok: false, reason: 'quota' });
  });

  it('does not cache storage errors permanently', () => {
    const write = vi.spyOn(Storage.prototype, 'setItem');
    write.mockImplementationOnce(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });
    expect(writeJson(STORAGE_KEYS.settings, {})).toEqual({ ok: false, reason: 'unavailable' });
    expect(writeJson(STORAGE_KEYS.settings, {})).toEqual({ ok: true });
  });

  it('handles malformed JSON and preserves a deliberately empty document list', () => {
    localStorage.setItem(STORAGE_KEYS.documents, '{');
    expect(readJson(STORAGE_KEYS.documents, ['fallback'])).toEqual(['fallback']);
    expect(restoreDocuments([], [{ id: 'fallback' } as never])).toEqual([]);
    expect(restoreDocuments([null], [])).toEqual([]);
  });

  it('merges older settings with defaults and ignores invalid values', () => {
    expect(restoreSettings({ theme: 'dark', focusMode: true, showSidebar: 'false' })).toEqual({
      ...DEFAULT_SETTINGS,
      theme: 'dark',
      focusMode: true,
    });
    expect(restoreSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it('drops invalid paste ranges without losing valid writing', () => {
    const doc = { id: 'a', title: 'A', content: 'abc', folderId: 'root', updatedAt: 1 };
    expect(
      restoreDocuments(
        [{ ...doc, pastedRanges: [null, { start: 0, end: 2 }, { start: -1, end: 10 }] }],
        [],
      ),
    ).toEqual([{ ...doc, hasCustomTitle: false, pastedRanges: [{ start: 0, end: 2 }] }]);
  });
});

describe('debounced persistence', () => {
  function Writer({ value }: { value: string }) {
    usePersistentStorage(STORAGE_KEYS.documents, value, () => {});
    return null;
  }

  it('flushes the latest edit on pagehide before the debounce expires', () => {
    vi.useFakeTimers();
    const view = render(<Writer value="first" />);
    view.rerender(<Writer value="latest" />);
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });
    expect(readJson(STORAGE_KEYS.documents, '')).toBe('latest');
  });

  it('debounces typing and flushes on unmount', () => {
    vi.useFakeTimers();
    const view = render(<Writer value="first" />);
    view.rerender(<Writer value="second" />);
    expect(localStorage.getItem(STORAGE_KEYS.documents)).toBeNull();
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(readJson(STORAGE_KEYS.documents, '')).toBe('second');
    view.rerender(<Writer value="third" />);
    view.unmount();
    expect(readJson(STORAGE_KEYS.documents, '')).toBe('third');
  });
});
