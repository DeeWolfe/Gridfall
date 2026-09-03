// The v2.30 balance pass: ten cards cut with refunds, every unit on the hull
// and damage ladders, the Scrambler's damping honoured, two-charge Shields,
// and the four cards that filled the gaps — Banner Bearer, Firing Step,
// Ember Lance, Recoilless Team.
import * as A from './support/api.js';
import {failures} from './support/harness.js';
import {spawnUnit, spawnFoe, clearBoard, unlockAll} from './support/fixtures.js';

const F = failures();
const HULL = [2, 3, 5, 8, 12, 18, 24];
const DMG = [1, 2, 3, 5, 8];
const CUT = ['knight', 'vanguard', 'turret', 'biomed', 'pulse', 'suppressor', 'battery', 'bore', 'cache', 'sapper'];

const start = deck => {
  A.enterProfile(unlockAll(A.blankProfile('BAL'), deck || ['rifle', 'marks', 'wall', 'medic', 'rampart', 'lancer']));
  A.launchSpec({node: null, type: 'stronghold', mod: 'none', reward: 0});
  clearBoard();
  A.G.scorch = {};
};

// --- the roster: cuts gone, ladders held, starter intact ---
{
  CUT.forEach(id => { if (A.POOL[id]) F.push(`cut card '${id}' still in the pool`); });
  Object.entries(A.POOL).forEach(([id, k]) => {
    if (k.frameGear || k.strat || k.instant || k.attach) return;   // 0-hull cards ride outside the ladders
    if (!HULL.includes(k.hp)) F.push(`${id} hull ${k.hp} is off the ladder`);
    if (k.dmg && !DMG.includes(k.dmg)) F.push(`${id} damage ${k.dmg} is off the ladder`);
    if (k.burst && !DMG.includes(k.burst)) F.push(`${id} burst ${k.burst} is off the ladder`);
  });
  A.STARTER.forEach(id => { if (!A.POOL[id]) F.push(`starter card '${id}' does not exist`); });
  if (!A.STARTER.includes('rampart')) F.push('Rampart did not take the Turret\'s starter slot');
  if (A.POOL.bulwark.riposte !== 2) F.push('Bulwark did not absorb the Knight\'s riposte');
  if (A.POOL.fob.zoneMin) F.push('Forward Base still carries a zone minimum');
  if (A.POOL.medic.ab || A.POOL.medic.healPlay) F.push('Medic still carries a burst or an ability');
  if (!A.TGNAME.window) F.push('the window pattern has no targeting name');
}

// --- the Scrambler's damping is honoured at its printed value ---
{
  start();
  const s = spawnUnit('scrambler', 2, 1);
  if (A.dampenIn(2) !== A.POOL.scrambler.dampen) F.push(`dampenIn read ${A.dampenIn(2)}, card says ${A.POOL.scrambler.dampen}`);
  s.dampen = 2;
  if (A.dampenIn(2) !== 2) F.push('a dampen-2 field was flattened to 1');
  spawnUnit('scrambler', 2, 0);
  if (A.dampenIn(2) !== 2) F.push('two fields stacked instead of taking the strongest');
  if (A.dampenIn(1) !== 0) F.push('damping leaked into another lane');
}

// --- Shield: two charges, each eats a whole blow ---
{
  start(['shield', 'rifle', 'marks', 'wall', 'medic', 'rampart']);
  const r = spawnUnit('rifle', 2, 1);
  A.G.hand = ['shield'];
  A.G.dp = 5;
  A.deploy('shield', 2, 1);
  if (r.shield !== 2) F.push(`Shield fitted ${r.shield} charges, wanted 2`);
  A.dmgUnit(r, 4, 'test');
  A.dmgUnit(r, 4, 'test');
  if (r.hp !== r.max) F.push('two charges did not eat two blows');
  A.dmgUnit(r, 4, 'test');
  if (r.hp !== r.max - 4) F.push('the third blow should have landed');
}

// --- Forward Base deploys on any held ground now ---
{
  start(['fob', 'rifle', 'marks', 'wall', 'medic', 'rampart']);
  A.G.hand = ['fob'];
  A.G.dp = 5;
  const tiles = A.validTiles('fob');
  if (!tiles.some(i => i % A.COLS === 0)) F.push('Forward Base cannot land in column 0');
}

// --- Banner Bearer: +1 per adjacent friendly, past the buff cap ---
{
  start();
  const b = spawnUnit('banner', 2, 2);
  if (A.dmgPreview(b) !== 1) F.push(`a lone Banner Bearer previews ${A.dmgPreview(b)}, wanted 1`);
  spawnUnit('rifle', 1, 2); spawnUnit('rifle', 3, 2); spawnUnit('rifle', 2, 1);
  if (A.packBonus(b) !== 3) F.push(`three neighbours paid ${A.packBonus(b)}, wanted 3`);
  spawnUnit('scout', 2, 3);                          // four neighbours, one of them an aura
  if (A.dmgPreview(b) !== 1 + 4 + 1) F.push(`four neighbours plus an aura previewed ${A.dmgPreview(b)}, wanted 6 — the rally must sit outside the cap`);
  clearBoard();
  const b2 = spawnUnit('banner', 2, 2);
  spawnUnit('rifle', 1, 2); spawnUnit('rifle', 3, 2); spawnUnit('rifle', 2, 1);
  const foe = spawnFoe('crawler', 2, 3, 20);
  A.fire(b2, false);
  if (20 - foe.hp !== 1 + 3) F.push(`the Banner Bearer struck ${20 - foe.hp} with three neighbours, wanted 4`);
}

