// Reading the board: what occupies a cell, who owns what, where you may build.
//
// Territory is the spine of the game. `G.ter[lane][col]` is 'p' (yours),
// 'e' (theirs), 'n' (neutral) or 'x' (impassable). You may only deploy onto
// tiles you hold, so every other system is ultimately competing for these.

import {LANES, COLS, MAXBREACH} from '../state/constants.js';
import {POOL} from '../content/cards.js';
import {BEST} from '../content/hostiles.js';
import {G} from '../state/session.js';
import {gearOf, leadOf, leadBan} from '../save/progression.js';
import {hostFor} from './frames.js';
import {STRATAGEMS} from '../content/stratagems.js';
import {frameGateText} from './frames.js';

/** Your unit covering this cell — units may be two cells wide. */
export const unitAt = (l, c) => G.units.find(u => u.lane === l && c >= u.col && c < u.col + u.size);

/** The hostile standing in this cell. */
export const foeAt = (l, c) => G.enemies.find(e => e.lane === l && e.col === c);

/** A surviving civilian pod in this cell. */
export const civAt = (l, c) => G.civ.find(v => v.l === l && v.c === c && v.hp > 0);

/** Total tiles you hold. Drop below 6 and the mission is lost. */
export const held = () => G.ter.flat().filter(t => t === 'p').length;

/** Tiles you hold in the hostile half — the Retake Ground objective. */
export function heldEnemyHalf() {
  let n = 0;
  for (let l = 0; l < LANES; l++) for (let c = 5; c < COLS; c++) if (G.ter[l][c] === 'p') n++;
  return n;
}

/** Crystal nodes standing on ground you hold. */
export const crystalsHeld = () => G.crystals.filter(x => G.ter[x.l][x.c] === 'p').length;

/** Breaches tolerated before the mission is lost. Crystals spreads a defence
 * across four points by design — one lane inevitably runs thinner than the
 * rest, so it gets one more before the line calling it is calling it fair. */
export const breachAllowance = type => type === 'crystals' ? MAXBREACH + 1 : MAXBREACH;

/**
 * Turns after the last wave commits before the objective is called.
 *
 * Stronghold and Extraction win at this count rather than failing at it —
 * surviving IS the objective — but either way it is the number of turns left,
 * which is what the readout has to print. Crystals gets one more because the
 * mission spreads a defence across four points by design.
 */
export const ENDGAME_TURNS = type =>
  type === 'crystals' ? 4 : (type === 'stronghold' || type === 'extract') ? 2 : 3;

/**
 * Fog of war. The player's home third is always seen; everything else needs a
 * unit's sight (one cell; two for a scope, three for scouts), a Recon Lark's reveal, or a
 * hostile giving itself away by striking. Recomputed on demand — the board is
 * forty cells and the answer changes every move.
 */
export const FOG_HOME = 3;
export const DEFAULT_SIGHT = 1;
export function visibleCells() {
  const out = new Set();
  if (!G.fog || G.reveal) {
    for (let l = 0; l < LANES; l++) for (let c = 0; c < COLS; c++) out.add(l * COLS + c);
    return out;
  }
  for (let l = 0; l < LANES; l++) for (let c = 0; c < FOG_HOME; c++) out.add(l * COLS + c);
  G.units.forEach(u => {
    const r = (u.sight || DEFAULT_SIGHT) + (u.sightUp || 0);
    for (let i = 0; i < (u.size || 1); i++) {
      for (let dl = -r; dl <= r; dl++) for (let dc = -r; dc <= r; dc++) {
        const l = u.lane + dl;
        const c = u.col + i + dc;
        if (l >= 0 && l < LANES && c >= 0 && c < COLS) out.add(l * COLS + c);
      }
    }
  });
  return out;
}
export const cellVisible = (l, c) => !G.fog || G.reveal || visibleCells().has(l * COLS + c);
/** A hostile is seen where its cell is seen — or for a turn after it strikes. */
export const foeVisible = e => !G.fog || G.reveal || (e.revealUntil || -1) >= G.turn ||
  visibleCells().has(e.lane * COLS + e.col);

/** Lingering plasma. Burns hostiles moving through and denies capture. */
export const scorched = (l, c) => (G.scorch[l + ',' + c] || 0) > 0;

/** Can `selfUid` stand here? Impassable, occupied and hostile cells say no. */
export function cellPassable(l, c, selfUid) {
  if (l < 0 || l >= LANES || c < 0 || c >= COLS) return false;
  if (G.ter[l][c] === 'x') return false;
  if (foeAt(l, c) || civAt(l, c)) return false;
  const other = unitAt(l, c);
  if (other && other.uid !== selfUid) return false;
  return true;
}

/**
 * Every cell index (lane * COLS + col) where this card may legally be played.
 * Each card family answers the question differently, so they branch out early
 * rather than sharing one over-general predicate.
 */
export function validTiles(cid) {
  const k = POOL[cid];
  // A lead's ban is absolute: the card is dead in hand, not merely awkward.
  if (leadBan(cid)) return [];
  // The Frame system's gates read the same way: a second Frame waits its
  // turn, and gear is dead in hand until its own machine stands.
  if (frameGateText(cid)) return [];
  const tiles = rawTiles(cid, k);
  // Quietstep's No Rear Line: nothing that lands a body may land in the two
  // rearmost columns. Instants, attachments, gear and calls are not bodies.
  const minCol = leadOf().minCol || 0;
  if (!minCol || k.instant || k.attach || k.frameGear || k.strat) return tiles;
  return tiles.filter(i => i % COLS >= minCol);
}

