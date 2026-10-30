import { useMemo } from 'preact/hooks';
import { HowTo, SelfCheck } from '../components/Bits';
import { useWidth } from '../components/CadenceStrip';
import { attemptId, SaveButton, useAttemptLog, useDraft } from '../components/Exercise';
import { AnswerLine, JudgeStatus, NeedsKey, ParaphraseCheck, PassageCard, pick, QuotePair, useJudge } from '../components/Judging';
import { passageById } from '../data/passages';
import { analyse, snapshot } from '../lib/cadence';
import { MASTERS, matchShape, shapeOf, type ShapeMatch, type SentenceShape } from '../lib/imitate';
import { judgeImitation } from '../lib/judges';
import { splitSentences } from '../lib/sentences';
import type { ImitationNotes } from '../lib/types';
import { apiKey, savePiece, settings } from '../state/store';

interface Draft {
  master: string;
  text: string;
  attempt: string;
}

const fresh = (prev?: Draft): Draft => ({ master: pick(MASTERS.map((p) => p.id), prev?.master), text: '', attempt: attemptId() });

const SELF = [
  'The parts come in the same order as the master’s',
  'My pauses fall in about the same places, doing the same work',
  'The weight lands where the master’s does',
  'It’s about something else, in my own words, not a word swap',
];

const GLYPH: Record<string, string> = { comma: ',', semicolon: ';', colon: ':', dash: '—' };

/**
 * Two staves: the master's sentence above, yours below, each drawn at full width so a pause sits at
 * its relative position (that's what the matching compares). Lengths are in the labels.
 */
function ShapeStaves({ master, yours, match }: { master: SentenceShape; yours: SentenceShape; match: ShapeMatch }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const W = Math.max(260, width);
  const L = W < 420 ? 52 : 70;
  const R = 14;
  const span = W - L - R;
  const x = (afterWord: number, len: number) => L + (afterWord / Math.max(1, len)) * span;
  const row = (s: SentenceShape, y: number, label: string, cls: string) => (
    <g class={cls}>
      <text class="stave-label" x={L - 10} y={y + 4} text-anchor="end">{label}</text>
      <text class="stave-label" x={L - 10} y={y + 17} text-anchor="end">{s.length}w</text>
      <line class="stave" x1={L} x2={L + span} y1={y} y2={y} />
      <circle class="stave-end" cx={L + span} cy={y} r={3.5} />
      {s.breaths.map((b) => (
        <g class="pause">
          <line x1={x(b.afterWord, s.length)} x2={x(b.afterWord, s.length)} y1={y - 9} y2={y + 9} />
          <text x={x(b.afterWord, s.length)} y={y - 13} text-anchor="middle">{GLYPH[b.kind]}</text>
        </g>
      ))}
    </g>
  );
  return (
    <div ref={ref}>
    <svg class="staves" width={W} height={120} role="img" aria-label={`Master: ${master.length} words, ${master.breaths.length} pauses. Yours: ${yours.length} words, ${yours.breaths.length} pauses.`}>
      {match.matched.map((m) => (
        <line class={`link${m.sameKind ? ' same' : ''}`} x1={x(m.master.afterWord, master.length)} x2={x(m.yours.afterWord, yours.length)} y1={44} y2={86} />
      ))}
      {row(master, 40, 'Master', 'stave-master')}
      {yours.length > 0 && row(yours, 90, 'Yours', 'stave-yours')}
    </svg>
    </div>
  );
}

