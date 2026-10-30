// App state: signals persisted to localStorage, with optional Skapi sync.

import { computed, effect, signal } from '@preact/signals';
import { DEFAULT_MODEL } from '../config';
import * as cloud from '../lib/cloud';
import { emptyTelemetry, mergeTelemetry, newId, normaliseTelemetry, PRACTICE_LOG_LIMIT } from '../lib/telemetry';
import type { EqTelemetry, Piece, PracticeRecord, Settings } from '../lib/types';

const KEYS = {
  telemetry: 'eq.telemetry.v1',
  settings: 'eq.settings.v1',
  apiKey: 'eq.openrouter_key',
  transcripts: 'eq.transcripts.v1',
  bank: 'eq.bank.v1',
  seenHelp: 'eq.seen_help.v1',
};

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
  } catch {
    /* storage full or blocked: keep running in memory */
  }
}

// ── Settings & key ──────────────────────────────────────

const defaultSettings: Settings = { theme: 'auto', lens: 'both', judge_model: DEFAULT_MODEL };

export const settings = signal<Settings>({ ...defaultSettings, ...load<Partial<Settings>>(KEYS.settings, {}) });
effect(() => save(KEYS.settings, settings.value));
export const updateSettings = (patch: Partial<Settings>) => (settings.value = { ...settings.value, ...patch });

export const apiKey = signal<string>((() => {
  try {
    return localStorage.getItem(KEYS.apiKey) ?? '';
  } catch {
    return '';
  }
})());
effect(() => {
  try {
    if (apiKey.value) localStorage.setItem(KEYS.apiKey, apiKey.value);
    else localStorage.removeItem(KEYS.apiKey);
  } catch {
    /* ignore */
  }
});

effect(() => {
  const t = settings.value.theme;
  const root = document.documentElement;
  if (t === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', t);
});

/** "How this works" notes open the first time each exercise type appears. */
export const seenHelp = signal<string[]>(load(KEYS.seenHelp, []));
effect(() => save(KEYS.seenHelp, seenHelp.value));
export const markHelpSeen = (id: string) => {
  if (!seenHelp.value.includes(id)) seenHelp.value = [...seenHelp.value, id];
};

// ── Telemetry ───────────────────────────────────────────

export const telemetry = signal<EqTelemetry>(normaliseTelemetry(load(KEYS.telemetry, null)));
effect(() => save(KEYS.telemetry, telemetry.value));

export const profile = signal<cloud.Profile | null>(null);
export const syncState = signal<{ status: 'off' | 'syncing' | 'synced' | 'error'; message?: string; at?: string }>({ status: 'off' });

let syncTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleSync() {
  if (!profile.value) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => void pushNow(), 4000);
}

async function pushNow() {
  if (!profile.value) return;
  syncState.value = { status: 'syncing' };
  try {
    await cloud.pushTelemetry({ ...telemetry.value, user_id: profile.value.user_id });
    syncState.value = { status: 'synced', at: new Date().toISOString() };
  } catch (e) {
    syncState.value = { status: 'error', message: cloud.errorMessage(e) };
  }
}

/** Pull the cloud copy, merge with local, push the result back. */
export async function syncNow() {
  const p = profile.value;
  if (!p) return;
  syncState.value = { status: 'syncing' };
  try {
    const remoteRaw = await cloud.pullTelemetry(p.user_id);
    const local = telemetry.value;
    telemetry.value = remoteRaw ? mergeTelemetry(local, normaliseTelemetry(remoteRaw, p.user_id), p.user_id) : { ...local, user_id: p.user_id };
    await cloud.pushTelemetry(telemetry.value);
    syncState.value = { status: 'synced', at: new Date().toISOString() };
  } catch (e) {
    syncState.value = { status: 'error', message: cloud.errorMessage(e) };
  }
}

const touch = (patch: Partial<EqTelemetry>) => {
  telemetry.value = { ...telemetry.value, ...patch, updated_at: new Date().toISOString() };
  scheduleSync();
};

export function logPractice(r: Omit<PracticeRecord, 'id' | 'date'>) {
  const full: PracticeRecord = { ...r, id: newId(r.exercise), date: new Date().toISOString() };
  touch({ practice_log: [...telemetry.value.practice_log, full].slice(-PRACTICE_LOG_LIMIT) });
}

