// Imitation: copy a master sentence's shape (length, pauses, where they fall) on a new subject.
// Deterministic shape comparison; clause order and "is it alive" are for the reader or the judge.

import { PASSAGES, type Passage } from '../data/passages';
import { breathMarks, splitSentences, wordCount, type BreathMark } from './sentences';

export interface SentenceShape {
  length: number;
  breaths: BreathMark[];
}

export const shapeOf = (sentence: string): SentenceShape => ({ length: wordCount(sentence), breaths: breathMarks(sentence) });

export interface ShapeMatch {
  /** Your length ÷ the master's. */
  lengthRatio: number;
  lengthClose: boolean;
  /** Pause counts. */
  masterPauses: number;
  yourPauses: number;
  /** Pauses matched by position (within 12% of the sentence), in order. */
  matched: { master: BreathMark; yours: BreathMark; sameKind: boolean }[];
  /** 0–1: how closely the pause positions line up, after matching. */
  placement: number;
}

/** Relative position of a pause: 0 at the first word, 1 at the last. */
const rel = (b: BreathMark, len: number) => (len ? b.afterWord / len : 0);

export function matchShape(master: SentenceShape, yours: SentenceShape): ShapeMatch {
  const lengthRatio = master.length ? yours.length / master.length : 0;
  // Greedy in-order matching of pauses by relative position.
  const matched: ShapeMatch['matched'] = [];
  let j = 0;
  for (const m of master.breaths) {
    const pm = rel(m, master.length);
    let best = -1;
    let bestD = 0.12;
    for (let k = j; k < yours.breaths.length; k++) {
      const d = Math.abs(rel(yours.breaths[k], yours.length) - pm);
      if (d <= bestD) {
        best = k;
        bestD = d;
      }
    }
    if (best >= 0) {
      matched.push({ master: m, yours: yours.breaths[best], sameKind: m.kind === yours.breaths[best].kind });
      j = best + 1;
    }
  }
  const total = Math.max(master.breaths.length, yours.breaths.length);
  const placement = total ? matched.length / total : 1;
  return {
    lengthRatio,
    lengthClose: lengthRatio >= 0.8 && lengthRatio <= 1.25,
    masterPauses: master.breaths.length,
    yourPauses: yours.breaths.length,
    matched,
    placement,
  };
}

/** Single-sentence masters of 15–90 words with at least two pauses. */
export const MASTERS: Passage[] = PASSAGES.filter((p) => {
  if (splitSentences(p.text).length !== 1) return false;
  const s = shapeOf(p.text);
  return s.length >= 15 && s.length <= 90 && s.breaths.length >= 2;
});
