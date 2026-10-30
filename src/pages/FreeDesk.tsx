import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { CadenceStrip } from '../components/CadenceStrip';
import { Busy, HowTo, SelfCheck } from '../components/Bits';
import { analyse, snapshot } from '../lib/cadence';
import { NotesView } from '../components/Judging';
import { AIMS, aimText, judgePiece, rewriteOnRequest, SELF_CHECK, type AimId } from '../lib/judges';
import { errorMessage } from '../lib/cloud';
import { newId } from '../lib/telemetry';
import type { JudgeNotes, ParaphraseVerdict } from '../lib/types';
import { apiKey, logPractice, savePiece, settings, storeTranscript, telemetry, updatePiece } from '../state/store';

const DRAFT_KEY = 'eq.desk_draft.v1';

interface Draft {
  title: string;
  text: string;
  aim: AimId;
  own: string;
  pieceId?: string;
}

const readDraft = (): Draft => {
  try {
    return { title: '', text: '', aim: 'unstated', own: '', ...JSON.parse(localStorage.getItem(DRAFT_KEY) ?? '{}') };
  } catch {
    return { title: '', text: '', aim: 'unstated', own: '' };
  }
};

export function FreeDesk() {
  const [d, setD] = useState<Draft>(readDraft);
  const [notes, setNotes] = useState<JudgeNotes | null>(null);
  const [busy, setBusy] = useState<'' | 'notes' | 'rewrite'>('');
  const [error, setError] = useState('');
  const [rewrite, setRewrite] = useState('');
  const [selfTicks, setSelfTicks] = useState<string[] | null>(null);
  const selfDone = selfTicks !== null;
  const taRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    } catch {
      /* ignore */
    }
  }, [d]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const cadence = useMemo(() => analyse(d.text), [d.text]);
  const saved = d.pieceId ? telemetry.value.pieces.find((p) => p.id === d.pieceId) : undefined;
  const dirty = !saved || saved.text !== d.text || saved.title !== (d.title.trim() || untitled(d.text));
  const aim = aimText(d.aim, d.own);
  const set = (patch: Partial<Draft>) => setD((prev) => ({ ...prev, ...patch }));

  const pick = (s: { start: number; end: number }) => {
    const ta = taRef.current;
    if (!ta) return;
    ta.focus();
    ta.setSelectionRange(s.start, s.end);
  };

  const save = () => {
    const title = d.title.trim() || untitled(d.text);
    const fields = { title, text: d.text, aim, cadence: snapshot(cadence), ...(notes ? { notes } : {}), ...(selfTicks ? { self_check: selfTicks } : {}) };
    if (saved) {
      updatePiece(saved.id, { ...fields, before: saved.before ?? (saved.text !== d.text ? saved.text : undefined) });
    } else {
      const p = savePiece({ kind: 'free_desk', ...fields });
      set({ pieceId: p.id });
    }
    logPractice({ exercise: 'free_desk', judged: notes ? 'ai' : selfDone ? 'self' : 'none', cadence: snapshot(cadence) });
  };

  const getNotes = async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setBusy('notes');
    setError('');
    setRewrite('');
    try {
      const n = await judgePiece({ apiKey: apiKey.value, model: settings.value.judge_model, text: d.text, aim, cadence, signal: ac.signal });
      setNotes(n);
      storeTranscript({ id: newId('desk'), date: new Date().toISOString(), exercise: 'free_desk', text: d.text, aim, reply: n });
      if (saved && !dirty) updatePiece(saved.id, { notes: n });
    } catch (e) {
      if (!ac.signal.aborted) setError(errorMessage(e));
    } finally {
      setBusy('');
    }
  };

  const getRewrite = async () => {
    setBusy('rewrite');
    setError('');
    try {
      setRewrite(await rewriteOnRequest({ apiKey: apiKey.value, model: settings.value.judge_model, text: d.text, aim }));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy('');
    }
  };

  const setVerdict = (i: number, verdict: ParaphraseVerdict) => {
    if (!notes) return;
    const next = { ...notes, paraphrases: notes.paraphrases.map((p, j) => (j === i ? { ...p, verdict, matched: undefined } : p)) };
    setNotes(next);
    if (saved && !dirty) updatePiece(saved.id, { notes: next });
  };

  const clear = () => {
    if (d.text && !confirm('Clear the desk? Saved pieces stay in your portfolio.')) return;
    setD({ title: '', text: '', aim: d.aim, own: d.own });
    setNotes(null);
    setRewrite('');
    setSelfTicks(null);
    setError('');
  };

  const hasText = cadence.words > 0;

  return (
    <div>
      <div class="eyebrow">The Prose Wing</div>
      <h1>The Free Desk</h1>
      <HowTo
        id="free_desk"
        kat={<p>Write. Watch the notes rise and fall underneath. Flat line = monotone; jagged = alive, if you meant it. Ticks are breaths. Arcs are ruts. AI notes, if you want them, judge against <em>your</em> aim, not some house style.</p>}
        richard={
          <ol>
            <li>Write or paste anything into the desk. It’s saved as a draft in this browser as you type.</li>
            <li>Under the text, the cadence strip draws one note per sentence; the note’s height is the sentence’s length in words. Small ticks on a note show its internal pauses (commas, semicolons, colons, dashes).</li>
            <li>An arc over several notes means those sentences are all about the same length. That isn’t wrong, but it’s worth knowing.</li>
            <li>Below the strip: shortest, longest, middle length, and the spread (how much lengths vary). Words repeated close together and sentences that start the same way are listed, not penalised.</li>
            <li>Optionally pick an aim and ask for AI notes (needs your OpenRouter key). The notes paraphrase your longest sentences so you can check they read as you meant, and quote your strongest and weakest phrase. They never rewrite you unless you ask.</li>
            <li>Save the piece to your portfolio. Saving again after edits keeps the first version as a “before”.</li>
          </ol>
        }
      />

      <section class="desk">
        <input
          class="desk-title"
          type="text"
          placeholder="Untitled"
          aria-label="Title"
          value={d.title}
          onInput={(e) => set({ title: (e.target as HTMLInputElement).value })}
        />
        <textarea
          ref={taRef}
          class="desk-text"
          aria-label="Your prose"
          placeholder="Write anything. The strip below follows you."
          value={d.text}
          spellcheck
          onInput={(e) => set({ text: (e.target as HTMLTextAreaElement).value })}
        />
        <CadenceStrip cadence={cadence} onPick={pick} />
      </section>

      <div class="btn-row">
        <button class="btn-primary" disabled={!hasText || !dirty} onClick={save}>
          {saved ? (dirty ? 'Update saved piece' : 'Saved') : 'Save to portfolio'}
        </button>
        {saved && <a class="btn btn-quiet" href="#/portfolio">Portfolio →</a>}
        <button class="btn-quiet" onClick={clear} disabled={!d.text && !d.title}>Clear desk</button>
      </div>

      <section class="panel" style={{ marginTop: '22px' }}>
        <h2>Notes</h2>
        <div class="field">
          <label>Aim for this piece</label>
          <div class="seg seg-wrap" role="group" aria-label="Aim">
            {AIMS.map((a) => <button aria-pressed={d.aim === a.id} onClick={() => set({ aim: a.id })}>{a.label}</button>)}
          </div>
          {d.aim === 'own' && (
            <input type="text" style={{ marginTop: '8px' }} placeholder="e.g. one breathless sentence that never loses its thread" aria-label="Your aim in your own words"
              value={d.own} onInput={(e) => set({ own: (e.target as HTMLInputElement).value })} />
          )}
          <small>The notes judge against this aim, not against “good taste”. There’s no neutral setting: plain competence isn’t the target here.</small>
        </div>

        {apiKey.value ? (
          <div class="btn-row">
            <button class="btn-primary" disabled={!hasText || !!busy} onClick={getNotes}>{notes ? 'Fresh notes' : 'Get AI notes'}</button>
          </div>
        ) : (
          <>
            <p class="muted">AI notes need an <a href="#/settings">OpenRouter key</a>. Without one, read it aloud and tick honestly:</p>
            {hasText && !selfDone && <SelfCheck items={SELF_CHECK} onSubmit={setSelfTicks} />}
            {selfDone && <p class="up">Self-check recorded. It’s kept with the piece when you save.</p>}
          </>
        )}
        {busy === 'notes' && <Busy label="Reading…" />}
        {error && <div class="notice bad">{error}</div>}
        {notes && <NotesView notes={notes} text={d.text} onVerdict={setVerdict} />}
        {notes && (
          <div class="rewrite">
            {!rewrite && (
              <button class="btn-quiet" disabled={!!busy} onClick={getRewrite}>Show me one possible version (in the model’s voice)</button>
            )}
            {busy === 'rewrite' && <Busy label="Writing…" />}
            {rewrite && (
              <div class="panel inset">
                <div class="eyebrow">One possible version, in the model’s voice, not yours</div>
                <p class="muted small">Read it for ideas, then close it. Copying it drags your voice toward the model’s.</p>
                <div class="prose">{rewrite.split(/\n{2,}/).map((p) => <p>{p}</p>)}</div>
                <button class="btn-quiet" onClick={() => setRewrite('')}>Close</button>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

const untitled = (text: string) => {
  const first = text.trim().split(/\s+/).slice(0, 6).join(' ');
  return first ? `${first}…` : 'Untitled';
};
