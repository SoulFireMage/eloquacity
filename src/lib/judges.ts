// AI judging, built against the "mid style" trap (SPEC §5):
// judge against the stated aim, not good taste; test clarity by paraphrase;
// quote specific phrases; give notes, never rewrites (unless explicitly asked).

import type { Cadence } from './cadence';
import { chat, chatJson } from './openrouter';
import type { Answer, DialNotes, ImitationNotes, JudgeNotes, LadderNotes, Quoted } from './types';

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

/** The register brief for a dial setting, as the judge sees it. */
export const registerAim = (n: 1 | 2 | 4 | 5) => AIMS.find((a) => a.text.startsWith(`Register ${n} of 5`))!.text;

export const CHECKLIST = [
  'Hits the stated aim throughout, not just in places',
  'Long sentences keep their thread to the end',
  'Rhythm varies on purpose rather than by accident',
  'Every sentence parses on one reading',
] as const;

export const SHAPE_CHECKLIST = [
  'Each sentence earns its length',
  'The longest sentence keeps its thread to the end',
  'It is about the subject, not only the shape',
  'Every sentence parses on one reading',
] as const;

const RULES = `You are a reading partner for creative prose. You are not an editor and not a teacher of "good writing".

Rules you must follow:
1. Judge against the writer's stated aim, never against your own taste. Purple, ornate, rambling, fragmentary, archaic, blunt or rule-breaking prose is legitimate when it serves the aim. Never steer toward a polished, neutral, "clear professional" middle style; that style is not a virtue here. Do not mention grammar or "correctness" unless it causes an actual misreading.
2. Clarity is a comprehension test, not a style preference. When asked to paraphrase, say what the words say in plain words, as a careful first-time reader understood them on one reading. Do not repair them. If something is ambiguous, paraphrase the reading you actually got. A long sentence that truly reads is clear.
3. Be specific. Quote phrases copied exactly from the text (2 to 12 words each). Give one sentence on why, in terms of the aim and of what the words themselves do (sound, image, rhythm, precision). Banned: vague praise or blame such as "great imagery", "vivid", "flows well", "powerful", "evocative", "clunky" without naming what in the words does it.
4. Notes, not rewrites. Never supply replacement wording, suggest specific words, or show how you would write it.
5. No overall score or grade.`;

// ── Schema helpers ───────────────────────────────────────

const str = { type: 'string' } as const;
const answer = { type: 'string', enum: ['yes', 'partly', 'no'] } as const;
const obj = (properties: Record<string, unknown>) => ({ type: 'object', additionalProperties: false, required: Object.keys(properties), properties });
const quoted = obj({ quote: str, why: str });
const arr = (items: unknown) => ({ type: 'array', items });

