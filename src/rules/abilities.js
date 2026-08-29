// Card abilities. One per card that has one, dispatched on card id.
//
// Cooldowns are set on use and tick down in the player phase; a Coolant Core
// shortens them by a turn, never below one.

import {COLS} from '../state/constants.js';
import {G} from '../state/session.js';
import {buffOf} from './units.js';
import {dmgEnemy} from './combat.js';
import {foeAt, unitAt} from './board.js';
import {clog} from './log.js';

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
};

export function useAbility(u) {
  if (!u.ab || u.cd > 0) return;
  u.cd = Math.max(1, (u.ab.cd || 1) - (u.cool ? 1 : 0));
  const run = ABILITIES[u.id];
  if (run) run(u);
}
