import { useEffect, useRef, useState } from 'preact/hooks';
import { runLength, type Cadence, type SentenceShape } from '../lib/cadence';

const H = 150; // plot height in px
const TOP = 26; // room for slurs above the tallest note
const LEFT = 34; // staff labels
const RIGHT = 10;

/** Round the top of the staff up so its five lines land on friendly word counts. */
function staffTop(longest: number): number {
  const target = Math.max(20, longest);
  for (const step of [5, 10, 15, 20, 25, 50, 75, 100]) if (step * 4 >= target) return step * 4;
  return Math.ceil(target / 100) * 100;
}

export function spreadWord(cv: number): string {
  if (cv < 0.25) return 'very even';
  if (cv < 0.45) return 'some variety';
  if (cv < 0.75) return 'varied';
  return 'wildly varied';
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

function useWidth<T extends HTMLElement>(): [preact.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(600);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

function BreathTick({ x, y, kind }: { x: number; y: number; kind: string }) {
  const half = kind === 'dash' ? 7 : kind === 'comma' ? 4 : 5;
  return (
    <g class={`breath breath-${kind}`}>
      <line x1={x - half} x2={x + half} y1={y} y2={y} />
      {kind === 'semicolon' && <circle cx={x + half + 3} cy={y} r={1.6} />}
      {kind === 'colon' && <><circle cx={x + half + 3} cy={y - 2.5} r={1.4} /><circle cx={x + half + 3} cy={y + 2.5} r={1.4} /></>}
    </g>
  );
}

export interface StripProps {
  cadence: Cadence;
  /** Called when a bar is clicked, e.g. to select that sentence in the textarea. */
  onPick?: (s: SentenceShape) => void;
  /** A second shape to overlay (Imitation), drawn as hollow ghost notes. */
  ghost?: Cadence;
  compact?: boolean;
}

export function CadenceStrip({ cadence, onPick, ghost, compact }: StripProps) {
  const [wrapRef, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const [lit, setLit] = useState<Set<number> | null>(null);
  const ss = cadence.sentences;
  const n = Math.max(ss.length, ghost?.sentences.length ?? 0);
  const height = compact ? 90 : H;
  const top = staffTop(Math.max(cadence.longest, ghost?.longest ?? 0));
  const step = n ? Math.min(compact ? 44 : 96, Math.max(compact ? 7 : 12, (width - LEFT - RIGHT) / n)) : 20;
  const svgW = Math.max(width, LEFT + RIGHT + n * step);
  const base = TOP + height;
  const y = (words: number) => base - (words / top) * height;
  const x = (i: number) => LEFT + step * (i + 0.5);
  const headR = Math.min(5, Math.max(2.5, step / 4));
  const active = hover !== null ? ss[hover] : null;

  if (!ss.length && !ghost) {
    return (
      <div class="strip strip-empty" ref={wrapRef}>
        <p class="muted">The cadence strip appears here as you write: one note per sentence, its height the sentence’s length in words.</p>
      </div>
    );
  }

  return (
    <div class={`strip${compact ? ' strip-compact' : ''}`}>
      <div class="strip-scroll" ref={wrapRef}>
        <svg width={svgW} height={base + 8} role="img" aria-label={`Cadence strip: ${ss.length} sentences, lengths ${ss.map((s) => s.length).join(', ')} words`}>
          {[0, 1, 2, 3, 4].map((k) => {
            const v = (top * k) / 4;
            return (
              <g class="staff" key={k}>
                <line x1={LEFT - 4} x2={svgW - RIGHT} y1={y(v)} y2={y(v)} />
                {!compact && k > 0 && <text x={LEFT - 8} y={y(v) + 4} text-anchor="end">{v}</text>}
              </g>
            );
          })}
          {ghost?.sentences.map((g, i) => (
            <g class="ghost" key={`g${i}`}>
              <line x1={x(i)} x2={x(i)} y1={base} y2={y(g.length)} />
              <ellipse cx={x(i)} cy={y(g.length)} rx={headR + 1} ry={headR * 0.75 + 1} transform={`rotate(-20 ${x(i)} ${y(g.length)})`} />
            </g>
          ))}
          {cadence.runs.map((r) => {
            const x1 = x(r.from) - headR;
            const x2 = x(r.to) + headR;
            const peak = Math.min(...ss.slice(r.from, r.to + 1).map((s) => y(s.length))) - 8;
            const lift = Math.min(16, 6 + (x2 - x1) / 12);
            return (
              <g class={`slur${cadence.monotony === r ? ' longest' : ''}`} key={`r${r.from}`}>
                <path d={`M ${x1} ${peak} Q ${(x1 + x2) / 2} ${peak - lift} ${x2} ${peak}`} />
                {!compact && <title>{`${r.to - r.from + 1} similar-length sentences in a row`}</title>}
              </g>
            );
          })}
          {ss.map((s, i) => {
            const cx = x(i);
            const cy = y(s.length);
            const dim = lit && !lit.has(i);
            return (
              <g
                key={i}
                class={`note${hover === i ? ' hot' : ''}${dim ? ' dim' : ''}${lit?.has(i) ? ' lit' : ''}`}
                tabIndex={compact ? -1 : 0}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                onClick={() => onPick?.(s)}
                onKeyDown={(e) => e.key === 'Enter' && onPick?.(s)}
              >
                <rect class="hit" x={cx - step / 2} y={TOP - 10} width={step} height={height + 18} />
                <line class="stem" x1={cx} x2={cx} y1={base} y2={cy} />
                <ellipse class="head" cx={cx} cy={cy} rx={headR} ry={headR * 0.75} transform={`rotate(-20 ${cx} ${cy})`} />
                {!compact && s.breaths.map((b, j) => <BreathTick key={j} x={cx} y={base - (b.afterWord / Math.max(1, s.length)) * (base - cy)} kind={b.kind} />)}
                <title>{`${i + 1}. ${s.length} words: ${s.text}`}</title>
              </g>
            );
          })}
        </svg>
      </div>

      {!compact && (
        <>
          <div class="strip-caption" aria-live="polite">
            {active ? (
              <>
                <span class="cap-meta">Sentence {active.index + 1} · {active.length} {active.length === 1 ? 'word' : 'words'}
                  {active.breaths.length ? ` · ${active.breaths.length} ${active.breaths.length === 1 ? 'pause' : 'pauses'}` : ' · no pauses'}</span>
                <span class="cap-text">{active.text}</span>
              </>
            ) : (
              <span class="muted">Hover or tap a note to read its sentence{onPick ? '; click to select it in your text' : ''}.</span>
            )}
          </div>
          <StripStats cadence={cadence} onLight={setLit} />
        </>
      )}
    </div>
  );
}

function StripStats({ cadence: c, onLight }: { cadence: Cadence; onLight: (s: Set<number> | null) => void }) {
  if (!c.sentences.length) return null;
  const run = runLength(c.monotony);
  const chip = (label: string, idx: number[], key: string) => (
    <button
      key={key}
      class="chip"
      onMouseEnter={() => onLight(new Set(idx))}
      onMouseLeave={() => onLight(null)}
      onFocus={() => onLight(new Set(idx))}
      onBlur={() => onLight(null)}
    >
      {label}
    </button>
  );
  return (
    <div class="strip-stats">
      <dl class="rhythm">
        <div><dt>Sentences</dt><dd>{c.sentences.length}</dd></div>
        <div><dt>Words</dt><dd>{c.words}</dd></div>
        <div><dt>Shortest</dt><dd>{c.shortest}</dd></div>
        <div><dt>Longest</dt><dd>{c.longest}</dd></div>
        <div><dt>Middle</dt><dd>{fmt(c.median)}</dd></div>
        <div title={`Standard deviation ${c.sd.toFixed(1)} words; coefficient of variation ${c.cv.toFixed(2)} (spread ÷ average).`}>
          <dt>Spread</dt><dd>±{c.sd.toFixed(1)} <small>{c.sentences.length > 1 ? spreadWord(c.cv) : ''}</small></dd>
        </div>
        <div><dt>Same-length run</dt><dd>{run ? `${run} in a row` : 'none'}</dd></div>
      </dl>
      {(c.echoes.length > 0 || c.openings.length > 0) && (
        <div class="echoes">
          {c.echoes.length > 0 && (
            <p>
              <span class="label">Repeated nearby</span>
              {c.echoes.slice(0, 12).map((e) => chip(`${e.hits[0].word.toLowerCase()} ×${e.hits.length}`, e.hits.map((h) => h.sentence), `e-${e.stem}-${e.hits[0].sentence}`))}
            </p>
          )}
          {c.openings.length > 0 && (
            <p>
              <span class="label">Same openings</span>
              {c.openings.map((o) => chip(`“${o.opener}…” ×${o.sentences.length}`, o.sentences, `o-${o.opener}`))}
            </p>
          )}
          <p class="muted small">Shown, not scored: repetition on purpose is a tool. Hover a word to see where it falls.</p>
        </div>
      )}
      <details class="info">
        <summary>ⓘ Reading the strip, and names for the curious</summary>
        <p>
          Each note is one sentence; its height is the length in words, against a five-line staff. Small ticks on a stem are where
          that sentence lets the reader breathe (comma, semicolon with a dot, colon with two dots, a longer tick for a dash),
          placed at the word they follow. An arc over several notes marks a run of similar lengths; the heavier arc is the longest.
        </p>
        <p class="muted">
          Shapes have names, if you want them: a long sentence that states its point first and keeps adding is often called
          <em> cumulative</em> (or loose); one that holds the point back to the end, <em>periodic</em>. A burst of very short ones is
          <em> staccato</em>. None of these is better than another: the strip only shows which you’re using.
        </p>
      </details>
    </div>
  );
}
