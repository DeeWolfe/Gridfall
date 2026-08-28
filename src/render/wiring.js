// Boot: install the presentation hooks, wire the shell's fixed controls, and
// put the record-select screen up.

import {G, active, profiles, sel, replaying, setActive, setG, setSel, setMover} from '../state/session.js';
import {costOf} from '../save/progression.js';
import {setHooks} from '../state/hooks.js';
import {store} from '../save/store.js';
import {blankProfile, saveAll, commit, initProfiles} from '../save/profile.js';
import {genRun, opComplete} from '../rules/run.js';
import {launchGauntlet, GAUNTLET_LEGS} from '../rules/mission.js';
import {$, show} from './dom.js';
import {ask, notify, dlgClose} from './dialog.js';
import {closeFocus, setFocusFollowUp, setLeadFollowUp} from './focus.js';
import {sfx} from './sound.js';
import {startMusic, musicOn, toggleMusic, setMusicMood} from './music.js';
import {renderSlots} from './boot-screen.js';
import {enter, paintHold, foldRoster} from './hold.js';
import {startScene, stopScene, sizeScene, sceneRunning} from './battlefield.js';
import {renderModes} from './modes.js';
import {renderOps} from './ops.js';
import {renderMap} from './map.js';
import {drawAll, drawBoard} from './combat.js';
import {openPanel, importRecordFlow} from './panels.js';
import {showPack, setAfterPacks} from './packs.js';
import {showResult} from './result.js';
import {applyUiMode, cycleUiMode, uiModeLabel, uiPreference} from './uimode.js';
import {enableTape} from '../rules/tape.js';
import {playTurn, skipReplay} from './playback.js';
import {maybeStartTutorial, tutorialTick} from './tutorial.js';

const AUTOSAVE_MS = 20000;

/** Where to go once the result card and any packs have been dismissed. */
function afterMission(wasEndless, wasGauntlet, cleared) {
  if (wasEndless || (wasGauntlet && !cleared)) { show('modes'); renderModes(); return; }
  if (wasGauntlet && active.gaunt && active.gaunt.i < GAUNTLET_LEGS) { launchGauntlet(); return; }
  if (wasGauntlet) { show('modes'); renderModes(); return; }
  // A finished operation — final node cleared — rolls fresh missions to
  // come back to; uncollected side objectives are forfeit with it.
  if (opComplete()) genRun();
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

/** The splash: tap anywhere for the login console; import stays separate. */
function wireTitleScreen() {
  $('title').onclick = ev => {
    if (ev && ev.target && ev.target.id === 'titleimport') return;
    renderSlots();
    show('boot');
  };
  $('titleimport').onclick = () => importRecordFlow(() => renderSlots());
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
  // The pull-up drawer: one tab on the hold/ops/map/modes screens. Tap to
  // slide the menu up, tap again to slide it back down. Combat has no drawer
  // — the screen is already busy enough without a menu fighting the hand and
  // action bar for space (see #title.on ~ #drawer etc. in the CSS).
  const drawer = $('drawer');
  const paintDrawer = () => {
    $('drawtab').textContent = drawer.classList.contains('up') ? '▼' : '▲';
    $('drawui').textContent = 'UI · ' + uiModeLabel();
    $('drawmus').textContent = 'Music · ' + (musicOn() ? 'On' : 'Off');
  };
  $('drawtab').onclick = () => { sfx('tap'); drawer.classList.toggle('up'); paintDrawer(); };
  $('drawset').onclick = () => { drawer.classList.remove('up'); paintDrawer(); openPanel('settings'); };
  $('drawui').onclick = () => { cycleUiMode(); paintDrawer(); };
  $('drawmus').onclick = () => { toggleMusic(); paintDrawer(); };
  $('drawhome').onclick = () => {
    drawer.classList.remove('up');
    paintDrawer();
    commit();
    stopScene();
    setActive(null);
    show('title');
  };
  paintDrawer();
}

function wireNavigation() {
  $('gomap').onclick = () => { stopScene(); show('modes'); renderModes(); };
  // The deployment readout jumps straight onto the active operation's map.
  $('readout').onclick = () => {
    stopScene();
    if (!active.ops[active.op]) genRun();
    show('map');
    renderMap();
  };
  $('modesback').onclick = () => { show('hold'); startScene(); paintHold(); };
  $('opsback').onclick = () => { show('modes'); renderModes(); };
  $('mapback').onclick = () => { show('ops'); renderOps(); };
  $('pclose').onclick = () => $('panel').classList.remove('on');
  $('fbg').onclick = closeFocus;
  document.querySelectorAll('[data-p]').forEach(b => { b.onclick = () => openPanel(b.dataset.p); });
}

function wireDialog() {
  $('dlgok').onclick = () => {
    if ($('dlgpaste').style.display === 'block') return dlgClose($('dlgpaste').value);
    dlgClose($('dlginput').style.display === 'block' ? $('dlginput').value : true);
  };
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
      if (replaying) { skipReplay(); return; }
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
  const repaint = () => { drawAll(); tutorialTick(); };

  // The atmosphere starts on the first gesture — the earliest moment autoplay
  // policy allows a context — and startMusic itself checks the profile switch.
  if (typeof document !== 'undefined' && document.addEventListener) {
    ['pointerdown', 'keydown', 'click'].forEach(ev =>
      document.addEventListener(ev, () => startMusic(), {once: true}));
  }
  setHooks({
    invalidate: repaint,
    turnResolved: frames => {
      // Playback wants a real browser: skip it for reduced-motion users and in
      // the stub DOM the harnesses run (no matchMedia there).
      let animate = false;
      try {
        animate = typeof matchMedia === 'function' &&
          !matchMedia('(prefers-reduced-motion: reduce)').matches;
      } catch { animate = false; }
      if (!animate || !frames.length || !$('combat').classList.contains('on')) return false;
      return playTurn(frames, repaint);
    },
    enterCombat: () => { setMusicMood('combat'); show('combat'); drawAll(); maybeStartTutorial(); },
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
  // A lead assigned from the focus view folds whichever roster it came from;
  // a recruit just repaints the surface so the tile unlocks in place.
  setLeadFollowUp((ctx, action) => {
    if (ctx === 'ops') {
      if (action === 'assign') foldRoster('#opsbody', renderOps);
      else renderOps();
    } else if (ctx === 'squad') {
      if (action === 'assign') foldRoster('#pbody', () => openPanel('squad'));
      else openPanel('squad');
    } else openPanel('quartermaster');
  });

  initProfiles();
  applyUiMode();
  enableTape();
  wireCrashGuard();
  wireTitleScreen();
  wireRecordScreen();
  wireNavigation();
  wireDialog();
  wireResultButton();
  wireKeyboard();

  setInterval(() => { if (active) commit(); }, AUTOSAVE_MS);
  addEventListener('beforeunload', commit);
  renderSlots();
}
