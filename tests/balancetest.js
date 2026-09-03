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
    if (k.frameGear || k.fits || k.strat || k.instant || k.attach) return;   // 0-hull cards ride outside the ladders
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
  ['singer', 'pyre', 'volt', 'crystal'].forEach(id => { if (!A.POOL[id]) F.push(`missing new card '${id}'`); });
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


// ============================ v2.32: the Fireteam line, saved decks, fog of war ============================
const TEAMS = ['ftnoble', 'ftosiris', 'ftmajestic', 'ftshadow'];
const ARMOUR = ['camo', 'lock', 'jetpack', 'dropshield', 'hologram', 'ordnance'];
{
  ['fireteam', 'noble', 'shadow', 'osiris', 'majestic'].forEach(id => { if (A.POOL[id]) F.push(`old Fireteam card '${id}' survives`); });
  TEAMS.forEach(id => { if (!A.POOL[id] || A.POOL[id].line !== 'fireteam' || A.POOL[id].t !== 'special') F.push(`${id} is not a Fireteam Specialist`); });
  ARMOUR.forEach(id => { if (!A.POOL[id] || A.POOL[id].fits !== 'fireteam' || A.POOL[id].dp !== 1) F.push(`${id} is not a 1 DP Fireteam ability`); });
  if (!A.MODS.fog) F.push('no Fog of War modifier');
}

// --- one team at a time; abilities need a team; the new one strips the last ---
{
  start(['ftnoble', 'ftshadow', 'camo', 'jetpack', 'lock', 'rifle']);
  A.G.hand = ['ftnoble', 'ftshadow', 'camo', 'jetpack', 'lock'];
  A.G.dp = 20;
  if (!A.frameGateText('camo')) F.push('an ability should be dead in hand with no Fireteam standing');
  A.deploy('ftnoble', 2, 1);
  const team = A.hostFor(A.POOL.camo);
  if (!team || team.id !== 'ftnoble') F.push('Fireteam Noble did not stand as a kit host');
  if (!A.frameGateText('ftshadow')) F.push('a second Fireteam should wait while one stands');
  if (A.validTiles('ftshadow').length) F.push('a second Fireteam was offered tiles');
  if (A.frameGateText('camo')) F.push('Active Camo still gated with a team standing');
  A.deploy('camo', 2, 1);
  if (!team.camo || !team.cloaked) F.push('Active Camo did not cloak the team');
  A.deploy('jetpack', 2, 1);
  if (team.camo || team.cloaked) F.push('Jetpack did not strip Active Camo');
  if (!team.jet || !team.servo) F.push('Jetpack did not fit');
  if (team.gearS.length !== 1 || team.gearS[0] !== 'jetpack') F.push(`the team carries ${team.gearS.join(',')}, wanted jetpack alone`);
  A.G.ter[0][0] = 'p'; A.G.ter[4][3] = 'p';
  team.acted = false; team.moved = false; team.fresh = false;   // the deploy spent its turn
  const jumps = A.moveTargets(team);
  if (!jumps.includes(0 * A.COLS + 0) || !jumps.includes(4 * A.COLS + 3)) F.push('Jetpack should reach held tiles two cells out in any direction');
  A.G.ter[4][3] = 'n';
  if (A.moveTargets(team).includes(4 * A.COLS + 3)) F.push('Jetpack landed on ground not held');
  A.deploy('lock', 2, 1);
  if (team.jet || team.servo) F.push('Armor Lock did not strip the Jetpack');
  if (!team.ab || team.ab.key !== 'lock') F.push('Armor Lock did not grant its ability');
  if (A.frameReady()) F.push('a Fireteam is not a Frame and must not be seeded');
}

// --- Active Camo: hostiles find nothing to shoot until it fires ---
{
  start();
  const team = spawnUnit('ftnoble', 2, 3);
  team.camo = true; team.cloaked = true;
  const hulk = spawnFoe('hulk', 2, 4, 30);
  const hp0 = team.hp;
  A.strike(hulk, A.BEST.hulk, 0);
  if (team.hp !== hp0) F.push('a cloaked team was struck');
  if (A.forecastThreat().hits[team.uid]) F.push('the forecast threatened a cloaked team');
  team.fresh = false;
  A.fire(team, false);
  if (team.cloaked) F.push('firing did not drop the cloak');
  A.strike(hulk, A.BEST.hulk, 0);
  if (team.hp === hp0) F.push('an uncloaked team should be struck');
  A.territoryPhase();
  if (!team.cloaked) F.push('the cloak did not return at the turn end');
}

