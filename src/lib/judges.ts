// AI judging, built against the "mid style" trap (SPEC §5):
// judge against the stated aim, not good taste; test clarity by paraphrase;
// quote specific phrases; give notes, never rewrites (unless explicitly asked).

import type { Cadence } from './cadence';
import { chat, chatJson } from './openrouter';
import type { JudgeNotes } from './types';

/** Points on the Register Dial a writer can aim at. 3 (neutral) is a baseline only, never a target. */
export const AIMS = [
  { id: 'unstated', label: 'Unstated', text: 'Unstated: judge whether the piece does what it is evidently trying to do.' },
  { id: 'blunt', label: 'Blunt and vivid', text: 'Register 1 of 5, blunt and vivid: short, hard, concrete, plain words that hit.' },
  { id: 'brisk', label: 'Brisk', text: 'Register 2 of 5, brisk: quick, clean, energetic, no lingering.' },
  { id: 'lush', label: 'Lush', text: 'Register 4 of 5, lush: rich, sensuous, layered, unhurried.' },
  { id: 'ultraviolet', label: 'Ultraviolet', text: 'Register 5 of 5, ultraviolet: as purple as prose goes, ornate, extravagant, maximal, yet still under control.' },
  { id: 'own', label: 'My own words', text: '' },
] as const;
export type AimId = (typeof AIMS)[number]['id'];

export const aimText = (id: AimId, own: string) =>
  id === 'own' ? (own.trim() ? `In the writer's own words: ${own.trim()}` : AIMS[0].text) : AIMS.find((a) => a.id === id)!.text;

export const CHECKLIST = [
  'Hits the stated aim throughout, not just in places',
  'Long sentences keep their thread to the end',
  'Rhythm varies on purpose rather than by accident',
  'Every sentence parses on one reading',
] as const;

const RULES = `You are a reading partner for creative prose. You are not an editor and not a teacher of "good writing".

Rules you must follow:
1. Judge against the writer's stated aim, never against your own taste. Purple, ornate, rambling, fragmentary, archaic, blunt or rule-breaking prose is legitimate when it serves the aim. Never steer toward a polished, neutral, "clear professional" middle style; that style is not a virtue here. Do not mention grammar or "correctness" unless it causes an actual misreading.
2. Clarity is a comprehension test, not a style preference. For each numbered sentence you are given, paraphrase what it says in plain words, as a careful first-time reader understood it on one reading. Do not repair it. If it is ambiguous, paraphrase the reading you actually got. A long sentence that truly reads is clear.
3. Be specific. Quote the single strongest phrase and the single weakest phrase, copied exactly from the text (2 to 12 words each). Give one sentence each on why, in terms of the aim and of what the words themselves do (sound, image, rhythm, precision). Banned: vague praise or blame such as "great imagery", "vivid", "flows well", "powerful", "evocative", "clunky" without naming what in the words does it.
4. Notes, not rewrites. Never supply replacement wording, suggest specific words, or show how you would write it.
5. No overall score or grade.`;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['paraphrases', 'strongest', 'weakest', 'aim_note', 'checklist'],
  properties: {
    paraphrases: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['n', 'paraphrase'],
        properties: { n: { type: 'integer' }, paraphrase: { type: 'string' } },
      },
    },
    strongest: { type: 'object', additionalProperties: false, required: ['quote', 'why'], properties: { quote: { type: 'string' }, why: { type: 'string' } } },
    weakest: { type: 'object', additionalProperties: false, required: ['quote', 'why'], properties: { quote: { type: 'string' }, why: { type: 'string' } } },
    aim_note: { type: 'string' },
    checklist: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['n', 'answer'],
        properties: { n: { type: 'integer' }, answer: { type: 'string', enum: ['yes', 'partly', 'no'] } },
      },
    },
  },
} as const;