// --- Firing Step: a wall the guns shoot over; the Barricade still cuts ---
{
  start();
  const r = spawnUnit('rifle', 2, 1);
  spawnUnit('firingstep', 2, 2);
  const foe = spawnFoe('crawler', 2, 4, 10);
  if (!A.geomFor(r).includes(foe)) F.push('a Rifleman behind a Firing Step cannot see the lane');
  if (!A.geomCells(r).includes(2 * A.COLS + 4)) F.push('the board did not light the lane past a Firing Step');
  clearBoard();
  const r2 = spawnUnit('rifle', 2, 1);
  spawnUnit('wall', 2, 2);
  spawnFoe('crawler', 2, 4, 10);
  if (A.geomFor(r2).length) F.push('a Barricade stopped cutting friendly fire');
  const step = A.mkUnit('firingstep', 0, 0);
  if (!step.blocker || !step.parapet) F.push('Firing Step is not both a blocker and a parapet');
}

// --- Ember Lance: the cone, and the burn that lasts exactly one turn ---
{
  start();
  const e = spawnUnit('ember', 2, 1);
  const cells = new Set(A.geomCells(e));
  [[2, 2], [1, 3], [2, 3], [3, 3]].forEach(([l, c]) => { if (!cells.has(l * A.COLS + c)) F.push(`Ember cone missed ${l},${c}`); });
  if (cells.size !== 4) F.push(`Ember cone lit ${cells.size} cells, wanted 4`);
  const foe = spawnFoe('hulk', 2, 3, 30);
  A.fire(e, false);
  if (!A.scorched(2, 3)) F.push('the ground under the target did not catch');
  if (A.scorched(2, 2)) F.push('an empty cone cell caught fire');
  A.territoryPhase();
  if (A.scorched(2, 3)) F.push('the ember burn outlived its turn');
  if (foe.hp <= 0) F.push('test hulk should have survived one lance');
}

// --- Recoilless Team: dead zone at contact, reach at two and three, backblast behind ---
{
  start();
  const t = spawnUnit('recoilless', 2, 2);
  const near = spawnFoe('crawler', 2, 3, 10);
  const mid = spawnFoe('crawler', 2, 4, 10);
  const far = spawnFoe('crawler', 2, 5, 10);
  const g = A.geomFor(t);
  if (g.includes(near)) F.push('Recoilless hit the adjacent cell');
  if (!g.includes(mid) || !g.includes(far)) F.push('Recoilless missed its window');
  if (A.candidatesFor(t).length !== 2) F.push('Recoilless should offer two targets to lock');
  const rear = spawnUnit('rifle', 2, 1);
  const hp0 = rear.hp;
  A.fire(t, false);
  if (mid.hp !== 10 - A.POOL.recoilless.dmg) F.push(`Recoilless dealt ${10 - mid.hp}, wanted ${A.POOL.recoilless.dmg}`);
  if (rear.hp !== hp0 - 1) F.push(`backblast took ${hp0 - rear.hp} off the unit behind, wanted 1`);
  clearBoard();
  const t2 = spawnUnit('recoilless', 2, 2);
  const lone = spawnUnit('rifle', 2, 1);
  const hp1 = lone.hp;
  A.fire(t2, false);                                 // nothing to shoot at
  if (lone.hp !== hp1) F.push('backblast fired with no shot taken');
}

// --- migration: v13 saves refund the cuts and swap the starter Turret ---
{
  const p = A.blankProfile('OLD');
  p.version = 13;
  p.unlocks.cards = ['scout', 'rifle', 'turret', 'knight', 'cache', 'sapper'];
  p.loadout.deck = ['scout', 'rifle', 'turret', 'knight'];
  p.progress.credits = 0;
  const m = A.migrate(p);
  if (m.version !== A.SAVE_VERSION) F.push(`migrated to v${m.version}, wanted v${A.SAVE_VERSION}`);
  if (m.progress.credits !== 145 + 115 + 280) F.push(`refunded ${m.progress.credits}, wanted ${145 + 115 + 280}`);
  if (!m.unlocks.cards.includes('rampart')) F.push('the Turret commander did not receive a Rampart');
  if (m.unlocks.cards.some(c => CUT.includes(c))) F.push('a cut card survived migration in unlocks');
  if (!m.loadout.deck.includes('rampart') || m.loadout.deck.includes('turret')) F.push('the deck did not swap Turret for Rampart');
  if (m.loadout.deck.includes('knight')) F.push('a cut card survived migration in the deck');

  const q = A.blankProfile('BOTH');
  q.version = 13;
  q.unlocks.cards = ['scout', 'turret', 'rampart'];
  q.progress.credits = 0;
  const mq = A.migrate(q);
  if (mq.progress.credits !== 100) F.push(`a commander owning both should be paid 100, got ${mq.progress.credits}`);
  if (mq.unlocks.cards.filter(c => c === 'rampart').length !== 1) F.push('Rampart duplicated in unlocks');
}

F.report('balancetest');
