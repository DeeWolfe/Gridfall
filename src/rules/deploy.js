// Playing a card onto the board.
//
// Deployment is territory-gated: with the exception of drop cards, you may
// only build on tiles you already hold, and tiles flip to whoever ends the turn
// standing on them. That loop is the game; everything else decorates it.

import {LANES, COLS} from '../state/constants.js';
import {POOL} from '../content/cards.js';
import {BEST} from '../content/hostiles.js';
import {G, active, clearSelection} from '../state/session.js';
import {randInt} from '../state/rng.js';
import {costOf, vetOf, gearOf, frameWeapon, isProto} from '../save/progression.js';
import {VET} from '../content/ranks.js';
import {hooks} from '../state/hooks.js';
import {unitAt, foeAt, civAt, frameAnchorFor, frameCells} from './board.js';
import {mkUnit} from './units.js';
import {fire, blast, healPass, dmgEnemy} from './combat.js';
import {clog} from './log.js';
import {drawCard} from './deck.js';
import {isMissionFrame} from './frames.js';

/** Spend the card, bill the deploy points, and log any promotion it earned. */
function consume(cid) {
  const k = POOL[cid];
  // A Silent Insertion charge is spent by any deployment that lands a body.
  if ((G.freeDrop || 0) > 0 && !k.instant && !k.attach) G.freeDrop--;
  active.usage = active.usage || {};
  const before = vetOf(cid).t;
  active.usage[cid] = (active.usage[cid] || 0) + 1;
  const after = vetOf(cid).t;
  if (after > before) clog(`<span class="g">${k.n} promoted to ${VET[after].n}.</span>`, 'info');

  G.dp -= costOf(cid);
  // The Frame never entered the hand, so it is not removed from one. Spending
  // it closes the slot for the rest of the mission — there is no second Frame.
  if (isMissionFrame(cid)) G.frame.played = true;
  else G.hand.splice(G.hand.indexOf(cid), 1);
  clearSelection();
  hooks.invalidate();
}

/** The home columns a Backstop volley covers. */
const HOME_COLS = 2;

/** Backstop Battery: one volley across both home columns, every lane at once. */
function homeStrike(k) {
  const caught = G.enemies.filter(e => e.col < HOME_COLS);
  if (!caught.length) return 'nothing was standing on the home line';
  caught.forEach(e => dmgEnemy(e, k.homestrike, k.n));
  return `${caught.length} hostile${caught.length > 1 ? 's' : ''} on the home line hit for ${k.homestrike}`;
}

/**
 * An instant resolves and is gone — no body, no tile taken. Each one declares
 * the effects it carries rather than sharing one hardcoded behaviour, so a new
 * instant is a data entry instead of another branch in here. The card is still
 * in hand while these run; consume() clears it afterwards.
 */
function playInstant(cid) {
  const k = POOL[cid];
  const done = [];

  if (k.gain) { G.dp += k.gain; done.push(`+${k.gain} DP`); }
  if (k.homestrike) done.push(homeStrike(k));
  if (k.draw) {
    for (let i = 0; i < k.draw; i++) drawCard(true);
    done.push(`${k.draw} cards called in`);
  }
  // Supply Cache's own price, declared on the card — being an instant does
  // not imply the penalty, which is why the flag is data and not a default.
  if (k.discard) {
    const pool = G.hand.filter(x => x !== cid);
    if (pool.length) {
      const drop = pool[randInt(pool.length)];
      G.hand.splice(G.hand.indexOf(drop), 1);
      done.push(`<span class="d">${POOL[drop].n}</span> lost in the scramble`);
    } else {
      done.push('nothing left to lose');
    }
  }

  clog(`<span class="g">${k.n}</span> — ${done.join(', ')}.`, 'order');
}

/** Claim the cells directly ahead of a unit as your ground. */
function claimAhead(u, count, cardName) {
  let got = 0;
  for (let i = 1; i <= count; i++) {
    const cc = u.col + u.size - 1 + i;
    if (cc < COLS && G.ter[u.lane][cc] !== 'x' && !foeAt(u.lane, cc)) {
      G.ter[u.lane][cc] = 'p';
      got++;
    }
  }
  if (got) clog(`<span class="g">${cardName}</span> claimed ${got} tile${got > 1 ? 's' : ''} ahead.`);
}

