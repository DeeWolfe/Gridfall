// Gear: the pool, the Shoulder Cannon's move out of the card pool, the fitting
// rules, and the Squad panel's organisation controls.
//
// Two things here are easy to break quietly. The Cannon was a card that landed
// on a unit mid-mission and is now a piece of gear fitted at the armoury — the
// second shot has to survive that move, and a commander who had already bought
// the card has to be paid back in the piece it became. And gear is one copy per
// profile: fitting a piece somewhere new must take it off wherever it was, or
// the pool silently duplicates.
import './support/install-dom.js';
import * as A from './support/api.js';
import {get} from './support/dom.js';
import {failures} from './support/harness.js';
import {POOL} from '../src/content/cards.js';
import {GEAR} from '../src/content/gear.js';
import {mkUnit} from '../src/rules/units.js';
import {migrate, commit} from '../src/save/profile.js';
import {openPanel} from '../src/render/panels.js';
import {focusCard, focusGear, gearWearer} from '../src/render/focus.js';

const F = failures();
const p = A.blankProfile('GEAR');
p.unlocks.cards = Object.keys(POOL);
p.unlocks.gear = Object.keys(GEAR);
p.loadout.deck = Object.keys(POOL).slice(0, 12);
p.settings.hints = {squad: 1};
A.enterProfile(p);

// --- the Cannon is gear now, and nothing still calls it a card ---
{
  if (POOL.cannon) F.push('Shoulder Cannon is still in the card pool');
  if (!GEAR.cannon) F.push('Shoulder Cannon is not in the gear pool');
  else {
    if (!GEAR.cannon.twin) F.push('the Cannon gear does not carry the twin-fire flag');
    if (!GEAR.cannon.role) F.push('the Cannon gear has no role, so it lands in no fitting tab');
  }
  // Every piece of gear must declare a role or the fitting tabs lose it.
  Object.keys(GEAR).forEach(gi => {
    if (!['offense', 'defense', 'utility'].includes(GEAR[gi].role)) {
      F.push(`gear '${gi}' has no valid role`);
    }
  });
}

// --- the second shot is a property of the unit from the moment it lands ---
{
  const host = Object.keys(POOL).find(c => POOL[c].dmg && POOL[c].hp && !POOL[c].attach);
  p.loadout.gear = {[host]: 'cannon'};
  if (!mkUnit(host, 0, 0).twin) F.push('a Cannon-geared unit does not fire twice');
  p.loadout.gear = {};
  if (mkUnit(host, 0, 0).twin) F.push('an ungeared unit fires twice');
}

// --- an old record trades the card for the piece rather than losing it ---
{
  const old = migrate({
    version: 5, callsign: 'OLD',
    unlocks: {cards: ['rifle', 'cannon'], gear: [], enemies: [], leads: []},
    loadout: {deck: ['rifle', 'cannon'], gear: {}},
    progress: {rank: 1, xp: 0, credits: 0},
  });
  if (!old.unlocks.gear.includes('cannon')) F.push('a record that owned the Cannon card was not issued the gear');
  if (old.unlocks.cards.includes('cannon')) F.push('the retired card id survived migration');
  if (old.loadout.deck.includes('cannon')) F.push('the retired card is still in a deck');
  if (old.version < 6) F.push('migration did not stamp the new save version');

  // A record that never owned it is not handed a free 450-credit piece.
  const clean = migrate({
    version: 5, callsign: 'CLEAN',
    unlocks: {cards: ['rifle'], gear: [], enemies: [], leads: []},
    loadout: {deck: ['rifle'], gear: {}}, progress: {rank: 1, xp: 0, credits: 0},
  });
  if (clean.unlocks.gear.includes('cannon')) F.push('a record that never bought the card was issued the gear');
}

// --- one copy per profile: fitting it anywhere takes it off everywhere else ---
{
  const [a, b] = p.loadout.deck.filter(c => !POOL[c].attach);
  p.loadout.gear = {};
  focusGear('barrel', false, true);
  const rows = get('fwrap')._html;
  if (!rows.includes('data-wear=')) F.push('the gear focus view offers no card to fit it to');
  if (!rows.includes(POOL[a].n)) F.push('the fit list does not list the deck');

  p.loadout.gear[a] = 'barrel';
  if (gearWearer('barrel') !== a) F.push('gearWearer did not find the card wearing the piece');
  // The move the fit list performs.
  delete p.loadout.gear[gearWearer('barrel')];
  p.loadout.gear[b] = 'barrel';
  const worn = Object.keys(p.loadout.gear).filter(k => p.loadout.gear[k] === 'barrel');
  if (worn.length !== 1) F.push(`the piece is on ${worn.length} cards at once`);
}

// --- the fitting list says what each piece does, not just its name ---
{
  p.loadout.gear = {};
  focusCard(p.loadout.deck.find(c => !POOL[c].attach), 'gear');
  const html = get('fwrap')._html;
  if (!html.includes('class="grow')) F.push('the gear slot renders no fitting rows');
  if (!html.includes(GEAR.barrel.d)) F.push('a fitting row does not carry the rules text');
  if (!html.includes('data-groletab')) F.push('the fitting rows lost their role tabs');
}

// --- outside the fitting surface the block is a readout with the rules text ---
{
  const card = p.loadout.deck.find(c => !POOL[c].attach);
  p.loadout.gear = {[card]: 'barrel'};
  focusCard(card, 'hand');
  const html = get('fwrap')._html;
  if (html.includes('data-fitgear')) F.push('the hand view offers gear fitting mid-mission');
  if (!html.includes(GEAR.barrel.d)) F.push('the hand view does not say what the fitted gear does');
}

// --- the Squad panel organises, and the locker lists every owned piece ---
{
  openPanel('squad');
  const body = get('pbody')._html;
  if (!body.includes('data-sqsort=')) F.push('no sort control in Squad');
  if (!body.includes('data-sqgroup=')) F.push('no split control in Squad');
  const locker = (body.match(/data-gearfit="/g) || []).length;
  if (locker !== Object.keys(GEAR).length) {
    F.push(`the gear locker lists ${locker} of ${Object.keys(GEAR).length} owned pieces`);
  }
  if (!body.includes(GEAR.barrel.d)) F.push('the locker does not say what a piece does');
  // Splitting by class is the default and has to actually split.
  if (!body.includes('class="subsect"')) F.push('Squad does not split its grids by class');
}

// --- both arrangement choices persist on the profile ---
{
  p.settings.squadSort = 'level';
  p.settings.squadGroup = 'flat';
  commit();
  openPanel('squad');
  const body = get('pbody')._html;
  if (!/data-sqsort="level"[^>]*>/.test(body.replace(/\n/g, ''))) F.push('the sort control vanished');
  if (body.includes('class="subsect"')) F.push('"one list" still split the grids by class');
  const reloaded = A.initProfiles().find(x => x.id === p.id);
  if (!reloaded || reloaded.settings.squadSort !== 'level') {
    F.push('the sort choice did not survive a save/load round trip');
  }
}

F.report('gear: the Cannon moved, one copy per profile, and Squad can be sorted');