export function Imitation() {
  const [d, set, replace] = useDraft<Draft>('eq.imitate.v1', () => fresh());
  const judge = useJudge<ImitationNotes>();
  const log = useAttemptLog();
  const master = passageById(d.master) ?? MASTERS[0];
  const ms = useMemo(() => shapeOf(master.text), [master]);
  const ys = useMemo(() => shapeOf(d.text), [d.text]);
  const match = matchShape(ms, ys);
  const sentences = splitSentences(d.text).length;
  const record = (judged: 'ai' | 'self' | 'none') =>
    log(d.attempt, { exercise: 'imitation', judged, passage: master.id, score: (match.lengthClose ? 0.5 : 0) + match.placement / 2 });

  const restart = () => {
    if (d.text.trim() && !confirm('Another master? Your sentence will be cleared.')) return;
    replace(fresh(d));
    judge.reset();
  };

  const getNotes = () =>
    judge.run(async (signal) => {
      const n = await judgeImitation({ apiKey: apiKey.value, model: settings.value.judge_model, signal, master: master.text, attempt: d.text.trim() });
      record('ai');
      return n;
    });

  return (
    <div>
      <div class="eyebrow"><a href="#/prose">The Prose Wing</a></div>
      <h1>Imitation</h1>
      <HowTo
        id="imitation"
        kat={<p>Borrow the skeleton, not the skin. Same length, same order, pauses in the same places; your subject, your words. The staves show both shapes; lines join pauses that line up.</p>}
        richard={
          <ol>
            <li>Read the master sentence. Notice its length, the order of its parts, and where it pauses.</li>
            <li>Write one new sentence on a completely different subject that copies that shape.</li>
            <li>The staves below stretch both sentences to the same width, so each pause sits at its place in the sentence: a third of the way in, near the end, and so on. A line joins pauses that fall in about the same place (solid if the punctuation is the same kind too). The actual lengths are in the labels.</li>
            <li>Length and pause placement are measured exactly. Clause order and where the weight lands are judged by the AI, or by you with the self-check.</li>
          </ol>
        }
      />

      <section class="panel">
        <PassageCard p={master} label="The master" />
        <div class="btn-row tight"><button onClick={restart}>Another master</button></div>
      </section>

      <section class="desk desk-short">
        <textarea class="desk-text" aria-label="Your sentence" placeholder="One sentence, a new subject, the master's shape." value={d.text}
          onInput={(e) => set({ text: (e.target as HTMLTextAreaElement).value })} />
        <div class="strip">
          <ShapeStaves master={ms} yours={ys} match={match} />
          <dl class="rhythm">
            <div><dt>Length</dt><dd>{ys.length} <small>of {ms.length}{ys.length ? (match.lengthClose ? ' · close' : ys.length < ms.length ? ' · shorter' : ' · longer') : ''}</small></dd></div>
            <div><dt>Pauses</dt><dd>{ys.breaths.length} <small>of {ms.breaths.length}</small></dd></div>
            <div><dt>Lined up</dt><dd>{match.matched.length} <small>{match.matched.filter((m) => m.sameKind).length} same kind</small></dd></div>
          </dl>
          {sentences > 1 && <p class="down small">That’s {sentences} sentences; the exercise is one.</p>}
        </div>
      </section>

      <section class="panel">
        <h2>Same bones?</h2>
        {apiKey.value ? (
          <div class="btn-row">
            <button class="btn-primary" disabled={!ys.length || judge.busy} onClick={getNotes}>{judge.result ? 'Fresh notes' : 'Get AI notes'}</button>
          </div>
        ) : (
          <>
            <NeedsKey>Without one, read both aloud, one after the other, and tick honestly:</NeedsKey>
            {ys.length > 0 && <SelfCheck key={d.attempt} items={SELF} onSubmit={() => record('self')} />}
          </>
        )}
        <JudgeStatus busy={judge.busy} error={judge.error} />
        {judge.result && (
          <div class="notes">
            <ul class="checks">
              <AnswerLine label="Clause order" a={judge.result.clause_order.answer} note={judge.result.clause_order.note} />
              <AnswerLine label="Pauses" a={judge.result.pauses.answer} note={judge.result.pauses.note} />
              <AnswerLine label="Where the weight lands" a={judge.result.weight.answer} note={judge.result.weight.note} />
              <AnswerLine label="Your own subject and words" a={judge.result.own_subject} />
            </ul>
            <QuotePair strongest={judge.result.strongest} weakest={judge.result.weakest} text={d.text} />
            <h3>Did it read as you meant?</h3>
            <ParaphraseCheck p={judge.result.paraphrase} onVerdict={(verdict) => judge.setResult({ ...judge.result!, paraphrase: { ...judge.result!.paraphrase, verdict } })} />
            <p class="muted small">Notes from {judge.result.model}.</p>
          </div>
        )}
        <div class="btn-row">
          <SaveButton key={d.attempt} disabled={!ys.length} onSave={() => {
            savePiece({ kind: 'imitation', title: `After ${master.author}`, text: d.text.trim(), before: master.text, cadence: snapshot(analyse(d.text)), meta: { passage: master.id } });
            record('none');
          }} />
        </div>
      </section>
    </div>
  );
}
