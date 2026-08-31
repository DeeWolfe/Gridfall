// Pixel Ops: the on-grid combat tokens. Every friendly unit is a 12×12
// pixel sprite, drawn as SVG rects (crispEdges) from the readable row-string
// maps below — edit a string, rebuild, and the token changes. Sprites idle
// with a two-frame bob; visor and glint pixels (v/G/f) blink on their own
// slower clock.
//
// Palette: muted, tactical tones — a war story, not a toy chest. Standard
// Issue (the free default) is dark olive drab; every purchasable scheme is
// an equally desaturated colour, never a bright primary. The contrast rule
// still holds: a body dark enough to blur into the near-black outline (Onyx,
// Cobalt) gets its own lighter outline override (`o` in SCHEMES) so the
// silhouette never disappears into the tile behind it.
//
// Cohesion with the rest of the game: the outline ink and the two colours
// that carry meaning (gold = "yours and alive," violet = "hostile") are the
// exact --deep/--gold/--violet hex the UI uses for the same ideas elsewhere
// — card backgrounds, specialist trim and achievements, the third lead
// colour — so a pixel token and an ink-seal card read as the same object
// language rather than two palettes that merely resemble each other.
// Everything else (armour tone, weapon metal, cloth shade) stays its own
// material colour on purpose; that variety is what makes a sprite instead
// of a swatch.
//
// Map legend:  . empty   o outline   b body   s shade   w weapon
//              g gold    W white     v visor glint   G gold glint   f flame

import {POOL} from '../content/cards.js';

// Outline ink and the two "faction identity" accents are pulled to the
// exact hex the rest of the UI uses for the same idea — --deep (card and
// page backgrounds), --gold (specialist trim, achievements, currency) — so
// the pixel tokens read as the same object language as everything else,
// not a lookalike palette that happens to be close. Everything else here
// (armour tone, weapon metal, cloth shade) stays its own material colour;
// forcing all of it onto UI tokens would flatten the sprites, not unify them.
// Weapon metal (w) is deliberately the second-brightest thing on a sprite.
// It started as #5b6284, which measured 1.97:1 against the player tile — the
// body sat at 7.85:1, so every weapon sank into the board and a Rifleman, a
// Marksman and a Lancer all read as the same green body. #aebbd2 puts it at
// 6.05:1 on the worst of the three tile colours while staying in the cool
// family, so it never competes with gold's "yours and alive" meaning.
const PX_COLOR = {
  o: '#0e0c1e', b: '#ccd3ea', s: '#8b93b6', w: '#aebbd2',
  g: '#ffc94d', W: '#f4f6ff', v: '#ffc94d', G: '#ffc94d', f: '#ff9a3d',
};
const PX_BLINK = {v: 1, G: 1, f: 1};

/** Merge an overlay onto a base map: any non-dot overlay pixel wins. */
const ov = (base, patch) => base.map((row, y) => {
  const p = patch[y];
  if (!p) return row;
  return row.split('').map((ch, x) => (p[x] && p[x] !== '.') ? p[x] : ch).join('');
});

// A 12-row overlay that is mostly empty, written sparsely: {rowIndex: 'string'}.
const sparse = obj => Array.from({length: 12}, (_, y) => obj[y] || '............');

// -- chassis -----------------------------------------------------------------

const TROOPER = [
  '............',
  '............',
  '....oooo....',
  '...obvvbo...',
  '...obbbbo...',
  '..oobssboo..',
  '..o.bbbb.o..',
  '....bbbb....',
  '....obbo....',
  '....ob.bo...',
  '...oo..oo...',
  '............',
];

const HEAVY = [
  '............',
  '...oooooo...',
  '..obbbbbbo..',
  '..obbvvbbo..',
  '..obbbbbbo..',
  '.oobssssboo.',
  '.o.bbbbbb.o.',
  '.o.bssssb.o.',
  '...bbbbbb...',
  '...obb.bbo..',
  '..oo....oo..',
  '............',
];

const KNEEL = [
  '............',
  '............',
  '............',
  '....oooo....',
  '...obvvbo...',
  '...obbbbo...',
  '..oobssboo..',
  '..o.bbbb.o..',
  '....bbbbo...',
  '...ob..bbo..',
  '..oo....oo..',
  '............',
];

// -- the 62 tokens -----------------------------------------------------------

