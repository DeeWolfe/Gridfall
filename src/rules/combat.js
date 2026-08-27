// Damage: dealing it, taking it, and repairing it.

import {LANES, COLS} from '../state/constants.js';
import {POOL} from '../content/cards.js';
import {BEST} from '../content/hostiles.js';
import {G, active} from '../state/session.js';
import {buffOf, leadBonus} from './units.js';
import {leadOf} from '../save/progression.js';
import {targetsFor, laneFloor} from './targeting.js';
import {clog} from './log.js';
import {tapeEvent} from './tape.js';

/** Scramblers shave 1 off every hostile attack in their lane. Does not stack. */
export const dampenIn = l => (G.units.some(o => o.dampen && o.lane === l) ? 1 : 0);

/** Record a first kill so the hostile's Database entry unlocks. */
function logContact(k) {
  if (active && !active.unlocks.enemies.includes(k)) active.unlocks.enemies.push(k);
}

/**
 * Apply `d` damage to a hostile. Armour floors subtract from it and always
 * leave at least 1 through, unless the source penetrates (`pen`).
 */
export function dmgEnemy(e, d, src, pen) {
  const dealt = pen ? d : Math.max(1, d - laneFloor(e));
  e.hp -= dealt;
  tapeEvent({type: 'hit', foe: true, lane: e.lane, col: e.col, amount: dealt, died: e.hp <= 0});
  if (e.hp > 0) return;

  G.enemies = G.enemies.filter(x => x.uid !== e.uid);
  G.kills++;
  if (G.quotaK === e.k) G.quotaHit++;
  if (G.mod === 'salvage') G.dp++;
  clog(`<span class="g">${src}</span> destroyed ${BEST[e.k].n}.`, 'kill');
  logContact(e.k);
}

/** 3x3 splash centred on (l, c). */
export function blast(l, c, d, src) {
  if (!d) return;
  G.enemies
    .filter(e => Math.abs(e.lane - l) <= 1 && Math.abs(e.col - c) <= 1)
    .forEach(e => dmgEnemy(e, d, src));
}

/**
 * Apply `d` damage to one of your units. Shields eat a whole blow each,
 * riposte answers back, and a Phase Cloak converts the first killing blow
 * into a single point of hull.
 */
export function dmgUnit(u, d, src, attacker) {
  d = Math.max(1, d - dampenIn(u.lane));
  // Riptide: a unit that repositioned last turn rides the blow, to a floor of 1.
  if (d > 1 && u.repositioned && leadOf().passive && leadOf().passive.n === 'Riptide') d -= 1;

  if (u.riposte && attacker && attacker.hp > 0) {
    dmgEnemy(attacker, u.riposte, u.n + ' riposte', false);
  }
  // Duel Protocol: the duelist cannot be touched until the player's next turn.
  if (u.dueled) {
    clog(`${u.n} slips the blow — Duel Protocol holds.`, 'info');
    return;
  }
  if (u.shield > 0) {
    u.shield--;
    u.att.shield = false;
    tapeEvent({type: 'shield', lane: u.lane, col: u.col});
    clog(`${u.n}'s shield held.`, 'loss');
    return;
  }

  u.hp -= d;
  tapeEvent({type: 'hit', foe: false, lane: u.lane, col: u.col, amount: d,
    died: u.hp <= 0 && !(u.phase && !u.phased)});
  if (u.hp <= 0 && u.phase && !u.phased) {
    u.phased = true;
    u.hp = 1;
    clog(`<span class="g">Phase Cloak</span> — ${u.n} slipped the killing blow.`, 'loss');
    return;
  }
  if (u.hp <= 0) {
    G.units = G.units.filter(x => x.uid !== u.uid);
    G.lost++;
    clog(`<span class="d">${src}</span> destroyed your ${u.n}.`, 'loss');
  }
}

/**
 * Fire this unit's weapon. `onPlay` swaps in the card's opening burst value —
 * gear damage rides along on top of it — and a Shoulder Cannon fires twice.
 */
export function fire(u, onPlay) {
  if (u.tg === 'none' || !u.dmg || u.stun) return;
  const k = POOL[u.id];
  const pristine = u.pristine && u.hp >= u.max ? u.pristine : 0;
  const gearBonus = u.dmg - (k.dmg || 0);
  const base = (onPlay && k.burst ? k.burst + gearBonus : u.dmg) + buffOf(u) + leadBonus(u) + pristine;

  for (let shot = 0; shot < (u.att.cannon ? 2 : 1); shot++) {
    const ts = targetsFor(u);
    if (!ts.length) break;
    ts.forEach(e => dmgEnemy(e, base, u.n, u.pen));

    // A recharge weapon spends the next turn cycling. Set to 2 because the
    // end-of-turn reset decrements once immediately after this fires.
    if (u.recharge) u.cycling = 2;

    // Outrider: survivors of the hit are driven back a cell. The push fails
    // quietly if the cell behind is occupied or off the board — damage stands,
    // and two bodies never share a cell.
    if (u.push) {
      ts.filter(e => e.hp > 0).forEach(e => {
        const back = e.col + 1;
        if (back >= COLS || G.ter[e.lane][back] === 'x') return;
        if (G.enemies.some(o => o.uid !== e.uid && o.lane === e.lane && o.col === back)) return;
        if (G.units.some(o => o.lane === e.lane && back >= o.col && back < o.col + o.size)) return;
        if (G.civ.some(v => v.l === e.lane && v.c === back && v.hp > 0)) return;
        e.col = back;
        clog(`${u.n} drove ${BEST[e.k].n} back a cell.`, 'order');
      });
    }

    // Plasma lingers on the first target's 3x3 for two turns.
    if (u.scorch && ts.length) {
      const t = ts[0];
      for (let dl = -1; dl <= 1; dl++) for (let dc = -1; dc <= 1; dc++) {
        const nl = t.lane + dl;
        const nc = t.col + dc;
        if (nl >= 0 && nl < LANES && nc >= 0 && nc < COLS) G.scorch[nl + ',' + nc] = 2;
      }
    }
  }
}

/**
 * Run this unit's support pass. Regenerators refresh their ticks; healers top
 * up the unit ahead or the whole column, filtered to the type they can treat
 * (Tech Medic repairs Knights, Bio Medic cannot).
 */
export function healPass(u, onPlay) {
  if (u.hot) {
    G.units
      .filter(o => o.col === u.col && o.uid !== u.uid && !o.tech)
      .forEach(o => { o.regenTicks = 2; });
    return;
  }
  if (!u.heal) return;

  const k = POOL[u.id];
  const amount = onPlay ? (k.healPlay || u.heal) : u.heal;
  const list = u.healMode === 'front'
    ? G.units.filter(o => o.lane === u.lane && o.col === u.col + 1)
    : u.healMode === 'adjacent'
      ? G.units.filter(o => Math.abs(o.lane - u.lane) + Math.abs(o.col - u.col) === 1)
      : G.units.filter(o => o.col === u.col && o.uid !== u.uid);

  list
    .filter(o => (u.healType === 'tech' ? o.tech : !o.tech))
    .forEach(o => { if (o.hp < o.max) o.hp = Math.min(o.max, o.hp + amount); });
}
