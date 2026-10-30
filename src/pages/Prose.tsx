import { PROSE_EXERCISES } from '../data/exercises';
import { PASSAGES } from '../data/passages';
import { telemetry } from '../state/store';

export function Prose() {
  const log = telemetry.value.practice_log;
  const times = (kind: string) => log.filter((r) => r.exercise === kind || (kind === 'ladder_grow' && r.exercise === 'ladder_shrink')).length;
  return (
    <div>
      <div class="eyebrow">The Prose Wing</div>
      <h1>Rhythm, length, variety, breath, register</h1>
      <p class="muted lede">
        Each exercise has an exact part (counts, shapes, pauses, worked out in your browser) and an optional reading part, where the notes
        judge against the target, never against taste. The masters are {PASSAGES.length} public-domain passages, each with its source.
      </p>
      <div class="grid grid-2">
        {PROSE_EXERCISES.map((e) => {
          const n = times(e.kind);
          return (
            <a class="card" href={`#${e.route}`}>
              <h3>{e.title}</h3>
              <p class="grow muted">{e.blurb}</p>
              <span class="card-go">{n ? `Practised ${n} ${n === 1 ? 'time' : 'times'} · ` : ''}Open →</span>
            </a>
          );
        })}
      </div>
    </div>
  );
}
