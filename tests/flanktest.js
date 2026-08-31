// Hostiles going sideways.
//
// A lane the horde cannot walk down used to be a lane the horde stood in. A
// bombardment crater — permanent 'x' terrain — parked whatever was behind it
// for the rest of the mission, and a slow body plugged a lane for everything
// queued up behind it. Both now step into an open lane instead.
//
// What must NOT change is everything the sidestep is easy to break:
//   - a player's unit in front is a fight, never a wall to walk round;
//   - a hostile with a shot to take takes it rather than shuffling;
//   - the lane a hostile ARRIVES in is still exactly what the markers promised.
import * as A from './support/api.js';
import {failures} from './support/harness.js';
import {spawnUnit, spawnFoe, clearBoard, unlockAll, stillAir} from './support/fixtures.js';

const F = failures();

const start = () => {
  const p = unlockAll(A.blankProfile('FL'), ['rifle', 'marks', 'wall', 'medic']);
  A.enterProfile(p);
  A.launchSpec({node: null, type: 'stronghold', mod: 'none', reward: 0});
  stillAir();
  clearBoard();
  A.G.predict = [];
  A.G.held = [];
};

/** Crater the cell a hostile is about to walk into. */
const crater = (l, c) => { A.G.ter[l][c] = 'x'; };

// --- a crater reroutes rather than parks ---
{
  start();
  const e = spawnFoe('crawler', 2, 5);
  crater(2, 4);
  A.enemyPhase();
  if (e.lane === 2) F.push('a hostile stood in front of a crater instead of going round');
  if (Math.abs(e.lane - 2) !== 1) F.push(`it jumped ${Math.abs(e.lane - 2)} lanes, expected 1`);
  console.log('crawler routed around a crater into lane', e.lane + 1, 'col', e.col);
  // Speed 2: the sidestep costs one step, so it also gets a cell of advance.
  if (e.col !== 4) F.push(`a speed-2 hostile lost its tempo to the detour (col ${e.col})`);
}

// --- a slow hostile pays for the detour with its whole turn ---
{
  start();
  const e = spawnFoe('hulk', 2, 5);               // spd 0.5
  crater(2, 4);
  A.enemyPhase();
  A.enemyPhase();                                 // banks to one step
  if (e.lane === 2) F.push('a slow hostile never went round the crater');
  if (e.col !== 5) F.push(`a slow hostile advanced as well as sidestepped (col ${e.col})`);
}

// --- boxed in: no lane either side, so it does not teleport ---
{
  start();
  const e = spawnFoe('crawler', 2, 5);
  crater(2, 4);
  crater(1, 5);
  crater(3, 5);
  A.enemyPhase();
  if (e.lane !== 2 || e.col !== 5) F.push('a boxed-in hostile moved anyway');
}

// --- a unit in front is a fight, not a wall ---
{
  start();
  const u = spawnUnit('wall', 2, 4);
  const e = spawnFoe('crawler', 2, 5);
  const hp = u.hp;
  A.enemyPhase();
  if (e.lane !== 2) F.push('a hostile walked around a blocker instead of fighting it');
  if (u.hp >= hp) F.push('a blocked hostile did not attack');
}

// --- queued behind a friend, with a shot: it shoots ---
{
  start();
  const u = spawnUnit('rifle', 2, 1);
  spawnFoe('hulk', 2, 4, 99);                      // the plug
  const e = spawnFoe('crawler', 2, 5);
  const hp = u.hp;
  A.enemyPhase();
  if (e.lane !== 2) F.push('a queued hostile with a target sidestepped instead of firing');
  if (u.hp >= hp) F.push('a queued hostile stopped firing past the body in front of it');
}

// --- queued with nothing to shoot: it goes round ---
{
  start();
  spawnFoe('hulk', 2, 4, 99);
  const e = spawnFoe('crawler', 2, 5);
  A.enemyPhase();
  if (e.lane === 2) F.push('a queued hostile with no target stayed stuck in traffic');
}

// --- emplacements are placed, not driven ---
{
  start();
  const e = spawnFoe('spore', 2, 5);               // spd 0
  crater(2, 4);
  A.enemyPhase();
  if (e.lane !== 2) F.push('an immobile emplacement changed lanes');
}

// --- a tunneller has nothing to dodge ---
{
  start();
  const u = spawnUnit('wall', 2, 4);
  const e = spawnFoe('harrower', 2, 5);            // tunnel: 1
  A.enemyPhase();
  if (e.lane !== 2) F.push('a tunneller sidestepped a blocker it can walk through');
  if (!A.G.units.length && e.col === 5) F.push('the tunneller neither passed nor fought');
  console.log('harrower tunnelled to col', e.col, 'lane', e.lane + 1, '- blocker hull', u.hp);
}

// --- it walks toward the softer lane, not away from it ---
{
  start();
  spawnUnit('marks', 1, 1);                        // a gun makes lane 2 unattractive
  const e = spawnFoe('crawler', 2, 5);
  crater(2, 4);
  A.enemyPhase();
  if (e.lane !== 3) F.push(`it broke into the defended lane (went to ${e.lane + 1})`);
}

// --- and it prefers a lane it can keep walking down ---
{
  start();
  const e = spawnFoe('crawler', 2, 5);
  crater(2, 4);
  crater(1, 4);                                    // lane 2 is a dead end too
  A.enemyPhase();
  if (e.lane !== 3) F.push(`it stepped into another dead end (lane ${e.lane + 1})`);
}

// --- the arrival promise is untouched: markers still mean what they say ---
{
  start();
  A.G.manifest = {crawler: 4};
  A.predictSpawns();
  const promised = A.G.predict.map(p => p.lane);
  if (!promised.length) F.push('nothing was predicted to check');
  A.spawnPhase();
  const landed = A.G.enemies.map(e => e.lane).sort();
  if (JSON.stringify(landed) !== JSON.stringify([...promised].sort())) {
    F.push(`arrivals diverged from the markers: promised ${promised} landed ${landed}`);
  }
  console.log('markers kept their promise:', promised.join(','));
}

F.report('hostiles reroute around dead ends without ever walking around a fight');
