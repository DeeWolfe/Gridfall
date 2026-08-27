// The mutable singletons every other module reads.
//
// These are deliberately module-level rather than threaded through call
// signatures: the game is single-session and single-board, and the reference
// build proved the shape works. Reassignment goes through the setters so the
// bindings stay live for importers; everything else mutates in place.

import {OPS} from '../content/operations.js';

/** The profile being played, or null on the record-select screen. */
export let active = null;
export const setActive = p => { active = p; };

/** Every profile in local storage. */
export let profiles = [];
export const setProfiles = list => { profiles = list; };

/** The mission in progress, or null outside combat. */
export let G = null;
export const setG = g => { G = g; };

/** The operation map currently being displayed. */
export let MAPDEF = OPS.ironveil;
export const setMapdef = op => { MAPDEF = OPS[op] || OPS.ironveil; };

/** Card id selected in hand and awaiting a tile, or null. */
export let sel = null;
export const setSel = id => { sel = id; };

/** Unit selected on the board and awaiting an action, or null. */
export let mover = null;
export const setMover = u => { mover = u; };

/** Requisition packs owed to the player, oldest first. */
export let packQueue = [];
export const setPackQueue = q => { packQueue = q; };

let uid = 0;
/** Monotonic id for units and hostiles. Unique within a session. */
export const nextUid = () => ++uid;

/** Drop board selection. Called whenever the board changes underfoot. */
export function clearSelection() {
  sel = null;
  mover = null;
}