/** Hell Jumpers: fan the squad out around the chosen cell. */
function placeSquad(cid, l, c) {
  const k = POOL[cid];
  // A Drop Pod on a squad card crushes whatever holds the chosen cell, same
  // as the single-body path below — without this the first pod landed ON TOP
  // of any hostile tough enough to survive the impact blast, and the two
  // stood stacked in one cell for the rest of the mission.
  const pod = gearOf(cid);
  if (pod && pod.crush) {
    const e = foeAt(l, c);
    if (e && !e.boss && BEST[e.k].t !== 'special') {
      G.enemies = G.enemies.filter(x => x.uid !== e.uid);
      G.kills++;
      clog(`<span class="g">${k.n}</span> came down on ${BEST[e.k].n} and crushed it.`, 'kill');
      if (!active.unlocks.enemies.includes(e.k)) active.unlocks.enemies.push(e.k);
      G.ter[l][c] = 'p';
    }
  }
  const spots = [[l, c]];
  for (let dl = -1; dl <= 1 && spots.length < k.squad; dl++) {
    for (let dc = -1; dc <= 1 && spots.length < k.squad; dc++) {
      if (!dl && !dc) continue;
      const nl = l + dl;
      const nc = c + dc;
      if (nl < 0 || nl >= LANES || nc < 0 || nc >= COLS) continue;
      if (G.ter[nl][nc] === 'x' || unitAt(nl, nc) || foeAt(nl, nc) || civAt(nl, nc)) continue;
      if (!k.drop && G.ter[nl][nc] !== 'p') continue;
      spots.push([nl, nc]);
    }
  }
  spots.forEach(([sl, sc]) => {
    const u = mkUnit(cid, sl, sc);
    u.acted = true;
    G.units.push(u);
    if (k.drop) {
      G.ter[sl][sc] = 'p';
      blast(sl, sc, k.burstBlast || 0, u.n + ' (impact)');
    }
    fire(u, true);
  });
  clog(`<span class="g">${k.n}</span> — ${spots.length} pods down.`, 'order');
}

/** Play card `cid` at (l, c). Assumes the cell came from validTiles(). */
export function deploy(cid, l, c) {
  const k = POOL[cid];

  // An instant shares consume() with everything else, so it bills its deploy
  // points, logs a promotion and clears the selection by the same path.
  if (k.instant) { playInstant(cid); return consume(cid); }

  if (k.attach) {
    const u = unitAt(l, c);
    if (!u) return;
    u.att[k.attach] = true;
    if (k.attach === 'shield') u.shield = 1;
    clog(`<span class="g">${k.n}</span> fitted to ${u.n}.`, 'order');
  } else if (k.squad) {
    placeSquad(cid, l, c);
  } else {
    // A Drop Pod lands on a hostile and crushes it outright. The gear only
    // widens where the card may be played, so the crush fires when the chosen
    // cell actually holds something.
    const pod = gearOf(cid);
    if (pod && pod.crush) {
      const e = foeAt(l, c);
      if (e) {
        G.enemies = G.enemies.filter(x => x.uid !== e.uid);
        G.kills++;
        clog(`<span class="g">${k.n}</span> came down on ${BEST[e.k].n} and crushed it.`, 'kill');
        if (!active.unlocks.enemies.includes(e.k)) active.unlocks.enemies.push(e.k);
        G.ter[l][c] = 'p';
      }
    }

    // A Frame spends a Pilot rather than a tile. The Pilot is consumed, not
    // killed — it is climbing in, so G.lost stays where it is and the card is
    // not counted as a casualty. The machine remembers which Pilot walked in
    // with it, because that is who steps back out if it is destroyed.
    let rider = null;
    if (isProto(cid)) {
      rider = frameAnchorFor(frameCells(cid, l, c));
      if (!rider) return;
      G.units = G.units.filter(x => x.uid !== rider.uid);
    }

    const u = mkUnit(cid, l, c);
    if (rider) u.pilotId = rider.id;
    G.units.push(u);
    if (k.drop) {
      G.ter[l][c] = 'p';
      blast(l, c, k.burstBlast || 0, u.n + ' (impact)');
    }
    if (k.claim) claimAhead(u, k.claim, k.n);

    fire(u, true);
    if (u.heal || u.hot) healPass(u, true);
    u.acted = true;

    if (k.dpGain) {
      G.dp += k.dpGain;
      clog(`<span class="g">${k.n}</span> — +${k.dpGain} deploy points.`, 'info');
    }
    if (k.draw) {
      for (let i = 0; i < k.draw; i++) drawCard(true);
      clog(`<span class="g">${k.n}</span> — ${k.draw} cards called in.`, 'info');
    }
    if (rider) {
      const w = frameWeapon(cid);
      clog(`<span class="g">${k.n}</span> came down on your ${rider.n} — lane ${l + 1}, ` +
        `carrying ${w ? w.n : 'its service weapon'}.`, 'order');
    } else {
      clog(`Deployed <span class="g">${k.n}</span> — lane ${l + 1}, col ${c}.`, 'order');
    }
  }

  consume(cid);
}
