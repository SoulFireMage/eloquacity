// Grow and Shrink ladders: one sentence, rewritten rung by rung to a word count.

import { PASSAGES, type Passage } from '../data/passages';
import { splitSentences, wordCount } from './sentences';

export interface Rung {
  label: string;
  min: number;
  max: number;
}

export const GROW: Rung[] = [
  { label: 'about 20 words', min: 16, max: 24 },
  { label: 'about 40 words', min: 34, max: 46 },
  { label: '60 words or more', min: 60, max: Infinity },
];

export const SHRINK: Rung[] = [
  { label: 'about 25 words', min: 21, max: 29 },
  { label: 'about 12 words', min: 10, max: 14 },
  { label: 'about 6 words', min: 5, max: 7 },
];

export interface RungCheck {
  words: number;
  sentences: number;
  inRange: boolean;
  oneSentence: boolean;
}

export function checkRung(text: string, rung: Rung): RungCheck {
  const words = wordCount(text);
  const sentences = splitSentences(text).length;
  return { words, sentences, inRange: words >= rung.min && words <= rung.max, oneSentence: sentences === 1 };
}

/** Six-word seeds to grow, written for Eloquacity. */
export const SEEDS = [
  'The dog waited by the door.',
  'She sold the house in spring.',
  'Rain found the gap above them.',
  'He kept every letter she wrote.',
  'The train stopped between two stations.',
  'Nobody came to the second wedding.',
  'The bread burned while they argued.',
  'A bell rang across the water.',
  'The old map was wrong again.',
  'They planted the tree too late.',
  'The lift stuck between two floors.',
  'Her brother never learned to swim.',
];

/** Long single sentences from the bank (45+ words), for shrinking. */
export const SHRINK_SOURCES: Passage[] = PASSAGES.filter((p) => {
  const s = splitSentences(p.text);
  return s.length === 1 && wordCount(p.text) >= 45 && wordCount(p.text) <= 130;
});
