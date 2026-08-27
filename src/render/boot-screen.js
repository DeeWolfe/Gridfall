// The record-select screen: three profile slots.

import {profiles, setProfiles} from '../state/session.js';
import {saveAll} from '../save/profile.js';
import {rankName, ago} from '../save/progression.js';
import {$} from './dom.js';
import {ask} from './dialog.js';
import {enter} from './hold.js';

const SLOTS = 3;

export function renderSlots() {
  const el = $('slots');
  el.innerHTML = '';

  for (let i = 0; i < SLOTS; i++) {
    const p = profiles[i];
    const b = document.createElement('button');

    if (p) {
      b.className = 'slot';
      b.innerHTML = `<div><div class="cs">${p.callsign}</div><div class="meta">${rankName(p.progress.rank)} · ${p.stats.deployments} deployments · ${ago(p.lastPlayed)}</div></div>
        <div style="display:flex;align-items:center;gap:8px"><span style="font-size:0.5625rem;color:var(--dim)">0${i + 1}</span><span class="del" data-del="1">DEL</span></div>`;
      b.onclick = ev => {
        if (ev.target.dataset.del) {
          ask('Erase record', `Permanently delete <b style="color:var(--zan)">${p.callsign}</b>? This cannot be undone.`,
            ok => {
              if (!ok) return;
              setProfiles(profiles.filter(x => x.id !== p.id));
              saveAll(profiles);
              renderSlots();
            }, {ok: 'Erase'});
          return;
        }
        enter(p);
      };
    } else {
      b.className = 'slot empty';
      b.innerHTML = `<div><div class="cs">Empty record</div><div class="meta">Create a new task force</div></div><span style="font-size:0.5625rem;color:var(--dim)">0${i + 1}</span>`;
      b.onclick = () => { $('newform').classList.add('on'); $('callsign').focus(); };
    }
    el.appendChild(b);
  }
}
