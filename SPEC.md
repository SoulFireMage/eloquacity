# Eloquacity: Product & Build Specification

A training site for **prose style and formal verse**. It's a sister to *The Rhetoric Forge* (https://soulfiremage.github.io/rhetoric-salle/, source https://github.com/SoulFireMage/rhetoric-salle). It reuses that site's software structure, login and bring-your-own-key AI, but has a different purpose and a different way of scoring.

> **Read this first, building agent.** Copy the Forge's plumbing; don't copy its pedagogy. The Forge drills exact answers and named techniques. Eloquacity trains *feel*: rhythm, variety, breath, depth, register. Terminology stays in the background (tooltips at most). Where the Forge asks "what is this called?", Eloquacity asks "does it move, and does it land?"

---

## 1. Purpose and non-goals

**For:** creative prose and formal verse. That means flow, rhythm, sentence variety, from exquisite short sentences to robust, rambling long ones, and control of register, from ultraviolet purple to brisk, blunt and vivid.

**Not for:**
- Business, formal or "clear professional" writing. Never nudge the user toward the bland, competent mid style.
- Free verse. The verse wing covers metre, rhyme and fixed forms only.
- Grammar policing. Fiction breaks rules on purpose. Judge **clarity** (does it parse on one reading?), not correctness.
- Readability scores (Flesch and similar). They reward exactly the mid style. Don't include them anywhere.

**Two lenses** (house style, also used on the Forge and on Richard's Starship Whisperer's Chart): where explanations matter, give a compressed, pattern-first version (Kat lens) and a plain step-by-step version (Richard lens).

---

## 2. Stack and reuse (do this exactly)

Same stack as the Forge: **Preact + TypeScript + Vite**, `@preact/signals`, hash routing, static site on **GitHub Pages**, optional **Skapi** accounts, and a **bring-your-own OpenRouter key** stored only in `localStorage`.

Copy these from `rhetoric-salle` (`src/…`), then adapt them:

| Forge file | Use in Eloquacity |
|---|---|
| `lib/openrouter.ts` | As is: JSON-schema output with a json_object, then plain-text fallback, and one repair re-ask. |
| `lib/cloud.ts` | Lazy-loaded Skapi, login, signup, password reset, private telemetry record, drill bank. **Change the table names** (see below). |
| `state/store.ts`, `state/router.ts` | Same patterns: signals persisted to localStorage, merge-on-login, export/import that merges. |
| `lib/rating.ts`, `lib/memory.ts` | **Verse wing only** (see §6). |
| `lib/validate.ts` | Pattern for validating seed content in tests. |
| `components/ForgeBits.tsx` | Verdict lines, self-check fallback, save button. |
| `pages/Settings.tsx`, `pages/Account.tsx` | Nearly as is. |
| `.github/workflows/deploy.yml`, `ci.yml` | As is (current action versions, `ubuntu-24.04`). |
| `styles.css` | Keep the token system and light/dark mechanics, but give Eloquacity **its own look** (see §8). |

