// Shared plumbing for the harnesses: a failure collector, a fixture builder
// for hand-placed units and hostiles, and the built-page loader the structural
// guards use.

import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

/** Collect failures, then report and set the exit code. */
export function failures() {
  const list = [];
  return {
    push: msg => list.push(msg),
    get length() { return list.length; },
    report(okMessage) {
      if (list.length) {
        console.log('FAILURES:\n - ' + list.join('\n - '));
        process.exitCode = 1;
      } else {
        console.log(okMessage);
      }
    },
  };
}

/**
 * The built single-file page. The structural guards read this rather than the
 * sources: they are checking what actually ships.
 */
export function builtPage() {
  const path = process.env.GRIDFALL || join(ROOT, 'dist/gridfall.html');
  try {
    return readFileSync(path, 'utf8');
  } catch {
    console.log(`FAILURES:\n - ${path} not found — run \`npm run build\` first`);
    process.exit(1);
  }
}

/** Split a built page into its markup-and-style head and its script body. */
export function pageParts(src) {
  const scriptAt = src.indexOf('<script>');
  return {
    head: src.slice(0, scriptAt),
    body: src.slice(scriptAt),
    css: src.slice(src.indexOf('<style>'), src.indexOf('</style>')),
  };
}
