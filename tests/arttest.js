// Guard: every card has a face. The placeholder portrait layer must cover the
// whole pool (a card with no portrait silently falls back to the abstract
// sigil, which is exactly the gap this exists to catch), each portrait must be
// well-formed full-bleed SVG, and real art must still take precedence.
import {POOL} from '../src/content/cards.js';
import {CARD_ART} from '../src/content/card-art.js';
import {cardPortrait, hasPortrait, portraitIds} from '../src/render/portraits.js';
import {artFor} from '../src/render/art.js';

const F = [];

Object.keys(POOL).forEach(id => {
  if (!hasPortrait(id)) F.push(`no portrait for card '${id}'`);
});
portraitIds().forEach(id => {
  if (!POOL[id]) F.push(`portrait '${id}' names no card`);
});

Object.keys(POOL).forEach(id => {
  const svg = cardPortrait(id, '#4de8ff');
  if (!svg.includes('class="artfill"')) F.push(`${id}: portrait is not full-bleed (artfill)`);
  if (!svg.includes('preserveAspectRatio="xMidYMid slice"')) F.push(`${id}: portrait does not crop to its frame`);
  if ((svg.match(/<svg/g) || []).length !== 1) F.push(`${id}: malformed svg`);
  if (svg.includes('undefined') || svg.includes('NaN')) F.push(`${id}: bad values in portrait`);
});

// Distinctness: two different cards must never produce the same picture.
const seen = {};
Object.keys(POOL).forEach(id => {
  const svg = cardPortrait(id, '#4de8ff');
  if (seen[svg]) F.push(`'${id}' and '${seen[svg]}' share the same portrait`);
  else seen[svg] = id;
});

// artFor precedence: real art -> portrait -> sigil.
const first = Object.keys(POOL)[0];
if (!artFor(first, POOL[first].t).includes('artfill')) F.push('artFor does not use the portrait layer');
CARD_ART[first] = 'data:image/png;base64,x';
if (!artFor(first, POOL[first].t).includes('<img')) F.push('real art no longer beats the portrait');
delete CARD_ART[first];

if (F.length) {
  console.log('ART FAILURES:\n  ' + F.join('\n  '));
  process.exit(1);
}
console.log(`card portraits: all ${Object.keys(POOL).length} cards covered, all checks pass`);
