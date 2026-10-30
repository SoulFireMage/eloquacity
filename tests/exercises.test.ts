import { describe, expect, it } from 'vitest';
import { PASSAGES } from '../src/data/passages';
import { DIAL_SOURCES } from '../src/data/dial';
import { analyse } from '../src/lib/cadence';
import { allMet, SUBJECTS, targetById, TARGETS } from '../src/lib/shapes';
import { checkRung, GROW, SEEDS, SHRINK, SHRINK_SOURCES } from '../src/lib/ladders';
import { compare, RESTORE_SOURCES, strip, tokenise } from '../src/lib/restore';
import { MASTERS, matchShape, shapeOf } from '../src/lib/imitate';
import { wordCount } from '../src/lib/sentences';

describe('passage bank', () => {
  it('has at least 60 passages with unique ids', () => {
    expect(PASSAGES.length).toBeGreaterThanOrEqual(60);
    expect(new Set(PASSAGES.map((p) => p.id)).size).toBe(PASSAGES.length);
  });
  it('every passage meets the public-domain rule and records its source', () => {
    const bad = PASSAGES.filter(
      (p) => !(p.year < 1929) || !(p.died === null || p.died < 1955) || !Number.isInteger(p.gutenberg) || p.gutenberg <= 0 || !p.author || !p.work,
    );
    expect(bad.map((p) => p.id)).toEqual([]);
  });
  it('has well-formed text, register and note', () => {
    for (const p of PASSAGES) {
      expect(p.text.trim().length, p.id).toBeGreaterThan(0);
      expect(p.text, p.id).not.toMatch(/_|\s{2,}|\r/);
      expect([1, 2, 3, 4, 5], p.id).toContain(p.register);
      expect(p.note.length, p.id).toBeGreaterThan(5);
    }
  });
  it('ranges across every register, blunt to ultraviolet', () => {
    for (const r of [1, 2, 3, 4, 5]) expect(PASSAGES.filter((p) => p.register === r).length, `register ${r}`).toBeGreaterThanOrEqual(5);
  });
  it('feeds every exercise', () => {
    expect(MASTERS.length).toBeGreaterThanOrEqual(15);
    expect(RESTORE_SOURCES.length).toBeGreaterThanOrEqual(15);
    expect(SHRINK_SOURCES.length).toBeGreaterThanOrEqual(6);
  });
});

describe('Shapeshifter targets', () => {
  it('every target accepts a text written to its own sketch', () => {
    const write = (n: number, extra = '') => `${Array.from({ length: n }, (_, i) => (i === 0 ? 'Word' : 'word')).join(' ')}${extra}.`;
    for (const t of TARGETS) {
      // Build a text matching the sketch; give long sentences enough pauses for the pause rules.
      const text = t.sketch
        .map((n) => {
          if (t.id === 'held-breath') return 'One two three four five six seven eight nine ten; eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty — one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty.';
          if (n < 20) return write(n);
          const ws = Array.from({ length: n }, (_, i) => (i === 0 ? 'Word' : 'word'));
          for (let i = 6; i < n - 2; i += 8) ws[i] += ',';
          return ws.join(' ') + '.';
        })
        .join(' ');
      expect(allMet(t.check(analyse(text))), `${t.id}: ${JSON.stringify(t.check(analyse(text)))}`).toBe(true);
    }
  });
  it('rejects the wrong shape', () => {
    expect(allMet(targetById('staccato')!.check(analyse('One two. Three four five six seven eight. Nine.')))).toBe(false);
    expect(allMet(targetById('long-long-two')!.check(analyse('Short. Short. Two words.')))).toBe(false);
  });
  it('has plenty of subjects', () => {
    expect(SUBJECTS.length).toBeGreaterThanOrEqual(20);
  });
});

describe('ladders', () => {
  it('seeds are six words', () => {
    for (const s of SEEDS) expect(wordCount(s), s).toBe(6);
  });
  it('checks one sentence within the rung range', () => {
    const r = checkRung('The old brown dog waited patiently by the front door of the house until the children came home from school.', GROW[0]);
    expect(r.words).toBe(20);
    expect(r.inRange && r.oneSentence).toBe(true);
    expect(checkRung('Too short. Two sentences.', SHRINK[2]).oneSentence).toBe(false);
  });
  it('shrink sources are single long sentences', () => {
    for (const p of SHRINK_SOURCES) expect(wordCount(p.text)).toBeGreaterThanOrEqual(45);
  });
});

describe('Restore the Pause', () => {
  const original = 'Fog everywhere. Fog up the river, where it flows; fog down the river—where it rolls (defiled) among ships.';
  it('strips internal marks but keeps sentence ends', () => {
    expect(strip(original)).toBe('Fog everywhere. Fog up the river where it flows fog down the river where it rolls defiled among ships.');
  });
  it('tokenises the marks in each gap', () => {
    const t = tokenise('river, where it flows; fog');
    expect(t.map((x) => x.after.join(''))).toEqual([',', '', '', ';', '']);
  });
  it('compares gap by gap', () => {
    const c = compare(original, 'Fog everywhere. Fog up the river where it flows, fog down the river; where it rolls defiled among ships.');
    expect(c.authorPauses).toBe(5); // , ; — and each bracket
    expect(c.yourPauses).toBe(2);
    const byWord = Object.fromEntries(c.gaps.filter((g) => g.result !== 'none').map((g) => [`${g.index}:${g.word}`, g.result]));
    expect(byWord).toEqual({ '5:river': 'authors', '8:flows': 'differ', '12:river': 'differ', '15:rolls': 'authors', '16:defiled': 'authors' });
    expect(c.shared).toBe(2);
    expect(c.same).toBe(0);
    expect(c.wordChanges).toBe(0);
  });
  it('survives changed words without misaligning later gaps', () => {
    const c = compare('A b, c d; e f.', 'A b, x d; e f.');
    expect(c.wordChanges).toBe(1);
    expect(c.gaps.find((g) => g.word === 'e')).toBeDefined();
  });
  it('treats -- and en dashes as dashes', () => {
    expect(tokenise('a -- b – c')[0].after).toEqual(['—']);
  });
});

describe('Imitation', () => {
  it('matches pause positions in order and compares lengths', () => {
    const master = shapeOf('Call me Ishmael, said the sailor, and then he left the harbour for good.');
    const close = shapeOf('Call it luck, said the gambler, and then she walked out of the casino forever.');
    const m = matchShape(master, close);
    expect(m.lengthClose).toBe(true);
    expect(m.matched.length).toBe(2);
    expect(m.placement).toBe(1);
    const far = matchShape(master, shapeOf('No pauses at all in this one and it is short.'));
    expect(far.matched.length).toBe(0);
    expect(far.placement).toBe(0);
  });
  it('masters are single sentences with pauses', () => {
    for (const p of MASTERS) expect(shapeOf(p.text).breaths.length).toBeGreaterThanOrEqual(2);
  });
});

describe('dial sources', () => {
  it('are plain paragraphs of a workable size', () => {
    for (const d of DIAL_SOURCES) {
      const n = wordCount(d.text);
      expect(n, d.id).toBeGreaterThanOrEqual(35);
      expect(n, d.id).toBeLessThanOrEqual(80);
    }
  });
});
