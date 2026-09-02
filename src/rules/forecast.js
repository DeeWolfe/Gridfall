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
import {eventStrikeMalus} from './events.js';
import {bossSelThreat} from './boss.js';

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
    // Unarmed hostiles (the Mender) never strike; mirrors actHostile.
    if (D.spd === 0 || e.stun || !D.dmg) return;

    let willStrike = false;
    if (D.hold !== undefined && e.col <= D.hold) {
      willStrike = true;
    } else {
      const ahead = e.col - 1;
      const au = ahead >= 0 ? unitAt(e.lane, ahead) : null;
      // Mirrors actHostile: a minefield is not an obstacle, so it draws no strike.
      if (ahead >= 0 && ((au && !D.tunnel && !au.mine) || civAt(e.lane, ahead) || foeAt(e.lane, ahead))) {
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

    // Mirrors strike(): the chorus aura and a Seismic Tremor shift every blow.
    const chorus = G.enemies.some(o => BEST[o.k].aura) ? 1 : 0;
    const raw = Math.max(1, D.dmg + chorus - eventStrikeMalus());
    if (cv) {
      const key = 'c' + cv.l + ',' + cv.c;
      hits[key] = (hits[key] || 0) + raw;
    } else if (target) {
      // Mirrors strike(): an I-Field swallows any hit that is not adjacent.
      if (target.ifield && target.col + target.size - 1 < e.col - 1) return;
      hits[target.uid] = (hits[target.uid] || 0) + Math.max(1, raw - dampenIn(target.lane));
    }
  });

  return {hits, atk};
}

/**
 * What one hostile will do this coming turn, for the intent badge on its
 * chip. Mirrors actHostile() the way forecastThreat mirrors the strike half:
 * if the two drift, the badge lies.
 *   {k:'strike', dmg}    it will attack for dmg
 *   {k:'advance', steps} it will move toward the line
 *   {k:'mend'}           it will heal a wounded hostile
 *   {k:'spawn'}          it will (eventually) release a crawler
 *   {k:'hold'}           it will do nothing visible
 */
export function enemyIntent(e) {
  const D = BEST[e.k];
  if (e.stun) return {k: 'hold'};
  if (D.spawn) return {k: 'spawn'};
  if (D.spd === 0) return {k: 'hold'};

  const chorus = G.enemies.some(o => BEST[o.k].aura) ? 1 : 0;
  const dmg = Math.max(1, (D.dmg || 0) + chorus - eventStrikeMalus());

  if (D.mend && G.enemies.some(o =>
    o.uid !== e.uid && o.lane === e.lane && o.hp < BEST[o.k].hp)) return {k: 'mend'};
  if (D.hold !== undefined && e.col <= D.hold) return {k: 'strike', dmg};

  const ahead = e.col - 1;
  const au = ahead >= 0 ? unitAt(e.lane, ahead) : null;
  const blocked = ahead >= 0 && ((au && !D.tunnel && !au.mine) || civAt(e.lane, ahead));
  const queued = ahead >= 0 && foeAt(e.lane, ahead);
  if (blocked || queued) return D.dmg ? {k: 'strike', dmg} : {k: 'hold'};
  return {k: 'advance', steps: Math.max(1, Math.floor((e.mv || 0) + D.spd))};
}

/**
 * What a selected hostile threatens, for the board highlight.
 *
 * Reads the same decision enemyIntent() makes — strike versus advance — and
 * turns it into ground rather than a word, so the two can never disagree about
 * what a hostile is about to do.
 *
 *   strike  the cell it hits this turn
 *   threat  ground it can reach: the lane it fires down, or the cells it
 *           crosses closing in. Putting a unit anywhere in here changes who
 *           gets hit, which is exactly what the player needs to see.
 *   infl    its standing effect on the lane (armour, jamming, healing, seizing)
 *
 * @returns {{strike:number[], threat:number[], infl:number[]}} cell indices
 */
