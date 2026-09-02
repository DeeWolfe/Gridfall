// Reading the board: what occupies a cell, who owns what, where you may build.
//
// Territory is the spine of the game. `G.ter[lane][col]` is 'p' (yours),
// 'e' (theirs), 'n' (neutral) or 'x' (impassable). You may only deploy onto
// tiles you hold, so every other system is ultimately competing for these.

import {LANES, COLS, MAXBREACH} from '../state/constants.js';
import {POOL} from '../content/cards.js';
import {BEST} from '../content/hostiles.js';
import {G} from '../state/session.js';
import {gearOf, isProto, leadOf, leadBan} from '../save/progression.js';

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

/** A Frame Pilot: the cheap body a Frame needs in order to exist. */
export const isPilot = u => !!(u && POOL[u.id] && POOL[u.id].pilot);

/**
 * The Pilot a Frame filling `cells` would climb into: one standing inside the
 * footprint first, otherwise the nearest one orthogonally beside it.
 *
 * Shared by validTiles() and deploy() so the cell you are offered and the Pilot
 * you actually spend can never disagree.
 */
export function frameAnchorFor(cells) {
  const pilots = G.units.filter(isPilot);
  if (!pilots.length) return null;
  const inside = pilots.find(p => cells.some(([l, c]) => p.lane === l && p.col === c));
  if (inside) return inside;
  const beside = pilots
    .map(p => ({p, d: Math.min(...cells.map(([l, c]) => Math.abs(p.lane - l) + Math.abs(p.col - c)))}))
    .filter(x => x.d === 1)
    .sort((a, b) => a.p.uid - b.p.uid)[0];
  return beside ? beside.p : null;
}

/** The cells a Frame played at (l, c) would fill. */
export const frameCells = (cid, l, c) => {
  const size = (POOL[cid] && POOL[cid].size) || 1;
  return Array.from({length: size}, (_, i) => [l, c + i]);
};

/**
 * Every cell index (lane * COLS + col) where this card may legally be played.
 * Each card family answers the question differently, so they branch out early
 * rather than sharing one over-general predicate.
 */
export function validTiles(cid) {
  const k = POOL[cid];
  // A lead's ban is absolute: the card is dead in hand, not merely awkward.
  if (leadBan(cid)) return [];
  const tiles = rawTiles(cid, k);
  // Quietstep's No Rear Line: nothing that lands a body may land in the two
  // rearmost columns. Ground-target instants and attachments are not bodies.
  const minCol = leadOf().minCol || 0;
  if (!minCol || k.instant || k.attach) return tiles;
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

  // A Frame does not land on ground, it lands on a person. The usual held-tile
  // rule does not apply at all: the only question is whether one of your
  // Pilots is standing on, or orthogonally beside, the cells the machine will
  // fill. This branch returns before the ownership loop below on purpose —
  // a Silent Insertion charge widens where ordinary cards may be played, and
  // it must not quietly turn a Frame into a card that drops anywhere.
  if (isProto(cid)) {
    const size = k.size || 1;
    for (let l = 0; l < LANES; l++) for (let c = 0; c < COLS; c++) {
      const cells = [];
      let ok = true;
      let inside = 0;
      for (let i = 0; i < size; i++) {
        const cc = c + i;
        if (cc >= COLS || G.ter[l][cc] === 'x') { ok = false; break; }
        if (foeAt(l, cc) || civAt(l, cc)) { ok = false; break; }
        const holder = unitAt(l, cc);
        // Only the Pilot being climbed into may be standing in the footprint,
        // and only one of them — two would mean silently deleting a card.
        if (holder) {
          if (!isPilot(holder)) { ok = false; break; }
          inside++;
        }
        cells.push([l, cc]);
      }
      if (!ok || inside > 1) continue;
      if (frameAnchorFor(cells)) out.push(l * COLS + c);
    }
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
