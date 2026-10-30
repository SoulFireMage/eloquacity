// Restore the Pause: strip a passage's internal punctuation, let the writer put it back,
// then compare gap by gap. The author's choice is one good answer, not the only one.

import { PASSAGES, type Passage } from '../data/passages';

export type Mark = ',' | ';' | ':' | '—' | '(' | ')';

const WORD = /[\p{L}\p{N}]+(?:['’\-.][\p{L}\p{N}]+)*/gu;

/** Normalise a run of punctuation between two words to the internal marks it contains. */
function marksIn(between: string): Mark[] {
  const out: Mark[] = [];
  const s = between.replace(/--|–/g, '—');
  for (const ch of s) if (ch === ',' || ch === ';' || ch === ':' || ch === '—' || ch === '(' || ch === ')') out.push(ch);
  return out;
}

export interface Token {
  word: string;
  /** Character span of the word, and the end of the gap after it. */
  start: number;
  end: number;
  gapEnd: number;
  /** Internal marks in the gap after this word (before the next word). */
  after: Mark[];
  /** Is there a sentence end (. ! ? …) in that gap? Sentence ends are kept, not compared. */
  stop: boolean;
}

export function tokenise(text: string): Token[] {
  const toks: Token[] = [];
  const matches = [...text.matchAll(WORD)];
  matches.forEach((m, i) => {
    const end = (m.index ?? 0) + m[0].length;
    const next = i + 1 < matches.length ? matches[i + 1].index ?? text.length : text.length;
    const gap = text.slice(end, next);
    toks.push({ word: m[0], start: m.index ?? 0, end, gapEnd: next, after: marksIn(gap), stop: /[.!?…]/.test(gap) });
  });
  return toks;
}

/**
 * Remove internal punctuation (commas, semicolons, colons, dashes, brackets) but keep
 * sentence ends, quotes and apostrophes, so the passage still reads as sentences.
 */
export function strip(text: string): string {
  return text
    .replace(/\s*(?:--|—|–)\s*/g, ' ')
    .replace(/[,;:()]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export type GapResult = 'agree' | 'differ' | 'yours' | 'authors' | 'none';

export interface Gap {
  /** Index of the word (in the author's text) this gap follows. */
  index: number;
  /** Index of the matching word in your text. */
  yoursIndex: number;
  word: string;
  author: Mark[];
  yours: Mark[];
  result: GapResult;
}

export interface Comparison {
  gaps: Gap[];
  /** Author's pauses you also paused at (any mark). */
  shared: number;
  /** Of those, with exactly the same mark. */
  same: number;
  authorPauses: number;
  yourPauses: number;
  /** Words you changed, added or dropped (gaps around them aren't compared). */
  wordChanges: number;
}

const norm = (w: string) => w.toLowerCase().replace(/’/g, "'");
const key = (m: Mark[]) => m.join('');

/** Word-level LCS so a changed or missing word doesn't throw every later gap out. */
function align(a: Token[], b: Token[]): [number, number][] {
  const n = a.length;
  const m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--) dp[i][j] = norm(a[i].word) === norm(b[j].word) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const pairs: [number, number][] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (norm(a[i].word) === norm(b[j].word)) {
      pairs.push([i, j]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return pairs;
}

export function compare(original: string, attempt: string): Comparison {
  const a = tokenise(original);
  const b = tokenise(attempt);
  const pairs = align(a, b);
  const gaps: Gap[] = [];
  for (let k = 0; k < pairs.length; k++) {
    const [i, j] = pairs[k];
    const next = pairs[k + 1];
    // Only compare a gap when the words on both sides line up in both texts.
    if (!next || next[0] !== i + 1 || next[1] !== j + 1) continue;
    const author = a[i].after;
    const yours = b[j].after;
    const result: GapResult = !author.length && !yours.length ? 'none' : !yours.length ? 'authors' : !author.length ? 'yours' : key(author) === key(yours) ? 'agree' : 'differ';
    gaps.push({ index: i, yoursIndex: j, word: a[i].word, author, yours, result });
  }
  const authorPauses = gaps.filter((g) => g.author.length).length;
  const yourPauses = gaps.filter((g) => g.yours.length).length;
  return {
    gaps,
    shared: gaps.filter((g) => g.result === 'agree' || g.result === 'differ').length,
    same: gaps.filter((g) => g.result === 'agree').length,
    authorPauses,
    yourPauses,
    wordChanges: Math.max(a.length, b.length) - pairs.length,
  };
}

/** Passages worth restoring: at least four internal marks, at most 170 words. */
export const RESTORE_SOURCES: Passage[] = PASSAGES.filter((p) => {
  const t = tokenise(p.text);
  const marks = t.filter((x) => x.after.length && !x.stop).length;
  return marks >= 4 && t.length <= 170 && strip(p.text) !== p.text;
});
