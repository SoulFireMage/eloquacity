# Eloquacity

A training site for prose style and formal verse, and a sister to [The Rhetoric Forge](https://soulfiremage.github.io/rhetoric-salle/).

The full build specification is in [SPEC.md](SPEC.md).

## Status

**Phase 1 (core and the Cadence Strip)** is built:

- The **Cadence Strip**: one note per sentence on a five-line staff, with breath marks, runs of similar lengths, rhythm stats, repeated words and same openings. It all runs in the browser, with no AI.
- A **sentence splitter** that copes with dialogue, ellipses, abbreviations, initials and em-dashes, with unit tests.
- The **Free Desk**: write anything, see its cadence, and optionally get AI notes built to SPEC §5. The notes judge against your chosen aim, test clarity by paraphrase, check that quoted phrases really appear in your text, and only rewrite when you explicitly ask. Without a key, you get a self-check list instead.
- **Portfolio** (with before/after versions), **Telemetry** (cadence trends, no prose ratings), **Settings** and **Account**.
- Optional Skapi accounts on the Forge's project, using Eloquacity's own tables (`eq_telemetry`, `eq_transcripts`, `eq_bank`). The bring-your-own OpenRouter key stays in `localStorage` only.

**Phase 2 (prose exercises)** is built:

- **Shapeshifter:** you're dealt a rhythm target and a subject; the shape is checked exactly, and its ghost sits behind your notes on the strip.
- **Grow and Shrink:** grow a six-word seed to 60+ words, or cut a master's long sentence down to 6, one sentence per rung, with live word ranges.
- **The Register Dial:** rewrite a plain paragraph at blunt, brisk, lush or ultraviolet. The judge paraphrases each rewrite *without seeing the source*, and you check whether the meaning survived the dial.
- **Imitation:** copy a master sentence's shape on your own subject; two staves compare where the pauses fall.
- **Restore the Pause:** a passage with its internal punctuation removed; put it back, then compare gap by gap with the author's choices. No score.
- **The passage bank:** 74 public-domain passages, extracted verbatim from Project Gutenberg with their sources (see `tools/passages`).
- Every paraphrase check now has three answers: it matched, it misread me, or the ambiguity is on purpose.

## Develop

```bash
npm install
npm run dev        # local server
npm test           # unit tests
npm run build      # typecheck + production build
```

Playwright smoke pass: it checks every page on desktop and at 390px in dark mode, fails on any console error or horizontal scroll, and exercises the judge path with OpenRouter mocked.

```bash
npm run build && npx vite preview --port 4173 &
node e2e/smoke.mjs http://localhost:4173/
```

## Deploy

`.github/workflows/deploy.yml` deploys `main` to GitHub Pages. Pages has to be enabled once with the workflow as its source (see SPEC §2, gotcha 2).
