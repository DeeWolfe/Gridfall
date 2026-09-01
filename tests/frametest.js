// Proto Frames: the slot, the Pilot, the machine, and the weapon chosen before
// the mission.
//
// A Proto Frame is the only card in the game that costs a DECISION rather than
// a turn. Deploy points renew, so an expensive card is just a slow card; a
// Frame costs a whole turn's points, a second card placed a turn earlier, and a
// setup step the hive gets to punish. Everything guarded here keeps that true:
//
//   - one Frame per deck, in its own slot beside the twelve, never in them;
//   - one deployment per mission, and the slot closes behind it;
//   - a Frame cannot land without a Pilot, and lands ON one;
//   - the Pilot is spent, not killed — it is climbing in;
//   - a destroyed Frame puts its Pilot back on the board, alive;
//   - Frame gear REPLACES the printed weapon and is bound to one Frame;
//   - a bare Frame is always playable, never a dead draw.
import './support/install-dom.js';
import * as A from './support/api.js';
import {failures} from './support/harness.js';
import {spawnUnit, spawnFoe, clearBoard, unlockAll, stillAir} from './support/fixtures.js';
import {POOL} from '../src/content/cards.js';
import {GEAR} from '../src/content/gear.js';
import {gearFits, frameWeapon, isProto, isExo} from '../src/save/progression.js';
import {validTiles, isPilot} from '../src/rules/board.js';
import {frameReady, seedFrame} from '../src/rules/frames.js';

const F = failures();
const FRAMES = Object.keys(POOL).filter(c => isProto(c));
const EXOS = Object.keys(POOL).filter(c => isExo(c));
const PILOTS = Object.keys(POOL).filter(c => POOL[c].pilot);

let p;
const start = (frame) => {
  p = unlockAll(A.blankProfile('FRAME'), ['pilot', 'rifle', 'wall', 'medic', 'marks', 'cipher']);
  p.loadout.frame = frame === undefined ? 'whitedevil' : frame;
  A.enterProfile(p);
  A.launchSpec({node: null, type: 'stronghold', mod: 'none', reward: 0});
  stillAir();
  clearBoard();
  A.G.predict = [];
  A.G.held = [];
  A.G.dp = 30;
  return p;
};
const cellsOf = ids => new Set(ids);
// The Frame is never in hand; it is seeded into its slot at launch. Swapping
// which one the mission carries means re-seeding, not dealing a card.
const fieldFrame = cid => { p.loadout.frame = cid; seedFrame(); };

// --- the shape of the content ---
{
  if (!PILOTS.length) F.push('no Pilot card exists');
  if (FRAMES.length !== 3) F.push(`expected three Frames, found ${FRAMES.length}`);
  PILOTS.forEach(c => {
    if (POOL[c].dmg) F.push(`${c}: a Pilot carries a weapon`);
    if (POOL[c].hp > 3) F.push(`${c}: a Pilot is not fragile (${POOL[c].hp} hull)`);
  });
  FRAMES.forEach(c => {
    const k = POOL[c];
    if (k.t !== 'special') F.push(`${c} is not Specialist tier`);
    // The v2.4 brief argued "more than one cell, or the Frame is just a big
    // Rifleman" and the first build followed it. Measured, the two-cell body
    // changed no win rate but cost 13 points of landing rate — one mission in
    // five, the footprint never found a legal spot around its Pilot. What
    // makes a Frame feel big is its weapon arc, not its parking space.
    if ((k.size || 1) !== 1) F.push(`${c} is ${k.size} cells wide — measured as pure downside`);
    // A bare Frame must be playable, never a dead draw.
    if (!k.tg || k.tg === 'none' || !k.dmg) F.push(`${c} has no base weapon`);
    if (!Object.keys(GEAR).some(g => GEAR[g].frame === c)) F.push(`${c} has no weapons`);
    // Every Proto costs a full turn's deploy points — the whole point of the
    // class is that fielding one IS the turn.
    if (k.dp !== A.MAXDP) F.push(`${c} costs ${k.dp} DP, not a full turn's ${A.MAXDP}`);
  });
  // The older machines are Exo frames: same lore family, no Pilot, no slot.
  if (!EXOS.length) F.push('nothing is classed as an Exo frame');
  EXOS.forEach(c => { if (isProto(c)) F.push(`${c} is both an Exo and a Proto`); });
  console.log('proto:', FRAMES.join(', '), '| exo:', EXOS.join(', '));
}

