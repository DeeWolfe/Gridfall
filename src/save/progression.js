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

/**
 * Whether piece `gi` may be fitted to card `id`.
 *
 * Frames are closed kits, and that exclusivity is the whole point of them: a
 * Beam Saber fits the White Devil and nothing else, and no amount of general
 * gear goes on a Frame. Without this the Frames would just be chassis competing
 * for the same nineteen-piece pool as everything else, which is the opposite of
 * what makes them a commitment.
 *
 * One function, read by both fitting surfaces and by both directions of the
 * fitting flow, so the rule cannot be enforced in one place and forgotten in
 * the other.
 */
export function gearFits(id, gi) {
  const k = POOL[id];
  const g = GEAR[gi];
  if (!k || !g) return false;
  if (g.frame) return g.frame === id;
  return !k.frame;
}

/**
 * A Frame's fitted weapon, or null. Frame gear REPLACES the printed weapon
 * rather than riding on top of it, so everything that reads a card's targeting
 * or damage has to ask this first — hence one accessor rather than the check
 * being rewritten at each call site.
 */
export function frameWeapon(id) {
  const k = POOL[id];
  if (!k || !k.frame) return null;
  const g = gearOf(id);
  return g && g.frame === id ? g : null;
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
 * gate; the rest are Quartermaster goods, unlocked by purchase.
 */
export function leadUnlocked(key) {
  const gate = LEADGATES[key];
  if (!gate) return true;
  if (!active) return false;
  return (active.unlocks.leads || []).includes(key);
}

/** The price of an unlockable lead, or 0 for the free tier. */
export const leadPrice = key => (LEADGATES[key] ? LEADGATES[key].price : 0);

/** The gate line shown on a locked lead. */
export function leadGateText(key) {
  const gate = LEADGATES[key];
  return gate ? `${gate.price} cr at the Quartermaster` : '';
}
