// The fun patch: field events run on the marker promise contract, a lane's
// bought Last-Stand charge answers its next breach, the Dynamo pays for
// greed, and every hostile's intent badge tells the truth about its move.
import * as A from './support/api.js';
import {failures} from './support/harness.js';
import {spawnUnit, spawnFoe, clearBoard, unlockAll} from './support/fixtures.js';

const F = failures();

const start = () => {
  A.enterProfile(unlockAll(A.blankProfile('EV'), ['rifle', 'marks', 'wall', 'medic', 'techblade', 'fob']));
  A.launchSpec({node: null, type: 'stronghold', mod: 'none', reward: 0});
  clearBoard();
  A.G.eventNext = null;
  A.G.event = null;
};

// A: the event clock — telegraphed one turn, live the next, gone the turn after
{
  start();
  A.G.eventNext = 'supply';
  A.endTurn();
  if (A.G.event !== 'supply') F.push('telegraphed event did not go live');
  if (A.G.dp < A.MAXDP + 2) F.push('Supply Drop did not grant +2 DP: ' + A.G.dp);
  A.G.eventNext = null;
  A.endTurn();
  if (A.G.event === 'supply') F.push('event outlived its one turn');
}

// B: the tremor blunts every strike, and the forecast says so first
{
  start();
  const u = spawnUnit('wall', 2, 3);
  spawnFoe('hulk', 2, 4, 10);                    // 3-damage striker, adjacent
  A.G.event = 'tremor';
  const seen = A.forecastThreat().hits[u.uid];
  const before = u.hp;
  A.enemyPhase();
  const taken = before - u.hp;
  if (taken !== A.BEST.hulk.dmg - 1) F.push(`tremor strike dealt ${taken}, expected ${A.BEST.hulk.dmg - 1}`);
  if (seen !== taken) F.push(`forecast said ${seen}, strike dealt ${taken} — the board lied`);
  A.G.event = null;
}

// C: the overclock arms Tech only, and the preview matches the shot
{
  start();
  const t = spawnUnit('techblade', 1, 2);
  const r = spawnUnit('rifle', 3, 2);
  A.G.event = 'overclock';
  if (A.dmgPreview(t) !== A.POOL.techblade.dmg + 1) F.push('overclock preview missing on Tech');
  if (A.dmgPreview(r) !== A.POOL.rifle.dmg) F.push('overclock leaked onto personnel');
  const foe = spawnFoe('crawler', 1, 3, 10);   // no armour floor in the way
  A.fire(t, false);
  if (10 - foe.hp !== A.POOL.techblade.dmg + 1) F.push('overclocked shot did not match its preview');
  A.G.event = null;
}

// D: the hive's mood shapes the wave it was telegraphed against
{
  start();
  const spent = m => Object.entries(m).reduce((a, [k, c]) => a + A.BEST[k].threat * c, 0);
  A.G.event = null;
  // The wave ramp is a balance number that moves; +2 for a surge is the rule.
  const flat = spent(A.wave(1));
  A.G.event = 'surge';
  if (spent(A.wave(1)) !== flat + 2) F.push(`Hive Surge did not add +2 threat: ${flat} -> ${spent(A.wave(1))}`);
  A.G.event = 'calm';
  if (Object.keys(A.wave(1)).length) F.push('Dead Air still spawned hostiles');
  A.G.event = null;
}

// E: the Last-Stand charge — an armed lane sweeps, an unarmed one counts.
// The charge is bought now (Last-Stand Protocol), so the guard arms it by
// hand where it used to inherit one free per lane.
{
  start();
  A.G.gridCharge[2] = 1;
  const runner = spawnFoe('crawler', 2, 0, 3);
  spawnFoe('breacher', 2, 5, 6);                 // bystander in the same lane
  spawnFoe('crawler', 3, 5, 3);                  // different lane — untouched
  const kills0 = A.G.kills;
  A.enemyPhase();
  if (A.G.breaches !== 0) F.push('first breach counted despite the charge');
  if (A.G.gridCharge[2] !== 0) F.push('the charge did not spend');
  if (A.G.enemies.some(e => e.lane === 2)) F.push('the grid left hostiles standing in its lane');
  if (!A.G.enemies.some(e => e.lane === 3)) F.push('the grid swept a lane it had no business in');
  if (A.G.kills !== kills0) F.push('grid purge kills counted toward the tally');
  if (A.G.enemies.some(e => e.uid === runner.uid)) F.push('the breacher survived the grid');

  const again = spawnFoe('crawler', 2, 0, 3);
  A.enemyPhase();
  if (A.G.breaches !== 1) F.push('a breach in the naked lane did not count');
  if (A.G.enemies.some(e => e.uid === again.uid)) F.push('the second breacher was not removed');
}

