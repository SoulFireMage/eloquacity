import { describe, expect, it } from 'vitest';
import { analyse, snapshot } from '../src/lib/cadence';
import { emptyTelemetry, mergeTelemetry, normaliseTelemetry } from '../src/lib/telemetry';
import { checkDial, checkImitation, checkLadder, checkNotes, CHECKLIST, pickForParaphrase, quoteFound } from '../src/lib/judges';
import { extractJson } from '../src/lib/openrouter';
import { verdictOf, type Piece } from '../src/lib/types';

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

describe('exercise judge guards', () => {
  const q = (quote: string) => ({ quote, why: 'Because.' });
  it('ladder: rung count, answers and quotes from any rung', () => {
    const rungs = ['The dog waited by the door all day.', 'The old dog waited by the kitchen door until dark.'];
    const ok = { heart: 'A dog waits.', paraphrase: 'A dog waited.', rungs: rungs.map((_, i) => ({ n: i + 1, alive: 'yes', heart_kept: 'partly', why: 'x' })), strongest: q('until dark'), weakest: q('all day') };
    expect(checkLadder(ok, rungs)).toBeNull();
    expect(checkLadder({ ...ok, rungs: ok.rungs.slice(1) }, rungs)).toMatch(/expected 2/);
    expect(checkLadder({ ...ok, weakest: q('the cat') }, rungs)).toMatch(/not copied/);
    expect(checkLadder({ ...ok, rungs: [{ ...ok.rungs[0], alive: 'maybe' }, ok.rungs[1]] }, rungs)).toMatch(/alive/);
  });
  it('imitation: three shape answers and quotes from the attempt only', () => {
    const attempt = 'Call it luck, said the gambler, and walked out.';
    const ok = { clause_order: { answer: 'yes', note: '' }, pauses: { answer: 'partly', note: '' }, weight: { answer: 'no', note: '' }, own_subject: 'yes', paraphrase: 'x', strongest: q('Call it luck'), weakest: q('walked out') };
    expect(checkImitation(ok, attempt)).toBeNull();
    expect(checkImitation({ ...ok, strongest: q('Call me Ishmael') }, attempt)).toMatch(/not copied/);
    expect(checkImitation({ ...ok, weight: { answer: 'yes' } }, attempt)).toMatch(/weight/);
  });
  it('dial: one entry per rewrite, quotes checked against their own rewrite', () => {
    const rewrites = [{ setting: 1, text: 'Market. Seven. Crowds.' }, { setting: 5, text: 'The market blooms like a bruise at dawn.' }];
    const entry = (n: number, s: string, w: string) => ({ n, register_hit: 'yes', under_control: 'yes', note: '', paraphrase: 'x', strongest: q(s), weakest: q(w) });
    expect(checkDial({ rewrites: [entry(1, 'Market. Seven', 'Crowds'), entry(2, 'like a bruise', 'at dawn')] }, rewrites)).toBeNull();
    expect(checkDial({ rewrites: [entry(1, 'like a bruise', 'Crowds'), entry(2, 'like a bruise', 'at dawn')] }, rewrites)).toMatch(/rewrite 1/);
    expect(checkDial({ rewrites: [entry(1, 'Market', 'Crowds')] }, rewrites)).toMatch(/expected 2/);
  });
  it('reads Phase 1 boolean paraphrase marks as verdicts', () => {
    expect(verdictOf({ sentence: '', paraphrase: '', matched: true })).toBe('matched');
    expect(verdictOf({ sentence: '', paraphrase: '', matched: false })).toBe('misread');
    expect(verdictOf({ sentence: '', paraphrase: '', verdict: 'ambiguous', matched: true })).toBe('ambiguous');
    expect(verdictOf({ sentence: '', paraphrase: '' })).toBeUndefined();
  });
});
