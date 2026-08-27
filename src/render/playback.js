// Replaying a turn tape: the board steps through the recorded frames instead
// of teleporting to the end state, with damage floats and hit flashes drawn
// over the cells each frame touched.
//
// The frames carry clones of everything drawBoard() reads, so playback swaps
// those fields into G, draws, and restores the real (final) values when it is
// done. While it runs, `replaying` in the session holds off input: endTurn
// refuses to re-enter, the action bar disables, and the cells go inert via the
// `.replaying` class. Any key or click skips to the end.

import {COLS} from '../state/constants.js';
import {G, setReplaying} from '../state/session.js';
import {$} from './dom.js';
import {drawAll} from './combat.js';

/** Everything a frame snapshot overrides on G while it is being shown. */
const SWAP = ['ter', 'units', 'enemies', 'civ', 'scorch', 'predict', 'held', 'breaches'];

/** Per-frame pacing by what the frame shows, before long-turn compression. */
const PACE = {fire: 200, enemy: 155, territory: 300, spawn: 200};

/** A turn never takes longer than ~22 beats to watch, however busy it was. */
const MAX_BEATS = 22;
const MIN_DELAY = 70;

let saved = null;
let queue = [];
let timer = 0;
let squeeze = 1;
let onDone = null;

export const isReplaying = () => saved !== null;

/**
 * Play the recorded frames, then call `done` with the real state restored.
 * Returns false (and plays nothing) when there is nothing to show or a replay
 * is somehow already running.
 */
export function playTurn(frames, done) {
  if (saved || !frames.length || !G) {
    if (done) done();
    return false;
  }
  setReplaying(true);
  $('combat').classList.add('replaying');
  $('combat').onclick = skipReplay;

  saved = {};
  SWAP.forEach(k => { saved[k] = G[k]; });
  queue = frames.slice();
  squeeze = Math.min(1, MAX_BEATS / frames.length);
  onDone = done;
  stepFrame();
  return true;
}

/** Jump straight to the end of the tape. Wired to any key or click. */
export function skipReplay() {
  if (!saved) return;
  clearTimeout(timer);
  queue = [];
  finishReplay();
}

function stepFrame() {
  if (!saved) return;
  const f = queue.shift();
  if (!f) {
    finishReplay();
    return;
  }
  SWAP.forEach(k => { if (f[k] !== undefined) G[k] = f[k]; });
  drawAll();
  paintEffects(f.events);
  const delay = Math.max(MIN_DELAY, (PACE[f.label] || 180) * squeeze);
  timer = setTimeout(stepFrame, delay);
}

function finishReplay() {
  SWAP.forEach(k => { G[k] = saved[k]; });
  saved = null;
  setReplaying(false);
  $('combat').classList.remove('replaying');
  $('combat').onclick = null;
  const done = onDone;
  onDone = null;
  if (done) done();
}

/** The cell element at (lane, col) — drawBoard appends them in index order. */
function cellAt(lane, col) {
  return $('board').children[lane * COLS + col] || null;
}

function float(cell, text, cls) {
  const s = document.createElement('span');
  s.className = 'fxfloat' + (cls ? ' ' + cls : '');
  s.textContent = text;
  cell.appendChild(s);
}

function paintEffects(events) {
  events.forEach(ev => {
    const cell = ev.lane !== undefined ? cellAt(ev.lane, ev.col !== undefined ? ev.col : 0) : null;
    if (!cell) return;
    switch (ev.type) {
      case 'hit':
        cell.classList.add(ev.died ? 'fx-die' : 'fx-hit');
        float(cell, '-' + ev.amount, ev.foe ? '' : 'own');
        break;
      case 'shield':
        cell.classList.add('fx-hit');
        float(cell, '◈', 'shield');
        break;
      case 'spawn':
      case 'clash':
        cell.classList.add('fx-drop');
        break;
      case 'breach':
        cell.classList.add('fx-breach');
        float(cell, 'BREACH', 'own');
        break;
    }
  });
}
