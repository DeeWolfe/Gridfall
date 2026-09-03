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
  if (A.STARTER.includes('rampart') || !A.STARTER.includes('archer')) F.push('the starter set did not hand the Rampart\'s slot to the Archer');
  if (A.POOL.fob.zoneMin) F.push('Forward Base still carries a zone minimum');
  if (A.POOL.medic.ab || A.POOL.medic.healPlay) F.push('Medic still carries a burst or an ability');
  if (!A.TGNAME.window) F.push('the window pattern has no targeting name');
}

// --- lane damping is honoured at the field's printed value (the rule outlives the Scrambler) ---
{
  start();
  const s = spawnUnit('rifle', 2, 1);
  s.dampen = 1;
  if (A.dampenIn(2) !== 1) F.push(`dampenIn read ${A.dampenIn(2)}, field says 1`);
  s.dampen = 2;
  if (A.dampenIn(2) !== 2) F.push('a dampen-2 field was flattened to 1');
  spawnUnit('rifle', 2, 0).dampen = 1;
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


// ============================ v2.31: the roster review ============================
const CUT2 = ['pikewall', 'sentry', 'backstop', 'ram', 'beacon', 'supply', 'longshot', 'herald', 'relay', 'reactor', 'dynamo', 'requisition', 'zaku', 'scrambler', 'degausser', 'lens'];
{
  CUT2.forEach(id => { if (A.POOL[id]) F.push(`v2.31 cut '${id}' still in the pool`); });
  ['fireteam', 'noble', 'shadow', 'osiris', 'majestic', 'singer', 'pyre', 'volt', 'crystal'].forEach(id => { if (!A.POOL[id]) F.push(`missing new card '${id}'`); });
  ['cross4', 'sweep5', 'rearvert3', 'radius2'].forEach(t => { if (!A.TGNAME[t]) F.push(`pattern '${t}' has no name`); });
  if (Object.keys(A.POOL).some(id => A.POOL[id].dynamo && id !== 'fob')) F.push('a deploy-point generator other than Forward Base survives');
  if (A.POOL.aegis.riposte) F.push('Aegis Knights kept their riposte');
  if (!A.POOL.hecate.pen) F.push('Hecate is not anti-armour');
  if (A.POOL.rampart.t !== 'special' || A.POOL.rampart.chassis !== 'exo' || !A.POOL.rampart.twin) F.push('Rampart is not a twin-firing Exo Frame Specialist');
}

// --- the four new shapes ---
{
  start();
  const cells = (id, l, c) => new Set(A.geomCells(spawnUnit(id, l, c)));
  const m = cells('mortar', 2, 0);                          // cross centred at col 4
  const want = [[2, 3], [2, 4], [2, 5], [1, 4], [3, 4]];
  if (m.size !== 5 || !want.every(([l, c]) => m.has(l * A.COLS + c))) F.push('Mortar cross is not five cells centred four out');
  clearBoard();
  const s = cells('samurai', 2, 2);
  const w2 = [[1, 2], [3, 2], [1, 3], [2, 3], [3, 3]];
  if (s.size !== 5 || !w2.every(([l, c]) => s.has(l * A.COLS + c))) F.push('Samurai sweep is not the two beside and three ahead');
  clearBoard();
  const n = cells('naginata', 2, 2);
  if (n.size !== 8) F.push(`Naginata reaches ${n.size} cells, wanted the full circle of 8`);
  clearBoard();
  const r = cells('rearguard', 2, 3);
  const w3 = [[1, 2], [2, 2], [3, 2]];
  if (r.size !== 3 || !w3.every(([l, c]) => r.has(l * A.COLS + c))) F.push('Rearguard does not cover the column behind across three lanes');
  clearBoard();
  const f = spawnUnit('falconer', 2, 3);
  if (A.geomCells(f).length !== 24) F.push(`Falconer reaches ${A.geomCells(f).length} cells, wanted 24`);
  const near = spawnFoe('crawler', 0, 5, 10); const far = spawnFoe('crawler', 2, 6, 10);
  if (!A.candidatesFor(f).includes(near) || A.candidatesFor(f).includes(far)) F.push('Falconer radius is wrong');
}

// --- squads file down the column ---
{
  start(['ashigaru', 'bulwark', 'rifle', 'marks', 'wall', 'medic']);
  A.G.hand = ['ashigaru', 'bulwark'];
  A.G.dp = 9;
  A.deploy('ashigaru', 2, 1);
  const bodies = A.G.units.filter(u => u.id === 'ashigaru');
  if (bodies.length !== 3) F.push(`Ashigaru placed ${bodies.length} bodies, wanted 3`);
  if (bodies.some(u => u.col !== 1)) F.push('an Ashigaru left its column');
  if (new Set(bodies.map(u => u.lane)).size !== 3) F.push('Ashigaru stacked lanes');
  A.deploy('bulwark', 0, 0);
  const wall = A.G.units.filter(u => u.id === 'bulwark');
  if (wall.length !== 2 || wall.some(u => u.col !== 0)) F.push('Bulwark did not stand as two sections down the column');
  if (wall.some(u => !u.parapet || !u.blocker || u.dmg)) F.push('a Bulwark section is armed or not a parapet');
  clearBoard();
  A.G.hand = ['ashigaru']; A.G.dp = 9;
  A.deploy('ashigaru', 0, 2);                                // top lane: only two more fit below
  if (A.G.units.filter(u => u.id === 'ashigaru').length !== 3) F.push('a column with room below should still seat three');
}

// --- the Fireteam and its kits ---
{
  start(['fireteam', 'noble', 'osiris', 'rifle', 'marks', 'wall']);
  A.G.hand = ['noble', 'fireteam', 'osiris'];
  A.G.dp = 9;
  if (!A.frameGateText('noble')) F.push('Noble should be dead in hand with no Fireteam standing');
  A.deploy('fireteam', 2, 1);
  const ft = A.kitHost('fireteam');
  if (!ft) F.push('Fireteam did not deploy');
  if (A.frameGateText('noble')) F.push('Noble still gated with the Fireteam on the board');
  const tiles = A.validTiles('noble');
  if (tiles.length !== 1 || tiles[0] !== 2 * A.COLS + 1) F.push('Noble should target only the Fireteam cell');
  A.deploy('noble', 2, 1);
  if (ft.tg !== 'adj' || ft.dmg !== 5 || !ft.blocker || ft.riposte !== 2) F.push(`Noble did not re-spec the Fireteam (${ft.tg}/${ft.dmg}/${ft.blocker}/${ft.riposte})`);
  A.deploy('osiris', 2, 1);
  if (ft.tg !== 'furthest' || !ft.indirect || ft.blocker) F.push('Osiris did not replace Noble cleanly');
  const wall = spawnUnit('wall', 2, 3);
  const deep = spawnFoe('crawler', 2, 6, 10);
  if (!A.geomFor(ft).includes(deep)) F.push('Osiris should arc over the Barricade to the deepest hostile');
  if (A.frameReady()) F.push('a Fireteam is not a Frame and must not be seeded');
}

// --- Singer: hostiles within two cells strike softer, and the board says so ---
{
  start();
  spawnUnit('singer', 2, 2);
  const target = spawnUnit('wall', 0, 3);
  if (A.hymnAt(0, 4) !== 1) F.push('hymn should reach a hostile two cells away');
  if (A.hymnAt(0, 5) !== 0) F.push('hymn reached three cells');
  const hulk = spawnFoe('hulk', 0, 4, 20);
  const seen = A.forecastThreat().hits[target.uid];
  const hp0 = target.hp;
  A.strike(hulk, A.BEST.hulk, 0);
  if (hp0 - target.hp !== A.BEST.hulk.dmg - 1) F.push(`sung hulk dealt ${hp0 - target.hp}, wanted ${A.BEST.hulk.dmg - 1}`);
  if (seen !== hp0 - target.hp) F.push('the forecast disagreed with the sung strike');
  if (A.influenceCells(A.unitAt(2, 2)).length !== 24) F.push('Singer influence is not the 5x5 around her');
}

// --- Pyre Emitter burns the lane before the horde moves ---
{
  start();
  spawnUnit('pyre', 1, 0);
  const inLane = spawnFoe('crawler', 1, 6, 10);
  const other = spawnFoe('crawler', 2, 6, 10);
  A.enemyPhase();
  if (inLane.hp !== 10 - 1 && inLane.hp > 0) F.push(`pyre burned ${10 - inLane.hp}, wanted 1`);
  if (other.hp !== 10) F.push('pyre burned outside its lane');
}

// --- Forward Base: a point a turn, cooldowns only ---
{
  start();
  const fob = spawnUnit('fob', 2, 0);
  const hurt = spawnUnit('rifle', 2, 1); hurt.hp = 1; hurt.cd = 3;
  const dp0 = A.MAXDP;
  A.endTurn();
  if (A.G.dp !== dp0 + 1) F.push(`Forward Base paid ${A.G.dp - dp0}, wanted 1`);
  if (hurt.hp !== 1) F.push('Forward Base still repairs');
  if (hurt.cd !== 1) F.push(`Forward Base cooldown hurry left cd at ${hurt.cd}, wanted 1 (one normal tick plus one hurry)`);
  if (A.POOL.fob.sustain.repair) F.push('Forward Base data still carries repair');
}

// --- Fatal Fury: four blows on the hostile at contact ---
{
  start();
  const a = spawnUnit('ashura', 2, 1);
  const t = spawnFoe('crawler', 2, 2, 30);            // no armour floor — a plated hostile bleeds each blow
  A.useAbility(a);
  if (30 - t.hp !== 8) F.push(`Fatal Fury dealt ${30 - t.hp}, wanted 4 x 2 = 8`);
  if (a.cd !== 2) F.push('Fatal Fury cooldown wrong');
}

// --- migration v14 → v15: refunds and the elemental id swap ---
{
  const p = A.blankProfile('V14');
  p.version = 14;
  p.unlocks.cards = ['scout', 'zaku', 'relay', 'scrambler', 'lens', 'cryo'];
  p.loadout.deck = ['scout', 'zaku', 'scrambler', 'lens'];
  p.loadout.gear = {scrambler: Object.keys(A.GEAR)[0]};
  p.usage = {lens: 4};
  p.progress.credits = 0;
  const m = A.migrate(p);
  if (m.progress.credits !== 100 + 115) F.push(`v15 refunded ${m.progress.credits}, wanted 215`);
  if (!m.unlocks.cards.includes('pyre') || !m.unlocks.cards.includes('crystal') || m.unlocks.cards.includes('scrambler')) F.push('elemental id swap missed the unlocks');
  if (!m.loadout.deck.includes('pyre') || m.loadout.deck.includes('zaku')) F.push('deck did not swap and strip');
  if (m.usage.crystal !== 4) F.push('usage did not follow the id swap');
}

F.report('balancetest');
