// The Frame system, rebuilt: a 5 DP machine seeded into the opening hand,
// deployed like any other unit, running a closed kit of 1 DP gear cards.
//
// The Pilot is gone. What these guards keep true instead:
//
//   - the fielded Frame is seeded to hand at launch, outside the deck;
//   - it deploys on held ground with a functional base weapon;
//   - one Frame on the board at a time;
//   - gear fits only its own Frame, and is dead in hand without it;
//   - weapon gear replaces the weapon, support gear rides alongside;
//   - a riposte is a trait and survives a weapon swap;
//   - the reserve cycle never re-deals the machine;
//   - The Code (Bushido) returns the wreck and its kit to hand, at half hull;
//   - Field Refit swaps gear freely, one mounted at a time, for the turn.
import './support/install-dom.js';
import * as A from './support/api.js';
import {failures} from './support/harness.js';
import {spawnFoe, clearBoard, unlockAll, stillAir} from './support/fixtures.js';
import {POOL} from '../src/content/cards.js';
import {GEAR} from '../src/content/gear.js';
import {isProto} from '../src/save/progression.js';

const F = failures();
const FRAMES = Object.keys(POOL).filter(c => isProto(c));
const GEARCARDS = Object.keys(POOL).filter(c => POOL[c].frameGear);

let p;
const start = (frame, lead) => {
  p = unlockAll(A.blankProfile('FRAME'), ['rifle', 'wall', 'medic', 'marks', 'cipher']);
  p.loadout.frame = frame === undefined ? 'whitedevil' : frame;
  if (lead) p.lead = lead;
  A.enterProfile(p);
  A.launchSpec({node: null, type: 'stronghold', mod: 'none', reward: 0});
  stillAir();
  clearBoard();
  A.G.predict = [];
  A.G.held = [];
  A.G.dp = 30;
  return p;
};
/** Deploy straight from the hand, pushing the card in if the deal missed it. */
const play = (cid, l, c) => {
  if (!A.G.hand.includes(cid)) A.G.hand.push(cid);
  A.deploy(cid, l, c);
  return A.G.units.find(u => u.id === cid);
};

// --- the shape of the content ---
{
  if (FRAMES.length !== 3) F.push(`expected 3 Proto Frames, found ${FRAMES.length}`);
  if (POOL.pilot) F.push('the Pilot card still exists');
  FRAMES.forEach(c => {
    if (POOL[c].dp !== 5) F.push(`${c} costs ${POOL[c].dp} DP, spec says 5`);
    if (!POOL[c].dmg || POOL[c].tg === 'none') F.push(`${c} has no functional base weapon`);
  });
  // The Fireteam's kits ride the same mechanism; only the Frame kits are counted here.
  const FRAMEKITS = GEARCARDS.filter(c => isProto(POOL[c].frameGear));
  if (FRAMEKITS.length !== 17) F.push(`expected 17 Frame gear cards, found ${FRAMEKITS.length}`);
  GEARCARDS.forEach(c => {
    const k = POOL[c];
    if (!POOL[k.frameGear]) F.push(`${c} points at a host that does not exist`);
    if (k.dp !== 1) F.push(`${c} costs ${k.dp} DP, spec says 1`);
    if (k.slot !== 'weapon' && k.slot !== 'support') F.push(`${c} has no slot`);
  });
  const KITSIZE = {whitedevil: 6, sevenblades: 6, heavyarms: 5};
  FRAMES.forEach(f => {
    const kit = GEARCARDS.filter(c => POOL[c].frameGear === f);
    if (kit.length !== KITSIZE[f]) F.push(`${f} kit has ${kit.length} pieces, wanted ${KITSIZE[f]}`);
  });
  // The armoury's frame pieces are gone — gear cards replaced them all.
  Object.keys(GEAR).forEach(g => {
    if (GEAR[g].frame) F.push(`armoury piece '${g}' still claims a frame`);
  });
  console.log('shape: 3 frames at 5 DP with base weapons, 9 gear cards at 1 DP, no Pilot');
}

// --- seeding: opening hand, outside the deck ---
{
  start('whitedevil');
  if (!A.G.hand.includes('whitedevil')) F.push('the fielded Frame was not seeded to hand');
  if (!A.G.frame || A.G.frame.k !== 'whitedevil') F.push('G.frame does not carry the seed');
  if (A.G.deck.includes('whitedevil')) F.push('the Frame leaked into the deck');
  start(null);
  if (A.G.hand.some(c => isProto(c))) F.push('a Frame was seeded with an empty slot');
  console.log('seeding: the fielded Frame opens in hand, outside the deck');
}

