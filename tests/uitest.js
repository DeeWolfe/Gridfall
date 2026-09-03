// Two layouts, one switch.
//
// The preference has three values (auto / pc / compact) but the DOM only ever
// carries a concrete one — `auto` is resolved in JS and stamped. That is the
// whole reason the stylesheet has a single set of desktop rules instead of a
// media query and an attribute selector kept in step by hand, so it is worth
// pinning down.
import './support/install-dom.js';
import * as A from './support/api.js';
import {get} from './support/dom.js';
import {failures, builtPage, pageParts} from './support/harness.js';
import {stillAir} from './support/fixtures.js';
import {
  UI_MODES, uiPreference, resolvedMode, applyUiMode, setUiMode, cycleUiMode, uiModeLabel,
} from '../src/render/uimode.js';
import {openPanel} from '../src/render/panels.js';
import {drawAll} from '../src/render/combat.js';

const F = failures();
const page = builtPage();
const {head, css} = pageParts(page);
const stamp = () => document.documentElement.dataset.ui;

// --- the preference round-trips through the profile ---
{
  const p = A.blankProfile('UI');
  A.enterProfile(p);
  if (uiPreference() !== 'auto') F.push('a fresh profile does not default to automatic');
  if (!['pc', 'compact'].includes(resolvedMode())) F.push('automatic resolved to ' + resolvedMode());

  for (const mode of ['pc', 'compact']) {
    setUiMode(mode);
    if (uiPreference() !== mode) F.push(`preference did not stick as ${mode}`);
    if (resolvedMode() !== mode) F.push(`${mode} did not take force`);
    if (stamp() !== mode) F.push(`document stamp is ${stamp()}, expected ${mode}`);
  }

  setUiMode('nonsense');
  if (uiPreference() !== 'compact') F.push('an unknown preference was accepted');

  // It has to survive a save/load round trip, or the choice is lost on reload.
  setUiMode('pc');
  const reloaded = A.initProfiles().find(x => x.id === p.id);
  if (!reloaded) F.push('profile did not persist');
  else if (reloaded.settings.ui !== 'pc') F.push('the layout choice did not persist to storage');
}

// --- cycling visits every mode and comes back round ---
{
  const seen = new Set();
  for (let i = 0; i < UI_MODES.length; i++) seen.add(cycleUiMode());
  if (seen.size !== UI_MODES.length) F.push(`cycling reached ${seen.size} of ${UI_MODES.length} modes`);
  if (!uiModeLabel()) F.push('no label for the current mode');
}

