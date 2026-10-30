// Sentence splitting and word counting for prose. Pure functions, no AI.
//
// The rule of thumb: a sentence ends at . ! ? or … (plus any closing quotes or
// brackets) when the next thing is a capital letter, an opening quote before a
// capital, or the end of the text. A lowercase continuation ("Stop!" she cried.)
// never splits. Blank lines always split. Known abbreviations and initials never end
// a sentence. An em-dash interruption closing a line of dialogue can end one.

export interface Sentence {
  text: string;
  /** Character offsets into the original text. */
  start: number;
  end: number;
}

/** Abbreviations that are (almost) never sentence-final. Compared lowercase, without the final dot. */
const NEVER_FINAL = new Set([
  'mr', 'mrs', 'ms', 'messrs', 'mme', 'mlle', 'dr', 'prof', 'rev', 'revd', 'fr', 'st', 'mt', 'ft',
  'capt', 'col', 'gen', 'lt', 'sgt', 'maj', 'cmdr', 'adm', 'gov', 'sen', 'hon', 'esq', 'sr', 'jr',
  'e.g', 'i.e', 'cf', 'vs', 'viz', 'approx', 'no', 'vol', 'pp', 'p', 'ch', 'fig',
]);

const OPENERS = `"'“‘(\\[`;
const CLOSERS = `"'”’)\\]`;
const isUpper = (c: string) => /\p{Lu}/u.test(c);
const isSpace = (c: string) => /\s/.test(c);

/** The word immediately before position i (exclusive), including internal dots ("e.g"). */
function wordBefore(text: string, i: number): string {
  let j = i;
  while (j > 0 && /[\p{L}\p{N}.]/u.test(text[j - 1])) j--;
  return text.slice(j, i);
}

/** Does a real sentence begin at position k (after whitespace)? */
function startsSentence(text: string, k: number): boolean {
  if (k >= text.length) return true;
  let c = text[k];
  // Skip opening quotes/brackets: “Now!” — the capital after them decides.
  while (OPENERS.includes(c) && k + 1 < text.length) c = text[++k];
  return isUpper(c) || /\p{N}/u.test(c);
}

export function splitSentences(text: string): Sentence[] {
  const out: Sentence[] = [];
  let start = 0;
  const push = (end: number) => {
    const raw = text.slice(start, end);
    const lead = raw.length - raw.trimStart().length;
    const t = raw.trim();
    if (t && /[\p{L}\p{N}]/u.test(t)) out.push({ text: t, start: start + lead, end: start + lead + t.length });
    start = end;
  };

  let i = 0;
  while (i < text.length) {
    const c = text[i];

    // Blank line: hard boundary.
    if (c === '\n') {
      let j = i + 1;
      while (j < text.length && (text[j] === ' ' || text[j] === '\t' || text[j] === '\r')) j++;
      if (text[j] === '\n') {
        push(i);
        i = j + 1;
        continue;
      }
    }

    const terminal = c === '.' || c === '!' || c === '?' || c === '…';
    // An em-dash (or "--") that closes a quotation can interrupt a speaker: "I was going to—" "Don't."
    const dash = c === '—' || (c === '-' && text[i + 1] === '-');
    if (terminal || dash) {
      let j = i;
      if (dash) j += c === '-' ? 2 : 1;
      else while (j < text.length && /[.!?…]/.test(text[j])) j++;
      const runEnd = j;
      let closed = false;
      while (j < text.length && CLOSERS.includes(text[j])) {
        j++;
        closed = true;
      }
      const atEnd = j >= text.length;
      if (dash && !closed) {
        i = runEnd;
        continue;
      }
      if (atEnd || isSpace(text[j])) {
        let k = j;
        while (k < text.length && isSpace(text[k])) k++;
        let final = startsSentence(text, k);
        if (dash) final = final && k < text.length && OPENERS.includes(text[k]);
        // A single dot after an abbreviation or a lone initial ("J. R. R.") doesn't end anything.
        if (final && c === '.' && runEnd - i === 1 && !closed) {
          const w = wordBefore(text, i);
          const initial = /^\p{Lu}$/u.test(w) && w !== 'I'; // "J. M. Barrie", but not "So did I."
          // Short dotted acronyms ("U.S") rarely end a sentence; times ("5 p.m. She left.") often do.
          const dotted = /^(\p{L}\.)+\p{L}$/u.test(w) && !/^[ap]\.m$/i.test(w);
          if (NEVER_FINAL.has(w.toLowerCase()) || initial || (dotted && w.length <= 3)) final = false;
        }
        if (final) {
          push(j);
          i = j;
          continue;
        }
      }
      i = Math.max(runEnd, i + 1);
      continue;
    }
    i++;
  }
  push(text.length);
  return out;
}

const WORD_RE = /[\p{L}\p{N}]+(?:['’\-.][\p{L}\p{N}]+)*/gu;

/** "1,000", "10:30" and "1914–18" are one word each. */
const joinNumbers = (text: string) => text.replace(/(\d)[,:–](?=\d)/g, '$1');

/** Words: letters/digits with internal apostrophes, hyphens or dots. Em-dashes separate words. */
export function words(text: string): string[] {
  return joinNumbers(text).match(WORD_RE) ?? [];
}

export const wordCount = (text: string) => words(text).length;

export type BreathKind = 'comma' | 'semicolon' | 'colon' | 'dash';

export interface BreathMark {
  kind: BreathKind;
  /** Words that come before the mark, so 0..wordCount. */
  afterWord: number;
}

/**
 * Pauses inside a sentence: commas, semicolons, colons and dashes. Hyphens inside words,
 * thousands separators and a trailing interruption dash are not breaths.
 */
export function breathMarks(raw: string): BreathMark[] {
  const sentence = joinNumbers(raw);
  const marks: BreathMark[] = [];
  const total = wordCount(sentence);
  let seen = 0;
  const re = /([\p{L}\p{N}]+(?:['’\-.][\p{L}\p{N}]+)*)|(,|;|:|—|–|--)/gu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sentence))) {
    if (m[1]) {
      seen++;
      continue;
    }
    const p = m[2];
    if (seen === 0 || seen >= total) continue; // leading or trailing: not a pause inside the sentence
    const kind: BreathKind = p === ',' ? 'comma' : p === ';' ? 'semicolon' : p === ':' ? 'colon' : 'dash';
    marks.push({ kind, afterWord: seen });
  }
  return marks;
}
