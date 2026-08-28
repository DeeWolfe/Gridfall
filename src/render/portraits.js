// Neon Sigil card faces: every card carries a glowing geometric insignia —
// military patch by way of cyberpunk HUD — on a scanlined ground with corner
// brackets and a rotated requisition serial. All procedural SVG, tinted by
// the accent the caller passes (tier colour, or a veterancy recolour).
//
// The sigils echo mechanics on purpose: Lance Battery's rail shows its three
// range ticks, Tech Blade its three vertical cells, Rail Sniper's beam runs
// the full lane. A real image in CARD_ART always wins over these (see artFor
// in art.js). Ink-seal kanji marks are reserved for card backs and ability
// icons, per the art direction pick.

import {POOL} from '../content/cards.js';

// -- shared primitives -------------------------------------------------------
// All coordinates live in a 100x140 viewBox; sigils centre on (50,64) and the
// serial rail owns the right edge. `c` is the accent colour.

const ring = (c, r, w = 2.4, dash = '') =>
  `<circle cx="50" cy="64" r="${r}" fill="none" stroke="${c}" stroke-width="${w}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
const dot = (c, r = 5, x = 50, y = 64) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`;
const stroke = (c, d, w = 2.6) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}"/>`;
const fillp = (c, d, o = 1) => `<path d="${d}" fill="${c}"${o < 1 ? ` opacity="${o}"` : ''}/>`;
const bars = (c, ys, w = 3.4) => stroke(c, ys.map(y => `M26 ${y} H74`).join(' '), w);

// -- the 46 sigils -----------------------------------------------------------

