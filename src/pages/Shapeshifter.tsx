import { useMemo } from 'preact/hooks';
import { HowTo, SelfCheck } from '../components/Bits';
import { CadenceStrip } from '../components/CadenceStrip';
import { attemptId, SaveButton, useAttemptLog, useDraft } from '../components/Exercise';
import { JudgeStatus, NeedsKey, NotesView, PassageCard, pick, useJudge } from '../components/Judging';
import { PASSAGES } from '../data/passages';
import { analyse, sketchCadence, snapshot } from '../lib/cadence';
import { judgePiece, SELF_CHECK, SHAPE_CHECKLIST } from '../lib/judges';
import { allMet, SUBJECTS, targetById, TARGETS } from '../lib/shapes';
import type { JudgeNotes, ParaphraseVerdict } from '../lib/types';
import { apiKey, savePiece, settings } from '../state/store';

interface Draft {
  target: string;
  subject: string;
  text: string;
  attempt: string;
}

const deal = (prev?: Draft): Draft => ({
  target: pick(TARGETS, prev && targetById(prev.target)).id,
  subject: pick(SUBJECTS, prev?.subject),
  text: '',
  attempt: attemptId(),
});

export function Shapeshifter() {
  const [d, set, replace] = useDraft<Draft>('eq.shape.v1', () => deal());
  const judge = useJudge<JudgeNotes>();
  const log = useAttemptLog();
  const target = targetById(d.target) ?? TARGETS[0];
  const cadence = useMemo(() => analyse(d.text), [d.text]);
  const ghost = useMemo(() => sketchCadence(target.sketch), [target]);
  const items = target.check(cadence);
  const met = allMet(items);
  const score = items.filter((i) => i.ok).length / items.length;
  // A master who hit this shape, if the bank has one.
  const model = useMemo(() => PASSAGES.find((p) => allMet(target.check(analyse(p.text)))), [target]);
  const aim = `Shapeshifter. Target shape: ${target.label} (${target.brief}) Subject: ${d.subject}. The shape is checked separately by counting words; judge whether the writing moves and lands within that shape, on that subject. Fragmentary, breathless or blunt writing is the point when the shape asks for it.`;
  const record = (judged: 'ai' | 'self' | 'none') => log(d.attempt, { exercise: 'shapeshifter', judged, shape: target.id, score, cadence: snapshot(cadence) });

  const redeal = (keepTarget = false) => {
    if (d.text.trim() && !confirm('Start a new one? This draft will be cleared.')) return;
    const next = deal(d);
    replace(keepTarget ? { ...next, target: d.target } : next);
    judge.reset();
  };

  const getNotes = () =>
    judge.run(async (signal) => {
      const n = await judgePiece({ apiKey: apiKey.value, model: settings.value.judge_model, text: d.text, aim, cadence, checklist: SHAPE_CHECKLIST, signal });
      record('ai');
      return n;
    });

  const setVerdict = (i: number, verdict: ParaphraseVerdict) =>
    judge.result && judge.setResult({ ...judge.result, paraphrases: judge.result.paraphrases.map((p, j) => (j === i ? { ...p, verdict } : p)) });

  return (
    <div>
      <div class="eyebrow"><a href="#/prose">The Prose Wing</a></div>
      <h1>Shapeshifter</h1>
      <HowTo
        id="shapeshifter"
        kat={<p>Shape dealt. Subject dealt. Hit the shape; the ticks go green when the counts are right. Then the real question: does it move inside that shape?</p>}
        richard={
          <ol>
            <li>You’re dealt a target shape (for example, two short sentences then a long one) and a subject.</li>
            <li>Write about the subject in that shape. The hollow notes on the strip show the target; your sentences appear as solid notes over them.</li>
            <li>The checklist counts words and sentences as you type. It’s exact, and it only checks the shape.</li>
            <li>Whether it’s any good inside the shape is a separate question: ask for AI notes, or tick the self-check honestly.</li>
          </ol>
        }
      />

      <section class="panel deal">
        <div class="deal-row">
          <div>
            <span class="label">Your shape</span>
            <p class="deal-big">{target.label}</p>
            <p class="muted small">{target.brief}</p>
          </div>
          <div>
            <span class="label">Your subject</span>
            <p class="deal-big">{d.subject}</p>
          </div>
        </div>
        <div class="btn-row tight">
          <button onClick={() => redeal()}>Deal again</button>
          <button class="btn-quiet" onClick={() => redeal(true)}>Same shape, new subject</button>
        </div>
      </section>

      <section class="desk desk-short">
        <textarea class="desk-text" aria-label="Your attempt" placeholder={`Write about ${d.subject}, in the shape: ${target.label}.`}
          value={d.text} onInput={(e) => set({ text: (e.target as HTMLTextAreaElement).value })} />
        <CadenceStrip cadence={cadence} ghost={ghost} />
      </section>

      <section class="panel">
        <h2>The shape {met ? <span class="up">✓ met</span> : null}</h2>
        <ul class="checks">
          {items.map((i) => (
            <li class={i.ok ? 'ans-yes' : 'ans-no'}>
              <span class="mark">{i.ok ? '✓' : '✗'}</span> {i.label}{i.found !== undefined && <span class="muted"> (found {i.found})</span>}
            </li>
          ))}
        </ul>

        <h2>Does it move?</h2>
        {apiKey.value ? (
          <div class="btn-row">
            <button class="btn-primary" disabled={!cadence.words || judge.busy} onClick={getNotes}>{judge.result ? 'Fresh notes' : 'Get AI notes'}</button>
          </div>
        ) : (
          <>
            <NeedsKey>Without one, compare with a master and tick honestly:</NeedsKey>
            {model && <PassageCard p={model} label="A master who hit this shape" />}
            {cadence.words > 0 && <SelfCheck key={d.attempt} items={SELF_CHECK} onSubmit={() => record('self')} />}
          </>
        )}
        <JudgeStatus busy={judge.busy} error={judge.error} />
        {judge.result && <NotesView notes={judge.result} text={d.text} onVerdict={setVerdict} />}
        {judge.result && model && <PassageCard p={model} label="For comparison: a master who hit this shape" />}

        <div class="btn-row">
          <SaveButton key={d.attempt} disabled={!cadence.words} onSave={() => {
            savePiece({ kind: 'shapeshifter', title: `${target.label}: ${d.subject}`, text: d.text, aim, cadence: snapshot(cadence), meta: { target: target.id }, ...(judge.result ? { notes: judge.result } : {}) });
            record('none');
          }} />
        </div>
      </section>
    </div>
  );
}
