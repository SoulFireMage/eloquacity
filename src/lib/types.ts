import type { CadenceSnapshot } from './cadence';

/** Which explanation to show: pattern-first (Kat), step-by-step (Richard), or both. */
export type Lens = 'kat' | 'richard' | 'both';

export interface Settings {
  theme: 'auto' | 'light' | 'dark';
  lens: Lens;
  judge_model: string;
}

export type ExerciseKind = 'free_desk';

/** AI notes on a piece, built to the §5 rules: target-relative, specific, no rewrites. */
export interface JudgeNotes {
  model: string;
  aim: string;
  /** Plain-words paraphrases of the hardest sentences: the comprehension test for clarity. */
  paraphrases: { sentence: string; paraphrase: string; matched?: boolean }[];
  strongest: { quote: string; why: string };
  weakest: { quote: string; why: string };
  /** Does it hit the stated aim? One or two sentences, relative to the aim only. */
  aim_note: string;
  /** Short checklist answers (aim-relative), each yes/partly/no. */
  checklist: { item: string; answer: 'yes' | 'partly' | 'no' }[];
}

export interface Piece {
  id: string;
  date: string;
  updated_at: string;
  kind: ExerciseKind;
  title: string;
  text: string;
  /** Earlier version, for before/after pairs. */
  before?: string;
  aim?: string;
  cadence: CadenceSnapshot;
  notes?: JudgeNotes;
  /** Self-check ticks, when judged without a key. */
  self_check?: string[];
}

/** One practice event, for the Range Map and trends. */
export interface PracticeRecord {
  id: string;
  date: string;
  exercise: ExerciseKind;
  judged: 'ai' | 'self' | 'none';
  cadence?: CadenceSnapshot;
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
