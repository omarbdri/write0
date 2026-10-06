import { useEffect, useLayoutEffect, useRef } from 'react';
import { StorageKey, writeJson } from '../utils/storageUtils';

type SaveResult = ReturnType<typeof writeJson>;

/** Debounce writes, but flush the latest state when the page leaves the foreground. */
export function usePersistentStorage(
  key: StorageKey,
  value: unknown,
  onResult: (result: SaveResult, key: StorageKey) => void,
) {
  const latestRef = useRef({ value, onResult });
  const timeoutRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    latestRef.current = { value, onResult };
  }, [value, onResult]);

  useEffect(() => {
    const save = () => {
      const result = writeJson(key, latestRef.current.value);
      latestRef.current.onResult(result, key);
    };
    timeoutRef.current = window.setTimeout(save, 250);
    return () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    };
  }, [key, value]);

  useEffect(() => {
    const flush = () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
      const result = writeJson(key, latestRef.current.value);
      latestRef.current.onResult(result, key);
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', handleVisibility);
      flush();
    };
  }, [key]);
}
