// Pixel Ops: the on-grid combat tokens. Every friendly unit is a 12×12
// pixel sprite, drawn as SVG rects (crispEdges) from the readable row-string
// maps below — edit a string, rebuild, and the token changes. Sprites idle
// with a two-frame bob; visor and glint pixels (v/G/f) blink on their own
// slower clock.
//
// Contrast rule (the reason these exist in this palette): token bodies are
// light silver with near-black outlines so they pop off the dark cyan
// friendly tiles, and every accent is warm — gold, white, ember — never
// cyan-on-cyan. Hostiles keep their glyph chips; these are ours.
//
// Map legend:  . empty   o outline   b body   s shade   w weapon
//              g gold    W white     v visor glint   G gold glint   f flame

import {POOL} from '../content/cards.js';

const PX_COLOR = {
  o: '#12102a', b: '#ccd3ea', s: '#8b93b6', w: '#5b6284',
  g: '#ffc94d', W: '#f4f6ff', v: '#ffd970', G: '#ffc94d', f: '#ff9a3d',
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
  '...ovvbbo...',
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
  '..obvvbbbo..',
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
  '...ovvbbo...',
  '...obbbbo...',
  '..oobssboo..',
  '..o.bbbb.o..',
  '....bbbbo...',
  '...ob..bbo..',
  '..oo....oo..',
  '............',
];

// -- the 46 tokens -----------------------------------------------------------

const PIXMAP = {
  // scouts and skirmish troopers
  scout: ov(TROOPER, sparse({1: '.....G......', 2: '.....o......'})),
  recon: [
    '............',
    '............',
    '..G......G..',
    '..oo....oo..',
    '...osbbso...',
    '..obvvbbo...',
    '...osbbso...',
    '..oo....oo..',
    '..G......G..',
    '............',
    '............',
    '............',
  ],
  pathfinder: ov(TROOPER, sparse({1: '.........gg.', 2: '.........wg.', 3: '.........w..', 4: '.........w..', 5: '.........w..'})),
  rifle: ov(TROOPER, sparse({5: '.........ww.', 6: '..........wv'})),
  zaku: [
    '............',
    '............',
    '.ooo....ooo.',
    '.ovbo..ovbo.',
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
  marks: ov(KNEEL, sparse({5: '.........www', 6: '..........v.'})),
  archer: ov(TROOPER, sparse({3: '.........w..', 4: '..........w.', 5: '..........w.', 6: '..........w.', 7: '.........w..'})),
  assassin: ov(TROOPER, sparse({3: '...ovvsso...', 5: '..oosssso...', 8: '.........w..', 9: '.........w..'})),
  kunoichi: ov(TROOPER, sparse({5: '.w.......w..', 6: '.w.......w..', 3: '...ossvvo...'})),
  samurai: ov(TROOPER, sparse({1: '.....gg.....', 2: '....goog....', 8: '.........w..', 9: '..........w.', 10: '...........w'})),
  ronin: ov(TROOPER, sparse({2: '....ssss....', 8: '.w..........', 9: '.w..........', 10: '.w..........'})),
  naginata: ov(TROOPER, sparse({1: '.........v..', 2: '.........w..', 3: '.........w..', 4: '.........w..', 5: '.........w..', 6: '.........w..', 7: '.........w..', 8: '.........w..'})),
  lancer: ov(TROOPER, sparse({5: '........wwwv'})),
  herald: ov(TROOPER, sparse({1: '.........wgg', 2: '.........wgg', 3: '.........w..', 4: '.........w..', 5: '.........w..'})),
  medic: ov(TROOPER, sparse({5: '..oobWsboo..', 6: '..o.WWWW.o..', 7: '....bWbb....'})),
  knight: ov(HEAVY, sparse({4: '.wo.........', 5: '.wo.........', 6: '.wo.........', 7: '.wo.........', 8: '.wo.........'})),
  bulwark: ov(HEAVY, sparse({3: '.oo.........', 4: '.ob.........', 5: '.ob.........', 6: '.ob.........', 7: '.ob.........', 8: '.ob.........', 9: '.oo.........'})),
  outrider: [
    '............',
    '............',
    '............',
    '....oooo....',
    '...ovvbbo...',
    '...obbbbo...',
    '..oobssboo..',
    '.wwwbbbbwww.',
    'owwwwwwwwwwo',
    '.oo......oo.',
    '..o......o..',
    '............',
  ],
  cipher: ov(TROOPER, sparse({0: '....G..G....', 1: '....GG.GG...'})),
  engineer: ov(TROOPER, sparse({5: '.g.......w..', 6: '.g.......ww.', 4: '.gg.........'})),
  mortar: ov(KNEEL, sparse({2: '.........ww.', 3: '........ww..', 4: '.......ww...', 5: '......ow....'})),

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
  cannon: ov(TROOPER, sparse({1: '......www.wv', 2: '......oss...', 3: '...ovvbss...'})),
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
    '.obvvbbssbo.',
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
};

// -- uniform schemes ----------------------------------------------------------
// Cosmetic recolours of the soldiers' field plate, sold at the Quartermaster.
// Bold, unmistakable colours — you should be able to name a squad's scheme
// from across the room. b/s/v are overridden (o too, where a dark body needs
// a light outline to hold the silhouette); weapons, gold trim and white stay.

export const SCHEMES = {
  standard: {n: 'Standard Issue', price: 0, b: '#ccd3ea', s: '#8b93b6', v: '#ffd970'},
  crimson: {n: 'Crimson', price: 150, b: '#e04f4f', s: '#8f2626', v: '#ffd970'},
  cobalt: {n: 'Cobalt', price: 150, b: '#5578f0', s: '#2d3f96', v: '#ffd970'},
  emerald: {n: 'Emerald', price: 150, b: '#4fd070', s: '#237a3c', v: '#f4f6ff'},
  rose: {n: 'Rose', price: 200, b: '#ff7ab8', s: '#a83e70', v: '#fff0f6'},
  onyx: {n: 'Onyx', price: 200, b: '#383b4f', s: '#181a26', v: '#ff5b5b', o: '#d4d9ec'},
};

export const hasSprite = id => !!PIXMAP[id];
export const spriteIds = () => Object.keys(PIXMAP);

// -- hostile tokens -----------------------------------------------------------
// The hive is bone and chitin: pale bodies, near-black outlines, venom-green
// glow pixels — hot-light on the maroon tiles, never magenta-on-maroon.

const PXE_COLOR = {
  o: '#1a0d16', b: '#e6d4c4', s: '#a8907e', w: '#6b4e52',
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
