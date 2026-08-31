// Frames: the Pilot, the machine, and the weapon chosen before the mission.
//
// A Frame is the only card in the game that costs a DECISION rather than a
// turn. Deploy points renew, so an expensive card is just a slow card; a Frame
// costs two cards, two deployments and a setup step you can be punished for.
// Everything guarded here exists to keep that true:
//
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
import {gearFits, frameWeapon} from '../src/save/progression.js';
import {validTiles, isPilot} from '../src/rules/board.js';

const F = failures();
const FRAMES = Object.keys(POOL).filter(c => POOL[c].frame);
const PILOTS = Object.keys(POOL).filter(c => POOL[c].pilot);

let p;
const start = () => {
  p = unlockAll(A.blankProfile('FRAME'), ['pilot', ...FRAMES, 'rifle', 'wall', 'medic', 'marks']);
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
const hand = cid => { if (!A.G.hand.includes(cid)) A.G.hand.push(cid); };

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
    if ((k.size || 1) < 2) F.push(`${c} occupies one cell — it is a big Rifleman`);
    // A bare Frame must be playable, never a dead draw.
    if (!k.tg || k.tg === 'none' || !k.dmg) F.push(`${c} has no base weapon`);
    const kit = Object.keys(GEAR).filter(g => GEAR[g].frame === c);
    if (kit.length !== 2) F.push(`${c} has ${kit.length} weapons, expected 2`);
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
  hand('whitedevil');
  const lost = A.G.lost;
  A.deploy('whitedevil', 2, 3);
  if (A.G.units.some(u => u.uid === pv.uid)) F.push('the Pilot survived alongside the Frame');
  if (A.G.lost !== lost) F.push('spending a Pilot was counted as losing a unit');
  const fr = A.G.units.find(u => u.id === 'whitedevil');
  if (!fr) F.push('the Frame never landed');
  else {
    if (fr.size !== 2) F.push('the Frame landed one cell wide');
    if (fr.pilotId !== 'pilot') F.push('the Frame does not remember which Pilot it took aboard');
  }
  if (A.G.hand.includes('whitedevil')) F.push('the Frame card was not spent');
}

// --- a destroyed Frame puts its Pilot back on the board ---
{
  start();
  spawnUnit('pilot', 2, 3);
  hand('sevenblades');
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
  hand('heavyarms');
  if (!validTiles('heavyarms').length) F.push('an ejected Pilot cannot take another Frame');
}

// --- nowhere to eject to: the Pilot goes up with it ---
{
  start();
  spawnUnit('pilot', 2, 3);
  hand('whitedevil');
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

  p.loadout.gear.whitedevil = 'beamrifle';
  const armed = A.mkUnit('whitedevil', 2, 3);
  if (armed.tg !== GEAR.beamrifle.tg) F.push('the Beam Rifle did not replace the targeting');
  if (armed.dmg !== GEAR.beamrifle.dmg) {
    F.push(`damage is ${armed.dmg}, expected the weapon's ${GEAR.beamrifle.dmg} and not a sum`);
  }
  if (armed.dmg === POOL.whitedevil.dmg + GEAR.beamrifle.dmg) {
    F.push('the weapon was added to the printed one instead of replacing it');
  }
  if (frameWeapon('whitedevil') !== GEAR.beamrifle) F.push('frameWeapon did not report the fitted weapon');

  // A saber's riposte rides on top of the frame's own, because that is a
  // property of the machine being struck rather than of what it is holding.
  p.loadout.gear.whitedevil = 'beamsaber';
  const saber = A.mkUnit('whitedevil', 2, 3);
  if (saber.riposte !== (POOL.whitedevil.riposte || 0) + GEAR.beamsaber.riposte) {
    F.push('the Beam Saber riposte did not carry through');
  }
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
  const up = spawnFoe('crawler', 1, front + 1);
  const down = spawnFoe('crawler', 3, front + 1);
  const hit = A.geomFor(u).map(e => e.uid);
  if (hit.includes(centre.uid)) F.push('the Laser Gatling filled in its own gap');
  if (!hit.includes(up.uid) || !hit.includes(down.uid)) F.push('the Laser Gatling missed a diagonal');
  const lit = A.geomCells(u);
  if (lit.includes(2 * A.COLS + front + 1)) F.push('the board lit the gap the weapon cannot reach');
  console.log('laser gatling covers', lit.length, 'cells, centre excluded');
  delete p.loadout.gear.heavyarms;
}

// --- two Pilots in one footprint is refused rather than eating both ---
{
  start();
  spawnUnit('pilot', 2, 3);
  spawnUnit('pilot', 2, 4);
  const tiles = cellsOf(validTiles('whitedevil'));
  if (tiles.has(2 * A.COLS + 3)) F.push('a Frame offered to land on two Pilots at once');
  // Landing across just one of them is still fine.
  if (!tiles.has(2 * A.COLS + 2)) F.push('two Pilots in a row blocked every legal cell');
}

// --- a Frame never lands on a hostile, a civilian, or another unit ---
{
  start();
  spawnUnit('pilot', 2, 3);
  spawnUnit('wall', 2, 4);
  spawnFoe('crawler', 1, 4);
  const tiles = cellsOf(validTiles('whitedevil'));
  if (tiles.has(2 * A.COLS + 3)) F.push('a Frame landed across one of your own units');
  if (tiles.has(1 * A.COLS + 3)) F.push('a Frame landed across a hostile');
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
  hand('heavyarms');
  A.deploy('heavyarms', 2, 3);
  const fr = A.G.units.find(u => u.id === 'heavyarms');
  const cipher = spawnUnit('cipher', 4, 0);
  cipher.acted = false;
  const at = (l, c) => l * A.COLS + c;

  // Room for both cells of the Frame where the Cipher stands: the trade is on.
  if (!A.swapTargets(cipher).includes(at(fr.lane, fr.col))) {
    F.push('a legal Frame swap was refused');
  }
  // Block the Frame's second cell and it must be refused.
  const plug = spawnUnit('wall', 4, 1);
  if (A.swapTargets(cipher).includes(at(fr.lane, fr.col))) {
    F.push('a Frame was offered a swap into a one-cell hole');
  }
  A.G.units = A.G.units.filter(u => u.uid !== plug.uid);

  // And the swap itself moves the whole machine, pilot and all.
  A.doSwap(cipher, fr.lane, fr.col);
  if (fr.lane !== 4 || fr.col !== 0) F.push('the Frame did not take the Cipher\'s place');
  if (fr.pilotId !== 'pilot') F.push('the Frame forgot its pilot in the swap');
  if (A.unitAt(4, 1) !== fr) F.push('the swapped Frame is not covering both of its cells');
}

F.report('frames: a Pilot, a machine, and a weapon chosen before the drop');
