// The turn tape: what actually happened when the player hit End turn.
//
// Resolution is synchronous and stays that way — the logic harnesses and the
// balance bots call endTurn() hundreds of times and pay nothing for this.
// When recording is enabled (the renderer's boot turns it on; nothing else
// does), the phases mark frames as they go: each frame is a cheap snapshot of
// the board plus the hit/spawn/breach events since the last mark. The renderer
// then replays the frames at a visible pace instead of teleporting the board
// to its final state.
//
// DOM-free, like everything under rules/.

import {G} from '../state/session.js';

let enabled = false;
let collecting = false;
let frames = [];
let pendingEvents = [];

/** One-way switch, flipped by the renderer's boot. Tests that want the tape
 *  call it too; everything else never pays for a snapshot. */
export function enableTape() {
  enabled = true;
}

/** Start a fresh recording for one turn. No-op unless enabled. */
export function tapeBegin() {
  if (!enabled) return;
  collecting = true;
  frames = [];
  pendingEvents = [];
}

/** Record one visible event (a hit, a spawn, a breach) for the current frame. */
export function tapeEvent(e) {
  if (collecting) pendingEvents.push(e);
}

/**
 * Close the current frame: snapshot the board and attach the pending events.
 * Skipped when nothing happened since the last mark, unless forced — a forced
 * empty frame is a deliberate beat in the playback.
 */
export function tapeMark(label, force) {
  if (!collecting) return;
  if (!pendingEvents.length && !force) return;
  frames.push({label, events: pendingEvents, ...snapshot()});
  pendingEvents = [];
}

/** Stop recording and hand the frames over. Also used to discard on finish(). */
export function tapeEnd() {
  collecting = false;
  const out = frames;
  frames = [];
  pendingEvents = [];
  return out;
}

/** Everything drawBoard() and the header read that changes mid-resolution. */
function snapshot() {
  return {
    ter: G.ter.map(row => row.slice()),
    units: G.units.map(u => ({...u})),
    enemies: G.enemies.map(e => ({...e})),
    civ: G.civ.map(v => ({...v})),
    scorch: {...G.scorch},
    predict: G.predict.slice(),
    held: (G.held || []).slice(),
    breaches: G.breaches,
  };
}