// --- Armor Lock, Drop Shield, Hologram ---
{
  start();
  const team = spawnUnit('ftmajestic', 2, 2);
  team.ab = A.POOL.lock.ab; team.cd = 0;
  A.useAbility(team);
  if (!team.locked || !team.acted) F.push('Armor Lock did not lock');
  const hp0 = team.hp;
  A.dmgUnit(team, 9, 'test');
  if (team.hp !== hp0) F.push('Armor Lock let damage through');
  if (team.cd !== 3) F.push(`Armor Lock cooldown ${team.cd}, wanted 3`);
  A.territoryPhase();
  if (team.locked) F.push('Armor Lock outlived the turn');

  clearBoard();
  const t2 = spawnUnit('ftnoble', 2, 2);
  const n1 = spawnUnit('rifle', 1, 2); const n2 = spawnUnit('rifle', 2, 3); const far = spawnUnit('rifle', 4, 2);
  t2.ab = A.POOL.dropshield.ab; t2.cd = 0;
  A.useAbility(t2);
  if (n1.shield !== 1 || n2.shield !== 1) F.push('Drop Shield missed a neighbour');
  if (far.shield) F.push('Drop Shield reached past the four adjacent cells');

  clearBoard();
  const t3 = spawnUnit('ftshadow', 2, 2);
  const wall = spawnUnit('wall', 2, 4);
  t3.ab = A.POOL.hologram.ab; t3.cd = 0;
  A.useAbility(t3);
  const hulk = spawnFoe('hulk', 2, 5, 30);
  const w0 = wall.hp;
  A.strike(hulk, A.BEST.hulk, 0);
  if (wall.hp !== w0) F.push('the lane struck through the hologram');
  if (A.forecastThreat().hits[wall.uid]) F.push('the forecast ignored the hologram');
}

// --- Ordnance Drop: the lane takes 8, the card is spent ---
{
  start(['ftnoble', 'ordnance', 'rifle', 'marks', 'wall', 'medic']);
  A.G.hand = ['ordnance'];
  A.G.dp = 5;
  const team = spawnUnit('ftnoble', 2, 1);
  const a = spawnFoe('crawler', 2, 4, 20); const b = spawnFoe('crawler', 2, 7, 20); const other = spawnFoe('crawler', 3, 4, 20);
  A.deploy('ordnance', 2, 1);
  if (a.hp !== 12 || b.hp !== 12) F.push('Ordnance Drop did not deal 8 down the lane');
  if (other.hp !== 20) F.push('Ordnance Drop hit another lane');
  if (team.gearS.length) F.push('Ordnance Drop was carried instead of spent');
  if (A.G.hand.includes('ordnance')) F.push('Ordnance Drop stayed in hand');
}

// --- fog of war: the home third is seen, units see two, scouts three, nothing fires blind ---
{
  A.enterProfile(unlockAll(A.blankProfile('FOG'), ['rifle', 'marks', 'scout', 'recon', 'wall', 'medic']));
  A.launchSpec({node: null, type: 'stronghold', mod: 'fog', reward: 0});
  clearBoard();
  if (!A.G.fog) F.push('the fog modifier did not set G.fog');
  if (!A.cellVisible(2, 2) || A.cellVisible(2, 3)) F.push('an empty fogged board should show exactly the home third');
  const r = spawnUnit('rifle', 2, 2);
  if (!A.cellVisible(2, 4) || A.cellVisible(2, 5)) F.push('a Rifleman should see two cells');
  const deep = spawnFoe('crawler', 2, 6, 10);
  if (A.geomFor(r).length) F.push('a Rifleman fired into the fog');
  if (A.foeVisible(deep)) F.push('a hostile in the fog is visible');
  deep.col = 4;
  if (!A.geomFor(r).includes(deep)) F.push('a hostile in sight should be a target');
  clearBoard();
  spawnUnit('scout', 2, 2);
  if (!A.cellVisible(2, 5) || A.cellVisible(2, 6)) F.push('a Scout should see three cells');
  const hidden = spawnFoe('hulk', 0, 7, 30);
  spawnUnit('wall', 0, 4);                                  // sees to column 6, not 7
  if (A.foeVisible(hidden)) F.push('a hostile beyond every sight line should be hidden');
  A.strike(hidden, A.BEST.hulk, 0);
  if (!A.foeVisible(hidden)) F.push('a hostile that strikes should give itself away');
  A.G.hand = ['recon']; A.G.dp = 5;
  A.deploy('recon', 2, 0);
  if (!A.G.reveal || !A.cellVisible(4, 7)) F.push('Recon Lark did not lift the fog');
  A.territoryPhase();
  if (A.G.reveal) F.push('the Recon reveal outlived the turn');
  // a boss fight is never fogged
  A.enterProfile(unlockAll(A.blankProfile('FOGB'), ['rifle', 'marks', 'scout', 'recon', 'wall', 'medic']));
  A.launchSpec({node: null, op: 'ironveil', type: 'boss', mod: 'fog', reward: 0});
  if (A.G.fog) F.push('a boss mission was fogged');
}

