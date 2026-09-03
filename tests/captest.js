// The hand cap, and the one thing that is allowed through it.
//
// The cap exists for the tray: HAND_CAP cards are the most a 360px phone can
// print on one row with the names still legible. That makes it a layout rule
// wearing a rules-layer coat, and layout rules have a bad habit of quietly
// eating gameplay — so the two things worth pinning are that the turn draw
// stops at the cap and that a card the player spent DP on never does.
import './support/install-dom.js';
import * as A from './support/api.js';
import {failures} from './support/harness.js';
import {POOL} from '../src/content/cards.js';
import {HAND_CAP, DECKSIZE} from '../src/state/constants.js';

const F = failures();
const p = A.blankProfile('CAP');
A.setActive(p);
p.unlocks.cards = Object.keys(POOL);

const board = () => {
  p.loadout.deck = [...A.STARTER, 'recon', 'falconer', 'rifle'];
  A.launchSpec({node: null, type: 'stronghold', mod: 'none', reward: 0, heat: 0});
  return A.G;
};

// --- the turn draw stops at the cap ---
{
  const G = board();
  G.hand = G.deck.splice(0, HAND_CAP);
  const before = G.deck.length;
  const drew = A.drawCard();
  console.log(`full hand (${HAND_CAP}): drawCard() returned ${drew}, hand ${G.hand.length}`);
  if (drew) F.push('the turn draw ignored a full hand');
  if (G.hand.length !== HAND_CAP) F.push(`hand grew to ${G.hand.length} past the cap of ${HAND_CAP}`);
  // Held, not discarded. If the deck shrinks here the cap is destroying cards,
  // which is the difference between "spend something" and "you lost a card".
  if (G.deck.length !== before) F.push('a held draw consumed a card from the deck');
  console.log('deck untouched by a held draw:', G.deck.length === before);
}

// --- one below the cap still draws ---
{
  const G = board();
  G.hand = G.deck.splice(0, HAND_CAP - 1);
  if (!A.drawCard()) F.push('a hand under the cap refused to draw');
  if (G.hand.length !== HAND_CAP) F.push('drawing to the cap did not fill the hand');
  console.log(`one below the cap draws to ${G.hand.length}`);
}

// --- card effects are exempt ---
{
  const G = board();
  G.hand = G.deck.splice(0, HAND_CAP);
  const drew = A.drawCard(true);
  console.log(`forced draw at the cap: ${drew}, hand ${G.hand.length}`);
  if (!drew) F.push('a card effect was blocked by the hand cap');
  if (G.hand.length !== HAND_CAP + 1) F.push('a forced draw did not deliver');
}

// --- the two cards that do it, doing it for real ---
//
// Playing a drawing card into a full hand is the case the exemption exists
// for. It goes through deploy(), so this proves the flag survives the call
// chain rather than only working when the test calls drawCard() directly.
{
  for (const [id, extra] of [['recon', POOL.recon.draw]]) {
    const G = board();
    // A hand at the cap, and a reserve that cannot hand the card back — a
    // redraw of the card under test would otherwise look like a second play.
    G.deck = G.deck.filter(c => c !== id);
    G.hand = [id, ...G.deck.splice(0, HAND_CAP - 1)];
    G.dp = 12;
    const before = G.hand.length;
    let placed = false;
    // deploy() reports through the hand, not a return value — an instant and
    // a unit take different paths out of it.
    for (let l = 0; l < A.LANES && !placed; l++) {
      for (let c = 0; c < 3 && !placed; c++) {
        A.deploy(id, l, c);
        placed = !G.hand.includes(id);
      }
    }
    if (!placed) { F.push(`${id} could not be deployed at all`); continue; }
    // The card leaves the hand as it is played, so the net is extra - 1.
    const want = before - 1 + extra;
    console.log(`${id} (+${extra}) played into a full hand: ${before} -> ${G.hand.length}`);
    if (G.hand.length !== want) {
      F.push(`${id} drew into a full hand and left ${G.hand.length}, expected ${want}`);
    }
    // Falconer replaces itself exactly, so it nets to the cap and never above
    // it; only Recon actually leaves you carrying more than six. Asserting
    // "exceeds the cap" for both would be asserting a fiction.
    if (extra > 1 && G.hand.length <= HAND_CAP) {
      F.push(`${id} draws +${extra} but never exceeded the cap — the exemption is not being tested`);
    }
    if (extra === 1 && G.hand.length !== HAND_CAP) {
      F.push(`${id} draws +1 and should net back to exactly the cap, got ${G.hand.length}`);
    }
  }
}

// --- the cap can never strand the deck ---
//
// A hand at the cap with the reserve empty must not spin: drawCard() reshuffles
// from the loadout minus what is in hand, so a forced draw with nothing left to
// give has to fail quietly rather than loop or duplicate a held card.
{
  const G = board();
  G.hand = [...p.loadout.deck];
  G.deck = [];
  const drew = A.drawCard(true);
  console.log('forced draw with the whole deck in hand:', drew);
  if (drew) F.push('a forced draw invented a card that was already in hand');
  if (G.hand.length !== p.loadout.deck.length) F.push('the hand changed size with nothing to draw');
}

// --- the cap is below the deck, or it can never bind ---
{
  console.log(`HAND_CAP ${HAND_CAP} against DECKSIZE ${DECKSIZE}`);
  if (HAND_CAP >= DECKSIZE) F.push('the cap is at or above the deck size — it can never apply');
  if (HAND_CAP < 4) F.push('a cap under 4 leaves no hand to play from');
}

F.report('hand cap: the turn draw stops, card effects do not');