**Skapi:** use the **same project**, `5GJ5SJePWQUiq0jvYr-2ZVgaOLUqOhnse3Hcl8M4d`, so one account signs into both sites.
- Use new table names: `eq_telemetry` (private), `eq_transcripts` (private), `eq_bank` (public, admin-authored).
- **Never touch** the Forge's tables (`drill_bank`, `telemetry`, `salle_transcripts`) or the Starship Whisperer's `starlog`.
- Admin user ID (Richard): `a149c0de-50e1-705d-4ec6-ffb00db55464`. Put it in `ADMIN_USER_IDS`, and only load bank content uploaded by trusted IDs.
- Read the Skapi docs (https://docs.skapi.com/SKAPI.md, or the Skapi MCP `readDocs`) before writing any `skapi.*` call.

**Gotchas already paid for once:**
1. **Preact 11 doesn't add `px` to numeric inline styles.** Always write `'12px'`, never `12`.
2. **GitHub Pages environment protection.** Enable Pages with `gh api -X POST repos/SoulFireMage/eloquacity/pages -f build_type=workflow`. If `main` is then refused deployment, run:
   ```
   gh api -X PUT repos/SoulFireMage/eloquacity/environments/github-pages -F "deployment_branch_policy[protected_branches]=false" -F "deployment_branch_policy[custom_branch_policies]=true"
   gh api -X POST repos/SoulFireMage/eloquacity/environments/github-pages/deployment-branch-policies -f name=main -f type=branch
   ```
   Make sure `main` is the default branch.
3. **After a failed attempt, never replace the user's answer with the correct one.** Show their attempt, mark what's wrong, and show the accepted answer separately.
4. Keep the Skapi SDK lazy-loaded so it stays out of the main bundle.

---

## 3. Information architecture

Two wings and a shared core:

- **The Prose Wing:** rhythm, length, variety, breath, register.
- **The Verse Wing:** metre, rhyme, stanza and fixed forms.
- **Shared:**
  - Home, with a dismissible "Start here" welcome
  - Guide
  - Portfolio (saved before/after pairs and pieces)
  - Telemetry
  - Settings
  - Account
  - Admin studio for curating the content bank

Navigation and the first-visit help follow the Forge's patterns: a Guide page, a three-step welcome, and per-exercise "How this works" notes that open the first time each exercise type appears.

---

## 4. The Prose Wing

### 4.1 The Cadence Strip (deterministic, the centrepiece)

A live visual under every prose textarea, calculated in the browser with no AI:
- **Bars for sentence lengths:** one bar per sentence, length in words. Hover a bar to see the sentence.
- **Rhythm stats:** shortest, longest, median, spread (standard deviation and coefficient of variation), and the longest run of similar-length sentences ("monotony runs").
- **Breath marks:** commas, semicolons, dashes and colons inside each sentence, shown as small ticks on its bar. This shows where a long sentence lets the reader breathe.
- **Echoes:** repeated words or word-stems within a short window, and sentences starting the same way. Intentional anaphora is fine, so just show them; don't penalise.
- Plain language throughout. No "periodic", "cumulative" or similar labels in the main UI. A small optional ⓘ can name a shape for the curious.

Sentence splitting must cope with dialogue, ellipses, abbreviations (Mr., Dr., e.g.), and em-dashes. Write unit tests for it.

### 4.2 Exercises

Each has a deterministic part (the Cadence Strip and constraint checks) and an optional AI judge part.

1. **Shapeshifter (rhythm targets).** The app deals a target shape, such as *short · short · long*, *one breathless runner of 60+ words that never loses its thread*, *a staccato burst of five sentences under six words*, or *long, long, then a two-word sentence*. The user writes to it on a given subject. The shape is checked deterministically; quality is judged by the AI (see §5).
2. **Grow and Shrink ladders.** Grow a 6-word seed to about 20, then 40, then 60+ words while staying readable and alive. Or compress a 60-word sentence to about 25, then 12, then 6 without losing its heart. Word counts are checked deterministically; "still alive?" is judged by the AI.
3. **The Register Dial.** One plain paragraph. The user rewrites it at a chosen point on a five-step dial, or at all five:
   - 1: blunt and vivid
   - 2: brisk
   - 3: neutral, used only as the baseline and never praised
   - 4: lush
   - 5: ultraviolet

   The judge scores against the **chosen setting**: "is this ultraviolet enough, and still under control?" It never asks "is this good?".
4. **Imitation (sentence shadowing).** Show a public-domain master sentence. The user writes a new sentence on a different subject that copies its *shape*: length, clause order, where the pauses fall. The Cadence Strip overlays the two shapes. This is a long-standing exercise; Brooks Landon's *Building Great Sentences* teaches long sentences this way.
5. **Restore the Pause.** A public-domain passage with its internal punctuation stripped. The user re-punctuates it, then sees a side-by-side with the original. The comparison is deterministic, and the framing is *compare*, not *right or wrong*: the author's choice is one good answer, not the only one.
6. **Free Desk.** Write anything, and get the Cadence Strip plus optional AI notes (§5).

### 4.3 Model passages (copyright: important)

Use only **public-domain** text. A safe rule: authors who died before 1955, in works first published before 1929. That satisfies both the US and UK rules. Record the source for every passage (author, work, year, Project Gutenberg ID).

The seed bank should range widely, for example: Austen, the Brontës, Dickens, George Eliot, Melville, Hawthorne, Poe, Stevenson, Conrad, Hardy, Kipling, Henry James, Edith Wharton (pre-1929 works), Twain, Ruskin, Sir Thomas Browne, the King James Bible, and Gibbon. Include short, blunt writers as well as lavish ones. Aim for 60+ annotated passages across registers.

---

## 5. AI judging, designed against the "mid style" trap

**The core risk:** language models are trained toward polished, middling prose, so a naïve "rate the impact" judge gradually pushes users into exactly the style Richard wants to escape. Every judge prompt must apply these rules:

1. **Judge against the target, not against good taste.** Always pass the exercise's target register or shape and ask whether the writing hits *that*. Explicitly tell the judge that purple, rambling, fragmentary or rule-breaking writing is legitimate when it's the target.
2. **Compare rather than score.** Prefer pairwise judgements, such as "which of these two versions lands harder for the stated aim, and on which phrase?", over 0–100 scores. Where a number is shown, derive it from comparisons and checklists, as the Forge does.
3. **Clarity is a comprehension test.** The judge paraphrases the sentence in plain words. The user (or a second check) confirms whether the paraphrase matches what was meant. A wrong paraphrase means unclear writing; a right one means it parsed. That lets a long, rambling sentence pass when it truly reads.
4. **Impact is specific.** The judge must quote the single strongest phrase and the single weakest one, and say why in one sentence each. It must not say "great imagery" or anything similarly vague.
5. **No ghost-writing by default.** The judge gives notes, not rewrites; a rewrite would drag the user's voice toward the model's. Offer a rewrite only on explicit request, clearly labelled "one possible version, in the model's voice".
6. **Run the judge at low temperature** and keep its checklists structured. As in the Forge, AI-judged results carry low weight in any statistics.

There is a self-check mode with no key, as in the Forge: compare with the model passage and tick an honest checklist.

---

## 6. The Verse Wing (formal verse only)

This is where exact answers return, so the Forge's rating and decay machinery applies here.

**The engine:** a pronouncing dictionary with stress marks. The CMU Pronouncing Dictionary is public domain and about 3–4 MB raw, so ship a compressed subset or a gzipped JSON and **load it lazily** when the verse wing opens. It's used for:
- syllable counts per line
- stress patterns per word, giving an approximate scansion
- rhyme detection: matching from the last stressed vowel onward, plus slant-rhyme heuristics

**Caveat (be honest in the UI):** dictionary stress is approximate. Stress shifts in context, one-syllable words are ambiguous, and words not in the dictionary need a fallback syllable heuristic. So the scanner reports "probably iambic, with one likely inversion in foot 1", and the user can tap a syllable to override its stress.

**Exercises:**
1. **Scan the line** (exact answer): mark stresses on a public-domain line, then compare with a curated scansion, allowing curated alternatives where readings differ legitimately.
2. **Spot the substitution:** find the trochaic inversion, the feminine ending, the spondee.
3. **Name the scheme:** identify the rhyme scheme of a stanza.
4. **Fill the form** (generative): write a line in iambic pentameter, a ballad quatrain, a terza rima tercet, or a full sonnet, villanelle, ghazal, rondeau, triolet or sestina.
   - **Deterministic:** check metre, syllable counts, rhyme positions and repetition rules (villanelle refrains, sestina end-words, the ghazal radif).
   - **AI judge:** comments on music and impact, under the §5 rules.
5. **Metre ear:** hear or see a line, then classify it as iambic, trochaic, anapaestic or dactylic, and count the feet.

Seed material comes from public-domain verse: Shakespeare, Donne, Milton, Pope, Wordsworth, Keats, Tennyson, the Brownings, Christina Rossetti, Hopkins (for sprung rhythm as a curiosity), Hardy, Housman and Kipling.

---

## 7. Progress and telemetry

- **Verse:** Glicko-2 ratings per verse skill (scansion, substitutions, rhyme schemes, each form) and FSRS-lite readiness, copied from the Forge.
- **Prose:** no ratings. Use instead:
  - a **Range Map**, showing which registers and rhythm shapes the user has practised and how often
  - **Cadence trends** over time: average spread of sentence lengths and longest monotony run, across Free Desk pieces
  - a **Portfolio** of before/after pairs and saved pieces, with their Cadence Strips

  A decay bar on "taste" would be false precision, so don't add one.
- Export and import JSON that merges, never overwrites. The OpenRouter key is never exported or synced.

---

## 8. Look and feel

A sister to the Forge's wood-and-brass debating chamber, but warmer and more literary: a writing desk or scriptorium.
- Ink-on-paper light mode and a lamplit dark mode.
- A large, comfortable writing area with a serif display face; generous line height for prose, centred stanzas for verse.
- The Cadence Strip should look like a musical score, not a dashboard.
- Nothing cartoonish, and no streaks or badges.
- Show a light link to the Forge in the footer ("Sister site: The Rhetoric Forge").

---

## 9. Build order

1. **Core and the Cadence Strip:** scaffold copied from the Forge (store, cloud with new tables, OpenRouter client, Settings and Account), Pages deploy, the sentence splitter with tests, the Cadence Strip, and Free Desk. **Deploy at this point.**
2. **Prose exercises:** Shapeshifter, Grow and Shrink, Register Dial, Imitation and Restore the Pause, with judges built to §5. Seed the public-domain passage bank, with sources.
3. **Verse engine:** pronouncing dictionary loader, syllable, stress and rhyme utilities with tests, and the scansion UI with tap-to-override.
4. **Verse exercises and ratings:** scan, substitution, scheme and fill-the-form drills, plus Glicko and readiness.
5. **Polish:** Guide (two lenses), welcome, Portfolio, Range Map, Admin studio for the content bank, and a link back from the Forge's home page (a small PR to `rhetoric-salle`).

**Verify each phase:** run the unit tests, build, then do a Playwright pass over every page on desktop and at 390px wide in dark mode, with no console errors and no horizontal scroll. Mock OpenRouter in Playwright to test the judge paths. Don't call the live API in tests.

---

## 10. Working agreements with Richard

- Richard and Kat are a plural system, and both read every reply. Address them as "we", in one voice. Kat thinks in patterns and is fast and compressed; Richard builds understanding step by step. Offer both routes for anything technical.
- Mark uncertainty. Separate fact from speculation, and never invent facts, dates or attributions. This matters especially for passage sources and public-domain status.
- Push back when something's wrong; don't flatter.
- The repo is `SoulFireMage/eloquacity`. Richard's local clone is at `C:\eloquacity\eloquacity`. Ask before anything outward-facing that isn't covered here.