export function savePiece(p: Omit<Piece, 'id' | 'date' | 'updated_at'>): Piece {
  const now = new Date().toISOString();
  const full: Piece = { ...p, id: newId('piece'), date: now, updated_at: now };
  touch({ pieces: [...telemetry.value.pieces, full] });
  return full;
}

export function updatePiece(id: string, patch: Partial<Omit<Piece, 'id' | 'date'>>) {
  const now = new Date().toISOString();
  touch({ pieces: telemetry.value.pieces.map((p) => (p.id === id ? { ...p, ...patch, updated_at: now } : p)) });
}

export function deletePiece(id: string) {
  touch({ pieces: telemetry.value.pieces.filter((p) => p.id !== id), deleted: [...telemetry.value.deleted, id] });
}

export function resetProgress() {
  const t = telemetry.value;
  // Keep tombstones for every piece, so a synced copy can't bring them back.
  touch({ ...emptyTelemetry(profile.value?.user_id), deleted: [...new Set([...t.deleted, ...t.pieces.map((p) => p.id)])] });
}

// ── Transcripts of judge exchanges (local; mirrored to the cloud when signed in) ──

export interface StoredTranscript {
  id: string;
  date: string;
  exercise: string;
  text: string;
  aim?: string;
  reply: unknown;
}

export const transcripts = signal<StoredTranscript[]>(load(KEYS.transcripts, []));
effect(() => save(KEYS.transcripts, transcripts.value.slice(-40)));

export function storeTranscript(t: StoredTranscript) {
  transcripts.value = [...transcripts.value.filter((x) => x.id !== t.id), t];
  const p = profile.value;
  if (p) cloud.pushTranscript(p.user_id, t.id, t).catch(() => undefined);
}

// ── Accounts ────────────────────────────────────────────

export async function initAccount() {
  profile.value = await cloud.currentProfile();
  if (profile.value) await syncNow();
}

export async function loginAndSync(email: string, password: string) {
  profile.value = await cloud.login(email, password);
  await syncNow();
}

export async function signupAndSync(email: string, password: string, name?: string) {
  profile.value = await cloud.signup(email, password, name);
  if (profile.value) await syncNow();
}

export async function logoutAndKeepLocal() {
  await pushNow();
  await cloud.logout();
  cloud.resetTelemetryRecordCache();
  profile.value = null;
  syncState.value = { status: 'off' };
  telemetry.value = { ...telemetry.value, user_id: 'local_anon' };
}

export const isAdmin = computed(() => cloud.isAdmin(profile.value));

// ── Content bank (admin-curated; empty until the Admin studio publishes) ──

export const bank = signal<cloud.CloudItem[]>(load(KEYS.bank, []));
effect(() => save(KEYS.bank, bank.value));

export async function refreshBank() {
  try {
    const extra = isAdmin.value && profile.value ? [profile.value.user_id] : [];
    bank.value = await cloud.fetchBank(extra);
  } catch {
    /* offline or project unavailable: keep cached */
  }
}

// ── Export / import ─────────────────────────────────────

export function exportJson(): string {
  return JSON.stringify(
    { app: 'eloquacity', version: 1, exported_at: new Date().toISOString(), telemetry: telemetry.value, transcripts: transcripts.value, settings: settings.value },
    null,
    2,
  );
}

/** Import merges rather than overwrites, so nothing local is lost. API keys are never exported or imported. */
export function importJson(text: string) {
  const data = JSON.parse(text);
  if (data?.app && data.app !== 'eloquacity') throw new Error(`that file is from ${data.app}, not Eloquacity`);
  const incoming = normaliseTelemetry(data?.telemetry ?? data, telemetry.value.user_id);
  telemetry.value = mergeTelemetry(telemetry.value, incoming, telemetry.value.user_id);
  if (Array.isArray(data?.transcripts)) {
    const byId = new Map(transcripts.value.map((t) => [t.id, t]));
    for (const t of data.transcripts) if (t?.id) byId.set(t.id, t);
    transcripts.value = [...byId.values()];
  }
  scheduleSync();
}
