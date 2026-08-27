// Derived readings of the active profile: what a card costs right now, what
// gear is bolted to it, how far up the veterancy ladder it has climbed.

import {POOL} from '../content/cards.js';
import {GEAR} from '../content/gear.js';
import {LEADS} from '../content/leads.js';
import {LEADGATES} from '../content/lead-unlocks.js';
import {RANKS, VET} from '../content/ranks.js';
import {active} from '../state/session.js';

export const rankName = r => RANKS[Math.min(r - 1, RANKS.length - 1)];

/** Human-readable age of a timestamp, for the record-select screen. */
export const ago = t => {
  const d = Math.floor((Date.now() - t) / 864e5);
  return d < 1 ? 'today' : d === 1 ? 'yesterday' : d + ' days ago';
};

/** Veterancy standing of a card across this profile's whole career. */
export function vetOf(id) {
  const u = (active && active.usage && active.usage[id]) || 0;
  let t = 0;
  for (let i = VET.length - 1; i >= 0; i--) {
    if (u >= VET[i].at) { t = i; break; }
  }
  return {t, u, n: VET[t].n, col: VET[t].col, next: t < VET.length - 1 ? VET[t + 1].at : null};
}

/** The gear fitted to a card, or null. */
export function gearOf(id) {
  if (!active || !active.loadout || !active.loadout.gear) return null;
  return GEAR[active.loadout.gear[id]] || null;
}

/** Deploy-point cost including any gear discount. Never below 1. */
export function costOf(id) {
  const k = POOL[id];
  if (!k) return 99;
  const g = gearOf(id);
  // Quietstep: anything that lands on hostile ground goes in a point cheaper.
  const infiltrator = leadOf().passive && leadOf().passive.n === 'Quietstep' &&
    (k.drop || k.anyGround || (g && g.crush)) ? 1 : 0;
  return Math.max(1, k.dp + (g && g.dp ? g.dp : 0) - infiltrator);
}

/** The active profile's team lead, defaulting to Ironbrand. */
export function leadOf() {
  return LEADS[(active && active.lead) || 'ironbrand'] || LEADS.ironbrand;
}

/**
 * Is this lead available to the active profile? The starting three carry no
 * gate; the rest unlock off the service record.
 */
export function leadUnlocked(key) {
  const gate = LEADGATES[key];
  if (!gate || !active) return !gate;
  if (gate.req === 'rank') return active.progress.rank >= gate.value;
  if (gate.req === 'operationsCleared') return (active.stats.opsCleared || 0) >= gate.value;
  if (gate.req === 'gauntletClears') return (active.bests.gauntlet || 0) >= gate.value;
  if (gate.req === 'onslaughtBest') return (active.bests.onslaught || 0) >= gate.value;
  return false;
}

/** The gate line shown on a locked lead chip. */
export function leadGateText(key) {
  const gate = LEADGATES[key];
  if (!gate) return '';
  return gate.req === 'rank' ? `Reach rank ${gate.value}`
    : gate.req === 'operationsCleared' ? `Complete ${gate.value} operation${gate.value > 1 ? 's' : ''}`
      : gate.req === 'gauntletClears' ? 'Complete the Gauntlet'
        : gate.req === 'onslaughtBest' ? `Survive ${gate.value} Onslaught waves` : '';
}
