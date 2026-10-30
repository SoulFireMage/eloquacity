import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { markHelpSeen, seenHelp, settings } from '../state/store';

/**
 * Two lenses: a compressed, pattern-first version (Kat) and a plain step-by-step
 * version (Richard). The Settings lens picks one or shows both.
 */
export function Lenses({ kat, richard }: { kat: ComponentChildren; richard: ComponentChildren }) {
  const lens = settings.value.lens;
  return (
    <div class="lenses">
      {lens !== 'richard' && <div class="lens lens-kat"><span class="lens-name">The shape</span>{kat}</div>}
      {lens !== 'kat' && <div class="lens lens-richard"><span class="lens-name">Step by step</span>{richard}</div>}
    </div>
  );
}

/** "How this works": open the first time an exercise type appears, folded after that. */
export function HowTo({ id, kat, richard }: { id: string; kat: ComponentChildren; richard: ComponentChildren }) {
  const [firstTime] = useState(() => !seenHelp.value.includes(id));
  useEffect(() => markHelpSeen(id), [id]);
  return (
    <details class="howto" open={firstTime}>
      <summary>How this works</summary>
      <Lenses kat={kat} richard={richard} />
    </details>
  );
}

/** Self-check checklist for the no-key mode. */
export function SelfCheck({ items, onSubmit }: { items: string[]; onSubmit: (ticked: string[]) => void }) {
  const [ticks, setTicks] = useState<boolean[]>(items.map(() => false));
  const [sent, setSent] = useState(false);
  return (
    <div class="panel inset">
      <div class="eyebrow">Self-check: be honest, it only trains you</div>
      {items.map((it, i) => (
        <label class="check-row">
          <input type="checkbox" checked={ticks[i]} disabled={sent} onChange={() => setTicks(ticks.map((t, j) => (j === i ? !t : t)))} />
          <span>{it}</span>
        </label>
      ))}
      <div class="btn-row">
        <button class="btn-primary" disabled={sent} onClick={() => { setSent(true); onSubmit(items.filter((_, i) => ticks[i])); }}>
          {sent ? 'Recorded' : 'Record self-check'}
        </button>
      </div>
    </div>
  );
}

export function Busy({ label }: { label: string }) {
  return <p class="muted"><span class="spinner" /> {label}</p>;
}
