// A deliberately unsophisticated bot, shared by the three balance harnesses.
//
// It plays affordable cards onto random legal tiles and, on ground-objective
// missions, nudges mobile units forward. It never plans, never repositions
// defensively and never uses manual targeting — so every win rate it produces
// is a FLOOR, not a measurement of how the game plays in human hands.

import * as A from './api.js';

const PLAYS_PER_TURN = 6;

/**
 * The Frame line, for the harness that measures it. Off by default, because
 * the other balance harnesses run STARTER decks that carry neither a Pilot nor
 * a Frame and would only pay for the checks.
 *
 * This is the one place the bot is allowed to be less stupid than everywhere
 * else, and the reason is that without it the class is unmeasurable rather than
 * merely badly played: a Frame costs a whole turn's points and the greedy
 * "first affordable card in hand" rule would spend them on a Barricade every
 * single turn, so the Frame would never once reach the board and the harness
 * would report that Frames do nothing. Two rules, both of which any player
 * works out in one mission:
 *
 *   1. A Pilot goes down as early as possible, in the safest cell available —
 *      the rearmost column, because a Pilot dies to the first thing that
 *      reaches it.
 *   2. On a turn where a Pilot is standing and the points are there, the Frame
 *      goes down BEFORE anything else, because nothing else can go down after.
 *
 * Read every Frame number this produces with that asymmetry in mind: the Frame
 * arm is played to a plan, the control arm is not.
 */
function playFrameLine() {
  // The Frame sits seeded in the hand from turn one. On a turn where the
  // points are there, it goes down BEFORE anything else — the greedy loop
  // below would spend the turn on Barricades and the machine would never fly.
  const proto = A.frameReady();
  if (!proto || A.costOf(proto) > A.G.dp) return;
  const tiles = A.validTiles(proto);
  if (!tiles.length) return;
  const tile = tiles[A.randInt(tiles.length)];
  A.deploy(proto, (tile / A.COLS) | 0, tile % A.COLS);
}

/** Play cards until the deploy points or the legal tiles run out. */
function spendPoints(frames) {
  if (frames) playFrameLine();
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
export function playOut({maxTurns = 40, advance = false, frames = false} = {}) {
  let guard = 0;
  let framed = false;                    // did the machine ever reach the board
  while (A.G && !A.G.over && guard++ < maxTurns) {
    spendPoints(frames);
    if (frames && !framed && !A.frameReady() && A.G.frame) framed = true;
    if (advance && A.G && (A.G.type === 'retake' || A.G.type === 'crystals' ||
      A.G.type === 'uplink' || A.G.type === 'boss')) pushForward();
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
    // Whether the Frame slot was ever actually spent. A Frame that lands in a
    // third of missions is a different card from one that lands in all of them,
    // and the win rate alone cannot tell the two apart.
    framed,
  };
}