// --- an Exo frame is deployed like any other card, Pilot or no Pilot ---
{
  start();
  EXOS.forEach(c => {
    if (!validTiles(c).length) F.push(`${c} (Exo) cannot deploy onto held ground`);
  });
}

// --- a Frame with no Pilot on the board has nowhere to go ---
{
  start();
  FRAMES.forEach(c => {
    if (validTiles(c).length) F.push(`${c} offered a cell with no Pilot deployed`);
  });
  // ...and a Silent Insertion charge must not turn it into a drop card.
  A.G.freeDrop = 3;
  FRAMES.forEach(c => {
    if (validTiles(c).length) F.push(`${c} became droppable under Silent Insertion`);
  });
  A.G.freeDrop = 0;
}

// --- with a Pilot, the offer is on it and beside it, and nowhere else ---
{
  start();
  spawnUnit('pilot', 2, 3);
  const tiles = cellsOf(validTiles('whitedevil'));
  const at = (l, c) => l * A.COLS + c;
  // On the Pilot: the Frame fills (2,3)-(2,4).
  if (!tiles.has(at(2, 3))) F.push('a Frame cannot land on its own Pilot');
  // Beside it: anchored at (2,2) the footprint is (2,2)-(2,3) — still on it.
  if (!tiles.has(at(2, 2))) F.push('a Frame cannot land across its Pilot');
  // A lane away, touching: (1,3)-(1,4) is orthogonally beside (2,3).
  if (!tiles.has(at(1, 3))) F.push('a Frame cannot land in the lane beside its Pilot');
  // Two cells clear of the Pilot in every direction is out of reach.
  if (tiles.has(at(0, 3))) F.push('a Frame landed two lanes from any Pilot');
  if (tiles.has(at(2, 6))) F.push('a Frame landed clear across the board from its Pilot');
  console.log('white devil offered', tiles.size, 'cells around one pilot');
}

// --- deploying spends the Pilot without counting it as a casualty ---
{
  start();
  const pv = spawnUnit('pilot', 2, 3);
    const lost = A.G.lost;
  A.deploy('whitedevil', 2, 3);
  if (A.G.units.some(u => u.uid === pv.uid)) F.push('the Pilot survived alongside the Frame');
  if (A.G.lost !== lost) F.push('spending a Pilot was counted as losing a unit');
  const fr = A.G.units.find(u => u.id === 'whitedevil');
  if (!fr) F.push('the Frame never landed');
  else {
    if (fr.size !== 1) F.push(`the Frame landed ${fr.size} cells wide, expected one`);
    if (fr.pilotId !== 'pilot') F.push('the Frame does not remember which Pilot it took aboard');
  }
  if (frameReady()) F.push('the Frame slot stayed open after it was spent');
  if (A.G.hand.includes('whitedevil')) F.push('the Frame ended up in the hand');
}

// --- a destroyed Frame puts its Pilot back on the board ---
{
  start();
  spawnUnit('pilot', 2, 3);
  fieldFrame('sevenblades');
  A.deploy('sevenblades', 2, 3);
  const fr = A.G.units.find(u => u.id === 'sevenblades');
  const lost = A.G.lost;
  A.dmgUnit(fr, 999, 'test');
  if (A.G.units.some(u => u.uid === fr.uid)) F.push('the Frame survived a killing blow');
  if (A.G.lost !== lost + 1) F.push('the destroyed Frame was not counted as lost');
  const out = A.G.units.find(u => isPilot(u));
  if (!out) F.push('the Pilot went up with the machine');
  else {
    if (out.hp !== 1) F.push(`the Pilot ejected at ${out.hp} hull, expected 1`);
    if (out.lane !== 2 || out.col !== 3) F.push('the Pilot ejected somewhere other than the wreck');
  }
}

