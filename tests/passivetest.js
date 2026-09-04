// The pro/con lead roster: every passive fires under its condition, every
// downside actually costs what it says, and neither leaks to the wrong lead.
// Ironbrand is the one clean lead; everyone else trades.
import * as A from './support/api.js';
import {failures} from './support/harness.js';
import {spawnUnit, spawnFoe, clearBoard, unlockAll, stillAir} from './support/fixtures.js';

const F = failures();

const start = (lead, deck) => {
  const p = unlockAll(A.blankProfile('PV'), deck || ['rifle', 'marks', 'wall', 'assassin']);
  A.enterProfile(p);
  p.lead = lead;
  A.launchSpec({node: null, type: 'stronghold', mod: 'none', reward: 0});
  stillAir();
  clearBoard();
};
const calm = () => { A.G.enemies.length = 0; A.G.predict = []; A.G.held = []; };

// Lone Edge: +3 alone, -1 in formation — the positioning bias cuts both ways
{
  start('loneedge');
  const alone = spawnUnit('rifle', 0, 1);
  if (A.dmgPreview(alone) !== A.POOL.rifle.dmg + 3) F.push('Lone Edge should pay +3 to an isolated unit');
  const pair = spawnUnit('marks', 0, 2);
  if (A.dmgPreview(alone) !== A.POOL.rifle.dmg - 1) F.push('No Formation should cost an adjacent unit 1');
  if (A.dmgPreview(pair) !== A.POOL.marks.dmg - 1) F.push('No Formation missed the neighbour');
  start('ironbrand');
  const other = spawnUnit('rifle', 0, 1);
  if (A.dmgPreview(other) !== A.POOL.rifle.dmg) F.push('Lone Edge paid under the wrong lead');
}

// Field Fabrication: tech +2 hull and repairs — and commons deploy 2 thin
{
  start('skunkworks');
  const t = A.mkUnit('firingstep', 1, 1);
  if (t.max !== A.POOL.firingstep.hp + 2) F.push('Fabrication hull bonus missing: ' + t.max);
  const r = A.mkUnit('rifle', 2, 1);
  if (r.max !== A.POOL.rifle.hp - 2) F.push(`Thin Personnel missing — rifle deployed at ${r.max}`);
  const sc = A.mkUnit('scout', 3, 1);
  if (sc.max !== 1) F.push(`Thin Personnel should floor hull at 1 (scout ${sc.max})`);
  t.hp = 3; r.hp = 1;
  A.G.units.push(t, r);
  A.playerPhase();
  if (t.hp !== 4) F.push('Fabrication repair missing, hp ' + t.hp);
  if (r.hp !== 1) F.push('Fabrication repaired a non-tech unit');
  // Specials are neither tech nor common: untouched either way.
  const k = A.mkUnit('kessen', 4, 1);
  if (k.max !== A.POOL.kessen.hp) F.push('Skunkworks touched a Specialist hull');
}

// Quietstep: drop/crush cards cost 1 less — and columns 0-1 are off limits
{
  start('quietstep');
  if (A.costOf('assassin') !== A.POOL.assassin.dp - 1) F.push('Quietstep discount missing on a drop card');
  if (A.costOf('rifle') !== A.POOL.rifle.dp) F.push('Quietstep discounted a grounded card');
  if (A.costOf('mine') !== 1) F.push('Quietstep should floor Minefield at 1, got ' + A.costOf('mine'));
  const tiles = A.validTiles('rifle');
  if (tiles.some(i => i % A.COLS < 2)) F.push('No Rear Line still offers the rear columns');
  if (!tiles.length) F.push('No Rear Line closed the whole board');
  A.active.lead = 'ironbrand';
  if (A.costOf('assassin') !== A.POOL.assassin.dp) F.push('Quietstep discount stuck to the wrong lead');
  if (!A.validTiles('rifle').some(i => i % A.COLS < 2)) F.push('rear columns missing under the wrong lead');
}

// Firebrand: everything hits +1 harder — and everything takes +1
{
  start('firebrand');
  const u = spawnUnit('rifle', 2, 1);
  if (A.dmgPreview(u) !== A.POOL.rifle.dmg + 1) F.push('Firebrand +1 damage missing');
  const before = u.hp;
  A.dmgUnit(u, 2, 'test');
  if (before - u.hp !== 3) F.push(`Exposed should turn 2 into 3 (took ${before - u.hp})`);
  start('ironbrand');
  const v = spawnUnit('rifle', 2, 1);
  const b2 = v.hp;
  A.dmgUnit(v, 2, 'test');
  if (b2 - v.hp !== 2) F.push('Exposed leaked to the wrong lead');
}

// Riptide: move and fire in the same turn — for 2 DP a turn, every turn
{
  start('riptide');
  const u = spawnUnit('rifle', 2, 1);
  const e = spawnFoe('crawler', 2, 5, 99);
  A.doMove(u, 2, 2);
  if (u.acted) F.push('Riptide move should not spend the action');
  A.doAttack(u, e);
  if (e.hp !== 99 - A.POOL.rifle.dmg) F.push('the moved unit could not fire');
  calm();
  A.endTurn();
  if (A.G.dp !== A.MAXDP - 2) F.push(`Light Supply should leave ${A.MAXDP - 2} DP, got ${A.G.dp}`);
  start('ironbrand');
  const v = spawnUnit('rifle', 2, 1);
  A.doMove(v, 2, 2);
  if (!v.acted) F.push('move-and-fire leaked to the wrong lead');
}

