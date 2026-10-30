import { useMemo, useState } from 'preact/hooks';
import { CadenceStrip } from '../components/CadenceStrip';
import { KIND_LABEL } from '../data/exercises';
import { analyse } from '../lib/cadence';
import type { Piece } from '../lib/types';
import { navigate } from '../state/router';
import { deletePiece, telemetry } from '../state/store';
import { NotesView } from '../components/Judging';


function openAtDesk(p: Piece) {
  try {
    const current = JSON.parse(localStorage.getItem('eq.desk_draft.v1') ?? '{}');
    if (current.text?.trim() && current.text !== p.text && !confirm('Replace what’s on the desk now? Save it first if you want to keep it.')) return;
    localStorage.setItem('eq.desk_draft.v1', JSON.stringify({ title: p.title, text: p.text, aim: 'unstated', own: '', pieceId: p.id }));
  } catch {
    /* ignore */
  }
  navigate('/desk');
}

function PieceCard({ p }: { p: Piece }) {
  const [open, setOpen] = useState(false);
  const [showBefore, setShowBefore] = useState(false);
  const shown = showBefore && p.before ? p.before : p.text;
  const cadence = useMemo(() => analyse(shown), [shown]);
  return (
    <article class="panel piece">
      <div class="piece-head">
        <div>
          <h3>{p.title}</h3>
          <div class="meta">{KIND_LABEL[p.kind]} · {new Date(p.date).toLocaleDateString()} · {p.cadence.words} words · {p.cadence.sentences} sentences</div>
        </div>
        <div class="btn-row tight">
          {p.before && (
            <div class="seg" role="group" aria-label="Version">
              <button aria-pressed={showBefore} onClick={() => setShowBefore(true)}>Before</button>
              <button aria-pressed={!showBefore} onClick={() => setShowBefore(false)}>After</button>
            </div>
          )}
          <button onClick={() => setOpen(!open)} aria-expanded={open}>{open ? 'Fold' : 'Read'}</button>
        </div>
      </div>
      <CadenceStrip cadence={cadence} compact />
      {open && (
        <>
          <div class="prose">{shown.split(/\n{2,}/).map((para) => <p>{para}</p>)}</div>
          {p.self_check && <p class="muted small">Self-check: {p.self_check.length} of 5 ticked.</p>}
          {p.notes && !showBefore && (
            <details class="howto">
              <summary>AI notes</summary>
              <NotesView notes={p.notes} text={p.text} />
            </details>
          )}
          <div class="btn-row">
            <button onClick={() => openAtDesk(p)}>Open at the desk</button>
            <button class="btn-quiet danger" onClick={() => confirm(`Delete “${p.title}”? This can’t be undone.`) && deletePiece(p.id)}>Delete</button>
          </div>
        </>
      )}
    </article>
  );
}

export function Portfolio() {
  const pieces = [...telemetry.value.pieces].reverse();
  return (
    <div>
      <div class="eyebrow">Shared</div>
      <h1>Portfolio</h1>
      <p class="muted lede">Saved pieces, each with its cadence strip. A piece saved again after edits keeps its first version as “before”.</p>
      {pieces.length ? pieces.map((p) => <PieceCard key={p.id} p={p} />) : (
        <section class="panel"><p>Nothing saved yet. <a href="#/desk">Write something at the Free Desk</a> and save it.</p></section>
      )}
    </div>
  );
}
