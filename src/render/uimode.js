// Which interface the player gets.
//
// Two layouts ship: `compact`, the touch-first one that stacks and scrolls, and
// `pc`, a denser desktop layout that keeps the combat log on screen in the
// details rail, plus hover states and number-key deployment.
//
// The stored preference has three values, but the DOM only ever carries a
// concrete one: `auto` is resolved here and stamped as `pc` or `compact`. That
// keeps the stylesheet to a single set of `:root[data-ui="pc"]` blocks instead
// of duplicating every rule between a media query and an attribute selector.

import {active} from '../state/session.js';
import {commit} from '../save/profile.js';

/** What the player can choose. `auto` follows the display. */
export const UI_MODES = ['auto', 'pc', 'compact'];

export const UI_LABELS = {auto: 'Automatic', pc: 'Desktop', compact: 'Compact'};

// A pointing device and room to use it. Touch laptops report `coarse` for the
// primary pointer, so `any-pointer` would be too generous here.
const DESKTOP_QUERY = '(min-width: 1200px) and (pointer: fine)';

/** The player's stored preference, defaulting to `auto`. */
export function uiPreference() {
  const stored = active && active.settings && active.settings.ui;
  return UI_MODES.includes(stored) ? stored : 'auto';
}

/** What `auto` resolves to on this display right now. */
function detectMode() {
  try {
    return typeof matchMedia === 'function' && matchMedia(DESKTOP_QUERY).matches ? 'pc' : 'compact';
  } catch {
    return 'compact';
  }
}

/** The layout actually in force. */
export function resolvedMode() {
  const pref = uiPreference();
  return pref === 'auto' ? detectMode() : pref;
}

/** Stamp the resolved layout onto the document. Safe to call repeatedly. */
export function applyUiMode() {
  const root = typeof document !== 'undefined' && document.documentElement;
  if (!root) return resolvedMode();
  const mode = resolvedMode();
  if (root.dataset) root.dataset.ui = mode;
  return mode;
}

/** Record a new preference and apply it. */
export function setUiMode(pref) {
  if (!UI_MODES.includes(pref) || !active) return;
  active.settings = active.settings || {};
  active.settings.ui = pref;
  commit();
  applyUiMode();
}

/** Step through the three preferences — the shortcut and the hold-screen chip. */
export function cycleUiMode() {
  const next = UI_MODES[(UI_MODES.indexOf(uiPreference()) + 1) % UI_MODES.length];
  setUiMode(next);
  return next;
}

/** "Automatic · Desktop" — the preference, and what it resolved to. */
export function uiModeLabel() {
  const pref = uiPreference();
  return pref === 'auto' ? `Automatic · ${UI_LABELS[resolvedMode()]}` : UI_LABELS[pref];
}
