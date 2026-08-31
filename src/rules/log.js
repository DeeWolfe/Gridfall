// The combat log. Newest first, capped so a long Onslaught cannot grow it
// without bound. Entries carry a category so the renderer can colour them.

import {G} from '../state/session.js';

const MAX_ENTRIES = 120;

/**
 * @param {string} html  entry body, may contain markup
 * @param {'info'|'order'|'kill'|'loss'|'wave'} [cat]
 */
export function clog(html, cat) {
  if (!G) return;
  // The turn stamp is what lets the alert strip under the board show what just
  // happened rather than the newest loss line of the whole mission, which
  // would sit there unchanged for the rest of the game.
  G.logs.unshift({h: html, c: cat || 'info', t: G.turn});
  if (G.logs.length > MAX_ENTRIES) G.logs.pop();
}
