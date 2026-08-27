// Read-only projections the UI paints onto the board: what will be hit this
// turn, who a selected unit is helping, and where it suppresses the enemy.
//
// forecastThreat() deliberately mirrors the first half of enemyPhase(). If the
// two drift apart the board lies to the player about incoming damage, so any
// change to hostile decision-making belongs in both.

import {COLS} from '../state/constants.js';
import {BEST} from '../content/hostiles.js';
import {G} from '../state/session.js';
import {unitAt, foeAt, civAt} from './board.js';
import {dampenIn} from './combat.js';

/**
 * @returns {{hits: Object<string, number>, atk: Object<string, boolean>}}
 *   hits — damage each of your units (or civilian, keyed 'c<l>,<c>') will take
 *   atk  — hostile uids that will attack rather than advance
 */
export function forecastThreat() {
  const hits = {};
  const atk = {};

  G.enemies.forEach(e => {
    const D = BEST[e.k];
    if (D.spd === 0 || e.stun) return;

    let willStrike = false;
    if (D.hold !== undefined && e.col <= D.hold) {
      willStrike = true;
    } else {
      const ahead = e.col - 1;
      if (ahead >= 0 && ((unitAt(e.lane, ahead) && !D.tunnel) || civAt(e.lane, ahead) || foeAt(e.lane, ahead))) {
        willStrike = true;
      }
    }
    if (!willStrike) return;

    let target = null;
    for (let c = e.col - 1; c >= 0; c--) {
      const u = unitAt(e.lane, c);
      if (u) { target = u; break; }
    }
    const cv = civAt(e.lane, e.col - 1);
    atk[e.uid] = true;

    if (cv) {
      const key = 'c' + cv.l + ',' + cv.c;
      hits[key] = (hits[key] || 0) + D.dmg;
    } else if (target) {
      hits[target.uid] = (hits[target.uid] || 0) + Math.max(1, D.dmg - dampenIn(target.lane));
    }
  });

  return {hits, atk};
}

/** Cells this unit is helping — buffs, heals, regeneration. Rendered blue. */
export function supportTargets(u) {
  const out = [];
  const add = o => { for (let i = 0; i < (o.size || 1); i++) out.push(o.lane * COLS + o.col + i); };

  if (u.aura) {
    G.units.forEach(o => {
      if (o.uid !== u.uid && Math.abs(o.lane - u.lane) + Math.abs(o.col - u.col) === 1) add(o);
    });
  }
  if (u.colBuff) G.units.forEach(o => { if (o.uid !== u.uid && o.col === u.col) add(o); });
  if (u.laneB) G.units.forEach(o => { if (o.uid !== u.uid && o.lane === u.lane) add(o); });

  if (u.heal || u.hot) {
    const wantsTech = u.healType === 'tech';
    if (u.healMode === 'front') {
      G.units.forEach(o => { if (o.lane === u.lane && o.col === u.col + 1 && !!o.tech === wantsTech) add(o); });
    } else {
      G.units.forEach(o => { if (o.uid !== u.uid && o.col === u.col && !!o.tech === wantsTech) add(o); });
    }
  }
  return out;
}

/** Cells where this unit suppresses the enemy. Rendered violet. */
export function influenceCells(u) {
  const out = [];
  if (u.dampen) for (let c = 0; c < COLS; c++) out.push(u.lane * COLS + c);
  return out;
}

/** One line describing what this unit does for its neighbours, or null. */
export function supportLabel(u) {
  if (u.aura) return 'Buffing adjacent friendlies';
  if (u.colBuff) return 'Buffing this column';
  if (u.laneB) return 'Buffing this lane';
  if (u.hot) return 'Regenerating ' + (u.healType === 'tech' ? 'Tech' : 'personnel') + ' in column';
  if (u.heal) {
    return 'Healing ' + (u.healMode === 'front'
      ? 'the unit ahead'
      : (u.healType === 'tech' ? 'Tech in column' : 'personnel in column'));
  }
  if (u.dampen) return 'Damping hostile damage in this lane';
  return null;
}
