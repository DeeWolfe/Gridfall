// The Frame system: a machine you commit a deck to.
//
// A Proto Frame is a 5 DP Specialist card SEEDED into the opening hand at
// launch, outside the deck and outside its size — same mechanism, and same
// reasoning, as the lead's stratagem. Its gear are cheap cards inside the
// deck, exclusive to their own Frame and playable only while it stands, so
// committing to a Frame means buying three of twelve slots into one plan.
// Seeding removes the LUCK from that gamble while keeping the cost: the
// Frame sits visible and unaffordable from turn one, and every turn you do
// not field it is a turn you chose something else.
//
// The Pilot is gone. It was a key card whose job ended the moment it worked,
// and it left a defenceless body on the board. The Frame deploys like any
// other unit now, and arrives with a functional base weapon — a bare Frame
// must be worth its cost alone; gear makes it dominant, not functional.

import {POOL} from '../content/cards.js';
import {G, active} from '../state/session.js';
import {isProto, leadOf, cardName, gearOf} from '../save/progression.js';
import {clog} from './log.js';

/** Seed the loadout's Frame into the opening hand, outside the deck. */
export function seedFrame() {
  const id = active && active.loadout ? active.loadout.frame : null;
  G.frame = null;
  // No Frame (Master Chief): the slot may hold a machine, but it never flies.
  const noFrame = leadOf().con && leadOf().con.n === 'No Frame';
  if (id && isProto(id) && POOL[id] && !noFrame) {
    G.hand.push(id);
    G.frame = {k: id};
  }
}

/** The unit a kit card bolts onto — its Frame, or the Fireteam — if it stands. */
export const kitHost = id => G.units.find(u => u.id === id) || null;

/** The standing host for a kit card: a named Frame, or any unit of the line it fits. */
export const hostFor = k => (k.frameGear ? kitHost(k.frameGear)
  : k.fits ? G.units.find(u => u.line === k.fits) || null : null);

/** The one Frame standing on the board, or null. Only one may stand. */
export const frameOnBoard = () => G.units.find(u => u.frame) || null;

/** The Frame card sitting unspent in the hand, or null — the bot reads this. */
export const frameReady = () => {
  if (!G || G.over) return null;
  const id = G.hand.find(c => POOL[c] && POOL[c].chassis === 'proto');
  return id && !frameOnBoard() ? id : null;
};

/**
 * Why this card cannot be played right now for Frame reasons, or null.
 *   - a Frame card waits while another Frame stands (one at a time);
 *   - a gear card is dead in hand unless ITS Frame is on the board.
 */
export function frameGateText(cid) {
  const k = POOL[cid];
  if (!k) return null;
  if (k.chassis === 'proto' && frameOnBoard()) return 'One Frame on the board at a time';
  // One of each Fireteam at a time: the card waits while its team stands.
  if (k.line && G.units.some(u => u.id === cid)) return `${k.n} is already on the field`;
  if (k.frameGear && !kitHost(k.frameGear)) return `${POOL[k.frameGear].n} must be on the board`;
  if (k.fits && !hostFor(k)) return 'A Fireteam must be on the board';
  return null;
}

/**
 * Bolt a gear card onto the standing Frame. Weapon gear replaces the current
 * weapon; support gear adds alongside. Field Refit trades under her own
 * rules: any displaced gear returns to hand, one gear total, the swap heals
 * 3 hull, and it costs no action of its own — the Frame still moves, fires
 * or uses its ability after, if it hadn't already this turn.
 */
