// Wave composition and the spawn-marker contract.
//
// THE CONTRACT: the chevrons drawn on the enemy edge promise which lane each
// hostile enters next turn. Markers are computed BEFORE the player's turn and
// consumed AFTER it, unchanged. A hostile never diverts to a different lane —
// if its lane is genuinely full it holds at the edge and arrives next turn in
// the same lane. Players shape the horde by shaping lane scores, so quietly
// re-rolling a lane at spawn time would make the whole preview a lie.

import {LANES, COLS} from '../state/constants.js';
import {BEST} from '../content/hostiles.js';
import {DOCTRINE} from '../content/doctrines.js';
import {G} from '../state/session.js';
import {randInt} from '../state/rng.js';

/**
 * Threat budget for wave `t`, spent down on hostile types drawn from a pool
 * that widens as the mission goes on.
 */
export function wave(t) {
  if (t > G.waves) return null;

  let budget = Math.round(2 + t * (G.endless ? 1.9 : 1.5));
  const pool = ['crawler'];
  if (t >= 2) pool.push('hulk', 'breacher');
  if (t >= 3) pool.push('spitter', 'burrower');
  if (t >= 4 || G.mod === 'nest') pool.push('spore', 'jammer', 'pylon');
  if (t >= 5) pool.push('harrower');
  if ((t >= G.waves || (G.endless && t >= 7)) && G.type !== 'extract') pool.push('chorus', 'sovereign');
  if (G.type === 'specimens' && G.quotaK) pool.push(G.quotaK, G.quotaK);

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
