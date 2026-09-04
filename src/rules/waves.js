// Wave composition and the spawn-marker contract.
//
// THE CONTRACT: the chevrons drawn on the enemy edge promise which lane each
// hostile ENTERS next turn. Markers are computed BEFORE the player's turn and
// consumed AFTER it, unchanged. A hostile never diverts on the way in — if its
// lane is genuinely full it holds at the edge and arrives next turn in the same
// lane. Players shape the horde by shaping lane scores, so quietly re-rolling a
// lane at spawn time would make the whole preview a lie.
//
// What a body does once it is ON the board is a separate question and not part
// of this promise: it will step into another lane when its own road is shut,
// and an Oni Frame will do it by choice (see flankStep/seekFlank in phases.js).
// The marker said where it comes in, never where it stays.

import {LANES, COLS} from '../state/constants.js';
import {BEST} from '../content/hostiles.js';
import {OPS} from '../content/operations.js';
import {DOCTRINE} from '../content/doctrines.js';
import {G} from '../state/session.js';
import {randInt} from '../state/rng.js';

/**
 * Threat budget for wave `t`, spent down on hostile types drawn from a pool
 * that widens as the mission goes on.
 */
export function wave(t) {
  if (t > G.waves) return null;
  // A boss is excluded from the wave threat budget in both directions: the
  // hive sends nothing, and everything on the board is the boss's own work.
  if (G.type === 'boss') return {};
  // Dead Air: the tunnels are silent — the manifest this event promised on
  // is empty. Rolled AFTER eventTick(), so G.event is this turn's event.
  if (G.event === 'calm') return {};

  // Hot operations (op-level `heat`) run every wave over budget, and a Hive
  // Surge event runs this one wave heavier still.
  //
  // The ramp is 1.3 a wave, down from 1.5. The Last-Stand grid used to be
  // issued free — five charges, one a lane, each cancelling a breach AND
  // sweeping the lane — and the wave budget was tuned against that safety
  // net. With the grid bought a lane at a time (Last-Stand Protocol) the net
  // is gone unless you pay for it, so the volume of bodies comes down to meet
  // it. Measured on the balance bot: the net's removal alone took the win
  // rate from 68% to 42%; this puts it back at 50%.
  let budget = Math.round(2 + (G.heat || 0) + (G.event === 'surge' ? 2 : 0)
    + t * (G.endless ? 1.9 : 1.3));
  const pool = ['crawler'];
  if (t >= 2) pool.push('hulk', 'breacher', 'husk');
  if (t >= 3) pool.push('spitter', 'burrower');
  if (t >= 4 || G.mod === 'nest') pool.push('spore', 'jammer', 'pylon', 'mender');
  if (t >= 5) pool.push('harrower', 'puppeteer', 'oni');
  if (t >= 6) pool.push('screamer');
  if ((t >= G.waves || (G.endless && t >= 7)) && G.type !== 'extract') pool.push('chorus', 'sovereign');
  // An operation can flavor its waves (Shallowhelm's congregation): its named
  // hostiles join the pool from the first wave, weighted by repetition.
  const flavor = G.op && OPS[G.op] && OPS[G.op].foes;
  if (flavor) pool.push(...flavor);
  // The wider bestiary dilutes the quota type; three extra entries keep the
  // Acquire Specimens target showing up often enough to be acquirable.
  if (G.type === 'specimens' && G.quotaK) pool.push(G.quotaK, G.quotaK, G.quotaK);

  const out = {};
  let guard = 0;
  let specials = 0;
  while (budget > 0 && guard++ < 60) {
    // At most one Specialist per wave, or the budget vanishes into a Sovereign.
    const afford = pool.filter(k => BEST[k].threat <= budget && (BEST[k].t !== 'special' || specials < 1));
    if (!afford.length) break;
    const k = afford[randInt(afford.length)];
    if (BEST[k].t === 'special') specials++;
    out[k] = (out[k] || 0) + 1;
    budget -= BEST[k].threat;
  }
  if (G.mod === 'swarm' && out.crawler) out.crawler *= 2;
  return out;
}

/**
 * How well defended a lane looks from the hostile side. Damage dominates,
 * hull barely registers, and a blocker is worth a flat premium — a wall the
 * horde has to chew through is worse for it than a gun it can outrun.
 */
export function laneScore(l) {
  let s = 0;
  G.units.forEach(u => {
    if (u.lane === l) s += (u.dmg || 0) * 1.6 + u.hp * 0.12 + (u.blocker ? 3 : 0);
    // A visible minefield reads as a defended lane — that steering is the
    // card's whole point, so it weighs in like a serious gun would.
    if (u.lane === l && u.mine) s += u.mine * 0.7;
  });
  for (let c = 0; c < COLS; c++) if (G.ter[l][c] === 'p') s += 0.4;
  return s;
}

/** Pick this wave's doctrine, weighted. */
export function rollDoctrine() {
  const total = DOCTRINE.reduce((a, d) => a + d.w, 0);
  let r = Math.random() * total;
  for (const d of DOCTRINE) if ((r -= d.w) < 0) return d.k;
  return 'probe';
}

/**
 * Assign every hostile in the pending manifest to a lane and publish the
 * result as `G.predict`. This is the promise the markers make.
 */
export function predictSpawns() {
  G.predict = [];
  if (!G.manifest) return;

  const open = [...Array(LANES).keys()].filter(l => G.ter[l][0] !== 'x');
  if (!open.length) return;
  G.doctrine = G.doctrine || 'probe';

  const scored = open.map(l => ({l, v: laneScore(l)})).sort((a, b) => a.v - b.v);
  const list = [];
  for (const k in G.manifest) for (let i = 0; i < G.manifest[k]; i++) list.push(k);

  const load = {};
  list.forEach((k, idx) => {
    let lane;
    if (G.doctrine === 'focus') {
      // Hammer the two softest lanes.
      lane = scored[idx % Math.min(2, scored.length)].l;
    } else if (G.doctrine === 'spread') {
      // One per lane, cycling, softest first.
      lane = scored[idx % scored.length].l;
    } else {
      // Weakest lane, but each arrival makes it less attractive.
      lane = open.map(l => ({l, v: laneScore(l) + (load[l] || 0) * 1.35}))
        .sort((a, b) => a.v - b.v)[0].l;
    }
    load[lane] = (load[lane] || 0) + 1;
    G.predict.push({lane, k});
  });
}