// --- an ejected Pilot can climb into another Frame ---
{
  const fr = A.G.units.find(u => u.id === 'sevenblades');
  if (fr) F.push('setup: the wreck is still standing');
  fieldFrame('heavyarms');
  if (!validTiles('heavyarms').length) F.push('an ejected Pilot cannot take another Frame');
}

// --- nowhere to eject to: the Pilot goes up with it ---
{
  start();
  spawnUnit('pilot', 2, 3);
  A.deploy('whitedevil', 2, 3);
  const fr = A.G.units.find(u => u.id === 'whitedevil');
  spawnFoe('crawler', 2, 3);            // standing in the wreck's front cell
  A.dmgUnit(fr, 999, 'test');
  if (A.G.units.some(u => isPilot(u))) F.push('a Pilot ejected into an occupied cell');
}

// --- Frames are closed kits, in both directions ---
{
  start();
  Object.keys(GEAR).forEach(gi => {
    const bound = GEAR[gi].frame;
    FRAMES.forEach(c => {
      const should = bound === c;
      if (gearFits(c, gi) !== should) {
        F.push(`gearFits(${c}, ${gi}) = ${!should} — frame kits are not closed`);
      }
    });
    // General gear onto a regular card yes; frame gear onto one never.
    if (gearFits('rifle', gi) !== !bound) F.push(`${gi} fits a Rifleman incorrectly`);
  });
}

// --- a fitted weapon REPLACES the printed one ---
{
  start();
  const bare = A.mkUnit('whitedevil', 2, 3);
  if (bare.tg !== POOL.whitedevil.tg) F.push('a bare Frame lost its service weapon');
  if (bare.dmg !== POOL.whitedevil.dmg) F.push('a bare Frame has the wrong damage');

  p.loadout.gear.whitedevil = 'railcannon';
  const armed = A.mkUnit('whitedevil', 2, 3);
  if (armed.tg !== GEAR.railcannon.tg) F.push('the Rail Cannon did not replace the targeting');
  if (armed.dmg !== GEAR.railcannon.dmg) {
    F.push(`damage is ${armed.dmg}, expected the weapon's ${GEAR.railcannon.dmg} and not a sum`);
  }
  if (armed.dmg === POOL.whitedevil.dmg + GEAR.railcannon.dmg) {
    F.push('the weapon was added to the printed one instead of replacing it');
  }
  if (frameWeapon('whitedevil') !== GEAR.railcannon) F.push('frameWeapon did not report the fitted weapon');

  // The frame's own riposte survives whatever it is holding, because that is a
  // property of the machine being struck rather than of the weapon.
  const keep = A.mkUnit('whitedevil', 2, 3);
  if (keep.riposte !== (POOL.whitedevil.riposte || 0)) F.push('the frame lost its own riposte to a weapon');
  delete p.loadout.gear.whitedevil;
}

// --- the Laser Gatling's hole in the middle is real ---
{
  start();
  p.loadout.gear.heavyarms = 'lasergat';
  const u = A.mkUnit('heavyarms', 2, 2);
  A.G.units.push(u);
  const front = u.col + u.size - 1;
  const centre = spawnFoe('crawler', 2, front + 1);
  const centreDeep = spawnFoe('crawler', 2, front + 2);
  const up = spawnFoe('crawler', 1, front + 1);
  const down = spawnFoe('crawler', 3, front + 1);
  const upDeep = spawnFoe('crawler', 1, front + 2);
  const hit = A.geomFor(u).map(e => e.uid);
  if (hit.includes(centre.uid) || hit.includes(centreDeep.uid)) F.push('the Laser Gatling filled in its own gap');
  if (!hit.includes(up.uid) || !hit.includes(down.uid)) F.push('the Laser Gatling missed a diagonal');
  if (!hit.includes(upDeep.uid)) F.push('the Laser Gatling stops one cell short of its second rank');
  const lit = A.geomCells(u);
  if (lit.includes(2 * A.COLS + front + 1) || lit.includes(2 * A.COLS + front + 2)) F.push('the board lit the gap the weapon cannot reach');
  console.log('laser gatling covers', lit.length, 'cells, centre excluded');
  delete p.loadout.gear.heavyarms;
}

