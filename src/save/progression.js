// Derived readings of the active profile: what a card costs right now, what
// gear is bolted to it, how far up the veterancy ladder it has climbed.

import {POOL} from '../content/cards.js';
import {GEAR} from '../content/gear.js';
import {LEADS} from '../content/leads.js';
import {LEADGATES} from '../content/lead-unlocks.js';
import {RANKS, VET} from '../content/ranks.js';
import {DECKSIZE} from '../state/constants.js';
import {active, G} from '../state/session.js';

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

/**
 * The loadout actually in force.
 *
 * A Deep Run brings its own deck, gear and lead — drafted inside the run and
 * stored on `active.run`, never on the profile's loadout. Every reader below
 * goes through here rather than at `active.loadout` directly, so the run is
 * invisible to them: the same costOf(), gearOf() and leadOf() answer for a
 * campaign mission and a run mission without either knowing the other exists.
 *
 * Outside a run mission this is the profile, unchanged.
 */
export function liveLoadout() {
  if (G && G.run && active && active.run) {
    // A run drafts no Proto Frame, so it flies none — the profile's Frame is
    // not the run's to field.
    return {deck: active.run.deck, gear: active.run.gear, lead: active.run.lead || 'ironbrand', frame: null};
  }
  if (!active) return {deck: [], gear: {}, lead: 'ironbrand', frame: null};
  return {
    deck: (active.loadout && active.loadout.deck) || [],
    gear: (active.loadout && active.loadout.gear) || {},
    lead: active.lead || 'ironbrand',
    frame: (active.loadout && active.loadout.frame) || null,
  };
}

/** The gear fitted to a card, or null. */
export function gearOf(id) {
  return GEAR[liveLoadout().gear[id]] || null;
}

/**
 * The two machine classes, and what separates them.
 *
 * An EXO frame is a suit — Aegis Knights, the Ashura, the Exo Juggernaut, the
 * Thruster Ram. Proven, in service, and deployed like any other card.
 *
 * A PROTO frame is a prototype: bigger, further along, and yours to commit a
 * deck to. It rides its own loadout slot, is seeded into the opening hand at
 * launch, and runs a closed kit of gear cards no other unit may wear. Every
 * rule that treats Frames specially keys off this, so the lore word and the
 * behaviour cannot drift apart.
 */
export const isProto = id => !!(POOL[id] && POOL[id].chassis === 'proto');
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
  // No body, no gear slot: a Frame's kit card, a command call, an instant or
  // an attachment never stands on the board, so armoury gear has nothing to
  // ride on. And a Frame's own kit is cards in the deck, never armoury pieces.
  if (k.frameGear || k.fits || k.strat || k.instant || k.attach) return false;
  // Line gear (the Fireteam weapons) fits only that line; a Frame-bound piece
  // fits only its Frame.
  if (g.fits && k.line !== g.fits) return false;
  // A team-bound weapon fits its own team and no other.
  if (g.team && id !== g.team) return false;
  if (g.frame && id !== g.frame) return false;
  return !isProto(id);
}

/** The name a card wears. One accessor so a rename system can return later. */
export function cardName(id) {
  const k = POOL[id];
  return k ? k.n : id;
}

/** Deploy-point cost including any gear discount. Never below 1. */
export function costOf(id) {
  const k = POOL[id];
  if (!k) return 99;
  const g = gearOf(id);
  // Quietstep: anything that lands on hostile ground goes in a point cheaper.
  const infiltrator = leadIs('quietstep') && (k.drop || k.anyGround || (g && g.crush)) ? 1 : 0;
  // Spartan Company: the Fireteam line — the team itself and anything that
  // fits it — goes in a point cheaper under the Master Chief.
  const spartan = leadIs('masterchief') && (k.line === 'fireteam' || k.fits === 'fireteam') ? 1 : 0;
  // The Code: a salvaged Frame is already built — fielding it again costs
  // less than building one from nothing. One-time, spent alongside the card.
  const salvaged = (G && G.salvageDiscount && G.salvageDiscount[id]) || 0;
  return Math.max(1, k.dp + (g && g.dp ? g.dp : 0) - infiltrator - spartan - salvaged);
}

/** Deck ceiling under the active lead — Coronet and Quartermaster run short. */
export const deckCapOf = () => leadOf().deckCap || DECKSIZE;

/**
 * The name of the lead's rule refusing this card, or null if it may deploy.
 * Coldwire fields no Specialists at all — the Frame line included.
 */
export function leadBan(id) {
  const k = POOL[id];
  if (!k) return null;
  const lead = leadOf();
  if (lead.banTier && k.t === lead.banTier) return lead.con.n;
  // No Frame: the Master Chief fields no Proto Frame, seeded or not.
  if (leadIs('masterchief') && k.chassis === 'proto') return lead.con.n;
  return null;
}

/**
 * Build-table rules a deck can break as a whole, not card by card: the
 * one-line rule (a deck fields the Fireteam line or the Frame line, never
 * both) and Lone Spartan (the Master Chief carries one Fireteam). Read by
 * the Squad page and by the launch guard, so a broken deck is refused at
 * the door with the same words it was warned with.
 * @returns {{n:string, d:string}[]}
 */
export function deckProblems(deck = active && active.loadout ? active.loadout.deck : [],
  frame = active && active.loadout ? active.loadout.frame : null) {
  // The one-line rule (Fireteam line or Frame line, never both) and Lone
  // Spartan lived here in v2.33 and were shelved in v2.33.3 pending play
  // testing: twelve slots already make a mixed deck a bad deck, and the
  // Master Chief's No Frame covers his own. The hook stays — the Squad page
  // and the launch guard still read it — so a rule can come back as one line.
  void deck; void frame;
  return [];
}

/** The team lead in force — the run's while a Deep Run mission is live. */
export function leadOf() {
  return LEADS[liveLoadout().lead] || LEADS.ironbrand;
}

/**
 * Is `key` the lead in command?
 *
 * Every rule a lead bends used to be matched on the display name of its
 * perk, which quietly made those strings load-bearing: rewording a perk, or
 * even correcting its spelling, switched the rule off with nothing to catch
 * it. The id is the stable key, so that is what the rules ask for; the prose
 * above stays prose.
 */
export const leadIs = key => (LEADS[liveLoadout().lead] ? liveLoadout().lead : 'ironbrand') === key;

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