const SIGIL = {
  // scouts and skirmish troopers
  scout: c => `${stroke(c, 'M18 64 Q50 40 82 64 Q50 88 18 64 Z')}${dot(c, 6)}
    ${stroke(c, 'M50 34 V44 M50 84 V94', 1.8)}`,
  recon: c => `${stroke(c, 'M22 74 Q50 44 78 74')}${stroke(c, 'M34 70 Q50 52 66 70', 1.8)}${dot(c, 3.5, 50, 78)}
    ${stroke(c, 'M20 88 H34 M42 88 H50', 1.4)}`,
  pathfinder: c => `${stroke(c, 'M30 88 L66 52 M66 52 H46 M66 52 V72')}
    ${stroke(c, 'M26 96 L34 88 M40 82 L46 76', 1.6)}`,
  rifle: c => `${ring(c, 24)}${stroke(c, 'M50 32 V48 M50 80 V96 M18 64 H34 M66 64 H82', 2.4)}${dot(c)}`,
  zaku: c => `${ring(c, 11).replace('cx="50"', 'cx="36"')}${ring(c, 11).replace('cx="50"', 'cx="64"')}
    ${dot(c, 3, 36, 64)}${dot(c, 3, 64, 64)}${stroke(c, 'M26 86 H74', 2)}`,
  vanguard: c => `${stroke(c, 'M30 80 L50 62 L70 80', 3.2)}${stroke(c, 'M30 62 L50 44 L70 62', 3.2)}
    ${stroke(c, 'M30 94 H70', 1.8)}`,
  marks: c => `${stroke(c, 'M50 28 L62 64 L50 100 L38 64 Z')}${fillp(c, 'M50 42 L56 64 L50 86 L44 64 Z', .5)}
    ${stroke(c, 'M26 64 H38 M62 64 H74', 2)}`,
  archer: c => `${stroke(c, 'M34 32 Q66 64 34 96')}${stroke(c, 'M34 32 L34 96', 1.2)}
    ${stroke(c, 'M28 64 H70 M70 64 L60 57 M70 64 L60 71', 2.2)}`,
  assassin: c => `${stroke(c, 'M50 64 L68 32 M50 64 L82 64 M50 64 L68 96 M50 64 L32 96 M50 64 L18 64 M50 64 L32 32')}
    ${ring(c, 9, 2.6)}${dot(c, 3.5)}`,
  kunoichi: c => `${stroke(c, 'M30 34 L70 94 M70 34 L30 94', 2.8)}
    ${fillp(c, 'M50 56 L58 64 L50 72 L42 64 Z')}${stroke(c, 'M24 44 L30 34 M76 44 L70 34', 1.6)}`,
  samurai: c => `${ring(c, 17, 2.8)}${stroke(c,
    Array.from({length: 8}, (_, i) => {
      const a = i * Math.PI / 4;
      const x1 = 50 + Math.cos(a) * 23, y1 = 64 + Math.sin(a) * 23;
      const x2 = 50 + Math.cos(a) * 34, y2 = 64 + Math.sin(a) * 34;
      return `M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)}`;
    }).join(' '), 2.6)}${dot(c, 4)}`,
  ronin: c => `${stroke(c, 'M50 30 V98', 2.2)}${fillp(c, 'M50 40 L30 52 L50 58 Z')}
    ${fillp(c, 'M50 70 L70 82 L50 88 Z')}`,
  naginata: c => `${stroke(c, 'M36 100 L64 40', 2.4)}${stroke(c, 'M64 40 Q60 24 74 18', 2.8)}
    ${stroke(c, 'M30 92 L42 98', 1.8)}`,
  lancer: c => `${stroke(c, 'M26 44 L46 64 L26 84 M42 44 L62 64 L42 84 M58 44 L78 64 L58 84', 2.8)}`,
  herald: c => `${stroke(c, 'M38 26 V100', 2.4)}${fillp(c, 'M38 30 L74 42 L38 56 Z', .85)}
    ${stroke(c, 'M50 78 L62 72 M50 86 L66 80 M50 94 L62 90', 1.4)}`,
  medic: c => `${stroke(c, 'M50 28 L76 43 V85 L50 100 L24 85 V43 Z')}
    ${fillp(c, 'M44 48 h12 v10 h10 v12 h-10 v10 h-12 v-10 h-10 v-12 h10 Z')}`,
  knight: c => `${stroke(c, 'M50 30 L74 40 V70 Q74 90 50 100 Q26 90 26 70 V40 Z', 2.8)}
    ${stroke(c, 'M42 56 L58 72 M58 72 V60 M58 72 H46', 2.2)}`,
  bulwark: c => `${stroke(c, 'M30 36 H70 V90 Q50 102 30 90 Z', 2.8)}${stroke(c, 'M30 56 H70', 1.6)}
    ${stroke(c, 'M50 56 V96', 1.6)}`,
  outrider: c => `${stroke(c, 'M22 64 H64 M64 64 L50 50 M64 64 L50 78', 3)}
    ${stroke(c, 'M74 50 L84 64 L74 78', 2.4)}${stroke(c, 'M16 52 L22 64 L16 76', 1.4)}`,
  cipher: c => `${stroke(c, 'M34 46 Q50 30 66 46 M66 46 V34 M66 46 H54', 2.4)}
    ${stroke(c, 'M66 82 Q50 98 34 82 M34 82 V94 M34 82 H46', 2.4)}${dot(c, 3.5)}`,
  engineer: c => `${stroke(c, 'M32 48 L50 38 L68 48 V70 L50 80 L32 70 Z', 2.4)}
    ${stroke(c, 'M50 88 H74 M74 88 L64 81 M74 88 L64 95', 2.2)}`,
  mortar: c => `${stroke(c, 'M24 92 Q50 18 78 66', 2, )}${dot(c, 4.5, 78, 66)}
    ${stroke(c, 'M70 78 L86 78 M78 70 L78 86', 1.8)}${stroke(c, 'M20 98 H36', 2.6)}`,

  // tech emplacements and devices
  wall: c => `${bars(c, [44, 64, 84])}${stroke(c, 'M26 38 V90 M74 38 V90', 1.6).replace('stroke-width="1.6"', 'stroke-width="1.6" opacity=".5"')}`,
  supply: c => `${stroke(c, 'M26 52 Q50 30 74 52')}${stroke(c, 'M30 52 L44 74 M70 52 L56 74', 1.4)}
    ${stroke(c, 'M44 74 h12 v12 h-12 Z', 2)}`,
  beacon: c => `${fillp(c, 'M38 30 L62 30 L54 58 L46 58 Z', .5)}${stroke(c, 'M38 30 H62 M46 58 L54 58', 2)}
    ${stroke(c, 'M34 78 H66 M28 90 H72', 2.2)}${dot(c, 3, 50, 68)}`,
  cache: c => `${stroke(c, 'M30 46 H70 V90 H30 Z', 2.6)}${stroke(c, 'M30 60 H70 M50 46 V90', 1.6)}
    ${stroke(c, 'M42 30 L50 38 L58 30', 2)}`,
  shield: c => `${stroke(c, 'M50 34 L72 44 V70 Q72 88 50 96 Q28 88 28 70 V44 Z', 2.8)}
    ${ring(c, 34, 1.2, '3 6')}`,
  cannon: c => `${stroke(c, 'M22 64 H74', 5)}${stroke(c, 'M74 58 V70', 2)}
    ${stroke(c, 'M30 50 H58 M30 78 H50', 1.4)}${ring(c, 32, 1.2, '3 6')}`,
  turret: c => `${stroke(c, 'M32 90 L50 58 L68 90 Z', 2.6)}${stroke(c, 'M50 58 V34', 3)}
    ${stroke(c, 'M44 40 H56', 1.8)}${dot(c, 3, 50, 90)}`,
  relay: c => `${stroke(c, 'M50 96 V52', 2.4)}${stroke(c, 'M40 92 H60', 2.4)}
    ${stroke(c, 'M38 52 Q50 40 62 52 M32 42 Q50 26 68 42', 2)}`,
  techblade: c => `${fillp(c, 'M47 30 H53 V92 H47 Z', .9)}${stroke(c, 'M40 96 H60', 2.6)}
    ${stroke(c, 'M64 40 h8 M64 60 h8 M64 80 h8', 2.2)}`,
  pulse: c => `${ring(c, 12, 2.4)}${ring(c, 22, 1.6, '5 5')}${ring(c, 32, 1, '3 7')}${dot(c, 4)}`,
  scrambler: c => `${stroke(c, 'M24 50 L34 58 L44 50 L54 58 L64 50 L74 58', 2)}
    ${stroke(c, 'M24 70 L34 78 L44 70 L54 78 L64 70 L74 78', 2)}${stroke(c, 'M70 38 L30 92', 2.6)}`,
  battery: c => `${stroke(c, 'M20 64 H72', 2.6)}${stroke(c, 'M34 58 V70 M48 58 V70 M62 58 V70', 1.8)}
    ${fillp(c, 'M72 54 L86 64 L72 74 Z', .9)}`,
  fob: c => `${stroke(c, 'M28 92 V56 L50 38 L72 56 V92 Z', 2.6)}
    ${stroke(c, 'M50 62 V80 M41 71 H59', 2.4)}`,
  mine: c => `${ring(c, 14, 2.6)}${stroke(c,
    Array.from({length: 8}, (_, i) => {
      const a = i * Math.PI / 4 + Math.PI / 8;
      const x1 = 50 + Math.cos(a) * 16, y1 = 64 + Math.sin(a) * 16;
      const x2 = 50 + Math.cos(a) * 24, y2 = 64 + Math.sin(a) * 24;
      return `M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)}`;
    }).join(' '), 2.2)}${ring(c, 32, 1, '2 7')}`,
  dynamo: c => `${ring(c, 26, 2.4, '9 5')}${fillp(c, 'M56 38 L42 66 L52 66 L44 90 L62 60 L52 60 Z')}`,

  // specialists — bigger, busier emblems
  aegis: c => `${stroke(c, 'M50 28 L76 40 V70 Q76 92 50 102 Q24 92 24 70 V40 Z', 2.8)}
    ${fillp(c, 'M50 40 L66 48 V68 Q66 82 50 89 Q34 82 34 68 V48 Z', .4)}${stroke(c, 'M36 108 H64', 2.2)}`,
  biomed: c => `${stroke(c, 'M36 30 Q64 47 36 64 Q64 81 36 98', 2.2)}
    ${stroke(c, 'M64 30 Q36 47 64 64 Q36 81 64 98', 2.2)}
    ${stroke(c, 'M42 40 H58 M42 64 H58 M42 88 H58', 1.4)}`,
  techmed: c => `${ring(c, 26, 2, '7 4')}${fillp(c, 'M45 46 h10 v13 h13 v10 h-13 v13 h-10 v-13 h-13 v-10 h13 Z')}`,
  dragoon: c => `${fillp(c, 'M50 30 L72 78 H28 Z', .45)}${stroke(c, 'M50 30 L72 78 H28 Z', 2.4)}
    ${stroke(c, 'M40 88 L36 100 M60 88 L64 100', 2.6)}${stroke(c, 'M20 46 Q50 24 80 46', 1.2)}`,
  railgun: c => `${stroke(c, 'M10 64 H90', 3)}${stroke(c, 'M58 54 L70 64 L58 74 M72 54 L84 64 L72 74', 2)}
    ${stroke(c, 'M24 52 L36 64 L24 76 Z', 1.6)}`,
  hell: c => `${stroke(c, 'M30 26 L44 54 M52 22 L66 50 M70 34 L82 58', 2.6)}
    ${fillp(c, 'M44 54 L38 58 L48 62 Z M66 50 L60 54 L70 58 Z M82 58 L76 62 L86 66 Z')}
    ${stroke(c, 'M24 92 H76', 1.6)}`,
  plasma: c => `${dot(c, 12)}${ring(c, 19, 1.8)}${stroke(c,
    'M50 36 V26 M50 92 V102 M22 64 H12 M78 64 H88 M31 45 L24 38 M69 45 L76 38 M31 83 L24 90 M69 83 L76 90', 2)}
    ${stroke(c, 'M42 106 q4 6 0 10 M58 106 q-4 6 0 10', 1.6)}`,
  exo: c => `${stroke(c, 'M28 36 H44 V52 M72 36 H56 V52 M28 100 H44 V84 M72 100 H56 V84', 3)}
    ${fillp(c, 'M50 52 L60 64 L50 76 L40 64 Z')}`,
  hecate: c => `${ring(c, 22, 2.4).replace('cy="64"', 'cy="60"')}
    ${ring(c, 30, 1, '4 6').replace('cy="64"', 'cy="60"')}
    ${stroke(c, 'M58 68 L84 94 M78 96 L88 86', 2.6)}${dot(c, 6, 50, 60)}${dot(c, 3, 72, 38)}`,
};

