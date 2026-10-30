import { useMemo } from 'preact/hooks';
import { HowTo } from '../components/Bits';
import { attemptId, useAttemptLog, useDraft } from '../components/Exercise';
import { PassageCard, pick } from '../components/Judging';
import { passageById } from '../data/passages';
import { compare, RESTORE_SOURCES, strip, tokenise, type Comparison, type GapResult } from '../lib/restore';

interface Draft {
  passage: string;
  text: string;
  compared: boolean;
  attempt: string;
}

const fresh = (prev?: Draft): Draft => {
  const passage = pick(RESTORE_SOURCES.map((p) => p.id), prev?.passage);
  return { passage, text: strip(passageById(passage)!.text), compared: false, attempt: attemptId() };
};

const RESULT_TITLE: Record<GapResult, string> = {
  agree: 'Same pause, same mark',
  differ: 'You both paused here, with different marks',
  authors: 'The author paused here; you didn’t',
  yours: 'You paused here; the author didn’t',
  none: '',
};

/** Render a text with each compared gap marked by its result. */
function Marked({ text, results }: { text: string; results: Map<number, GapResult> }) {
  const toks = useMemo(() => tokenise(text), [text]);
  const out: (string | preact.JSX.Element)[] = [];
  let pos = 0;
  toks.forEach((t, i) => {
    out.push(text.slice(pos, t.end));
    const gap = text.slice(t.end, t.gapEnd);
    const r = results.get(i);
    if (r && r !== 'none') {
      out.push(<span class={`gap gap-${r}`} title={RESULT_TITLE[r]}>{/[^\s]/.test(gap) ? gap : <>{gap}<i class="gap-empty">‸</i></>}</span>);
    } else out.push(gap);
    pos = t.gapEnd;
  });
  out.push(text.slice(pos));
  return <p class="marked">{out}</p>;
}

function Summary({ c }: { c: Comparison }) {
  const lines: string[] = [];
  lines.push(`The author paused in ${c.authorPauses} ${c.authorPauses === 1 ? 'place' : 'places'}; you paused in ${c.yourPauses}.`);
  lines.push(`You shared ${c.shared} of the author’s pauses${c.shared ? `, ${c.same} with the same mark` : ''}.`);
  const yoursOnly = c.gaps.filter((g) => g.result === 'yours').length;
  if (yoursOnly) lines.push(`${yoursOnly} ${yoursOnly === 1 ? 'pause is' : 'pauses are'} yours alone: different breathing, not mistakes.`);
  if (c.wordChanges) lines.push(`${c.wordChanges} ${c.wordChanges === 1 ? 'word was' : 'words were'} changed, so the gaps beside ${c.wordChanges === 1 ? 'it aren’t' : 'them aren’t'} compared.`);
  return <div class="notice">{lines.map((l) => <p style={{ margin: '2px 0' }}>{l}</p>)}</div>;
}

export function Restore() {
  const [d, set, replace] = useDraft<Draft>('eq.restore.v1', () => fresh());
  const log = useAttemptLog();
  const passage = passageById(d.passage) ?? RESTORE_SOURCES[0];
  const stripped = useMemo(() => strip(passage.text), [passage]);
  const c = useMemo(() => (d.compared ? compare(passage.text, d.text) : null), [d.compared, d.text, passage]);

  const doCompare = () => {
    set({ compared: true });
    const r = compare(passage.text, d.text);
    log(d.attempt, { exercise: 'restore', judged: 'none', passage: passage.id, score: r.authorPauses ? r.shared / r.authorPauses : 1 });
  };
  const restart = () => {
    replace(fresh(d));
  };

  const authorResults = new Map(c?.gaps.map((g) => [g.index, g.result]) ?? []);
  const yourResults = new Map(c?.gaps.map((g) => [g.yoursIndex, g.result]) ?? []);

  return (
    <div>
      <div class="eyebrow"><a href="#/prose">The Prose Wing</a></div>
      <h1>Restore the Pause</h1>
      <HowTo
        id="restore"
        kat={<p>Commas, semicolons, colons, dashes and brackets: gone. Breathe them back in. Then set yours beside the author’s. Theirs is one good answer, not the only one.</p>}
        richard={
          <ol>
            <li>Below is a public-domain passage with its internal punctuation removed. Full stops, question marks and quotation marks stay, so the sentences are still there.</li>
            <li>Read it aloud. Wherever you’d pause, put the mark you’d choose: comma, semicolon, colon, dash or brackets.</li>
            <li>Press Compare. You’ll see your version next to the author’s, with every pause marked: where you agreed, where you chose a different mark, where only the author paused, and where only you did.</li>
            <li>There’s no score. The author’s choice is one good answer; yours may breathe differently and still be right.</li>
          </ol>
        }
      />

      <section class="desk desk-short">
        <span class="label">Put the pauses back</span>
        <textarea class="desk-text" aria-label="The passage, to re-punctuate" value={d.text} disabled={d.compared}
          onInput={(e) => set({ text: (e.target as HTMLTextAreaElement).value })} />
        <div class="btn-row tight">
          {!d.compared ? (
            <>
              <button class="btn-primary" onClick={doCompare}>Compare with the author</button>
              <button class="btn-quiet" onClick={() => set({ text: stripped })} disabled={d.text === stripped}>Start again</button>
            </>
          ) : (
            <button onClick={() => set({ compared: false })}>Keep editing</button>
          )}
          <button class="btn-quiet" onClick={restart}>Another passage</button>
        </div>
      </section>

      {c && (
        <section class="panel">
          <h2>Side by side</h2>
          <Summary c={c} />
          <div class="legend small">
            <span class="gap gap-agree">same</span>
            <span class="gap gap-differ">different mark</span>
            <span class="gap gap-authors">author only</span>
            <span class="gap gap-yours">yours only</span>
          </div>
          <div class="grid grid-2 compare">
            <div>
              <span class="label">Yours</span>
              <Marked text={d.text} results={yourResults} />
            </div>
            <div>
              <span class="label">The author’s</span>
              <Marked text={passage.text} results={authorResults} />
            </div>
          </div>
          <PassageCard p={passage} label="The source" showText={false} />
        </section>
      )}
    </div>
  );
}
