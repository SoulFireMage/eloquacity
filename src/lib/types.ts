import type { CadenceSnapshot } from './cadence';

/** Which explanation to show: pattern-first (Kat), step-by-step (Richard), or both. */
export type Lens = 'kat' | 'richard' | 'both';

export interface Settings {
  theme: 'auto' | 'light' | 'dark';
  lens: Lens;
  judge_model: string;
}

export type ExerciseKind = 'free_desk' | 'shapeshifter' | 'ladder_grow' | 'ladder_shrink' | 'register_dial' | 'imitation' | 'restore';

export type Answer = 'yes' | 'partly' | 'no';

/**
 * The writer's verdict on a paraphrase: it matched what they meant, it misread them,
 * or the ambiguity is deliberate (the judge can't know intent, so that call is theirs).
 */
export type ParaphraseVerdict = 'matched' | 'misread' | 'ambiguous';

export interface Paraphrase {
  sentence: string;
  paraphrase: string;
  verdict?: ParaphraseVerdict;
  /** Phase 1 records stored a boolean; read through `verdictOf`. */
  matched?: boolean;
}

export const verdictOf = (p: Paraphrase): ParaphraseVerdict | undefined =>
  p.verdict ?? (p.matched === true ? 'matched' : p.matched === false ? 'misread' : undefined);

export interface Quoted {
  quote: string;
  why: string;
}

/** AI notes on a piece, built to the §5 rules: target-relative, specific, no rewrites. */
export interface JudgeNotes {
  model: string;
  aim: string;
  /** Plain-words paraphrases of the hardest sentences: the comprehension test for clarity. */
  paraphrases: Paraphrase[];
  strongest: Quoted;
  weakest: Quoted;
  /** Does it hit the stated aim? One or two sentences, relative to the aim only. */
  aim_note: string;
  /** Short checklist answers (aim-relative). */
  checklist: { item: string; answer: Answer }[];
}

export interface LadderNotes {
  model: string;
  heart: string;
  rungs: { alive: Answer; heart_kept: Answer; why: string }[];
  paraphrase: Paraphrase;
  strongest: Quoted;
  weakest: Quoted;
}

export interface ImitationNotes {
  model: string;
  clause_order: { answer: Answer; note: string };
  pauses: { answer: Answer; note: string };
  weight: { answer: Answer; note: string };
  own_subject: Answer;
  paraphrase: Paraphrase;
  strongest: Quoted;
  weakest: Quoted;
}

export interface DialRewriteNotes {
  setting: 1 | 2 | 4 | 5;
  register_hit: Answer;
  under_control: Answer;
  note: string;
  /** Blind paraphrase; the writer compares it with the source paragraph. */
  paraphrase: Paraphrase;
  strongest: Quoted;
  weakest: Quoted;
}

export interface DialNotes {
  model: string;
  rewrites: DialRewriteNotes[];
}

export interface Piece {
  id: string;
  date: string;
  updated_at: string;
  kind: ExerciseKind;
  title: string;
  text: string;
  /** Earlier version or starting point, for before/after pairs. */
  before?: string;
  aim?: string;
  cadence: CadenceSnapshot;
  notes?: JudgeNotes;
  /** Self-check ticks, when judged without a key. */
  self_check?: string[];
  /** Exercise details: target shape, dial setting, source passage. */
  meta?: { target?: string; register?: number; passage?: string; source?: string };
}

/** One practice event, for the Range Map and trends. */
export interface PracticeRecord {
  id: string;
  date: string;
  exercise: ExerciseKind;
  judged: 'ai' | 'self' | 'none';
  cadence?: CadenceSnapshot;
  /** Shapeshifter target id. */
  shape?: string;
  /** Register Dial settings attempted. */
  registers?: number[];
  /** Passage id from the bank. */
  passage?: string;
  /** Deterministic result where there is one (shape met, rungs in range, pauses shared…), 0–1. */
  score?: number;
}

export interface EqTelemetry {
  version: 1;
  user_id: string;
  pieces: Piece[];
  practice_log: PracticeRecord[];
  /** Tombstones, so a piece deleted on one device stays deleted after a merge. */
  deleted: string[];
  updated_at: string;
}
