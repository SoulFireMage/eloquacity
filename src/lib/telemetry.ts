// Pure telemetry operations: normalising and merging local and cloud copies.
// Merges are unions: nothing on either side is lost, except what a tombstone deletes.

import type { EqTelemetry, Piece, PracticeRecord } from './types';

export const PRACTICE_LOG_LIMIT = 2000;

export function emptyTelemetry(userId = 'local_anon'): EqTelemetry {
  return { version: 1, user_id: userId, pieces: [], practice_log: [], deleted: [], updated_at: new Date(0).toISOString() };
}

const arr = <T>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]) : []);

/** Accept anything (old exports, partial cloud records) and return a well-formed telemetry object. */
export function normaliseTelemetry(raw: unknown, userId = 'local_anon'): EqTelemetry {
  const t = raw && typeof raw === 'object' ? (raw as Partial<EqTelemetry>) : {};
  return {
    version: 1,
    user_id: typeof t.user_id === 'string' ? t.user_id : userId,
    pieces: arr<Piece>(t.pieces).filter((p) => p && typeof p.id === 'string' && typeof p.text === 'string'),
    practice_log: arr<PracticeRecord>(t.practice_log).filter((r) => r && typeof r.id === 'string'),
    deleted: arr<string>(t.deleted).filter((x) => typeof x === 'string'),
    updated_at: typeof t.updated_at === 'string' ? t.updated_at : new Date(0).toISOString(),
  };
}

const later = (a: string, b: string) => (a >= b ? a : b);

export function mergeTelemetry(a: EqTelemetry, b: EqTelemetry, userId: string): EqTelemetry {
  const deleted = [...new Set([...a.deleted, ...b.deleted])];
  const gone = new Set(deleted);

  const pieces = new Map<string, Piece>();
  for (const p of [...a.pieces, ...b.pieces]) {
    if (gone.has(p.id)) continue;
    const prev = pieces.get(p.id);
    if (!prev || (p.updated_at ?? p.date) > (prev.updated_at ?? prev.date)) pieces.set(p.id, p);
  }

  const log = new Map<string, PracticeRecord>();
  for (const r of [...a.practice_log, ...b.practice_log]) log.set(r.id, r);

  return {
    version: 1,
    user_id: userId,
    pieces: [...pieces.values()].sort((x, y) => x.date.localeCompare(y.date)),
    practice_log: [...log.values()].sort((x, y) => x.date.localeCompare(y.date)).slice(-PRACTICE_LOG_LIMIT),
    deleted,
    updated_at: later(a.updated_at, b.updated_at),
  };
}

export const newId = (prefix: string, now = Date.now()) => `${prefix}_${now.toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
