import { useMemo } from 'preact/hooks';
import { HowTo, SelfCheck } from '../components/Bits';
import { CadenceStrip } from '../components/CadenceStrip';
import { attemptId, SaveButton, useAttemptLog, useDraft } from '../components/Exercise';
import { AnswerLine, JudgeStatus, NeedsKey, ParaphraseCheck, PassageCard, pick, QuotePair, useJudge } from '../components/Judging';
import { DIAL, DIAL_SOURCES, TARGET_SETTINGS, type DialSetting } from '../data/dial';
import { PASSAGES } from '../data/passages';
import { analyse, snapshot } from '../lib/cadence';
import { judgeDial, registerAim } from '../lib/judges';
import type { DialNotes, ParaphraseVerdict } from '../lib/types';
import { apiKey, savePiece, settings } from '../state/store';

interface Draft {
  source: string;
  settings: DialSetting[];
  texts: Record<string, string>;
  attempt: string;
}

const fresh = (prev?: Draft): Draft => ({
  source: pick(DIAL_SOURCES.map((s) => s.id), prev?.source),
  settings: prev?.settings ?? [5],
  texts: {},
  attempt: attemptId(),
});

const label = (n: number) => DIAL.find((x) => x.n === n)!.label;

const SELF = [
  'It sits at the setting I chose, not one step towards neutral',
  'However far it goes, I can still follow it on one reading',
  'The source’s facts are all still there (nothing lost, nothing invented)',
  'It sounds like a voice, not a costume',
];