export const hasPortrait = id => !!SIGIL[id];
export const portraitIds = () => Object.keys(SIGIL);

/** Full-bleed sigil face; `accent` is the tier or veterancy colour. */
export function cardPortrait(id, accent) {
  const draw = SIGIL[id];
  if (!draw) return '';
  const special = POOL[id] && POOL[id].t === 'special';
  const serial = ('GF-' + id.toUpperCase()).slice(0, 10);
  const uid = 'sg' + id;
  return `<svg class="artfill" viewBox="0 0 100 140" preserveAspectRatio="xMidYMid slice">
    <defs><filter id="gl-${uid}" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.4" result="b"/><feMerge>
      <feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <radialGradient id="rg-${uid}" cx="50%" cy="45%">
      <stop offset="0%" stop-color="${accent}" stop-opacity=".16"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/></radialGradient>
      <pattern id="sc-${uid}" width="4" height="4" patternUnits="userSpaceOnUse">
      <path d="M0 0 H4" stroke="${accent}" stroke-width=".5" opacity=".14"/></pattern></defs>
    <rect width="100" height="140" fill="#080614"/>
    <rect width="100" height="140" fill="url(#rg-${uid})"/>
    <rect width="100" height="140" fill="url(#sc-${uid})"/>
    <g filter="url(#gl-${uid})">${draw(accent)}</g>
    <path d="M8 10 H24 M8 10 V26 M92 10 H76 M92 10 V26" stroke="${accent}" stroke-width="1.4" opacity=".7"/>
    ${special ? `<path d="M8 130 L14 124 M92 130 L86 124" stroke="${accent}" stroke-width="1.4" opacity=".8"/>` : ''}
    <text x="93" y="120" font-size="5.5" fill="${accent}" opacity=".55" letter-spacing="1.6" text-anchor="end"
      transform="rotate(-90 93 120)" font-family="ui-monospace,monospace">${serial}</text>
  </svg>`;
}