function rawTiles(cid, k) {
  const out = [];

  // A cratering instant aims at the ground itself: any open tile with nothing
  // standing on it and no objective sunk into it, either side of the line.
  // The horde routes around what it makes, which is the entire point.
  if (k.instant && k.crater) {
    for (let l = 0; l < LANES; l++) for (let c = 0; c < COLS; c++) {
      if (G.ter[l][c] === 'x') continue;
      if (unitAt(l, c) || foeAt(l, c) || civAt(l, c)) continue;
      if (G.crystals.some(x => x.l === l && x.c === c)) continue;
      if (G.uplinkAt && G.uplinkAt.l === l && G.uplinkAt.c === c) continue;
      out.push(l * COLS + c);
    }
    return out;
  }

  // Instants are consumed where you stand; any held tile will do.
  if (k.instant) {
    for (let l = 0; l < LANES; l++) for (let c = 0; c < COLS; c++) {
      if (G.ter[l][c] === 'p') out.push(l * COLS + c);
    }
    return out;
  }

  // Attachments go onto one of your units that does not already carry one.
  if (k.attach) {
    G.units.forEach(u => { if (!u.att[k.attach]) out.push(u.lane * COLS + u.col); });
    return out;
  }

  // A command call aims at the board, not at ground you own. A banded call
  // (a lane, a column) takes any open cell to name its line; a friendly call
  // takes one of your units; a target-less call reads like an instant.
  if (k.strat) {
    const def = STRATAGEMS[k.strat];
    if (def.target === 'friendly') {
      G.units.forEach(u => out.push(u.lane * COLS + u.col));
    } else if (def.target === 'lane' || def.target === 'column') {
      for (let l = 0; l < LANES; l++) for (let c = 0; c < COLS; c++) {
        if (G.ter[l][c] !== 'x') out.push(l * COLS + c);
      }
    } else {
      for (let l = 0; l < LANES; l++) for (let c = 0; c < COLS; c++) {
        if (G.ter[l][c] === 'p') out.push(l * COLS + c);
      }
    }
    return out;
  }

  // Gear lands on the machine itself: the standing Frame's cell is the one
  // legal target. frameGateText() above already guaranteed it is the right
  // Frame, so this cannot offer someone else's kit a home.
  if (k.frameGear) {
    const fr = hostFor(k);
    if (fr) out.push(fr.lane * COLS + fr.col);
    return out;
  }
  // A thrown kit (the X-Grenade) is aimed: any cell within throw range of a
  // standing team of its line, hostiles under it or not — that is the point.
  if (k.fits && k.throw) {
    const teams = G.units.filter(u => u.line === k.fits);
    for (let l = 0; l < LANES; l++) for (let c = 0; c < COLS; c++) {
      if (G.ter[l][c] === 'x') continue;
      if (teams.some(u => Math.max(Math.abs(u.lane - l), Math.abs(u.col - c)) <= k.throw)) out.push(l * COLS + c);
    }
    return out;
  }
  // An armour ability fits any standing team of its line — every one is a target.
  if (k.fits) {
    G.units.filter(u => u.line === k.fits).forEach(u => out.push(u.lane * COLS + u.col));
    return out;
  }

  // `drop` and `anyGround` both ignore ownership; `zoneMin` additionally walls
  // off the columns before it (a Forward Base belongs forward, a Minefield in
  // the horde's path).
  // A Silent Insertion charge also ignores ownership while it lasts.
  const ignoreOwnership = k.drop || k.anyGround || (G.freeDrop || 0) > 0;
  for (let l = 0; l < LANES; l++) for (let c = 0; c < COLS; c++) {
    if (G.ter[l][c] === 'x') continue;
    if (k.zoneMin && c < k.zoneMin) continue;
    if (!ignoreOwnership && G.ter[l][c] !== 'p') continue;
    let ok = true;
    const size = k.size || 1;
    for (let i = 0; i < size; i++) {
      const cc = c + i;
      if (cc >= COLS || G.ter[l][cc] === 'x') { ok = false; break; }
      if (!ignoreOwnership && G.ter[l][cc] !== 'p') { ok = false; break; }
      if (unitAt(l, cc) || foeAt(l, cc) || civAt(l, cc)) { ok = false; break; }
    }
    if (ok) out.push(l * COLS + c);
  }

  // A Drop Pod comes down on top of a hostile and crushes it — but not through
  // Specialist armour, and only for a unit that fits in the one cell it clears.
  if (gearOf(cid) && gearOf(cid).crush && (k.size || 1) === 1) {
    G.enemies.forEach(e => {
      // Specialist armour stops a pod; a boss is immune to anything that
      // deletes rather than damages (boss-patch: no instant kills, ever).
      if (BEST[e.k].t === 'special' || BEST[e.k].t === 'boss') return;
      if (G.ter[e.lane][e.col] === 'x') return;
      out.push(e.lane * COLS + e.col);
    });
  }
  return out;
}