// --- deploys on held ground, base weapon live, one at a time ---
{
  start('whitedevil');
  const tiles = A.validTiles('whitedevil');
  if (!tiles.length) F.push('a Frame has nowhere to deploy');
  if (tiles.some(i => A.G.ter[(i / A.COLS) | 0][i % A.COLS] !== 'p')) {
    F.push('a Frame was offered ground it does not hold');
  }
  const u = play('whitedevil', 2, 1);
  if (!u) F.push('the Frame did not deploy');
  else {
    if (!u.frame) F.push('the deployed machine is not flagged as a Frame');
    if (u.tg !== 'adj' || u.dmg !== 2) F.push(`vulcans wrong: ${u.tg}/${u.dmg}`);
    const e = spawnFoe('crawler', 2, 2, 99);
    A.fire(u, false);
    if (e.hp !== 97) F.push(`base weapon dealt ${99 - e.hp}, wanted 2`);
  }
  // A second machine waits its turn — even someone else's.
  if (A.validTiles('sevenblades').length) F.push('a second Frame could deploy alongside the first');
  if (!A.frameGateText('sevenblades')) F.push('the one-at-a-time gate gave no reason');
  console.log('deploy: held ground, vulcans land 2, one machine at a time');
}

// --- gear gating: dead without its Frame, alive on its cell ---
{
  start('whitedevil');
  if (A.validTiles('beamrifle').length) F.push('gear playable with no Frame on the board');
  if (!A.frameGateText('beamrifle')) F.push('absent-Frame gate gave no reason');
  const u = play('whitedevil', 2, 1);
  const tiles = A.validTiles('beamrifle');
  if (tiles.length !== 1 || tiles[0] !== u.lane * A.COLS + u.col) {
    F.push('gear does not target exactly its Frame\'s cell');
  }
  if (A.validTiles('greatsword').length) F.push('another Frame\'s gear fit the wrong machine');
  console.log('gating: gear dead in hand without its own Frame, targets its cell with it');
}

// --- weapon gear replaces; support gear rides alongside ---
{
  start('whitedevil');
  const u = play('whitedevil', 2, 1);
  play('beamrifle', 2, 1);
  if (u.gearW !== 'beamrifle' || u.tg !== 'first' || u.dmg !== 5 || !u.single) {
    F.push(`beam rifle mount wrong: ${u.gearW}/${u.tg}/${u.dmg}`);
  }
  play('booster', 2, 1);
  if (!u.gearS.includes('booster') || !u.boost || !u.servo) F.push('thruster pack did not ride alongside');
  if (u.gearW !== 'beamrifle') F.push('a support displaced the weapon');
  // Move two cells, then still fire — the pack's whole promise.
  u.acted = false; u.moved = false;
  if (!A.moveTargets(u).includes(2 * A.COLS + 3)) F.push('boosted Frame cannot stride two cells');
  A.doMove(u, 2, 3);
  if (u.acted) F.push('boosted move spent the action');
  // A second weapon tears the first off — no refit lead, no refund.
  play('beamsaber', 2, 3);
  if (u.gearW !== 'beamsaber' || u.dmg !== 7) F.push('beam saber did not replace the rifle');
  if (A.G.hand.includes('beamrifle')) F.push('the torn-off rifle came back without Field Refit');
  if (u.riposte !== 3) F.push(`beam saber riposte wrong: ${u.riposte}`);
  console.log('gear: rifle mounts, pack rides, saber replaces — 7 at contact, striking back');
}

// --- the riposte is a trait: Seven Blades answers blows under any sword ---
{
  start('sevenblades');
  const u = play('sevenblades', 2, 1);
  if (u.riposte !== POOL.sevenblades.riposte) F.push('Seven Blades lost its temper on deploy');
  play('greatsword', 2, 1);
  if (u.riposte !== POOL.sevenblades.riposte) F.push('a greatsword disarmed the riposte trait');
  if (u.tg !== 'vert3' || u.dmg !== 5) F.push(`greatsword wrong: ${u.tg}/${u.dmg}`);
  // Ammo Hopper on Heavy Arms: the gatling fires twice.
  start('heavyarms');
  const ha = play('heavyarms', 2, 1);
  play('ammohopper', 2, 1);
  if (!ha.twin) F.push('ammo hopper did not double the gatling');
  const e = spawnFoe('crawler', 2, 5, 99);
  A.fire(ha, false);
  const twice = POOL.heavyarms.dmg * 2;
  if (99 - e.hp !== twice) F.push(`hoppered gatling dealt ${99 - e.hp}, wanted ${twice}`);
  // Resonance Core: +1 per adjacent hostile.
  start('sevenblades');
  const sb = play('sevenblades', 2, 3);
  play('resonator', 2, 3);
  spawnFoe('crawler', 1, 3, 99);
  const prey = spawnFoe('crawler', 2, 4, 99);
  A.fire(sb, false);
  if (99 - prey.hp !== POOL.sevenblades.dmg + 2) {
    F.push(`resonating blade dealt ${99 - prey.hp}, wanted ${POOL.sevenblades.dmg + 2}`);
  }
  console.log('traits: riposte survives the swap, hopper doubles, core resonates');
}

// --- the reserve cycle never re-deals the machine ---
{
  start('whitedevil');
  play('whitedevil', 2, 1);
  A.G.hand = [];
  A.G.deck = [];
  let dealtFrame = false;
  for (let i = 0; i < 20; i++) { A.drawCard(); if (A.G.hand.includes('whitedevil')) dealtFrame = true; }
  if (dealtFrame) F.push('the cycled reserve dealt the Frame back');
  console.log('cycle: the machine is seeded once and never reshuffled in');
}

