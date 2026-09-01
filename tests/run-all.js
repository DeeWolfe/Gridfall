#!/usr/bin/env node
// Runs every harness. Guards must pass; the balance harnesses only report.
//
//   node tests/run-all.js            build, then run everything
//   node tests/run-all.js --no-build run against the existing dist/
//   node tests/run-all.js acttest    run one harness by name
import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

// Logic first, then the renderer, then what actually ships.
const GUARDS = [
  'acttest', 'movetest', 'aimtest', 'hltest', 'clashtest', 'spawntest',
  'swaptest', 'pushtest', 'zonetest', 'hecatetest',
  'stratagemtest', 'passivetest', 'grappletest', 'breachtest', 'flanktest', 'mechtest', 'frametest', 'foetest', 'eventtest',
  'opentest', 'leadtest', 'packtest', 'maptest', 'cardtest', 'codectest', 'geomtest', 'foeseltest', 'repro',
  'playtest', 'actbar', 'csstest', 'cssdup', 'headtest', 'navtest', 'scaletest',
  'handtest', 'captest', 'uitest', 'statictest', 'geartest', 'achievetest', 'tapetest', 'tuttest', 'sndtest', 'arttest', 'pixtest', 'buildtest',
];
// frmtest is NOT in here on purpose: it plays eight arms over the same mission
// set and takes about a minute even at its smallest useful size, which is too
// much to pay on every run. Run it by hand when Frames change:
//   FRM_JSON=1 FRM_RUNS=10 node tests/frmtest.js
const BALANCE = ['test', 'mtest', 'onstest'];

const args = process.argv.slice(2);
const skipBuild = args.includes('--no-build');
const only = args.filter(a => !a.startsWith('--'));

const run = name => spawnSync(process.execPath, [join(HERE, name + '.js')],
  {encoding: 'utf8', cwd: ROOT, maxBuffer: 32 * 1024 * 1024});

if (!skipBuild) {
  const built = spawnSync(process.execPath, [join(ROOT, 'build.js')], {encoding: 'utf8', cwd: ROOT});
  process.stdout.write(built.stdout || '');
  if (built.status !== 0) {
    process.stderr.write(built.stderr || '');
    process.exit(1);
  }
} else if (!existsSync(join(ROOT, 'dist/gridfall.html'))) {
  console.error('no dist/gridfall.html — drop --no-build or run `npm run build` first');
  process.exit(1);
}

// Also prove the content modules still match the data file.
{
  const check = spawnSync(process.execPath, [join(ROOT, 'tools/check-content.js')], {encoding: 'utf8', cwd: ROOT});
  process.stdout.write(check.stdout || '');
  if (check.status !== 0) process.exit(1);
}
console.log();

let failed = 0;
for (const name of (only.length ? only : GUARDS)) {
  const r = run(name);
  const out = ((r.stdout || '') + (r.stderr || '')).trim();
  const last = out.split('\n').pop() || '(no output)';
  if (r.status !== 0) {
    failed++;
    console.log(`  FAIL  ${name.padEnd(11)} ${last}`);
    // A failing guard is worth its whole output, not just its last line.
    out.split('\n').forEach(l => console.log('          ' + l));
  } else {
    console.log(`  ok    ${name.padEnd(11)} ${last}`);
  }
}

if (!only.length) {
  console.log('\n-- balance (informational, not pass/fail) --');
  for (const name of BALANCE) {
    const r = run(name);
    ((r.stdout || '') + (r.stderr || '')).trim().split('\n')
      .filter(l => l.trim())
      .forEach(l => console.log('  ' + l));
  }
}

console.log();
console.log(failed ? `${failed} GUARD${failed > 1 ? 'S' : ''} FAILED` : 'ALL GUARDS PASS');
process.exit(failed ? 1 : 0);