const PIXMAP = {
  // scouts and skirmish troopers
  scout: ov(TROOPER, sparse({1: '.....G......', 2: '.....o......'})),
  recon: [
    '............',
    '............',
    '..G......G..',
    '..oo....oo..',
    '...osbbso...',
    '...obvvbo...',
    '...osbbso...',
    '..oo....oo..',
    '..G......G..',
    '............',
    '............',
    '............',
  ],
  pathfinder: ov(TROOPER, sparse({0: '.........gg.', 1: '.........gg.', 2: '.........wg.', 3: '.........w..', 4: '.........w..', 5: '.........w..'})),
  rifle: ov(TROOPER, sparse({5: '.........w..', 6: '........wwwv'})),
  zaku: [
    '............',
    '............',
    '.ooo....ooo.',
    '.ovvo..ovvo.',
    '.obbo..obbo.',
    '.obbo..obbo.',
    '.bssb..bssb.',
    '.obbo..obbo.',
    '.o..o..o..o.',
    '.oo.oo.oo.oo',
    '............',
    '............',
  ],
  vanguard: ov(TROOPER, sparse({4: '.ss.........', 5: '.ss.........', 6: '.ss.........', 7: '.ss.........'})),
  marks: ov(KNEEL, sparse({5: '......wwwwwv', 6: '......w.....'})),
  longshot: ov(KNEEL, sparse({2: '..........wv', 3: '.........w..', 4: '........w...', 5: '.......w....', 6: '......w.....'})),
  // Rearguard faces the other way — weapon out the LEFT edge, toward your
  // own line, which is the whole point of the card.
  rearguard: ov(TROOPER, sparse({3: '...obvvbo...', 5: '..w.........', 6: 'vwww........'})),
  archer: ov(TROOPER, sparse({2: '.........w..', 3: '..........w.', 4: '.......wwwv.', 5: '..........w.', 6: '..........w.', 7: '.........w..'})),
  assassin: ov(TROOPER, sparse({3: '...osvvso...', 5: '..oosssso...', 7: '.........w..', 8: '..........wv'})),
  kunoichi: ov(TROOPER, sparse({3: '...osvvso...', 4: 'v.........v.', 5: '.w.......w..', 6: '..w.....w...'})),
  samurai: ov(TROOPER, sparse({1: '.....gg.....', 2: '....goog....', 6: '.........w..', 7: '..........w.', 8: '..........w.', 9: '..........wv'})),
  ronin: ov(TROOPER, sparse({2: '....ssss....', 7: '.w........w.', 8: 'w..........w', 9: 'v..........v'})),
  naginata: ov(TROOPER, sparse({0: '........vv..', 1: '.........w..', 2: '.........w..', 3: '.........w..', 4: '.........w..', 5: '.........w..', 6: '.........w..', 7: '.........w..', 8: '.........w..'})),
  lancer: ov(TROOPER, sparse({6: '.....wwwwwwv'})),
  herald: ov(TROOPER, sparse({0: '........wggg', 1: '........wggg', 2: '........wgg.', 3: '........w...', 4: '........w...', 5: '........w...'})),
  medic: ov(TROOPER, sparse({5: '..oobWsboo..', 6: '..o.WWWW.o..', 7: '....bWbb....'})),
  knight: ov(HEAVY, sparse({4: '.wo.........', 5: '.wo.........', 6: '.wo.........', 7: '.wo.........', 8: '.wo.........'})),
  bulwark: ov(HEAVY, sparse({3: '.oo.........', 4: '.ob.........', 5: '.ob.........', 6: '.ob.........', 7: '.ob.........', 8: '.ob.........', 9: '.oo.........'})),
  outrider: [
    '............',
    '............',
    '............',
    '....oooo....',
    '...obvvbo...',
    '...obbbbo...',
    '..oobssboo..',
    '.wwwbbbbwww.',
    'owwwwwwwwwwo',
    '.oo......oo.',
    '..o......o..',
    '............',
  ],
  cipher: ov(TROOPER, sparse({0: '....G..G....', 1: '....GG.GG...'})),
  engineer: ov(TROOPER, sparse({4: '.gg......w..', 5: '.g......www.', 6: '.g.......w..'})),
  mortar: ov(KNEEL, sparse({1: '..........vv', 2: '.........ww.', 3: '........ww..', 4: '.......ww...', 5: '......ow....'})),
  ashigaru: ov(TROOPER, sparse({4: '..........vv', 5: '.........ww.', 6: '........ww..', 7: '.......ww...', 8: '.....o......'})),
  pikewall: ov(TROOPER, sparse({0: '..........vv', 1: '.........ww.', 2: '........ww..', 3: '.......ww...', 4: '......w.....', 8: '.oo.........'})),
  sentry: ov(TROOPER, sparse({1: '..........v.', 7: '.........www', 8: '..........wv'})),
  falconer: ov(TROOPER, sparse({1: '..G......G..', 2: '...G....G...', 6: '.........ww.', 7: '..........wv'})),

  // tech emplacements and devices
  wall: [
    '............',
    '............',
    '............',
    '............',
    'oooooooooooo',
    'obbsobbsobbo',
    'oooooooooooo',
    'osbbosbbosbo',
    'oooooooooooo',
    'obbsobbsobbo',
    'oooooooooooo',
    '............',
  ],
  supply: [
    '............',
    '....G..G....',
    '...oo..oo...',
    '....obbo....',
    '...obssbo...',
    '............',
    '...oooooo...',
    '..obbbbbbo..',
    '..obgbbgbo..',
    '..obbbbbbo..',
    '..oooooooo..',
    '............',
  ],
  beacon: [
    '............',
    '.....GG.....',
    '.....GG.....',
    '.....oo.....',
    '.....ob.....',
    '.....ob.....',
    '.....ob.....',
    '.....ob.....',
    '....oobb....',
    '...obbbbo...',
    '..oooooooo..',
    '............',
  ],
  cache: [
    '............',
    '............',
    '............',
    '...oooooo...',
    '..obbbbbbo..',
    '..obggggbo..',
    '..oboooobo..',
    '..obbbbbbo..',
    '..obssssbo..',
    '..oooooooo..',
    '............',
    '............',
  ],
  shield: [
    '............',
    '..v......v..',
    '.v........v.',
    '.v........v.',
    '..ob....bo..',
    '...obbbbo...',
    '....obbo....',
    '....obbo....',
    '....obbo....',
    '...obssbo...',
    '..oooooooo..',
    '............',
  ],
  turret: [
    '............',
    '............',
    '............',
    '....oooo....',
    '...obssbwwwv',
    '...obbbbo...',
    '....oooo....',
    '...obbbbo...',
    '..obssssbo..',
    '..oo....oo..',
    '.oo......oo.',
    '............',
  ],
  relay: [
    '............',
    '.G...GG...G.',
    '..o..oo..o..',
    '...o.oo.o...',
    '....ooob....',
    '.....ob.....',
    '.....ob.....',
    '.....ob.....',
    '....obbo....',
    '...obssbo...',
    '..oooooooo..',
    '............',
  ],
  techblade: [
    '............',
    '.....vv.....',
    '.....vW.....',
    '.....vW.....',
    '.....vW.....',
    '.....vW.....',
    '.....vW.....',
    '.....oo.....',
    '....obbo....',
    '...obssbo...',
    '..oooooooo..',
    '............',
  ],
  pulse: [
    '............',
    '............',
    '....GGGG....',
    '...G....G...',
    '....oooo....',
    '...obbbbo...',
    '..obbssbbo..',
    '..obbbbbbo..',
    '..osbbbbso..',
    '..oooooooo..',
    '............',
    '............',
  ],
  scrambler: [
    '............',
    '.G..........',
    '..w.....w...',
    '...w...w....',
    '....w.w.....',
    '.....ob.....',
    '....oooo....',
    '...obbbbo...',
    '...obssbo...',
    '...oooooo...',
    '............',
    '............',
  ],
  battery: [
    '............',
    '..v...v...v.',
    '..w...w...w.',
    '..w...w...w.',
    '..w...w...w.',
    '..w...w...w.',
    '.oooooooooo.',
    '.obbbbbbbbo.',
    '.obssssssbo.',
    '.oooooooooo.',
    '............',
    '............',
  ],
  fob: [
    '............',
    '............',
    '....g.......',
    '...ooooooo..',
    '..obbbbbbbo.',
    '.obbbbbbbbbo',
    '.obbooobssbo',
    '.obbobobssbo',
    '.obbooobssbo',
    '.ooooooooooo',
    '............',
    '............',
  ],
  mine: [
    '............',
    '............',
    '............',
    '............',
    '............',
    '............',
    '.....GG.....',
    '....obbo....',
    '..oobssboo..',
    '.obbbbbbbbo.',
    '..oooooooo..',
    '............',
  ],
  backstop: [
    '............',
    '..v......v..',
    '..w......w..',
    '..w......w..',
    '.oooooooooo.',
    '.obbbbbbbbo.',
    '.obGbbbbGbo.',
    '.obbbbbbbbo.',
    '.obssssssbo.',
    '.oooooooooo.',
    '.oo......oo.',
    '............',
  ],
  sapper: [
    '............',
    '............',
    '............',
    '............',
    '......w.....',
    '......wv....',
    '.....oooo...',
    '....obbbbo..',
    '..oobssboo..',
    '.obbbbbbbbo.',
    '..oooooooo..',
    '............',
  ],
  dynamo: [
    '............',
    '.....G......',
    '....GG......',
    '...GG.......',
    '..oooooooo..',
    '..obbbbbbo..',
    '..obsGGsbo..',
    '..obsGGsbo..',
    '..obbbbbbo..',
    '..oooooooo..',
    '............',
    '............',
  ],
  rampart: ov(HEAVY, sparse({7: '.o.bwwwwb.o.', 8: '...bssssb...'})),
  piercer: ov(HEAVY, sparse({2: '.........www', 3: '..obbbbbbwwv'})),
  suppressor: [
    '............',
    '.G..........',
    '..G.....G...',
    '...oo..oo...',
    '....oooo....',
    '...obbbbo...',
    '..obbssbbo..',
    '...obbbbo...',
    '...oooooo...',
    '............',
    '............',
    '............',
  ],
  reactor: [
    '............',
    '....G..G....',
    '...oo..oo...',
    '..obbbbbbo..',
    '..obggggbo..',
    '..obgGGgbo..',
    '..obggggbo..',
    '..obbbbbbo..',
    '...oooooo...',
    '............',
    '............',
    '............',
  ],
  bore: [
    '............',
    '.....vW.....',
    '.....vW.....',
    '.....vW.....',
    '.....oo.....',
    '.....oo.....',
    '....obbo....',
    '...obssbo...',
    '...obbbbo...',
    '..oooooooo..',
    '............',
    '............',
  ],

  // specialists — gold-trimmed
  aegis: ov(HEAVY, sparse({2: '.go.........', 3: '.gb.........', 4: '.gb.........', 5: '.gb.........', 6: '.gb.........', 7: '.gb.........', 8: '.gb.........', 9: '.go.........', 1: '...gooooog..'})),
  biomed: ov(TROOPER, sparse({2: '....gggg....', 5: '..oobWsboo..', 6: '..o.WggW.o..', 7: '....bWbb....'})),
  techmed: ov(TROOPER, sparse({4: '.gg.........', 5: '.gg.........', 6: '.gg.........', 7: '....bWWb....'})),
  dragoon: ov(HEAVY, sparse({1: '.f.oooooo.f.', 2: '.fobbbbbbof.', 10: '..oo....oo..'})),
  railgun: ov(KNEEL, sparse({4: '........wwww', 5: '...obbbbwwwv', 6: '..oobssbG...'})),
  hell: ov(TROOPER, sparse({10: '...ff..ff...', 11: '....f..f....', 1: '.........g..', 2: '.........g..'})),
  plasma: ov(HEAVY, sparse({4: '.........GG.', 5: '........GGGG', 6: '.........GG.'})),
  exo: [
    '............',
    '..oooooooo..',
    '.obbbbbbbbo.',
    '.obbbvvssbo.',
    '.obbbbbbsbo.',
    'oobssssssboo',
    'o.bbbbbbbb.o',
    'o.bssbbssb.o',
    '..bbbbbbbb..',
    '..obb..bbo..',
    '.oo......oo.',
    '............',
  ],
  hecate: [
    '............',
    '.v..v..v....',
    '.w..w..w....',
    '.w..w..w....',
    '.wwwwwww....',
    '..oooooooo..',
    '..obbbbbbog.',
    '..obssssbog.',
    '..obbbbbbo..',
    '...oo..oo...',
    '..oo....oo..',
    '............',
  ],
  kessen: ov(TROOPER, sparse({0: '....gg..gg..', 3: '...ovvssvo..', 5: '..oosssso...', 8: '.........gg.', 9: '.........gg.'})),
  ram: ov(HEAVY, sparse({1: '..gooooooog.', 5: '.wwwbssssb..', 6: '.wwwbssssb..'})),
  marshal: ov(TROOPER, sparse({0: '....gg..gg..', 1: '...oggggggo.', 8: '.g..........', 9: '.gg.........', 10: '.g..........'})),
  // Twin shoulder scythes over a heavy frame, a low guard blade and a katana
  // trailing down and right. Single-pixel diagonals read as noise at this size,
  // so every blade is a two-pixel shaft — the silhouette has to say "reaches
  // into the lanes either side of it" before the hitbox diagram gets a chance.
  // -- frames, and the pilot ------------------------------------------------
  // The Pilot is the only token in the game with no weapon pixel at all. Bubble
  // canopy, hands empty: at a glance you should read "this one cannot fight".
  pilot: ov(TROOPER, sparse({1: '....oooo....', 2: '...oWWWWo...', 3: '...oWvvWo...'})),
  // White Devil: gold V-fin over a pale chassis, the one light-bodied unit.
  whitedevil: [
    '............',
    '..g......g..',
    '...gooooog..',
    '..oWWvvWWo..',
    '..oWWWWWWo..',
    '.ooWssssWoo.',
    '.o.WWWWWW.o.',
    '.o.WssssW.o.',
    '...WWWWWW...',
    '...oWW.WWo..',
    '..oo....oo..',
    '............',
  ],
  // Seven Blades: bristling. Four blade shafts up, three out either side.
  sevenblades: [
    '.w..w..w..w.',
    '.w..w..w..w.',
    '...oooooo...',
    '..obbvvbbo..',
    '..obbbbbbo..',
    'woobssssboow',
    'w..bbbbbb..w',
    'wo.bssssb.ow',
    '...bbbbbb...',
    '...obb.bbo..',
    '..oo....oo..',
    '............',
  ],
  // Heavy Arms: the widest silhouette on the board, planted on braced feet —
  // it never moves, and the token should say so before the card does.
  heavyarms: [
    '............',
    '..oooooooo..',
    '.obbbbbbbbo.',
    '.obbvvvvbbo.',
    'wwwbbbbbbbww',
    'wwwbssssbbww',
    'wwwbbbbbbbww',
    '.obssssssbo.',
    '.obbbbbbbbo.',
    '.oo......oo.',
    'oooo....oooo',
    '............',
  ],
  ashura: ov(HEAVY, sparse({
    0: 'ww........ww',
    1: '.w........w.',
    2: '.w........w.',
    7: 'w...........',
    8: 'ww.......ww.',
    9: '.w........ww',
    10: '...........w',
    11: '..........w.',
  })),
};

