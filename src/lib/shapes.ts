// Shapeshifter: rhythm targets checked deterministically against the cadence.
// The shape is a fact about the text; whether it moves is left to the reader (or the judge).

import type { Cadence } from './cadence';

export interface CheckItem {
  label: string;
  ok: boolean;
  /** What was actually found, in plain words. */
  found?: string;
}

export interface Target {
  id: string;
  /** The shape in a few words, as dealt to the user. */
  label: string;
  /** One-line brief. */
  brief: string;
  /** Rough lengths, drawn as ghost notes on the strip. */
  sketch: number[];
  check: (c: Cadence) => CheckItem[];
}

const lens = (c: Cadence) => c.sentences.map((s) => s.length);
const words = (n: number) => `${n} ${n === 1 ? 'word' : 'words'}`;
const count = (c: Cadence, n: number): CheckItem => ({
  label: `Exactly ${n} ${n === 1 ? 'sentence' : 'sentences'}`,
  ok: c.sentences.length === n,
  found: `${c.sentences.length}`,
});
const lengthItem = (label: string, len: number | undefined, ok: (l: number) => boolean): CheckItem => ({
  label,
  ok: len !== undefined && ok(len),
  found: len === undefined ? 'missing' : words(len),
});

export const TARGETS: Target[] = [
  {
    id: 'short-short-long',
    label: 'short · short · long',
    brief: 'Two short sentences, then one that opens right out.',
    sketch: [5, 5, 32],
    check: (c) => {
      const l = lens(c);
      return [
        count(c, 3),
        lengthItem('First sentence: 8 words or fewer', l[0], (x) => x <= 8),
        lengthItem('Second sentence: 8 words or fewer', l[1], (x) => x <= 8),
        lengthItem('Third sentence: 25 words or more', l[2], (x) => x >= 25),
      ];
    },
  },
  {
    id: 'breathless',
    label: 'one breathless runner',
    brief: 'One sentence of 60 words or more that never loses its thread.',
    sketch: [66],
    check: (c) => {
      const l = lens(c);
      return [
        count(c, 1),
        lengthItem('60 words or more', l[0], (x) => x >= 60),
        { label: 'At least four places to breathe (commas, semicolons, dashes, colons)', ok: (c.sentences[0]?.breaths.length ?? 0) >= 4, found: `${c.sentences[0]?.breaths.length ?? 0}` },
      ];
    },
  },
  {
    id: 'staccato',
    label: 'a staccato burst',
    brief: 'Five sentences, every one under six words.',
    sketch: [3, 4, 2, 5, 3],
    check: (c) => {
      const l = lens(c);
      return [count(c, 5), { label: 'Every sentence under six words', ok: l.length > 0 && l.every((x) => x < 6), found: l.join(', ') || 'none' }];
    },
  },
  {
    id: 'long-long-two',
    label: 'long, long, then two words',
    brief: 'Two long sentences, then a two-word one that lands.',
    sketch: [30, 34, 2],
    check: (c) => {
      const l = lens(c);
      return [
        count(c, 3),
        lengthItem('First sentence: 25 words or more', l[0], (x) => x >= 25),
        lengthItem('Second sentence: 25 words or more', l[1], (x) => x >= 25),
        lengthItem('Last sentence: exactly 2 words', l[2], (x) => x === 2),
      ];
    },
  },
  {
    id: 'crescendo',
    label: 'a crescendo',
    brief: 'Four to six sentences, each longer than the last, ending at 30 words or more.',
    sketch: [4, 9, 17, 34],
    check: (c) => {
      const l = lens(c);
      return [
        { label: 'Four to six sentences', ok: l.length >= 4 && l.length <= 6, found: `${l.length}` },
        { label: 'Each sentence longer than the one before', ok: l.length > 1 && l.every((x, i) => i === 0 || x > l[i - 1]), found: l.join(' → ') || 'none' },
        lengthItem('Last sentence: 30 words or more', l[l.length - 1], (x) => x >= 30),
      ];
    },
  },
  {
    id: 'diminuendo',
    label: 'a diminuendo',
    brief: 'Four to six sentences, each shorter than the last, ending at four words or fewer.',
    sketch: [32, 16, 8, 3],
    check: (c) => {
      const l = lens(c);
      return [
        { label: 'Four to six sentences', ok: l.length >= 4 && l.length <= 6, found: `${l.length}` },
        { label: 'Each sentence shorter than the one before', ok: l.length > 1 && l.every((x, i) => i === 0 || x < l[i - 1]), found: l.join(' → ') || 'none' },
        lengthItem('Last sentence: 4 words or fewer', l[l.length - 1], (x) => x <= 4),
      ];
    },
  },
  {
    id: 'hinge',
    label: 'long · one word · long',
    brief: 'A long sentence, a single-word sentence, and another long one.',
    sketch: [26, 1, 28],
    check: (c) => {
      const l = lens(c);
      return [
        count(c, 3),
        lengthItem('First sentence: 20 words or more', l[0], (x) => x >= 20),
        lengthItem('Middle sentence: one word', l[1], (x) => x === 1),
        lengthItem('Last sentence: 20 words or more', l[2], (x) => x >= 20),
      ];
    },
  },
  {
    id: 'held-breath',
    label: 'a held breath',
    brief: 'One sentence of 30 to 50 words with at least one semicolon and one dash.',
    sketch: [40],
    check: (c) => {
      const s = c.sentences[0];
      const kinds = new Set(s?.breaths.map((b) => b.kind) ?? []);
      return [
        count(c, 1),
        lengthItem('30 to 50 words', s?.length, (x) => x >= 30 && x <= 50),
        { label: 'At least one semicolon', ok: kinds.has('semicolon') },
        { label: 'At least one dash', ok: kinds.has('dash') },
      ];
    },
  },
];

export const targetById = (id: string) => TARGETS.find((t) => t.id === id);

export const SUBJECTS = [
  'a kettle coming to the boil',
  'the last bus home',
  'a dog that has been left alone',
  'the first frost of the year',
  'an argument in a kitchen',
  'a lighthouse in fog',
  'someone learning to swim at forty',
  'a market closing at dusk',
  'a letter that should not have been opened',
  'thunder over a city',
  'a child’s first lie',
  'the smell of a library',
  'a wedding seen from a passing train',
  'a fox crossing a car park',
  'waking in a strange house',
  'a queue at a post office',
  'a funeral that turns into a party',
  'the moment before a fall',
  'a cat watching rain',
  'a ruined abbey at noon',
  'a ship coming into harbour',
  'an old man mending a fence',
  'the hour before an exam',
  'bread rising in a warm room',
  'a power cut',
  'a stranger’s umbrella',
  'snow on a beach',
  'the sound of a piano through a wall',
  'a bridge in high wind',
  'finding an old photograph',
];

export const allMet = (items: CheckItem[]) => items.every((i) => i.ok);
