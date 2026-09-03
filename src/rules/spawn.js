// Delivering the wave the markers promised.
//
// The lane a hostile arrives in was fixed before the player's turn and is not
// negotiable here. What IS negotiable is the cell: the drop point may be
// occupied, in which case the hostile either finds another cell in the SAME
// lane or fights the unit standing on it. If it cannot get in at all it holds
// at the edge and tries again next turn — still in the same lane.

import {COLS} from '../state/constants.js';
import {BEST} from '../content/hostiles.js';
import {G, active, nextUid} from '../state/session.js';
import {randInt} from '../state/rng.js';
import {unitAt, foeAt, civAt} from './board.js';
import {buffOf, packBonus} from './units.js';
import {dampenIn} from './combat.js';
import {clog} from './log.js';
import {tapeEvent, tapeMark} from './tape.js';

export const mkFoe = (k, lane, col, hp) => {
  tapeEvent({type: 'spawn', lane, col});
  return {uid: nextUid(), k, lane, col, hp, mv: 0, acc: 0, stun: 0};
};

/**
 * A hostile dropping onto one of your units: they fight to the death and the
 * survivor keeps its wounds. Resolved as a race between two kill-times rather
 * than blow by blow — same outcome, no loop.
 *
 * @returns {{outcome:'repelled'|'mutual'|'landed', eHp:number, uHp:number}}
 */
export function spawnClash(k, D, u) {
  const eDmg = Math.max(1, (D.dmg || 0) - dampenIn(u.lane));
  const uDmg = Math.max(0, (u.dmg || 0) + (u.riposte || 0) + buffOf(u) + packBonus(u));
  const uNet = u.pen ? uDmg : Math.max(0, uDmg - (BEST[k].floor || 0));

  // A zero-damage emplacement cannot force a landing at all.
  if (!D.dmg) return {outcome: 'repelled', eHp: 0, uHp: u.hp};

  const uEff = u.hp + (u.shield || 0) * eDmg;      // each shield charge eats one blow
  const roundsToKillU = Math.ceil(uEff / eDmg);
  const roundsToKillE = uNet > 0 ? Math.ceil(D.hp / uNet) : Infinity;

  if (roundsToKillE < roundsToKillU) {
    return {outcome: 'repelled', eHp: 0, uHp: Math.max(1, u.hp - eDmg * roundsToKillE)};
  }
  if (roundsToKillE === roundsToKillU) return {outcome: 'mutual', eHp: 0, uHp: 0};
  return {outcome: 'landed', eHp: Math.max(1, D.hp - uNet * roundsToKillU), uHp: 0};
}

/** Resolve a contested landing. Returns true if the hostile got in (or died trying). */
function dropFight(k, D, u) {
  const r = spawnClash(k, D, u);
  tapeEvent({type: 'clash', lane: u.lane, col: u.col});

  if (r.outcome === 'repelled') {
    if (!D.dmg) {
      clog(`<span class="d">${D.n}</span> could not force a landing — held at the edge.`, 'wave');
      return false;
    }
    u.hp = r.uHp;
    clog(`<span class="g">${u.n}</span> held the drop zone and destroyed an incoming ${D.n}.`, 'kill');
    G.kills++;
    if (!active.unlocks.enemies.includes(k)) active.unlocks.enemies.push(k);
    return true;
  }

  const lane = u.lane;
  const col = u.col;
  const name = u.n;
  G.units = G.units.filter(x => x.uid !== u.uid);
  G.lost++;

  if (r.outcome === 'mutual') {
    clog(`<span class="d">${D.n}</span> and your <span class="g">${name}</span> destroyed each other on the drop.`, 'loss');
    G.kills++;
    if (!active.unlocks.enemies.includes(k)) active.unlocks.enemies.push(k);
    return true;
  }

  G.enemies.push(mkFoe(k, lane, col, r.eHp));
  clog(`<span class="d">${D.n}</span> landed on your ${name} and destroyed it — it arrives at ${r.eHp}/${D.hp} hull.`, 'loss');
  return true;
}

/**
 * Put one hostile of type `k` into `lane`. Returns false if it could not get
 * in, in which case the caller holds it for next turn — in this same lane.
 */
export function resolveSpawn(k, lane) {
  const D = BEST[k];
  let start = D.emerge !== undefined ? D.emerge : COLS - 1;
  if (D.spd === 0) start = 5 + randInt(3);   // emplacements set up across the rear
  const free = c => c >= 0 && c < COLS && !unitAt(lane, c) && !foeAt(lane, c) && !civAt(lane, c);

  // Straightforward landing.
  if (free(start)) {
    G.enemies.push(mkFoe(k, lane, start, D.hp));
    return true;
  }

  // One of your units is standing on the drop point — it gets fought for.
  const onPoint = unitAt(lane, start);
  if (onPoint) return dropFight(k, D, onPoint);

  // Drop point held by another hostile: any open cell in the promised lane.
  for (let c = start + 1; c < COLS; c++) {
    if (free(c)) { G.enemies.push(mkFoe(k, lane, c, D.hp)); return true; }
  }
  for (let c = start - 1; c >= 0; c--) {
    if (free(c)) { G.enemies.push(mkFoe(k, lane, c, D.hp)); return true; }
  }

  // Lane completely packed: fight the unit nearest the edge for its cell.
  let tgt = null;
  for (let c = COLS - 1; c >= 0; c--) {
    const u = unitAt(lane, c);
    if (u) { tgt = u; break; }
  }
  return tgt ? dropFight(k, D, tgt) : false;
}

/** Deliver everything the markers promised, plus anything held over. */
export function spawnPhase() {
  const queue = (G.held || []).concat(G.predict || []);
  G.held = [];
  G.predict = [];
  if (!queue.length) return;

  queue.forEach(({lane, k}) => {
    if (G.ter[lane][0] === 'x') { G.held.push({lane, k}); return; }
    if (!resolveSpawn(k, lane)) G.held.push({lane, k});
    tapeMark('spawn');
  });

  if (G.held.length) {
    clog(`<span class="d">${G.held.length} hostile${G.held.length > 1 ? 's' : ''} held at the edge</span> — no way into the marked lane.`, 'wave');
  }
}
