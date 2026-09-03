// Card abilities. One per card that has one, dispatched on card id.
//
// Cooldowns are set on use and tick down in the player phase; a Coolant Core
// shortens them by a turn, never below one.

import {LANES, COLS} from '../state/constants.js';
import {G} from '../state/session.js';
import {buffOf} from './units.js';
import {dmgEnemy} from './combat.js';
import {foeAt, unitAt, civAt} from './board.js';
import {clog} from './log.js';
import {tapeEvent} from './tape.js';

// Fireteam armour abilities — dispatched on the kit's key, not the card id.
const ARMOUR = {
  // Armor Lock: nothing gets through this turn, and nothing gets out.
  lock(u) {
    u.locked = true;
    u.acted = true;
    u.moved = true;
    clog(`<span class="g">Armor Lock</span> — ${u.n} locked down.`, 'order');
  },
  // Drop Shield: a bubble over the four neighbours, one charge each.
  bubble(u) {
    let n = 0;
    G.units.forEach(o => {
      if (o.uid === u.uid || Math.abs(o.lane - u.lane) + Math.abs(o.col - u.col) !== 1) return;
      o.shield = Math.min(2, (o.shield || 0) + 1);
      n++;
    });
    clog(`<span class="g">Drop Shield</span> — ${n} neighbour${n === 1 ? '' : 's'} shielded.`, 'order');
  },
  // Hologram: the lane fires at the decoy this turn.
  holo(u) {
    u.holo = true;
    clog(`<span class="g">Hologram</span> — lane ${u.lane + 1} is shooting at a ghost this turn.`, 'order');
  },
};

const FURY_HITS = 4;
const FURY_DMG = 2;

const ABILITIES = {
  // Medic — Triage: patch every adjacent personnel unit instead of the one ahead.
  medic(u) {
    G.units
      .filter(o => o.uid !== u.uid && !o.tech &&
        Math.abs(o.lane - u.lane) + Math.abs(o.col - u.col) === 1)
      .forEach(o => { o.hp = Math.min(o.max, o.hp + 4); });
    clog('<span class="g">Triage</span> — adjacent personnel patched.', 'order');
  },

  // Bulwark — Brace: the shield holds against two attacks this turn.
  bulwark(u) {
    u.shield = (u.shieldMax || 1) + 1;
    clog(`<span class="g">Brace</span> — ${u.n} braced.`, 'order');
  },

  // Aegis Knights — Aegis Field: a shield for every friendly in the lane.
  aegis(u) {
    G.units.filter(o => o.lane === u.lane).forEach(o => { o.shield = Math.max(o.shield, 1); });
    clog(`<span class="g">Aegis Field</span> — lane ${u.lane + 1} shielded.`, 'order');
  },

  // Tech Medic — Full Restore: burst-repair column Tech and remake broken shields.
  techmed(u) {
    G.units.filter(o => o.col === u.col && o.tech).forEach(o => {
      o.hp = Math.min(o.max, o.hp + 8);
      if (o.att.shield === false) { o.att.shield = true; o.shield = 1; }
    });
    clog('<span class="g">Full Restore</span> — column tech repaired.', 'order');
  },

  // Orbital Dragoon — Thruster Leap: strike anything exactly two cells away.
  dragoon(u) {
    const reach = G.enemies.filter(e => Math.abs(e.lane - u.lane) + Math.abs(e.col - u.col) === 2);
    const t = reach.find(e => e.uid === u.tgt) || reach.sort((a, b) => b.hp - a.hp)[0];
    if (t) {
      dmgEnemy(t, 6 + buffOf(u), 'Thruster Leap', u.pen);
      clog('<span class="g">Thruster Leap</span> — vaulted and struck.', 'order');
    } else {
      clog('Thruster Leap found no target at range two.', 'order');
    }
  },

  // Exo Juggernaut — Hammer Charge: barrel two cells forward, or take the ground.
  exo(u) {
    let hit = null;
    for (let s = 1; s <= 2; s++) {
      const e = foeAt(u.lane, u.col + s);
      if (e) { hit = e; break; }
    }
    if (hit) {
      dmgEnemy(hit, 8 + buffOf(u), 'Hammer Charge', u.pen);
      if (hit.hp > 0) hit.stun = 1;
      clog('<span class="g">Hammer Charge</span> — impact.', 'order');
      return;
    }
    const nc = Math.min(COLS - 1, u.col + 2);
    if (!unitAt(u.lane, nc) && !foeAt(u.lane, nc)) {
      u.col = nc;
      clog('Hammer Charge — ground gained.', 'order');
    }
  },

  // Ashura Frame — Fatal Fury: four fast blows on the hostile at contact.
  // Less per hit than the heavy punch, more in total — and four separate
  // hits, so plating that bleeds a point a blow bleeds four.
  ashura(u) {
    const t = foeAt(u.lane, u.col + u.size);
    if (!t) {
      clog('Fatal Fury found nothing at contact.', 'order');
      return;
    }
    let blows = 0;
    for (let i = 0; i < FURY_HITS && t.hp > 0; i++) {
      dmgEnemy(t, FURY_DMG + (i === 0 ? buffOf(u) : 0), 'Fatal Fury', u.pen);
      blows++;
    }
    clog(`<span class="g">Fatal Fury</span> — ${blows} blow${blows > 1 ? 's' : ''} landed.`, 'order');
  },
};

