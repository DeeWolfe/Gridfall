// Player-facing changelog. Unlike everything else under src/content, this is
// hand-authored rather than generated from reference/gridfall-data.json —
// it's prose for a person to read, not balance data. Bump VERSION and add a
// new entry to the front of PATCH_NOTES with every release worth telling a
// commander about; skip the ones that are pure internal cleanup.

export const VERSION = '1.9';

export const PATCH_NOTES = [
  {
    v: '1.9',
    notes: [
      'Every card with a weapon now draws its firing pattern instead of describing it — the shape it covers, at a glance, no counting cells out of a sentence.',
      'Selecting a unit lights every tile its weapon reaches, not just the ones that already have something standing in them. Gold still marks what actually gets struck.',
      'Tapping a hostile now selects it the same way your own units do: its threat lights up, and Deselect / View card work on it too. Attacking still comes first — a hostile already in your sights is a target, not a thing to inspect.',
      'Card text is trimmed to the ability itself. Deploy cost, hull and class come off the stat block — all three were already printed on the card.',
      'Hostiles gained a Counter line: how to beat it, kept separate from what it does.',
      'Central Command calls ahead of every operation now. A transmission before the drop, paced by you — it plays once per operation, and Settings can reset them.',
      "Operation Shallowhelm's story is rewritten. The fortress anchors the whole line, a cult opened its gates from the inside, and the Self-Cleanse is now the Purge Protocol.",
      'Four new cards fight over the back line: Longshot and Sapper Turret reach into theirs, Rearguard and Backstop Battery defend yours. Optics Relay and Rear Sights join the gear list.',
      'Recon Lark and Backstop Battery are instants — they resolve and leave no body behind.',
      'New hostile: the Puppeteer. It never moves, and every third turn it seizes the nearest unit in its lane and turns it on you.',
      'New field event: Burrow Breach. The floor opens under a marked tile and swallows whatever is still standing on it.',
      'Field events explain themselves now — tap a research pod or a bombardment crater for what it is and how long it lasts.',
      'Civilian Extract is a shelter to hold rather than a scatter of static pods, and every operation has a signature hazard of its own.',
      'Pixel units on the grid have centred visors and redrawn weapons, so you can tell a Marksman from a Lancer without reading the label.',
      'The gear-fitting list groups by role, with a filter once you own enough to need one.',
      'A cleared operation stays cleared and offers a Replay button, instead of silently rolling a fresh set of missions behind you.',
      'Daily Challenge sits at the top of the mode list.',
      'Fixed: specialist card art was off-centre in its frame, and gauntlet packs let you keep a card without letting you look at it first.',
    ],
  },
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