// --- with two Pilots down, exactly one is spent, never both ---
{
  start();
  spawnUnit('pilot', 2, 3);
  spawnUnit('pilot', 2, 4);
  A.deploy('whitedevil', 2, 3);
  const left = A.G.units.filter(isPilot).length;
  if (left !== 1) F.push(`deploying over one Pilot consumed ${2 - left} of them`);
}

// --- a Frame never lands on a hostile, a civilian, or another unit ---
{
  start();
  spawnUnit('pilot', 2, 3);
  spawnUnit('wall', 2, 2);
  spawnFoe('crawler', 3, 3);
  const tiles = cellsOf(validTiles('whitedevil'));
  if (tiles.has(2 * A.COLS + 2)) F.push('a Frame landed on one of your own units');
  if (tiles.has(3 * A.COLS + 3)) F.push('a Frame landed on a hostile');
  if (!tiles.has(2 * A.COLS + 3)) F.push('the Pilot\'s own cell stopped being a landing spot');
}

// --- swapping a Frame keeps its footprint honest ---
//
// Cipher trades places with any friendly anywhere, which is the one existing
// card that can move a Frame without deploying it. The trade is legal only
// while BOTH bodies fit where the other stood — a two-cell machine cannot be
// posted into a one-cell hole, and a Frame that could would end up overlapping
// whatever was beside the Cipher.
{
  start();
  spawnUnit('pilot', 2, 3);
  fieldFrame('heavyarms');
  A.deploy('heavyarms', 2, 3);
  const fr = A.G.units.find(u => u.id === 'heavyarms');
  const cipher = spawnUnit('cipher', 4, 0);
  cipher.acted = false;
  const at = (l, c) => l * A.COLS + c;

  if (!A.swapTargets(cipher).includes(at(fr.lane, fr.col))) {
    F.push('a legal Frame swap was refused');
  }
  // The swap moves the machine, pilot and all.
  A.doSwap(cipher, fr.lane, fr.col);
  if (fr.lane !== 4 || fr.col !== 0) F.push('the Frame did not take the Cipher\'s place');
  if (fr.pilotId !== 'pilot') F.push('the Frame forgot its pilot in the swap');
}

// --- the slot: beside the deck, never in it ---
{
  start();
  if (p.loadout.deck.some(c => isProto(c))) F.push('a Proto Frame sat inside the twelve');
  if (frameReady() !== 'whitedevil') F.push('the fielded Frame is not the one the slot holds');
  // The deck the mission shuffles must not contain it either.
  if (A.G.deck.includes('whitedevil') || A.G.hand.includes('whitedevil')) {
    F.push('the Frame was shuffled in with the deck');
  }
  console.log('mission deck:', A.G.deck.length + A.G.hand.length, 'cards, frame held separately');
}

// --- an empty slot means no Frame at all ---
{
  start(null);
  if (frameReady()) F.push('a mission with an empty slot still offered a Frame');
}

// --- one deployment per mission, and the slot closes behind it ---
{
  start();
  spawnUnit('pilot', 2, 3);
  A.deploy('whitedevil', 2, 3);
  if (frameReady()) F.push('the Frame was still on offer after being played');
  // A second Pilot does not reopen it.
  spawnUnit('pilot', 4, 3);
  if (validTiles('whitedevil').length && frameReady()) F.push('a second Pilot re-armed a spent Frame');
  if (A.G.units.filter(u => u.id === 'whitedevil').length !== 1) F.push('more than one Frame reached the board');
}

// --- migration moves a stray Frame out of the twelve rather than binning it ---
{
  const old = A.migrate({
    version: 6, callsign: 'OLD',
    unlocks: {cards: ['rifle', 'pilot', 'whitedevil'], gear: [], enemies: [], leads: []},
    loadout: {deck: ['rifle', 'pilot', 'whitedevil'], gear: {}},
    progress: {rank: 1, xp: 0, credits: 0},
  });
  if (old.loadout.deck.includes('whitedevil')) F.push('a Frame survived inside the twelve');
  if (old.loadout.frame !== 'whitedevil') F.push('a stray Frame was binned instead of moved to its slot');
  // A record that never owned one keeps an empty slot rather than a broken id.
  const clean = A.migrate({
    version: 6, callsign: 'CLEAN',
    unlocks: {cards: ['rifle'], gear: [], enemies: [], leads: []},
    loadout: {deck: ['rifle'], gear: {}, frame: 'nonsense'},
    progress: {rank: 1, xp: 0, credits: 0},
  });
  if (clean.loadout.frame !== null) F.push('an unknown Frame id survived migration');
}

