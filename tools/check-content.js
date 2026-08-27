#!/usr/bin/env node
// Proves src/content/*.js still matches reference/gridfall-data.json.
// Guards against someone hand-editing a generated module — a renamed card id
// there would silently strip that card from every live save (see migrate()).
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {POOL} from '../src/content/cards.js';
import {GEAR} from '../src/content/gear.js';
import {BEST} from '../src/content/hostiles.js';
import {LEADS} from '../src/content/leads.js';
import {MISSIONS} from '../src/content/missions.js';
import {MODS} from '../src/content/modifiers.js';
import {OPS} from '../src/content/operations.js';
import {DOCTRINE} from '../src/content/doctrines.js';
import {TGNAME} from '../src/content/targeting-names.js';
import * as C from '../src/state/constants.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(readFileSync(join(root, 'reference/gridfall-data.json'), 'utf8'));

const fails = [];
const check = (name, got, want) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) fails.push(name);
};
check('cards', POOL, data.cards);
check('gear', GEAR, data.gear);
check('hostiles', BEST, data.hostiles);
check('leads', LEADS, data.leads);
check('missions', MISSIONS, data.missions);
check('modifiers', MODS, data.modifiers);
check('operations', OPS, data.operations);
check('doctrines', DOCTRINE, data.doctrines);
check('targeting', TGNAME, data.targeting);
check('constants', {
  LANES: C.LANES, COLS: C.COLS, MAXDP: C.MAXDP, MAXBREACH: C.MAXBREACH,
  DECKSIZE: C.DECKSIZE, SAVE_VERSION: C.SAVE_VERSION, STARTER: C.STARTER,
}, data.constants);

if (fails.length) {
  console.log('CONTENT DRIFT in: ' + fails.join(', ') + '\nRun `npm run gen:content` to regenerate.');
  process.exit(1);
}
console.log(`content matches the data file — ${Object.keys(POOL).length} cards, ` +
  `${Object.keys(GEAR).length} gear, ${Object.keys(BEST).length} hostiles, ` +
  `${Object.keys(OPS).length} operations`);
