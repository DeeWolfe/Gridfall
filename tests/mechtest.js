// The two war frames: the Ashura you deploy and the Oni that answers it.
//
// They were built as a matched pair around the board's vertical axis. The Oni
// still crosses lanes by choice toward the thinnest line; the Ashura became a
// fist frame in v2.31 (one hostile at contact, Fatal Fury for four blows), so
// its half of this file guards that, and the Oni's half is unchanged.
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
    if (k.tg !== 'adj' || !k.single) F.push('the frame should punch one hostile at contact');
    if (k.ab.n !== 'Fatal Fury') F.push('the frame\'s ability is not Fatal Fury');
    if (!k.ab) F.push('the frame has no ability');
    if (!k.blocker) F.push('a sixteen-hull frame that does not block a lane');
  }
  const o = A.BEST.oni;
  if (!o) F.push('Oni Frame is not in the bestiary');
  else if (!o.flank) F.push('the Oni carries no flank flag — it is just a Harrower');
}

// --- the fists strike the one cell at contact ---
{
  start();
  const u = spawnUnit('ashura', 2, 3);
  const mid = spawnFoe('crawler', 2, 4);
  const up = spawnFoe('crawler', 1, 4);
  const far = spawnFoe('crawler', 2, 5);
  const hit = A.targetsFor(u).map(e => e.uid);
  if (!hit.includes(mid.uid)) F.push('the fists missed the hostile at contact');
  if (hit.includes(up.uid) || hit.includes(far.uid)) F.push('the fists reached past contact');
}

// --- Fatal Fury: four blows on the hostile ahead, and nothing without one ---
{
  start();
  const u = spawnUnit('ashura', 2, 3);
  const t = spawnFoe('crawler', 2, 4, 30);
  A.useAbility(u);
  if (30 - t.hp !== 8) F.push(`Fatal Fury dealt ${30 - t.hp}, wanted 4 x 2`);
  if (u.cd <= 0) F.push('Fatal Fury did not go on cooldown');
  if (u.lane !== 2) F.push('the frame moved on its ability');
  start();
  const u2 = spawnUnit('ashura', 2, 3);
  const off = spawnFoe('crawler', 3, 4, 30);
  A.useAbility(u2);
  if (off.hp !== 30) F.push('Fatal Fury struck a hostile that was not at contact');
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
