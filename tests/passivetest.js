// Each of the five new lead passives fires under its condition and stays
// silent otherwise.
import * as A from './support/api.js';
import {failures} from './support/harness.js';
import {spawnUnit, spawnFoe, clearBoard, unlockAll, stillAir} from './support/fixtures.js';

const F = failures();

const start = lead => {
  const p = unlockAll(A.blankProfile('PV'), ['rifle', 'marks', 'wall', 'assassin']);
  A.enterProfile(p);
  p.lead = lead;
  A.launchSpec({node: null, type: 'stronghold', mod: 'none', reward: 0, salv: 0});
  stillAir();
  clearBoard();
};
const calm = () => { A.G.enemies.length = 0; A.G.predict = []; A.G.held = []; };

// Lone Edge: +2 when no friendly stands orthogonally adjacent
{
  start('loneedge');
  const alone = spawnUnit('rifle', 0, 1);
  if (A.dmgPreview(alone) !== A.POOL.rifle.dmg + 2) F.push('Lone Edge missing on an isolated unit');
  const pair = spawnUnit('marks', 0, 2);
  if (A.dmgPreview(alone) !== A.POOL.rifle.dmg) F.push('Lone Edge paid despite an adjacent friendly');
  if (A.dmgPreview(pair) !== A.POOL.marks.dmg) F.push('Lone Edge paid to the neighbour too');
  start('ironbrand');
  const other = spawnUnit('rifle', 0, 1);
  if (A.dmgPreview(other) !== A.POOL.rifle.dmg) F.push('Lone Edge paid under the wrong lead');
}

// Field Fabrication: tech +2 hull on deploy, tech repairs 1 per turn
{
  start('skunkworks');
  const t = A.mkUnit('turret', 1, 1);
  if (t.max !== A.POOL.turret.hp + 2) F.push('Fabrication hull bonus missing: ' + t.max);
  const r = A.mkUnit('rifle', 2, 1);
  if (r.max !== A.POOL.rifle.hp) F.push('Fabrication hull bonus hit a non-tech unit');
  t.hp = 3; r.hp = 1;
  A.G.units.push(t, r);
  A.playerPhase();
  if (t.hp !== 4) F.push('Fabrication repair missing, hp ' + t.hp);
  if (r.hp !== 1) F.push('Fabrication repaired a non-tech unit');
}

// Quietstep: drop/crush cards cost 1 less, floor 1
{
  start('quietstep');
  if (A.costOf('assassin') !== A.POOL.assassin.dp - 1) F.push('Quietstep discount missing on a drop card');
  if (A.costOf('rifle') !== A.POOL.rifle.dp) F.push('Quietstep discounted a grounded card');
  if (A.costOf('mine') !== 1) F.push('Quietstep should floor Minefield at 1, got ' + A.costOf('mine'));
  A.active.lead = 'ironbrand';
  if (A.costOf('assassin') !== A.POOL.assassin.dp) F.push('Quietstep discount stuck to the wrong lead');
}

// Firebrand: +2 DP on the turn after losing a unit — and only then
{
  start('firebrand');
  spawnUnit('rifle', 2, 1, {hp: 1});
  spawnFoe('crawler', 2, 2, 30);       // adjacent: it will strike and kill
  A.G.predict = []; A.G.held = [];
  A.endTurn();
  if (A.G.units.length) F.push('setup: the sacrifice survived');
  if (A.G.dp !== A.MAXDP + 2) F.push('Firebrand did not pay after a loss, dp ' + A.G.dp);
  calm();
  A.endTurn();
  if (A.G.dp !== A.MAXDP) F.push('Firebrand paid on a quiet turn');
}

// Riptide: a unit that repositioned takes 1 less, floored at 1
{
  start('riptide');
  const u = spawnUnit('rifle', 2, 1);
  A.doMove(u, 2, 2);
  A.G.predict = []; A.G.held = []; A.G.enemies.length = 0;
  A.playerPhase();                     // stashes repositioned, resets moved
  if (!u.repositioned) F.push('repositioning was not recorded for the enemy phase');
  const before = u.hp;
  A.dmgUnit(u, 3, 'test');
  if (before - u.hp !== 2) F.push('Riptide should shave 1 (took ' + (before - u.hp) + ')');
  A.dmgUnit(u, 1, 'test');
  if (u.hp !== before - 3) F.push('Riptide dipped below the damage floor');
  // a unit that held still enjoys nothing
  const still = spawnUnit('marks', 4, 1);
  still.repositioned = false;
  const b2 = still.hp;
  A.dmgUnit(still, 3, 'test');
  if (b2 - still.hp !== 3) F.push('Riptide paid a unit that held still');
}

F.report('lead passives: all checks pass');
