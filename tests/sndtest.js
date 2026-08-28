// Sound and save import — the two Settings-driven features added together.
//
// Sound's contract: every effect is a silent no-op without WebAudio (the stub
// has none, so these calls prove it), the switch lives on the profile and
// survives a save round trip, and Settings shows it. Import's contract: a
// pasted record is repaired by migrate() on the way in, lands in a free slot
// or replaces its twin by id, refuses politely when the slots are full, and
// never lets markup through in a name.
import './support/install-dom.js';
import * as A from './support/api.js';
import {get} from './support/dom.js';
import {failures} from './support/harness.js';
import {sfx, SFX_NAMES, soundOn, toggleSound} from '../src/render/sound.js';
import {musicOn, toggleMusic, startMusic, stopMusic, syncMusic} from '../src/render/music.js';
import {openPanel} from '../src/render/panels.js';
import {dlgClose} from '../src/render/dialog.js';
import {boot} from '../src/render/wiring.js';
import {enter} from '../src/render/hold.js';

boot();

const F = failures();

// --- sound: silent no-ops, a persistent switch, a Settings row ---
{
  if (!SFX_NAMES.length) F.push('no sound effects defined');
  SFX_NAMES.forEach(name => {
    try { sfx(name); } catch (e) { F.push(`sfx(${name}) threw without WebAudio: ${e.message}`); }
  });
  try { sfx('no-such-sound'); } catch { F.push('an unknown sfx name threw'); }

  enter(A.blankProfile('SND'));
  if (!soundOn()) F.push('sound does not default to on');
  toggleSound();
  if (soundOn()) F.push('toggle did not turn sound off');
  sfx('boom');   // must be a silent no-op while muted, not an error
  const reloaded = A.initProfiles().find(p => p.callsign === 'SND');
  if (!reloaded || reloaded.settings.sound !== 'off') F.push('mute did not survive a save round trip');
  toggleSound();
  if (!soundOn()) F.push('toggle did not turn sound back on');

  // --- music: the same contract as sound — no-ops without WebAudio, a
  // persistent switch on the profile, and its own Settings row ---
  try { startMusic(); syncMusic(); stopMusic(); } catch (e) {
    F.push('music engine threw without WebAudio: ' + e.message);
  }
  if (!musicOn()) F.push('music does not default to on');
  toggleMusic();
  if (musicOn()) F.push('toggle did not turn music off');
  const reMuted = A.initProfiles().find(p => p.callsign === 'SND');
  if (!reMuted || reMuted.settings.music !== 'off') F.push('music mute did not survive a save round trip');
  toggleMusic();
  if (!musicOn()) F.push('toggle did not turn music back on');

  openPanel('settings');
  const panel = get('pbody')._html;
  if (!panel.includes('musrow')) F.push('Settings has no music row');
  if (!/Atmosphere/.test(panel)) F.push('the music row is unlabelled');
  if (!panel.includes('sndrow')) F.push('Settings has no sound row');
  if (!/Sound effects/.test(panel)) F.push('the sound row is unlabelled');
  const row = get('sndrow');
  if (!row.onclick) F.push('sound row is not wired');
  else {
    row.onclick();
    if (soundOn()) F.push('the Settings row did not toggle sound');
    row.onclick();
  }
}

// --- import: a valid record lands, by slot or by id ---
{
  A.store.set(A.KEY, '[]');
  A.initProfiles();
  enter(A.blankProfile('HOST'));

  openPanel('settings');
  if (!get('pbody')._html.includes('impo')) F.push('Settings has no import row');
  const row = get('impo');
  if (!row.onclick) { F.push('import row is not wired'); }
  else {
    // The dialog opens in paste mode.
    row.onclick();
    if (get('dlgpaste').style.display !== 'block') F.push('import dialog shows no paste area');

    // A legacy-shaped record imports, repaired.
    dlgClose(JSON.stringify({version: 1, id: 'guest1', callsign: 'GUEST',
      progress: {credits: 50}, unlocks: {cards: ['scout', 'ghostcard']},
      loadout: {deck: ['scout', 'ghostcard']}, stats: {}}));
    const guest = A.profiles.find(p => p.id === 'guest1');
    if (!guest) F.push('a valid record did not import');
    else {
      if (guest.version !== 4) F.push('the import was not migrated');
      if (guest.loadout.deck.includes('ghostcard')) F.push('migration did not strip a dead card on import');
      if (get('dlgtitle')._text !== 'Record imported') F.push('no success notice after import');
    }

    // Importing the same id again replaces rather than duplicates.
    row.onclick();
    dlgClose(JSON.stringify({...guest, callsign: 'GUESTTWO'}));
    const twins = A.profiles.filter(p => p.id === 'guest1');
    if (twins.length !== 1) F.push(`same-id import duplicated the record (${twins.length})`);
    else if (twins[0].callsign !== 'GUESTTWO') F.push('same-id import did not replace the record');

    // Garbage is refused with a message, not a throw.
    const count = A.profiles.length;
    row.onclick();
    dlgClose('{{{not json');
    if (A.profiles.length !== count) F.push('garbage import changed the profile list');
    if (get('dlgtitle')._text !== 'Import failed') F.push('no failure notice for garbage input');

    // A name cannot smuggle markup in.
    row.onclick();
    dlgClose(JSON.stringify({id: 'xss1', callsign: '<img src=x>', stats: {}}));
    const xss = A.profiles.find(p => p.id === 'xss1');
    if (xss && /[<>]/.test(xss.callsign)) F.push('markup survived in an imported callsign');

    // With all three slots full, a new id is refused.
    while (A.profiles.length < 3) A.profiles.push(A.blankProfile('FILL' + A.profiles.length));
    row.onclick();
    dlgClose(JSON.stringify({id: 'overflow', callsign: 'FOUR', stats: {}}));
    if (A.profiles.some(p => p.id === 'overflow')) F.push('import overfilled the three slots');
    if (get('dlgtitle')._text !== 'No free slot') F.push('no slots-full notice');
  }
}

F.report('sound + import: all checks pass');
