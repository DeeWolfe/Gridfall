// Who a unit can hit, and who it will actually hit.
//
// Three layers, deliberately separate:
//   geomFor()       every hostile inside the card's firing geometry
//   candidatesFor() the choices a player may lock onto (single-target only)
//   targetsFor()    what fire() will strike this instant
//
// Multi-target cards hit their whole geometry and offer no choice at all;
// single-target cards resolve to one, honouring a manual lock if it is still
// standing and falling back to the first candidate if it is not.

import {COLS} from '../state/constants.js';
import {BEST} from '../content/hostiles.js';
import {G} from '../state/session.js';
import {unitAt} from './board.js';

/** A Jammer anywhere in the lane shuts off all indirect fire in it. */
export const laneJammed = l => G.enemies.some(e => e.lane === l && BEST[e.k].jam);

/** Armour floor for this hostile: its own, plus any Bulwark Pylon in its lane. */
export function laneFloor(e) {
  let f = BEST[e.k].floor || 0;
  G.enemies.forEach(o => { if (BEST[o.k].lanefloor && o.lane === e.lane) f += BEST[o.k].lanefloor; });
  return f;
}

/**
 * Hostiles ahead of `u` in lane `L`, nearest first. Direct fire stops at the
 * first friendly blocker — your own wall cuts your own beam.
 */
export function laneAhead(u, L) {
  const front = u.col + u.size - 1;
  let list = G.enemies.filter(e => e.lane === L && e.col > front).sort((a, b) => a.col - b.col);
  if (!u.indirect) {
    let limit = COLS;
    for (let c = front + 1; c < COLS; c++) {
      const f = unitAt(L, c);
      if (f && f.blocker && f.uid !== u.uid) { limit = c; break; }
    }
    list = list.filter(e => e.col < limit);
  }
  return list;
}

/**
 * Hostiles BEHIND `u` in lane `L` — anything that already slipped past the
 * line — nearest first. The mirror of laneAhead in every respect, blockers
 * included: your own wall cuts your own beam going backwards too.
 */
export function laneBehind(u, L) {
  let list = G.enemies.filter(e => e.lane === L && e.col < u.col).sort((a, b) => b.col - a.col);
  if (!u.indirect) {
    let limit = -1;
    for (let c = u.col - 1; c >= 0; c--) {
      const f = unitAt(L, c);
      if (f && f.blocker && f.uid !== u.uid) { limit = c; break; }
    }
    list = list.filter(e => e.col > limit);
  }
  return list;
}

/** Every hostile inside this unit's firing geometry right now. */
export function geomFor(u) {
  if (u.tg === 'none' || !u.dmg || u.stun) return [];
  if (u.cycling > 0) return [];                  // a recharge weapon mid-cycle
  if (u.indirect && laneJammed(u.lane)) return [];

  const base = geomBase(u);
  // Rear Sights (gear) bolts the cell directly behind onto whatever the card
  // already covers, so a forward-facing weapon stops being flankable. Added
  // here rather than inside the switch so it composes with every pattern.
  if (!u.rearsight) return base;
  const behind = G.enemies.filter(e => e.lane === u.lane && e.col === u.col - 1);
  if (!behind.length) return base;
  const seen = new Set(base.map(e => e.uid));
  return base.concat(behind.filter(e => !seen.has(e.uid)));
}

/** The card's own printed firing pattern, before any gear rider. */
function geomBase(u) {
  const front = u.col + u.size - 1;
  const L = u.lane;

  // Board-wide targeting: the hostile deepest into any lane, ignoring lanes
  // and blockers alike. The answer to a Chorus dug in behind the horde.
  if (u.tg === 'boardFurthest') {
    if (!G.enemies.length) return [];
    return [[...G.enemies].sort((a, b) => b.col - a.col || a.uid - b.uid)[0]];
  }

  const inLane = laneAhead(u, L);
  switch (u.tg) {
    case 'adj': return inLane.filter(e => e.col === front + 1);
    case 'first': return inLane.slice(0, 1);
    case 'furthest': return inLane.slice(-1);
    // Turn around: the nearest thing that already got past this unit.
    case 'rear': return laneBehind(u, L).slice(0, 1);
    case 'lane': return inLane;
    case 'ahead2': return inLane.filter(e => e.col <= front + 2);
    case 'ahead3': return inLane.filter(e => e.col <= front + 3);
    case 'range2':
      return G.enemies.filter(e => e.lane === L && e.col === front + 2);
    case 'range3':
      // Direct fire at a fixed range: a blocker of yours in between cuts it.
      return G.enemies.filter(e => e.lane === L && e.col === front + 3 &&
        !G.units.some(f => f.blocker && f.uid !== u.uid && f.lane === L && f.col > front && f.col < front + 3));
    case 'blast4': {
      const centre = front + 4;
      return G.enemies.filter(e => Math.abs(e.lane - L) <= 1 && Math.abs(e.col - centre) <= 1);
    }
    case 'around':
      return G.enemies.filter(e => Math.abs(e.lane - L) <= 1 && Math.abs(e.col - u.col) <= 1 &&
        !(e.lane === L && e.col === u.col));
    case 'bothsides':
      return G.enemies.filter(e => e.lane === L && (e.col === front + 1 || e.col === u.col - 1));
    case 'diag':
      return G.enemies.filter(e => Math.abs(e.lane - L) === 1 && Math.abs(e.col - u.col) === 1);
    case 'vert3': {
      const cc = front + 1;
      return G.enemies.filter(e => e.col === cc && Math.abs(e.lane - L) <= 1);
    }
    case 'adj4':
      return G.enemies.filter(e => Math.abs(e.lane - L) + Math.abs(e.col - u.col) === 1);
    case 'archer': {
      // Two straight ahead plus both rear diagonals — covers its own flanks.
      const cells = [[L, front + 1], [L, front + 2], [L - 1, u.col - 1], [L + 1, u.col - 1]];
      return G.enemies.filter(e => cells.some(([cl, cc]) => e.lane === cl && e.col === cc));
    }
    default: return [];
  }
}

/** Targets the player may choose between. Empty for multi-target cards. */
export const candidatesFor = u => (u.single ? geomFor(u) : []);

/** What this unit strikes if it fires now. */
export function targetsFor(u) {
  const g = geomFor(u);
  if (!u.single) return g;
  if (!g.length) return [];
  const locked = g.find(e => e.uid === u.tgt);
  return [locked || g[0]];
}
