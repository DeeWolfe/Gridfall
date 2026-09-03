// Breaching Charge: sweeps one column, killing everything at or below the
// hull threshold, sparing everything above it, blockers no protection.
//
// It is the one stratagem on the SHORT beat — it lands at the end of the turn
// you call it, after the horde has moved, rather than at the start of the next.
// A full turn of delay was long enough for the column you aimed at to empty
// itself, which made the call close to unusable.
import * as A from './support/api.js';
import {failures} from './support/harness.js';
import {spawnUnit, spawnFoe, clearBoard, unlockAll, stillAir} from './support/fixtures.js';

const F = failures();

const start = () => {
  const p = unlockAll(A.blankProfile('BR'), ['rifle', 'marks', 'wall', 'medic']);
  A.enterProfile(p);
  A.launchSpec({node: null, type: 'stronghold', mod: 'none', reward: 0});
  stillAir();
  clearBoard();
};

/** Play the call card at (l, c) — the card path, hand and points included. */
const play = (cid, l, c) => {
  if (!A.G.hand.includes(cid)) A.G.hand.push(cid);
  A.G.dp = 30;
  A.deploy(cid, l, c);
};

// A: kills at or below the threshold, spares above, leaves other columns alone
{
  start();
  const weak = spawnFoe('crawler', 1, 5, A.BREACH_HULL);       // exactly at it
  const tough = spawnFoe('hulk', 2, 5, A.BREACH_HULL + 1);     // just over
  const bystander = spawnFoe('crawler', 3, 6, 3);              // other column
  const kills = A.G.kills;
  play('breach', 0, 5);
  A.resolveStratagemEnd();
  if (A.G.enemies.some(e => e.uid === weak.uid)) F.push('at-threshold hostile survived');
  if (!A.G.enemies.some(e => e.uid === tough.uid)) F.push('over-threshold hostile died');
  if (!A.G.enemies.some(e => e.uid === bystander.uid)) F.push('the charge leaked into another column');
  if (A.G.kills !== kills + 1) F.push('kill not recorded');
}

// B: blockers are no protection — the charge reaches behind your own wall
{
  start();
  spawnUnit('wall', 2, 3);                         // friendly blocker in the lane
  const dugIn = spawnFoe('spitter', 2, 6, 5);
  play('breach', 0, 6);
  A.resolveStratagemEnd();
  if (A.G.enemies.length) F.push('a blocker shielded the target from the charge');
}

// C: armour floors do not blunt it — the kill is outright
{
  start();
  // A hulk reduces incoming damage by 1, but a wounded one still dies.
  const wounded = spawnFoe('hulk', 0, 4, 6);
  play('breach', 0, 4);
  A.resolveStratagemEnd();
  if (A.G.enemies.length) F.push('armour floor blunted the breaching charge');
}

// D: the short beat — it fires at the END of its own turn, not the start of
// the next, and the start-of-turn tick must not fire it a second time.
{
  start();
  const doomed = spawnFoe('crawler', 1, 5, 3);
  play('breach', 0, 5);
  if (!A.G.enemies.some(e => e.uid === doomed.uid)) F.push('the charge fired the instant it was called');
  A.resolveStratagem();                            // the long beat: not its beat
  if (!A.G.enemies.some(e => e.uid === doomed.uid)) F.push('the charge fired on the start-of-turn tick');
  if (!A.G.calls.length) F.push('the start-of-turn tick disarmed a call it did not fire');
  A.resolveStratagemEnd();
  if (A.G.enemies.some(e => e.uid === doomed.uid)) F.push('the charge did not land at the end of the turn');
  if (A.G.calls.length) F.push('the call stayed armed after it landed');
  A.resolveStratagemEnd();                         // must be inert now
}

// E: a whole turn cycle lands it exactly once — and it is still a prediction.
// The charge fires AFTER the horde moves, so you aim at where a body will be,
// not where it is. A speed-2 Crawler standing on column 4 is on column 2 by the
// time the charge lands, and aiming at 4 hits nothing.
{
  start();
  const doomed = spawnFoe('crawler', 1, 4, 3);
  const kills = A.G.kills;
  play('breach', 0, 2);                       // two cells ahead of it
  A.endTurn();
  if (A.G.enemies.some(e => e.uid === doomed.uid)) F.push('the charge missed the cell it walked into');
  if (A.G.kills !== kills + 1) F.push(`the charge was counted ${A.G.kills - kills} times`);
  if (A.G.calls.length) F.push('a call survived the turn that fired it');
}

// F: aiming where it stands, rather than where it is going, hits nothing
{
  start();
  const walker = spawnFoe('crawler', 1, 4, 3);
  play('breach', 0, 4);
  A.endTurn();
  if (!A.G.enemies.some(e => e.uid === walker.uid)) {
    F.push('the charge hit a cell the target had already left — the beat is gone');
  }
}

F.report('breaching charge: lands at the end of its own turn, exactly once');
