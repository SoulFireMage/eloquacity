import type { ExerciseKind } from '../lib/types';

export interface Exercise {
  kind: ExerciseKind;
  route: string;
  title: string;
  blurb: string;
  /** Short label for lists (Portfolio, telemetry). */
  short: string;
}

export const PROSE_EXERCISES: Exercise[] = [
  { kind: 'shapeshifter', route: '/prose/shapeshifter', title: 'Shapeshifter', short: 'Shapeshifter', blurb: 'You’re dealt a rhythm target and a subject. Write to the shape; the strip checks it.' },
  { kind: 'ladder_grow', route: '/prose/ladders', title: 'Grow and Shrink', short: 'Grow ladder', blurb: 'Grow a six-word seed to sixty words, or cut a master’s long sentence down to six, without losing its heart.' },
  { kind: 'register_dial', route: '/prose/dial', title: 'The Register Dial', short: 'Register Dial', blurb: 'Rewrite one plain paragraph at blunt, brisk, lush or ultraviolet. Judged against the setting, never against taste.' },
  { kind: 'imitation', route: '/prose/imitation', title: 'Imitation', short: 'Imitation', blurb: 'Copy a master sentence’s shape, length, order and pauses, on a subject of your own.' },
  { kind: 'restore', route: '/prose/restore', title: 'Restore the Pause', short: 'Restore the Pause', blurb: 'A passage with its pauses taken out. Put them back, then compare with the author’s choices.' },
  { kind: 'free_desk', route: '/desk', title: 'The Free Desk', short: 'Free Desk', blurb: 'Write anything; watch its cadence; ask for notes against your own aim.' },
];

export const KIND_LABEL: Record<ExerciseKind, string> = {
  free_desk: 'Free Desk',
  shapeshifter: 'Shapeshifter',
  ladder_grow: 'Grow ladder',
  ladder_shrink: 'Shrink ladder',
  register_dial: 'Register Dial',
  imitation: 'Imitation',
  restore: 'Restore the Pause',
};
