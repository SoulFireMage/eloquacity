// Public-domain passages, extracted verbatim from Project Gutenberg (see tools/passages).
// Rule: the author died before 1955 and the work was first published before 1929.

import raw from './passages.json';

export interface Passage {
  id: string;
  author: string;
  /** Author's death year; null for anonymous works (the King James Bible). */
  died: number | null;
  work: string;
  /** First publication. */
  year: number;
  gutenberg: number;
  /** Chapter and verse, for scripture. */
  ref?: string;
  /** Editorial judgement: 1 blunt and vivid … 5 ultraviolet. */
  register: 1 | 2 | 3 | 4 | 5;
  /** Editorial one-liner on what the passage does. */
  note: string;
  text: string;
}

export const PASSAGES = raw as Passage[];

export const passageById = (id: string) => PASSAGES.find((p) => p.id === id);

export const gutenbergUrl = (p: Passage) => `https://www.gutenberg.org/ebooks/${p.gutenberg}`;

export const citation = (p: Passage) => `${p.author}, ${p.work}${p.ref ? `, ${p.ref}` : ''} (${p.year})`;