// --- saved decks survive the save layer ---
{
  const p = A.blankProfile('PRE');
  p.presets = [{n: 'Gun line', deck: ['rifle', 'marks'], frame: null}, null, {n: 'bad'}];
  const m = A.migrate(p);
  if (m.presets.length !== 1 || m.presets[0].n !== 'Gun line') F.push('presets did not survive migration cleanly');
  const q = A.migrate(A.blankProfile('PRE2'));
  if (!Array.isArray(q.presets)) F.push('a fresh profile has no presets list');
  const v15 = A.blankProfile('V15'); v15.version = 15; v15.unlocks.cards = ['scout', 'fireteam', 'noble']; v15.progress.credits = 0;
  const mv = A.migrate(v15);
  if (mv.progress.credits !== 470) F.push(`v16 refunded ${mv.progress.credits}, wanted 470`);
  if (mv.unlocks.cards.includes('fireteam')) F.push('the old Fireteam survived migration');
}


// --- one line per deck: warned at the table, refused at the door ---
{
  const p = unlockAll(A.blankProfile('LINE'), ['ftnoble', 'rifle', 'marks', 'wall', 'medic', 'lancer']);
  p.unlocks.cards.push('whitedevil');
  p.loadout.frame = 'whitedevil';
  A.enterProfile(p);
  const probs = A.deckProblems();
  if (!probs.some(x => x.n === 'One line per deck')) F.push('a Fireteam deck with a Frame in the slot was not flagged');
  let said = null;
  const prev = A.hooks.notify;
  A.setHooks({notify: (t, m) => { said = t; }});
  const launched = A.launchSpec({node: null, type: 'stronghold', mod: 'none', reward: 0});
  A.setHooks({notify: prev});
  if (launched !== false || said !== 'One line per deck') F.push(`a clashing deck launched (${launched}, ${said})`);
  p.loadout.frame = null;
  A.enterProfile(p);
  if (A.deckProblems().length) F.push('emptying the Frame slot should clear the clash');
  if (A.launchSpec({node: null, type: 'stronghold', mod: 'none', reward: 0}) === false) F.push('a clean Fireteam deck was refused');
}


// --- a fitted kit never cycles back through the reserve ---
{
  start(['whitedevil', 'beamrifle', 'ftnoble', 'camo', 'ordnance', 'rifle', 'marks', 'wall']);
  A.active.loadout.frame = null;
  A.G.hand = ['ftnoble', 'camo', 'ordnance'];
  A.G.deck = [];
  A.G.dp = 20;
  A.deploy('ftnoble', 2, 1);
  A.deploy('camo', 2, 1);
  spawnFoe('crawler', 2, 5, 10);
  A.deploy('ordnance', 2, 1);
  if (!A.G.spent.includes('camo') || !A.G.spent.includes('ordnance')) F.push('played kits were not marked spent');
  const drawn = [];
  for (let i = 0; i < 12; i++) { if (A.drawCard(true)) drawn.push(A.G.hand[A.G.hand.length - 1]); }
  if (drawn.includes('camo')) F.push('Active Camo came back through the reserve while fitted');
  if (drawn.includes('ordnance')) F.push('a spent Ordnance Drop came back through the reserve');
  if (!drawn.includes('rifle')) F.push('the reserve stopped cycling ordinary cards');
  // Field Refit hands a displaced FRAME gear back — and it is in play again.
  // (A Fireteam's stripped ability is lost; Refit reads "your Frame".)
  A.active.lead = 'fieldrefit';
  ['whitedevil', 'beamrifle', 'beamsaber'].forEach(c => { if (!A.active.unlocks.cards.includes(c)) A.active.unlocks.cards.push(c); });
  A.active.loadout.deck.push('beamrifle', 'beamsaber');
  const wd = spawnUnit('whitedevil', 0, 1);
  A.G.hand.push('beamrifle', 'beamsaber');
  A.G.dp = 5;
  A.deploy('beamrifle', 0, 1);
  if (!A.G.spent.includes('beamrifle')) F.push('a fitted Beam Rifle was not marked spent');
  A.deploy('beamsaber', 0, 1);
  if (!A.G.hand.includes('beamrifle')) F.push('Field Refit did not hand the Beam Rifle back');
  if (A.G.spent.includes('beamrifle')) F.push('a gear returned to hand by Field Refit stayed spent');
  if (!A.G.spent.includes('beamsaber') || wd.gearW !== 'beamsaber') F.push('the Beam Saber did not take the mount');
  A.active.lead = 'ironbrand';
}

F.report('balancetest');
