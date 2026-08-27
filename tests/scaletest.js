// The UI has to actually scale: one root clamp drives rem sizing everywhere,
// and the components that carry the game are viewport-relative rather than
// pinned to a pixel size.
import {failures, builtPage, pageParts} from './support/harness.js';

const F = failures();
const page = builtPage();
const {body, css} = pageParts(page);

// The root must scale over a meaningful range.
const root = css.match(/html\{font-size:clamp\(([\d.]+)px,\s*([\d.]+)vw \+ ([\d.]+)px,\s*([\d.]+)px\)\}/) || [];
if (!root.length) {
  F.push('root font-size clamp missing');
} else {
  const [, min, vw, base, max] = root.map(Number);
  if (max / min < 1.6) F.push(`root only scales ${(max / min).toFixed(2)}x — too narrow`);
  const at = w => Math.min(max, Math.max(min, w * vw / 100 + base));
  const sizes = [360, 768, 1280, 1920, 2560].map(w => `${w}px→${at(w).toFixed(1)}px`);
  console.log('root font-size:', sizes.join('  '));
  if (at(2560) <= at(1280)) F.push('root does not grow between 1280 and 2560');
}

// Almost nothing should still be a fixed px font-size.
const pxCss = (css.match(/font-size:\s*[\d.]+px/g) || []).length;
const pxJs = (body.match(/font-size:\s*[\d.]+px/g) || []).length;
console.log('remaining fixed font sizes — css:', pxCss, 'js:', pxJs);
if (pxCss + pxJs > 4) F.push('too many fixed font sizes remain: ' + (pxCss + pxJs));

// Key components must be viewport-relative.
const MUST_SCALE = {
  '.cgrid': /minmax\(clamp\(/,
  '.fcard': /width:clamp\(/,
  '.packcard': /width:clamp\(/,
  '.field': /max-width:min\(/,
  '.leadcard': /grid-template-columns:clamp\(/,
  '.cbmain': /grid-template-columns:1fr/,
};
for (const [sel, re] of Object.entries(MUST_SCALE)) {
  const rules = [...css.matchAll(new RegExp('(?:^|\\n|\\s)' + sel.replace('.', '\\.') + '\\s*\\{([^}]*)\\}', 'g'))];
  if (!rules.length) F.push(sel + ' rule missing');
  else if (!rules.some(m => re.test(m[1]))) F.push(sel + ' is not viewport-relative');
}

// Clamps should have real headroom, not be decorative.
const tight = [...css.matchAll(/clamp\(([\d.]+)px,\s*([\d.]+)vw[^,]*,\s*([\d.]+)px\)/g)]
  .filter(m => +m[3] / +m[1] < 1.25)
  .map(m => m[0]);
if (tight.length > 6) F.push('several clamps have almost no range: ' + tight.slice(0, 3).join(' '));

console.log('clamped dimensions:', (css.match(/clamp\(/g) || []).length);
F.report('scaling: all checks pass');