export function RegisterDial() {
  const [d, set, replace] = useDraft<Draft>('eq.dial.v1', () => fresh());
  const judge = useJudge<DialNotes>();
  const log = useAttemptLog();
  const source = DIAL_SOURCES.find((s) => s.id === d.source) ?? DIAL_SOURCES[0];
  const chosen = TARGET_SETTINGS.filter((n) => d.settings.includes(n));
  const written = chosen.filter((n) => d.texts[n]?.trim());
  // One master per setting, for the self-check comparison.
  const models = useMemo(() => Object.fromEntries(TARGET_SETTINGS.map((n) => [n, pick(PASSAGES.filter((p) => p.register === n))])), [d.attempt]);
  const record = (judged: 'ai' | 'self' | 'none') => log(d.attempt, { exercise: 'register_dial', judged, registers: written });

  const toggle = (n: DialSetting) => set({ settings: d.settings.includes(n) ? d.settings.filter((x) => x !== n) : [...d.settings, n] });
  const restart = () => {
    if (written.length && !confirm('New paragraph? Your rewrites will be cleared.')) return;
    replace(fresh(d));
    judge.reset();
  };

  const getNotes = () =>
    judge.run(async (signal) => {
      const n = await judgeDial({ apiKey: apiKey.value, model: settings.value.judge_model, signal, rewrites: written.map((setting) => ({ setting, text: d.texts[setting].trim() })) });
      record('ai');
      return n;
    });

  const setVerdict = (i: number, verdict: ParaphraseVerdict) =>
    judge.result && judge.setResult({ ...judge.result, rewrites: judge.result.rewrites.map((r, j) => (j === i ? { ...r, paraphrase: { ...r.paraphrase, verdict } } : r)) });

  return (
    <div>
      <div class="eyebrow"><a href="#/prose">The Prose Wing</a></div>
      <h1>The Register Dial</h1>
      <HowTo
        id="register_dial"
        kat={<p>Same paragraph, different voice. Turn the dial: blunt, brisk, lush, ultraviolet. Register moves; meaning stays put. The judge reads your rewrite blind and says what it heard; you check that against the source.</p>}
        richard={
          <ol>
            <li>Here’s a plain paragraph. It sits at 3, neutral: the baseline, never the target.</li>
            <li>Choose one or more settings: 1 blunt and vivid, 2 brisk, 4 lush, 5 ultraviolet.</li>
            <li>Rewrite the paragraph at each setting you chose. Keep its facts; change everything about how they’re said.</li>
            <li>The judge scores each rewrite only against its own setting (“is this ultraviolet enough, and still under control?”), never against taste.</li>
            <li>It also paraphrases each rewrite without seeing the source. Compare its paraphrase with the source: if they match, the meaning survived the dial. If not, decide whether it drifted or whether the ambiguity is deliberate.</li>
          </ol>
        }
      />

      <section class="panel">
        <span class="label">Setting 3, the baseline: {source.title}</span>
        <p class="source-para">{source.text}</p>
        <div class="btn-row tight"><button onClick={restart}>Another paragraph</button></div>
      </section>

      <section class="panel">
        <span class="label">Turn the dial</span>
        <div class="dial" role="group" aria-label="Register settings">
          {DIAL.map((s) =>
            s.n === 3 ? (
              <div class="dial-step baseline" title={s.brief}><span class="dial-n">3</span><span>{s.label}</span><small>baseline</small></div>
            ) : (
              <button class="dial-step" aria-pressed={d.settings.includes(s.n as DialSetting)} onClick={() => toggle(s.n as DialSetting)} title={s.brief}>
                <span class="dial-n">{s.n}</span><span>{s.label}</span>
              </button>
            ),
          )}
        </div>
        <p class="muted small">Pick one, or several to rewrite the same paragraph at each.</p>
      </section>

      {chosen.map((n) => {
        const text = d.texts[n] ?? '';
        return (
          <section class="desk desk-short dial-desk">
            <span class="label">Setting {n}: {label(n)}</span>
            <p class="muted small" style={{ margin: 0 }}>{DIAL.find((x) => x.n === n)!.brief}</p>
            <textarea class="desk-text" aria-label={`Rewrite at setting ${n}`} value={text} placeholder={`Rewrite the paragraph at ${label(n).toLowerCase()}.`}
              onInput={(e) => set({ texts: { ...d.texts, [n]: (e.target as HTMLTextAreaElement).value } })} />
            <DeskStrip text={text} />
          </section>
        );
      })}

      <section class="panel">
        <h2>On the dial?</h2>
        {apiKey.value ? (
          <div class="btn-row">
            <button class="btn-primary" disabled={!written.length || judge.busy} onClick={getNotes}>{judge.result ? 'Fresh notes' : 'Get AI notes'}</button>
          </div>
        ) : (
          <>
            <NeedsKey>Without one, compare with a master at the same setting and tick honestly:</NeedsKey>
            {written.map((n) => <PassageCard p={models[n]} label={`A master at about setting ${n}, ${label(n).toLowerCase()}`} />)}
            {written.length > 0 && <SelfCheck key={d.attempt} items={SELF} onSubmit={() => record('self')} />}
          </>
        )}
        <JudgeStatus busy={judge.busy} error={judge.error} />
        {judge.result?.rewrites.map((r, i) => (
          <div class="notes dial-notes">
            <h3>Setting {r.setting}: {label(r.setting)}</h3>
            <ul class="checks">
              <AnswerLine label={`${label(r.setting)} enough`} a={r.register_hit} />
              <AnswerLine label="Still under control" a={r.under_control} note={r.note} />
            </ul>
            <QuotePair strongest={r.strongest} weakest={r.weakest} text={d.texts[r.setting] ?? ''} />
            <ParaphraseCheck
              p={r.paraphrase}
              compareWith={{ label: 'The source said', text: source.text }}
              question="Did the meaning survive the dial?"
              labels={['Same meaning', 'It drifted', 'Ambiguous on purpose']}
              messages={{
                matched: 'Register moved; meaning held. That’s control.',
                misread: 'The meaning drifted between the source and the rewrite. Find where the paraphrase parts from the source: that’s the phrase that changed what is said, not just how.',
              }}
              onVerdict={(v) => setVerdict(i, v)}
            />
          </div>
        ))}
        {judge.result && <p class="muted small">Notes from {judge.result.model}. Each rewrite was judged against: {written.map((n) => registerAim(n as 1 | 2 | 4 | 5).split(':')[0]).join('; ')}.</p>}
        <div class="btn-row">
          <SaveButton key={d.attempt} disabled={!written.length} label={written.length > 1 ? `Save ${written.length} rewrites to portfolio` : 'Save to portfolio'} onSave={() => {
            for (const n of written) {
              const text = d.texts[n].trim();
              savePiece({ kind: 'register_dial', title: `${source.title}, at ${label(n).toLowerCase()}`, text, before: source.text, aim: registerAim(n as 1 | 2 | 4 | 5), cadence: snapshot(analyse(text)), meta: { register: n, source: source.id } });
            }
            record('none');
          }} />
        </div>
      </section>
    </div>
  );
}

function DeskStrip({ text }: { text: string }) {
  const c = useMemo(() => analyse(text), [text]);
  return <CadenceStrip cadence={c} />;
}