export function useAbility(u) {
  if (!u.ab || u.cd > 0) return;
  // A cell-targeted ability (the Arm-Mounted Blade's thrust) never fires from
  // here — the board resolves it through doPierce once a cell is chosen.
  if (u.ab.target === 'cell') return;
  u.cd = Math.max(1, (u.ab.cd || 1) - (u.cool ? 1 : 0));
  // Gear-granted abilities dispatch on their own key; a card's printed
  // ability keeps dispatching on the card id.
  const run = (u.ab.key && ARMOUR[u.ab.key]) || ABILITIES[u.ab.key || u.id];
  if (run) run(u);
}

/**
 * Piercing Thrust (Arm-Mounted Blade): the cells the frame may dash to.
 *
 * The walk runs down the lane ahead: hostiles are passed THROUGH — they are
 * the point — while your own units, civilians, cratered ground and a boss
 * body all stop the blade. Every empty, reachable cell along the way is a
 * legal destination; the player picks the one that ends the dash.
 */
export function pierceTargets(u) {
  if (!u.ab || u.ab.key !== 'pierce' || u.cd > 0 || u.acted || u.stun) return [];
  const out = [];
  for (let c = u.col + 1; c < COLS; c++) {
    if (G.ter[u.lane][c] === 'x') break;
    if (unitAt(u.lane, c) || civAt(u.lane, c)) break;
    const e = foeAt(u.lane, c);
    if (e) {
      if (e.boss) break;                 // a machine is a wall, not a body
      continue;                          // run it through and keep going
    }
    out.push(u.lane * COLS + c);
  }
  return out;
}

const PIERCE_DMG = 8;

/** Resolve the thrust: damage everything passed through, land on the cell. */
export function doPierce(u, l, c) {
  if (!pierceTargets(u).includes(l * COLS + c)) return false;
  u.cd = Math.max(1, (u.ab.cd || 1) - (u.cool ? 1 : 0));
  const hit = G.enemies.filter(e => e.lane === u.lane && e.col > u.col && e.col < c);
  tapeEvent({type: 'clash', lane: u.lane, col: c});
  hit.forEach(e => dmgEnemy(e, PIERCE_DMG + buffOf(u), 'Piercing Thrust', u.pen, u));
  u.col = c;
  u.moved = true;
  u.acted = true;
  clog(`<span class="g">Piercing Thrust</span> — ${u.n} dashed to col ${c + 1}, ` +
    `${hit.length ? `running the blade through ${hit.length} hostile${hit.length > 1 ? 's' : ''}` : 'meeting nothing on the way'}.`, 'order');
  return true;
}
