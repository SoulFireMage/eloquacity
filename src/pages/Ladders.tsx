import { HowTo, SelfCheck } from '../components/Bits';
import { attemptId, SaveButton, useAttemptLog, useDraft } from '../components/Exercise';
import { AnswerLine, JudgeStatus, NeedsKey, ParaphraseCheck, PassageCard, pick, QuotePair, useJudge } from '../components/Judging';
import { passageById } from '../data/passages';
import { analyse, snapshot } from '../lib/cadence';
import { judgeLadder } from '../lib/judges';
import { checkRung, GROW, SEEDS, SHRINK, SHRINK_SOURCES } from '../lib/ladders';
import type { LadderNotes } from '../lib/types';
import { apiKey, savePiece, settings } from '../state/store';

type Dir = 'grow' | 'shrink';

interface Draft {
  dir: Dir;
  seed: string;
  source: string;
  rungs: string[];
  attempt: string;
}

const fresh = (dir: Dir, prev?: Draft): Draft => ({
  dir,
  seed: pick(SEEDS, prev?.seed),
  source: pick(SHRINK_SOURCES.map((p) => p.id), prev?.source),
  rungs: ['', '', ''],
  attempt: attemptId(),
});

const SELF = {
  grow: [
    'Every rung is still one sentence a reader can follow to its end',
    'The longest rung has a shape: it builds, turns or lands, rather than just piling up',
    'Nothing is there only to make up the count',
    'The seed’s point is still at the centre',
  ],
  shrink: [
    'Every rung still says what the original was mainly saying',
    'The shortest rung has its own force, not just fewer words',
    'I cut detail before I cut the heart',
    'Each rung is a sentence, not a telegram (unless I meant it)',
  ],
};

