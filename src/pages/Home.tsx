import { useMemo } from 'preact/hooks';
import { CadenceStrip } from '../components/CadenceStrip';
import { Lenses } from '../components/Bits';
import { analyse } from '../lib/cadence';
import { apiKey, profile, telemetry } from '../state/store';

// Public domain: Charles Dickens, Bleak House (1853), opening of chapter 1. Project Gutenberg #1023.
const SAMPLE =
  'London. Michaelmas term lately over, and the Lord Chancellor sitting in Lincoln’s Inn Hall. Implacable November weather. ' +
  'As much mud in the streets as if the waters had but newly retired from the face of the earth, and it would not be wonderful ' +
  'to meet a Megalosaurus, forty feet long or so, waddling like an elephantine lizard up Holborn Hill.';

export function Home() {
  const sample = useMemo(() => analyse(SAMPLE), []);
  const t = telemetry.value;
  return (
    <div>
      <section class="hero">
        <div class="eyebrow">A writing desk for prose style and formal verse</div>
        <h1>Does it move, and does it land?</h1>
        <p class="lede">
          Eloquacity trains feel: rhythm, variety, breath, depth and register, from exquisite short sentences to robust,
          rambling long ones, and from blunt and vivid to ultraviolet. Not the clear professional middle. Not grammar policing.
        </p>
        <div class="btn-row">
          <a class="btn btn-primary" href="#/desk">Open the Free Desk</a>
          {t.pieces.length > 0 && <a class="btn" href="#/portfolio">Your portfolio ({t.pieces.length})</a>}
        </div>
      </section>

      <section class="panel">
        <div class="eyebrow">The cadence strip</div>
        <h2>Prose, scored like music</h2>
        <p class="muted small">Dickens opens <em>Bleak House</em> (1853) with a one-word sentence, two fragments, then a {sample.longest}-word runner. Each note is a sentence; ticks are its pauses.</p>
        <blockquote class="sample">{SAMPLE}</blockquote>
        <CadenceStrip cadence={sample} />
        <Lenses
          kat={<p>{sample.sentences.slice(0, -1).map((x) => x.length).join(', ')}, then <em>{sample.longest}</em>. The jump is the effect. The strip makes it visible while you write.</p>}
          richard={
            <p>
              Under every prose box, the app splits your text into sentences, counts each one’s words, draws them as notes, and marks
              where each sentence pauses. It also lists the shortest, longest and middle lengths, how much they vary, any run of
              similar lengths, and words repeated close together. All of this is worked out in your browser, without AI.
            </p>
          }
        />
      </section>

      <div class="grid grid-2">
        <a class="card" href="#/desk">
          <div class="eyebrow">The Prose Wing</div>
          <h3>The Free Desk</h3>
          <p class="grow muted">Write anything and watch its cadence. Ask for AI notes judged against your chosen register, not against good taste.</p>
          <span class="card-go">Open →</span>
        </a>
        <div class="card quiet">
          <div class="eyebrow">Being built</div>
          <h3>Exercises and the Verse Wing</h3>
          <p class="grow muted">
            Rhythm targets, grow-and-shrink ladders, the Register Dial, sentence imitation and restoring pauses come next, then metre,
            rhyme and fixed forms.
          </p>
        </div>
      </div>

      <p class="muted small" style={{ marginTop: '22px' }}>
        Your work is saved in this browser.{' '}
        {profile.value ? 'You’re signed in, so it also syncs to your account.' : <><a href="#/account">Sign in</a> to sync across devices.</>}{' '}
        {!apiKey.value && <>AI notes need an <a href="#/settings">OpenRouter key</a>; it never leaves this browser except to call OpenRouter.</>}
      </p>
    </div>
  );
}
