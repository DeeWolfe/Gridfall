// Command calls: tech cards that predict rather than deploy.
//
// A call used to be the team lead's one seeded stratagem. It is a DECK CARD
// now — drawn, held, paid for and spent like everything else — but the beat
// that defines the class is untouched: playing one is a prediction, not an
// undo. It does not resolve when you play it. That delay is the balancing
// lever for the whole class; do not remove it.
//
// There are two beats, and a call declares which one it takes:
//
//   default   fires at the START of the following turn. You commit against a
//             board you have not seen yet — a full turn of prediction.
//   now: 1    fires at the END of the turn you call it, after the hostiles
//             have moved but before the tiles flip. Still a prediction, just a
//             shorter one: you know where they are, not where they will be.
//
// Only the demolition pair — Breaching Charge (a column) and Enfilade Charge
// (a lane) — takes the short beat. Sweeping a line is the one effect the long
// beat made close to unusable: a full turn is long enough for the line you
// aimed at to empty itself.
//
// Several calls may be in the air at once now that the deck can hold several
// cards — G.calls is a queue, and each entry fires on its own beat.

import {LANES, COLS} from '../state/constants.js';
import {STRATAGEMS} from '../content/stratagems.js';
import {POOL} from '../content/cards.js';
import {G} from '../state/session.js';
import {hooks} from '../state/hooks.js';
import {unitAt, foeAt, civAt} from './board.js';
import {dmgEnemy} from './combat.js';
import {clog} from './log.js';

/**
 * Arm the call a card just played. (l, c) is the deploy tap: for a banded
 * call it names the lane or column, for a friendly call it names the unit
 * standing there, and a target-less call ignores it. deploy() has already
 * checked legality through validTiles and bills the points through consume().
 */
export function armCall(cid, l, c) {
  const key = POOL[cid].strat;
  const def = STRATAGEMS[key];
  const target = def.target === 'friendly' ? {uid: unitAt(l, c).uid}
    : def.target === 'lane' ? {lane: l}
      : def.target === 'column' ? {col: c}
        : null;
  G.calls.push({k: key, target});
  clog(`<span class="t">CALL</span> — <span class="g">${def.n}</span> armed. ` +
    (def.now ? 'Lands at the end of this turn.' : 'Resolves at the start of next turn.'), 'order');
}

/** Cell indices the armed calls will touch — the telegraph the board paints. */
export function stratMarkers() {
  if (!G || !G.calls) return [];
  const out = [];
  G.calls.forEach(({k, target: t}) => {
    const def = STRATAGEMS[k];
    if (def.target === 'friendly' && t) {
      const u = G.units.find(x => x.uid === t.uid);
      if (u) for (let i = 0; i < u.size; i++) out.push(u.lane * COLS + u.col + i);
    } else if (def.target === 'lane' && t) {
      for (let c = 0; c < COLS; c++) out.push(t.lane * COLS + c);
    } else if (def.target === 'column' && t) {
      for (let l = 0; l < LANES; l++) out.push(l * COLS + t.col);
    }
  });
  return out;
}

/** The demolition pair's kill threshold — also read by the focus/details views. */
export const BREACH_HULL = 8;

/**
 * Start-of-turn tick: last turn's short-lived effects expire, then every
 * long-beat call fires. Runs once per turn from endTurn, after the new
 * turn's deploy points are dealt.
 */
export function resolveStratagem() {
  G.units.forEach(u => { u.dueled = false; });
  G.freeDrop = 0;
  if (!G.calls || !G.calls.length) return;
  const due = G.calls.filter(x => !STRATAGEMS[x.k].now);
  G.calls = G.calls.filter(x => STRATAGEMS[x.k].now);
  due.forEach(fireCall);
}

/**
 * End-of-turn tick: fires the short-beat calls and nothing else. Runs from
 * endTurn after the hostiles have moved and before the tiles flip, so a
 * swept line is ground the player then holds.
 */
export function resolveStratagemEnd() {
  if (!G || !G.calls || !G.calls.length) return;
  const due = G.calls.filter(x => STRATAGEMS[x.k].now);
  G.calls = G.calls.filter(x => !STRATAGEMS[x.k].now);
  due.forEach(fireCall);
}

/** The effect itself, once its beat has decided it is time. */
function fireCall({k, target}) {
  const def = STRATAGEMS[k];

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
  } else if (k === 'breach' || k === 'enfilade') {
    // Ignores blockers by design: it reaches the emplacements nothing else can.
    // A boss is immune to anything that deletes rather than damages — a hurt
    // fragment under the threshold does not get erased by a demolition charge.
    const inBand = k === 'breach'
      ? e => e.col === target.col
      : e => e.lane === target.lane;
    const hit = G.enemies.filter(e => !e.boss && inBand(e) && e.hp <= BREACH_HULL);
    hit.forEach(e => dmgEnemy(e, 999, def.n, true));
    clog(`<span class="g">${def.n}</span> — ${k === 'breach'
      ? 'column ' + target.col : 'lane ' + (target.lane + 1)} swept, ${hit.length} destroyed.`, 'order');
  } else if (k === 'grapple') {
    // Drag toward the hostile edge, farthest first so nothing stacks; clamped
    // at the last column and stopped by anything standing in the way.
    // A boss does not fit in a net — its bodies hold their ground.
    const caught = G.enemies.filter(e => e.lane === target.lane && !e.boss).sort((a, b) => b.col - a.col);
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
