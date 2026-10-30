# Rebuilding the passage bank

`src/data/passages.json` is generated, never typed by hand, so every passage is verbatim from its Project Gutenberg source.

1. `specs.json` lists each passage: its Gutenberg ID, its opening words, and either a sentence count (`n`) or an inclusive end phrase (`end`).
2. `meta.py` holds the author, the author's death year, the work and its first-publication year, plus the editorial register (1–5) and a one-line note for each passage.
3. Download each `https://www.gutenberg.org/cache/epub/<id>/pg<id>.txt` into a folder, then run:

```bash
python3 -I extract.py <folder> specs.json out.json
```

Then merge `out.json` with `meta.py` to produce `passages.json`. The unit tests check the public-domain rule (author died before 1955, work first published before 1929) and the shape of every entry.

The register and the notes are editorial judgements, not facts about the texts.
