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
  G.logs.unshift({h: html, c: cat || 'info'});
  if (G.logs.length > MAX_ENTRIES) G.logs.pop();
}