export function Ladders() {
  const [d, set, replace] = useDraft<Draft>('eq.ladder.v1', () => fresh('grow'));
  const judge = useJudge<LadderNotes>();
  const log = useAttemptLog();
  const grow = d.dir === 'grow';
  const ladder = grow ? GROW : SHRINK;
  const source = passageById(d.source) ?? SHRINK_SOURCES[0];
  const start = grow ? d.seed : source.text;
  const checks = d.rungs.map((r, i) => checkRung(r, ladder[i]));
  const filled = d.rungs.filter((r) => r.trim()).length;
  const okCount = checks.filter((c, i) => d.rungs[i].trim() && c.inRange && c.oneSentence).length;
  const kind = grow ? 'ladder_grow' : 'ladder_shrink';
  const record = (judged: 'ai' | 'self' | 'none') => log(d.attempt, { exercise: kind, judged, score: okCount / 3, ...(grow ? {} : { passage: source.id }) });

  const restart = (dir: Dir) => {
    if (d.rungs.some((r) => r.trim()) && !confirm('Start a new ladder? These rungs will be cleared.')) return;
    replace(fresh(dir, d));
    judge.reset();
  };
  const setRung = (i: number, v: string) => set({ rungs: d.rungs.map((r, j) => (j === i ? v : r)) });

  const getNotes = () =>
    judge.run(async (signal) => {
      const n = await judgeLadder({
        apiKey: apiKey.value, model: settings.value.judge_model, signal,
        direction: d.dir, start, rungs: d.rungs.map((r) => r.trim()), targets: ladder.map((r) => r.label),
      });
      record('ai');
      return n;
    });

  return (
    <div>
      <div class="eyebrow"><a href="#/prose">The Prose Wing</a></div>
      <h1>Grow and Shrink</h1>
      <HowTo
        id="ladders"
        kat={<p>Grow: 6 → 20 → 40 → 60+, one sentence each time, still breathing. Shrink: a master’s long sentence → 25 → 12 → 6, heart intact. The counts are exact; “still alive?” is the real test.</p>}
        richard={
          <ol>
            <li>Choose Grow or Shrink.</li>
            <li>Grow: start from a six-word seed and rewrite it as one sentence of about 20 words, then about 40, then 60 or more.</li>
            <li>Shrink: start from a long sentence by a master and rewrite it at about 25 words, then 12, then 6.</li>
            <li>Each rung must be a single sentence in its word range; the counter checks this as you type. “Copy the rung above” starts you from your last version.</li>
            <li>Then ask whether each rung is still alive and still has the heart of the original: AI notes, or the honest self-check.</li>
          </ol>
        }
      />

      <div class="seg" role="group" aria-label="Direction" style={{ marginBottom: '14px' }}>
        <button aria-pressed={grow} onClick={() => !grow && restart('grow')}>Grow</button>
        <button aria-pressed={!grow} onClick={() => grow && restart('shrink')}>Shrink</button>
      </div>

      <section class="panel">
        {grow ? (
          <>
            <span class="label">The seed</span>
            <p class="deal-big">{d.seed}</p>
          </>
        ) : (
          <PassageCard p={source} label="The original" />
        )}
        <div class="btn-row tight"><button onClick={() => restart(d.dir)}>{grow ? 'New seed' : 'Another sentence'}</button></div>
      </section>

      {ladder.map((rung, i) => {
        const c = checks[i];
        const has = !!d.rungs[i].trim();
        return (
          <section class="panel rung">
            <div class="rung-head">
              <span class="label">Rung {i + 1}: {rung.label}</span>
              {has && (
                <span class={`rung-count ${c.inRange && c.oneSentence ? 'up' : 'down'}`}>
                  {c.words} words{c.oneSentence ? '' : ` · ${c.sentences} sentences (needs one)`}{c.inRange && c.oneSentence ? ' ✓' : ''}
                </span>
              )}
            </div>
            <textarea aria-label={`Rung ${i + 1}`} value={d.rungs[i]} onInput={(e) => setRung(i, (e.target as HTMLTextAreaElement).value)}
              placeholder={i === 0 ? (grow ? 'Grow the seed into one sentence of about 20 words.' : 'Cut it to one sentence of about 25 words.') : ''} />
            <div class="btn-row tight">
              <button class="btn-quiet" onClick={() => setRung(i, i === 0 ? start : d.rungs[i - 1])} disabled={!!d.rungs[i].trim()}>
                {i === 0 ? `Copy the ${grow ? 'seed' : 'original'}` : 'Copy the rung above'}
              </button>
            </div>
            <WordBar words={c.words} rung={rung} />
          </section>
        );
      })}

      <section class="panel">
        <h2>Still alive?</h2>
        {apiKey.value ? (
          <div class="btn-row">
            <button class="btn-primary" disabled={filled < 3 || judge.busy} onClick={getNotes}>{judge.result ? 'Fresh notes' : 'Get AI notes'}</button>
            {filled < 3 && <span class="muted small">Fill all three rungs first.</span>}
          </div>
        ) : (
          <>
            <NeedsKey>Without one, read the rungs aloud in order and tick honestly:</NeedsKey>
            {filled === 3 && <SelfCheck key={d.attempt} items={SELF[d.dir]} onSubmit={() => record('self')} />}
          </>
        )}
        <JudgeStatus busy={judge.busy} error={judge.error} />
        {judge.result && (
          <div class="notes">
            <p class="aim-note"><span class="label">The heart, as the judge sees it</span>{judge.result.heart}</p>
            <ul class="checks">
              {judge.result.rungs.map((r, i) => (
                <li>
                  <span class="label">Rung {i + 1}</span>
                  <ul class="checks inner">
                    <AnswerLine label="Still alive" a={r.alive} />
                    <AnswerLine label="Heart kept" a={r.heart_kept} note={r.why} />
                  </ul>
                </li>
              ))}
            </ul>
            <QuotePair strongest={judge.result.strongest} weakest={judge.result.weakest} text={d.rungs.join('\n')} />
            <h3>Did the last rung read as you meant?</h3>
            <ParaphraseCheck
              p={judge.result.paraphrase}
              compareWith={grow ? undefined : { label: 'The original', text: source.text }}
              question={grow ? 'Is that what you meant?' : 'Does it still say what the original said, at heart?'}
              onVerdict={(verdict) => judge.setResult({ ...judge.result!, paraphrase: { ...judge.result!.paraphrase, verdict } })}
            />
            <p class="muted small">Notes from {judge.result.model}.</p>
          </div>
        )}
        <div class="btn-row">
          <SaveButton key={d.attempt} disabled={filled === 0} onSave={() => {
            const text = d.rungs.filter((r) => r.trim()).join('\n\n');
            savePiece({
              kind, title: grow ? `Grown from “${d.seed}”` : `Shrunk from ${source.author}`, text, before: start, cadence: snapshot(analyse(text)),
              ...(grow ? {} : { meta: { passage: source.id } }),
            });
            record('none');
          }} />
        </div>
      </section>
    </div>
  );
}

/** A thin bar: the rung's word range, with a marker where you are. */
function WordBar({ words, rung }: { words: number; rung: { min: number; max: number } }) {
  const top = Number.isFinite(rung.max) ? Math.max(rung.max * 1.6, words) : Math.max(rung.min * 1.5, words);
  const pct = (n: number) => `${Math.min(100, (n / top) * 100)}%`;
  const hi = Number.isFinite(rung.max) ? rung.max : top;
  return (
    <div class="wordbar" aria-hidden="true">
      <i class="range" style={{ left: pct(rung.min), width: `calc(${pct(hi)} - ${pct(rung.min)})` }} />
      {words > 0 && <i class="you" style={{ left: pct(words) }} />}
    </div>
  );
}