/** Lowercase, straighten quotes, collapse whitespace: so "exact quote" checks survive typography. */
export const normForMatch = (s: string) =>
  s.toLowerCase().replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[—–]/g, '-').replace(/\s+/g, ' ').replace(/^[\s"'.,;:!?-]+|[\s"'.,;:!?-]+$/g, '').trim();

export const quoteFound = (quote: string, text: string) => {
  const q = normForMatch(quote);
  return q.length > 0 && normForMatch(text).includes(q);
};

const isAnswer = (x: unknown): x is Answer => x === 'yes' || x === 'partly' || x === 'no';

function checkQuoted(q: unknown, label: string, text: string): string | null {
  const r = q as Quoted;
  if (typeof r?.quote !== 'string' || typeof r?.why !== 'string') return `${label} needs quote and why`;
  if (!quoteFound(r.quote, text)) return `the ${label} quote "${r.quote}" is not copied exactly from the text`;
  return null;
}

interface JudgeCall {
  apiKey: string;
  model: string;
  signal?: AbortSignal;
}

// ── Free Desk and Shapeshifter ───────────────────────────

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
  strongest: Quoted;
  weakest: Quoted;
  aim_note: string;
  checklist: { n: number; answer: Answer }[];
}

const NOTES_SCHEMA = obj({
  paraphrases: arr(obj({ n: { type: 'integer' }, paraphrase: str })),
  strongest: quoted,
  weakest: quoted,
  aim_note: str,
  checklist: arr(obj({ n: { type: 'integer' }, answer })),
});

export function checkNotes(x: unknown, text: string, expected: number[], checklistLength: number = CHECKLIST.length): string | null {
  const r = x as RawNotes;
  if (!r || typeof r !== 'object') return 'not an object';
  if (!Array.isArray(r.paraphrases) || r.paraphrases.length !== expected.length) return `expected ${expected.length} paraphrases`;
  for (const p of r.paraphrases) if (!expected.includes(p?.n - 1) || typeof p.paraphrase !== 'string' || !p.paraphrase.trim()) return 'paraphrases must use the given sentence numbers';
  const q = checkQuoted(r.strongest, 'strongest', text) ?? checkQuoted(r.weakest, 'weakest', text);
  if (q) return q;
  if (typeof r.aim_note !== 'string') return 'aim_note must be a string';
  if (!Array.isArray(r.checklist) || r.checklist.length !== checklistLength) return `checklist needs ${checklistLength} answers`;
  return null;
}

export async function judgePiece(
  o: JudgeCall & { text: string; aim: string; cadence: Cadence; checklist?: readonly string[] },
): Promise<JudgeNotes> {
  const checklist = o.checklist ?? CHECKLIST;
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
    'SENTENCES TO PARAPHRASE (numbered by their position in the text; return "n" as that number):',
    numbered,
    '',
    'Quote the single strongest phrase and the single weakest phrase.',
    '',
    'CHECKLIST (answer yes, partly or no for each, relative to the aim; return "n" from 1):',
    checklist.map((c, i) => `${i + 1}. ${c}`).join('\n'),
    '',
    'aim_note: one or two sentences on whether the text hits the aim. Relative to the aim only.',
  ].join('\n');
  const raw = await chatJson<RawNotes>({
    ...o,
    system: RULES,
    user,
    schemaName: 'prose_notes',
    schema: NOTES_SCHEMA,
    temperature: 0.2,
    maxTokens: 1200,
    check: (x) => checkNotes(x, o.text, picks, checklist.length),
  });
  return {
    model: o.model,
    aim: o.aim,
    paraphrases: raw.paraphrases.map((p) => ({ sentence: o.cadence.sentences[p.n - 1].text, paraphrase: p.paraphrase })),
    strongest: raw.strongest,
    weakest: raw.weakest,
    aim_note: raw.aim_note,
    checklist: checklist.map((item, i) => ({ item, answer: raw.checklist.find((c) => c.n === i + 1)?.answer ?? 'partly' })),
  };
}

// ── Grow and Shrink ladders ──────────────────────────────

interface RawLadder {
  heart: string;
  rungs: { n: number; alive: Answer; heart_kept: Answer; why: string }[];
  paraphrase: string;
  strongest: Quoted;
  weakest: Quoted;
}

export function checkLadder(x: unknown, rungs: string[]): string | null {
  const r = x as RawLadder;
  if (!r || typeof r !== 'object') return 'not an object';
  if (typeof r.heart !== 'string' || typeof r.paraphrase !== 'string' || !r.paraphrase.trim()) return 'heart and paraphrase are required';
  if (!Array.isArray(r.rungs) || r.rungs.length !== rungs.length) return `expected ${rungs.length} rungs`;
  for (const g of r.rungs) if (!isAnswer(g?.alive) || !isAnswer(g?.heart_kept) || typeof g.why !== 'string') return 'each rung needs alive, heart_kept and why';
  const all = rungs.join('\n');
  return checkQuoted(r.strongest, 'strongest', all) ?? checkQuoted(r.weakest, 'weakest', all);
}

