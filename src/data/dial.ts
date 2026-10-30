// Plain paragraphs for the Register Dial, written for Eloquacity. They sit at setting 3
// (neutral) on purpose: a baseline to rewrite from, never a target and never praised.

export interface DialSource {
  id: string;
  title: string;
  text: string;
}

export const DIAL_SOURCES: DialSource[] = [
  {
    id: 'market',
    title: 'The market',
    text: 'The market opens at seven. By eight the stalls are busy and the street is crowded. People buy fruit, bread and cheap clothes. At noon it rains for a while and some traders cover their goods. By four o’clock most of them have packed up and the street is quiet again.',
  },
  {
    id: 'storm',
    title: 'A storm coming',
    text: 'In the afternoon the sky became darker. The wind grew stronger and the trees along the road began to move. A farmer brought his cows in from the field. Soon it started to rain heavily, and there was thunder in the distance. The storm lasted for about an hour.',
  },
  {
    id: 'kitchen',
    title: 'The kitchen at night',
    text: 'It was late and the kitchen was empty. The dishes from dinner were still in the sink. The fridge made a low noise. A tap was dripping slowly. On the table there was a half-finished cup of tea and a letter that someone had left open.',
  },
  {
    id: 'dog',
    title: 'The dog',
    text: 'The dog sat by the front door every afternoon. It waited there until the children came home from school. When it heard their voices it stood up and wagged its tail. If they were late, it lay down and watched the street.',
  },
  {
    id: 'house-sale',
    title: 'The house sale',
    text: 'After the old woman died, her family sold the house. They cleared out the furniture over two weekends. Some things went to a charity shop and some were thrown away. The new owners painted the walls and replaced the windows. Within a year it looked like a different house.',
  },
  {
    id: 'train',
    title: 'The train',
    text: 'The train left the city a few minutes late. It passed factories, then houses, then open fields. Most passengers read or looked at their phones. A man in the corner fell asleep. After two hours the train reached the coast, and the sea appeared on the left.',
  },
  {
    id: 'waiting-room',
    title: 'The waiting room',
    text: 'The waiting room was warm and too bright. About a dozen people sat on plastic chairs. Some talked quietly, but most were silent. A television on the wall showed the news with the sound off. Every few minutes a nurse came in and called out a name.',
  },
  {
    id: 'garden',
    title: 'The garden in autumn',
    text: 'In October the garden changed. The leaves on the apple tree turned yellow and began to fall. The last roses were small and brown at the edges. In the mornings there was mist over the grass. The garden was quieter than it had been in summer.',
  },
  {
    id: 'letter',
    title: 'The letter',
    text: 'The letter arrived on a Tuesday. It was in a thick cream envelope with no return address. She opened it at the kitchen table and read it twice. Then she folded it, put it back in the envelope, and placed it in a drawer.',
  },
  {
    id: 'harbour',
    title: 'The harbour',
    text: 'The fishing boats came back into the harbour in the early evening. Gulls followed them in. The men unloaded boxes of fish onto the quay. Buyers looked at the catch and made offers. Later, when the boats were tied up, the harbour was calm.',
  },
];

/** The five steps. Setting 3 is the source, shown as the baseline only. */
export const DIAL = [
  { n: 1, label: 'Blunt and vivid', brief: 'Short, hard, concrete; plain words that hit.' },
  { n: 2, label: 'Brisk', brief: 'Quick, clean, energetic; no lingering.' },
  { n: 3, label: 'Neutral', brief: 'The baseline. Never the target.' },
  { n: 4, label: 'Lush', brief: 'Rich, sensuous, layered, unhurried.' },
  { n: 5, label: 'Ultraviolet', brief: 'As purple as prose goes: ornate, maximal, yet still under control.' },
] as const;

export const TARGET_SETTINGS = [1, 2, 4, 5] as const;
export type DialSetting = (typeof TARGET_SETTINGS)[number];
