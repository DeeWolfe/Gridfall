// Derived readings of the active profile: what a card costs right now, what
// gear is bolted to it, how far up the veterancy ladder it has climbed.

import {POOL} from '../content/cards.js';
import {GEAR} from '../content/gear.js';
import {LEADS} from '../content/leads.js';
import {LEADGATES} from '../content/lead-unlocks.js';
import {RANKS, VET} from '../content/ranks.js';
import {DECKSIZE} from '../state/constants.js';
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
 * The two machine classes, and what separates them.
 *
 * An EXO frame is a suit — Aegis Knights, the Ashura, the Exo Juggernaut, the
 * Thruster Ram. Proven, in service, and deployed like any other card.
 *
 * A PROTO frame is a prototype: bigger, further along, and not yet trusted to
 * walk itself onto a battlefield. It needs a Pilot already standing there, it
 * takes one deck slot of its own, and there is exactly one per mission. Every
 * rule that treats Frames specially keys off this, so the lore word and the
 * behaviour cannot drift apart.
 */
export const isProto = id => !!(POOL[id] && POOL[id].chassis === 'proto');
export const isExo = id => !!(POOL[id] && POOL[id].chassis === 'exo');
export const CHASSIS_NAME = {proto: 'Proto Frame', exo: 'Exo Frame'};

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
  return !isProto(id);
}

/**
 * A Frame's fitted weapon, or null. Frame gear REPLACES the printed weapon
 * rather than riding on top of it, so everything that reads a card's targeting
 * or damage has to ask this first — hence one accessor rather than the check
 * being rewritten at each call site.
 */
/**
 * The name a card wears for THIS commander. One card earns a callsign of its
 * own: the Frame Pilot — a person, not a machine, and yours to name in Squad.
 * Stored sanitized (setPilotName), so it is safe to interpolate into markup.
 */
export function cardName(id) {
  const k = POOL[id];
  if (!k) return id;
  if (k.pilot && active && active.pilotName) return active.pilotName;
  return k.n;
}

/** Trim, strip markup-dangerous characters, cap the length. '' clears it. */
export function setPilotName(raw) {
  if (!active) return;
  const clean = String(raw || '').replace(/[^\w \-'.]/g, '').trim().slice(0, 14);
  active.pilotName = clean || null;
}

export function frameWeapon(id) {
  if (!isProto(id)) return null;
  const g = gearOf(id);
  // Only gear that IS a weapon replaces the printed one — the Arm-Mounted
  // Blade grants an ability and leaves the longsword in hand.
  return g && g.frame === id && g.tg ? g : null;
}

/** Deploy-point cost including any gear discount. Never below 1. */
export function costOf(id) {
  const k = POOL[id];
  if (!k) return 99;
  const g = gearOf(id);
  // Quietstep: anything that lands on hostile ground goes in a point cheaper.
  const infiltrator = leadOf().passive && leadOf().passive.n === 'Quietstep' &&
    (k.drop || k.anyGround || (g && g.crush)) ? 1 : 0;
  // Ironwright: the machines — Proto Frames and exo suits alike — run cheaper.
  const wright = leadOf().frameDiscount && k.chassis ? leadOf().frameDiscount : 0;
  return Math.max(1, k.dp + (g && g.dp ? g.dp : 0) - infiltrator - wright);
}

/** Deck ceiling under the active lead — Coronet and Quartermaster run short. */
export const deckCapOf = () => leadOf().deckCap || DECKSIZE;

/**
 * The name of the lead's rule refusing this card, or null if it may deploy.
 * Coldwire fields no Specialists at all; Ironwright fields no Specialist
 * that is not a machine (a chassis — the Frame line and the exo suits).
 */
export function leadBan(id) {
  const k = POOL[id];
  if (!k) return null;
  const lead = leadOf();
  if (lead.banTier && k.t === lead.banTier) return lead.con.n;
  if (lead.banNonMachine && k.t === 'special' && !k.chassis) return lead.con.n;
  return null;
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
