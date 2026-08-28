// Guard: every unit has a pixel token for the combat grid. Coverage both
// ways, well-formed SVG, distinctness, and the contrast rule the tokens were
// commissioned under — light bodies with warm accents, never the faction
// cyan or magenta that would sink into the tiles behind them.
import {POOL} from '../src/content/cards.js';
import {BEST} from '../src/content/hostiles.js';
import {unitSprite, foeSprite, hasSprite, hasFoeSprite, spriteIds, foeSpriteIds, SCHEMES}
  from '../src/render/sprites.js';

const F = [];

Object.keys(POOL).forEach(id => {
  if (!hasSprite(id)) F.push(`no sprite for unit '${id}'`);
});
spriteIds().forEach(id => {
  if (!POOL[id]) F.push(`sprite '${id}' names no card`);
});

const seen = {};
Object.keys(POOL).forEach(id => {
  const svg = unitSprite(id, 0);
  if (!svg.includes('class="pxu"')) F.push(`${id}: token is not a pxu sprite`);
  if (!svg.includes('crispEdges')) F.push(`${id}: token will blur instead of staying pixel-crisp`);
  if ((svg.match(/<svg/g) || []).length !== 1) F.push(`${id}: malformed svg`);
  if (svg.includes('undefined') || svg.includes('NaN')) F.push(`${id}: bad values in sprite`);
  if (/#4de8ff|#ff4d8f/i.test(svg)) F.push(`${id}: faction tile colour inside a token (contrast rule)`);
  if (seen[svg]) F.push(`'${id}' and '${seen[svg]}' share the same sprite`);
  else seen[svg] = id;
});

// The stagger keeps a full line from bobbing in lockstep.
if (unitSprite('rifle', 3) === unitSprite('rifle', 7)) F.push('bob stagger ignores the delay seed');

// Hostiles: every entry in the bestiary has a token, under the same rules.
Object.keys(BEST).forEach(k => {
  if (!hasFoeSprite(k)) F.push(`no sprite for hostile '${k}'`);
});
foeSpriteIds().forEach(k => {
  if (!BEST[k]) F.push(`hostile sprite '${k}' names no foe`);
});
const foeSeen = {};
Object.keys(BEST).forEach(k => {
  const svg = foeSprite(k, 0);
  if ((svg.match(/<svg/g) || []).length !== 1) F.push(`${k}: malformed foe svg`);
  if (svg.includes('undefined') || svg.includes('NaN')) F.push(`${k}: bad values in foe sprite`);
  if (/#4de8ff|#ff4d8f/i.test(svg)) F.push(`${k}: faction tile colour inside a foe token (contrast rule)`);
  if (foeSeen[svg]) F.push(`'${k}' and '${foeSeen[svg]}' share the same foe sprite`);
  else foeSeen[svg] = k;
});

// Uniform schemes: every scheme keeps the contrast rule and actually recolours.
Object.keys(SCHEMES).forEach(k => {
  const sc = SCHEMES[k];
  if (!sc.n || sc.price == null || !sc.b || !sc.s || !sc.v) F.push(`scheme '${k}' is missing fields`);
  if (/#4de8ff|#ff4d8f/i.test(sc.b + sc.s + sc.v)) F.push(`scheme '${k}' uses a faction tile colour`);
});
const schemeFaces = new Set(Object.keys(SCHEMES).map(k => unitSprite('rifle', 0, k)));
if (schemeFaces.size !== Object.keys(SCHEMES).length) F.push('two schemes render identically');
if (unitSprite('rifle', 0, 'no-such-scheme') !== unitSprite('rifle', 0, 'standard')) {
  F.push('an unknown scheme should fall back to standard');
}

if (F.length) {
  console.log('PIXEL FAILURES:\n  ' + F.join('\n  '));
  process.exit(1);
}
console.log(`pixel tokens: ${Object.keys(POOL).length} units, ${Object.keys(BEST).length} hostiles, ${Object.keys(SCHEMES).length} schemes — all checks pass`);
