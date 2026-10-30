import { describe, expect, it } from 'vitest';
import { breathMarks, splitSentences, wordCount } from '../src/lib/sentences';
import { analyse, findEchoes, monotonyRuns, stem } from '../src/lib/cadence';

const split = (t: string) => splitSentences(t).map((s) => s.text);

describe('splitSentences', () => {
  it('splits plain sentences', () => {
    expect(split('The rain came. It did not stop! Who could blame it?')).toEqual(['The rain came.', 'It did not stop!', 'Who could blame it?']);
  });

  it('keeps offsets pointing into the original text', () => {
    const text = '  First one.   Second one.';
    for (const s of splitSentences(text)) expect(text.slice(s.start, s.end)).toBe(s.text);
  });

  it('does not split on titles and common abbreviations', () => {
    expect(split('Mr. Darcy bowed to Mrs. Bennet. Dr. Jekyll did not.')).toEqual(['Mr. Darcy bowed to Mrs. Bennet.', 'Dr. Jekyll did not.']);
    expect(split('Bring something sharp, e.g. A knife. Then wait.')).toEqual(['Bring something sharp, e.g. A knife.', 'Then wait.']);
    expect(split('See St. Paul’s, vs. Westminster. Both are old.')).toEqual(['See St. Paul’s, vs. Westminster.', 'Both are old.']);
  });

  it('does not split on initials, but does after a sentence-final "I"', () => {
    expect(split('J. M. Barrie wrote it. So did I. Then we left.')).toEqual(['J. M. Barrie wrote it.', 'So did I.', 'Then we left.']);
  });

  it('splits after times at the end of a sentence', () => {
    expect(split('We left at 5 p.m. She stayed.')).toEqual(['We left at 5 p.m.', 'She stayed.']);
  });

  it('handles dialogue with lowercase attribution as one sentence', () => {
    expect(split('“Stop!” she cried. “Why?” he asked, and waited.')).toEqual(['“Stop!” she cried.', '“Why?” he asked, and waited.']);
    expect(split('"Come here," she said. "Now!"')).toEqual(['"Come here," she said.', '"Now!"']);
  });

  it('splits after a closing quote when a new sentence follows', () => {
    expect(split('He said, “Go.” Then he left.')).toEqual(['He said, “Go.”', 'Then he left.']);
  });

  it('treats ellipses as a pause unless a capital follows', () => {
    expect(split('I waited... and waited. Nothing.')).toEqual(['I waited... and waited.', 'Nothing.']);
    expect(split('I waited… Then she came.')).toEqual(['I waited…', 'Then she came.']);
    expect(split('Well . . . perhaps.')).toEqual(['Well . . . perhaps.']);
  });

  it('never splits on an em-dash inside a sentence', () => {
    expect(split('He paused—then ran. She did not—could not—follow.')).toEqual(['He paused—then ran.', 'She did not—could not—follow.']);
    expect(split('He paused -- then ran.')).toEqual(['He paused -- then ran.']);
  });

  it('splits an interrupted line of dialogue from the reply', () => {
    expect(split('“I was going to—” “Don’t.”')).toEqual(['“I was going to—”', '“Don’t.”']);
  });

  it('treats blank lines as hard boundaries, single newlines as spaces', () => {
    expect(split('A heading\n\nThe body begins here.\nIt carries on.')).toEqual(['A heading', 'The body begins here.', 'It carries on.']);
    expect(split('A line that\nwraps.')).toEqual(['A line that\nwraps.']);
  });

  it('keeps decimals and numbers together', () => {
    expect(split('It cost 3.50 pounds. Too much.')).toEqual(['It cost 3.50 pounds.', 'Too much.']);
  });

  it('splits before a sentence starting with a number', () => {
    expect(split('They came. 1914 changed everything.')).toEqual(['They came.', '1914 changed everything.']);
  });

  it('ignores punctuation-only fragments and empty input', () => {
    expect(split('')).toEqual([]);
    expect(split('   \n\n  ')).toEqual([]);
    expect(split('Done. …')).toEqual(['Done. …']);
  });
});

describe('wordCount', () => {
  it('counts contractions and hyphenated words as one, em-dashed pairs as two', () => {
    expect(wordCount("Don't stop the well-known—drummer.")).toBe(5);
    expect(wordCount('e.g. this')).toBe(2);
  });
});

describe('breathMarks', () => {
  it('finds commas, semicolons, colons and dashes inside a sentence', () => {
    const marks = breathMarks('He came, he saw; he left: quickly—and alone.');
    expect(marks.map((m) => m.kind)).toEqual(['comma', 'semicolon', 'colon', 'dash']);
    expect(marks.map((m) => m.afterWord)).toEqual([2, 4, 6, 7]);
  });
  it('ignores thousands separators, number ranges, hyphens and trailing dashes', () => {
    expect(breathMarks('It cost 1,000 crowns in 1914–18, a well-made sum—')).toEqual([{ kind: 'comma', afterWord: 6 }]);
  });
});

describe('monotonyRuns', () => {
  it('finds runs of three or more similar lengths', () => {
    expect(monotonyRuns([10, 11, 10, 12, 3, 30])).toEqual([{ from: 0, to: 3 }]);
    expect(monotonyRuns([3, 12, 40, 2])).toEqual([]);
  });
  it('allows a small absolute spread for short sentences', () => {
    expect(monotonyRuns([2, 3, 4, 4])).toEqual([{ from: 0, to: 3 }]);
  });
  it('does not let a slow drift count as one run', () => {
    const runs = monotonyRuns([10, 12, 14, 16, 18, 20, 22]);
    expect(runs.every((r) => r.to - r.from < 6)).toBe(true);
  });
});

describe('stem and echoes', () => {
  it('stems regular inflections together', () => {
    expect(stem('walking')).toBe(stem('walked'));
    expect(stem('running')).toBe('run');
    expect(stem('stories')).toBe('story');
  });
  it('reports repeated content words within the window, not function words', () => {
    const e = findEchoes([{ text: 'The dark house stood in the dark.', index: 0 }, { text: 'The house was quiet.', index: 1 }]);
    expect(e.map((x) => x.stem).sort()).toEqual(['dark', 'house']);
  });
  it('ignores repeats further apart than the window', () => {
    const filler = Array.from({ length: 50 }, (_, i) => `word${i}`).join(' ');
    expect(findEchoes([{ text: `lantern ${filler} lantern`, index: 0 }])).toEqual([]);
  });
});

describe('analyse', () => {
  it('computes rhythm stats', () => {
    const c = analyse('One two. One two three four. One two three four five six.');
    expect(c.sentences.map((s) => s.length)).toEqual([2, 4, 6]);
    expect(c.shortest).toBe(2);
    expect(c.longest).toBe(6);
    expect(c.median).toBe(4);
    expect(c.mean).toBe(4);
    expect(c.sd).toBeCloseTo(1.633, 2);
    expect(c.cv).toBeCloseTo(0.408, 2);
  });
  it('spots sentences that open the same way', () => {
    const c = analyse('We shall fight on the beaches. We shall fight in the fields. And we shall never surrender.');
    expect(c.openings).toEqual([{ opener: 'we', sentences: [0, 1] }]);
  });
  it('is safe on empty text', () => {
    const c = analyse('');
    expect(c.sentences).toEqual([]);
    expect(c.cv).toBe(0);
    expect(c.monotony).toBeNull();
  });
});
