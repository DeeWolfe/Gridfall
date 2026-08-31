// The Proto Frame slot.
//
// A Proto Frame is not shuffled in with everything else. It takes a slot of
// its own beside the deck — one per deck, one per mission — and sits at the
// front of the hand from the first turn, unplayed, until you spend it.
//
// That is deliberate and it is the only thing that makes the class work. A
// Frame costs a full turn's deploy points AND a Pilot placed a turn earlier;
// if it also had to be drawn, the whole two-card setup would be at the mercy
// of the shuffle, and a plan that expensive cannot also be a gamble. Making it
// always available is what turns the cost into a decision rather than a wish.
//
// The lead's stratagem works the same way for the same reason, and this
// deliberately mirrors it — seed at launch, read from the hand tray, spend
// once, gone.

import {POOL} from '../content/cards.js';
import {G, active} from '../state/session.js';
import {isProto} from '../save/progression.js';

/** Give the mission its one Proto Frame, if the loadout carries one. */
export function seedFrame() {
  const id = active && active.loadout ? active.loadout.frame : null;
  G.frame = id && isProto(id) ? {k: id, played: false} : null;
}

/** The unplayed Frame sitting beside the hand, or null. */
export const frameReady = () =>
  (G && !G.over && G.frame && !G.frame.played && POOL[G.frame.k] ? G.frame.k : null);

/** Whether `cid` is this mission's Frame and has not been spent yet. */
export const isMissionFrame = cid => !!(G && G.frame && G.frame.k === cid && !G.frame.played);
