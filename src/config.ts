// Public configuration. The Skapi project ID is not a secret: it identifies the
// project, and what each user may read or write is enforced by Skapi itself.

/** Shared with The Rhetoric Forge, so one account signs into both sites. */
export const SKAPI_PROJECT_ID = '5GJ5SJePWQUiq0jvYr-2ZVgaOLUqOhnse3Hcl8M4d';

/**
 * Skapi user IDs whose published content is trusted as the global bank.
 * Anyone can post a public record, so the app only reads bank items uploaded by these accounts.
 */
export const ADMIN_USER_IDS: string[] = ['a149c0de-50e1-705d-4ec6-ffb00db55464'];

/** Skapi access group at or above which a signed-in user may open the Admin Studio. */
export const ADMIN_ACCESS_GROUP = 90;

// Eloquacity's own tables. Never touch the Forge's (drill_bank, telemetry,
// salle_transcripts) or the Starship Whisperer's (starlog).
export const TABLES = {
  bank: 'eq_bank',
  telemetry: 'eq_telemetry',
  transcripts: 'eq_transcripts',
} as const;

export const DEFAULT_MODEL = 'anthropic/claude-haiku-4.5';
export const APP_TITLE = 'Eloquacity';
export const FORGE_URL = 'https://soulfiremage.github.io/rhetoric-salle/';
