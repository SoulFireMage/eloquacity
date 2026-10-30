// The Cadence Strip's numbers: sentence lengths, spread, monotony runs, breath marks
// and echoes. Calculated in the browser, no AI. Nothing here is a score: it describes.

import { breathMarks, splitSentences, words, type BreathMark, type Sentence } from './sentences';

export interface SentenceShape extends Sentence {
  index: number;
  length: number;
  breaths: BreathMark[];
  /** First word, lowercased, for spotting same openings. */
  opener: string;
}

export interface Run {
  /** Index of the first sentence in the run. */
  from: number;
  /** Index of the last sentence in the run (inclusive). */
  to: number;
}

export interface EchoWord {
  sentence: number;
  word: string;
}

export interface Echo {
  stem: string;
  hits: EchoWord[];
}

export interface Opening {
  opener: string;
  sentences: number[];
}

export interface Cadence {
  sentences: SentenceShape[];
  words: number;
  shortest: number;
  longest: number;
  median: number;
  mean: number;
  /** Standard deviation of sentence lengths, in words. */
  sd: number;
  /** Coefficient of variation: sd / mean. 0 means every sentence is the same length. */
  cv: number;
  /** The longest stretch of similar-length sentences (null if there's no run of 3+). */
  monotony: Run | null;
  /** Every run of 3+ similar-length sentences. */
  runs: Run[];
  echoes: Echo[];
  openings: Opening[];
}

/** Sentences count as "similar" while the run's spread stays within this. */
export function similarSpan(min: number, max: number): boolean {
  return max - min <= Math.max(2, Math.round(max * 0.25));
}

export function monotonyRuns(lengths: number[], minRun = 3): Run[] {
  const runs: Run[] = [];
  let from = 0;
  while (from < lengths.length) {
    let lo = lengths[from];
    let hi = lengths[from];
    let to = from;
    while (to + 1 < lengths.length) {
      const nlo = Math.min(lo, lengths[to + 1]);
      const nhi = Math.max(hi, lengths[to + 1]);
      if (!similarSpan(nlo, nhi)) break;
      lo = nlo;
      hi = nhi;
      to++;
    }
    if (to - from + 1 >= minRun) {
      runs.push({ from, to });
      from = to + 1;
    } else from++;
  }
  return runs;
}

// Function words: repeating these is how English works, not an echo.
const STOP = new Set(
  ('a an the and or but nor so yet for of in on at to by with from as into onto upon over under about above below ' +
    'up down out off than then that this these those there here where when while what which who whom whose why how ' +
    'i me my mine we us our ours you your yours he him his she her hers it its they them their theirs ' +
    'is am are was were be been being have has had having do does did done not no yes all any some each every ' +
    'very too also just only even still such own same other more most much many few can could will would shall ' +
    'should may might must one ones if else s t d ll re ve m o oh mr mrs dr said says say')
    .split(' '),
);

/** A light suffix-stripper: walked / walking / walks → walk. Irregular forms (fell / fall) aren't matched. */
export function stem(word: string): string {
  let w = word.toLowerCase().replace(/[’']s$/, '').replace(/[’']/g, '');
  if (w.length <= 4) return w;
  for (const suf of ['ingly', 'edly', 'ness', 'ment', 'ings', 'ing', 'ies', 'ied', 'est', 'ers', 'ed', 'er', 'ly', 'es', 's']) {
    if (w.endsWith(suf) && w.length - suf.length >= 3) {
      w = w.slice(0, -suf.length);
      if (suf === 'ies' || suf === 'ied') w += 'y';
      break;
    }
  }
  // "running" → "runn" → "run"
  if (/([b-df-hj-np-tv-z])\1$/.test(w) && !/(ll|ss|ff|zz)$/.test(w)) w = w.slice(0, -1);
  return w;
}

/**
 * Content words repeated within a short window. Intentional repetition is fine:
 * these are shown, never penalised.
 */
export function findEchoes(shapes: { text: string; index: number }[], window = 40): Echo[] {
  const flat: { stem: string; word: string; sentence: number; pos: number }[] = [];
  let pos = 0;
  for (const s of shapes) {
    for (const w of words(s.text)) {
      const lw = w.toLowerCase();
      if (lw.length >= 3 && !STOP.has(lw) && !/^\d+$/.test(lw)) flat.push({ stem: stem(w), word: w, sentence: s.index, pos });
      pos++;
    }
  }
  const groups = new Map<string, typeof flat>();
  const lastSeen = new Map<string, number>();
  const out: Echo[] = [];
  const flush = (k: string) => {
    const g = groups.get(k);
    if (g && g.length >= 2) out.push({ stem: k, hits: g.map(({ word, sentence }) => ({ word, sentence })) });
    groups.delete(k);
  };
  for (const w of flat) {
    const last = lastSeen.get(w.stem);
    if (last !== undefined && w.pos - last > window) flush(w.stem);
    const g = groups.get(w.stem) ?? [];
    g.push(w);
    groups.set(w.stem, g);
    lastSeen.set(w.stem, w.pos);
  }
  for (const k of [...groups.keys()]) flush(k);
  return out.sort((a, b) => b.hits.length - a.hits.length || a.hits[0].sentence - b.hits[0].sentence);
}

/** Openers shared by two sentences no more than two apart ("The… The…", or anaphora). */
export function findOpenings(shapes: { opener: string; index: number }[]): Opening[] {
  const by = new Map<string, number[]>();
  for (const s of shapes) if (s.opener) by.set(s.opener, [...(by.get(s.opener) ?? []), s.index]);
  const out: Opening[] = [];
  for (const [opener, idx] of by) {
    if (idx.length < 2) continue;
    if (idx.some((v, i) => i > 0 && v - idx[i - 1] <= 2)) out.push({ opener, sentences: idx });
  }
  return out.sort((a, b) => b.sentences.length - a.sentences.length);
}

export function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function analyse(text: string): Cadence {
  const sentences: SentenceShape[] = splitSentences(text).map((s, index) => {
    const ws = words(s.text);
    return { ...s, index, length: ws.length, breaths: breathMarks(s.text), opener: (ws[0] ?? '').toLowerCase() };
  });
  const lengths = sentences.map((s) => s.length);
  const total = lengths.reduce((a, b) => a + b, 0);
  const n = lengths.length;
  const mean = n ? total / n : 0;
  const sd = n ? Math.sqrt(lengths.reduce((a, l) => a + (l - mean) ** 2, 0) / n) : 0;
  const runs = monotonyRuns(lengths);
  const monotony = runs.reduce<Run | null>((best, r) => (!best || r.to - r.from > best.to - best.from ? r : best), null);
  return {
    sentences,
    words: total,
    shortest: n ? Math.min(...lengths) : 0,
    longest: n ? Math.max(...lengths) : 0,
    median: median(lengths),
    mean,
    sd,
    cv: mean ? sd / mean : 0,
    monotony,
    runs,
    echoes: findEchoes(sentences),
    openings: findOpenings(sentences),
  };
}

export const runLength = (r: Run | null) => (r ? r.to - r.from + 1 : 0);

/** A compact snapshot for saving alongside a piece (enough to redraw trends without re-analysing). */
export interface CadenceSnapshot {
  sentences: number;
  words: number;
  sd: number;
  cv: number;
  longest_run: number;
}

export const snapshot = (c: Cadence): CadenceSnapshot => ({
  sentences: c.sentences.length,
  words: c.words,
  sd: Math.round(c.sd * 10) / 10,
  cv: Math.round(c.cv * 100) / 100,
  longest_run: runLength(c.monotony),
});
