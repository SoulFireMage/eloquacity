import { describe, expect, it } from 'vitest';
import { analyse, snapshot } from '../src/lib/cadence';
import { emptyTelemetry, mergeTelemetry, normaliseTelemetry } from '../src/lib/telemetry';
import { checkNotes, CHECKLIST, pickForParaphrase, quoteFound } from '../src/lib/judges';
import { extractJson } from '../src/lib/openrouter';
import type { Piece } from '../src/lib/types';

const piece = (id: string, updated_at: string, text = 'Text.'): Piece => ({
  id, date: '2026-01-01T00:00:00.000Z', updated_at, kind: 'free_desk', title: id, text, cadence: snapshot(analyse(text)),
});

describe('telemetry merge', () => {
  it('unions pieces and keeps the newer copy of each', () => {
    const a = { ...emptyTelemetry('u'), pieces: [piece('p1', '2026-01-02T00:00:00.000Z', 'Old.'), piece('p2', '2026-01-01T00:00:00.000Z')] };
    const b = { ...emptyTelemetry('u'), pieces: [piece('p1', '2026-01-03T00:00:00.000Z', 'New.'), piece('p3', '2026-01-01T00:00:00.000Z')] };
    const m = mergeTelemetry(a, b, 'u');
    expect(m.pieces.map((p) => p.id).sort()).toEqual(['p1', 'p2', 'p3']);
    expect(m.pieces.find((p) => p.id === 'p1')!.text).toBe('New.');
  });
  it('honours tombstones from either side', () => {
    const a = { ...emptyTelemetry('u'), pieces: [piece('p1', '2026-01-02T00:00:00.000Z')] };
    const b = { ...emptyTelemetry('u'), deleted: ['p1'] };
    expect(mergeTelemetry(a, b, 'u').pieces).toEqual([]);
    expect(mergeTelemetry(b, a, 'u').pieces).toEqual([]);
  });
  it('dedupes the practice log by id', () => {
    const r = { id: 'r1', date: '2026-01-01T00:00:00.000Z', exercise: 'free_desk' as const, judged: 'none' as const };
    const m = mergeTelemetry({ ...emptyTelemetry(), practice_log: [r] }, { ...emptyTelemetry(), practice_log: [r] }, 'u');
    expect(m.practice_log).toHaveLength(1);
  });
  it('normalises junk into a valid object', () => {
    const t = normaliseTelemetry({ pieces: [null, { id: 1 }, piece('ok', '2026-01-01T00:00:00.000Z')], deleted: 'x' });
    expect(t.pieces.map((p) => p.id)).toEqual(['ok']);
    expect(t.deleted).toEqual([]);
    expect(normaliseTelemetry(null).version).toBe(1);
  });
});

describe('judge guards', () => {
  const text = 'The sea was “dark as wine”. Then the long boats came in over the bar, one after another, low in the water with the night’s catch.';
  const c = analyse(text);
  const picks = pickForParaphrase(c);
  const good = {
    paraphrases: picks.map((i) => ({ n: i + 1, paraphrase: 'Something plain.' })),
    strongest: { quote: '"dark as wine"', why: 'Old, odd, exact.' },
    weakest: { quote: 'one after another', why: 'Filler rhythm.' },
    aim_note: 'Hits it.',
    checklist: CHECKLIST.map((_, i) => ({ n: i + 1, answer: 'yes' })),
  };

  it('quotes match through typographic differences', () => {
    expect(quoteFound('dark as wine', text)).toBe(true);
    expect(quoteFound("the night's catch", text)).toBe(true);
    expect(quoteFound('wine-dark sea', text)).toBe(false);
    expect(quoteFound('', text)).toBe(false);
  });
  it('accepts a well-formed reply', () => {
    expect(checkNotes(good, text, picks)).toBeNull();
  });
  it('rejects invented quotes, so the repair re-ask fires', () => {
    expect(checkNotes({ ...good, weakest: { quote: 'wine-dark sea', why: 'x' } }, text, picks)).toMatch(/not copied exactly/);
  });
  it('rejects paraphrases of the wrong sentences', () => {
    expect(checkNotes({ ...good, paraphrases: [{ n: 99, paraphrase: 'x' }] }, text, picks)).toMatch(/paraphrase/);
  });
  it('picks the longest sentences for the comprehension test, in text order', () => {
    const many = analyse('Short. A rather longer sentence that runs on for quite some while yet. Tiny. The longest sentence of them all, which keeps going and going past every other one here.');
    expect(pickForParaphrase(many)).toEqual([1, 3]);
  });
});

describe('extractJson', () => {
  it('pulls JSON out of fenced or chatty replies', () => {
    expect(extractJson('Sure!\n```json\n{"a": "}"}\n```')).toEqual({ a: '}' });
    expect(extractJson('Here: {"b": [1, {"c": 2}]} done')).toEqual({ b: [1, { c: 2 }] });
  });
});