/** Lowercase, straighten quotes, collapse whitespace: so "exact quote" checks survive typography. */
export const normForMatch = (s: string) =>
  s.toLowerCase().replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[—–]/g, '-').replace(/\s+/g, ' ').replace(/^[\s"'.,;:!?-]+|[\s"'.,;:!?-]+$/g, '').trim();

export const quoteFound = (quote: string, text: string) => {
  const q = normForMatch(quote);
  return q.length > 0 && normForMatch(text).includes(q);
};

/** The sentences to paraphrase: the longest ones (most at risk of losing the reader), up to three, in text order. */
export function pickForParaphrase(c: Cadence, max = 3): number[] {
  return [...c.sentences]
    .sort((a, b) => b.length - a.length || a.index - b.index)
    .slice(0, max)
    .filter((s, i) => i === 0 || s.length >= 12)
    .map((s) => s.index)
    .sort((a, b) => a - b);
}

interface RawNotes {
  paraphrases: { n: number; paraphrase: string }[];
  strongest: { quote: string; why: string };
  weakest: { quote: string; why: string };
  aim_note: string;
  checklist: { n: number; answer: 'yes' | 'partly' | 'no' }[];
}

export function checkNotes(x: unknown, text: string, expected: number[]): string | null {
  const r = x as RawNotes;
  if (!r || typeof r !== 'object') return 'not an object';
  if (!Array.isArray(r.paraphrases) || r.paraphrases.length !== expected.length) return `expected ${expected.length} paraphrases`;
  for (const p of r.paraphrases) if (!expected.includes(p?.n - 1) || typeof p.paraphrase !== 'string' || !p.paraphrase.trim()) return 'paraphrases must use the given sentence numbers';
  for (const k of ['strongest', 'weakest'] as const) {
    if (typeof r[k]?.quote !== 'string' || typeof r[k]?.why !== 'string') return `${k} needs quote and why`;
    if (!quoteFound(r[k].quote, text)) return `the ${k} quote "${r[k].quote}" is not copied exactly from the text`;
  }
  if (typeof r.aim_note !== 'string') return 'aim_note must be a string';
  if (!Array.isArray(r.checklist) || r.checklist.length !== CHECKLIST.length) return `checklist needs ${CHECKLIST.length} answers`;
  return null;
}

export async function judgePiece(o: { apiKey: string; model: string; text: string; aim: string; cadence: Cadence; signal?: AbortSignal }): Promise<JudgeNotes> {
  const picks = pickForParaphrase(o.cadence);
  const numbered = picks.map((i) => `${i + 1}. ${o.cadence.sentences[i].text}`).join('\n');
  const user = [
    `AIM: ${o.aim}`,
    '',
    'TEXT:',
    '"""',
    o.text,
    '"""',
    '',
    `SENTENCES TO PARAPHRASE (numbered by their position in the text; return "n" as that number):`,
    numbered,
    '',
    'CHECKLIST (answer yes, partly or no for each, relative to the aim; return "n" from 1):',
    CHECKLIST.map((c, i) => `${i + 1}. ${c}`).join('\n'),
    '',
    'aim_note: one or two sentences on whether the text hits the aim. Relative to the aim only.',
  ].join('\n');
  const raw = await chatJson<RawNotes>({
    apiKey: o.apiKey,
    model: o.model,
    system: RULES,
    user,
    schemaName: 'prose_notes',
    schema: SCHEMA as unknown as Record<string, unknown>,
    temperature: 0.2,
    maxTokens: 1200,
    check: (x) => checkNotes(x, o.text, picks),
    signal: o.signal,
  });
  return {
    model: o.model,
    aim: o.aim,
    paraphrases: raw.paraphrases.map((p) => ({ sentence: o.cadence.sentences[p.n - 1].text, paraphrase: p.paraphrase })),
    strongest: raw.strongest,
    weakest: raw.weakest,
    aim_note: raw.aim_note,
    checklist: CHECKLIST.map((item, i) => ({ item, answer: raw.checklist.find((c) => c.n === i + 1)?.answer ?? 'partly' })),
  };
}

/** Only on explicit request, and always labelled as the model's voice. */
export function rewriteOnRequest(o: { apiKey: string; model: string; text: string; aim: string; signal?: AbortSignal }): Promise<string> {
  return chat({
    apiKey: o.apiKey,
    model: o.model,
    temperature: 0.7,
    maxTokens: 1200,
    signal: o.signal,
    messages: [
      {
        role: 'system',
        content:
          'The writer has explicitly asked to see one possible version of their passage. Write it to the stated aim, pushing fully into that register (purple, blunt, rambling or fragmentary if that is the aim); do not drift toward a neutral, polished middle style. Keep their content and images. Reply with the passage only.',
      },
      { role: 'user', content: `AIM: ${o.aim}\n\nPASSAGE:\n${o.text}` },
    ],
  });
}

export const SELF_CHECK = [
  'I read it aloud once and nothing snagged where I didn’t mean it to',
  'Each long sentence still knew where it was going at its last word',
  'The short sentences land where I put them, not by accident',
  'Someone reading it cold would understand every sentence on one pass',
  'It sounds like the register I was aiming for, all the way through',
];