// -- uniform schemes ----------------------------------------------------------
// Cosmetic recolours of the soldiers' field plate, sold at the Quartermaster.
// Bold, unmistakable colours — you should be able to name a squad's scheme
// from across the room. b/s/v are overridden (o too, where a dark body needs
// a light outline to hold the silhouette); weapons, gold trim and white stay.

// Every scheme's visor glint is the exact --gold token (Onyx's is --red) —
// whatever the armour colour, the pip that reads as "this unit is alive and
// yours" always matches the game's one gold accent, the same way a
// specialist card's border or an earned achievement does.
export const SCHEMES = {
  standard: {n: 'Standard Issue', price: 0, b: '#4a6b4a', s: '#2c402c', v: '#ffc94d'},
  crimson: {n: 'Crimson', price: 150, b: '#7a3232', s: '#4a1c1c', v: '#ffc94d'},
  cobalt: {n: 'Cobalt', price: 150, b: '#3c5490', s: '#243568', v: '#ffc94d', o: '#aebde0'},
  slate: {n: 'Slate', price: 150, b: '#4a4f5c', s: '#2c2f38', v: '#ffc94d'},
  plum: {n: 'Plum', price: 200, b: '#5c3358', s: '#371f36', v: '#ffc94d'},
  onyx: {n: 'Onyx', price: 200, b: '#23252f', s: '#121319', v: '#ff5a5a', o: '#8890a8'},
  umber: {n: 'Umber', price: 150, b: '#6b4a30', s: '#402c1c', v: '#ffc94d'},
  teal: {n: 'Teal', price: 175, b: '#2f6b64', s: '#1c403c', v: '#ffc94d'},
  sand: {n: 'Sand', price: 175, b: '#9c8a5e', s: '#6b5c3c', v: '#ffc94d'},
  indigo: {n: 'Indigo', price: 225, b: '#3c3a68', s: '#242340', v: '#ffc94d', o: '#a8a6d0'},
};

