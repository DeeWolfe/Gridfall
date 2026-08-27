// Boot: install the presentation hooks, wire the shell's fixed controls, and
// put the record-select screen up.

import {G, active, profiles, sel, setActive, setG, setSel, setMover, MAPDEF} from '../state/session.js';
import {POOL} from '../content/cards.js';
import {costOf} from '../save/progression.js';
import {setHooks} from '../state/hooks.js';
import {store} from '../save/store.js';
import {blankProfile, saveAll, commit, initProfiles} from '../save/profile.js';
import {opRun, genRun} from '../rules/run.js';
import {launchGauntlet} from '../rules/mission.js';
import {$, show} from './dom.js';
import {ask, notify, dlgClose} from './dialog.js';
import {closeFocus, setFocusFollowUp} from './focus.js';
import {renderSlots} from './boot-screen.js';
import {enter, paintHold} from './hold.js';
import {startScene, stopScene, sizeScene, sceneRunning} from './battlefield.js';
import {renderModes} from './modes.js';
import {renderOps} from './ops.js';
import {renderMap} from './map.js';
import {drawAll, drawBoard} from './combat.js';
import {openPanel, renameShip} from './panels.js';
import {showPack, setAfterPacks} from './packs.js';
import {showResult} from './result.js';
import {applyUiMode, cycleUiMode, uiModeLabel, uiPreference} from './uimode.js';

const AUTOSAVE_MS = 20000;

/** Where to go once the result card and any packs have been dismissed. */
function afterMission(wasEndless, wasGauntlet, cleared) {
  if (wasEndless || (wasGauntlet && !cleared)) { show('modes'); renderModes(); return; }
  if (wasGauntlet && active.gaunt && active.gaunt.i < 4) { launchGauntlet(); return; }
  if (wasGauntlet) { show('modes'); renderModes(); return; }
  // A finished operation rolls a fresh set of missions to come back to.
  if (opRun().cleared.length >= MAPDEF.nodes.length) genRun();
  show('map');
  renderMap();
}

function wireResultButton() {
  $('rok').onclick = () => {
    $('result').classList.remove('on');
    const wasGauntlet = G && G.gauntlet;
    const wasEndless = G && G.endless;
    const cleared = !!(G && G.result && G.result.cleared);
    setG(null);

    const go = () => afterMission(wasEndless, wasGauntlet, cleared);
    setAfterPacks(go);
    if (!showPack()) go();
  };
}

function wireRecordScreen() {
  $('cancelnew').onclick = () => $('newform').classList.remove('on');
  $('create').onclick = () => {
    const v = $('callsign').value.trim();
    if (!v) return;
    const p = blankProfile(v);
    profiles.push(p);
    saveAll(profiles);
    $('newform').classList.remove('on');
    $('callsign').value = '';
    enter(p);
  };
  $('callsign').addEventListener('keydown', e => { if (e.key === 'Enter') $('create').click(); });
  $('switch').onclick = () => { commit(); stopScene(); setActive(null); show('boot'); renderSlots(); };
  // A visible swap on the hold screen, mirroring the Settings row.
  const uiChip = $('uiswap');
  if (uiChip) {
    const label = () => { uiChip.textContent = 'UI · ' + uiModeLabel(); };
    uiChip.onclick = () => { cycleUiMode(); label(); };
    label();
  }
}

function wireNavigation() {
  $('gomap').onclick = () => { stopScene(); show('modes'); renderModes(); };
  $('renameship').onclick = e => { e.stopPropagation(); renameShip(); };
  $('modesback').onclick = () => { show('hold'); startScene(); paintHold(); };
  $('opsback').onclick = () => { show('modes'); renderModes(); };
  $('mapback').onclick = () => { show('ops'); renderOps(); };
  $('pclose').onclick = () => $('panel').classList.remove('on');
  $('fbg').onclick = closeFocus;
  document.querySelectorAll('[data-p]').forEach(b => { b.onclick = () => openPanel(b.dataset.p); });
}

function wireDialog() {
  $('dlgok').onclick = () => dlgClose($('dlginput').style.display === 'block' ? $('dlginput').value : true);
  $('dlgno').onclick = () => dlgClose(false);
  $('dlgx').onclick = () => dlgClose(false);
  $('dlginput').addEventListener('keydown', e => { if (e.key === 'Enter') $('dlgok').click(); });
}

/** Number keys pick the nth card in hand — the desktop deployment path. */
function selectHandCard(index) {
  const cid = G.hand[index];
  if (!cid || G.over || costOf(cid) > G.dp) return;
  setSel(sel === cid ? null : cid);
  setMover(null);
  drawAll();
}

function wireKeyboard() {
  addEventListener('resize', () => {
    // `auto` follows the display, so a resize can change which layout applies.
    if (uiPreference() === 'auto') applyUiMode();
    if (sceneRunning()) sizeScene();
    if (G && $('combat').classList.contains('on')) drawBoard();
  });
  addEventListener('keydown', e => {
    if ($('focus').classList.contains('on')) {
      if (e.key === 'Escape') closeFocus();
      return;
    }
    if ($('combat').classList.contains('on') && G) {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        const p = $('actPrimary');
        if (p && !p.disabled && p.onclick) p.onclick();
      }
      if (e.key >= '1' && e.key <= '9') selectHandCard(Number(e.key) - 1);
      if (e.key === 'Escape') { setSel(null); setMover(null); drawAll(); }
      return;
    }
    if (e.key === 'Escape') $('panel').classList.remove('on');
  });
}

/**
 * Anything that escapes as an uncaught error drops the player back to the hold
 * with their progress saved, rather than leaving a half-drawn board up.
 */
function wireCrashGuard() {
  addEventListener('error', ev => {
    const m = (ev && ev.message) || 'Unknown error';
    try {
      notify('Something broke', m + '<br><br>Your progress is saved. Returning to the hold.');
    } catch { /* the dialog itself is gone; nothing more to do */ }
    try {
      if (active) { setG(null); show('hold'); paintHold(); }
      else { show('boot'); renderSlots(); }
    } catch { /* shell markup is gone; leave the page as it is */ }
  });
}

export function boot() {
  setHooks({
    invalidate: drawAll,
    enterCombat: () => { show('combat'); drawAll(); },
    showResult,
    notify,
    ask,
    saved: () => {
      const f = $('saveflag');
      if (!f) return;
      f.textContent = store.ephemeral
        ? 'Session only'
        : 'Saved ' + new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
    },
  });

  // Focus-overlay actions reopen the panel they came from, or redraw combat.
  setFocusFollowUp(panel => (panel ? openPanel(panel) : drawAll()));

  initProfiles();
  applyUiMode();
  wireCrashGuard();
  wireRecordScreen();
  wireNavigation();
  wireDialog();
  wireResultButton();
  wireKeyboard();

  setInterval(() => { if (active) commit(); }, AUTOSAVE_MS);
  addEventListener('beforeunload', commit);
  renderSlots();
}
