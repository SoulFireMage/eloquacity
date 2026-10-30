// Skapi: optional accounts, telemetry sync, judge transcripts and the global content bank.
// Nothing here is required for the app to work; every call degrades to local-only.

import type { Skapi } from 'skapi-js';
import { ADMIN_ACCESS_GROUP, ADMIN_USER_IDS, SKAPI_PROJECT_ID, TABLES } from '../config';
import type { EqTelemetry } from './types';

export interface Profile {
  user_id: string;
  email?: string;
  name?: string;
  access_group: number;
}

// Loaded lazily so the SDK stays out of the main bundle until it's needed.
let instance: Promise<Skapi> | null = null;
export function skapi(): Promise<Skapi> {
  if (!instance) instance = import('skapi-js').then(({ Skapi }) => new Skapi(SKAPI_PROJECT_ID));
  return instance;
}

const toProfile = (p: any): Profile | null =>
  p ? { user_id: p.user_id, email: p.email, name: p.name, access_group: Number(p.access_group ?? 0) } : null;

export const errorMessage = (e: unknown) =>
  (e && typeof e === 'object' && 'message' in e ? String((e as any).message) : String(e)) || 'Unknown error';

export async function currentProfile(): Promise<Profile | null> {
  try {
    return toProfile(await (await skapi()).getProfile());
  } catch {
    return null;
  }
}

export async function login(email: string, password: string): Promise<Profile> {
  return toProfile(await (await skapi()).login({ email, password }))!;
}

export async function signup(email: string, password: string, name?: string): Promise<Profile | null> {
  const res = await (await skapi()).signup({ email, password, ...(name ? { name } : {}) }, { login: true });
  return typeof res === 'object' ? toProfile(res) : currentProfile();
}

export async function logout(): Promise<void> {
  await (await skapi()).logout();
}

export async function forgotPassword(email: string): Promise<void> {
  await (await skapi()).forgotPassword({ email });
}

export async function resetPassword(email: string, code: string, new_password: string): Promise<void> {
  await (await skapi()).resetPassword({ email, code, new_password });
}

export const isAdmin = (p: Profile | null) =>
  !!p && (p.access_group >= ADMIN_ACCESS_GROUP || ADMIN_USER_IDS.includes(p.user_id));

// ── Telemetry ────────────────────────────────────────────

const telemetryUid = (userId: string) => `eq_telemetry_${userId}`;

async function fetchByUniqueId(unique_id: string): Promise<any | null> {
  try {
    const res = await (await skapi()).getRecords({ unique_id });
    return res?.list?.[0] ?? null;
  } catch (e: any) {
    if (e?.code === 'NOT_EXISTS' || /not.*exist|not found/i.test(errorMessage(e))) return null;
    throw e;
  }
}

export async function pullTelemetry(userId: string): Promise<EqTelemetry | null> {
  const rec = await fetchByUniqueId(telemetryUid(userId));
  return (rec?.data as EqTelemetry) ?? null;
}

let telemetryRecordId: string | null = null;

export async function pushTelemetry(t: EqTelemetry): Promise<void> {
  const unique_id = telemetryUid(t.user_id);
  if (!telemetryRecordId) telemetryRecordId = (await fetchByUniqueId(unique_id))?.record_id ?? null;
  const rec = telemetryRecordId
    ? await (await skapi()).postRecord(t, { record_id: telemetryRecordId })
    : await (await skapi()).postRecord(t, { unique_id, table: { name: TABLES.telemetry, access_group: 'private' } });
  telemetryRecordId = rec.record_id;
}

export function resetTelemetryRecordCache() {
  telemetryRecordId = null;
}

export async function pushTranscript(userId: string, id: string, transcript: unknown): Promise<void> {
  await (await skapi()).postRecord(
    { id, transcript },
    { unique_id: `eq_transcript_${userId}_${id}`, table: { name: TABLES.transcripts, access_group: 'private' } },
  );
}

// ── Global content bank ─────────────────────────────

/** A curated item (a passage, a verse line, an exercise prompt). Its shape depends on `kind`. */
export interface BankItem {
  id: string;
  kind: string;
  tags?: string[];
  [key: string]: unknown;
}

export interface CloudItem {
  record_id: string;
  item: BankItem;
}

async function listAll(query: Parameters<Skapi['getRecords']>[0]): Promise<any[]> {
  const out: any[] = [];
  let res = await (await skapi()).getRecords(query, { limit: 100 });
  out.push(...(res?.list ?? []));
  while (res && !res.endOfList && out.length < 2000) {
    res = await (await skapi()).getRecords(query, { limit: 100, fetchMore: true });
    out.push(...(res?.list ?? []));
  }
  return out;
}

/** Items published by trusted admin accounts only (anyone can post public records). */
export async function fetchBank(extraTrusted: string[] = []): Promise<CloudItem[]> {
  const trusted = [...new Set([...ADMIN_USER_IDS, ...extraTrusted])];
  const out: CloudItem[] = [];
  for (const user_id of trusted) {
    const list = await listAll({ table: TABLES.bank, reference: { user_id } });
    for (const r of list) {
      if (r?.data && typeof r.data === 'object' && typeof r.data.id === 'string' && typeof r.data.kind === 'string') {
        out.push({ record_id: r.record_id, item: r.data as BankItem });
      }
    }
  }
  return out;
}

export async function publishBankItem(item: BankItem, existingRecordId?: string): Promise<string> {
  const rec = existingRecordId
    ? await (await skapi()).postRecord(item, { record_id: existingRecordId })
    : await (await skapi()).postRecord(item, {
        unique_id: `eq_bank_${item.id}`,
        table: { name: TABLES.bank, access_group: 'public' },
        tags: [item.kind, ...(item.tags ?? [])].slice(0, 5),
      });
  return rec.record_id;
}

export async function unpublishBankItem(record_id: string): Promise<void> {
  await (await skapi()).deleteRecords({ record_id } as any);
}
