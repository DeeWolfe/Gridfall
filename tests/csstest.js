// Screen stacking: exactly one screen visible at every step of navigation,
// no duplicate or dangling DOM ids, and no screen carrying an unscoped display
// rule that could pin it permanently visible.
import './support/install-dom.js';
import * as A from './support/api.js';
import {get} from './support/dom.js';
import {failures, builtPage, pageParts} from './support/harness.js';
import {SCREENS, show} from '../src/render/dom.js';
import {renderModes} from '../src/render/modes.js';
import {renderOps} from '../src/render/ops.js';
import {renderMap} from '../src/render/map.js';
import {enter} from '../src/render/hold.js';
import {leaveCombat} from '../src/render/combat.js';
import {boot} from '../src/render/wiring.js';

// Boot for real, so the presentation hooks are the ones the game ships with —
// entering combat is driven by a hook, not by the caller.
boot();

const F = failures();
const page = builtPage();
const {head, body} = pageParts(page);

// --- static: ids and display rules ---
{
  const declared = [...head.matchAll(/id="([\w-]+)"/g)].map(m => m[1]);
  const dups = [...new Set(declared.filter(i => declared.filter(x => x === i).length > 1))];
  console.log('duplicate ids:', dups.length ? dups : 'none');
  dups.forEach(d => F.push('duplicate id: ' + d));

  // Ids the script creates at runtime rather than declaring in the shell.
  const DYNAMIC = ['expo', 'goCampaign', 'goGauntlet', 'goOnslaught', 'goDaily', 'ironbox',
    'newrun', 'shipren', 'tutreplay', 'hintreplay', 'sndrow', 'musrow', 'swrec', 'impo', 'packbox', 'packnext', 'buypack'];
  const referenced = [...new Set([...body.matchAll(/\$\('([\w-]+)'\)/g)].map(m => m[1]))];
  const missing = referenced.filter(r => !declared.includes(r) && !DYNAMIC.includes(r));
  console.log('ids referenced but never declared:', missing.length ? missing : 'none');
  missing.forEach(m => F.push('id referenced but never declared: ' + m));
}

{
  const screenIds = [...head.matchAll(/class="scr[^"]*"\s+id="(\w+)"/g)].map(m => m[1]);
  const initiallyOn = [...head.matchAll(/class="scr on"\s+id="(\w+)"/g)].map(m => m[1]);
  console.log('screens:', screenIds.join(', '));
  console.log('visible at load (should be exactly [title]):', initiallyOn);
  if (initiallyOn.length !== 1 || initiallyOn[0] !== 'title') {
    F.push('markup does not start with exactly the title screen visible');
  }
  if (screenIds.join(',') !== SCREENS.join(',')) {
    F.push(`markup screens (${screenIds}) do not match SCREENS (${SCREENS})`);
  }

  // An unscoped `#screen { display: ... }` rule beats the .on class and pins
  // the screen visible forever. This exact bug shipped once.
  const bad = [];
  for (const id of screenIds) {
    const rules = [...head.matchAll(new RegExp('#' + id + '(?![\\w.-])\\s*\\{([^}]*)\\}', 'g'))];
    for (const r of rules) if (/display\s*:/.test(r[1])) bad.push(id + ' has unscoped display rule');
  }
  console.log('unscoped display rules:', bad.length ? bad : 'none');
  bad.forEach(b => F.push(b));
}

// --- runtime: exactly one screen carries .on at every step ---
const visible = () => SCREENS.filter(id => get(id)._cls.has('on'));

const steps = [
  ['after enter', () => enter(A.blankProfile('X'))],
  ['modes', () => { show('modes'); renderModes(); }],
  ['ops', () => { show('ops'); renderOps(); }],
  ['map', () => { show('map'); renderMap(); }],
  ['combat', () => A.launch(Object.keys(A.opRun().nodes)[0])],
  ['abort back to map', () => leaveCombat()],
];

const EXPECTED = {'after enter': 'hold', 'abort back to map': 'map'};
for (const [name, run] of steps) {
  run();
  const on = visible();
  if (on.length !== 1) {
    F.push(`${name}: ${on.length} screens visible (${on.join(', ') || 'none'})`);
    console.log('  BAD ', name, '-> visible:', on);
    continue;
  }
  const want = EXPECTED[name] || name;
  if (on[0] !== want) F.push(`${name}: showed ${on[0]}, expected ${want}`);
  console.log('  ok  ', name.padEnd(20), '-> ' + on[0]);
}

F.report('exactly one screen visible at every step');
