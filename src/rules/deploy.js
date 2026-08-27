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
import {costOf, vetOf} from '../save/progression.js';
import {VET} from '../content/ranks.js';
import {hooks} from '../state/hooks.js';
import {unitAt, foeAt, civAt} from './board.js';
import {mkUnit} from './units.js';
import {fire, blast, healPass} from './combat.js';
import {clog} from './log.js';
import {drawCard} from './deck.js';

/** Spend the card, bill the deploy points, and log any promotion it earned. */
function consume(cid) {
  const k = POOL[cid];
  active.usage = active.usage || {};
  const before = vetOf(cid).t;
  active.usage[cid] = (active.usage[cid] || 0) + 1;
  const after = vetOf(cid).t;
  if (after > before) clog(`<span class="g">${k.n} promoted to ${VET[after].n}.</span>`, 'info');

  G.dp -= costOf(cid);
  G.hand.splice(G.hand.indexOf(cid), 1);
  clearSelection();
  hooks.invalidate();
}

/** Supply Cache and friends: points now, at the cost of a card from hand. */
function playInstant(cid) {
  const k = POOL[cid];
  G.dp += k.gain || 0;
  G.hand.splice(G.hand.indexOf(cid), 1);

  const pool = G.hand.filter(x => x !== cid);
  if (pool.length) {
    const drop = pool[randInt(pool.length)];
    G.hand.splice(G.hand.indexOf(drop), 1);
    clog(`<span class="g">${k.n}</span> — +${k.gain} DP, but <span class="d">${POOL[drop].n}</span> was lost in the scramble.`);
  } else {
    clog(`<span class="g">${k.n}</span> — +${k.gain} DP. Nothing left to lose.`);
  }

  G.dp -= costOf(cid);
  active.usage = active.usage || {};
  active.usage[cid] = (active.usage[cid] || 0) + 1;
  clearSelection();
  hooks.invalidate();
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

  if (k.instant) return playInstant(cid);

  if (k.attach) {
    const u = unitAt(l, c);
    if (!u) return;
    u.att[k.attach] = true;
    if (k.attach === 'shield') u.shield = 1;
    clog(`<span class="g">${k.n}</span> fitted to ${u.n}.`, 'order');
  } else if (k.squad) {
    placeSquad(cid, l, c);
  } else {
    // Drop Pod lands on a hostile and crushes it outright.
    if (k.crush) {
      const e = foeAt(l, c);
      if (e) {
        G.enemies = G.enemies.filter(x => x.uid !== e.uid);
        G.kills++;
        clog(`<span class="g">${k.n}</span> came down on ${BEST[e.k].n} and crushed it.`, 'kill');
        if (!active.unlocks.enemies.includes(e.k)) active.unlocks.enemies.push(e.k);
      }
      G.ter[l][c] = 'p';
    }

    const u = mkUnit(cid, l, c);
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
      for (let i = 0; i < k.draw; i++) drawCard();
      clog(`<span class="g">${k.n}</span> — ${k.draw} cards called in.`, 'info');
    }
    clog(`Deployed <span class="g">${k.n}</span> — lane ${l + 1}, col ${c}.`, 'order');
  }

  consume(cid);
}
