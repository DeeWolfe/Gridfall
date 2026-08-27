// Stratagems: one command call per mission, seeded by the team lead.
//
// A stratagem is a card, not a button — it costs deploy points and is spent
// through the same turn the units act in. It differs from a deployable in
// four ways: it is seeded into the mission rather than drafted, it exists
// once, it leaves no body, and — the part that matters — it resolves at the
// START of the following turn. Playing one is a prediction, not an undo: the
// marker lands this turn, the effect fires next. That beat is also the
// balancing lever for the whole class; do not remove it.

import {LANES, COLS} from '../state/constants.js';
import {STRATAGEMS} from '../content/stratagems.js';
import {G} from '../state/session.js';
import {hooks} from '../state/hooks.js';
import {leadOf} from '../save/progression.js';
import {unitAt, foeAt, civAt} from './board.js';
import {dmgEnemy} from './combat.js';
import {clog} from './log.js';

/** Give the mission its one call, if the active lead carries one. */
export function seedStratagem() {
  const lead = leadOf();
  G.strat = lead.stratagem && STRATAGEMS[lead.stratagem]
    ? {k: lead.stratagem, played: false, armed: null}
    : null;
}

/** The unplayed call sitting in the player's hand, or null. */
export const stratReady = () =>
  (G && !G.over && G.strat && !G.strat.played ? STRATAGEMS[G.strat.k] : null);

export function canPlayStratagem() {
  const def = stratReady();
  return !!def && G.dp >= def.dp;
}

/**
 * Commit the call. `target` is {uid} for friendly, {lane} or {col} for bands,
 * null for target-less calls. Returns false without spending anything when
 * the call is gone, unaffordable, or the target is invalid.
 */
export function playStratagem(target) {
  if (!canPlayStratagem()) return false;
  const def = STRATAGEMS[G.strat.k];
  if (def.target === 'friendly' && !(target && G.units.some(u => u.uid === target.uid))) return false;
  if (def.target === 'lane' && !(target && target.lane >= 0 && target.lane < LANES)) return false;
  if (def.target === 'column' && !(target && target.col >= 0 && target.col < COLS)) return false;

  G.dp -= def.dp;
  G.strat.played = true;
  G.strat.armed = {k: G.strat.k, target: def.target === 'none' ? null : target};
  clog(`<span class="t">STRATAGEM</span> — <span class="g">${def.n}</span> called in. Resolves at the start of next turn.`, 'order');
  hooks.invalidate();
  return true;
}

/** Cell indices the armed call will touch — the telegraph the board paints. */
export function stratMarkers() {
  if (!G || !G.strat || !G.strat.armed) return [];
  const def = STRATAGEMS[G.strat.armed.k];
  const t = G.strat.armed.target;
  const out = [];
  if (def.target === 'friendly' && t) {
    const u = G.units.find(x => x.uid === t.uid);
    if (u) for (let i = 0; i < u.size; i++) out.push(u.lane * COLS + u.col + i);
  } else if (def.target === 'lane' && t) {
    for (let c = 0; c < COLS; c++) out.push(t.lane * COLS + c);
  } else if (def.target === 'column' && t) {
    for (let l = 0; l < LANES; l++) out.push(l * COLS + t.col);
  }
  return out;
}

/** Breaching Charge's kill threshold — also read by the focus/details views. */
export const BREACH_HULL = 8;

/**
 * Start-of-turn tick: last turn's short-lived effects expire, then the armed
 * call — if any — fires. Runs once per turn from endTurn, after the new
 * turn's deploy points are dealt.
 */
export function resolveStratagem() {
  G.units.forEach(u => { u.dueled = false; });
  G.freeDrop = 0;
  if (!G.strat || !G.strat.armed) return;

  const {k, target} = G.strat.armed;
  const def = STRATAGEMS[k];
  G.strat.armed = null;

  if (k === 'requisition') {
    G.dp += 4;
    clog(`<span class="g">${def.n}</span> — +4 deploy points.`, 'order');
  } else if (k === 'duel') {
    const u = target && G.units.find(x => x.uid === target.uid);
    if (u) {
      u.dueled = true;
      clog(`<span class="g">${def.n}</span> — ${u.n} fights alone this turn: +4 damage, untouchable.`, 'order');
    } else {
      clog(`<span class="d">${def.n}</span> — the duelist did not live to answer the call.`, 'loss');
    }
  } else if (k === 'refit') {
    let n = 0;
    G.units.forEach(u => { if (u.tech && u.hp < u.max) { u.hp = u.max; n++; } });
    clog(`<span class="g">${def.n}</span> — ${n} Tech unit${n === 1 ? '' : 's'} restored to full hull.`, 'order');
  } else if (k === 'insertion') {
    G.freeDrop = 3;
    clog(`<span class="g">${def.n}</span> — the next three deployments may land on any tile.`, 'order');
  } else if (k === 'breach') {
    // Ignores blockers by design: it reaches the emplacements nothing else can.
    const hit = G.enemies.filter(e => e.col === target.col && e.hp <= BREACH_HULL);
    hit.forEach(e => dmgEnemy(e, 999, def.n, true));
    clog(`<span class="g">${def.n}</span> — column ${target.col} swept, ${hit.length} destroyed.`, 'order');
  } else if (k === 'grapple') {
    // Drag toward the hostile edge, farthest first so nothing stacks; clamped
    // at the last column and stopped by anything standing in the way.
    const caught = G.enemies.filter(e => e.lane === target.lane).sort((a, b) => b.col - a.col);
    caught.forEach(e => {
      for (let s = 0; s < 2; s++) {
        const nc = e.col + 1;
        if (nc >= COLS || G.ter[e.lane][nc] === 'x') break;
        if (unitAt(e.lane, nc) || foeAt(e.lane, nc) || civAt(e.lane, nc)) break;
        e.col = nc;
      }
    });
    clog(`<span class="g">${def.n}</span> — lane ${target.lane + 1} dragged back toward the edge.`, 'order');
  }
  hooks.invalidate();
}
