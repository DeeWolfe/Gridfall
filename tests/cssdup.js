// CSS integrity, checked against what actually ships.
//
// No selector may be declared twice at top level, and no rule may hide an
// element that nothing re-shows. Both of these shipped as real bugs in the
// reference build: a duplicate `#combat` display rule pinned one screen
// permanently visible while all 39 playability checks passed.
import {failures, builtPage, pageParts} from './support/harness.js';

const F = failures();
const {body, css} = pageParts(builtPage());

// Selectors that are genuinely declared more than once, by design.
const INTENTIONAL = ['body', 'html', '.deploy', '.deploy h2', '.deploy .sub', '.gcard', '.gart',
  '.fcard', '.fart', '.fart svg', '.facts', '.portlabel'];

// Media blocks legitimately redeclare selectors; keyframes are not selectors.
//
// Comments come out FIRST, and that is the whole guard. Without it a selector
// with a comment above it is counted as "/* ... *\/\n.pips" rather than as
// ".pips" — a key of its own — so any duplicate where either copy is
// documented was invisible. This stylesheet comments nearly everything, so
// the guard passed vacuously for its whole life and let a real `.pips`
// collision ship: the objective's progress dots inherited `position:absolute`
// from the veterancy pips and rode off to the corner of the screen.
const topLevel = css
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/@media[^{]*\{(?:[^{}]|\{[^}]*\})*\}/g, '')
  .replace(/@keyframes[^{]*\{(?:[^{}]|\{[^}]*\})*\}/g, '');

const counts = {};
for (const m of topLevel.matchAll(/([^{}]+)\{[^}]*\}/g)) {
  m[1].split(',').map(x => x.trim()).filter(Boolean)
    .forEach(sel => { counts[sel] = (counts[sel] || 0) + 1; });
}
const dups = Object.entries(counts)
  .filter(([sel, n]) => n > 1 && !INTENTIONAL.includes(sel))
  .map(([sel, n]) => `${sel} x${n}`);
console.log('top-level duplicate selectors:', dups.length ? dups : 'none');
dups.forEach(d => F.push('duplicate selector: ' + d));

// Any rule that hides something must have a matching rule that shows it again,
// keyed off a class the script actually toggles.
const hiders = [...css.matchAll(/([^{}]+)\{[^}]*display\s*:\s*none[^}]*\}/g)]
  .map(m => m[1].trim())
  .filter(sel => !sel.startsWith('@'));

const orphans = hiders.filter(sel => {
  const classes = [...sel.matchAll(/\.([\w-]+)/g)].map(m => m[1]);
  if (!classes.length) return false;
  const showRule = new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
    '\\.[\\w-]+\\s*\\{[^}]*display\\s*:\\s*(flex|block|grid)');
  if (!showRule.test(css)) return false;
  const showClass = (css.match(showRule) || [''])[0].match(/\.([\w-]+)\s*\{/);
  if (!showClass) return false;
  return !body.includes("'" + showClass[1] + "'") && !body.includes('"' + showClass[1] + '"');
});
console.log('rules hiding elements nothing re-shows:', orphans.length ? orphans : 'none');
orphans.forEach(o => F.push('orphan hide rule: ' + o));

F.report('css integrity: all checks pass');
