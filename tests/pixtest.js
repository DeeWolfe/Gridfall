// Guard: every unit has a pixel token for the combat grid. Coverage both
// ways, well-formed SVG, distinctness, and the contrast rule the tokens were
// commissioned under — light bodies with warm accents, never the faction
// cyan or magenta that would sink into the tiles behind them.
import {POOL} from '../src/content/cards.js';
import {unitSprite, hasSprite, spriteIds} from '../src/render/sprites.js';

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

if (F.length) {
  console.log('PIXEL FAILURES:\n  ' + F.join('\n  '));
  process.exit(1);
}
console.log(`pixel tokens: all ${Object.keys(POOL).length} units covered, all checks pass`);
