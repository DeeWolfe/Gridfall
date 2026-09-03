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
import {isProto, leadOf, cardName} from '../save/progression.js';
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
  // A line deploys one team at a time, the way the Frames fly one machine.
  if (k.line && G.units.some(u => u.line === k.line)) return 'One Fireteam on the board at a time';
  if (k.frameGear && !kitHost(k.frameGear)) return `${POOL[k.frameGear].n} must be on the board`;
  if (k.fits && !hostFor(k)) return 'A Fireteam must be on the board';
  return null;
}

/**
 * Bolt a gear card onto the standing Frame. Weapon gear replaces the current
 * weapon; support gear adds alongside. Field Refit trades under her own
 * rules: any displaced gear returns to hand, one gear total, and the swap
 * spends the Frame's turn.
 */
export function applyFrameGear(u, cid) {
  const k = POOL[cid];
  const refit = leadOf().passive && leadOf().passive.n === 'Field Refit';
  const carried = [u.gearW, ...u.gearS].filter(Boolean);

  // Single Mount: everything already carried comes off — and back to hand,
  // which is the pro paying for the con. The swap is the machine's turn.
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
    u.acted = true;
  }

  // Armour abilities: one carried at a time. The new one strips the last,
  // and every flag the last one set comes off with it.
  if (k.slot === 'armor') {
    const prev = u.gearS.find(c => POOL[c].slot === 'armor');
    if (prev) {
      u.gearS = u.gearS.filter(c => c !== prev);
      clog(`${POOL[prev].n} comes off ${u.n}.`, 'info');
    }
    u.camo = false;
    u.cloaked = false;
    u.jet = false;
    u.servo = false;
    u.ab = POOL[u.id].ab || null;
    u.gearS.push(cid);
    if (k.camo) { u.camo = true; u.cloaked = true; }
    if (k.jet) { u.jet = true; u.servo = true; }
    if (k.ab) { u.ab = k.ab; u.cd = 0; }
    clog(`<span class="g">${k.n}</span> fitted to ${u.n}.`, 'order');
    return;
  }

  if (k.slot === 'weapon') {
    // Outside Field Refit a displaced weapon is simply torn off and lost.
    if (u.gearW && !refit) clog(`${POOL[u.gearW].n} is stripped off ${u.n} and lost.`, 'info');
    u.gearW = cid;
    u.tg = k.tg;
    u.dmg = k.dmg || 0;
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
  } else {
    u.gearS.push(cid);
    if (k.boost) { u.boost = true; u.servo = true; }
    if (k.twin) u.twin = true;
    if (k.resonate) u.resonate = (u.resonate || 0) + k.resonate;
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
}

function unmountSupports(u) {
  u.boost = false;
  u.servo = false;
  u.twin = false;
  u.resonate = 0;
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
