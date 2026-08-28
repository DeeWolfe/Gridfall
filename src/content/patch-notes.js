// Player-facing changelog. Unlike everything else under src/content, this is
// hand-authored rather than generated from reference/gridfall-data.json —
// it's prose for a person to read, not balance data. Bump VERSION and add a
// new entry to the front of PATCH_NOTES with every release worth telling a
// commander about; skip the ones that are pure internal cleanup.

export const VERSION = '1.8';

export const PATCH_NOTES = [
  {
    v: '1.8',
    notes: [
      'The hand tray in combat now collapses, so you can see more of the board.',
      "Card art no longer prints the card's name a second time on top of the seal — and the seal is centred in the frame.",
      'Four new uniform schemes: Umber, Teal, Sand, Indigo.',
      'Quartermaster cleanup — fewer redundant labels in the shop.',
    ],
  },
  {
    v: '1.7',
    notes: [
      'Salvage is gone. Cards, gear and uniforms all spend the same credits now.',
    ],
  },
  {
    v: '1.6',
    notes: [
      '12 new cards and 6 new gear pieces join the roster.',
      'Requisition packs arrive a little slower, to make room for the bigger collection.',
    ],
  },
  {
    v: '1.5',
    notes: [
      'Daily Challenge: one mission a day, the same for every commander, with a streak to protect.',
      'Squad, Quartermaster, Database and Service Record each walk a new commander through once.',
      'Combat has its own music now, distinct from the hold screen.',
      'An animated title screen.',
    ],
  },
  {
    v: '1.4',
    notes: [
      'Turn events, lane charges, the Dynamo card, and enemy intent readouts.',
      'Achievements, and a pull-up drawer for quick settings mid-mission.',
    ],
  },
  {
    v: '1.3',
    notes: [
      "Every unit — yours and the hive's — gets a hand-drawn pixel sprite on the board.",
      'Purchasable uniform schemes for your whole roster.',
      'A darker, more tactical palette.',
    ],
  },
  {
    v: '1.2',
    notes: [
      'Ink-seal card art for every card, and chip-style tiles throughout the shop and squad screens.',
      'Desktop and compact interface modes.',
    ],
  },
  {
    v: '1.1',
    notes: [
      'Eight team leads, each with a passive and a stratagem call.',
      'Three new hostiles, three new campaign operations.',
    ],
  },
  {
    v: '1.0',
    notes: [
      'First release: campaign operations, lane-defence combat, Squad, Quartermaster and Database, local save records.',
    ],
  },
];
