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
import {costOf, vetOf, gearOf} from '../save/progression.js';
import {VET} from '../content/ranks.js';
import {hooks} from '../state/hooks.js';
import {unitAt, foeAt, civAt} from './board.js';
import {mkUnit} from './units.js';
import {applyFrameGear} from './frames.js';
import {armCall} from './stratagems.js';
import {fire, blast, healPass, dmgEnemy} from './combat.js';
import {clog} from './log.js';
import {drawCard} from './deck.js';

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
  // A salvage discount is spent the instant the card redeploys, win or lose —
  // it never lingers to undercut a normal copy drawn later.
  if (G.salvageDiscount && G.salvageDiscount[cid]) delete G.salvageDiscount[cid];
  G.hand.splice(G.hand.indexOf(cid), 1);
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
function playInstant(cid, l, c) {
  const k = POOL[cid];
  const done = [];

  // Demo Charge: the blast lands around the chosen tile, then the tile itself
  // is gone for good — the same 'x' a Hull Breach carves, chosen by you.
  if (k.crater) {
    blast(l, c, k.blastDmg || 0, k.n);
    G.ter[l][c] = 'x';
    done.push(`lane ${l + 1}, col ${c + 1} cratered — impassable for good`);
  }
  // Last-Stand Protocol: the defence grid is bought a lane at a time now.
  // Re-arming a lane that already holds a charge is legal and wasteful, so
  // say which it was rather than silently eating the card.
  if (k.grid) {
    done.push(G.gridCharge[l]
      ? `lane ${l + 1} was already armed — the charge is replaced`
      : `the defence grid is armed in lane ${l + 1}`);
    G.gridCharge[l] = 1;
  }
  if (k.gain) { G.dp += k.gain; done.push(`+${k.gain} DP`); }
  if (k.homestrike) done.push(homeStrike(k));
  if (k.draw) {
    for (let i = 0; i < k.draw; i++) drawCard(true);
    done.push(`${k.draw} cards called in`);
  }
  // Recon Lark: the whole board is seen until the end of the turn.
  if (k.reveal && G.fog) {
    G.reveal = true;
    done.push('the fog lifted');
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
  // A column formation files the bodies DOWN the same column — the lane
  // above, the lane below, then two out — and never sideways. If the column
  // is short, fewer stand; the card still lands.
  const offsets = k.formation === 'column'
    ? [[-1, 0], [1, 0], [-2, 0], [2, 0]]
    : [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  for (const [dl, dc] of offsets) {
    if (spots.length >= k.squad) break;
    {
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
  if (k.instant) { playInstant(cid, l, c); return consume(cid); }

  // A command call arms and is spent — no body, no tile taken. The tap that
  // played it names the target: a unit, a lane, a column.
  if (k.strat) {
    armCall(cid, l, c);
    return consume(cid);
  }

  if (k.frameGear || k.fits) {
    // X-Grenade is thrown, not carried: the player names the landing cell
    // (validTiles offered every cell within throw range of a team) and it
    // hits that cell and its four diagonals, armour ignored. Then spent.
    if (k.grenade) {
      const reach = u => Math.max(Math.abs(u.lane - l), Math.abs(u.col - c));
      const thrower = G.units.filter(u => u.line === k.fits).sort((a, b) => reach(a) - reach(b))[0];
      if (!thrower || reach(thrower) > (k.throw || 0)) return;
      const cells = [[l, c], [l - 1, c - 1], [l + 1, c - 1], [l - 1, c + 1], [l + 1, c + 1]];
      const hit = G.enemies.filter(e => cells.some(([l2, c2]) => e.lane === l2 && e.col === c2));
      hit.forEach(e => dmgEnemy(e, k.grenade, 'X-Grenade', !!k.pen, thrower));
      clog(`<span class="g">X-Grenade</span> — ${thrower.n} lands it at ${l + 1},${c + 1}: ${hit.length} hostile${hit.length === 1 ? '' : 's'} in the X.`, 'order');
      G.spent = G.spent || [];
      if (!G.spent.includes(cid)) G.spent.push(cid);
      return consume(cid);
    }
    // A kit lands on its host — validTiles only ever offers the host's cell,
    // so the unit under (l, c) is the machine or the team this kit fits.
    const fr = unitAt(l, c);
    if (!fr || !(k.frameGear ? fr.id === k.frameGear : fr.line === k.fits)) return;
    // Every kit is spent the moment it is played — Frame gear and Fireteam
    // armour alike: fitted, later stripped, it never comes back through the
    // reserve. One use a mission, so a reshuffle never deals a dead kit.
    G.spent = G.spent || [];
    if (!G.spent.includes(cid)) G.spent.push(cid);
    applyFrameGear(fr, cid);
  } else if (k.attach) {
    const u = unitAt(l, c);
    if (!u) return;
    u.att[k.attach] = true;
    // Two charges: one hit for a whole card slot never earned the slot.
    if (k.attach === 'shield') u.shield = 2;
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
      for (let i = 0; i < k.draw; i++) drawCard(true);
      clog(`<span class="g">${k.n}</span> — ${k.draw} cards called in.`, 'info');
    }
    clog(`Deployed <span class="g">${k.n}</span> — lane ${l + 1}, col ${c}.`, 'order');
  }

  consume(cid);
}