export function applyFrameGear(u, cid) {
  const k = POOL[cid];
  const refit = leadOf().passive && leadOf().passive.n === 'Field Refit';
  const carried = [u.gearW, ...u.gearS].filter(Boolean);

  // Single Mount: everything already carried comes off — and back to hand,
  // which is the pro paying for the con. The refit itself patches the
  // machine and does NOT spend its turn: a Frame that hasn't acted yet
  // this turn can still move, fire or use its ability after the swap.
  if (refit && u.frame && carried.length) {
    carried.forEach(old => {
      G.hand.push(old);
      G.spent = (G.spent || []).filter(c => c !== old);   // back in play
      clog(`<span class="g">${POOL[old].n}</span> comes off ${u.n} — back in hand.`, 'order');
    });
    u.gearW = null;
    u.gearS = [];
    unmountWeapon(u);
    unmountSupports(u);
    u.hp = Math.min(u.max, u.hp + 3);
    clog(`<span class="g">Field Refit</span> — ${u.n} patched for 3 on the swap.`, 'order');
  }

  // Armour abilities: one carried at a time. The new one strips the last,
  // and every flag the last one set comes off with it.
  if (k.slot === 'armor') {
    // One armour ability at a time, two under a Kit Rack. The newest always
    // stays; the oldest comes off when the rack is full. Every flag is then
    // rebuilt from the set that remains, so nothing lingers from a piece that
    // was stripped.
    const cap = u.rack ? 2 : 1;
    const worn = u.gearS.filter(c => POOL[c].slot === 'armor');
    worn.push(cid);
    while (worn.length > cap) clog(`${POOL[worn.shift()].n} comes off ${u.n}.`, 'info');
    u.gearS = u.gearS.filter(c => POOL[c].slot !== 'armor').concat(worn);

    const fit = gearOf(u.id);
    u.camo = false;
    u.cloaked = false;
    u.jet = false;
    u.servo = !!(fit && fit.servo) || POOL[u.id].chassis === 'proto';
    u.ab = POOL[u.id].ab || null;
    worn.forEach(c => {
      const a2 = POOL[c];
      if (a2.camo) { u.camo = true; u.cloaked = true; }
      if (a2.jet) { u.jet = true; u.servo = true; }
      if (a2.ab) { u.ab = a2.ab; u.cd = 0; }
    });
    clog(`<span class="g">${k.n}</span> fitted to ${u.n}.`, 'order');
    return;
  }

  if (k.slot === 'weapon') {
    // Outside Field Refit a displaced weapon is simply torn off and lost.
    if (u.gearW && !refit) clog(`${POOL[u.gearW].n} is stripped off ${u.n} and lost.`, 'info');
    u.gearW = cid;
    u.tg = k.tg;
    u.dmg = (k.dmg || 0) + (u.gearDmg || 0);
    u.single = !!k.single;
    // A riposte is a TRAIT, not part of the weapon: Seven Blades answers
    // blows whatever it swings, and a Beam Saber adds its own on top.
    u.riposte = (POOL[u.id].riposte || 0) + (k.riposte || 0);
    // A kit can rewrite what the body IS, not just what it swings: the
    // Fireteam's Noble is a wall, Osiris arcs over walls, Shadow ignores
    // plate, Majestic steadies the line. Each reads from the kit or the card.
    const base = POOL[u.id];
    u.blocker = !!(base.blocker || k.blocker);
    u.pen = !!(base.pen || k.pen);
    u.indirect = !!(base.indirect || k.indirect);
    u.aura = base.aura || k.aura || 0;
    u.choose = !!(base.choose || k.choose);
    u.push = !!(base.push || k.push);
    u.recharge = !!(base.recharge || k.recharge);
    u.falloff = !!(base.falloff || k.falloff);
    u.cycling = 0;
  } else {
    u.gearS.push(cid);
    if (k.boost) { u.boost = true; u.servo = true; }
    if (k.twin) u.twin = true;
    if (k.resonate) u.resonate = (u.resonate || 0) + k.resonate;
    // Guardian Field: a standing aura, refreshed each turn in phases.js.
    if (k.auraShield) u.auraShield = true;
    // Core Booster: an anchored chassis may move once this is fitted.
    if (k.mobGrant) { u.mob = true; u.mobGrant = true; }
    // Devil's Drive: added to the gear-damage pool AND applied immediately,
    // so it lands whether the weapon was fitted before or after this.
    if (k.dmg) { u.gearDmg = (u.gearDmg || 0) + k.dmg; u.dmg += k.dmg; }
    // Devil's Drive: a live bonus read off current hull, not a fitted number.
    if (k.berserk) u.berserk = true;
  }
  clog(`<span class="g">${k.n}</span> fitted to ${u.n}.`, 'order');
}

/** Strip the weapon gear's numbers back to the card's printed base. */
function unmountWeapon(u) {
  const k = POOL[u.id];
  u.tg = k.tg || 'none';
  u.dmg = k.dmg || 0;
  u.single = !!k.single;
  u.riposte = k.riposte || 0;
  u.blocker = !!k.blocker;
  u.pen = !!k.pen;
  u.indirect = !!k.indirect;
  u.aura = k.aura || 0;
  u.choose = !!k.choose;
  u.push = !!k.push;
  u.recharge = !!k.recharge;
  u.falloff = !!k.falloff;
  u.cycling = 0;
}

function unmountSupports(u) {
  u.boost = false;
  u.servo = false;
  u.twin = false;
  u.resonate = 0;
  u.gearDmg = 0;
  u.auraShield = false;
  u.mobGrant = false;
  u.berserk = false;
}

/**
 * A destroyed Frame under Bushido's Code comes back to the hand — machine
 * and every attached gear together. The loss still counts as a loss; what
 * The Code buys is that it is never a PERMANENT one.
 */
export function salvageFrame(u) {
  if (!u.frame) return;
  if (!(leadOf().passive && leadOf().passive.n === 'The Code')) return;
  const back = [u.id, u.gearW, ...u.gearS].filter(Boolean);
  back.forEach(c => G.hand.push(c));
  G.spent = (G.spent || []).filter(c => !back.includes(c));
  clog(`<span class="g">The Code</span> — ${cardName(u.id)} recovered to hand` +
    (back.length > 1 ? ' with its gear' : '') + '.', 'order');
}