// F: the Dynamo hums — +1 each, capped at +2, silent once destroyed
{
  start();
  spawnUnit('fob', 0, 1);
  A.endTurn();
  if (A.G.dp !== A.MAXDP + 1) F.push('one Dynamo should pay +1: ' + A.G.dp);
  clearBoard();
  spawnUnit('fob', 0, 1);
  spawnUnit('fob', 1, 1);
  spawnUnit('fob', 2, 1);
  A.G.event = null; A.G.eventNext = null;
  A.endTurn();
  if (A.G.dp !== A.MAXDP + 2) F.push('three Dynamos should cap at +2: ' + A.G.dp);
  clearBoard();
  A.G.event = null; A.G.eventNext = null;
  A.endTurn();
  if (A.G.dp !== A.MAXDP) F.push('a dead Dynamo kept paying');
  const d = A.mkUnit('fob', 2, 1);
  if (d.dmg || d.tg !== 'none') F.push('the Dynamo grew a weapon');
}

// G: intent badges tell the truth
{
  start();
  const free = spawnFoe('crawler', 0, 5, 3);
  if (A.enemyIntent(free).k !== 'advance') F.push('a free hostile should read advance');
  spawnUnit('wall', 1, 4);
  const blocked = spawnFoe('hulk', 1, 5, 10);
  const it = A.enemyIntent(blocked);
  if (it.k !== 'strike' || it.dmg !== A.BEST.hulk.dmg) F.push('a blocked striker should read its strike damage');
  const m = spawnFoe('mender', 2, 5, 8);
  if (A.enemyIntent(m).k !== 'advance') F.push('a mender with no patient should read advance');
  spawnFoe('hulk', 2, 6, 2);                     // wounded patient appears
  if (A.enemyIntent(m).k !== 'mend') F.push('a mender with a patient should read mend');
  const sp = spawnFoe('spore', 3, 6, 6);
  if (A.enemyIntent(sp).k !== 'spawn') F.push('a spore node should read spawn');
  spawnUnit('wall', 4, 4);
  const m2 = spawnFoe('mender', 4, 5, 8);
  if (A.enemyIntent(m2).k !== 'hold') F.push('a blocked unarmed hostile should read hold');
}

// F: Last-Stand Protocol — the grid is a card you buy and place, not a
// freebie. No lane starts armed; the card arms exactly the lane it is played
// into; and a breach in an unarmed lane counts, which is the whole point of
// making it cost something.
{
  start();
  if (A.G.gridCharge.some(c => c)) F.push('a lane started with a free Last-Stand charge');

  A.G.hand.push('laststand');
  A.G.dp = 9;
  const tiles = A.validTiles('laststand');
  const cell = tiles.find(i => Math.floor(i / A.COLS) === 1);
  if (cell === undefined) {
    F.push('Last-Stand Protocol offered no tile in lane 2');
  } else {
    A.deploy('laststand', 1, cell % A.COLS);
    if (!A.G.gridCharge[1]) F.push('the card did not arm the lane it was played into');
    if (A.G.gridCharge.filter(c => c).length !== 1) F.push('the card armed a lane it was not played into');
    if (A.G.hand.includes('laststand')) F.push('the card was not spent');
  }

  // The armed lane eats its breach; a bare lane does not.
  clearBoard();
  spawnFoe('crawler', 1, 0, 3);
  spawnFoe('crawler', 3, 0, 3);
  A.enemyPhase();
  if (A.G.breaches !== 1) F.push(`expected exactly the unarmed lane to breach, got ${A.G.breaches}`);
  if (A.G.gridCharge[1]) F.push('the armed lane kept its charge after firing');
}

F.report('events, charges, dynamo, intents: all checks pass');