export const hasSprite = id => !!PIXMAP[id];
export const spriteIds = () => Object.keys(PIXMAP);

// -- hostile tokens -----------------------------------------------------------
// The hive reads as a colour, not a shape: violet chitin, near-black
// outlines, venom-green glow pixels — bright enough against every hostile
// tile tier (unit/tech/special) to never blur into the ground behind it.
// Green army, purple hive: the two forces are unmistakable at a glance.

// Same outline ink as the friendly roster (--deep) — one faction's tokens
// aren't drawn with darker or lighter "line weight" than the other's, they
// share literally the same ink. The body colour is the exact --violet
// token: the game's third named accent (team leads, section marks,
// stratagems) doubling as "this is the enemy," so purple means one thing
// everywhere in the game, not two similar-but-different purples.
const PXE_COLOR = {
  o: '#0e0c1e', b: '#9d6bff', s: '#5c3a86', w: '#4a3563',
  g: '#ffc94d', W: '#f4f6ff', x: '#cdf24c',
};

const FOE_PIX = {
  crawler: [
    '............',
    '............',
    '............',
    '............',
    '............',
    '....oooo....',
    '...obbbbo...',
    '..obxbbxbo..',
    '...osbbso...',
    '..o.o..o.o..',
    '.o..o..o..o.',
    '............',
  ],
  hulk: [
    '............',
    '............',
    '...oooooo...',
    '..obbbbbbo..',
    '.obbsbbsbbo.',
    '.obbbbbbbbo.',
    '.obxbbbbxbo.',
    '.obbssssbbo.',
    '..obbbbbbo..',
    '..oo.oo.oo..',
    '.oo..oo..oo.',
    '............',
  ],
  breacher: [
    '............',
    '............',
    '............',
    '.......oo...',
    '....ooobbo..',
    '..oobbbsbbow',
    '.obbbbbbbbww',
    '..oobbbsbbow',
    '....ooobxo..',
    '.......oo...',
    '..o.o..o....',
    '............',
  ],
  spitter: [
    '............',
    '............',
    '....oooo....',
    '...obbbbo...',
    '...obxxbo...',
    '...obbbboww.',
    '...osbbso.w.',
    '...obbbbo...',
    '....obbo....',
    '...o.oo.o...',
    '..o..oo..o..',
    '............',
  ],
  burrower: [
    '............',
    '............',
    '.....ooo....',
    '....obbbo...',
    '...obxbbbo..',
    '...obbbbbo..',
    '....osbbbo..',
    '.....obbbo..',
    '...oobbbo...',
    '..obbbbo....',
    '...oooo.....',
    '............',
  ],
  spore: [
    '............',
    '............',
    '....oooo....',
    '...obbbbo...',
    '..obbxbbbo..',
    '..obbbbxbo..',
    '..obxbbbbo..',
    '...obbxbo...',
    '....oooo....',
    '.....oo.....',
    '....oooo....',
    '............',
  ],
  jammer: [
    '............',
    '.x........x.',
    '..w......w..',
    '...w....w...',
    '....oooo....',
    '...obbbbo...',
    '..obxbbxbo..',
    '..obbssbbo..',
    '...obbbbo...',
    '..o.o..o.o..',
    '.o..o..o..o.',
    '............',
  ],
  pylon: [
    '............',
    '.....oo.....',
    '....obbo....',
    '....obbo....',
    '...obxbbo...',
    '...obbbbo...',
    '..obbsbbbo..',
    '..obbbbsbo..',
    '.obbbbbbbbo.',
    '.oooooooooo.',
    '............',
    '............',
  ],
  harrower: [
    '............',
    '..w......w..',
    '..ww....ww..',
    '...oooooo...',
    '..obxbbxbo..',
    '...obbbbo...',
    '..oobssboo..',
    '.o..bbbb..o.',
    '....obbo....',
    '....o..o....',
    '...oo..oo...',
    '............',
  ],
  // The hive's answer to the Ashura: the same broad frame read back in hive
  // plate. Horns instead of a crest, a blade out either side because it fights
  // whichever way it turns, and a full pixel wider than the Harrower so the
  // two never get mistaken for each other at a glance.
  oni: [
    '.x........x.',
    '.xx......xx.',
    '..oooooooo..',
    '.obbxbbxbbo.',
    '.obbbbbbbbo.',
    'wwobssssbow.',
    '.wwbbbbbbww.',
    '..obssssbo..',
    '..obbbbbbo..',
    '..oob..boo..',
    '.oo......oo.',
    '............',
  ],
  mender: [
    '............',
    '............',
    '....oooo....',
    '...obbbbo...',
    '..obbWWbbo..',
    '..obWxxWbo..',
    '..obbWWbbo..',
    '...osbbso...',
    '....obbo....',
    '...o.oo.o...',
    '..o..oo..o..',
    '............',
  ],
  husk: [
    '............',
    '............',
    '...oooooo...',
    '..obbbbbbo..',
    '..obo..obo..',
    '..obo..obo..',
    '..obbooobo..',
    '..osbbbbso..',
    '...obbbbo...',
    '..o.o..o.o..',
    '.o..o..o..o.',
    '............',
  ],
  screamer: [
    '............',
    '............',
    '...oooooo...',
    '..obbbbbbo..',
    '..obboobbo..',
    '..obo..obo..',
    '..obo..obo..',
    '..obboobbo..',
    '..obbxxbbo..',
    '...oooooo...',
    '..o.o..o.o..',
    '............',
  ],
  chorus: [
    '............',
    '............',
    '..oo.oo.oo..',
    '.obboxxobbo.',
    '.obbobbobbo.',
    '..oo.oo.oo..',
    '....obbo....',
    '...obbbbo...',
    '..obsbbsbo..',
    '...oooooo...',
    '..o..oo..o..',
    '............',
  ],
  sovereign: [
    '............',
    '.g.g.gg.g.g.',
    '.gggggggggg.',
    '..oooooooo..',
    '.obxbbbbxbo.',
    '.obbbbbbbbo.',
    'oobbssssbboo',
    'o.bbbbbbbb.o',
    '..obssssbo..',
    '..obbbbbbo..',
    '.oo.o..o.oo.',
    '............',
  ],
  puppeteer: [
    '............',
    '.o..oooo..o.',
    '..o.obbo.o..',
    '...oobboo...',
    '....obbo....',
    '...obxxbo...',
    '..oobbbboo..',
    '.o.obbbbo.o.',
    'o..obwwbo..o',
    '...o.ww.o...',
    '..o..oo..o..',
    '............',
  ],
};

