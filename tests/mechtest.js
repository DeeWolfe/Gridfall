// The two war frames: the Ashura you deploy and the Oni that answers it.
//
// They are a matched pair built around the same idea — the board has a vertical
// axis now. The Oni crosses lanes by choice and will always end up wherever the
// line is thinnest; the Ashura is the card that covers three lanes at once and
// can slide to meet it. If either half stops working the other stops meaning
// anything, so they are guarded together.
import * as A from './support/api.js';
import {failures} from './support/harness.js';
import {spawnUnit, spawnFoe, clearBoard, unlockAll, stillAir} from './support/fixtures.js';

const F = failures();

const start = deck => {
  const p = unlockAll(A.blankProfile('MECH'), deck || ['ashura', 'rifle', 'wall', 'medic']);
  A.enterProfile(p);
  A.launchSpec({node: null, type: 'stronghold', mod: 'none', reward: 0});
  stillAir();
  clearBoard();
  A.G.predict = [];
  A.G.held = [];
  return p;
};

// --- the card exists and is buildable ---
{
  const k = A.POOL.ashura;
  if (!k) F.push('Ashura Frame is not in the pool');
  else {
    if (k.t !== 'special') F.push('the frame is not a Specialist');
    if (k.tg !== 'vert3') F.push('the frame lost its three-lane sweep');
    if (!k.ab) F.push('the frame has no ability');
    if (!k.blocker) F.push('a sixteen-hull frame that does not block a lane');
  }
  const o = A.BEST.oni;
  if (!o) F.push('Oni Frame is not in the bestiary');
  else if (!o.flank) F.push('the Oni carries no flank flag — it is just a Harrower');
}

// --- the sweep covers three lanes, one column ahead ---
{
  start();
  const u = spawnUnit('ashura', 2, 3);
  const up = spawnFoe('crawler', 1, 4);
  const mid = spawnFoe('crawler', 2, 4);
  const down = spawnFoe('crawler', 3, 4);
  const wide = spawnFoe('crawler', 4, 4);          // two lanes out
  const behind = spawnFoe('crawler', 2, 5);        // a column too far
  const hit = A.targetsFor(u).map(e => e.uid);
  [['above', up], ['own lane', mid], ['below', down]].forEach(([where, e]) => {
    if (!hit.includes(e.uid)) F.push(`the sweep missed the cell ${where}`);
  });
  if (hit.includes(wide.uid)) F.push('the sweep reached two lanes out');
  if (hit.includes(behind.uid)) F.push('the sweep reached a second column');
  console.log('Crossing sweep covers', hit.length, 'cells across three lanes');
}

// --- Crossing Cut slides toward the heavier side, then cuts ---
{
  start();
  const u = spawnUnit('ashura', 2, 3);
  spawnFoe('crawler', 3, 4, 30);                   // one below
  spawnFoe('crawler', 3, 5, 30);                   // and another behind it
  A.useAbility(u);
  if (u.lane !== 3) F.push(`Crossing Cut did not slide toward the pressure (lane ${u.lane + 1})`);
  if (u.cd <= 0) F.push('Crossing Cut did not go on cooldown');
  const front = A.G.enemies.find(e => e.lane === 3 && e.col === 4);
  if (!front || front.hp >= 30) F.push('Crossing Cut landed no damage after sliding');
}

// --- it does not slide into an occupied cell ---
{
  start();
  const u = spawnUnit('ashura', 2, 3);
  spawnUnit('wall', 3, 3);
  spawnUnit('wall', 1, 3);
  spawnFoe('crawler', 3, 4, 30);
  A.useAbility(u);
  if (u.lane !== 2) F.push('Crossing Cut slid onto an occupied cell');
}

// --- the Oni crosses toward the thin lane on its own ---
{
  start();
  spawnUnit('marks', 2, 1);                        // lane 3 is defended
  const e = spawnFoe('oni', 2, 5);
  A.enemyPhase();
  if (e.lane === 2) F.push('the Oni walked into the gun rather than around it');
  console.log('Oni crossed from lane 3 into lane', e.lane + 1);
}

// --- but it holds a lane once that lane is the thinnest one ---
{
  start();
  spawnUnit('marks', 0, 1);
  spawnUnit('marks', 1, 1);
  spawnUnit('marks', 3, 1);
  spawnUnit('marks', 4, 1);
  const e = spawnFoe('oni', 2, 5);                 // already in the soft lane
  A.enemyPhase();
  if (e.lane !== 2) F.push('the Oni left the softest lane it was already in');
  if (e.col !== 4) F.push(`the Oni stalled instead of advancing (col ${e.col})`);
}

// --- it still fights what is directly in front of it ---
{
  start();
  const u = spawnUnit('wall', 2, 4);
  const e = spawnFoe('oni', 2, 5);
  const hp = u.hp;
  A.enemyPhase();
  if (e.lane !== 2) F.push('the Oni sidestepped a unit it should have hit');
  if (u.hp >= hp) F.push('the Oni did not attack the blocker in front of it');
}

// --- it joins the horde late, at Specialist weight ---
{
  start();
  A.G.waves = 12;
  let seen = false;
  for (let t = 5; t <= 9 && !seen; t++) {
    for (let i = 0; i < 200 && !seen; i++) {
      A.G.turn = t;
      if ((A.wave(t) || {}).oni) seen = true;
    }
  }
  if (!seen) F.push('the Oni never appears in any wave');
  const early = [];
  for (let i = 0; i < 300; i++) { A.G.turn = 3; if ((A.wave(3) || {}).oni) early.push(1); }
  if (early.length) F.push('the Oni turns up before wave 5');
}

F.report('Ashura and Oni: the board has a vertical axis and both frames use it');
