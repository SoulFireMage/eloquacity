import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { citation, gutenbergUrl, type Passage } from '../data/passages';
import { errorMessage } from '../lib/cloud';
import { quoteFound } from '../lib/judges';
import { verdictOf, type Answer, type JudgeNotes, type Paraphrase, type ParaphraseVerdict, type Quoted } from '../lib/types';
import { apiKey } from '../state/store';
import { Busy } from './Bits';

/** Run one judge call at a time, abortable, with busy and error state. */
export function useJudge<T>() {
  const [result, setResult] = useState<T | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ac = useRef<AbortController | null>(null);
  useEffect(() => () => ac.current?.abort(), []);
  const run = async (fn: (signal: AbortSignal) => Promise<T>) => {
    ac.current?.abort();
    const c = new AbortController();
    ac.current = c;
    setBusy(true);
    setError('');
    try {
      const r = await fn(c.signal);
      if (!c.signal.aborted) setResult(r);
      return r;
    } catch (e) {
      if (!c.signal.aborted) setError(errorMessage(e));
      return null;
    } finally {
      if (ac.current === c) setBusy(false);
    }
  };
  const reset = () => {
    ac.current?.abort();
    setResult(null);
    setError('');
    setBusy(false);
  };
  return { result, setResult, busy, error, run, reset };
}

const ANSWER: Record<Answer, string> = { yes: '✓', partly: '◐', no: '✗' };

export function AnswerMark({ a }: { a: Answer }) {
  return <span class={`mark ans-${a}`} aria-label={a}>{ANSWER[a]}</span>;
}

export function AnswerLine({ label, a, note }: { label: string; a: Answer; note?: string }) {
  return (
    <li class={`ans-${a}`}>
      <AnswerMark a={a} /> <strong>{label}</strong>{note && <span class="muted"> {note}</span>}
    </li>
  );
}

export function QuotePair({ strongest, weakest, text }: { strongest: Quoted; weakest: Quoted; text: string }) {
  return (
    <div class="grid grid-2">
      {([['Strongest phrase', strongest, 'good'], ['Weakest phrase', weakest, 'weak']] as const).map(([label, q, cls]) => (
        <div class={`quote-card ${cls}`}>
          <span class="label">{label}</span>
          <blockquote>{q.quote}</blockquote>
          <p>{q.why}</p>
          {!quoteFound(q.quote, text) && <small class="muted">(No longer in your text.)</small>}
        </div>
      ))}
    </div>
  );
}

const VERDICT_TEXT: Record<ParaphraseVerdict, { cls: string; text: string }> = {
  matched: { cls: 'up', text: 'It parsed.' },
  misread: { cls: 'down', text: 'Then this is unclear on a first reading. Compare the paraphrase with your meaning: where they part is where the reader was lost.' },
  ambiguous: { cls: 'muted', text: 'Noted: the ambiguity is yours on purpose. The reading above is one a reader will take.' },
};

/**
 * The comprehension test. The writer decides: matched, misread, or ambiguous on purpose
 * (the judge can't know intent). `compareWith` shows what the paraphrase should match,
 * e.g. the Register Dial's source paragraph.
 */
export function ParaphraseCheck({
  p,
  onVerdict,
  compareWith,
  question = 'Is that what you meant?',
  labels = ['Yes, that’s it', 'No, it misread me', 'Ambiguous on purpose'],
  messages = {},
}: {
  p: Paraphrase;
  onVerdict?: (v: ParaphraseVerdict) => void;
  compareWith?: { label: string; text: string };
  question?: string;
  labels?: [string, string, string];
  messages?: Partial<Record<ParaphraseVerdict, string>>;
}) {
  const v = verdictOf(p);
  return (
    <div class="paraphrase">
      {!compareWith && <p class="orig">{p.sentence}</p>}
      <p class="para"><span class="label">Read as</span>{p.paraphrase}</p>
      {compareWith && <p class="orig"><span class="label">{compareWith.label}</span>{compareWith.text}</p>}
      {onVerdict && (
        <>
          <p class="small muted" style={{ margin: '4px 0 0' }}>{question}</p>
          <div class="btn-row tight">
            <button aria-pressed={v === 'matched'} onClick={() => onVerdict('matched')}>{labels[0]}</button>
            <button aria-pressed={v === 'misread'} onClick={() => onVerdict('misread')}>{labels[1]}</button>
            <button aria-pressed={v === 'ambiguous'} onClick={() => onVerdict('ambiguous')} title="Deliberately open to more than one reading">{labels[2]}</button>
          </div>
        </>
      )}
      {v && <p class={`${VERDICT_TEXT[v].cls} small`}>{messages[v] ?? VERDICT_TEXT[v].text}</p>}
    </div>
  );
}

export function NotesView({ notes, text, onVerdict }: { notes: JudgeNotes; text: string; onVerdict?: (i: number, v: ParaphraseVerdict) => void }) {
  return (
    <div class="notes">
      <p class="aim-note"><span class="label">Against the aim</span>{notes.aim_note}</p>
      <QuotePair strongest={notes.strongest} weakest={notes.weakest} text={text} />
      <h3>Did it read as you meant?</h3>
      <p class="muted small">The model paraphrased your longest sentences after one reading. A wrong paraphrase means the sentence didn’t carry your meaning; a right one means it parsed, however long it is.</p>
      {notes.paraphrases.map((p, i) => <ParaphraseCheck p={p} onVerdict={onVerdict && ((v) => onVerdict(i, v))} />)}
      <ul class="checks">{notes.checklist.map((c) => <AnswerLine label={c.item} a={c.answer} />)}</ul>
      <p class="muted small">Notes from {notes.model}, judged against: {notes.aim}</p>
    </div>
  );
}

/** A public-domain passage with its source and the editor's note. */
export function PassageCard({ p, label = 'From the bank', showText = true, children }: { p: Passage; label?: string; showText?: boolean; children?: ComponentChildren }) {
  return (
    <figure class="passage">
      <span class="label">{label}</span>
      {showText && <blockquote>{p.text}</blockquote>}
      {children}
      <figcaption>
        {citation(p)} · <a href={gutenbergUrl(p)} target="_blank" rel="noopener noreferrer">Project Gutenberg #{p.gutenberg}</a>
        <span class="ed-note" title="Editor's note: a judgement, not a fact about the text"> · {p.note}</span>
      </figcaption>
    </figure>
  );
}

/** Shown in place of the judge button when there's no key. */
export function NeedsKey({ children }: { children?: ComponentChildren }) {
  if (apiKey.value) return null;
  return <p class="muted small">AI notes need an <a href="#/settings">OpenRouter key</a>. {children}</p>;
}

export function JudgeStatus({ busy, error, label = 'Reading…' }: { busy: boolean; error: string; label?: string }) {
  return (
    <>
      {busy && <Busy label={label} />}
      {error && <div class="notice bad">{error}</div>}
    </>
  );
}

export const pick = <T,>(xs: readonly T[], not?: T): T => {
  const pool = xs.length > 1 && not !== undefined ? xs.filter((x) => x !== not) : xs;
  return pool[Math.floor(Math.random() * pool.length)];
};