export async function judgeLadder(o: JudgeCall & { direction: 'grow' | 'shrink'; start: string; rungs: string[]; targets: string[] }): Promise<LadderNotes> {
  const grow = o.direction === 'grow';
  const user = [
    grow
      ? 'AIM: Grow a short seed sentence into ever-longer single sentences while each stays readable and alive. Long and rambling is the point; the question is whether it still moves and still reads.'
      : 'AIM: Compress a long master sentence into ever-shorter single sentences without losing its heart. Blunt and bare is the point; the question is whether the core survives.',
    '',
    `${grow ? 'SEED' : 'ORIGINAL'}: ${o.start}`,
    '',
    'RUNGS (the writer\'s versions, in order; return "n" from 1):',
    o.rungs.map((r, i) => `${i + 1}. [target ${o.targets[i]}] ${r}`).join('\n'),
    '',
    `heart: in 12 words or fewer, the core of the ${grow ? 'seed' : 'original'} (what must survive).`,
    'For each rung: alive (does it still move, rather than going slack or padded?), heart_kept (is the heart still there?), and why (one sentence).',
    `paraphrase: paraphrase the ${grow ? 'last (longest)' : 'last (shortest)'} rung in plain words, as a first-time reader got it.`,
    'Quote the single strongest and single weakest phrase from any rung.',
  ].join('\n');
  const raw = await chatJson<RawLadder>({
    ...o,
    system: RULES,
    user,
    schemaName: 'ladder_notes',
    schema: obj({ heart: str, rungs: arr(obj({ n: { type: 'integer' }, alive: answer, heart_kept: answer, why: str })), paraphrase: str, strongest: quoted, weakest: quoted }),
    temperature: 0.2,
    maxTokens: 1200,
    check: (x) => checkLadder(x, o.rungs),
  });
  return {
    model: o.model,
    heart: raw.heart,
    rungs: o.rungs.map((_, i) => {
      const g = raw.rungs.find((x) => x.n === i + 1) ?? raw.rungs[i];
      return { alive: g.alive, heart_kept: g.heart_kept, why: g.why };
    }),
    paraphrase: { sentence: o.rungs[o.rungs.length - 1], paraphrase: raw.paraphrase },
    strongest: raw.strongest,
    weakest: raw.weakest,
  };
}

// ── Imitation ────────────────────────────────────────────

interface RawImitation {
  clause_order: { answer: Answer; note: string };
  pauses: { answer: Answer; note: string };
  weight: { answer: Answer; note: string };
  own_subject: Answer;
  paraphrase: string;
  strongest: Quoted;
  weakest: Quoted;
}

export function checkImitation(x: unknown, attempt: string): string | null {
  const r = x as RawImitation;
  if (!r || typeof r !== 'object') return 'not an object';
  for (const k of ['clause_order', 'pauses', 'weight'] as const) if (!isAnswer(r[k]?.answer) || typeof r[k]?.note !== 'string') return `${k} needs answer and note`;
  if (!isAnswer(r.own_subject)) return 'own_subject must be yes, partly or no';
  if (typeof r.paraphrase !== 'string' || !r.paraphrase.trim()) return 'paraphrase is required';
  return checkQuoted(r.strongest, 'strongest', attempt) ?? checkQuoted(r.weakest, 'weakest', attempt);
}

export async function judgeImitation(o: JudgeCall & { master: string; attempt: string }): Promise<ImitationNotes> {
  const user = [
    'AIM: Sentence imitation. The writer copies the SHAPE of a master sentence (its length, clause order, where the pauses fall, where the weight lands) on a different subject, in their own words. Judge the copy of the shape and whether it lives; do not judge it against the master\'s quality or style.',
    '',
    `MASTER: ${o.master}`,
    '',
    `ATTEMPT: ${o.attempt}`,
    '',
    'clause_order: do the main and subordinate parts come in the same order? (answer + one-sentence note)',
    'pauses: do the pauses fall in the same places, doing the same work? (answer + note)',
    'weight: does the emphasis land in the same place (for example, held back to the end, or front-loaded)? (answer + note)',
    'own_subject: is it genuinely about a different subject, in the writer\'s own words, rather than a word-swap of the master?',
    'paraphrase: paraphrase the ATTEMPT in plain words, as a first-time reader got it.',
    'Quote the single strongest and single weakest phrase from the ATTEMPT.',
  ].join('\n');
  const raw = await chatJson<RawImitation>({
    ...o,
    system: RULES,
    user,
    schemaName: 'imitation_notes',
    schema: obj({
      clause_order: obj({ answer, note: str }),
      pauses: obj({ answer, note: str }),
      weight: obj({ answer, note: str }),
      own_subject: answer,
      paraphrase: str,
      strongest: quoted,
      weakest: quoted,
    }),
    temperature: 0.2,
    maxTokens: 900,
    check: (x) => checkImitation(x, o.attempt),
  });
  return { model: o.model, ...raw, paraphrase: { sentence: o.attempt, paraphrase: raw.paraphrase } };
}