// Coronet: +2 DP every turn, from the first one — Lean Manifest is leadtest's
{
  start('coronet');
  if (A.G.dp !== A.MAXDP + 2) F.push(`Standing Reserve should open at ${A.MAXDP + 2} DP, got ${A.G.dp}`);
  calm();
  A.endTurn();
  if (A.G.dp !== A.MAXDP + 2) F.push(`Standing Reserve should refresh at +2, got ${A.G.dp}`);
}

// Quartermaster: an extra card every turn, and only eight in the manifest
{
  start('quartermaster', ['rifle', 'marks', 'wall', 'assassin', 'scout', 'medic', 'archer', 'lancer']);
  A.G.hand = [];
  calm();
  A.endTurn();
  if (A.G.hand.length !== 3) F.push(`Forward Supply should draw 3, drew ${A.G.hand.length}`);
  if (A.deckCapOf() !== 8) F.push('Short Manifest cap is not 8');
  A.active.lead = 'ironbrand';
  if (A.deckCapOf() !== A.DECKSIZE) F.push('deck cap stuck to the wrong lead');
}

// Coldwire: everything repairs — and no Specialist ever deploys
{
  start('coldwire');
  const u = spawnUnit('rifle', 2, 1);
  u.hp = 2;
  A.playerPhase();
  if (u.hp !== 3) F.push(`Nanite Weave should repair 1 (hp ${u.hp})`);
  if (A.validTiles('kessen').length) F.push('No Requisition still deploys a Specialist');
  if (!A.validTiles('rifle').length) F.push('No Requisition swallowed a Common');
  if (!A.validTiles('wall').length) F.push('No Requisition swallowed a Tech');
}

// The Code and Field Refit — the two Frame leads — live in frametest,
// beside the machinery their trades act on.
// Spartan Company: the Fireteam line is a point cheaper; No Frame: the slot never flies
{
  start('masterchief', ['ftnoble', 'camo', 'rifle', 'marks', 'wall', 'medic', 'lancer', 'archer']);
  if (A.costOf('ftnoble') !== A.POOL.ftnoble.dp - 1) F.push(`Spartan Company priced Fireteam Noble at ${A.costOf('ftnoble')}`);
  if (A.costOf('camo') !== 1) F.push('a 1 DP ability must floor at 1');
  if (A.costOf('rifle') !== A.POOL.rifle.dp) F.push('Spartan Company leaked onto a Rifleman');
  if (!A.leadBan('whitedevil')) F.push('No Frame did not refuse a Proto Frame');
  A.active.loadout.frame = 'whitedevil';
  A.launchSpec({node: null, type: 'stronghold', mod: 'none', reward: 0});
  if (A.G.hand.includes('whitedevil') || A.frameReady()) F.push('No Frame still seeded the machine');
  A.active.loadout.frame = null;
  if (A.deckProblems(['ftnoble', 'ftshadow', 'rifle'], null).length) F.push('two Fireteams should be legal — Lone Spartan was shelved');
  start('ironbrand');
  if (A.costOf('ftnoble') !== A.POOL.ftnoble.dp) F.push('Spartan Company applied under another lead');
  if (A.leadBan('whitedevil')) F.push('No Frame applied under another lead');
}

// Perk prose is prose: a lead's rules key off its id, never off the wording
// of its passive or con. Until v2.38.6 every one of them matched a display
// string, so correcting a perk's spelling silently switched its rule off —
// exactly what happened when "Hardened Armor" became "Hardened Armour". Reword
// every perk in the roster and the trades must all still hold.
{
  const backup = JSON.parse(JSON.stringify(A.LEADS));
  Object.values(A.LEADS).forEach(L => {
    if (L.passive) { L.passive.n = 'Reworded Perk'; L.passive.d = 'Reworded.'; }
    if (L.con) { L.con.n = 'Reworded Cost'; L.con.d = 'Reworded.'; }
  });

  start('ironbrand');
  if (A.mkUnit('rifle', 2, 1).max !== A.POOL.rifle.hp + 1) F.push('Hardened Armour is keyed to its wording');

  start('skunkworks');
  if (A.mkUnit('rifle', 2, 1).max !== A.POOL.rifle.hp - 2) F.push('Thin Personnel is keyed to its wording');

  start('firebrand');
  if (A.dmgPreview(spawnUnit('rifle', 2, 1)) !== A.POOL.rifle.dmg + 1) F.push('Firebrand is keyed to its wording');

  start('quietstep');
  if (A.costOf('assassin') !== A.POOL.assassin.dp - 1) F.push('Quietstep is keyed to its wording');

  start('masterchief', ['ftnoble', 'rifle', 'marks', 'wall']);
  if (A.costOf('ftnoble') !== A.POOL.ftnoble.dp - 1) F.push('Spartan Company is keyed to its wording');
  if (!A.leadBan('whitedevil')) F.push('No Frame is keyed to its wording');

  Object.keys(backup).forEach(k => { A.LEADS[k] = backup[k]; });
  start('ironbrand');
  if (A.mkUnit('rifle', 2, 1).max !== A.POOL.rifle.hp + 1) F.push('the reworded roster was not restored');
}

F.report('lead pros and cons: every trade holds, nothing leaks between leads');
