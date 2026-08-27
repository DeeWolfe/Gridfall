// The only place the rest of the renderer touches the document directly.

/** Element by id. */
export const $ = id => document.getElementById(id);

/** Every screen in the shell, in the order they appear. */
export const SCREENS = ['boot', 'hold', 'modes', 'ops', 'map', 'combat'];

/**
 * Show exactly one screen. Visibility is driven purely by the `.on` class —
 * no screen carries an unscoped display rule, so nothing can pin itself
 * permanently visible. (A duplicate `#combat` display rule once did exactly
 * that, invisibly to every logic test; csstest.js guards it now.)
 */
export function show(id) {
  SCREENS.forEach(s => {
    const e = $(s);
    if (e) e.classList.toggle('on', s === id);
  });
}

/** Escape a string for use inside a double-quoted HTML attribute. */
export const attr = s => String(s).replace(/"/g, '&quot;');
