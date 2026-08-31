// The only place the rest of the renderer touches the document directly.

/** Element by id. */
export const $ = id => document.getElementById(id);

/** Every screen in the shell, in the order they appear. */
export const SCREENS = ['title', 'boot', 'hold', 'modes', 'ops', 'map', 'combat'];

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
  // The pull-up drawer resets on every screen change, so a menu left open
  // on one screen never reopens stale on the next.
  const drawer = $('drawer');
  if (drawer) {
    drawer.classList.remove('up');
    const tab = $('drawtab');
    if (tab) tab.textContent = '▲';
  }
}

/** Escape a string for use inside a double-quoted HTML attribute. */
export const attr = s => String(s).replace(/"/g, '&quot;');

/**
 * Edge-fade affordance for a row that scrolls sideways.
 *
 * The scrollbar under a tab row was a second horizontal rule competing with
 * the tabs themselves, and on a phone it reported the row's extent by drawing
 * a bar the player never grabbed. Hiding it loses the "there is more this way"
 * signal, so the row fades at whichever edge still has content behind it —
 * nothing when it fits, and nothing at an edge you have already reached.
 *
 * `root` scopes the scan; it is re-run on scroll so the fade tracks position.
 */
export function markSwipe(sel, root) {
  const host = root || document;
  host.querySelectorAll(sel).forEach(el => {
    const paint = () => {
      const slack = el.scrollWidth - el.clientWidth;
      const at = el.scrollLeft;
      el.classList.toggle('swipe-l', slack > 1 && at > 2);
      el.classList.toggle('swipe-r', slack > 1 && at < slack - 2);
    };
    if (!el.dataset.swipewired) {
      el.dataset.swipewired = '1';
      el.addEventListener('scroll', paint, {passive: true});
    }
    paint();
  });
}
