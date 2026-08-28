// The patch notes overlay. Reuses the hold panels' DOM (#panel/#pbody)
// directly rather than going through openPanel(), because openPanel() gates
// on an active profile and this has to work from the title screen too —
// before a commander has authenticated, or even created a record.

import {VERSION, PATCH_NOTES} from '../content/patch-notes.js';
import {$} from './dom.js';

export function openPatchNotes() {
  $('ptitle').textContent = 'Patch Notes';
  $('pbody').innerHTML = `<div class="bar"><div>You're running <b style="color:var(--gold)">v${VERSION}</b></div>
      <div style="color:var(--dim);font-size:0.6875rem">What's shipped, newest first.</div></div>` +
    PATCH_NOTES.map(({v, notes}, i) => `
      <div class="sect">v${v}${i === 0 ? ' <span class="patchcur">· current</span>' : ''}</div>
      <div class="patchnotes">${notes.map(n => `<div class="patchnote">${n}</div>`).join('')}</div>`).join('');
  $('panel').classList.add('on');
}
