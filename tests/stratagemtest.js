// Command calls: the old lead stratagems, deck cards now.
//
// What must stay true across the conversion:
//   - a call is a tech CARD: bought, drawn, held, billed through costOf;
//   - playing one arms it — nothing resolves on the tap (the prediction beat);
//   - long-beat calls fire at the START of the next turn, the demolition
//     pair at the END of the turn they are played;
//   - several calls can be in the air at once, each on its own beat;
//   - the armed calls telegraph on the board;
//   - no team lead carries a stratagem any more.
import * as A from './support/api.js';
import {failures} from './support/harness.js';
import {spawnUnit, spawnFoe, clearBoard, unlockAll, stillAir} from './support/fixtures.js';

const F = failures();

const start = () => {
  const p = unlockAll(A.blankProfile('ST'),
    ['rifle', 'marks', 'wall', 'duel', 'grapple', 'breach', 'requisition']);
  A.enterProfile(p);
  A.launchSpec({node: null, type: 'stronghold', mod: 'none', reward: 0});
  stillAir();
  clearBoard();
  A.G.predict = [];
  A.G.held = [];
  A.G.dp = 30;
};
/** Play a call card at (l, c), pushing it into hand first. */
const play = (cid, l, c) => {
  if (!A.G.hand.includes(cid)) A.G.hand.push(cid);
  A.deploy(cid, l, c);
};

// --- the shape: seven tech cards, and no lead carries a call ---
{
  const CALLS = Object.keys(A.POOL).filter(c => A.POOL[c].strat);
  if (CALLS.length !== 7) F.push(`expected 7 call cards, found ${CALLS.length}`);
  CALLS.forEach(c => {
    if (A.POOL[c].t !== 'tech') F.push(`${c} is not a tech card`);
    if (!A.STRATAGEMS[A.POOL[c].strat]) F.push(`${c} names a call that does not exist`);
  });
  Object.keys(A.LEADS).forEach(k => {
    if (A.LEADS[k].stratagem) F.push(`${k} still carries a stratagem`);
  });
  console.log('shape: 7 call cards, tech tier, no lead carries one');
}

// --- a call is billed and consumed like a card, and arms rather than fires ---
{
  start();
  const foe = spawnFoe('crawler', 2, 5, 30);
  const dpBefore = A.G.dp;
  play('grapple', 2, 0);
  if (A.G.dp !== dpBefore - A.costOf('grapple')) F.push('the call did not bill its points');
  if (A.G.hand.includes('grapple')) F.push('the call card was not consumed');
  if (foe.col !== 5) F.push('grapple fired on the tap instead of arming');
  if (A.G.calls.length !== 1) F.push('nothing armed');
  if (!A.stratMarkers().length) F.push('an armed call paints no telegraph');
  A.resolveStratagem();
  if (foe.col !== 7) F.push(`grapple did not land on the long beat (col ${foe.col})`);
  if (A.G.calls.length) F.push('a fired call stayed armed');
  console.log('arm-then-fire: billed, consumed, telegraphed, landed on the long beat');
}

// --- the demolition pair takes the short beat, and only the short beat ---
{
  start();
  const low = spawnFoe('crawler', 1, 4, A.BREACH_HULL);
  const high = spawnFoe('hulk', 3, 4, A.BREACH_HULL + 1);
  play('breach', 0, 4);
  A.resolveStratagem();
  if (!A.G.enemies.some(e => e.uid === low.uid)) F.push('breach fired on the LONG beat');
  A.resolveStratagemEnd();
  if (A.G.enemies.some(e => e.uid === low.uid)) F.push('breach spared a hostile at the threshold');
  if (!A.G.enemies.some(e => e.uid === high.uid)) F.push('breach killed above the threshold');
  console.log('breaching charge: end-of-turn beat, threshold honest');
}

// --- Enfilade Charge: the same demolition, along a lane ---
{
  start();
  const inLane = spawnFoe('crawler', 2, 1, 5);
  const inLane2 = spawnFoe('crawler', 2, 7, 5);
  const tough = spawnFoe('hulk', 2, 4, A.BREACH_HULL + 4);
  const other = spawnFoe('crawler', 3, 4, 5);
  play('enfilade', 2, 6);
  A.resolveStratagemEnd();
  if (A.G.enemies.some(e => e.uid === inLane.uid || e.uid === inLane2.uid)) {
    F.push('enfilade left the lane standing');
  }
  if (!A.G.enemies.some(e => e.uid === tough.uid)) F.push('enfilade killed above the threshold');
  if (!A.G.enemies.some(e => e.uid === other.uid)) F.push('enfilade crossed lanes');
  console.log('enfilade charge: the whole lane swept, threshold and lanes honest');
}

// --- two calls in the air at once, each on its own beat ---
{
  start();
  const dragged = spawnFoe('crawler', 1, 4, 30);
  const swept = spawnFoe('crawler', 3, 6, 5);
  play('grapple', 1, 0);
  play('breach', 0, 6);
  if (A.G.calls.length !== 2) F.push('two calls did not queue');
  A.resolveStratagemEnd();
  if (A.G.enemies.some(e => e.uid === swept.uid)) F.push('queued breach missed its beat');
  if (dragged.col !== 4) F.push('the short beat fired the long-beat call');
  A.resolveStratagem();
  if (dragged.col !== 6) F.push('queued grapple missed its beat');
  console.log('two calls queued: each fired on its own beat');
}

// --- Duel Protocol: card on a friendly; +4, untouchable, expires ---
{
  start();
  const u = spawnUnit('rifle', 2, 1);
  const tiles = A.validTiles('duel');
  if (!tiles.includes(2 * A.COLS + 1)) F.push('duel does not offer the friendly');
  if (tiles.length !== 1) F.push('duel offered ground with no one on it');
  play('duel', 2, 1);
  if (u.dueled) F.push('duel marked the unit before its beat');
  A.resolveStratagem();
  if (!u.dueled) F.push('duel never landed');
  if (A.dmgPreview(u) !== A.POOL.rifle.dmg + 4) F.push('duel bonus wrong: ' + A.dmgPreview(u));
  A.dmgUnit(u, 5, 'test');
  if (u.hp !== u.max) F.push('the duelist took damage while protected');
  A.resolveStratagem();
  if (u.dueled) F.push('the duel never expired');
  console.log('duel protocol: aimed at a unit, +4 and untouchable for exactly one turn');
}

// --- Emergency Requisition through a full turn: +4 lands with the new points ---
{
  start();
  play('requisition', 2, 0);
  A.G.enemies.length = 0; A.G.predict = []; A.G.held = [];
  A.endTurn();
  if (A.G.dp !== A.MAXDP + 4) F.push('requisition paid ' + (A.G.dp - A.MAXDP) + ', expected 4');
  console.log('requisition: +4 riding in with the next turn\'s points');
}

F.report('command calls: cards now, and every beat of the old contract holds');
