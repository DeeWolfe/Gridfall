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

import {COLS, LANES} from '../state/constants.js';
import {BEST} from '../content/hostiles.js';
import {G} from '../state/session.js';
import {unitAt} from './board.js';

/** A Jammer anywhere in the lane shuts off all indirect fire in it. */
export const laneJammed = l => G.enemies.some(e => e.lane === l && BEST[e.k].jam);

/** Armour floor for this hostile: its own, plus any Bulwark Pylon in its lane.
 * A Field Degausser in the lane strips the lot — innate plate and pylon alike. */
export function laneFloor(e) {
  if (G.units.some(o => o.degauss && o.lane === e.lane)) return 0;
  let f = BEST[e.k].floor || 0;
  G.enemies.forEach(o => { if (BEST[o.k].lanefloor && o.lane === e.lane) f += BEST[o.k].lanefloor; });
  return f;
}

/**
 * Hostiles ahead of `u` in lane `L`, nearest first. Direct fire stops at the
 * first friendly blocker — your own wall cuts your own beam. A Firing Step is
 * the one wall it does not: a parapet blocks the horde and not the guns.
 */
export function laneAhead(u, L) {
  const front = u.col + u.size - 1;
  let list = G.enemies.filter(e => e.lane === L && e.col > front).sort((a, b) => a.col - b.col);
  if (!u.indirect) {
    let limit = COLS;
    for (let c = front + 1; c < COLS; c++) {
      const f = unitAt(L, c);
      if (f && f.blocker && !f.parapet && f.uid !== u.uid) { limit = c; break; }
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
      if (f && f.blocker && !f.parapet && f.uid !== u.uid) { limit = c; break; }
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

  let base = geomBase(u);
  // An omni machine fights facing either way: the seeking weapons search the
  // lane behind as readily as ahead (both ends become candidates, ahead first
  // so the default strike is unchanged), and every fixed pattern is mirrored
  // through the machine's own cell — which geomCells already does, so the
  // pattern weapons just read their enemies out of their own lit ground.
  if (u.omni) {
    if (u.tg === 'first') {
      base = dedupeFoes(base.concat(laneBehind(u, u.lane).slice(0, 1)));
    } else if (u.tg === 'furthest') {
      base = dedupeFoes(base.concat(laneBehind(u, u.lane).slice(-1)));
    } else if (u.tg !== 'boardFurthest') {
      const cells = new Set(geomCells(u));
      base = G.enemies.filter(e => cells.has(e.lane * COLS + e.col));
    }
  }
  // Rear Sights (gear) bolts the cell directly behind onto whatever the card
  // already covers, so a forward-facing weapon stops being flankable. Added
  // here rather than inside the switch so it composes with every pattern.
  if (!u.rearsight) return base;
  const behind = G.enemies.filter(e => e.lane === u.lane && e.col === u.col - 1);
  if (!behind.length) return base;
  const seen = new Set(base.map(e => e.uid));
  return base.concat(behind.filter(e => !seen.has(e.uid)));
}

/** Concat without double-counting a body both lists found. */
function dedupeFoes(list) {
  const seen = new Set();
  return list.filter(e => e && !seen.has(e.uid) && seen.add(e.uid));
}

/** The card's own printed firing pattern, before any gear rider. */
function geomBase(u) {
  const front = u.col + u.size - 1;
  const L = u.lane;

  // Board-wide targeting: every hostile on the board is in reach, ignoring
  // lanes and blockers alike — the answer to a Chorus dug in behind the horde.
  // Deepest first, so a single-target weapon with no manual lock strikes the
  // furthest body by default while the player may lock onto ANY of them.
  if (u.tg === 'boardFurthest') {
    return [...G.enemies].sort((a, b) => b.col - a.col || a.uid - b.uid);
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
    // Recoilless Team: a dead zone at contact, then two cells of reach.
    case 'window': return inLane.filter(e => e.col === front + 2 || e.col === front + 3);
    case 'range2':
      return G.enemies.filter(e => e.lane === L && e.col === front + 2);
    case 'range3': {
      // Direct fire at a fixed range: a blocker of yours in between cuts it.
      //
      // The walk has to be footprint-aware. This compared anchor columns —
      // `f.col > front` — so a two-cell blocker anchored ON our own front cell
      // covered front+1 and was not counted, while geomCells (which walks
      // unitAt) counted it and dimmed the tile. The board therefore struck a
      // hostile from a cell it had never lit. geomtest caught it the moment
      // two-cell blockers became common enough to land in the way.
      for (let x = front + 1; x <= front + 2; x++) {
        const f = unitAt(L, x);
        if (f && f.blocker && !f.parapet && f.uid !== u.uid) return [];
      }
      return G.enemies.filter(e => e.lane === L && e.col === front + 3);
    }
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
    // Hyper Napalm: one cell at the mouth, three across behind it. The only
    // widening pattern in the game, and the only one that leaves the ground
    // burning after it lands (see `scorch` in units.js).
    case 'cone':
      return G.enemies.filter(e =>
        (e.lane === L && e.col === front + 1) ||
        (Math.abs(e.lane - L) <= 1 && e.col === front + 2));
    // A Laser Gatling fires past its own centre line: both forward diagonals,
    // two cells deep, and a hole where every other forward weapon in the game
    // puts its shot. The gap is the card, so nothing here quietly fills it in.
    case 'wings':
      return G.enemies.filter(e => Math.abs(e.lane - L) === 1 &&
        (e.col === front + 1 || e.col === front + 2));
    // One swing, the whole area in front: three lanes by two columns.
    case 'sweep':
      return G.enemies.filter(e => Math.abs(e.lane - L) <= 1 &&
        e.col >= front + 1 && e.col <= front + 2);
    // A cross of warheads centred three cells out — the centre and its four
    // orthogonal neighbours, so it reaches a lane either side without covering
    // the ground between.
    case 'cross3': {
      const cc = front + 3;
      return G.enemies.filter(e =>
        (e.lane === L && Math.abs(e.col - cc) <= 1) ||
        (Math.abs(e.lane - L) === 1 && e.col === cc));
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

/**
 * Every CELL this unit's weapon covers, occupied or not — the geometry itself
 * rather than what happens to be standing in it.
 *
 * geomFor() answers "what do I hit"; this answers "where do I reach", which is
 * what a player needs before anything walks into range. The board highlight and
 * the card's hitbox diagram both read this, so a diagram cannot disagree with
 * the board, and neither can disagree with geomFor() — the blocker and jam
 * rules below are the same ones, in the same order.
 *
 * `at` overrides the unit's own square, so the diagram can render a pattern
 * from a fixed origin without inventing a fake unit.
 *
 * @param {object} u
 * @param {{lane:number, col:number}} [at]
 * @returns {number[]} cell indices (lane * COLS + col)
 */
export function geomCells(u, at) {
  if (u.tg === 'none' || !u.dmg) return [];
  const L = at ? at.lane : u.lane;
  const col = at ? at.col : u.col;
  const front = col + (u.size || 1) - 1;
  // `at` means a hypothetical origin with no board behind it — the card's
  // printed pattern, drawn on a card screen where no mission is running. There
  // is nothing to be blocked by and nothing to be jammed by, and G may be null.
  const live = !at && G;
  if (live && u.indirect && laneJammed(L)) return [];

  const out = [];
  const add = (l, c) => {
    if (l >= 0 && l < LANES && c >= 0 && c < COLS) out.push(l * COLS + c);
  };
  /** True once a friendly blocker of ours stands between `front` and `c`. */
  const cutTo = c => {
    if (!live || u.indirect) return false;
    for (let x = front + 1; x <= c; x++) {
      const f = unitAt(L, x);
      if (f && f.blocker && !f.parapet && f.uid !== u.uid) return true;
    }
    return false;
  };
  /** Same walk, backwards — laneBehind() stops at our own wall too. */
  const cutBack = c => {
    if (!live || u.indirect) return false;
    for (let x = col - 1; x >= c; x--) {
      const f = unitAt(L, x);
      if (f && f.blocker && !f.parapet && f.uid !== u.uid) return true;
    }
    return false;
  };

  switch (u.tg) {
    // Board-wide: the whole grid is the search space.
    case 'boardFurthest':
      for (let l = 0; l < LANES; l++) for (let c = 0; c < COLS; c++) add(l, c);
      break;
    // Lane rays. `first` and `furthest` pick one body out of the same reach.
    case 'first': case 'furthest': case 'lane':
      for (let c = front + 1; c < COLS; c++) { if (cutTo(c)) break; add(L, c); }
      break;
    case 'rear':
      for (let c = col - 1; c >= 0; c--) { if (cutBack(c)) break; add(L, c); }
      break;
    case 'adj': add(L, front + 1); break;
    case 'ahead2':
      for (let d = 1; d <= 2; d++) { if (cutTo(front + d)) break; add(L, front + d); }
      break;
    case 'ahead3':
      for (let d = 1; d <= 3; d++) { if (cutTo(front + d)) break; add(L, front + d); }
      break;
    case 'window':
      for (let d = 2; d <= 3; d++) { if (cutTo(front + d)) break; add(L, front + d); }
      break;
    case 'range2': add(L, front + 2); break;
    // Only a blocker strictly BETWEEN us and the target cuts this — one
    // standing on the target square itself is not in the way. geomFor()
    // draws the line the same place; the invariant guard holds us to it.
    case 'range3': if (!cutTo(front + 2)) add(L, front + 3); break;
    case 'blast4':
      for (let l = L - 1; l <= L + 1; l++) for (let c = front + 3; c <= front + 5; c++) add(l, c);
      break;
    case 'around':
      for (let l = L - 1; l <= L + 1; l++) for (let c = col - 1; c <= col + 1; c++) {
        if (l !== L || c !== col) add(l, c);
      }
      break;
    case 'bothsides': add(L, front + 1); add(L, col - 1); break;
    case 'diag':
      [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([dl, dc]) => add(L + dl, col + dc));
      break;
    case 'vert3':
      for (let l = L - 1; l <= L + 1; l++) add(l, front + 1);
      break;
    case 'cone':
      add(L, front + 1);
      for (let l = L - 1; l <= L + 1; l++) add(l, front + 2);
      break;
    case 'wings':
      add(L - 1, front + 1); add(L + 1, front + 1);
      add(L - 1, front + 2); add(L + 1, front + 2);
      break;
    case 'sweep':
      for (let l = L - 1; l <= L + 1; l++) for (let d = 1; d <= 2; d++) add(l, front + d);
      break;
    case 'cross3': {
      const cc = front + 3;
      add(L, cc - 1); add(L, cc); add(L, cc + 1); add(L - 1, cc); add(L + 1, cc);
      break;
    }
    case 'adj4':
      [[0, 1], [0, -1], [-1, 0], [1, 0]].forEach(([dl, dc]) => add(L + dl, col + dc));
      break;
    case 'archer':
      [[0, 1], [0, 2], [-1, -1], [1, -1]].forEach(([dl, dc]) => add(L + dl, col + dc));
      break;
    default: break;
  }

  // Rear Sights bolts the cell behind onto whatever the card already covers.
  if (u.rearsight) {
    const back = L * COLS + col - 1;
    if (col - 1 >= 0 && !out.includes(back)) out.push(back);
  }
  // An omni machine's pattern is mirrored through its own cell: everything it
  // reaches ahead it reaches behind. Protos are one cell, so the reflection
  // is around `col` itself.
  if (u.omni) {
    [...out].forEach(i => {
      const l = Math.floor(i / COLS);
      const c = i % COLS;
      add(l, 2 * col - c);
    });
    return [...new Set(out)];
  }
  return out;
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
