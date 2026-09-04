// The 12-card deck: drawing, and cycling the reserve when it runs dry.

import {HAND_CAP} from '../state/constants.js';
import {POOL} from '../content/cards.js';
import {G, active} from '../state/session.js';
import {shuffle} from '../state/rng.js';
import {clog} from './log.js';

/**
 * Draw one card. An empty deck reshuffles from the loadout, minus whatever is
 * already in hand — so cycling never hands you a duplicate of a card you hold.
 *
 * `force` is the card-effect exemption. The turn draw stops at HAND_CAP so the
 * tray stays one row; a card you spent DP on to draw is not going to no-op
 * because of a layout rule, so Recon and Falconer pass it. Nothing is lost
 * when the cap holds a draw — the card stays on top of the deck for next turn.
 *
 * @param {boolean} [force] bypass the hand cap (card effects only)
 * @returns {boolean} whether a card actually moved
 */
/**
 * A Fireteam is one card and one team: while it stands it is out of the draw
 * pile, and when it is lost the card goes straight back into the deck at a
 * random depth — not the hand, not the discard, the deck — so the next cycle
 * is not needed to see it again.
 */
export function recycleLineCard(u) {
  if (!u || !u.line || !G || !G.deck) return;
  if (!active || !active.loadout.deck.includes(u.id)) return;
  if (G.deck.includes(u.id) || G.hand.includes(u.id)) return;
  if (G.units.some(o => o.id === u.id)) return;           // another copy still stands
  G.deck.splice(Math.floor(Math.random() * (G.deck.length + 1)), 0, u.id);
  clog(`<span class="t">${POOL[u.id].n}</span> — the card returns to the deck.`, 'info');
}

export function drawCard(force) {
  if (!force && G.hand.length >= HAND_CAP) return false;
  if (!G.deck.length) {
    // ...and minus any kit already played this mission — Frame gear and
    // Fireteam armour alike are one use a mission, so a reshuffle never
    // deals a card with nothing left to do.
    // ...and minus any Fireteam that is standing on the field right now — one
    // of each team at a time; it comes back the moment the team is lost.
    const back = active.loadout.deck.filter(c => POOL[c] && !G.hand.includes(c) && !(G.spent || []).includes(c)
      && !(POOL[c].line && G.units.some(u => u.id === c)));
    if (!back.length) return false;
    G.deck = shuffle([...back]);
    clog('<span class="t">Reserve cycled</span> — fresh requisition available.', 'info');
  }
  G.hand.push(G.deck.pop());
  return true;
}
