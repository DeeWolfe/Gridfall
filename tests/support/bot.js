// A deliberately unsophisticated bot, shared by the three balance harnesses.
//
// It plays affordable cards onto random legal tiles and, on ground-objective
// missions, nudges mobile units forward. It never plans, never repositions
// defensively and never uses manual targeting — so every win rate it produces
// is a FLOOR, not a measurement of how the game plays in human hands.

import * as A from './api.js';

const PLAYS_PER_TURN = 6;

/** Play cards until the deploy points or the legal tiles run out. */
function spendPoints() {
  for (let n = 0; n < PLAYS_PER_TURN; n++) {
    const card = [...A.G.hand].find(x => A.costOf(x) <= A.G.dp);
    if (!card) break;
    const tiles = A.validTiles(card);
    if (!tiles.length) break;
    const tile = tiles[A.randInt(tiles.length)];
    A.deploy(card, (tile / A.COLS) | 0, tile % A.COLS);
  }
}

/** Retake Ground and Fight for Crystals need bodies pushed up the board. */
function pushForward() {
  A.G.units.filter(u => u.mob && !u.acted && !u.moved).forEach(u => {
    const ahead = A.moveTargets(u).filter(x => x % A.COLS > u.col);
    if (!ahead.length) return;
    const best = ahead.sort((a, b) => (a % A.COLS) - (b % A.COLS))[0];
    A.doMove(u, (best / A.COLS) | 0, best % A.COLS);
  });
}

/**
 * Play the mission in progress to its conclusion.
 * @returns {{over:boolean, won:boolean, turns:number, result:object|null}}
 */
export function playOut({maxTurns = 40, advance = false} = {}) {
  let guard = 0;
  while (A.G && !A.G.over && guard++ < maxTurns) {
    spendPoints();
    if (advance && A.G && (A.G.type === 'retake' || A.G.type === 'crystals' || A.G.type === 'uplink')) pushForward();
    A.endTurn();
  }
  const G = A.G;
  return {
    over: !!(G && G.over),
    won: !!(G && G.result && G.result.cleared),
    turns: G ? G.turn : 0,
    result: G ? G.result : null,
    breaches: G ? G.breaches : 0,
    held: G ? G.ter.flat().filter(t => t === 'p').length : 0,
    enemiesLeft: G ? G.enemies.length : 0,
    unitsLost: G ? G.lost : 0,
    kills: G ? G.kills : 0,
  };
}
