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
const {head, css} = pageParts(builtPage());
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
  if (!head.includes('id="uiswap"')) F.push('no layout swap on the hold screen');
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
  // The three-column board and the log rail are what make it a desktop layout.
  const mainRule = (/:root\[data-ui="pc"\] \.cbmain\{([^}]*)\}/.exec(css) || [])[1] || '';
  if ((mainRule.match(/clamp\(/g) || []).length < 2) F.push('desktop board is not three columns');
  if (!/:root\[data-ui="pc"\] \.cbcol\.intel\{[^}]*display:\s*flex/.test(css)) {
    F.push('the intel rail never appears on desktop');
  }
  if (!/^\.cbcol\.intel\{[^}]*display:\s*none/m.test(css)) {
    F.push('the intel rail is not hidden by default');
  }
}

// --- the combat log renders, and only the desktop layout shows it ---
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
  if (!head.includes('id="cblog"')) F.push('no combat log in the markup');
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

F.report('interface modes: all checks pass');
