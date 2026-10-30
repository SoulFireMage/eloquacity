import { useEffect, useRef, useState } from 'preact/hooks';
import type { PracticeRecord } from '../lib/types';
import { logPractice } from '../state/store';

/** Draft state for an exercise page, kept in localStorage so a reload doesn't lose work. */
export function useDraft<T extends object>(key: string, init: () => T): [T, (patch: Partial<T>) => void, (next: T) => void] {
  const [d, setD] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? { ...init(), ...JSON.parse(saved) } : init();
    } catch {
      return init();
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(d));
    } catch {
      /* ignore */
    }
  }, [d]);
  return [d, (patch) => setD((prev) => ({ ...prev, ...patch })), setD];
}

/**
 * Log at most one practice record per attempt and judging mode (AI notes, self-check).
 * A plain save logs only if nothing else has for that attempt.
 */
export function useAttemptLog() {
  const done = useRef<Set<string>>(new Set());
  const log = (attempt: string, r: Omit<PracticeRecord, 'id' | 'date'>) => {
    const k = `${attempt}:${r.judged}`;
    if (done.current.has(k) || (r.judged === 'none' && [...done.current].some((x) => x.startsWith(`${attempt}:`)))) return;
    done.current.add(k);
    logPractice(r);
  };
  return log;
}

export function SaveButton({ onSave, disabled, label = 'Save to portfolio' }: { onSave: () => void; disabled?: boolean; label?: string }) {
  const [saved, setSaved] = useState(false);
  return (
    <button class="btn-primary" disabled={disabled || saved} onClick={() => { onSave(); setSaved(true); }}>
      {saved ? 'Saved' : label}
    </button>
  );
}

/** Fresh attempt id, so the log and the save button reset when a new item is dealt. */
export const attemptId = () => Math.random().toString(36).slice(2, 9);