// --- both swap controls exist and are wired ---
{
  if (!head.includes('id="drawui"')) F.push('no layout swap in the pull-up drawer');
  openPanel('settings');
  const panel = get('pbody')._html;
  UI_MODES.forEach(m => {
    if (!panel.includes(`data-ui="${m}"`)) F.push(`Settings offers no ${m} option`);
  });
  if (!/In force/.test(panel)) F.push('Settings does not say which layout is in force');
  if (/undefined|NaN|\[object/.test(panel)) F.push('settings render artefact');
}

// --- the desktop layout is described once, under the stamp ---
{
  const desktopRules = (css.match(/:root\[data-ui="pc"\]/g) || []).length;
  if (desktopRules < 8) F.push(`only ${desktopRules} desktop rules — the layer looks incomplete`);
  if (/@media[^{]*pointer:\s*fine/.test(css)) {
    F.push('a pointer media query duplicates the stamped desktop layer');
  }
  // Board and details rail. The log used to be a third column here; it is an
  // overlay now, so a .cbcol.intel anywhere means the rail crept back and the
  // board is paying a grid track for a history nobody reads mid-turn.
  const mainRule = (/:root\[data-ui="pc"\] \.cbmain\{([^}]*)\}/.exec(css) || [])[1] || '';
  if (!/grid-template-columns/.test(mainRule)) F.push('desktop board has no column layout');
  if (/\.cbcol\.intel/.test(css) || head.includes('cbcol intel')) {
    F.push('the log is a grid column again — it should be the #logview overlay');
  }
}

// --- the combat log is an overlay, reachable from every layout ---
//
// As a column it was desktop-only, so the explanation of what just killed your
// unit was simply unavailable on a phone. Floating it makes one behaviour for
// every screen — and the alert strip carries the 3.6% that cannot wait.
{
  A.enterProfile(A.blankProfile('LOG'));
  setUiMode('pc');
  A.launch(Object.keys(A.opRun().nodes)[0]);
  stillAir();
  A.endTurn();
  drawAll();
  const log = get('cblog')._html;
  if (!log.includes('logline')) F.push('combat log rendered no entries');
  if (/undefined|NaN|\[object/.test(log)) F.push('combat log artefact');
  if (!head.includes('id="logview"')) F.push('no log overlay in the markup');
  if (!head.includes('id="alertstrip"')) F.push('no alert strip under the board');
  if (!head.includes('id="logtog"')) F.push('no way to open the log');
  // The overlay must not be gated behind a layout mode the way the rail was.
  if (/data-ui="pc"[^{]*#logview/.test(css)) F.push('the log overlay is desktop-only again');

  // The strip carries losses only. Anything else and it stops being an alert:
  // at 2.9 orders and 1.9 kills a turn it would be the noisy log all over again.
  const body = page.slice(page.indexOf('function paintAlert'));
  const fn = body.slice(0, body.indexOf('\n}'));
  if (!/c === 'loss'/.test(fn)) F.push('the alert strip is not filtered to losses');
  if (!/e\.t >=/.test(fn)) F.push('the alert strip does not expire — it will pin one line forever');
}

// --- number keys are advertised on the cards and in the controls list ---
{
  drawAll();
  // Hand cards are appended as elements, so the hint lives on the children
  // rather than in the container's innerHTML.
  const cards = get('hcards').children;
  if (!cards.length) F.push('no hand cards rendered');
  else if (!cards.some(c => c._html.includes('hkey'))) F.push('hand cards carry no number-key hint');
  else if (!cards[0]._html.includes('>1<')) F.push('the first card is not labelled 1');
  openPanel('settings');
  if (!/1 – 9/.test(get('pbody')._html)) F.push('the number-key shortcut is not documented');
}

// --- the log overlay carries the objective, pinned above the scroller ---
{
  if (!page.includes('id="objlog"')) F.push('no objective block in the log overlay');
  if (!page.includes("drawObjective('objlog')")) F.push('the log overlay never paints its objective');
  const src = page.slice(page.indexOf('id="logview"'), page.indexOf('id="logview"') + 600);
  if (src.indexOf('objlog') > src.indexOf('id="cblog"')) {
    F.push('the objective sits under the scrolling log rather than above it');
  }
  const obj = /\.lvobj\{([^}]*)\}/.exec(css);
  if (!obj) F.push('.lvobj rule missing');
  else if (!/flex:\s*0\s+0\s+auto/.test(obj[1])) F.push('the pinned objective can be squeezed by the log');
  const list = /\.lvlist\{([^}]*)\}/.exec(css);
  if (!list || !/overflow-y:\s*auto/.test(list[1])) F.push('the log itself does not scroll');
}

// --- a tab row that scrolls sideways fades its edge instead of drawing a bar ---
{
  const tabs = /\.tabs\{([^}]*)\}/.exec(css);
  if (!tabs) F.push('.tabs rule missing');
  else {
    if (!/overflow-x:\s*auto/.test(tabs[1])) F.push('tab rows no longer scroll sideways');
    if (!/scrollbar-width:\s*none/.test(tabs[1])) F.push('the tab row still draws a scrollbar under itself');
  }
  if (!/\.tabs::-webkit-scrollbar\{display:none\}/.test(css)) {
    F.push('the tab row still draws a webkit scrollbar');
  }
  // Hiding the bar without replacing the signal would just lose the affordance.
  if (!/\.swipe-r\{/.test(css) || !/\.swipe-l\{/.test(css)) F.push('no edge fade to replace the scrollbar');
  if (!page.includes("markSwipe('.tabs'")) F.push('nothing measures a tab row for overflow');
}

// --- the hand tray marks geared cards; the piece itself is in View card ---
{
  if (/class="gtag">\$\{g\.n\}/.test(page)) F.push('the hand card still prints its gear name');
  if (!page.includes('class="hgear"')) F.push('no gear mark on a geared hand card');
  if (!/\.hgear\{/.test(css)) F.push('.hgear rule missing');
}

// --- the seeded Frame sits IN the hand now, wearing the proto rail ---
{
  if (!page.includes('seedFrame()')) F.push('launch never seeds the Frame to hand');
  if (!page.includes("chassis === 'proto' ? ' proto'")) F.push('the hand tile never marks the Frame');
  if (!/\.hc\.proto\{/.test(css)) F.push('.hc.proto rule missing — the Frame looks like a dealt card');
}

F.report('interface modes: all checks pass');
