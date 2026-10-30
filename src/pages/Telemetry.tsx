import { useState } from 'preact/hooks';
import { spreadWord } from '../components/CadenceStrip';
import type { Piece } from '../lib/types';
import { telemetry } from '../state/store';

interface Point {
  label: string;
  date: string;
  value: number;
}

/** A small single-series trend: one line, dots you can hover, recessive grid. */
function Trend({ title, points, format, yMax }: { title: string; points: Point[]; format: (v: number) => string; yMax: number }) {
  const [hot, setHot] = useState<number | null>(null);
  const W = 520;
  const H = 140;
  const L = 36;
  const R = 12;
  const T = 12;
  const B = 22;
  const max = Math.max(yMax, ...points.map((p) => p.value));
  const x = (i: number) => (points.length === 1 ? (L + W - R) / 2 : L + (i * (W - L - R)) / (points.length - 1));
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  const path = points.map((p, i) => `${i ? 'L' : 'M'} ${x(i)} ${y(p.value)}`).join(' ');
  const p = hot !== null ? points[hot] : points[points.length - 1];
  return (
    <figure class="trend">
      <figcaption>
        <span class="label">{title}</span>
        <span class="trend-read">{p ? <>{format(p.value)} <small class="muted">· {p.label}</small></> : null}</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}: ${points.map((q) => format(q.value)).join(', ')}`}>
        {[0, 0.5, 1].map((f) => (
          <g class="staff">
            <line x1={L} x2={W - R} y1={y(max * f)} y2={y(max * f)} />
            <text x={L - 6} y={y(max * f) + 4} text-anchor="end">{format(max * f)}</text>
          </g>
        ))}
        <path class="trend-line" d={path} />
        {points.map((q, i) => (
          <g onMouseEnter={() => setHot(i)} onMouseLeave={() => setHot(null)} onFocus={() => setHot(i)} onBlur={() => setHot(null)} tabIndex={0}>
            <circle class="hit" cx={x(i)} cy={y(q.value)} r={12} />
            <circle class={`trend-dot${hot === i ? ' hot' : ''}`} cx={x(i)} cy={y(q.value)} r={hot === i ? 5 : 4} />
            <title>{`${q.label}: ${format(q.value)}`}</title>
          </g>
        ))}
      </svg>
    </figure>
  );
}

export function Telemetry() {
  const t = telemetry.value;
  const desk: Piece[] = t.pieces.filter((p) => p.kind === 'free_desk' && p.cadence.sentences > 1);
  const recent = desk.slice(-30);
  const pts = (f: (p: Piece) => number): Point[] => recent.map((p) => ({ label: p.title, date: p.date, value: f(p) }));
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const [table, setTable] = useState(false);
  const sessions = t.practice_log.length;
  const judged = t.practice_log.filter((r) => r.judged === 'ai').length;

  return (
    <div>
      <div class="eyebrow">Shared</div>
      <h1>Telemetry</h1>
      <p class="muted lede">
        No ratings for prose: a number on “taste” would be false precision. Instead, what you’ve practised and how your rhythms
        have moved. (The verse wing, with exact answers, will carry ratings.)
      </p>

      <section class="panel">
        <dl class="rhythm wide">
          <div><dt>Pieces saved</dt><dd>{t.pieces.length}</dd></div>
          <div><dt>Practice sessions</dt><dd>{sessions}</dd></div>
          <div><dt>With AI notes</dt><dd>{judged}</dd></div>
          <div><dt>Average spread</dt><dd>{desk.length ? spreadWord(avg(desk.map((p) => p.cadence.cv))) : '—'}</dd></div>
        </dl>
      </section>

      <section class="panel">
        <h2>Cadence trends</h2>
        {recent.length < 2 ? (
          <p class="muted">Save two or more Free Desk pieces (of more than one sentence) to see trends.</p>
        ) : (
          <>
            <p class="muted small">Across your last {recent.length} Free Desk pieces, oldest on the left. Neither line has a “right” direction: they show whether your range is moving.</p>
            <div class="grid grid-2">
              <Trend title="Spread of sentence lengths (spread ÷ average)" points={pts((p) => p.cadence.cv)} format={(v) => v.toFixed(2)} yMax={1} />
              <Trend title="Longest same-length run (sentences)" points={pts((p) => p.cadence.longest_run)} format={(v) => String(Math.round(v))} yMax={4} />
            </div>
            <button class="btn-quiet" onClick={() => setTable(!table)} aria-expanded={table}>{table ? 'Hide table' : 'Show as a table'}</button>
            {table && (
              <div class="table-wrap">
                <table class="data-table">
                  <thead><tr><th>Piece</th><th>Date</th><th class="num">Sentences</th><th class="num">Spread</th><th class="num">Longest run</th></tr></thead>
                  <tbody>
                    {recent.map((p) => (
                      <tr><td>{p.title}</td><td>{new Date(p.date).toLocaleDateString()}</td><td class="num">{p.cadence.sentences}</td><td class="num">{p.cadence.cv.toFixed(2)}</td><td class="num">{p.cadence.longest_run}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
