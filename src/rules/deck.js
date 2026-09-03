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
export function drawCard(force) {
  if (!force && G.hand.length >= HAND_CAP) return false;
  if (!G.deck.length) {
    const back = active.loadout.deck.filter(c => POOL[c] && !G.hand.includes(c));
    if (!back.length) return false;
    G.deck = shuffle([...back]);
    clog('<span class="t">Reserve cycled</span> — fresh requisition available.', 'info');
  }
  G.hand.push(G.deck.pop());
  return true;
}
