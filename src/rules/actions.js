// One action per unit per turn, committed immediately and irreversibly.
//
// There is no undo and no confirm step: a move applies the moment you tap the
// tile, which is what makes a chain of repositions work naturally — each unit
// sees the board its predecessor left behind. Servo Legs is the one exception,
// letting a unit move and then still fire.

import {COLS} from '../state/constants.js';
import {G, setMover} from '../state/session.js';
import {cellPassable} from './board.js';
import {fire} from './combat.js';
import {useAbility} from './abilities.js';
import {hooks} from '../state/hooks.js';
import {clog} from './log.js';

/** Cell indices this unit may step into. Empty once it has acted. */
export function moveTargets(u) {
  if (!u.mob || u.stun || u.acted || u.moved) return [];
  const out = [];
  [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([dl, dc]) => {
    const nl = u.lane + dl;
    const nc = u.col + dc;
    for (let i = 0; i < u.size; i++) if (!cellPassable(nl, nc + i, u.uid)) return;
    out.push(nl * COLS + nc);
  });
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