// --- The Code: half hull, and the wreck comes home with its kit ---
{
  start('whitedevil', 'salvagerights');
  const u = play('whitedevil', 2, 1);
  if (u.max !== Math.ceil(POOL.whitedevil.hp / 2)) {
    F.push(`Rushed Assembly hull wrong: ${u.max}, wanted ${Math.ceil(POOL.whitedevil.hp / 2)}`);
  }
  play('beamsaber', 2, 1);
  play('booster', 2, 1);
  const lost = A.G.lost;
  u.shield = 0;
  A.dmgUnit(u, 99, 'test');
  if (A.G.units.some(x => x.uid === u.uid)) F.push('the frame survived 99');
  if (A.G.lost !== lost + 1) F.push('a salvaged frame did not count as a loss');
  ['whitedevil', 'beamsaber', 'booster'].forEach(c => {
    if (!A.G.hand.includes(c)) F.push(`The Code lost ${c}`);
  });
  // Rushed Assembly leaves everyone else's units whole.
  const r = A.mkUnit('rifle', 3, 1);
  if (r.max !== A.POOL.rifle.hp) F.push('Rushed Assembly thinned a non-Frame');
  // And under any other lead the wreck stays a wreck.
  start('whitedevil', 'ironbrand');
  const v = play('whitedevil', 2, 1);
  v.shield = 0;
  A.dmgUnit(v, 99, 'test');
  if (A.G.hand.includes('whitedevil')) F.push('a frame came back without The Code');
  console.log('the code: half hull out, machine and kit recovered on death');
}

// --- The Code: 2 DP off every salvage, and never more than 2 ---
//
// The two halves of the rule pull opposite ways and both matter. The Ace
// Pilot may work the loop as many times as the mission allows — every wreck
// recovered comes back cheaper, not just the first. But the discount is a
// flat 2 off the next deployment, so a Frame lost three times redeploys at
// 2 off, not 6: it is assigned, never accumulated, and spent on redeploy.
{
  start('whitedevil', 'salvagerights');
  const base = A.costOf('whitedevil');
  const wreck = () => {
    const u = A.G.units.find(x => x.id === 'whitedevil');
    u.shield = 0;
    A.dmgUnit(u, 99, 'test');
  };

  // Three full loops: each death discounts the next deployment by exactly 2,
  // and each deployment spends it back to the printed cost.
  for (let round = 1; round <= 3; round++) {
    play('whitedevil', 2, 1);
    if (A.costOf('whitedevil') !== base) F.push(`round ${round}: deploying should spend the discount`);
    wreck();
    if (A.costOf('whitedevil') !== Math.max(1, base - 2)) {
      F.push(`round ${round}: salvage should take 2 off, got ${A.costOf('whitedevil')}`);
    }
    if (!A.G.hand.includes('whitedevil')) F.push(`round ${round}: the wreck did not come home`);
  }

  // And it does not accumulate: salvaging again over a discount already owed
  // re-states 2, it does not add to it.
  const held = A.G.units.find(x => x.id === 'whitedevil')
    || A.mkUnit('whitedevil', 2, 1);
  A.salvageFrame(held);
  A.salvageFrame(held);
  if (A.G.salvageDiscount.whitedevil !== 2) {
    F.push(`the discount stacked to ${A.G.salvageDiscount.whitedevil}`);
  }
  if (A.costOf('whitedevil') !== Math.max(1, base - 2)) {
    F.push(`stacked salvages priced the frame at ${A.costOf('whitedevil')}`);
  }
  console.log('the code: 2 DP off every salvage, repeatable, never stacking');
}

// --- Field Refit: swap freely, one mount, heals 3, costs no action ---
{
  start('whitedevil', 'fieldrefit');
  const u = play('whitedevil', 2, 1);
  play('beamrifle', 2, 1);
  if (u.gearW !== 'beamrifle') F.push('refit: first mount failed');
  u.acted = false;
  u.hp = Math.max(1, u.max - 6);
  const before = u.hp;
  play('beamsaber', 2, 1);
  if (u.gearW !== 'beamsaber') F.push('refit: swap did not mount the saber');
  if (!A.G.hand.includes('beamrifle')) F.push('refit: the rifle was not returned to hand');
  if (u.hp !== Math.min(u.max, before + 3)) F.push(`refit: the swap should heal 3, went ${before} -> ${u.hp}`);
  if (u.acted) F.push('refit: the swap spent the Frame\'s turn — it should not have');
  // Single Mount: a support does not ride alongside — it replaces.
  u.acted = false;
  play('booster', 2, 1);
  if (u.gearW || !u.gearS.includes('booster')) F.push('refit: single mount broken (weapon stayed on)');
  if (!A.G.hand.includes('beamsaber')) F.push('refit: the displaced saber was lost');
  if (u.dmg !== POOL.whitedevil.dmg || u.tg !== POOL.whitedevil.tg) {
    F.push('refit: base weapon not restored when the saber came off');
  }
  console.log('field refit: swaps return gear to hand, one mount, heal 3, no lost action');
}

F.report('the frame line holds: seeded, functional bare, closed kits, both frame leads honest');
