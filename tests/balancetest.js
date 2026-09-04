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
  A.G.event = null; A.G.eventNext = null;              // a Supply Drop event would add +2 and lie
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
const ARMOUR = ['camo', 'lock', 'jetpack', 'dropshield', 'hologram', 'xgrenade'];
{
  ['fireteam', 'noble', 'shadow', 'osiris', 'majestic'].forEach(id => { if (A.POOL[id]) F.push(`old Fireteam card '${id}' survives`); });
  TEAMS.forEach(id => { if (!A.POOL[id] || A.POOL[id].line !== 'fireteam' || A.POOL[id].t !== 'special') F.push(`${id} is not a Fireteam Specialist`); });
  ARMOUR.forEach(id => { if (!A.POOL[id] || A.POOL[id].fits !== 'fireteam' || A.POOL[id].dp !== 1) F.push(`${id} is not a 1 DP Fireteam ability`); });
  if (!A.MODS.fog) F.push('no Fog of War modifier');
}

// --- teams stack on the field; abilities need a team and fit any of them; the new one strips the last ---
{
  start(['ftnoble', 'ftshadow', 'camo', 'jetpack', 'lock', 'rifle']);
  A.G.hand = ['ftnoble', 'ftshadow', 'camo', 'jetpack', 'lock'];
  A.G.dp = 20;
  if (!A.frameGateText('camo')) F.push('an ability should be dead in hand with no Fireteam standing');
  A.deploy('ftnoble', 2, 1);
  const team = A.hostFor(A.POOL.camo);
  if (!team || team.id !== 'ftnoble') F.push('Fireteam Noble did not stand as a kit host');
  if (A.frameGateText('ftshadow')) F.push('a second Fireteam was gated — there is no field limit');
  if (!A.validTiles('ftshadow').length) F.push('a second Fireteam was offered no tiles');
  A.deploy('ftshadow', 3, 1);
  if (A.validTiles('camo').length !== 2) F.push(`an ability should target every standing team, offered ${A.validTiles('camo').length}`);
  A.G.units = A.G.units.filter(u => u.id !== 'ftshadow');
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

// --- X-Grenade: aimed within two of a team, lands in an X, ignores armour, the card is spent ---
{
  start(['ftnoble', 'xgrenade', 'rifle', 'marks', 'wall', 'medic']);
  A.G.hand = ['xgrenade'];
  A.G.dp = 5;
  if (A.validTiles('xgrenade').length) F.push('a grenade with no team standing had targets');
  const team = spawnUnit('ftnoble', 2, 1);
  const tiles = A.validTiles('xgrenade');
  if (!tiles.includes(2 * A.COLS + 3) || !tiles.includes(4 * A.COLS + 3) || !tiles.includes(0 * A.COLS + 0)) F.push('grenade range should reach two cells in every direction');
  if (tiles.includes(2 * A.COLS + 4)) F.push('grenade range reached three cells');
  const centre = spawnFoe('hulk', 4, 3, 30);               // aimed at the bottom-right of the range
  const ul = spawnFoe('crawler', 3, 2, 20); const ur = spawnFoe('crawler', 3, 4, 20);
  const side = spawnFoe('crawler', 4, 2, 20);              // orthogonal to the centre: not in the X
  const far = spawnFoe('crawler', 2, 3, 20);               // where the old automatic throw landed
  if (!A.validTiles('xgrenade').includes(4 * A.COLS + 3)) F.push('a cell holding a hostile should still be a landing cell');
  A.deploy('xgrenade', 4, 3);
  if (30 - centre.hp !== 5) F.push(`the X centre took ${30 - centre.hp}, wanted 5 through armour`);
  if (ul.hp !== 15 || ur.hp !== 15) F.push('a diagonal of the X was missed');
  if (side.hp !== 20 || far.hp !== 20) F.push('the X hit outside its shape');
  if (team.gearS.length) F.push('X-Grenade was carried instead of spent');
  if (A.G.hand.includes('xgrenade')) F.push('X-Grenade stayed in hand');
  const old = A.blankProfile('ORD'); old.version = 17; old.unlocks.cards = ['scout', 'ordnance']; old.loadout.deck = ['scout', 'ordnance'];
  const m = A.migrate(old);
  if (!m.unlocks.cards.includes('xgrenade') || m.loadout.deck.includes('ordnance')) F.push('the Ordnance Drop did not become the X-Grenade in an old save');
}

// --- fog of war: the home third is seen, units see one, scopes two, scouts three, nothing fires blind ---
{
  A.enterProfile(unlockAll(A.blankProfile('FOG'), ['rifle', 'marks', 'scout', 'recon', 'wall', 'medic']));
  A.launchSpec({node: null, type: 'stronghold', mod: 'fog', reward: 0});
  clearBoard();
  if (!A.G.fog) F.push('the fog modifier did not set G.fog');
  if (!A.cellVisible(2, 2) || A.cellVisible(2, 3)) F.push('an empty fogged board should show exactly the home third');
  const r = spawnUnit('rifle', 2, 2);
  if (!A.cellVisible(2, 3) || A.cellVisible(2, 4)) F.push('a Rifleman should see one cell');
  const deep = spawnFoe('crawler', 2, 6, 10);
  if (A.geomFor(r).length) F.push('a Rifleman fired into the fog');
  if (A.foeVisible(deep)) F.push('a hostile in the fog is visible');
  deep.col = 3;
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


// --- a mixed deck is legal: a Fireteam in the twelve and a Frame in the slot both fly ---
{
  const p = unlockAll(A.blankProfile('MIX'), ['ftnoble', 'rifle', 'marks', 'wall', 'medic', 'lancer']);
  p.unlocks.cards.push('whitedevil');
  p.loadout.frame = 'whitedevil';
  A.enterProfile(p);
  if (A.deckProblems().length) F.push('a mixed deck was flagged — the one-line rule is shelved');
  if (A.launchSpec({node: null, type: 'stronghold', mod: 'none', reward: 0}) === false) F.push('a mixed deck was refused at the door');
  if (!A.G.hand.includes('whitedevil')) F.push('the Frame was not seeded beside a Fireteam deck');
}

// --- every kit is one use a mission: nothing played comes back through the reserve ---
{
  start(['whitedevil', 'beamrifle', 'ftnoble', 'camo', 'xgrenade', 'rifle', 'marks', 'wall']);
  A.active.loadout.frame = null;
  A.G.hand = ['ftnoble', 'camo', 'xgrenade'];
  A.G.deck = [];
  A.G.dp = 20;
  A.deploy('ftnoble', 2, 1);
  A.deploy('camo', 2, 1);
  spawnFoe('crawler', 2, 3, 10);
  A.deploy('xgrenade', 2, 3);
  if (!A.G.spent.includes('camo') || !A.G.spent.includes('xgrenade')) F.push('played Fireteam kits were not marked spent');
  const drawn = [];
  for (let i = 0; i < 12; i++) { if (A.drawCard(true)) drawn.push(A.G.hand[A.G.hand.length - 1]); }
  if (drawn.includes('camo')) F.push('Active Camo came back through the reserve after being played');
  if (drawn.includes('xgrenade')) F.push('a thrown X-Grenade came back through the reserve');
  if (!drawn.includes('rifle')) F.push('the reserve stopped cycling ordinary cards');
  if (drawn.includes('ftnoble')) F.push('a standing Fireteam cycled back while on the field');
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


// --- a run dealt before its boss existed gets the boss on its final node ---
{
  const p = A.blankProfile('OLDRUN');
  p.version = 16;
  p.ops = {sunderglass: {cleared: ['n1'], nodes: {n1: {type: 'stronghold'}, n5: {type: 'extract', reward: 100}}}};
  const m = A.migrate(p);
  if (m.ops.sunderglass.nodes.n5.type !== 'boss') F.push('an old Sunderglass run still ends in Extraction');
  if (m.ops.sunderglass.nodes.n5.reward !== 100 || m.ops.sunderglass.cleared[0] !== 'n1') F.push('retyping the final node disturbed the rest of the run');
}


// --- a Proto Frame moves and still acts in the same turn ---
{
  start();
  const wd = spawnUnit('whitedevil', 2, 1);
  wd.fresh = false; wd.acted = false; wd.moved = false;
  if (!wd.servo) F.push('a Proto Frame should carry servo stride');
  const to = A.moveTargets(wd).find(i => i % A.COLS === 2 && Math.floor(i / A.COLS) === 2);
  if (to === undefined) F.push('the Frame had no forward step');
  else {
    A.doMove(wd, 2, 2);
    if (wd.acted) F.push('moving spent the Frame\'s action');
    const foe = spawnFoe('crawler', 2, 3, 10);
    A.doAttack(wd, foe);
    if (foe.hp === 10) F.push('the Frame could not fire after moving');
  }
  const r = spawnUnit('rifle', 0, 1);
  if (r.servo) F.push('servo stride leaked onto a Rifleman');
}


// --- Osiris strides two cells instead of dropping in ---
{
  start();
  if (A.POOL.ftosiris.drop) F.push('Osiris still drops anywhere');
  const o = spawnUnit('ftosiris', 2, 0);
  o.fresh = false; o.acted = false; o.moved = false;
  if (!o.boost) F.push('Osiris has no stride');
  const m = A.moveTargets(o);
  if (!m.includes(2 * A.COLS + 2)) F.push('Osiris cannot stride two cells forward');
  if (!m.includes(4 * A.COLS + 0)) F.push('Osiris cannot stride two lanes down');
  if (m.includes(3 * A.COLS + 1)) F.push('Osiris strode diagonally');
  spawnUnit('wall', 2, 1);
  if (A.moveTargets(o).includes(2 * A.COLS + 2)) F.push('Osiris strode through a wall');
}


// --- one of each team: out of the pile while standing, back in the deck when lost ---
{
  start(['ftnoble', 'ftshadow', 'rifle', 'marks', 'wall', 'medic']);
  A.G.hand = ['ftnoble'];
  A.G.deck = [];
  A.G.dp = 20;
  A.deploy('ftnoble', 2, 1);
  const noble = A.G.units.find(u => u.id === 'ftnoble');
  A.G.hand.push('ftnoble');                       // suppose it were drawn anyway
  if (!A.frameGateText('ftnoble')) F.push('a standing team\'s card should be gated');
  if (A.validTiles('ftnoble').length) F.push('a standing team\'s card was offered tiles');
  A.G.hand = [];
  const drawn = [];
  for (let i = 0; i < 10; i++) { if (A.drawCard(true)) drawn.push(A.G.hand[A.G.hand.length - 1]); }
  if (drawn.includes('ftnoble')) F.push('a standing team cycled back into the draw pile');
  if (!drawn.includes('ftshadow')) F.push('a team not on the field should still cycle');
  A.dmgUnit(noble, 99, 'test');
  if (A.G.units.some(u => u.id === 'ftnoble')) F.push('the team did not die');
  if (!A.G.deck.includes('ftnoble')) F.push('a lost team did not return to the deck');
  if (A.G.hand.includes('ftnoble')) F.push('a lost team went to the hand, not the deck');
  const before = A.G.deck.length;
  A.dmgUnit({...noble, uid: -1, hp: 1, id: 'ftnoble', line: 'fireteam', n: 'x', lane: 0, col: 0, att: {}}, 99, 'test');
  if (A.G.deck.filter(c => c === 'ftnoble').length !== 1) F.push('a lost team was returned twice');
  void before;
  // teams face either way; sight is one cell unless the card says otherwise
  clearBoard();
  const maj = spawnUnit('ftmajestic', 2, 3);
  const behind = spawnFoe('crawler', 2, 2, 10);
  const ahead = spawnFoe('crawler', 2, 4, 10);
  const g = A.geomFor(maj);
  if (!g.includes(behind) || !g.includes(ahead)) F.push('Majestic does not fight facing either way');
  if (A.POOL.ftnoble.sight || A.POOL.ftshadow.sight || A.POOL.ftmajestic.sight) F.push('teams should fall to the one-cell default');
  if (A.POOL.ftosiris.sight !== 3) F.push('Osiris should keep its three-cell sight');
}


// --- the first node of every operation is clean: no modifier ---
{
  Object.keys(A.OPS).forEach(op => {
    for (let i = 0; i < 6; i++) {
      const p = A.blankProfile('S' + i); p.op = op; A.enterProfile(p);
      const run = A.opRun();
      const start = A.OPS[op].nodes.find(n => n.role === 'start');
      if (run.nodes[start.id].mod !== 'none') F.push(`${op}'s first node rolled ${run.nodes[start.id].mod}`);
    }
  });
}


// --- sight: one cell by default, and only the cards with a reason see further ---
{
  const eyes = {scout: 3, falconer: 3, fob: 3, ftosiris: 3, pathfinder: 2, marks: 2, railgun: 2};
  Object.entries(A.POOL).forEach(([id, k]) => {
    if (k.sight && eyes[id] !== k.sight) F.push(`${id} sees ${k.sight} cells with no reason on record`);
  });
  Object.entries(eyes).forEach(([id, n]) => { if (A.POOL[id].sight !== n) F.push(`${id} should see ${n}`); });
  const u = A.mkUnit('rifle', 0, 0);
  if (u.sight) F.push('a Rifleman carries a sight value — the default is meant to be the rule');
}


// --- Naginata reaches, Samurai hits ---
{
  const n = A.POOL.naginata, sa = A.POOL.samurai;
  if (n.dp !== sa.dp) F.push('the pair should cost the same');
  if (!(n.hp > sa.hp)) F.push('Naginata should be the sturdier');
  if (!(sa.dmg > n.dmg) || sa.burst !== 5) F.push('Samurai should hit harder, with the iai draw on play');
  if (n.tg !== 'around' || sa.tg !== 'sweep5') F.push('the pair swapped shapes');
}

// --- the Fireteam weapon gear is gone, refunded; the line is teams and abilities ---
{
  ['rocket', 'shotgun', 'sniper', 'esword', 'gravhammer'].forEach(id => {
    if (A.GEAR[id] || A.POOL[id]) F.push(`${id} survives as gear or card`);
  });
  const old = A.blankProfile('WPN'); old.version = 19; old.unlocks.gear = ['barrel', 'sniper', 'gravhammer']; old.loadout.gear = {ftosiris: 'sniper'}; old.progress.credits = 0;
  const m = A.migrate(old);
  if (m.progress.credits !== 390 || m.unlocks.gear.includes('sniper') || m.loadout.gear.ftosiris) F.push('weapon gear was not refunded and unfitted out of an old save');
  if (!m.unlocks.gear.includes('barrel')) F.push('a general gear piece was lost in the refund');
}


// --- four gear pieces for the line: plating, visor, rack, beacon ---
{
  ['mjolnir', 'visor', 'kitrack', 'beacon'].forEach(gi => { if (!A.GEAR[gi]) F.push(`missing gear '${gi}'`); });
  ['kitrack', 'beacon'].forEach(gi => {
    if (A.GEAR[gi].fits !== 'fireteam') F.push(`${gi} should be Fireteam-only`);
    if (!A.gearFits('ftnoble', gi) || A.gearFits('rifle', gi)) F.push(`${gi} fits the wrong cards`);
  });
  ['mjolnir', 'visor'].forEach(gi => { if (!A.gearFits('rifle', gi) || !A.gearFits('ftnoble', gi)) F.push(`${gi} should be general gear`); });

  const p = unlockAll(A.blankProfile('KIT'), ['ftnoble', 'ftshadow', 'camo', 'jetpack', 'lock', 'rifle', 'marks', 'wall']);
  p.unlocks.gear.push('mjolnir', 'visor', 'kitrack', 'beacon');
  p.loadout.gear = {rifle: 'mjolnir', marks: 'visor', ftnoble: 'kitrack', ftshadow: 'beacon'};
  A.enterProfile(p);
  A.launchSpec({node: null, type: 'stronghold', mod: 'fog', reward: 0});
  clearBoard();

  // Mjolnir Plating: a shield that comes back every turn.
  const r = spawnUnit('rifle', 0, 1);
  if (r.shield !== 1 || !r.regen) F.push('Mjolnir Plating did not grant a regenerating shield');
  A.dmgUnit(r, 4, 'test');
  if (r.shield !== 0 || r.hp !== r.max) F.push('the plating shield did not eat the blow');
  A.endTurn();
  if (A.G.units.find(u => u.uid === r.uid).shield !== 1) F.push('the plating shield did not re-form');

  // VISR Visor: +2 cells of sight, on top of whatever the card sees.
  clearBoard();
  const m = spawnUnit('marks', 2, 1);
  if (m.sightUp !== 2) F.push('the visor granted no sight');
  if (!A.cellVisible(2, 5) || A.cellVisible(2, 6)) F.push('a scoped unit with a visor should see four cells');

  // Kit Rack: two armour abilities at once, the newer ability the live one.
  clearBoard();
  A.G.hand = ['ftnoble', 'camo', 'jetpack', 'lock'];
  A.G.dp = 20;
  A.deploy('ftnoble', 2, 1);
  const team = A.G.units.find(u => u.id === 'ftnoble');
  if (!team.rack) F.push('the Kit Rack did not reach the team');
  A.deploy('camo', 2, 1);
  A.deploy('jetpack', 2, 1);
  if (!team.camo || !team.jet) F.push('the rack did not hold two abilities at once');
  if (team.gearS.length !== 2) F.push(`the team carries ${team.gearS.length} abilities, wanted 2`);
  A.deploy('lock', 2, 1);
  if (team.camo) F.push('the rack did not shed the oldest ability');
  if (!team.jet || !team.ab || team.ab.key !== 'lock') F.push('the rack lost the ability it should have kept');
  if (team.gearS.length !== 2) F.push('the rack went over its cap');

  // Recovery Beacon: a lost team comes back to hand, not the deck.
  clearBoard();
  A.G.hand = [];
  A.G.deck = [];
  const sh = spawnUnit('ftshadow', 3, 1);
  if (!sh.recover) F.push('the beacon did not reach the team');
  A.dmgUnit(sh, 99, 'test');
  if (!A.G.hand.includes('ftshadow')) F.push('the beacon did not recover the card to hand');
  if (A.G.deck.includes('ftshadow')) F.push('the beacon put the card in the deck as well');
}


// --- v2.38.3: eight more Frame gear cards, three new mechanics ---
{
  const NEW = ['beamjavelin', 'guardianfield', 'devilsdrive', 'pilebunker', 'dualblades', 'doubleblade', 'siegecannon', 'corebooster'];
  NEW.forEach(id => {
    const k = A.POOL[id];
    if (!k || k.slot !== 'weapon' && k.slot !== 'support') F.push(`${id} is not a Frame gear card`);
  });
  if (!A.TGNAME.flank2) F.push('flank2 has no targeting name');
}

// --- Beam Javelin: sweeps every cell around the White Devil ---
{
  start(['whitedevil', 'beamjavelin', 'rifle', 'marks', 'wall', 'medic']);
  A.G.hand = ['beamjavelin'];
  A.G.dp = 5;
  const wd = spawnUnit('whitedevil', 2, 2);
  A.deploy('beamjavelin', 2, 2);
  if (wd.gearW !== 'beamjavelin' || wd.tg !== 'around' || wd.dmg !== 3) F.push('Beam Javelin did not fit');
  const cells = new Set(A.geomCells(wd));
  if (cells.size !== 8) F.push(`Beam Javelin reaches ${cells.size} cells, wanted the 8 around it`);
}

// --- Guardian Field: a standing aura, refreshed every turn, gone once stripped ---
{
  start(['whitedevil', 'guardianfield', 'rifle', 'marks', 'wall', 'medic']);
  A.G.hand = ['guardianfield'];
  A.G.dp = 5;
  const wd = spawnUnit('whitedevil', 2, 2);
  const near = spawnUnit('rifle', 2, 3);
  const far = spawnUnit('marks', 4, 2);
  A.deploy('guardianfield', 2, 2);
  if (!wd.auraShield) F.push('Guardian Field did not fit');
  near.shield = 0; far.shield = 0;
  A.endTurn();
  const nearAfter = A.G.units.find(u => u.uid === near.uid);
  const farAfter = A.G.units.find(u => u.uid === far.uid);
  if (!nearAfter || nearAfter.shield < 1) F.push('Guardian Field did not shield an adjacent friendly');
  if (farAfter && farAfter.shield) F.push('Guardian Field reached past adjacency');
  if (!A.supportTargets(A.G.units.find(u => u.id === 'whitedevil')).length) F.push('Guardian Field has no support highlight');
}

// --- Devil's Drive: +2 damage, no other strings attached ---
{
  start(['whitedevil', 'devilsdrive', 'rifle', 'marks', 'wall', 'medic']);
  A.G.hand = ['devilsdrive'];
  A.G.dp = 5;
  const wd = spawnUnit('whitedevil', 2, 2);
  const before = A.dmgPreview(wd);
  A.deploy('devilsdrive', 2, 2);
  if (A.dmgPreview(wd) !== before + 2) F.push(`Devil's Drive should add 2 damage, went ${before} -> ${A.dmgPreview(wd)}`);
  if (!wd.regen) F.push("Devil's Drive should not touch the White Devil's own shield");
}

// --- Pile Bunker Blade: full damage through armour at the first cell, half at the second ---
{
  start(['sevenblades', 'pilebunker', 'rifle', 'marks', 'wall', 'medic']);
  A.G.hand = ['pilebunker'];
  A.G.dp = 5;
  const sb = spawnUnit('sevenblades', 2, 1);
  A.deploy('pilebunker', 2, 1);
  if (sb.gearW !== 'pilebunker' || !sb.pen || !sb.falloff) F.push('Pile Bunker Blade did not fit with its traits');
  const near = spawnFoe('hulk', 2, 2, 30);           // armour floor — pen must ignore it
  const far = spawnFoe('hulk', 2, 3, 30);
  sb.fresh = false; sb.acted = false;
  A.fire(sb, false);
  if (30 - near.hp !== 6) F.push(`Pile Bunker Blade dealt ${30 - near.hp} at range 1, wanted 6 through armour`);
  if (30 - far.hp !== 3) F.push(`Pile Bunker Blade dealt ${30 - far.hp} at range 2, wanted 3 (half, rounded up)`);
}

// --- Dual Blades: the lane above and below, one cell ahead, own lane clear ---
{
  start(['sevenblades', 'dualblades', 'rifle', 'marks', 'wall', 'medic']);
  A.G.hand = ['dualblades'];
  A.G.dp = 5;
  const sb = spawnUnit('sevenblades', 2, 1);
  A.deploy('dualblades', 2, 1);
  const up = spawnFoe('crawler', 1, 2, 10);
  const own = spawnFoe('crawler', 2, 2, 10);
  const down = spawnFoe('crawler', 3, 2, 10);
  const hit = A.targetsFor(sb).map(e => e.uid);
  if (!hit.includes(up.uid) || !hit.includes(down.uid)) F.push('Dual Blades missed a flank');
  if (hit.includes(own.uid)) F.push('Dual Blades hit its own lane');
}

// --- Double Blade: the cell ahead and the cell behind, in one motion ---
{
  start(['sevenblades', 'doubleblade', 'rifle', 'marks', 'wall', 'medic']);
  A.G.hand = ['doubleblade'];
  A.G.dp = 5;
  const sb = spawnUnit('sevenblades', 2, 2);
  A.deploy('doubleblade', 2, 2);
  const ahead = spawnFoe('crawler', 2, 3, 10);
  const behind = spawnFoe('crawler', 2, 1, 10);
  const hit = A.targetsFor(sb).map(e => e.uid);
  if (!hit.includes(ahead.uid) || !hit.includes(behind.uid)) F.push('Double Blade missed a side');
}

// --- Siege Cannon: reaches the whole board, needs a turn to cycle ---
{
  start(['heavyarms', 'siegecannon', 'rifle', 'marks', 'wall', 'medic']);
  A.G.hand = ['siegecannon'];
  A.G.dp = 5;
  const ha = spawnUnit('heavyarms', 2, 1);
  A.deploy('siegecannon', 2, 1);
  if (ha.tg !== 'boardFurthest' || ha.dmg !== 8 || !ha.recharge) F.push('Siege Cannon did not fit');
  const deep = spawnFoe('crawler', 4, 7, 20);
  ha.fresh = false; ha.acted = false;
  A.fire(ha, false);
  if (20 - deep.hp !== 8) F.push(`Siege Cannon dealt ${20 - deep.hp}, wanted 8`);
  if (ha.cycling <= 0) F.push('Siege Cannon did not start cycling');
}

// --- Core Booster: the Heavy Arms may move ---
{
  start(['heavyarms', 'corebooster', 'rifle', 'marks', 'wall', 'medic']);
  A.G.hand = ['corebooster'];
  A.G.dp = 5;
  const ha = spawnUnit('heavyarms', 2, 1);
  if (ha.mob) F.push('Heavy Arms should be anchored bare');
  A.deploy('corebooster', 2, 1);
  if (!ha.mob) F.push('Core Booster did not grant movement');
  ha.fresh = false; ha.acted = false; ha.moved = false;
  if (!A.moveTargets(ha).length) F.push('a mobile Heavy Arms has no move targets');
}

F.report('balancetest');