export const hasFoeSprite = k => !!FOE_PIX[k];
export const foeSpriteIds = () => Object.keys(FOE_PIX);

const renderPix = (map, colors, cls, delay) => {
  let rects = '';
  map.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.' || !colors[ch]) continue;
      rects += `<rect x="${x * 8}" y="${y * 8}" width="8" height="8" fill="${colors[ch]}"${PX_BLINK[ch] || ch === 'x' ? ' class="pxg"' : ''}/>`;
    }
  });
  const d = ((delay % 10) * 0.13).toFixed(2);
  return `<svg class="${cls}" viewBox="0 0 96 96" shape-rendering="crispEdges" aria-hidden="true"
    style="animation-delay:-${d}s">${rects}</svg>`;
};

/**
 * The on-grid token. `delay` staggers the idle bob so a full line does not
 * march in lockstep; pass anything stable per unit (uid works). `scheme`
 * names a uniform recolour — unknown or absent falls back to standard.
 */
export function unitSprite(id, delay = 0, scheme) {
  const map = PIXMAP[id];
  if (!map) return '';
  const sc = SCHEMES[scheme] || SCHEMES.standard;
  const colors = {...PX_COLOR, b: sc.b, s: sc.s, v: sc.v};
  if (sc.o) colors.o = sc.o;
  return renderPix(map, colors, 'pxu', delay);
}

/** A hostile's token — same engine, the hive palette. */
export function foeSprite(k, delay = 0) {
  const map = FOE_PIX[k];
  if (!map) return '';
  return renderPix(map, PXE_COLOR, 'pxu pxe', delay);
}