export function foeThreatCells(e) {
  // A boss cell threatens what its script says, not what a bestiary damage
  // number would — the machines answer in boss.js, beside the ticks they
  // have to stay honest with.
  if (e.boss) return bossSelThreat(e);
  const D = BEST[e.k];
  const strike = [];
  const threat = [];
  const infl = [];
  const idx = (l, c) => l * COLS + c;

  // Emplacements project a lane, not a step. The Chorus is the exception —
  // its aura is the whole board, which no highlight can usefully draw.
  if (D.lanefloor || D.jam || D.mend || D.mindctrl) {
    for (let c = 0; c < COLS; c++) infl.push(idx(e.lane, c));
  }
  if (e.stun || !D.dmg) return {strike, threat, infl};

  // strike() walks back down the lane for the first body standing in it.
  let hit = null;
  for (let c = e.col - 1; c >= 0; c--) {
    if (unitAt(e.lane, c) || civAt(e.lane, c)) { hit = c; break; }
  }

  // Ranged hostiles hold at a column and fire the length of the lane, so the
  // whole lane behind them is live — not just the body currently in front.
  if (D.hold !== undefined && e.col <= D.hold) {
    for (let c = e.col - 1; c >= 0; c--) threat.push(idx(e.lane, c));
    if (hit !== null) strike.push(idx(e.lane, hit));
    return {strike, threat, infl};
  }

  const ahead = e.col - 1;
  const au = ahead >= 0 ? unitAt(e.lane, ahead) : null;
  const blocked = ahead >= 0 && ((au && !D.tunnel && !au.mine) || civAt(e.lane, ahead));
  const queued = ahead >= 0 && foeAt(e.lane, ahead);
  if (blocked || queued) {
    if (hit !== null) strike.push(idx(e.lane, hit));
    return {strike, threat, infl};
  }

  // Otherwise it closes. Show the ground it crosses, stopping where it would.
  const steps = Math.max(1, Math.floor((e.mv || 0) + D.spd));
  for (let d = 1; d <= steps; d++) {
    const c = e.col - d;
    if (c < 0 || c === hit) break;
    if (foeAt(e.lane, c)) break;
    threat.push(idx(e.lane, c));
  }
  return {strike, threat, infl};
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

  if (u.techBuff) {
    G.units.forEach(o => { if (o.lane === u.lane && o.col === u.col + u.size && o.tech) add(o); });
  }
  if (u.sustain) {
    G.units.forEach(o => {
      if (o.uid !== u.uid && Math.abs(o.lane - u.lane) + Math.abs(o.col - u.col) === 1) add(o);
    });
  }

  if (u.heal || u.hot) {
    const wantsTech = u.healType === 'tech';
    if (u.healMode === 'front') {
      G.units.forEach(o => { if (o.lane === u.lane && o.col === u.col + 1 && !!o.tech === wantsTech) add(o); });
    } else if (u.healMode === 'adjacent') {
      G.units.forEach(o => {
        if (Math.abs(o.lane - u.lane) + Math.abs(o.col - u.col) === 1 && !!o.tech === wantsTech) add(o);
      });
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
  if (u.techBuff) return 'Boosting and repairing the Tech unit ahead';
  if (u.sustain) return 'Repairing neighbours and hurrying their cooldowns';
  if (u.hot) return 'Regenerating ' + (u.healType === 'tech' ? 'Tech' : 'personnel') + ' in column';
  if (u.heal) {
    return 'Healing ' + (u.healMode === 'front' ? 'the unit ahead'
      : u.healMode === 'adjacent' ? 'adjacent friendlies'
        : (u.healType === 'tech' ? 'Tech in column' : 'personnel in column'));
  }
  if (u.mine) return 'Armed — detonates on the first hostile to enter';
  if (u.dampen) return 'Damping hostile damage in this lane';
  return null;
}
