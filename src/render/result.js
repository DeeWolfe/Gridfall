// The end-of-mission card. Reads `G.result`, which the rules layer filled in;
// it decides nothing itself.

import {G} from '../state/session.js';
import {$} from './dom.js';
import {sfx} from './sound.js';

export function showResult() {
  const r = G && G.result;
  if (!r) return;

  sfx(r.kind === 'win' ? 'win' : 'lose');
  $('rcard').className = 'rcard ' + r.kind;
  $('rt').textContent = r.title;

  // Every loss has always led with its reason; wins arrived with none at all,
  // which is why "why did I win?" was a fair question. Same line, both ways.
  const why = r.why ? `<span class="rwhy">${r.why}</span><br>` : '';
  const payout = r.payout
    ? `<br><br><b style="color:var(--gold)">+${r.payout.cr} credits</b>`
    : '';
  $('rs').innerHTML = why + r.lines.join('<br>') + payout;
  $('result').classList.add('on');
}
