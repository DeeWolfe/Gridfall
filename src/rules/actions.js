// One action per unit per turn, committed immediately and irreversibly.
//
// There is no undo and no confirm step: a move applies the moment you tap the
// tile, which is what makes a chain of repositions work naturally — each unit
// sees the board its predecessor left behind. Servo Legs is the one exception,
// letting a unit move and then still fire.

import {COLS} from '../state/constants.js';
import {G, setMover} from '../state/session.js';
import {cellPassable, unitAt, foeAt, civAt} from './board.js';
import {fire} from './combat.js';
import {useAbility} from './abilities.js';
import {hooks} from '../state/hooks.js';
import {clog} from './log.js';

/** Cell indices this unit may step into. Empty once it has acted. */
export function moveTargets(u) {
  if (!u.mob || u.stun || u.acted || u.moved) return [];
  const out = [];
  const steps = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  // An omni machine steps diagonally too — a fencer's footwork, not a tank's.
  if (u.omni) steps.push([1, 1], [1, -1], [-1, 1], [-1, -1]);
  steps.forEach(([dl, dc]) => {
    const nl = u.lane + dl;
    const nc = u.col + dc;
    for (let i = 0; i < u.size; i++) if (!cellPassable(nl, nc + i, u.uid)) return;
    out.push(nl * COLS + nc);
  });
  // A charger may keep going forward, but never through anything — every cell
  // on the way must be passable too.
  for (let step = 2; step <= (u.charge || 0); step++) {
    let clear = true;
    for (let s = 1; s <= step && clear; s++) {
      for (let i = 0; i < u.size; i++) if (!cellPassable(u.lane, u.col + s + i, u.uid)) clear = false;
    }
    if (clear) out.push(u.lane * COLS + u.col + step);
  }
  return out;
}

export function doMove(u, l, c) {
  if (u.acted || u.moved) return;
  // Never trust the caller: re-derive legality rather than assuming the UI
  // only ever offers legal tiles.
  if (!moveTargets(u).includes(l * COLS + c)) return;

  u.lane = l;
  u.col = c;
  u.moved = true;
  if (!u.servo) u.acted = true;
  clog(`${u.n} repositioned${u.servo ? ' — servo legs, it can still fire' : ''}.`, 'order');
  setMover(u.servo && !u.acted ? u : null);
  hooks.invalidate();
}

/**
 * Cells holding a friendly unit Cipher may trade places with. Both units must
 * fit where the other stands — a two-cell frame cannot swap into a one-cell
 * hole.
 */
export function swapTargets(u) {
  if (!u.swap || u.stun || u.acted) return [];
  // `m` standing at (l, c): every covered cell must be on the board, passable
  // ground, and free of anything except the two units trading places.
  const fits = (m, l, c, partner) => {
    for (let i = 0; i < m.size; i++) {
      const cc = c + i;
      if (cc >= COLS || G.ter[l][cc] === 'x') return false;
      if (foeAt(l, cc) || civAt(l, cc)) return false;
      const holder = unitAt(l, cc);
      if (holder && holder.uid !== m.uid && holder.uid !== partner.uid) return false;
    }
    return true;
  };
  return G.units
    .filter(o => o.uid !== u.uid && fits(u, o.lane, o.col, o) && fits(o, u.lane, u.col, u))
    .map(o => o.lane * COLS + o.col);
}

/** Cipher's action: exchange positions with the friendly at (l, c). */
export function doSwap(u, l, c) {
  if (u.acted) return;
  if (!swapTargets(u).includes(l * COLS + c)) return;
  const o = G.units.find(x => x.lane === l && x.col === c && x.uid !== u.uid);
  if (!o) return;
  [u.lane, o.lane] = [o.lane, u.lane];
  [u.col, o.col] = [o.col, u.col];
  u.acted = true;      // the whole action, servo legs or not
  u.moved = true;
  clog(`${u.n} traded places with ${o.n}.`, 'order');
  setMover(null);
  hooks.invalidate();
}

/** Attack, optionally locking onto `e` for single-target cards. */
export function doAttack(u, e) {
  if (u.acted) return;
  u.tgt = e ? e.uid : null;
  const before = G.enemies.length;
  fire(u, false);
  if (G.enemies.length === before) clog(`${u.n} engaged.`, 'order');
  u.acted = true;
  setMover(null);
  hooks.invalidate();
}

export function doAbility(u) {
  if (u.acted || u.cd > 0 || !u.ab) return;
  useAbility(u);
  u.acted = true;
  setMover(null);
  hooks.invalidate();
}
