// Board fixtures: put a specific unit or hostile in a specific cell.
//
// Units are built with the real mkUnit() so a test can never drift from what
// deploy() actually produces — the one deliberate difference is `fresh`, which
// starts false here because a fixture represents a unit that has already been
// on the board for a turn.

import {G, nextUid} from '../../src/state/session.js';
import {mkUnit} from '../../src/rules/units.js';
import {POOL} from '../../src/content/cards.js';

/** Place one of your units. `extra` overrides any field after construction. */
export function spawnUnit(id, lane, col, extra) {
  const u = Object.assign(mkUnit(id, lane, col), {fresh: false}, extra || {});
  G.units.push(u);
  return u;
}

/** Place a hostile. Defaults to effectively unkillable so damage is measurable. */
export function spawnFoe(kind, lane, col, hp) {
  const e = {uid: nextUid(), k: kind, lane, col, hp: hp === undefined ? 99 : hp, mv: 0, acc: 0, stun: 0};
  G.enemies.push(e);
  return e;
}

/** Empty the board without replacing the arrays G holds a reference to. */
export function clearBoard() {
  G.units.length = 0;
  G.enemies.length = 0;
}

/** Give a profile the whole collection, and optionally a specific deck. */
export function unlockAll(p, deck) {
  p.unlocks.cards = Object.keys(POOL);
  if (deck) p.loadout.deck = deck;
  return p;
}