// ── Register Dial ────────────────────────────────────────
// The judge never sees the source paragraph: it paraphrases each rewrite blind, so the
// writer can compare its reading with the source. Register changes; meaning shouldn't.

interface RawDial {
  rewrites: { n: number; register_hit: Answer; under_control: Answer; note: string; paraphrase: string; strongest: Quoted; weakest: Quoted }[];
}

export function checkDial(x: unknown, rewrites: { setting: number; text: string }[]): string | null {
  const r = x as RawDial;
  if (!r || !Array.isArray(r.rewrites) || r.rewrites.length !== rewrites.length) return `expected ${rewrites.length} rewrites`;
  for (let i = 0; i < rewrites.length; i++) {
    const g = r.rewrites.find((x) => x?.n === i + 1);
    if (!g) return `missing rewrite ${i + 1}`;
    if (!isAnswer(g.register_hit) || !isAnswer(g.under_control) || typeof g.note !== 'string') return `rewrite ${i + 1} needs register_hit, under_control and note`;
    if (typeof g.paraphrase !== 'string' || !g.paraphrase.trim()) return `rewrite ${i + 1} needs a paraphrase`;
    const q = checkQuoted(g.strongest, `strongest (rewrite ${i + 1})`, rewrites[i].text) ?? checkQuoted(g.weakest, `weakest (rewrite ${i + 1})`, rewrites[i].text);
    if (q) return q;
  }
  return null;
}

export async function judgeDial(o: JudgeCall & { rewrites: { setting: 1 | 2 | 4 | 5; text: string }[] }): Promise<DialNotes> {
  const user = [
    'Each passage below was written to hit a specific point on a five-step register dial (1 blunt and vivid, 2 brisk, 3 neutral, 4 lush, 5 ultraviolet). Judge each ONLY against its own target setting: "is this ultraviolet enough, and still under control?", "is this blunt enough?". Never ask whether it is good in general, and never pull it toward the neutral middle.',
    '',
    o.rewrites.map((r, i) => `${i + 1}. TARGET: ${registerAim(r.setting)}\n"""\n${r.text}\n"""`).join('\n\n'),
    '',
    'For each (return "n" from 1): register_hit (does it reach its target setting?), under_control (does it still know where it is going, however far it goes?), note (one or two sentences, relative to the target only), paraphrase (what it says in plain words, as a first-time reader got it), strongest and weakest phrase (quoted exactly from that passage).',
  ].join('\n');
  const raw = await chatJson<RawDial>({
    ...o,
    system: RULES,
    user,
    schemaName: 'dial_notes',
    schema: obj({ rewrites: arr(obj({ n: { type: 'integer' }, register_hit: answer, under_control: answer, note: str, paraphrase: str, strongest: quoted, weakest: quoted })) }),
    temperature: 0.2,
    maxTokens: 600 + 450 * o.rewrites.length,
    check: (x) => checkDial(x, o.rewrites),
  });
  return {
    model: o.model,
    rewrites: o.rewrites.map((r, i) => {
      const g = raw.rewrites.find((x) => x.n === i + 1)!;
      return {
        setting: r.setting,
        register_hit: g.register_hit,
        under_control: g.under_control,
        note: g.note,
        paraphrase: { sentence: r.text, paraphrase: g.paraphrase },
        strongest: g.strongest,
        weakest: g.weakest,
      };
    }),
  };
}

// ── On request only ──────────────────────────────────────

/** Only on explicit request, and always labelled as the model's voice. */
export function rewriteOnRequest(o: JudgeCall & { text: string; aim: string }): Promise<string> {
  return chat({
    ...o,
    temperature: 0.7,
    maxTokens: 1200,
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
