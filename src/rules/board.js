// Reading the board: what occupies a cell, who owns what, where you may build.
//
// Territory is the spine of the game. `G.ter[lane][col]` is 'p' (yours),
// 'e' (theirs), 'n' (neutral) or 'x' (impassable). You may only deploy onto
// tiles you hold, so every other system is ultimately competing for these.

import {LANES, COLS} from '../state/constants.js';
import {POOL} from '../content/cards.js';
import {BEST} from '../content/hostiles.js';
import {G} from '../state/session.js';
import {gearOf} from '../save/progression.js';

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
  const out = [];

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

  for (let l = 0; l < LANES; l++) for (let c = 0; c < COLS; c++) {
    if (G.ter[l][c] === 'x') continue;
    if (!k.drop && G.ter[l][c] !== 'p') continue;
    let ok = true;
    const size = k.size || 1;
    for (let i = 0; i < size; i++) {
      const cc = c + i;
      if (cc >= COLS || G.ter[l][cc] === 'x') { ok = false; break; }
      if (!k.drop && G.ter[l][cc] !== 'p') { ok = false; break; }
      if (unitAt(l, cc) || foeAt(l, cc) || civAt(l, cc)) { ok = false; break; }
    }
    if (ok) out.push(l * COLS + c);
  }

  // A Drop Pod comes down on top of a hostile and crushes it — but not through
  // Specialist armour, and only for a unit that fits in the one cell it clears.
  if (gearOf(cid) && gearOf(cid).crush && (k.size || 1) === 1) {
    G.enemies.forEach(e => {
      if (BEST[e.k].t === 'special') return;
      if (G.ter[e.lane][e.col] === 'x') return;
      out.push(e.lane * COLS + e.col);
    });
  }
  return out;
}
