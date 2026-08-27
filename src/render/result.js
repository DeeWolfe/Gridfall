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

  const payout = r.payout
    ? `<br><br><b style="color:var(--gold)">+${r.payout.cr} credits</b> · <b style="color:var(--cyan)">+${r.payout.sv} salvage</b>`
    : '';
  $('rs').innerHTML = r.lines.join('<br>') + payout;
  $('result').classList.add('on');
}