// --- White Devil is the all-rounder, and its kit has to prove it ---
//
// Five weapons in one slot, and you only ever carry one. That makes a strictly
// dominant pair worse than it would be in the general gear pool, where two
// pieces can sit on two different cards at once: here the loser is simply dead
// for the rest of the profile. So every weapon must cover a shape no other one
// covers — the check is on the SHAPES, not the count.
{
  start();
  const kit = Object.keys(GEAR).filter(g => GEAR[g].frame === 'whitedevil');
  if (kit.length < 5) F.push(`White Devil carries ${kit.length} weapons, expected at least 5`);
  const shapes = kit.map(g => GEAR[g].tg);
  if (new Set(shapes).size !== shapes.length) {
    F.push('two White Devil weapons cover the same shape: ' + shapes.join(', '));
  }
  // No two Frames share a weapon, either.
  FRAMES.forEach(c => {
    const own = Object.keys(GEAR).filter(g => GEAR[g].frame === c);
    const dupe = own.map(g => GEAR[g].tg);
    if (new Set(dupe).size !== dupe.length) F.push(`${c} carries two weapons of the same shape`);
  });
  const rail = GEAR.railcannon;
  if (!rail || !rail.pen) F.push('the Hyper Rail Cannon is not anti-armour');
  if (!rail.single) F.push('the Hyper Rail Cannon is not single-target');
  if (rail.tg === (GEAR.beamrifle || {}).tg) {
    F.push('the Rail Cannon is the Beam Rifle with a bigger number — one of them is dead');
  }
  if (!GEAR.napalm || !GEAR.napalm.scorch) F.push('Hyper Napalm leaves no burning ground');
  if (!GEAR.beamsaber || !GEAR.beamsaber.riposte) F.push('the Beam Saber does not strike back');
  console.log('white devil kit:', kit.length, 'weapons,', shapes.join('/'));

  // pen and scorch have to survive the trip onto the unit.
  p.loadout.gear.whitedevil = 'railcannon';
  if (!A.mkUnit('whitedevil', 2, 3).pen) F.push('the rail cannon lost its armour-piercing on deploy');
  p.loadout.gear.whitedevil = 'napalm';
  if (!A.mkUnit('whitedevil', 2, 3).scorch) F.push('the napalm lost its burning ground on deploy');
  delete p.loadout.gear.whitedevil;
}

// --- the napalm cone widens, and the board lights exactly what it burns ---
{
  start();
  p.loadout.gear.whitedevil = 'napalm';
  const u = A.mkUnit('whitedevil', 2, 2);
  A.G.units.push(u);
  const front = u.col + u.size - 1;
  const mouth = spawnFoe('crawler', 2, front + 1);
  const wideUp = spawnFoe('crawler', 1, front + 2);
  const wideDown = spawnFoe('crawler', 3, front + 2);
  const shoulder = spawnFoe('crawler', 1, front + 1);   // not at the mouth
  const hit = A.geomFor(u).map(e => e.uid);
  [['mouth', mouth], ['wide left', wideUp], ['wide right', wideDown]].forEach(([where, e]) => {
    if (!hit.includes(e.uid)) F.push(`the cone missed its ${where}`);
  });
  if (hit.includes(shoulder.uid)) F.push('the cone is not a cone — it hit beside its own mouth');
  const lit = A.geomCells(u);
  if (lit.length !== 4) F.push(`the cone lights ${lit.length} cells, expected 4`);
  console.log('napalm cone:', lit.length, 'cells, widening');
  delete p.loadout.gear.whitedevil;
}

F.report('proto frames: one slot, one deployment, a Pilot spent and a Pilot returned');
