// Every screen's navigation must sit at the bottom, after its scrolling body.
import {failures, builtPage, pageParts} from './support/harness.js';

const F = failures();
const page = builtPage();
const {head, css} = pageParts(page);

const SCREENS = [
  ['modes', 'modesbody', 'modesback'],
  ['ops', 'opsbody', 'opsback'],
  ['map', 'mapbody', 'mapback'],
  ['deeprun', 'runbody', 'runback'],
  ['panel', 'pbody', 'pclose'],
];

for (const [screen, bodyId, buttonId] of SCREENS) {
  const start = head.indexOf('id="' + screen + '"');
  if (start < 0) { F.push('screen missing: ' + screen); continue; }

  const end = head.indexOf('<div class="scr"', start + 10);
  const block = head.slice(start, end > 0 ? end : start + 1400);
  const bodyAt = block.indexOf('id="' + bodyId + '"');
  const navAt = block.indexOf('navfoot');
  const buttonAt = block.indexOf('id="' + buttonId + '"');

  if (bodyAt < 0) F.push(screen + ': body not found');
  if (navAt < 0) F.push(screen + ': has no bottom nav');
  if (buttonAt < 0) F.push(screen + ': nav button not found');
  if (bodyAt >= 0 && navAt >= 0 && navAt < bodyAt) F.push(screen + ': nav still sits above the body');
  if (navAt >= 0 && buttonAt >= 0 && buttonAt < navAt) F.push(screen + ': button is outside the nav bar');
  if (block.includes('maphead') || block.includes('phead')) F.push(screen + ': still uses a top header');
}

if (/\.maphead\s*\{/.test(css)) F.push('stale .maphead css remains');
if (/\.phead\s*\{/.test(css)) F.push('stale .phead css remains');
if (!/\.navfoot\s*\{/.test(css)) F.push('.navfoot style missing');

// Handlers still wired
['modesback', 'opsback', 'mapback', 'pclose'].forEach(id => {
  if (!page.includes("$('" + id + "')")) F.push('handler missing for ' + id);
});

F.report('bottom navigation: all checks pass');
