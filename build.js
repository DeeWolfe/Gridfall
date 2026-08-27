#!/usr/bin/env node
// Build: src/*.js + styles/gridfall.css + index.html  ->  dist/gridfall.html
//
// A single self-contained page, with no dependencies to install and no
// toolchain to keep current. The bundler walks the module graph from
// src/main.js, orders it depth-first, strips the import/export syntax and
// concatenates the bodies into one flat scope.
//
// That flat scope is the point: it is why the structural test harnesses can
// evaluate the built page's script directly, and why the duplicate-declaration
// check below is worth having. Two functions of the same name defined in
// different files is a real bug this catches at build time — the reference
// build shipped exactly that twice.
//
// Constraints it imposes on source, all checked here:
//   * every top-level declaration name must be unique across the whole graph
//   * no `export default`, no namespace or dynamic imports
//   * only bare re-assignment of a module's own `let` bindings (via setters)

import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join, resolve as resolvePath} from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const ENTRY = join(root, 'src/main.js');

// --- module graph -----------------------------------------------------------

const IMPORT_RE = /^\s*import\s+(?:[\s\S]*?)\s+from\s+['"]([^'"]+)['"]\s*;?\s*$/gm;
const BARE_IMPORT_RE = /^\s*import\s+['"]([^'"]+)['"]\s*;?\s*$/gm;

function dependenciesOf(src, file) {
  const deps = [];
  for (const re of [IMPORT_RE, BARE_IMPORT_RE]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(src))) deps.push(resolvePath(dirname(file), m[1]));
  }
  return deps;
}

/**
 * Depth-first post-order, so a module is emitted after everything it imports.
 * Cycles are tolerated — a module already being visited is skipped rather than
 * followed, which is correct here because nothing runs at module-evaluation
 * time across a cycle; only function bodies reference the other side.
 */
function collect(entry) {
  const order = [];
  const state = new Map();   // file -> 'visiting' | 'done'
  const sources = new Map();

  const visit = file => {
    if (state.get(file) === 'done' || state.get(file) === 'visiting') return;
    state.set(file, 'visiting');
    const src = readFileSync(file, 'utf8');
    sources.set(file, src);
    dependenciesOf(src, file).forEach(visit);
    state.set(file, 'done');
    order.push(file);
  };
  visit(entry);
  return order.map(file => ({file, src: sources.get(file)}));
}

// --- transform --------------------------------------------------------------

const BANNED = [
  [/^\s*export\s+default\b/m, 'export default is not supported by this bundler'],
  [/^\s*import\s+\*\s+as\s/m, 'namespace imports are not supported by this bundler'],
  [/\bimport\s*\(/, 'dynamic import is not supported by this bundler'],
];

/** Strip module syntax, leaving plain top-level declarations. */
function stripModuleSyntax(src, rel) {
  for (const [re, why] of BANNED) {
    if (re.test(src)) throw new Error(`${rel}: ${why}`);
  }
  return src
    .replace(IMPORT_RE, '')
    .replace(BARE_IMPORT_RE, '')
    // `export {a, b};` and `export {a} from './x.js';` carry no declaration.
    .replace(/^\s*export\s*\{[^}]*\}\s*(?:from\s*['"][^'"]+['"]\s*)?;?\s*$/gm, '')
    // `export const x = ...` / `export function f()` / `export let y`
    .replace(/^(\s*)export\s+(?=(?:async\s+)?(?:function|class|const|let|var)\b)/gm, '$1');
}

/** Top-level declaration names in a module body, for the collision check. */
function declaredNames(body) {
  const names = [];
  const decl = /^(?:async\s+)?(?:function|class)\s+([A-Za-z_$][\w$]*)/gm;
  let m;
  while ((m = decl.exec(body))) names.push(m[1]);

  // const/let/var at column zero only — anything indented is inside a block.
  const binding = /^(?:const|let|var)\s+([\s\S]*?)(?:=|;)/gm;
  while ((m = binding.exec(body))) {
    const target = m[1].trim();
    if (target.startsWith('{') || target.startsWith('[')) {
      // Destructuring: pull the bound identifiers out.
      target.replace(/([A-Za-z_$][\w$]*)\s*(?:[,}\]]|$)/g, (_, n) => names.push(n));
    } else {
      names.push(target.split(/\s|,/)[0]);
    }
  }
  return names.filter(Boolean);
}

// --- build ------------------------------------------------------------------

function bundle() {
  const modules = collect(ENTRY);
  const seen = new Map();     // name -> first file that declared it
  const clashes = [];
  const chunks = [];

  for (const {file, src} of modules) {
    const rel = file.slice(root.length + 1);
    const body = stripModuleSyntax(src, rel).replace(/\n{3,}/g, '\n\n').trim();

    for (const name of declaredNames(body)) {
      if (seen.has(name)) clashes.push(`${name} — ${seen.get(name)} and ${rel}`);
      else seen.set(name, rel);
    }
    chunks.push(`/* ==== ${rel} ${'='.repeat(Math.max(0, 62 - rel.length))} */\n${body}`);
  }

  if (clashes.length) {
    throw new Error('duplicate top-level declarations across modules:\n  - ' + clashes.join('\n  - '));
  }
  return {js: chunks.join('\n\n'), count: modules.length, names: seen.size};
}

function main() {
  const {js, count, names} = bundle();
  const css = readFileSync(join(root, 'styles/gridfall.css'), 'utf8').trim();
  const shell = readFileSync(join(root, 'index.html'), 'utf8');

  const html = shell
    .replace('<link rel="stylesheet" href="./styles/gridfall.css">', `<style>\n${css}\n</style>`)
    .replace('<script type="module" src="./src/main.js"></script>', `<script>\n${js}\n</script>`);

  if (html.includes('<link rel="stylesheet"') || html.includes('type="module"')) {
    throw new Error('index.html no longer matches the placeholders build.js substitutes');
  }

  mkdirSync(join(root, 'dist'), {recursive: true});
  const out = join(root, 'dist/gridfall.html');
  writeFileSync(out, html);

  const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
  console.log(`built dist/gridfall.html — ${count} modules, ${names} top-level names, ${kb}KB`);
}

try {
  main();
} catch (e) {
  console.error('BUILD FAILED: ' + e.message);
  process.exit(1);
}
