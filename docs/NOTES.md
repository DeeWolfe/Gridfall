# Rewrite notes

What changed moving from the single-file reference build to the module layout,
and what is still open. `docs/HANDOFF.md` is the original brief; `docs/SPEC.md`
is the mechanics reference.

## The one behavioural change

**`mkUnit()` never copied the `single` flag.**

Fifteen cards are marked `single: 1` in the data. `candidatesFor()` and
`targetsFor()` both branch on `u.single`, the targeting UI is built around it,
and the test suite asserts single-target behaviour throughout — but the function
that turns a card into a unit on the board simply never copied the field across.
Every deployed "single-target" card therefore hit its **entire firing geometry**
in live play. An Archer, documented and rendered as picking one of four cells,
was quietly hitting all four.

The test suite missed it because every harness that checks targeting builds its
units by hand, with `single` set explicitly. The reference passes its own suite
either way.

This is fixed in `src/rules/units.js`. The data, the spec, the UI copy and the
tests all agree on the intended behaviour, so the odd one out was the bug.

**It costs win rate.** Three runs of `tests/mtest.js` each way, aggregated:

| Mission type | Reference behaviour | With the fix | Δ |
|---|---|---|---|
| Defend Stronghold | 76% | 68% | −8 |
| Retake Ground | 73% | 68% | −5 |
| Fight for Crystals | 39% | 28% | −11 |
| Extraction | 91% | 87% | −4 |
| Acquire Specimens | 41% | 42% | ~0 |
| Protect Civilians | 96% | 95% | ~0 |

Crystals takes the worst of it, which makes known issue #2 from the handoff
(Crystals and Specimens sitting near 30%) **worse, not better**. If that mission
type is meant to be winnable by an ordinary player it now needs a balance pass
rather than a wait-and-see. Reverting is a one-line change, but it means
shipping a card set whose printed rules do not match what the cards do.

## Dead code removed

Both of these were no-ops in the reference; neither changes behaviour.

- **The duplicated claim block in `deploy()`.** Pathfinder and Drop Beacon ran
  their tile-claiming loop twice. The second pass re-checked `!== 'p'` on cells
  the first pass had already flipped, so it never claimed anything — it only
  emitted a spurious `0 cells claimed` line into the combat log.
- **A `purge` mission branch in `wave()`.** There is no `purge` mission type;
  the branch could never be reached.

## Structural changes

- **Rules are DOM-free.** Where the reference called `drawAll()` from inside
  `deploy()`, `doMove()` and `endTurn()`, the rules now call
  `hooks.invalidate()`. The renderer installs the real implementations in
  `boot()`. Same for dialogs (`hooks.notify` / `hooks.ask`), entering combat and
  showing the result card.
- **`finish()` computes, it does not render.** It settles rewards, records and
  queued packs, then parks a description of the outcome on `G.result`
  (`{kind, cleared, title, lines, payout}`). `src/render/result.js` reads it.
  Nothing has to scrape `#rt`'s text content to find out whether the player won
  any more — the balance harnesses used to do exactly that.
- **`abortMission()` split in two.** The rules-level function forfeits the
  mission and reports what kind it was; `leaveCombat()` in the renderer decides
  which screen to go back to.
- **Content generated from the data file.** See the README. `npm run
  check:content` runs as part of `npm test`.
- **The bundler checks for duplicate top-level declarations.** The handoff
  called out "two functions defined twice with different return types" as a real
  shipped bug; that class of mistake is now a build failure.

## Test suite

All 18 harnesses transferred, plus one new one.

- **Logic harnesses** (`acttest`, `movetest`, `aimtest`, `clashtest`,
  `spawntest`, `opentest`, `cardtest`, `packtest`) import `src/` directly and
  run with **no DOM stub at all**. That is the clearest proof the rules layer
  stayed clean.
- **Renderer harnesses** (`hltest`, `leadtest`, `repro`, `playtest`, `actbar`,
  `csstest`) import `tests/support/install-dom.js` first — import order matters,
  because `src/save/store.js` probes `localStorage` at module-evaluation time.
- **Structural harnesses** (`cssdup`, `headtest`, `navtest`, `scaletest`, and
  the static half of `csstest`) read `dist/gridfall.html`, so they check what
  actually ships.
- **`buildtest` is new.** It evaluates the built page's script in the stub DOM
  and plays a mission through it — the one harness that tests the bundle as code
  rather than as text.
- Hand-rolled unit literals were replaced with `tests/support/fixtures.js`,
  which builds units through the real `mkUnit()`. That is what would have caught
  the `single` bug: fixtures that disagree with the code they test can hide it
  indefinitely.
- The three balance harnesses share one bot (`tests/support/bot.js`) instead of
  carrying three copies of the same loop.

## Combat layout pass

Play-testing feedback, actioned:

- **The hand is a row of upright cards across the bottom.** It was a stack of
  wide horizontal bars in the side rail, two to a row, each mostly empty space.
  It is now a full-width strip of portrait cards that scrolls sideways —
  roughly nine visible at 1440px, eight at 820px. The card shows cost, name and
  a four-line blurb; the full text lives in the details panel and behind the ⌕
  badge.
- **The details panel moved beside the board.** With the hand out of the rail,
  the rail carries only the selection panel, so it sits directly next to the
  grid and grows into the space the hand used to take. In the stacked layout
  the grid rows no longer stretch (`align-content:start`), so the panel sits
  tight under the board rather than floating in a gap. The rail also narrowed
  from `clamp(260px,21vw,520px)` to `clamp(212px,17vw,340px)`, giving the board
  the width back.
- **The inbound wave strip is properly scrollable.** It always had
  `overflow-x:auto`, but the CSS explicitly hid the scrollbar
  (`scrollbar-width:none` plus a `::-webkit-scrollbar{display:none}`), so there
  was no sign the rest of the wave was there. The scrollbar is now a slim
  styled bar, and the chips carry `flex:0 0 auto` so a long wave overflows and
  scrolls instead of squashing.

`tests/handtest.js` is new and guards the layout contract: the footer holds the
hand and the action bar, the details panel sits in the main area before it, the
hand is a flex row of clamped-width upright cards, and the details panel is the
element that grows. `headtest.js` gained the matching checks for the inbound
strip. Both were verified to fail when the old rules are put back.

## Content and framing pass

- **Drop Pod is gear, not a card.** It left the 39-card pool and became the
  ninth piece of gear at 150 salvage. It *widens* where its card may be played
  rather than replacing the rule — the fitted card keeps every tile it could
  normally use and gains the hostile cells on top, and the crush only fires when
  the chosen cell actually holds something. Without that, fitting it to a Medic
  would have been a trap. Specialist-tier hostiles are still immune.
- **Knight dropped to Common**, and lost the `tech` flag with it (so Breachers
  no longer hunt it, a Medic can patch it and a Tech Medic cannot). Its riposte
  came down 3 → 1 and its price 210 → 200. The nerf is an internal-consistency
  argument rather than a win-rate one: at 3 DP it beat Bulwark on hull-for-
  damage *and* carried a riposte of 3, higher than the 5 DP Specialist Aegis
  Knights' 2. At riposte 1 it trades Bulwark's Brace for a point of damage and a
  light counter, and sits under the Specialist where it belongs. Three `mtest`
  runs after the change: stronghold 72%, retake 74%, extraction 94%, civilians
  96%, specimens 35%, crystals 33% — all within noise of the previous build.
- **One word for the stat: hull.** The hand tile said `12 HP` and the hostile
  list said `10 HP · threat 4` while the focus card, the pack card and the
  selection panel all said hull. Everything says hull now, and `handtest`
  fails on a stray player-facing "HP".
- **The Database reads the same way on all three tabs.** Assets was a grid of
  card tiles while Gear and Hostiles were lists; all three now go through one
  `dbRow()` builder — name, what it does, and the one number that matters on the
  right. Guarded in `handtest`.
- **The player is the commander.** The rank ladder used to start at Recruit,
  which put the player below the team lead they command. It runs Acting
  Commander → Marshal now, the lead card states who it reports to, and the Squad
  page heads the section "Team lead — answers to you".
- **The login screen is a console.** It was a wordmark over three buttons; it is
  now a framed terminal with a status bar, a staggered boot log, uplink
  readouts, and a `>` prompt with a blinking caret for authentication. Built
  from the existing tokens — same palette, same mono, no new visual language.

No save-version bump was needed. `migrate()` strips the now-missing `dropod`
card id out of decks and collections on load, which is exactly the case
`repro.js` covers; the gear id of the same name is new, so nothing collides.

## Two layouts, and a battlefield

**A desktop layout, chosen by the player.** `compact` is the touch-first layout
that stacks and scrolls; `pc` is a denser three-column board — combat log on the
left, board centre, selection panel right, hand strip across the bottom — with
hover states, tighter chrome and number-key deployment (1–9 pick the nth card,
Enter joins Space for end turn).

The preference has three values (`auto` / `pc` / `compact`) and lives in
`active.settings.ui`, but **the DOM only ever carries a concrete one**:
`src/render/uimode.js` resolves `auto` against
`(min-width:1200px) and (pointer:fine)` and stamps `data-ui="pc"` or
`data-ui="compact"` on the root. That is a deliberate call — it keeps the
stylesheet to a single set of `:root[data-ui="pc"]` blocks rather than a media
query and an attribute selector that have to be kept identical by hand, which is
exactly the kind of drift `cssdup` exists to catch. `auto` re-resolves on resize.

Two swap controls: a chip in the hold footer that cycles, and a three-way picker
in Settings that also reports which layout is in force. `uitest.js` covers the
round trip through storage, the cycle, both controls, and the shape of the
desktop layer.

**The combat log finally has a home.** The engine has kept `G.logs` since the
reference build and nothing ever rendered it. It fills the desktop layout's left
rail, colour-coded by category, and is hidden in compact where there is no room.

**The hold screen is a battlefield.** `src/render/sky.js` became
`src/render/battlefield.js`. Over the same parallax ridgelines: gunships cross
the horizon and release bombs that fall under gravity, tracer fire climbs from
the ridge and bursts into flak, and shells land out on the plain — each with a
flash, a shock ring and smoke that rises and thins.

Two things make it read rather than just move. It is **event-driven**: each of
the three events waits out a randomised cooldown (sorties every 7–16s, ground
fire every 1.6–4.5s, shelling every 2.2–6s), so the horizon is quiet often
enough that a strike registers. And the **nearest ridge is painted last**, so it
occludes the base of everything happening behind it — without that the scene is
flat and the explosions look pasted on. Entity counts are capped, and
`prefers-reduced-motion` gets the terrain held still.

The canvas stub in `tests/support/dom.js` grew the operations the scene needs
(`createRadialGradient`, `stroke`, `strokeStyle`, `lineWidth`, `save`/`restore`).

## Trading cards, and the void filled

- **Hand cards are trading cards now**: 5:7 portrait proportions, the card's
  sigil as art, the name at 0.6875rem centred beneath, and a tier · hull line.
  The rules text is off the card entirely — it shows in the details panel the
  moment the card is selected, in full behind the ⌕ badge, and as a hover
  tooltip on desktop. `handtest` fails if the text comes back or the art goes.
- **The compact layout's dead space is the combat log.** The stacked view had a
  void between the details panel and the hand; the log (desktop's left rail)
  now rides there as a third grid row taking the leftover height, so mobile
  players get it too. The block that shows it sits *after* the desktop layer in
  the stylesheet, because it has to beat the rail's default `display:none` on
  cascade order.
- The number-key badge moved onto the art box's corner, out of the tier line's
  way, and the board's height budget grew to match the taller hand strip.

## Turn playback

Hitting End turn no longer teleports the board to its final state. The turn
plays out: idle units fire one at a time with damage floats and hit flashes,
each hostile takes its action visibly, a beat as the territory flips, and the
promised wave drops in cell by cell. Any key or click skips to the end; the
action bar reads Resolving and refuses input until the tape is done.

How it keeps the architecture honest:

- **Rules record, they do not animate.** `src/rules/tape.js` is a recorder the
  phases mark as they go — each frame is a cheap snapshot of what drawBoard
  reads plus the hit/spawn/breach events since the last mark. `endTurn()` stays
  synchronous and DOM-free; recording is off until a presenter enables it, so
  the logic harnesses and the balance bots pay nothing.
- **The hook decides the presentation.** `endTurn()` ends with
  `hooks.turnResolved(tape)`; the default declines and falls through to the
  plain invalidate every test relies on. The renderer's hook plays the tape —
  except for reduced-motion users, who get the instant resolution as before.
- **Playback swaps, draws, restores.** `src/render/playback.js` substitutes
  each frame's snapshot into G, draws, overlays the effects, and puts the real
  final state back when the tape ends. While it runs, `replaying` in the
  session holds everything off: endTurn refuses to re-enter, the cells go
  inert, 1–9 and Space are ignored.
- **Long turns compress.** A turn never takes more than ~22 beats to watch;
  frame delays squeeze down to a 70ms floor as the tape grows.

`finish()` discards a half-recorded tape — no playback under a result card;
the final turn resolves instantly. That is the one deliberate cut in v1.

The build's duplicate-declaration check caught `pending` colliding between
tape.js and dialog.js during this work — fourth real catch for that guard.

`tapetest.js` pins the contract: no recording until enabled, frames are copies
not references, the declined hook still invalidates, a replay restores G to
the exact objects it started with, and skip is immediate and idempotent.

## The first-mission briefing

A five-step coach card over a fresh commander's first campaign mission: the
grid and the territory rule, deploying, the spawn-marker promise, ending the
turn, and the loss conditions. The two steps that matter advance only when the
player actually does the thing — the deploy step waits for a real deploy, the
end-turn step waits for the turn to end — and the card never blocks a control,
so the board stays playable underneath it. Skippable at every step.

It is pure presentation (`src/render/tutorial.js`): the rules know nothing
about it, it starts from the enterCombat hook and advances from the same
composed repaint the playback uses. Completion lives on the profile
(`settings.tutorial`), so it runs once per commander; Settings has a
"Combat briefing · Replay" row that queues it for the next campaign mission.
It never runs in Onslaught or the Gauntlet, and an aborted run leaves no
stale overlay behind.

The bundler's duplicate-declaration guard caught two more collisions here
(`finish` and `step` against mission.js and battlefield.js) — five real
catches now. `tuttest.js` pins the contract: fresh-only, do-it advancement,
done sticks through a save round trip, veterans never see it, replay runs
once and settles back to done.

## Sound, and the import gap closed

**Sound.** Fourteen effects, all synthesized on a small WebAudio graph in
`src/render/sound.js` — no assets, nothing to load, the single-file build stays
honest. Deploys thunk, lasers glide down a sawtooth, deaths are filtered noise,
the breach alarm is a two-tone that always plays even when a dense playback
frame caps itself at three sounds. Player actions sound immediately; resolution
sounds ride the turn playback's frames; the result card gets a win/lose sting
and the pack burst its own sparkle. The context is created lazily inside the
first user gesture, so autoplay policy never blocks it, and everything is a
silent no-op where WebAudio does not exist — which is also why the whole suite
runs clean in the stub. The switch is a Settings row, stored on the profile.

**Import save.** Settings had *Export · Copy JSON* and nowhere to paste it.
The dialog grew a paste mode (a textarea alongside the 14-char input), and the
new *Import save* row runs the pasted record through `migrate()` on the way in
— so a legacy export is repaired exactly like a legacy load. Same id replaces
its twin; otherwise it takes a free slot; three full slots refuse politely.
Importing over the record being played swaps it in live.

One hardening that came out of writing the import test: `migrate()` now strips
markup from callsigns and ship names. They render through innerHTML across the
UI, and an imported record was the first path where they arrive from outside
the input fields' own caps.

The bundler's duplicate-declaration guard caught `ctx` (sound vs battlefield)
— seven catches now. `sndtest.js` covers both features end to end.

## The card-art pipeline

Real art now has a road in. Drop an image named after a card id into
`art/sources/` and run `npm run gen:art` (a dev-only Pillow tool — the game
itself stays zero-dependency):

1. it crops to the artwork (bounding box of non-near-white content, padded and
   squared), so a screenshot with margins works as well as a clean export;
2. removes the white background with a flood fill from the borders — whites
   *inside* the art (eye highlights, uniforms) survive — and feathers the alpha
   edge so linework stays soft on the dark frames;
3. downscales to 384px and embeds the smaller of WebP/PNG as a data URI in the
   generated `src/content/card-art.js`.

`artFor()` in `src/render/art.js` is the one seam: every card surface — hand,
collection tile, focus card, requisition pack — asks it for a face and gets the
photo when one exists, the procedural sigil when not. `check-content` verifies
every art id names a real card and every entry is an embedded image. The
pipeline is proven with `tests/support/fixture-portrait.png` (a white-background
bust with an interior white highlight); copy it to `art/sources/rifle.png` and
run `npm run gen:art` to see the whole path light up.

The first real piece — a Rifleman portrait — was offered but did not survive
the upload (the file that arrived was a stale copy of an earlier screenshot),
so `CARD_ART` ships empty until it lands.

## Placeholder portraits

Until real art arrives, every card now has a hand-authored vector portrait
(`src/render/portraits.js`): a full-bleed 100×140 scene composed from shared
parts — six helmet types on two torso weights for the humanoids, bespoke
bodies for the emplacements, drones and devices, and a prop layer (rifle, bow,
banner, twin blades, thrusters…) that makes each card readable at hand size.
The accent colour is the tier's, and veterancy tint recolours it exactly as it
did the sigils.

`artFor()` now resolves best-available-first: a real image in `CARD_ART`, then
the portrait, then the procedural sigil (still the fallback for hostiles, gear
and anything without an entry). Portraits carry `class="artfill"` and crop to
their frame with `preserveAspectRatio="slice"`, so the same drawing fills the
hand card, the square collection tile, the focus panel and the pack reveal.

`tests/arttest.js` guards the layer: full pool coverage, no two cards sharing
a picture (it caught Rail Sniper and Marksman colliding on its first run),
well-formed markup, and real art still beating the placeholder.

## The balance pass

The three numeric problems the handoff flagged — the economy, Crystals, and
the Gauntlet — addressed in one pass. Every rate below is the aggregate of
three `mtest` runs (~100 missions per type) before and after; all of them come
from the near-random bot and are floors, not measurements.

**Crystals: two levers.** The fourth crystal sat at column 5 — behind the
spawn line, so winning meant holding a tile the horde walks over every turn
while also defending everywhere else. It now sits at column 4, in the neutral
band, matching its partner: two nodes start on your ground, two are contested.
(Placement lives in `launchSpec()` in `src/rules/mission.js`, not in data.)
That alone moved the floor 31% → 37% — real, but "Three breaches" still
dominated the losses, so the mission also went from 7 waves to 6 (the same
length as Extraction), dropping the single heaviest wave. Together: 31% → 52%
over 124 missions, and the failure mix is now split between breaches and
nodes-not-held instead of breach-dominated.

**Specimens: small-hostile quota 5 → 4** (big-hostile quota stays 3), which
was worth a few points — 38% → ~42% pooled, still the lowest floor on the
board. Rather than blunt the mission further, its payout multiplier went
1.35× → 1.55×: it now out-pays everything but Crystals, which is the correct
order for its difficulty.

**Gauntlet: four legs → three**, exactly as the handoff suggested. Per-leg pay
went up (80/130/180 cr instead of 70/110/150/190) so a full clear plus the
250 cr bonus lands at 640 cr, close to the old four-leg total for one less
mission. `GAUNTLET_LEGS` is exported from `mission.js`; the mode card and the
auto-relaunch in wiring read it rather than repeating the number. Full clears
moved from 1-in-15 to roughly 1-in-7 pooled across every post-change run.

**The economy: pay up, prices down.** Campaign node payouts rose from
60–120 cr / 3–7 salvage to 70–150 cr / 5–9 (`genRun()`), and every shop price
came down: commons and tech about 28% (recon 110 → 80, battery 220 → 160),
specialists about 33% (exo 600 → 400), gear about 25% (kit 100 → 75). The
full card collection through the shop alone is now ~5,700 cr — roughly 52
average wins instead of ~86 — and packs keep shortening that in play. First
gear piece is now 4–5 wins away instead of 8+.

After the pass (four pooled runs, ~130 missions per type): stronghold 68%,
retake 70%, extract 95%, civilians 95%, crystals 52%, specimens ~42%;
Onslaught median 10–13 waves (untouched); Gauntlet about 1 in 7. The intended
shape — the two objective missions markedly harder than the defensive four,
and paid accordingly — finally matches the numbers.

## The collection economy rework

A career simulation (40 full 60-mission progressions per spending style,
played by the balance bot, claiming packs and shopping like a player) showed
the loop the mission-level pass could not: a buy-cheap player owned 28 of 38
cards after ten missions, standard packs handed out free Specialists like
commons, and once the collection filled — around mission 25 — credits became
a dead currency, ending careers with 3,000+ banked and nothing to buy.

Four changes, one design:

- **Standard packs draw Commons and Tech only.** Specialists come from
  specialist packs (operation complete, gauntlet complete) or the shop, so a
  340–400 cr price tag is a real saving goal of three or four wins.
- **Duplicates are worth keeping.** One pack slot guarantees an unowned card
  while any remains; the others draw from the whole pool, and a card you
  already own is offered as a field promotion — +12 deployments toward that
  card's next veterancy rank — instead of being filtered out.
- **The campaign drip halved**: a standard pack every second node secured
  (`progress.packMeter`, repaired by `migrate()` for old saves).
- **Credits got a permanent sink**: the Quartermaster sells a standard pack,
  which stays worth buying forever through the promotion chain.

Re-simulated careers: ten missions in, a buy-cheap player now holds ~22 cards
and has met zero or one Specialist; a player saving for Specialists has three
or four of them but half the breadth — the strategies finally diverge. Banked
credits at mission 60 fell from ~3,200 to ~200–400, a never-spending player
is still only at 28/38 after 60 missions, and the full collection lands
around mission 50–60 instead of 25.

### Singles vs packs: the certainty premium

The first cut priced the bought pack at 150 cr — above the ~115 cr average
unowned Common/Tech single, meaning the gamble cost more than certainty, and
the career sim confirmed rational players bought singles first and packs only
with leftovers. That's the paper-Magic trap (packs surviving on lottery
psychology alone); the healthy structure is Hearthstone's, where the random
stream is the budget play and crafting the exact card carries a ~4x certainty
premium.

Two tunings flip Gridfall to that structure:

- **The bought pack costs 100 cr** — below the average single. Breadth players
  gamble cheaply with a choice of three; the exact card at 115–160 cr is the
  certainty premium; Specialist singles at 280–400 cr stay the saving goals.
- **Roughly one bought pack in eight arrives as a priority requisition** — a
  Specialist pack — the jackpot only packs can offer (`PRIORITY_CHANCE` in
  `src/rules/packs.js`, exercised statistically by packtest).

Re-simulated: the breadth player now buys ~33 packs and ~12 singles per
60-mission career (packs went from leftover spending to the main channel),
the saver still shops singles first and converts spare credits to packs after
— both styles viable, same overall pacing.

## The first card drop

Seven new cards, one rework, two gear pieces, from the `new-cards.json` brief.
The removal it listed (`flamer`) was a no-op — that card never existed in this
data. Prices arrived on the pre-rebalance scale and were converted to the
current curve (~0.72x commons/tech, ~0.67x specialists, ~0.75x gear); the
brief's `aura:{repair,cooldown}` field on Forward Base was renamed `sustain`
because `aura` is already a number in this grammar (Scout's damage aura).

Reused machinery: **Fireteam Zaku** rides the Hell Jumpers `squad` path, the
**Medic rework** is a new `healMode:"adjacent"` beside `front` and `col`.
New machinery, each behind its own flag and guard:

- `swap` (**Cipher**) — trades places with any friendly anywhere; both units
  must fit where the other stands; consumes the whole action. `swaptest`.
- `techBuff` (**Engineer**) — +2 damage and 2 repair/turn to the Tech unit
  directly ahead, resolved inside `buffOf()` under the same +2 cap as every
  other buff.
- `charge`+`push` (**Outrider**) — moves up to two forward through clear
  cells; survivors of its hit are driven back one cell, and the push fails
  quietly at the board edge or an occupied cell — damage stands, bodies never
  stack. `pushtest`.
- `zoneMin`/`anyGround` (**Forward Base**, **Minefield**) — deployment zone
  restrictions in `validTiles()`. `zonetest`.
- `sustain` (**Forward Base**) — adjacent friendlies repair 2/turn and
  cooldowns tick one extra step, but only while above 1: stacked with Coolant
  Core, nothing ever reaches zero.
- `mine` (**Minefield**) — hostiles do not read it as an obstacle; the first
  one in takes 6 unreduced damage and spends it. It weighs into `laneScore()`
  like a serious gun, so the horde routes around mined lanes — the steering is
  the card. The reference build never actually had this path; it was built
  fresh.
- `boardFurthest`+`recharge` (**Hecate Platform**) — targets the deepest
  hostile on the whole board, ignoring lanes and blockers (the answer to a
  dug-in Chorus); needs a turn to cycle between shots, surfaced like a
  cooldown. `hecatetest`.
- `decay` (**Stim Injector**) — the host burns 1 hull a turn and can burn out
  entirely; that is intended, not clamped.
- `immuneIndirect` (**I-Field**) — any strike from beyond the adjacent cell
  is absorbed; `strike()` and `forecastThreat()` mirror each other on it.

`cardtest` picked the new entries up automatically (now 45 cards x 12 gear
states, every combination played live). The brief's shelved card — Requiem
Sage, rebuild-a-destroyed-unit — stays shelved until permanent attrition has
been felt in play.

## Campaign maps got a structure

Operations used to be a bag of random nodes you cleared exhaustively. Now the
map itself tells a story, Helldivers-style: main objectives on the route,
bonus side objectives off it, and the way out always at the end.

- **Roles on nodes** (`role` in the operations data): the `start` node is
  always Defend Stronghold, the `final` node is always Extraction — clearing
  it completes the operation (specialist pack, fresh map), and side
  objectives left uncollected are forfeit with it. `side` nodes draw from the
  objective pool and pay 1.5x plus salvage. Extract never appears off the
  final node.
- **Gates** (`req` + `reqText`): a node adjacency would open can be held shut
  until specific nodes are cleared. Blackmarrow uses it for its story beat:
  The Throat — the route to extraction — is dark until the Power Junction in
  the Deep Shaft is reset. The map lists the gate with its reason
  ("Power offline — reset the Power Junction in the Deep Shaft").
- **The three ops now read as places**: Ironveil's split converges on the
  Extraction Point with the Zone C Cache as a spur; Blackmarrow descends
  through the gate; Sunderglass runs twin routes over Prism Ridge with a
  two-node bonus chain in the Glassing. Nodes carry place names, and the map
  draws the roles — gold halo for extraction, dashed for bonus, a gold bar on
  a sealed gate.

Two new mission types joined the objective pool, floors measured beside their
siblings (crystals 43%, specimens 48% in the same runs):

- **Establish Uplink** (41%) — a marked relay tile in the neutral band; hold
  it three turns IN A ROW, losing it resets the charge. The radar-station
  hold.
- **Eradication Blitz** (46%) — destroy ten hostiles before the wave count
  runs out. First cut at twelve measured 24% and was retuned.

`maptest` (guard 30) pins all of it: role invariants across every op and
eight generation rolls each, the Blackmarrow gate, completion-on-final, side
bonus pay, and both new objectives' win-and-reset logic.

## Leads and stratagems

Five unlockable team leads joined the free three, each carrying a passive and
a **stratagem** — a new card class from the leads brief. A stratagem is
seeded into the mission at start (outside the deck), exists once, costs DP,
and resolves at the START of the following turn with its cells marked in
between. The delay is the class's whole identity — a prediction, not an
undo — and the balancing lever if the tier proves strong.

- Wildfire's old active (+4 DP button) converted to the Emergency
  Requisition stratagem for consistency; the lead badge now reports the
  call's state instead of an active's.
- Effects: Duel Protocol (one unit +4 damage, untouchable a turn — but a
  drop-fight on its cell still resolves as a fight; the field, not the
  duel, decides landings), Field Refit (tech to full hull), Silent
  Insertion (three deployments land anywhere), Breaching Charge (column
  sweep, kills at or below 8 hull, blockers and armour floors no
  protection), Grapple Net (lane dragged two cells back, clamped at the
  edge, never stacking bodies).
- Passives: Lone Edge (+2 isolated, outside the buff cap like pristine),
  Field Fabrication (tech +2 hull, 1 repair/turn), Quietstep (drop/crush
  cards cost 1 less, floor 1), Firebrand (+2 DP the turn after a loss),
  Riptide (repositioned units take 1 less, floor 1 — the moved flag is
  stashed before the turn reset so the enemy phase can read it).
- Unlocks gate off the service record (rank, operations cleared — a new
  `stats.opsCleared` counter — and Gauntlet clears); locked leads show
  their requirement on the squad panel.
- **Coronet and General Advance are shelved together**, per the brief: a
  second action for every unit breaks the one-action rule the game rests
  on. Revisit only if the tier reads weak in play.

Guards: `stratagemtest` (seeding, once-per-mission, DP, delay, markers,
expiry), `passivetest` (all five fire and stay silent), `grappletest` (drag
in isolation), `breachtest` (threshold, blockers, floors), and `leadtest`
updated for the conversion.

## Leads in the store, a roster that scales, and three new hostiles

The five unlockable leads became **Quartermaster goods** — recruited with
credits (380–480 cr) instead of gated on the service record. That also hands
credits another premium sink beside packs. The profile stores purchases in
`unlocks.leads` (migrate-defaulted); the free three stay free.

The lead UI was rebuilt for eight: the chip row became a **roster tile grid**
(portrait, callsign, role, perk line, owned/price state), shared by Squad,
the operations screen and the store — the same tile assigns in one place and
recruits in the other. Locked tiles show their price; assigning a lead you
don't own points you at the Quartermaster.

Three hostiles joined the bestiary, one new mechanic each, guarded by
`foetest`:

- **Husk** (common, threat 2) — falls apart on death: two Crawlers spill
  into the wreck cell and the free ground around it. Board-born, `src`-tagged
  so the spawn-marker contract guard knows they were never promised.
- **Mender** (tech, threat 4) — unarmed; advances with the horde and knits
  2 hull into the most wounded hostile in its lane each turn. First shipped
  at 3 and retuned.
- **Screamer** (specialist, threat 7, wave 6+) — its death sends every
  hostile one step forward, breaches included; one scream per causal chain.

**The balance pass after.** The wider pool sank the kill-quota missions:
specimens 44% → 29% (quota-type spawns diluted) and blitz 46% → 34%
(the Mender un-killing progress). Three tunings brought every floor back to
band — a third quota-type entry in the specimens pool, blitz quota 10 → 9,
mend 3 → 2 — and the Gauntlet, which the harder bestiary had crushed to
0-in-30, got its first leg modifier-free (mod chance 0.5 on legs two and
three): pooled floors now stronghold 69%, retake ~66%, extract 93%,
civilians 95%, crystals 46%, specimens 42%, uplink 44%, blitz 58%,
Onslaught median 10, Gauntlet about 1-in-11.

**The roster then folded away.** With eight tiles the grid dominated Squad
and the operations screen, so outside the store it now hides behind the lead
portrait: the portrait is the toggle (a ⇄ chip marks it), tapping it fans
the tiles out with a staggered flow-in, and picking a lead plays a suck-back
animation before the grid folds into the newly assigned portrait, which
pulses once (`absorb`). State lives in `hold.js` (`toggleRoster`,
`closeRoster`, `foldRoster`) and the wrapper is `.leadroster` — squad mode
only; the Quartermaster's grid never folds. The tiles stay in the DOM when
folded (CSS `display:none`), which keeps the render guards honest.

## Neon Sigil card faces

The line-bust placeholders are gone. After a two-round art pitch (five
directions, then Ink Seal vs Neon Sigil size-tested at focus/hand/chip),
**Neon Sigil won**: every card now carries a glowing geometric insignia —
military patch by way of cyberpunk HUD — on a scanlined ground with corner
brackets and a rotated requisition serial (`GF-RIFLE`…). Specialists get
corner blades. `portraits.js` was rewritten wholesale but keeps its exports
(`cardPortrait`/`hasPortrait`/`portraitIds`), so `artFor`'s precedence
(real art → portrait → sigil fallback) and the whole arttest contract stand
unchanged; the bundle got 10KB lighter.

The sigils echo mechanics on purpose: Lance Battery's rail carries its
three range ticks, Tech Blade its three vertical cells, Rail Sniper's beam
runs the full lane, Outrider's arrow shoves a second chevron ahead of it.

Decisions parked from the same pitch: **Ink Seal** kanji faces are reserved
for card backs and ability icons if those ever land, and **Pixel Ops**
animated grid tokens are approved in principle but on hold for iteration —
first note already filed: token bodies need luminance contrast against
their own faction's tiles (light silver units, hot-light hostiles, dark
outlines), never cyan-on-cyan or magenta-on-maroon.

## Ink Seal faces, ghost tiles (art round three)

The Neon Sigil faces lasted one look in play: too busy at store-tile size,
where the full-bleed chrome (glow, scanlines, radial wash, brackets, serial)
stacked under the cost chip, HULL tag and pips. Round three pitched five
calmer directions at true tile size; the pick was **ghost tiles carrying the
round-two Ink Seal**, so `portraits.js` is now the seal system: an ensō
brush ring (heavier stroke on Specialists — rarity you feel before you
read it), one role-picked kanji per card (目 Scout, 臼 Mortar, 貫 Rail
Sniper, 双 Fireteam — all 46 distinct, which is also what guarantees face
distinctness), a nameplate and the red Zanshin chop 残. No filters, no
gradients, no per-card def ids.

Two products, two surfaces. `cardPortrait()` is the full 100×140 face and
shows wherever a card is a poster: the combat hand, the focus view, pack
reveals. `cardMark()` is the bare ensō-and-kanji, drawn full-strength and
faded by CSS (`.inkmark`, 15% — veterancy tiles run brighter and keep the
legend shimmer on the mark). The grid tiles in Squad/Quartermaster/Database
lost their art panel entirely: name, cost, hull and price as a requisition
line-item with the mark as a watermark behind — tiles are half the height,
so the whole pool plus gear plus leads now fits one store screen. Gear
tiles keep the old art-panel layout (they never had faces).

Two layout traps worth remembering: the cost chip inline with the name
broke names mid-word at 62px tiles ("Vangu ard") — the name needs the full
tile width, stats go on their own row; and the seal face slice-crops badly
in non-5:7 frames (the focus view blew the kanji up to fill a square), so
`.fart`/`.pcart` give `svg.artfill` an explicit `aspect-ratio:5/7` window.
arttest now also covers `cardMark` (coverage, well-formedness,
distinctness). Bundle 334→329KB. Kanji render through the system serif
stack (Hiragino/Yu Mincho/Noto Serif JP); a device with no CJK fonts would
show boxes — acceptable for now, and the embedding pipeline is the fix if
it ever bites.

A follow-up pass stripped the tiles further: no cost chip, no HULL tag, no
tier/rarity line anywhere a card is a tile — grid tiles are name + seal +
action footer, hand cards are seal + name (the details panel shows cost and
record on select; unaffordable cards still dim), pack picks are seal +
name + rules text. The ⌕ inspect badge and its focus path are gone from
hand and pack cards — the hand's View card button already covers it, and a
pack pick's text is printed on the card. Grid tiles keep the hover tooltip
with the full statline, and non-card pack picks keep their kind label
("Gear", "Field promotion", "Supplies") since that says what the pick IS,
not its rarity. packtest now guards the badge's absence; help and tutorial
copy updated to point at select → View card.

A third pass unified the tile shapes. Every grid tile is now a 5:7 chip
(`aspect-ratio:5/7`, matching the hand cards) with the same clip-path
corner cut: card tiles (name over seal watermark, footer), **gear tiles**
(converted from the last surviving art-panel layout to the same ghost
chip, their procedural sigil as the watermark — `.inkmark` now also works
as a wrapper div around a plain sigil svg, constrained to 74%), and
**team-lead tiles** (portrait art removed; a nameplate chip — callsign and
role centred, lock pinned to the corner, price/assign state in the
footer; perk names moved into the hover tooltip, full details still in
the buy dialog and the squad lead card). The squad's fold-into-portrait
roster uses the same tiles and the ltflow/ltsuck animations survived
untouched — only the toggle keeps its portrait, since that is the control
the roster folds into, not a card. The 1700px-wide `.cgrid` override drops
from 196px to 108px columns so chips stay chip-sized on big screens; the
`.gart`/`.gname`/`.gcost` era CSS is finally deleted outright.

Leads then joined the tap-for-details contract: `focusLead(id, ctx)` in
focus.js renders the dossier popup — portrait in the art frame, callsign
in the lead's colour, role, bio, passive and stratagem blocks, a status
row — with the assign/recruit actions that used to fire inline on the
tiles (assign folds whichever roster it came from; recruit deducts and
notifies right in the popup, no ask() round-trip). Every lead tile in all
three roster surfaces (Squad panel, Quartermaster, ops screen) now
carries `data-leadfocus` + `data-lctx` instead of the old
`data-lead`/`data-leadbuy` split, and wiring.js owns the per-surface
follow-up via `setLeadFollowUp` so focus.js stays free of hold/ops
imports. Locked leads open the same popup with the gate as status and
Recruit (or "Need N cr") as the action — the "Not on the roster" notify
is gone.

## Synthwave atmosphere

`src/render/music.js`: a generative synthwave loop on the same WebAudio
stack as the effects — nothing to download, honouring the no-assets rule.
Am · F · C · G at 92 BPM: two detuned saws per pad voice swelling a bar at
a time behind a lowpass that breathes on a 0.06 Hz LFO, an eighth-note
saw bass with an octave jump on alternating downbeats, a soft sine-drop
kick each beat, and a sparse triangle arpeggio (≈55% of eighths, chord
tones two octaves up) feeding a dotted-eighth feedback delay and a
procedural convolver hall (2.2 s of decaying noise as the impulse). A
200 ms look-ahead scheduler books ~600 ms of notes at a time — the
standard WebAudio pattern, so tab jank never tears a note.

The switch (`active.settings.music`, "Atmosphere" row in Settings) sits
next to the sound one and follows its exact contract: on by default,
survives a save round trip, every call a silent no-op without WebAudio
(sndtest covers both engines). Startup: a one-shot
pointerdown/keydown/click listener installed at boot fires `startMusic()`
inside the first gesture — the earliest moment autoplay policy allows —
and `paintHold` calls `syncMusic()` so switching to a profile with music
off stops it. Stop is a 0.8 s fade, not a cut; the graph is built once
and reused across stop/start. sound.js now exports its lazy `audio()`
context factory for the music layer to share. Lesson from verification:
a synthetic `.click()` fires no pointerdown, so the gesture list includes
'click' — which is also what lets the Playwright checks (and a
MediaRecorder capture of the live bus) exercise the engine headlessly.

## Pixel Ops: unit tokens on the combat grid

The pixel grid tokens came off hold. `src/render/sprites.js` gives every
unit a 12×12 pixel sprite on the combat board, authored as readable
row-string maps (`o` outline, `b` body, `s` shade, `w` weapon, `g` gold,
`W` white, `v`/`G`/`f` blinking glints) — edit a string, rebuild, the
token changes, which is the iteration loop the user wanted. Troopers
compose from a shared chassis (TROOPER / HEAVY / KNEEL) plus a sparse
per-card overlay for the weapon or prop; emplacements and odd shapes
(drone, fireteam pair, hoverbike, exo frame, Hecate platform) are full
custom maps. Tokens idle on a two-frame bob (staggered per-unit by uid so
a line never marches in lockstep) and their glint pixels blink on a
slower clock; reduced-motion disables both.

The palette enforces the contrast rule recorded when this was parked:
light-silver bodies (#ccd3ea) with near-black outlines over the dark
faction tiles, warm accents only (gold/white/ember) — pixtest (guard #37)
actually asserts no `#4de8ff`/`#ff4d8f` inside any token, plus coverage
both ways and distinctness. In `unitMarkup` the sprite replaces the name
text (name moved to the cell tooltip; the details panel already carries
it), hp shrank to a corner digit, and every status badge (minihp,
incoming, lock, shield, cannon, cycling, spent) survives. Hostiles keep
their glyph-and-intent chips deliberately — that language was built for
threat-reading and stays.

## The hive gets sprites; the Quartermaster sells uniforms

Round two of Pixel Ops. All 14 hostiles now render as pixel tokens too —
bone-and-chitin bodies (#e6d4c4) with near-black outlines and blinking
venom-green glow pixels (`x`), hot-light on the maroon tiles per the
contrast rule; the Sovereign keeps a gold crown. The glyph-and-intent
chip gave way to sprite + intent badge + hp corner digit (glyphs live on
in the wave manifest, where text size wants text). Distinct silhouettes:
drill-nosed Breacher in profile, hollow-cored Husk, round-mouthed
Screamer, three-node Chorus.

**Uniform schemes**: `SCHEMES` in sprites.js defines six field-plate
recolours. First pass used pastels (Duskrose/Regolith/Verdigris/
Whiteout/Emberline) and the user called it: too close together, name a
scheme from across the room. Repainted to bold primaries — Crimson,
Cobalt, Emerald, Rose, Onyx — that read as distinct factions at a glance;
Onyx also overrides the outline colour (`o`, optional per-scheme) to a
light grey, since a near-black body needs a light edge to hold its
silhouette against the dark tile rather than the usual dark-outline-on-
light-body. Standard stays free; the rest are 150–200 cr. Same contrast
rule underneath — b/s/v (and now optionally o) override, weapons/gold
trim/white stay — and pixtest's faction-colour check covers the optional
outline too. The Quartermaster's "Uniforms — credits" section (swatch
chips with a live rifleman preview; tap owned to apply, unowned for a
confirm-and-refit dialog), the `unlocks.schemes`/`loadout.scheme`
persistence, and the migration/blank-profile wiring are all unchanged —
only the palette moved.

## Tactical palette pass: darker tones, green vs purple, drawer in combat

Three follow-ups from the same review.

**Palette.** The uniform schemes read "toy story" — bright saturated
primaries. Repainted the whole `SCHEMES` table to muted, desaturated
military tones: **Standard Issue** (the free default) is now dark olive
drab, replacing silver as the army's main colour — the user's call, so
the default soldier is green rather than neutral. The paid schemes
became Crimson (oxblood), Cobalt (steel navy), Slate (grey; replaces the
old Emerald key since green now belongs to Standard), Plum (replaces
Rose), and Onyx (near-black). The safeguard the user asked for — "if too
dark and blends in with the background, add an outline" — was already
half-built (Onyx's `o` override from the first pass); Cobalt picked up
the same treatment (`o: '#aebde0'`, pale steel) since a dark navy body
sat too close to the friendly tile's own navy background. Every other
scheme's body stays comfortably brighter than the tile behind it, so the
default near-black outline holds without an override. The hive got the
mirror treatment: `PXE_COLOR` body/shade moved from bone-tan to a
mid-bright violet (#8a5cc9/#5c3a86), keeping the venom-green glint —
green army, purple hive, unmistakable at a glance. pixtest is
data-driven off `Object.keys(SCHEMES)` so the key rename needed no test
changes; it still asserts every scheme (including the new optional `o`)
avoids the faction tile colours.

**Menu in combat — tried, reverted.** Brought the pull-up drawer into
combat too: a tab docked top-right by the lead badge, menu dropping down,
with an abort-confirm guard on "Title screen" so signing out mid-mission
still ran `leaveCombat()`'s bookkeeping. The user's call after seeing it:
too much — combat is already the busiest screen (board, hand, action
bar, incoming-threat row, lead badge) and a fifth control competing for
the same top-right corner was clutter, not a convenience. Reverted
cleanly: `#combat.on ~ #drawer{display:none}` restored, the
combat-specific CSS block deleted outright rather than left dormant,
`paintDrawer()`/`dom.js#show()` back to their original unconditional
`▲`, and the `leaveCombat` import and abort-guard branch removed from
wiring.js's `drawhome` handler since they had no reachable caller with
the tab gone. Net diff on the revert was negative — this is why the
combat screen doesn't get a drawer: it doesn't need one.

## Ticker clipping fix, and the corner squares that aren't ours

Two things flagged from a real screenshot. **The service ticker was
clipping the tops of its characters** — mainly visible on the CJK
entries (残心ネット, 通信, 警告), less so on plain Latin. Root cause:
`.tickin` never set an explicit `line-height` (so it computed `normal`),
and `.tickline` had no `flex-shrink:0` in its `.baymain` flex column —
between an implicit line box sized off the UI's Latin monospace stack
and a CJK fallback font (the stack has none of its own CJK glyphs) whose
natural line box commonly runs taller, `overflow:hidden` had a real
chance of slicing the fallback glyphs' ascent depending on the viewer's
OS/font substitution. Fixed with an explicit generous `line-height:1.8`
on `.tickin`, `flex-shrink:0` plus a touch more padding on `.tickline` so
the row never gets squeezed by its flex siblings either. Verified with
IPAGothic (this sandbox's installed CJK fallback) that the 通信 entry
renders with full, unclipped glyphs at the new line-height — the exact
before/after repro was inconclusive in this environment specifically
(this sandbox's font substitution didn't visibly clip either way), but
the fix addresses the actual mechanism (implicit line-height across a
font fallback boundary, inside a shrinkable overflow:hidden box) rather
than papering over one symptom.

**Correction — the gold + violet squares WERE part of the game.** The
first pass concluded browser chrome; wrong, and the user's follow-up
report ("it navigates the same as the readout") was the tell that sent
this back for a real investigation rather than a second guess. Root
cause: a **class-name collision**. The readout's requisition-drop
progress dots (`hold.js`, two small boxes, one gold when a pack is one
node out) and the card veterancy-rank badge (`card-html.js`/`focus.js`,
the ◆◆◆ corner marks) both used `.pips`/`.pip`. The veterancy rule is
`position:absolute;bottom:2px;right:3px` — correct for its own case,
where the card tile itself is the positioned ancestor — but the
readout's dots have no positioned ancestor of their own, so the same
rule sent them hunting up the tree for one and landed on `.scr`
(`position:fixed;inset:0`, full-screen), pinning two ~11×6px boxes to
the *viewport's* bottom-right corner, standing outside their card, still
descendants of `<button id="readout">` and so still fully wired to its
click handler — which is exactly why tapping the "icon" navigated like
the readout. Confirmed empirically both ways: before the fix,
`elementFromPoint` at that corner returned `<span class="pip">` and a
scripted click there flipped the screen from `hold` to `map`; after
renaming the readout's pair to `.rqpips`/`.rqpip` (kept visually
identical, just no longer sharing a name), the same corner resolves only
to the inert `.bayfoot`, a click there does nothing, and the dots sit
correctly inline inside the readout card. Reproduced only at narrow
viewports (≤~390px) in this pass — worth remembering that a class-name
collision like this can hide at one viewport width and surface at
another, since the ancestor chain's positioning can change with layout.

## Design direction on file: the Tech tier

For future card work: **Tech should lean into items, placements and
stratagem-like effects — generally not units.** Think Magic's artifacts
and instants rather than creatures: emplacements, consumables, field
modifications, one-shot calls. The existing Tech units stay for now, but
new Tech design starts from "what does the player place or trigger", not
"what body do they add to a lane".

## Combat track, pull-up drawer, achievements

The music engine grew a second mood: `M_MOODS` holds the 92 BPM Am·F·C·G
hold cruise and a 108 BPM combat track on the Andalusian cadence
(Am·G·F·E) with a denser arp and an offbeat noise hat — same key, same
bus/delay/hall, so `setMusicMood()` crossfades for free at the next
scheduled beat. The `enterCombat` hook flips to combat; `leaveCombat`
flips back.

Navigation reorganised around a **pull-up drawer**: one tab centred on
the bottom edge of every out-of-combat screen (pure-CSS hidden on
title/boot/combat via sibling selectors — the drawer div sits after every
`.scr` in the shell). Tap slides the menu up, tap again slides it down;
it carries Settings, the UI-mode cycler, a live Music On/Off toggle, and
Title screen. The hold's footer buttons (UI chip, Settings, Switch
record) are gone — its footer is just the save flag now — and Switch
record lives on as a Settings "Sign out" row. The #panel overlay was
already global, so Settings opens over ops/map/modes without leaving
them. The ops screen's footnote got a rule and real margin (`.mnote`
finally has CSS), and the lead card dropped its "Runs the squad. Reports
to…" chain line.

**Achievements** folded into Service Record rather than getting a page:
fifteen of them, each a pure function of what the profile already tracks
(stats, unlocks, usage, bests, ops runs) — nothing new is persisted, so
they can never desync from the record they sit beside. Earned rows go
gold with ◆, unearned show live progress fractions. uitest points at the
drawer's UI button; csstest registers `swrec`.

A dead-code sweep followed the UI churn (unused imports in five render
modules, four internal-only functions un-exported, seven orphaned CSS
rules from removed layouts, a leftover `LEAD_DP_BONUS` const). The sweep
also caught a real dropped feature: `drawBoard` computed the `influenced`
cell set every repaint but never applied it — the Scrambler's dampened
lane had silently stopped highlighting even though the `.influence` CSS
survived. The one-line apply is restored and browser-verified (selecting
a Scrambler lights its full lane violet).

The hold's deployment readout slimmed with the same declutter goal: the
node tally ("X / Y nodes secured") and the whole lead row (portrait,
callsign, perk name) are gone — the readout is now operation name,
requisition-drop meter, and the sector-map shortcut; the map thumb still
shows cleared nodes visually. The descent bar's Rename button is gone
too (ship rename lives in Settings, which already had it); `renameShip`
itself is untouched. playtest's readout guard now asserts the removed
rows stay removed.

## The fun patch — variety, drama, and honest enemies

Built from the game-loop review: a near-random bot was winning most missions,
turtling was optimal, every turn felt like the last one, and players couldn't
tell hostiles apart. Four systems landed together:

**Field events** (`src/rules/events.js`) — one-turn conditions on the same
promise contract as the spawn markers: telegraphed a full turn ahead, live
for one turn, gone. Supply Drop (+2 DP), Seismic Tremor (hostile strikes −1),
Grid Overclock (Tech +1), Hive Surge (next manifest +2 threat), Dead Air
(next manifest empty). ~1 turn in 3 carries one. The event clock ticks in
`endTurn` BEFORE the next wave is rolled, so surge/calm shape the manifest
they promised on; tremor and overclock are mirrored in
`forecastThreat`/`dmgPreview` so the previews never lie.

**Last-Stand Protocol** (`breachAt` in combat.js, `G.gridCharge`) — the PvZ
lawnmower, in zanshin colours. Each lane's grid charge answers its first
breach: the breacher and every hostile in the lane die (through `dmgEnemy`,
so splits and screams still resolve — but kills and quota progress are
rolled back; the purge is a save, not a harvest) and the lane goes naked,
its ⛨ pip dark. MAXBREACH dropped 3 → 1: past a spent lane, one body
through ends it. Measured: charges at cap 3 ballooned the bot floors
(stronghold 93%!), cap 1 landed them back in band — stronghold 57%, retake
61%, blitz 63%, crystals 42%, Gauntlet still ~1-in-11.

**Dynamo** — the missing sunflower. Common, 2 DP, 3 hull, unarmed, +1 DP at
the start of each turn while it stands, stacking to +2. Turn one finally has
a greed-or-guns question.

**Enemy legibility** — every hostile chip now carries an intent badge
(`enemyIntent()` in forecast.js, a strict mirror of `actHostile`): ⚔n
strike, ▸/▸▸ advance with banked fractional steps, ✚ mend, ✱ spawn, … hold.
Every type has a fixed glyph on its chip and in the incoming strip, and
tapping any hostile still opens its dossier. The old lone `!` badge is gone.

All of it guarded by `eventtest` (36 guards now): the event clock, both
mirror pairs, the exact surge/calm budgets, the charge spending and the
naked-lane loss, the Dynamo cap, and one truth check per intent kind.

## Record tabs, a true sign-out, and readability round two

Three unrelated asks landed together.

**Service Record grew tabs**, matching Database's pattern instead of
stacking Field record/Achievements/Veterans/Operations one under the
other in one long scroll. `recTab` (module state, mirrors `dbTab`) picks
which section `recordPanel()` returns; `recTabs()` mirrors `dbTabs()`
exactly; a `data-rectab` attribute (not `data-tab` — that one's wired
specifically to `openPanel('database')`) gets its own delegated handler
in `openPanel`'s wiring. Grouped as Record (field stats + Modes — both
are "how the commander is doing" at a glance), Achievements, Veterans,
Operations.

**The drawer's "Title screen" now actually means title screen.** It was
calling `show('boot')` — the profile-select console, one screen short of
the real entry point (`show('title')`, the "Tap to authenticate" splash,
first in `SCREENS`). Fixed to `show('title')` directly; `renderSlots()`
came out since that call only matters for the boot screen it no longer
goes to (the title screen's own tap handler already calls it before
showing boot, so nothing loses its slot list).

**Readability round two.** The type-scale pass below fixed 6.9px prose:
players still find it hard to read in direct sun. This pass repeated
that pass's exact methodology one tier further: every micro font-size in
the ladder (`0.4688rem` through `0.9375rem`, in the stylesheet *and*
every inline style across four render files — 167 sites) shifted up to
the next rung by a script matched on exact values, not a blind formula,
so nothing drifted off-ladder. The root clamp rose `14–24px` →
`16–26px` (ratio 1.625, still clears scaletest's 1.6× floor). Map SVG
node/sub/zone labels went up another unit each (9/8/10). One thing the
bigger scale broke that the earlier pass didn't have to deal with: the
Service Record's new 4-tab row no longer fits 390px at the larger type
("Operations" clipped clean off) — `.tabs` picked up the same
`overflow-x:auto` + thin styled scrollbar treatment already used for
`.incoming`/`.hcards`/`.cblog`, so a cramped tab row scrolls instead of
clipping, on any panel, at any width, permanently (this will keep
paying off if a panel ever grows a 5th or 6th tab). Verified overflow-
free at 390px afterward, same bar the first pass set.

## The readability pass

Players reported the text still read busy and small. The root cause was
arithmetic: the root clamps to its floor on phones, and the body-copy tier
sat at 0.5312rem — **6.9px** at the old 13px floor. The fix was systemic,
not spot edits:

- The whole micro type scale moved up one tier (0.5312→0.5938,
  0.5625→0.625, 0.5938→0.6562, chip tiers likewise), in the stylesheet and
  every inline style, keeping the hierarchy intact.
- The root floor rose 13px→14px (the clamp still spans 1.7×, which
  scaletest requires).
- `--dim` lightened #7a74a8→#948ec4 — most prose is dim-on-panel, and the
  old pairing sat near 3.9:1 contrast at tiny sizes.
- The map SVG labels went up a unit each (nodes 7→8, subs 6→7, zones 8→9)
  with the same contrast lift.

Net effect on a phone: the smallest prose went from ~6.9px to ~8.3px and
brightened, with every screen verified overflow-free at 390px (the combat
hand, header and action bar included).

## Three deep-zone operations

The campaign doubled: **Lumenspire**, **Crownring** and **Shallowhelm**, each
built around a shape rather than a reskin, and each hotter than the first
three. Two small engine features carry them:

- **Pinned mission types** — a map node can declare `type` and skip the
  roll. That is what makes "extract the research data" an actual Uplink on
  the Archive Core every run, and a rescue actually Civilians.
- **Heat** — an operation-level 1–3 that goes straight into every wave's
  threat budget (`wave()` adds `G.heat`) and pays for itself (+25% credits
  and +1 salvage per point, applied node-by-node in `genRun`). Calibrated
  with a 60-run bot sweep: heat 1/2/3 costs the near-random floor roughly
  5/15/30 points on stronghold — veteran content, not a wall. The ops
  screen shows heat as red ▲ pips; the combat log announces it. Crystals
  could not carry it (12% floor at heat 3), so nodes can override the
  operation's heat — Shallowhelm's mandatory Power Vault runs at 1 (26%
  floor) while the rest of the fortress runs at 3.

The shapes: Lumenspire is a straight city spine — gates → Archive Core
(uplink, gated ahead of Extraction) → evac — with the Researcher Dorms as a
one-node Civilians side branch. Crownring is concentric: Summit Hall start,
X routes to four second-ring nodes, a plus of four ward gates outside; the
Northgate Delegation (civilians) gates the Accord Extraction, the east and
west gates are bonus — the burrower-ambush-at-the-summit lore is DeeWolf's.
Shallowhelm forks three ways from the Gatehouse — Power Vault (crystals),
Records Hall (optional uplink side), and a Cleanse wing gated on the power
branch, ending in a Blitz purge — then the final Extraction sits back at
the Gatehouse, gated on the Cleanse Core: the way in is the way out.

`maptest` grew the Crownring and Shallowhelm gate walkthroughs, pinned-type
and heat-propagation checks across every op, and an exact wave-1 budget
assertion for heat.

Every operation then got a **situation report** — `operations[k].lore`, a
three-or-four-sentence briefing rendered under the map SVG on the operation
page (`.oplore`, left border tinted with the op's colour, headed 状況 ·
Situation report). maptest treats a missing or thin report as a failure.

## The hold stopped wasting its lower half

The menu column used to end at the four tiles, leaving a dead band the
height of the tile grid on phones and half the sidebar on desktop. Two
additions fill it:

- **The current-deployment readout** (`#readout`, painted by `paintHold`) —
  the active operation's mini-map (`opThumb`, moved to `hold.js` and shared
  with the ops screen), nodes secured, the assigned lead with their perk,
  and a two-pip requisition-drop meter. The whole card is a shortcut that
  drops straight onto the active operation's sector map, skipping
  modes → campaign → operation when you just want to continue.
- **The service ticker** (`.tickline`, pinned with `margin-top:auto`) — a
  slow 残心ネット crawl of flavor chatter plus two live lines (operation in
  progress, commander on deck). Two copies of the line and a −50%
  translate keyframe make the loop seamless.

One trap worth remembering: the ticker's `white-space:nowrap` line blew the
hold's `1fr` grid column out to 4300px on phones — grid items default to
`min-width:auto`, so the nowrap content became the column's minimum. The fix
is `min-width:0` on `.bay`; the desktop layout only survived because its
column max (`32%`) is definite.

## The pop layer

Violet stepped up from bit-part to third lead, and the palette stopped being
flat: primary buttons run pink-to-violet, section and box headers carry a
violet ✦ spark, the console label line became a pink-violet holo gradient,
and the out-of-combat screens (login, modes, operations, map, panels) sit on
subtle violet-and-pink aurora glows. The title wordmark is holographic
(white → cyan → violet → pink) under twinkling violet stars. Combat is left
alone — the board's readability outranks the mood there.

The login console lost the redundant GRIDFALL wordmark (the title screen owns
it now) and reflavoured as an authentication terminal: 認証 in holo gradient,
"Commander authentication · 残心ネット", boot-log lines tagged with kanji
(接続 / 暗号 / 登録 / 待機), and "Command records · 指揮記録".

## The flight clock rotates

The hold screen's "Descent T−3:33" label used to be static text — always
"Descent," only the countdown moved. It now cycles through the ship's own
flight: **Descent → Ascent → Enroute**, on repeat, each phase a fresh
`T−3:34` countdown. `battlefield.js` keeps a small `PHASES` array (same
214s duration each, for now — the value was already arbitrary flavour
before this) and a `CYCLE_SECONDS` total; `paintChrome()` — already
running every animation frame for the engine-vibration effect — walks
the array against `t % CYCLE_SECONDS` to find the active phase and its
remaining time, same cost as the old single-phase math. The "Descent"
word in index.html became `<span id="phase">`, painted alongside `#eta`
by the same function. Verified the Descent→Ascent boundary live with
Playwright's clock API (fast-forwarded 214s of virtual time, watched the
label flip and the countdown reset), and checked all three boundaries
plus the wrap back to Descent by running the same phase-selection
algorithm standalone — driving the full rAF-based scene through 642
virtual seconds in one browser session was too slow to be worth it once
the logic was confirmed identical across every boundary.

## The zanshin accent

The 残心 magenta (`--zan: #ff4d8f`) became the game's brand colour: primary
buttons, screen and panel titles, the console chrome, tabs, dialog titles,
callsigns, the OPERATIONS launcher, log headers, map briefing names. The
battlefield's tactical language is deliberately untouched — cyan still means
yours (tiles, unit chips, hull bars, deploy targets) and the hostile tint
still marks theirs — and cyan also stays on tech-tier cards and the salvage
currency, where it is semantic. Danger buttons (abort, cancel placement)
moved to true red (`--red`) so the brand and the warning never share a hue
on the same screen.

## Pixel tokens joined the palette, not just the vibe

"Make the pixels cohesive with the game's overall style" landed as a
concrete, checkable move rather than a re-skin: `sprites.js`'s outline
ink and its two identity-bearing accents now use the *exact* hex the
rest of the UI uses for the same idea, not a custom colour that merely
resembled it.

- **Outline ink** (`o`, every friendly and every hostile sprite):
  `#12102a`/`#170a20` → `#0e0c1e`, which is `--deep` — the same dark the
  ink-seal card backgrounds and every panel are built from. Both
  factions' pixel art is drawn with literally the same ink now, not two
  near-black tones that happened to look similar.
- **The visor glint** (`v`, every uniform scheme but Onyx): `#ffd970` →
  `#ffc94d`, exactly `--gold` — the same gold as specialist card
  borders, achievements, and salvage currency. "This unit is yours and
  alive" is now the one gold the rest of the game already uses for
  "valuable/earned," not a private near-gold. Onyx's danger-red visor
  snapped to the exact `--red` token the same way.
- **The hive's body colour** (`b`, all 14 hostiles): `#8a5cc9` →
  `#9d6bff`, exactly `--violet` — the game's third named accent (team
  leads, the `.sect::before` ✦ spark, stratagem cards). Purple now means
  one specific thing everywhere in the game, including on the board.

Deliberately did **not** collapse every sprite colour onto a token —
weapon metal, cloth shade, armour base stay their own custom hexes.
Forcing all of it onto three UI variables would flatten the sprites into
swatches; only the outline (structural, shared by definition) and the
two colours that actually *mean* something game-wide (gold = yours,
violet = hostile) needed to be the literal same value, not a close one.
pixtest's contrast guard still passes unchanged (it checks for the
faction *tile* colours, cyan/magenta, which none of this touches).
Verified visually: the Quartermaster's card grid and Uniform swatches
now read as one palette family, and on the board the hive's violet is
unmistakably the same violet as the lead badge sitting above it.

## Briefings, a wordmark that breathes, English first, and a daily op

Four asks landed together: hint cards on the hold panels, an animated
title, the boot screen's language order, and a daily challenge mode.

**Hold-panel briefings.** Each of Squad, Quartermaster, Database and
Service Record now opens with a one-paragraph tip in the same
second-person "Commander" voice as the combat tutorial — what the panel
is for and the one thing worth knowing before touching it (lead sets the
squad's passive; credits buy cards and uniforms, salvage buys gear;
every asset/gear/hostile you've met logs itself here; the Record tabs
switch above). `hintCard(key)` in `panels.js` reads
`active.settings.hints[key]` — dismissed collapses the block to a small
"▸ Briefing" pill, tapping the pill brings it back. State is per-key, on
the profile, lazily defaulted the same way `sound`/`music`/`tutorial`
already are — no `profile.js` migration needed. Verified with a DOM-stub
script: all four panels show the hint by default, dismiss collapses it,
re-tapping restores it, and a real-browser screenshot confirms the
Squad panel's card.

**Animated title wordmark.** `.twordmark` ("GRIDFALL") now breathes —
the gradient stops extended (`#fff → cyan → violet → zan → cyan → #fff`)
against a `260% 100%` background-size, with `background-position`
ping-ponging `0% → 100% → 0%` over 8s (`ease-in-out`, so no seam math is
needed for a hard loop). Measured in a real page: `background-position`
moved from `1.36% 50%` to `82.3% 50%` between two samples 2.5s apart —
it's actually animating, not just declared to. Nothing else on the
title screen changed: `.tkanji` (残心), `.tsub` (Zanshin Protocol),
`.tprompt` and `.timport` are untouched, and the existing global
`prefers-reduced-motion` rule (`* { animation: none !important }`)
already disables it for anyone who asked — no new guard needed.

**Boot screen: English leads, kanji follows.** "Commander authentication"
was the small caption under a huge glowing 認証 heading — moving the
kanji below without touching size would've left a giant kanji sitting
over tiny English, which isn't what "move the Japanese under the
English" meant. Instead the roles swapped: `.authtitle` (new class) is
now the bold gradient heading carrying "Commander authentication", and
`.authkanji` — demoted to the small violet caption size the English used
to have — reads `認証 · 残心ネット`, merging in the network tag that used
to sit on the English line. `index.html`'s `.conbody` now orders
`authtitle` before `authkanji`; confirmed in a real page that the DOM
(and visual stack) puts English first.

**Daily Challenge.** A fourth mode card, `--violet` accented to match
Gauntlet's gold/Onslaught's magenta/Campaign's cyan trio getting a
sibling. One mission type + one modifier, the same for every commander
on a given calendar day — picked by hashing `todayKey()` (the
commander's local `YYYY-MM-DD`) twice with a small string hash
(`dayHash`, `Math.imul`-based, nothing to do with the shared gameplay
RNG in `state/rng.js`) to index into `Object.keys(MISSIONS)` and
`Object.keys(MODS)` separately. That's deliberate: the mission and
modifier are fixed for the day, but `launchSpec()` still shuffles the
deck and rolls spawns fresh every attempt, so same-day retries aren't
the same run replayed.

`launchDaily()`/`settleDaily()` in `mission.js` sit alongside the
existing `launchOnslaught`/`settleOnslaught` and
`launchGauntlet`/`settleGauntlet` pairs, wired into `finish()`'s
dispatch. Only a **win** writes `active.daily = {date, done, streak}` —
a loss touches nothing, so same-day retries never cost the streak, which
is the whole point of a forgiving daily. Streak logic: if yesterday was
the last *completed* day, extend it; otherwise reset to 1. Winning twice
in one day pays out once — the second clear reports "DAILY ALREADY
CLEARED" and skips the reward, checked by comparing today's key against
the stored date. Reward scales gently with streak (`120 + streak×15`
credits, `8 + streak×2` salvage, capped at streak 10), and every fifth
streak day queues a specialist pack instead of standard.

Abort mid-daily (`abortMission()` now returns `wasDaily` alongside the
existing `wasEndless`/`wasGauntlet`) and the result screen's "Continue"
handler both route back to Mode Select rather than the campaign map,
same as Onslaught/Gauntlet — there's no map node to return to.
`confirmAbort()` in `combat.js` got its own daily-specific stakes text
("streak is untouched") instead of falling through to the campaign
wording.

Verified end to end with a script driving the real rules layer (no
browser): first win of the day paid out and set `streak: 1`; replaying
after the win reported "DAILY ALREADY CLEARED" with credits unchanged;
aborting mid-attempt left `active.daily` byte-for-byte identical to
before the abort. `csstest`'s static id-audit needed `goDaily` added to
its `DYNAMIC` allowlist (it's built at runtime like the other three mode
buttons) — the only test-suite change this batch needed.

All four verified together: `node build.js`, 37/37 guards green, and
real-browser screenshots of the title screen, boot screen, hold panel
hint (open and dismissed), and mode-select grid with the new card.

## Panel briefings became coach cards, not dismissible sidebars

Follow-up on the hold-panel hints from the previous entry: "make them a
one-time thing, use the combat tutorial as reference, keep it
consistent." The inline `.hint` cards (violet-bordered, sat inline in
the panel flow, dismissed to a small pill you could re-tap) were a
different visual language from the game's one other onboarding surface
— the gold coach card that walks a new commander through their first
mission. Two teaching moments, two looks. Fixed by throwing the inline
version out and building the hold-panel version directly off
`tutorial.js`'s chrome instead of a lookalike.

`panel-hints.js` is new and reuses `tutorial.js`'s CSS classes verbatim
— `.tutcard`, `.tuttitle`, `.tutbody`, `.tutacts` — nothing new to keep
in sync by hand. What differs is the host and the trigger: `#tut` sits
inside `#combat` and steps through five stages tied to what the player
does on the board; `#paneltut` sits inside `#panel` (same absolute
positioning, same z-index, added to the same `#tut,#paneltut{...}` CSS
rule) and shows exactly one message with one "Got it" button, because a
menu screen doesn't have "do the thing" checkpoints to advance on.

**One-time means once, not dismiss-and-reopen.** `openPanel(key)` now
calls `maybeShowPanelHint(key)` after every render, which checks
`active.settings.hints[key]` and shows the card only if that commander
has never dismissed it for this panel — not per-visit, and it does NOT
reappear on the next `openPanel()` call the way the old inline pill did.
Dismissing is the only thing that sets the flag, matching how the
combat briefing only marks itself `'done'` when a step is actually
finished or skipped, never on a bare render.

**Reappearing lives in Settings, next to its sibling.** The existing
"Combat briefing" row (queues a replay for the next campaign mission)
now has a "Panel briefings" row directly under it, same row markup,
same `Replay` action label. Clicking it clears `active.settings.hints`
to `{}` — unlike the combat briefing, there's no queued/deferred state
to track, since the next `openPanel()` call (which could be the very
next tap) picks it straight back up.

Verified with a DOM-stub script driving the real render/state code (no
browser): all four panels show their card on first-ever open; a panel
re-opened without dismissing shows it again (expected — only dismiss
marks it seen, not display); dismissing sets the flag and it stays gone
on every subsequent open; the Settings row clears the flags and the
card comes back. Confirmed visually too — the Squad panel's coach card
is pixel-for-pixel the same gold chrome as the combat briefing, and
Settings shows "Panel briefings — Replay" sitting right under "Combat
briefing — Replay."

## Combat got its own track, not a faster remix of hold's

Follow-up on last session's music check: I'd confirmed the mood switch
was technically firing (tempo, hat, arp density all measurably changed)
but the user still couldn't hear a difference in play, and said so —
"can you make it a different enough track?" The diagnosis held up: both
moods shared the same key (A minor), the same oscillator waveform, the
same instrumentation, and the same mix. A modest tempo bump and a quiet
hi-hat under all that sameness reads as "the same song, a bit brisker,"
not a mood change. Fixed by actually changing the things a listener
keys on — key, timbre and drums — not just the things easiest to tune.

**Different mode, not a reordered progression.** Hold still cruises
Am·F·C·G. Combat dropped the old "same four chords, different order"
approach (Am·G·F·E) for a real key change: an E Phrygian vamp,
Em·F·Em·Bb. The i→bII half-step (Em to F) is the standard "danger" cue
in film/game scoring — a different mode, not a shuffle of the same
notes, so combat sounds like it's in a different harmonic space, not
just re-sequenced.

**Square waves instead of sawtooth, for both pad and bass.** `M_MOODS`
gained a `wave` field per mood; `mPad`/`mBass` now read it instead of a
hardcoded `'sawtooth'`. Square's odd-harmonics-only spectrum reads
harder and buzzier than a sawtooth at the same gain — the whole
instrument palette changes character, not just the notes it plays.

**A real backbeat, not just a louder hat.** Added `mSnare()` — a
band-passed (1.8kHz) noise crack, wider and punchier than the existing
highpass hat — firing on beats 2 and 4 (`mood.snare`). Combat now has an
actual kick+snare rock/action pattern; hold keeps its plain kick pulse.
The bass also cuts each beat into `bassDiv` slices (2 for hold's
straight 8ths, 4 for combat's driving 16ths) instead of a fixed
subdivision, with note length scaling down so the denser 16ths don't
smear into each other.

**Mix gets tighter, not just busier.** `filterHz`/`filterLfo`/
`filterDepth` and `verbWet`/`delayWet`/`delayFb` are now per-mood too —
combat runs a brighter, faster-moving filter (2400Hz vs 900Hz, LFO
0.22Hz vs 0.06Hz) and a drier send (verb 0.16 vs 0.35, delay 0.22 vs
0.3), so it reads as tighter and more immediate instead of just louder
or busier under the same wash hold uses.

**The switch had to not click.** The filter/delay/hall parameters live
on shared graph nodes built once and reused across the whole session —
snapping them straight to the new mood's values on every `enterCombat`/
`leaveCombat` would pop. `applyMoodTone()` ramps all of them via
`setTargetAtTime` (~0.5s time constant) instead, called from
`setMusicMood()` whenever the mood actually changes (a same-mood call is
now a no-op, where before it re-set the identical value every time).
Tempo, key and instrumentation aren't ramped — the very next scheduled
beat just uses the new mood's `moodDef()`, so the switch is immediate
where it should be and smooth where a hard cut would be audible.

Caught one bug before it shipped: promoting `delay`/`verb` from locals
to module-level `mDelay`/`mVerbWet` (needed so `applyMoodTone()` could
reach them) left one stale reference — `arpSend.connect(delay)` — that
would have thrown on the very first note. Found it on a straight re-read
of the diff, not by running it first.

Verified the same way as the first pass — a script patching
`AudioContext.prototype.createOscillator`/`createBufferSource` in a real
browser session to count what's actually being scheduled, not just what
the code says it should do:

- Hold (5s): 26 sawtooth notes, 0 square, 0 hat, 0 snare, 1.40 kicks/s.
- Combat (5s): 0 sawtooth, 62 square notes, 11 hat hits, 5 snare hits,
  2.20 kicks/s — dead-on the 132bpm target (2.2/s exactly).
- Aborting a mission back to the map reverted cleanly to all-sawtooth,
  zero square — the mood switch un-does itself, no stuck state.
- No page errors across any of the runs.

## Twelve new cards, because the collection finished too fast

Player feedback: with a free pack every second node held (plus specialist
packs off ops and gauntlets), the whole 46-card collection was maxed out
in well under a real weekend — packs stopped feeling like a reward and
started feeling like a formality. Two ways to fix that: shrink the drip,
or grow what it's dripping into. Cutting the free-pack cadence was the
one-line option, but packs are also the delivery mechanism for gear,
veterancy promotions and salvage, not just cards — throttling them back
would have dulled three reward loops to fix pacing on one. Grew the pool
instead: 46 → 58 cards, roughly the same math (the guaranteed-unowned
slot still clears the standard pool in at most one pack per card) now
taking noticeably longer to run out of new things to pull.

Every one of the twelve reuses fields the combat engine already
understands — no changes to `targeting.js`, `units.js` or `combat.js` —
so this was purely a content patch: `reference/gridfall-data.json`,
regenerate, then a kanji glyph (`portraits.js`) and a pixel sprite
(`sprites.js`) per card, since both are guarded (`arttest.js`/`pixtest.js`
fail the build if any card in `POOL` is missing a portrait or a token, or
if any two render identically).

Filled real gaps in the existing roster rather than reskinning it:
**Ashigaru Line** (a cheaper `squad` swarm below Zaku), **Pike Wall**
(reach *and* a blocker, a combination nothing else has), **Sentry Ronin**
(a glass-cannon riposte counter-puncher, lighter than Knight's
block+regen+riposte kit), **Falconer** (armed, unlike the unarmed Recon
Lark), **Rampart** (the paid middle ground between free Barricade and
Bulwark), **Piercer Turret** and **Bore Lance** (armour-piercing versions
of Lance Battery and Tech Blade), **Suppressor** (Scrambler's dampen,
doubled, as a standalone card instead of a stack), **Reactor Core** (a
bigger, thinner-hulled Supply Drone), and three Specialists — **Kessen
Vanguard** (Assassin's any-tile strike at Specialist stats), **Thruster
Ram** (Outrider's charge+push with a blocker bolted on), **Field
Marshal** (the first card to buff its lane and its column at once).

Also fixed while in `gen-content.js`: the banner comments on
`cards.js`/`gear.js`/`hostiles.js` were hardcoded counts ("39 deployable
cards", "8 gear pieces", "11 hostile types") that had already drifted
from the real 46/11/14 before this patch — same mistake this change
would have repeated at 58 if left alone. Now computed from the data file
each regen, so the comment can't lie again.

Verified in a real browser: seeded a save with all 58 cards owned before
the app's own boot script could run (the straightforward "write
localStorage then reload" approach kept losing the edit to the
`beforeunload → commit()` handler saving the stale in-memory profile
over it — a testing-script gotcha, not an app bug, fixed by seeding via
`page.addInitScript` ahead of the first load instead). All twelve new
`data-focus` ids render in the Squad reserve grid, the Database panel
reports "Assets on file 58", and a Kessen Vanguard focus card opens
cleanly with its own kanji seal and full stat block. `npm test` — all 37
guards, including the two art-coverage guards for the newly-added ids —
pass clean.

Deliberately did not touch the free-pack cadence (`packMeter` in
`mission.js`, currently one pack per two node wins) at the time this
patch shipped — the pool growth alone seemed likely to slow full
collection enough on its own without changing a system players were
already used to. Bumped to 3 shortly after; see below.

## packMeter bumped to 3, to see how it feels

Follow-up to the 58-card patch above. Nudged the free-pack threshold from
2 node wins to 3 — `PACK_METER_GOAL` in `mission.js`, now a named
constant instead of an inline `2`/`3` so the next tuning pass (up or back
down) is a one-line change with nothing else to hunt for. The hold
readout's "N nodes out" pip counter reads off the same constant, so it
already understood a 2-pip layout without being told; verified all three
states in a real browser (0/1/2 progress correctly text as "3/2/1 nodes
out" with 0/1/2 pips lit). `packtest.js`'s cadence guard was hardcoded to
the old every-other-win math — the only thing this one-line balance
change actually broke — now reads `PACK_METER_GOAL` too instead of a
second hardcoded `2`.

## Six new gear pieces, all hybrids of what already existed

Gear is one slot per card, which makes a plain "bigger version of an
existing piece" (a Barrel that gives +2 instead of +1) a weak kind of new
content — it doesn't add a decision, just a bigger number on the same
decision. The slot constraint is exactly what makes a *hybrid* piece
interesting instead: bundling two existing single-effect pieces onto one
item is the only way to get both effects on the same unit at all, since
normally picking one gear means giving up the other.

Added six, each priced below the sum of the two standalone pieces it
combines (you're trading flexibility for the bundle, not getting it
free): **Twin-Link Servo** (Servo Legs + Extended Barrel), **Adaptive
Plating** (bigger Reactive Plating + Ablative Weave), **Overclocked
Uplink** (Targeting Uplink + Coolant Core), **Vanguard Rig** (a plain
damage+hull hybrid with no direct precedent), **Ghost Plating** (Phase
Cloak + Ablative Weave — two survival mechanics on one card is the
strongest combo in the batch, priced accordingly at 140), and **Rapid
Kit** (Field Kit + Servo Legs, a tempo piece).

Even lighter to ship than the cards: gear focus art is `sigil()`, a
hash-seeded procedural SVG (`art.js`), not a hand-authored asset, so
there's no kanji/sprite to add — this was purely
`reference/gridfall-data.json` plus a regen. `cardtest.js` already
smoke-tests every card against every gear piece automatically
(`Object.keys(A.GEAR)`), so the new pieces got full coverage for free —
58 cards × 18 gear combinations (including "none") ran clean without
touching that test.

Verified fitting one onto a card end-to-end in a real browser: opened a
card's focus view in `gear` mode, clicked the new piece's chip, confirmed
`loadout.gear` actually recorded the assignment. First attempt through
this hit a pure testing-script bug worth naming since it looked like an
app bug at first: I closed a *gear-piece* focus popup (opened from the
Quartermaster, via `focusGear`) by clicking `#pclose` — which closes the
underlying *panel*, not the focus overlay (`#pclose` and the focus
popup's own close button are different elements). The stale overlay sat
on top through the next few steps and made a later click look like it
failed. Reproduced clean in an isolated script with nothing left open
between steps — fit the gear, the save shows `{rifle: 'rapidkit'}`, no
page errors.

## Salvage is gone — gear spends credits now

Explicit request: drop the second currency entirely, have gear buy with
credits, and update everything downstream — client and tutorial both.
Salvage touched more of the codebase than any single-currency change has
reason to: node generation (`run.js`), five settle functions
(`mission.js`), the pack system's consolation-prize fallback
(`rules/packs.js`), the save schema and its migration (`profile.js`),
and every render surface that showed a price or a balance
(`panels.js`, `focus.js`, `hold.js`, `map.js`, `result.js`, `modes.js`,
`packs.js`) plus the one-time Quartermaster coach card
(`panel-hints.js`) — the "tutorial" half of the ask.

**The merge, not just a strip.** Every node used to carry two reward
numbers — `reward` (credits) and `salv` (salvage) — generated
independently and paid out independently. Folded `salv` straight into
`reward` at every point it used to be set (base roll, per-type
multiplier, side-objective bonus, heat surcharge) instead of keeping a
second field that would just get added to the same pot at settle time —
one number in, one number out, nothing spent tracking a sum that always
had the same destination. The four settle functions (`onslaught`,
`gauntlet`, `campaign`, `daily`) each shed their `sv` half accordingly;
`settleCampaign`'s "extra credits per 5 kills" flavor survived as
`Math.floor(G.kills / 5)` added straight onto `cr`, just no longer
badged separately as scavenged salvage.

**A modifier collision, caught by grep before it shipped.** The
"Salvage" battlefield modifier (refunds 1 DP per kill) has nothing to do
with the currency — it just happened to share the English word. Left
alone it would have read as a leftover reference to a system that no
longer exists, so it's `scavenge` now (same effect, same rarity — a pure
rename, `combat.js`'s `G.mod === 'scavenge'` check included).

**Gear pricing, rescaled, not just relabeled.** Credits and salvage were
never the same denomination — a node paid roughly 15x more credits than
salvage on average. Copying the raw salvage numbers over as credit
prices unchanged would have made every gear piece nearly free relative
to how fast credits come in. Rescaled 3x instead (135–420cr), anchored
against card prices rather than the old per-node ratio: the cheapest
piece sits below a common card, the priciest hybrids (Ghost Plating,
Rapid Kit) land close to a Specialist's price — "gear costs about what a
card of comparable weight costs" reads as the right intuition for a
merged economy, not a mechanical multiplication of the old numbers.
Starting credits went from 300 to 420 (the direct sum of the old
starting pools, 300 + 120) so a new commander's total day-one buying
power doesn't shrink just because the pools merged.

**Existing saves keep their salvage, not lose it.** `SAVE_VERSION` bumped
to 5; `migrate()` grew a version-gated block, cascading after the
existing v4 block exactly like v3→v4 did, that folds
`progress.salvage` into `progress.credits` and deletes the field —
never invented, never discarded. Verified live: seeded a v4 save with
555 credits and 333 salvage on the books, loaded it, and the profile
came back with exactly 888 credits, no `salvage` key, `version: 5`. A
v1-shaped legacy import (no salvage field at all) cascades through both
migration steps in one pass without incident — folding `undefined || 0`
is a no-op, not a crash.

Full 37-guard suite passes (`sndtest`'s legacy-import check now compares
against `SAVE_VERSION` instead of a hardcoded `4`, so the next version
bump won't silently go stale the way the gen-content banner comments
did back at the 58-card patch). Verified the rest live in a browser: the
hold screen's purse shows Credits only, the Quartermaster grid prices
every gear piece in `cr` with the new coach-card copy, and buying
Reactive Plating deducted exactly 120 credits and granted it.

## Three small polish requests off the back of the credits merge

**Drawer UI chip drops the resolved submode.** The pull-up drawer's `UI ·`
chip used `uiModeLabel()`, which for the `auto` preference reads
"Automatic · Desktop" or "Automatic · Compact" — useful detail on the
dedicated Settings row, noise on a one-line quick-toggle chip you're
about to tap past anyway. The chip now reads `UI_LABELS[uiPreference()]`
directly — just "Automatic", "Desktop" or "Compact" — while the Settings
panel's "In force" row keeps the detailed form unchanged; only the
drawer's chip needed a narrower answer, not the whole label function.

**Redundant "— credits" dropped from every shop category header.**
Leftover from the two-currency Quartermaster, where a section that
happened to spend the *other* currency (gear/uniforms — salvage; cards —
credits) needed the label to tell them apart. Now that the top bar
already says "Credits 3000" and the subtext already says "Cards, gear
and uniforms all spend the same credits," repeating "— credits" on
Common/Tech/Specialist/Gear/Uniforms/Team leads was just noise with
nothing left to disambiguate. Five section headers, one word dropped
from each.

**Four more uniform schemes.** Umber (brown, 150cr), Teal (blue-green,
175cr), Sand (khaki, 175cr), Indigo (blue-violet, 225cr, with the same
lightened-outline treatment Cobalt and Onyx use so a dark body doesn't
blur into the tile ink). Same rules as the original six: desaturated
tactical tones, gold visor pip on all of them (the "yours and alive"
signal the sprite header comment calls out as a near-invariant — Onyx's
red visor is the one deliberate exception, not a precedent to extend),
and no faction cyan/magenta. `pixtest.js`'s scheme guards (distinctness,
contrast, complete field set) covered the new four automatically —
10 schemes, all checks pass, no test changes needed.

## Card art stops printing the name twice

`cardPortrait()` (the full seal face — combat hand, focus view, pack
reveals) baked a small caps nameplate into the bottom-left of the SVG
itself, on top of the ensō and kanji. Every surface that shows this
portrait already prints the card's name right next to it — `.n` under
the combat hand tile, `.fname` in the focus popup, the pack card's own
title line — so the art was saying the name a second time nobody asked
for. Dropped the nameplate `<text>` and the `name` variable that fed it
entirely; nothing downstream reads it, so the art now only knows the
kanji and the accent colour.

That freed the vertical space the nameplate used to own, so the ensō
and kanji move from `cy 58` to `cy 70` — true vertical centre of the
140-tall frame instead of pushed up to leave room below. Checked the
seal's new footprint against the chop stamp (still bottom-right,
untouched) before committing to it: the ring's bottom-right arc comes
close but doesn't cross into the chop's box at the sizes actually
rendered. Confirmed live — Exo Juggernaut's focus portrait and a combat
hand with two different cards both show a centred seal, no leftover
name text, no overlap with the chop. Full suite still passes; nothing
in `arttest.js` asserted on the nameplate text, so no test changes
needed.

## The hand tray collapses to give the board back its room

Request: let players see more of the board. The hand strip is the
single biggest fixed cost in the combat screen's vertical budget — on
any layout wide enough to size the board off remaining height (the
`.field{max-width:calc((100vh - Nrem)*1.62)}` formula, both the compact
≥1000px layout and desktop), that budget is a flat rem constant standing
in for "everything that isn't the board," and the hand tray is most of
it.

Added a small `▾`/`▸` toggle next to the DP chip in the Hand header
(`#handtog`). Collapsing sets `display:none` on `.hcards` and adds
`.handclosed` to `#combat`, which swaps the board's height-budget
constant to a smaller one (24rem → 15rem compact, 23.5rem → 14.5rem
desktop) — the same formula, just with less reserved for a tray that
isn't there. The header itself (title, DP total, the toggle) stays put
either way, so a collapsed hand still tells you what you have to spend
even though you can't see the cards to spend it on.

State lives as a new `handOpen`/`setHandOpen` pair in `state/session.js`,
following the same module-level pattern as `sel`/`mover`/`stratSel` —
but deliberately *not* reset by `clearSelection()` (which fires on every
board change) or on mission launch. It's a per-session viewing
preference, not per-mission combat state; collapsing it once shouldn't
un-collapse itself the next time a unit moves.

One iteration during this: `paintHandToggle()` first used
`tog.setAttribute('aria-label', ...)` to keep the accessible label in
sync with state. `npm test` caught it immediately — the DOM-stub test
harness's element stub has no `setAttribute` (nothing else in the
codebase calls it, which in hindsight was the tell). Switched to
`tog.title`, the same plain-property pattern the hand cards themselves
already use for their tooltips, and kept a static, state-neutral
`aria-label="Toggle hand"` in the markup instead of trying to keep an
attribute in lockstep with render state.

Verified live at a board-constrained width (1100px): the board's
rendered size went from 432×269 to 687×429 on collapse — about 59%
larger in both dimensions — and back to the exact original 432×269 on
reopen. Full 37-guard suite passes, including `handtest.js`'s layout
structure checks against the built page, unchanged.

## A version number, and patch notes to hang it on

The game had never carried a visible version — `package.json` had sat at
the scaffold's original `1.0.0` through every batch since. Added a real
one: `VERSION` and a `PATCH_NOTES` array in a new, hand-authored
`src/content/patch-notes.js` — hand-authored deliberately, unlike
everything else under `src/content/`, because this is prose for a
player to read, not balance data to regenerate from the JSON. Backfilled
nine version entries (1.0 through the current 1.8) by grouping this
project's real history into player-facing, feature-level bullets —
grouped by theme rather than reproducing the internal task-by-task
order, the way any real changelog does. `package.json` now reads
`1.8.0` to match.

The version shows on the title screen footer (`Designed by DeeWolf ·
v1.8`), with a "Patch notes" link right next to it that opens the
changelog. That link had to reuse the hold panels' own overlay
(`#panel`/`#pbody`) directly rather than go through `openPanel()` —
`openPanel()` gates on an active profile, and the title screen is
exactly the one place in the game where there isn't one yet. New
`src/render/patchnotes.js` sets the panel's title and body straight,
sidestepping that gate; closing it (`#pclose`) already just hides the
overlay with no profile dependency, so no changes needed there.

One thing the click handler had to account for: `#title`'s screen-wide
tap target advances straight to the login console on any click, with a
single exception carved out for the Import Record button
(`ev.target.id === 'titleimport'`). The Patch Notes link needed the same
exception added alongside it, or clicking it would open the changelog
*and* immediately navigate away underneath it.

Verified live: the footer renders `v1.8` (not a literal placeholder),
opening Patch Notes shows all nine versions with the current one tagged,
closing it returns to the title screen intact, and tapping anywhere
else on the title screen still advances to login as before. Full
37-guard suite passes with no test changes needed — nothing was
asserting on the old two-item footer.

## Patch notes moved off the title screen, into the drawer

Follow-up to the version/patch-notes patch above. The title screen isn't
where a commander already mid-campaign would look for "what changed" —
the pull-up drawer is, since that's where Settings, UI mode and Music
already live as the game's one persistent quick-access menu. Moved the
link there instead: a new `Patch notes` chip in `.drawmenu`, between
Music and the sign-out row, wired the same way `drawset` already opens
Settings — close the drawer, then `openPatchNotes()`.

The version number stays on the title screen footer; only the link
moved. `openPatchNotes()` itself needed no changes — it was already
independent of `openPanel()`'s active-profile gate (see the prior
entry), and the drawer only ever renders on screens where a profile is
active anyway, so that independence just means the same function now
serves two different callers instead of being tied to one.

Verified live: the title footer is back to just `Designed by DeeWolf ·
v1.8` with `#titlepatch` gone from the DOM entirely, the drawer lists
all five chips in order, and clicking the new one closes the drawer and
opens the same changelog — now returning to the hold screen on close
instead of the title screen, since that's where it was opened from.
Full suite still passes; nothing was asserting on the title-screen
footer's old shape.

## Crystals randomizes, and the ground can now cave in mid-fight

First two off the field-idea list: Crystals stopped rolling the same four
spots every time, and a new modifier lets the board itself change shape
during a mission.

**Crystals.** The four node positions were a fixed array — `{l:0,c:1}`,
`{l:1,c:4}`, `{l:3,c:2}`, `{l:4,c:4}` — the same every single Crystals
mission since the mode shipped. `rollCrystals(heat)` in `mission.js`
replaces it: one node per lane (4 of the 5, picked fresh), with the
zone split — two on your own ground, two in the neutral band, never
hostile ground — kept for a **standard** mission, because that split is
load-bearing design, not decoration (see the mode's original comment:
holding ground behind the spawn line all mission is a worse, different
mission from contesting the middle). A **deep-zone (heat) operation**
drops that guardrail entirely — any of the four can land anywhere on
the board, hostile ground included, which is the actual "harder
difficulty" hook: heat already means more hive pressure every wave, so
an exposed crystal deep in enemy territory now stacks onto that instead
of the position doing nothing to raise the stakes.

**Crumbling Ground.** A new battlefield modifier (`crumble`), rolled
onto campaign nodes the same 45% way `nest`/`blackout`/`breach`/
`scavenge`/`swarm` already are — no new roll mechanism, just a sixth
entry in the pool. Every second turn it's active, one open tile
collapses into the same impassable `'x'` state Hull Breach already sets
at mission start (existing rendering, existing rules — every place that
checks `G.ter[l][c] === 'x'` already blocks both hostile movement and
player deployment through it, so this reuses that machinery outright
rather than inventing a second kind of wall). `crumbleTick()` in
`phases.js` never picks a tile with a unit, hostile or civilian
standing on it, and never a crystal or the uplink relay tile — a
modifier is supposed to make a mission harder, not softlock it by
burying an objective.

Verified against the actual rules (not just reading the code): 12
Crystals launches at heat 0 produced 12 distinct layouts, all holding
the 2-ground/2-neutral/0-hostile split across 4 distinct lanes; 15
launches at heat 2 landed at least one crystal in hostile ground.
A `crumble`-modifier mission had zero impassable tiles at kickoff, one
after turn 2, still one after turn 3, two after turn 4 — exactly the
every-other-turn cadence. Full 37-guard suite passes, and the balance
sim (which rolls modifiers onto hundreds of simulated missions,
`crumble` included now) ran clean — zero errors across every mission
type and modifier combination.

## Two new field events, and why neither is really one turn long

Third and fourth off the field-idea list: Bombardment and Research Team,
both new entries in the turn-event pool (`events.js`) — but both break the
pool's original contract, on purpose.

Every existing event — Supply Drop, Seismic Tremor, Grid Overclock, Hive
Surge, Dead Air — is a pure number tweak that lives and dies inside the
one turn `G.event` names it. Bombardment and Research Team fire a
one-time effect the instant they go live, then hand off to a separate
clock that outlives the event flag entirely — the same move `G.scorch`
already made for plasma burn, just reused for two new purposes instead
of invented a third time:

- **Bombardment**: a hive artillery strike on three consecutive tiles in
  one lane (kept inside columns 0-4 — contested ground, not empty
  hostile territory nobody's near). Anything standing there takes 6
  through the existing `dmgUnit()` path — shields, Phase Cloak, riposte
  all apply exactly as they would to a hostile's own strike, because
  it's the same function. The three tiles then go impassable — the same
  `'x'` Hull Breach and Crumbling Ground already use, so every existing
  rule that blocks movement or deployment through it just works — on a
  new `G.rubble` timer (3 turns) instead of forever. `territoryPhase()`
  decrements it and clears the tile back to neutral when it hits zero,
  before the normal flip pass runs, so an expired crater immediately
  reflects whoever's standing there that same turn.

- **Research Team**: rather than build a second "defendable object on
  the grid" system next to the one Civilians missions already have, it
  rides `G.civ` directly — a plain civilian pod in every way that
  matters (hostiles prioritize striking it over your units, holding it
  claims the tile, losing it doesn't end the mission), just flagged
  `research` and carrying its own `timer`. Survive 3 turns and
  `territoryPhase()` extracts it — +60 credits, logged distinctly from a
  destroyed pod — die before that and it's just gone, same as any pod.
  The one real wrinkle: a research team spawning during an actual
  Civilians mission would inflate that mode's own "N of 3 pods" count
  and loss condition, both of which only check `G.civ` by shape, not by
  `research` flag. Simplest fix was the right one — `rollEvent()` just
  never offers Research Team while `G.type === 'civilians'`.

Board rendering needed one line: the civ marker on the grid said `CIV`
unconditionally; now it reads `RSCH` for a flagged entry so it doesn't
look like a stray civilian in a Defend Stronghold mission.

Verified against the rules directly, not just read: over simulated
missions, watched a bombardment turn 0 impassable tiles into 3 with
matching rubble-timer entries, watched those entries clear back to zero
naturally a few turns later, watched a research team spawn with the
right shape (`hp 5, timer 3`, on neutral ground) and watched it convert
into a +60 credit jump on schedule. Full 37-guard suite passes,
including hundreds of simulated Civilians missions in the balance sim
with the exclusion holding — no inflated pod counts, no stray losses.

## Civilian Extract: from static pods to a shelter that puts people out

Fifth off the field-idea list, and the biggest one — a real mission-type
rework, not a modifier or an event. The old Civilians mission was three
static pods sitting at column 0, defended in place for the mission's
duration. The new one: a shelter (20 hull) holds a lane, survivors it puts
out walk toward your own edge one cell a turn, and the mission is won by
extracting enough of them — not by outlasting the clock.

**Reused G.civ rather than building a second system.** Same move as
Research Team: the shelter and its walkers are G.civ entries, flagged
`building`/`walking`, so every rule that already knows what a civilian
pod is — hostiles prioritizing it over your units in `strike()`, holding
its tile claiming territory, blocking movement and deployment through
it — just works, for both the shelter and every walker, with zero new
call sites. `civilianWalk()` (new, `phases.js`) steps each walker one
cell toward column 0 every turn, held back by anything that would block
a unit — a hostile, another body, fresh rubble — so it waits out an
obstacle instead of walking through it. Stepping off column 0 is the
extraction.

**Getting the numbers right took two passes, not one.** First cut spawned
a new survivor every 3 turns against a goal of 4 — over a mission's
~10 available turns that's 3 spawns, chasing a goal one *more* than the
maximum possible extractions, before any of them even had to survive
anything. The balance sim caught it cold: 0 wins in 67 simulated runs.
Dropped the cadence to every turn flat (heat now moves the goal instead
of the spawn rate — simpler, and the goal was always where the
difficulty should live) and seeded one walker already moving at the
drop so turn one isn't dead air. Second pass: 82% at heat 0, 70-83%
across heat 0-3 — close to the original static-pods mission's own
historical win rate, which is the right target; Civilians was always
meant to sit on the easier end of the roster, not join Crystals and
Uplink at the hard end.

Board marker follows the same pattern `RSCH` set for Research Team: the
generic `CIV` label now reads `BLDG` for the shelter specifically, so it
doesn't look like an oversized civilian pod.

Verified against the rules directly — spawn cadence, walk-and-block
behavior, extraction counting, and the loss/win conditions were all run
through the balance sim rather than just read. Full 37-guard suite
passes, no page errors in a live playthrough.

## Mind control: a hostile that turns your own units against you

Last item off the field-idea list. New special-tier hostile, the Puppeteer:
never moves (`spd: 0`, same stillness as Chorus, Mender, Spore, Jammer,
Pylon), and every three turns it seizes the nearest un-controlled unit in
its lane instead of doing anything else. The seized unit doesn't just stop
obeying — per the spec, it flips: its tile now counts as hostile ground,
and if it can still shoot, it shoots at your own line instead of the hive.
It breaks free on its own after two turns, or immediately if the Puppeteer
that's holding it dies.

**Registered exactly like every other special:** `mindctrl: 3` on the
`BEST['puppeteer']` entry (data-driven, `reference/gridfall-data.json`),
added to the wave pool alongside Harrower at `t >= 5` (`waves.js`). The
existing one-specialist-per-wave budget cap needed no changes — it already
treats any `t: 'special'` entry the same way.

**The trick was ordering the checks in `actHostile()`.** Every other
`spd: 0` hostile returns immediately once its own conditional special
(spawn, mend) doesn't fire, because stillness *is* their whole kit. The
Puppeteer's stillness is incidental — its cast is the kit — so `mindctrl`
had to be checked *before* the `spd === 0` early return, or the Puppeteer
would sit there literally doing nothing, forever, which is a worse bug
than not having the feature at all.

**A hijacked unit needed locking out of every path a normal turn reaches
it through, not just the one where it does damage.** Three places, not
one:
- `playerPhase()`'s auto-fire fallback ("anything the player didn't
  commit fires anyway") would otherwise have a controlled unit shoot at
  hostiles on the player's behalf the same turn it's supposed to be
  fighting for the other side — added `|| u.controlled` to the skip.
- The board's click handler drops the `clickable` class and the
  move/act `onclick` for a controlled unit, so it can't be selected,
  moved, or ordered while seized.
- `strike()`'s hostile-side target scan now stops at a controlled unit
  (it's still a body in the lane, still blocks the shot) without
  *setting* it as the target — a hostile won't shoot its own puppet.

**What actually happens while seized**, added at the tail of
`enemyPhase()`: any controlled unit with `dmg > 0` hits the nearest other
(non-controlled) unit in its own lane through the same `dmgUnit()` every
other attack uses, tagged "(hijacked)" in the log — a real hit, a real
possible kill, `G.lost` included. Unarmed types (Scout, Medic) just stand
there controlled; nothing to hijack a weapon out of.

**Deliberately left alone**, matching this session's usual scope line: no
way for the player to put down their own hijacked unit early — extending
`geomFor()` (targeting.js) to read something other than `G.enemies` for
that felt like its own feature, not this one. No dedicated forecast/intent
badge case for `mindctrl` either — the existing `spd === 0` fallback in
`enemyIntent()` already resolves to an idle badge with no crash risk, just
a shrug where a more specific glyph could sit later. Sustain/aura/repair
auras still read `G.units` without checking `controlled` — a hijacked
unit can still get healed by a nearby Field Medic, which is a small
inconsistency, not a bug; auditing every friendly-target loop in the
codebase for this one hostile was out of scope.

Verified directly against the rules rather than by reading the diff and
hoping: a DOM-stub script drove `enemyPhase()`/`territoryPhase()`/
`dmgEnemy()` through seven scenarios — cast lands on cadence while the
Puppeteer stays put, the seized unit's tile flips to hostile, a seized
unit with a weapon hits its own side, it reverts on the turn timer, it
reverts immediately when its controller dies, and a seized unit still
blocks a hostile's lane without being struck. All seven came back as
expected. Full 37-guard suite passes, including a new `puppeteer` foe
sprite `pixtest` was otherwise failing on (glyph `☍`, palette matches the
existing hostile tokens).

## Operations get a signature hazard, not just a random one

Crumbling Ground and the two field events (Bombardment, Research Team)
landed as pure chance across every operation — mechanically fine, but it
meant Blackmarrow's sub-crust mining tunnels never felt more likely to
cave in than a shipyard's open deck, which undersells the setting. Gave
three operations a signature hazard instead:

- **Blackmarrow** (mining tunnels) → biased toward the **Crumbling
  Ground** modifier.
- **Sunderglass** (crystal fields) → biased toward the **Research Team**
  event.
- **Crownring** (a summit under siege) → biased toward **Bombardment**.

Two new operation-data fields carry it: `modBias` (`run.js`'s modifier
roll) and `eventBias` (`events.js`'s `rollEvent()`), both read straight
off `OPS[key]` the same way `heat` already is — no new content pipeline,
just two more optional fields on the existing per-operation JSON entries.
Neither is a guarantee: when a mission's modifier roll or event roll
already hits (the existing 45%/35% chances, untouched), the *signature*
one wins 65%/55% of the time and the full pool still gets the rest, so
Blackmarrow can still throw a Nest or a Blackout — it just leans hard
toward tunnels giving way underfoot. Onslaught, Gauntlet and the Daily
Challenge aren't tied to an operation (`node: null`) and never see this —
signature hazards are a campaign-map thing.

**Needed one small plumbing addition:** `G` didn't carry which operation
a mission belonged to at all — `launch(nodeId)` resolves everything
through `opRun()`/`active.op` but never handed it to `launchSpec()`.
Added `op` to the node spec `launch()` builds and to the base `G` object,
so `rollEvent()` (which only sees `G`, not `active`) can look its bias up.

Verified statistically rather than by eyeballing the numbers in the diff:
300 simulated `genRun()` calls on Blackmarrow put Crumbling Ground on
~34% of modified nodes against ~7% for every other modifier and ~13%
uniform at Ironveil (no bias); 2000 `rollEvent()` calls each showed
Research Team at ~60% of Sunderglass's triggered events (vs. ~16% at
Ironveil) and Bombardment at ~57% of Crownring's (same baseline
contrast). Full 37-guard suite passes.

## The other three operations get a signature hazard too

Follow-up to the last entry — three operations had a themed lean, three
didn't. Filled in the rest, same `modBias`/`eventBias` fields, same
65%/55% lean-not-guarantee behaviour, no code changes (`run.js` and
`events.js` already read the fields generically):

- **Ironveil** (orbital shipyard, "the docks went silent") → **Hull
  Breach** modifier. The pun was sitting right there — a shipyard is
  where hulls get breached.
- **Lumenspire** (a research spire's labs, evacuated mid-experiment) →
  **Grid Overclock** event. Research already belongs to Sunderglass, but
  a spire full of lab power infrastructure spiking under hive pressure
  fits the same idea from a different angle.
- **Shallowhelm** ("gone dark, no distress call, gates sealed from
  inside") → **Blackout** modifier. About as literal a match as this
  roster has.

Deliberately didn't force a hazard onto every remaining modifier/event —
Nest, Scavenge, Swarm, Supply, Tremor, Surge and Calm stay unbiased
everywhere. Six operations, six distinct signature hazards, no repeats;
padding the assignment out further would have meant reaching for a fit
that isn't really there.

Verified the same way as the first three: `genRun()` sampled 300 times
each for Ironveil and Shallowhelm put their signature modifier on
~34-35% of modified nodes against ~7% for the other five (vs. a flat
~13% at an unbiased op); 2000 `rollEvent()` samples put Lumenspire's
Grid Overclock at ~58% of its triggered events against ~6% each for the
rest. Full 37-guard suite passes.

## Crystals: an extra turn and a second breach, both crystals-only

First item off the Still Open list. Two small, targeted levers, both gated
to `G.type === 'crystals'` so nothing else in the roster moves:

- **One extra endgame turn.** `endgameCheck()`'s crystals branch now waits
  for `G.extra >= 4` instead of the `>= 3` every other objective type uses
  — one more turn to consolidate a hold on a fourth node before the clock
  calls it. Safe by construction: no new wave spawns during endgame turns
  (`G.manifest` is already null by then), so it only ever gives the player
  more time against hostiles already on the board, never more of them.
- **A second tolerated breach.** New `breachAllowance(type)` in `board.js`
  — `MAXBREACH + 1` for crystals, `MAXBREACH` (still 1) for everything
  else. `lossCheck()`'s breach check and the `c-br` HUD readout both read
  it instead of the raw constant, so the counter on screen always matches
  what actually ends the mission.

**Why breach specifically:** Crystals asks you to hold ground at four
separate points instead of one contiguous line, which is the mission's
whole identity — but it means every lane runs thinner than any other
mission type asks for, and the existing one-breach allowance (already
generous with the Last-Stand grid charge soaking the first breach per
lane) was punishing that spread as if it were a mistake instead of the
point.

**Measured with a direct 300-run sample per heat level** (`launchSpec`
straight to a crystals mission, bypassing the campaign map so the sample
isn't diluted by other mission types) rather than trusting the noisy
per-type numbers `mtest.js` gives on ~10 runs per operation:

| Heat | Before | After |
|---|---|---|
| 0 | 65% | 62% (flat, within noise) |
| 1 | 33% | 38% |
| 2 | 24% | 29% |
| 3 | 21% | 25% |

Breach-driven losses dropped meaningfully at every heat level (roughly
30-40% fewer breach losses at heat 2-3), and win rate climbed 4-5 points
at heat 1-3 where it mattered. Heat 0 stayed flat, as expected — a
mission that already wins 65% of the time rarely has a lane thin enough
to need the second breach. Full 37-guard suite passes.

**What this doesn't fix:** heat 2-3 are still hard — 29% and 25% — and by
then "Only N of 4 held" is the dominant loss reason again, not breaches.
That's `wave()` taxing every mission type the same flat amount per heat
point with no discount for Crystals' built-in spread; see the rewritten
Still Open item below.

## Crystals stops paying double at a hot operation

Second half of the crystals pass. The breach fix (previous entry) closed
most of the gap at heat 1, but heat 2-3 barely moved — because a hot
operation's flat wave-budget tax stacks directly on top of Crystals'
already-thinner-than-everyone-else defence, compounding two difficulties
that were never meant to multiply.

Generalized the fix Shallowhelm's map data already used by hand for its
one guaranteed Crystals node: `run.js`'s heat-assignment pass now caps
any **auto-rolled** Crystals node at heat 1, regardless of the operation's
own heat — Crownring (op heat 2) and Shallowhelm (op heat 3) both send
their Crystals nodes out at heat 1 now, same as Lumenspire already does
by having heat 1 in the first place. A hand-set `n.heat` in the map data
still wins outright — nothing about Shallowhelm's own explicit override
changed, this just stopped it being the only node in the game getting the
treatment.

`nd.reward` already read the same (now-capped) `heat` value it always
did, so payouts stay honest with what the mission actually asks — no
separate reward fix needed.

**Measured directly**, not assumed: `genRun()` sampled 400 times each at
Crownring and Shallowhelm confirmed every auto-rolled Crystals node comes
out at exactly heat 1, no exceptions. A 600-run win-rate sample per heat
level then compared the old uncapped numbers against what heat 1 actually
plays like:

| | Old (uncapped) | New (capped to heat 1) |
|---|---|---|
| Crownring's Crystals nodes | 26.7% | 33.0% |
| Shallowhelm's Crystals nodes | 23.8% | 33.0% |

`maptest.js`'s per-node heat assertion (guard B) needed updating to
expect the cap instead of flagging it as a bug — it now mirrors the same
`nd.type === 'crystals'` check `run.js` applies. Full 37-guard suite
passes.

## Civilian Extract's heat scaling: sampled it properly, left it alone

Next item off the Still Open list — but this one closes without a code
change, which is worth writing up as honestly as the ones that did.

The original concern came from 30 runs per heat level (`mtest.js`'s
default sample, split across mission types and operations) showing heat
1-3 within a few points of each other instead of stepping down cleanly.
Replaced that with the same direct-sim approach used for the two Crystals
entries above — `launchSpec` straight to a civilians mission, bypassing
the campaign map so heat is the only thing changing — at 600 runs per
level instead of 30:

| Heat | Win rate | Losses to breach | Losses to goal-not-met |
|---|---|---|---|
| 0 | 86.3% | 15 | 67 |
| 1 | 82.5% | 30 | 75 |
| 2 | 81.7% | 34 | 76 |
| 3 | 71.8% | 88 | 66 |

It does step down cleanly — the 30-run number was noise, not a real
non-monotonic wobble. Heat 0-2 is a shallow, sensible slope; heat 3 drops
harder, and breach losses more than double rather than the extraction
goal getting meaningfully further out of reach, which rhymes with what
Crystals hit at its own top heat tier.

**Left it alone anyway.** Civilian Extract's whole redesign (see its own
entry above) was built around "heat moves the goal, not the mission's
difficulty knob" being the simpler, correct design — and 71.8% at heat 3,
its hardest tier, still clears "Civilian Extract sits on the easier end
of the roster" by a wide margin against Crystals' 62-65% at heat 0, its
*easiest*. Crystals earned its heat-cap fix because a hot operation's
wave tax was compounding with a structural difficulty the mission can't
avoid — spreading across four points. Civilian Extract doesn't have that
structural bind; one shelter, one lane. Tuning heat 3 down here would be
solving a problem that isn't there yet, not the one that was reported.

## A finished operation stays on the board, with a replay button

Clearing an operation's final node used to be invisible — `afterMission()`
rolled a brand new set of missions for it before the player ever saw the map
again, so "operation complete" was a state that existed for one frame and
was gone. The only way to redo an operation on purpose was the reroll row
buried in Settings, and it worked identically whether the operation was
half-finished or fully cleared.

Now the map screen shows the finished state instead of skipping past it.
`renderMap()` checks `opComplete()`; when it's true, every node draws filled
and ticked (`nodesSvg`/`edgesSvg` take a `complete` flag that overrides the
real per-node state for the SVG only — the underlying `run.cleared` data is
untouched), the briefing list is replaced with an OPERATION COMPLETE card,
and nothing on the map is clickable. That card carries a **↺ Replay
operation** button; confirming it calls the same `genRun()` the Settings
reroll uses, which throws out `cleared` and rolls a fresh node set. The
operation-select grid and the hold screen's deployment thumbnail
(`opThumb`) pick up the same "show every node filled" treatment, plus a
gold ✓ and a `Complete` label in place of the `x / y cleared` counter, so a
finished operation reads as finished everywhere it's shown, not just on its
own map.

Uncollected bonus objectives are still forfeit the moment the final node
clears — that didn't change, only when the player finds out. `csstest`
needed `opreplay` added to its list of runtime-created ids, since the
button doesn't exist in the static shell.

## The gear-fitting list groups by role, with room to grow

The gear slot on a unit's focus card used to fit gear from one flat
`owned.map()` chip row — every piece the player owns, in whatever order they
unlocked it, all in one wrapped block. Fine at a handful of items; already a
wall at the 17 pieces the game ships with today, and every new gear drop
just makes the wall longer with no way to search or narrow it.

Each of the 17 gear entries in `reference/gridfall-data.json` now carries a
`role`: `offense` (raw damage/penetration — Extended Barrel, Targeting
Uplink, Stim Injector, Vanguard Rig, Overclocked Uplink), `defense` (hull,
shield, phase, indirect immunity — Reactive Plating, Ablative Weave, Phase
Cloak, Adaptive Plating, Ghost Plating, I-Field), or `utility` (mobility,
deploy cost, cooldowns, crushing — Servo Legs, Field Kit, Coolant Core, Drop
Pod, Twin-Link Servo, Rapid Kit). A hybrid piece sits under whichever stat
leads its flavor text; the description still says the rest.

`gearBlock()` in `focus.js` now renders three tabs (reusing the game's
existing `.tabs`/`.tab` styling, the same one the Database and Records
panels already use) instead of one chip row, switching which role's chips
show without touching the fitting logic underneath — `data-fitgear`, the
one-slot-per-card rule, and gear being a singleton across the profile all
work exactly as before.

That alone doesn't survive indefinite growth, so it comes with the next
lever built in and dormant: once any single role's owned count passes 10
pieces, a filter input appears above the tabs and narrows the active role's
chips as the player types (`data-gsearch`, wired through `filterGear()`).
At today's 17 gear pieces no role gets anywhere near that, so nothing extra
shows up yet — the mechanism is there for whenever a future gear pass pushes
one role past it, without another UI pass to add it then.

## A lingering field event now explains itself on tap

Player feedback: nobody knew what the green RSCH tile on their board was or
why it was there. Turned out the game already explains every event fully —
a full-description log line and a one-turn incoming-strip chip — but the
two events that leave something behind (Research Team's pod, Bombardment's
crater) had nothing after that first turn. The chip disappears, the log
line scrolls away, and the object just sits there. Worse for Bombardment:
its craters had no label or tap target at all, just a dimmed tile — a
player who missed the one log line had no way to learn what it even was.

Both now carry the same fix, since it's one gap with two instances rather
than two separate problems:

- **A turn-countdown badge** in the tile's free top-left corner (`.ttl` in
  `combat.js`/`gridfall.css`) — the Research Team pod's `v.timer` and a
  crater's `G.rubble[l+','+c]`, both of which already tracked the number
  internally, just never showed it.
- **A tap handler**, where neither tile had one before — opens the same
  `notify()` popup the event's own chip already uses, so "what is this and
  what does it need" is answerable any turn, not just the one it landed.

Checked in passing whether the pre-announcement side of this had the same
gap (every event, not just these two, is telegraphed a full turn ahead via
a dim `next · Name` chip) — it doesn't. That chip already shares the live
one's `[data-evt]` tap handler, so the full description was already one tap
away; it just reads as low-priority next to the brighter hostile-manifest
chips beside it. Left alone for now — scope stayed on the two tiles that
were actually missing information, not the one that was only styled quietly.

## Burrow Breach: a new event that names a tile, not just a turn

Every event so far only ever telegraphed a *kind* — "something's coming" —
never a *place*. Burrow Breach is the first that does both: announced a
turn ahead like any other event, but it also marks one specific tile you
currently hold, the same one-turn promise the spawn markers keep, just
pointed at a location instead of a lane.

`pickBurrowTile()` (phases.js) fires the instant Burrow Breach becomes
`G.eventNext` — not when it lands — and picks uniformly from whatever
you're currently holding (`G.ter[l][c] === 'p'`). That tile gets a slow,
heavy violet pulse on the board (`.cell.burrowmark`, tuned to a different
rhythm than an armed stratagem's pulse so the two warnings don't read as
the same thing) and is tappable for the same `notify()` explanation the
other events already use — the pattern from the last entry, extended to a
telegraph tile instead of a landed one.

When it lands, `burrowErupt()` does the thing the marker promised: whatever
is standing on that tile is swallowed outright. Not damage — no shield,
riposte or Phase Cloak gets a say, because the ground itself isn't there
anymore, not a hit landing on it. A `burrower` (an existing hostile, already
themed around tunneling) claws up and holds the cell afterward. An empty
tile at eruption just gets a burrower on open ground — no unit, no cost,
same as any other spawn — so the event is never a pure trap with no
counterplay: moving off the marked tile in time is the whole point of the
one-turn warning, and ignoring it trades a unit for skipping that fight
somewhere else on the board.

Verified with a forced-tile run (Math.random pinned to avoid the reroll
re-picking the same event mid-test): a unit placed on the marked tile was
gone after eruption, a burrower stood in its exact cell, `G.lost` ticked up,
and the log carried the right lines throughout. No operation was given
`eventBias: 'burrow'` — every operation already has its one signature
hazard filled from the last two rounds of this work, so it joins the flat
random pool everywhere instead of displacing one.

## Two player-reported bugs: a dead CSS rule, and a reversed design call

**Specialist card art looked off-center.** Traced it to `.inkmark svg` in
`gridfall.css` — a descendant-combinator rule that has matched nothing since
`cardMark()` last changed shape: the function puts `class="inkmark"`
directly on the `<svg>` it returns, there's no wrapper element for a
descendant rule to reach. The mark rendered at a flat `inset:0` full-bleed
size instead of the intended 74%-capped, centred watermark. Every tier was
technically affected the same way, but specialists made it visible: their
heavier ensō stroke (`heavy` in `enso()`) draws more attention to the same
proportional slack that a thinner common/tech ring hides. Fixed by folding
the sizing into `.inkmark` itself (`inset:13%` in place of `inset:0` —
algebraically the same as a 74%-capped, centred box) instead of a rule
aimed at an element that doesn't exist. Verified by measuring real DOM
`getBoundingClientRect()` offsets in the Quartermaster grid before and
after: common/special/tech all now land at the same `dx`/`dy` and the same
~72% width, where before the rule simply never applied to anyone.

**Gauntlet (and every other) pack offer had no way to preview a card before
choosing.** This one reverses an earlier call on purpose, not by accident —
worth being honest about. A past pass deliberately removed the pack cards'
⌕ inspect button, reasoning that "a pick's rules text is printed on the
card" made a separate inspect step redundant, and `packtest.js` grew a
guard asserting the button's absence. That reasoning covered the card's
*ability* text, which is indeed already on the card — it didn't cover the
*stat block* (DP cost, hull, targeting pattern) that a shop or squad tile's
focus popup shows and a pack card never did. That gap is exactly what got
reported. Restored it, but not as the old bespoke badge: each pack card
now splits into a `.pclook` button (art, name, ability text — tapping it
opens the same `focusCard()`/`focusGear(id, true)` popup a shop tile
already uses, view-only, no commit action) and a separate `.pctake` button
("Keep this," the only thing that actually claims the pick) — plain
credits payouts have nothing further to show, so they skip the inspect
button entirely. `packtest.js`'s guard is rewritten to check the opposite:
that inspecting opens the right focus view, shows the right name, and
closing it leaves the pack offer exactly as it was — taking a pick still
works the same single tap it always did.

## Three ways to hit the backline, none of them the same trick

Requested: 2-3 cards that reach a hostile's back line, each by a genuinely
different mechanism rather than three reskins of "more range." The pool
already had three approaches — Marksman's furthest-in-lane (still blocked by
a friendly in the way), Mortar/Plasma's fixed 3x3 at exactly four cells, and
Hecate's true board-furthest snipe — so the new pieces had to earn a
different verb, not just a bigger number.

- **Longshot** (`longshot`, Common unit, 160cr) — Marksman's furthest-in-lane
  targeting, but flagged `indirect`, so it fires *through* a friendly
  blocker instead of stopping at it. Lower damage (2 vs. Marksman's 3, no
  burst) pays for the consistency: never blocked, never a maybe.
- **Optics Relay** (`opticsrelay`, Gear, 300cr) — the same `indirect` flag,
  but as gear rather than baked into one card. Fits onto anything with a
  blockable pattern (adj/first/furthest/lane/ahead2/ahead3) and makes that
  card pierce blockers too — a build choice, not a fixed unit. Required one
  real code change: `mkUnit()` only read `k.indirect` off the card's own
  data, never gear, so a card wearing this wouldn't actually pierce
  anything. Fixed alongside (`indirect: !!k.indirect || !!(g && g.indirect)`),
  and the focus panel's "Line of fire" stat row gets the same fix — it was
  checking the card's own flag only, so a geared indirect wouldn't even
  show it had one.
- **Sapper Turret** (`sapper`, Tech emplacement, 280cr) — the odd one out on
  purpose: no new targeting logic, no piercing. It reuses `drop` (the same
  flag Assassin and Kunoichi already have) to land on hostile ground, then
  fires `ahead2` from wherever it's planted. The "reach" comes from
  *position*, not range or penetration — smuggle it deep enough and the
  hive's own rear is now two cells away instead of most of the board.

Verified each mechanism directly rather than trusting the data alone: a
Longshot with its own Wall blocker in the lane still hit the far hostile
(a plain Marksman under the same setup correctly hit nothing); a Sapper
Turret deployed at column 5 hit both hostiles ahead of it on hostile
ground; a Rifleman fitted with Optics Relay picked up `indirect: true` and
fired through its own Wall the same as Longshot. `arttest`/`pixtest` cover
the two new cards' portraits and pixel tokens (60 cards now, up from 58).

## Defending your OWN back line — the gap nothing in the pool covered

I misread the previous request and built three ways to reach the *hive's*
rear. The actual ask was the mirror image: hostiles get behind your line,
and almost nothing in the pool can answer them once they do.

Confirmed the gap before building. Every rear-capable card in the game is a
**1-cell melee radius** — Ronin's `bothsides` (the cell behind), Samurai /
Pulse Emitter / Hell Jumpers' `around` (eight surrounding), Kunoichi's
`diag`, Assassin / Kessen's `adj4`, Archer's two rear diagonals. There was
no *ranged* rearward option at all, and nothing that watched the home
columns. A hostile three cells behind your firing line simply could not be
shot; you had to walk a body over to it and lose the tempo.

Three answers, again deliberately different verbs:

- **Rearguard** (`rearguard`, Common unit, 150cr) — new `rear` targeting:
  the nearest hostile BEHIND it in the lane, at any range. `laneBehind()`
  is a strict mirror of `laneAhead()`, blockers included — your own wall
  cuts your own beam going backwards exactly as it does going forwards,
  which keeps the rule one rule instead of two.
- **Backstop Battery** (`backstop`, Tech emplacement, 300cr) — new
  `homeline` targeting: every hostile standing in your two home columns, in
  *any* lane at once. Anything at column 0 breaches on the hive's next step
  (`enemyPhase` walks it to `col -1` and calls `breachAt`), so this is
  explicitly the last turn a breach can still be answered — priced as the
  safety net it is, not a general-purpose gun.
- **Rear Sights** (`rearsights`, Gear, 240cr) — bolts the cell directly
  behind onto whatever pattern the card already prints, so a forward-facing
  weapon stops being flankable. Implemented as a rider *outside* the
  targeting switch (`geomFor` now wraps a `geomBase`), so it composes with
  all 18 patterns instead of needing a case each — and the stun / cycling /
  jammed guards stay upstream of it, so gear can never fire a weapon the
  card itself couldn't.

Verified all three against a live board rather than trusting the data:
Rearguard hit the nearer of two intruders behind it and ignored the one
still out front (a Rifleman in the same spot correctly hit nothing — the
baseline gap, reproduced); Rearguard respected a friendly wall placed
behind it; Backstop swept two home-column intruders in two *other* lanes
while ignoring anything at column 2 or deeper; a Rifleman fitted with Rear
Sights covered the cell ahead and the cell behind at once, and still fired
nothing while stunned.

## Recon Lark and Backstop Battery become instants — and `instant` grows up

Both cards' whole value was what they did on arrival; the body left behind
was noise. Converting them turned out to need the underlying mechanic fixed
first.

**`instant` was one card's behaviour wearing a generic name.** `playInstant()`
hardcoded Supply Cache exactly: add `k.gain` DP, then discard a card from
hand at random. Flagging any other card `instant` would have silently given
it Supply Cache's penalty while dropping its own effect entirely — Recon
Lark's `draw: 2` lived in the non-instant branch of `deploy()` and would
never have run. So `playInstant()` is now effect-driven: it reads `gain`,
`draw`, `homestrike` and `discard` off the card and composes whatever is
declared. Supply Cache's random discard became an explicit `discard: 1` in
its data — being an instant no longer *implies* a penalty, which is the
whole point. Instants also share `consume()` now instead of half-copying
it, which incidentally fixes instants never logging a veterancy promotion.

- **Recon Lark** — instant, `draw: 2`, no airframe. Same 1 DP, same two
  cards, minus the drone.
- **Backstop Battery** — instant, `homestrike: 5`: one volley across both
  home columns in every lane at once, then spent. Reworked from the
  emplacement version shipped an hour earlier, which re-fired *every* turn
  across all five lanes and was the strongest thing in the pool by some
  distance. 5 damage kills a Crawler (3) or Spitter (5) outright and wounds
  a Breacher (7) — it clears what typically leaks, without being a wall.

Worth recording why this changed direction twice: the first instinct was to
leave the bodies, on the theory that a useless leftover is a deliberate
cost. It isn't a cost. A unit flips the tile it stands on to yours at
territory phase, and `held() < 6` is a loss condition — so even an unarmed
2-hull drone is feeding a stat you can lose the mission on, *and* blocking
a lane (hostile movement `break`s on any friendly body). The leftover was a
quiet bonus, not a downside, which is why removing it is a real trade and
not a freebie.

`homeline` targeting is deleted along with the emplacement — it existed for
exactly one card and nothing uses it now, so it does not stay behind as
dead data. `rear` and `laneBehind()` stay; Rearguard still uses them.
`statRows()` also stops printing Footprint and Mobility for instants (a
card that never lands has neither — Supply Cache had been claiming "1 cell,
Anchored" all along) and gains rows for the effects themselves, so the
numbers are in the stat block and not only in the prose.

Verified on a live board: Recon Lark leaves no unit, draws 2, and discards
nothing; Supply Cache still pays +3 DP and still loses one card at random
(4 in hand → 2); Backstop killed intruders at column 0 and column 1 in two
*different* lanes while leaving a column-2 and a column-7 hostile
untouched, left no emplacement, and no-ops safely against an empty home
line.

## Pixel tokens: centred visors, and weapons you can actually see

Two reported problems with the on-grid sprites, both real and both with a
single root cause each rather than 62 sprites needing hand-touching.

**Visors sat left of centre.** In the shared `TROOPER` and `KNEEL` chassis the
head row read `...ovvbbo...` — outline at cols 3 and 8, so the interior is
cols 4-7, but the 2-wide visor occupied 4-5, flush against the left edge.
`HEAVY` had the same shape one cell wider. Centred is cols 5-6, so the rows
became `...obvvbo...` and `..obbvvbbo..`. Because almost everything is built
by `ov()`-ing an overlay onto those three chassis, that one change fixed the
majority of the roster at once; the handful that draw their own heads
(`recon`, `zaku`, `outrider`, `exo`) plus the four that override the visor
row (`rearguard`, `assassin`, `kunoichi`, `cannon`) were corrected to match.
`recon` also had its middle row spanning cols 2-8 while the rows above and
below spanned 3-8, which read as an off-centre bulge; it now matches.

**Weapons were the darkest thing on the sprite.** `w` was `#5b6284`, which
measures **1.97:1** against the player tile — the body (`#ccd3ea`) sits at
**7.85:1**. So the armour shouted and the weapon vanished, which is why a
Rifleman, a Marksman and a Lancer all read as the same green body. Measured
several replacements rather than eyeballing: `#aebbd2` gives **6.05:1** on
the worst of the three tile colours while staying in the cool family, so it
never competes with gold's "yours and alive" meaning. Uniform schemes
override `b`/`s`/`v`/`o` but not `w`, so weapon metal now reads consistently
across all ten schemes.

Colour alone wasn't enough for "which unit is this" — most weapons were only
2-3 pixels. 20 overlays were redrawn to project clear of the body with a gold
muzzle/tip glint marking the business end, and to differ in *shape*, not just
presence: Rifleman a short barrel, Marksman a long sniper barrel, Lancer a
full-width lance, Samurai a long katana diagonal, Ronin twin blades pointing
both forward *and* back (which is literally its rules text), Archer a bow with
a nocked arrow, Herald a large standard. `pixtest`'s distinctness guard still
passes, so no two tokens collapsed into each other.

Checked at three scales rather than trusting a contact sheet: a full 62-sprite
sheet, a pixel-level before/after against the committed version (rendered from
`git show HEAD:` so the comparison is real, not remembered), and a strip at
true in-game cell size (93px) across normal, **spent** (the grayscale/dim state
an acted unit wears) and hostile-ground tiles — weapons stay legible in all
three.

## The codec call: Central Command opens an operation

*2026-08-29*

The first time a commander taps an operation, Central Command calls ahead of
the drop. Hikaru, the CC liaison, takes three beats to hand over the situation;
the commander answers each; and then the channel closes and the sector map
opens behind it. Metal Gear's codec is the reference, down to the two portraits
lighting up in turn.

**Nothing in it moves on a timer.** Hikaru's line types out, you tap your reply
when you have read it, your reply types out, and then a cycling `.` / `..` /
`...` sits there until you are ready for the next beat. Three dots and no label
— the word "Continue" lives in `aria-label` so a screen reader announces it
without a caption sitting next to the ellipsis. (A monospace period carries a
~0.6em advance, which spaces three of them out like status pips rather than an
ellipsis; each dot gets a `.38em` box so the glyphs close up. All three slots
are always reserved, so the button never changes width as it cycles.)

**The scene is data, not code.** `operations.ironveil.intro` in
`reference/gridfall-data.json` carries the frequency, the caller, the beats and
the sign-off; `tools/gen-content.js` passes it through untouched. Writing
Blackmarrow's call is a JSON edit. An operation with no `intro` block plays
nothing and falls straight through to the map — `playIntro()` returns false,
having done nothing, and the caller runs its own `go()`.

**`#codec` is an overlay, not a screen.** It joins `#focus`, `#pack` and `#dlg`
as a sibling of the screen stack rather than an eighth entry in `SCREENS`,
which keeps csstest's "exactly one screen carries `.on`" invariant intact: the
ops screen stays the visible screen while the call sits on top of it, dimmed and
bokeh'd through the same `bokehLayer()` the focus view uses. Verified in a real
browser — `screens on: ['ops']` throughout the call, `['map']` after.

It plays once per commander per operation, recorded in
`settings.intros[opKey]`, with a **Command transmissions → Replay** row in
Settings that clears the flags. Under `prefers-reduced-motion` every line lands
whole instead of typing.

`codectest.js` (guard 38) walks the whole scene beat by beat and guards the
thing that would actually strand a player: the call must always hand control
back. It checks the sign-off path, the skip path, the play-once gate and the
Settings reset, plus the shape of every intro block that ships.

**One harness gap this turned up:** the DOM stub had no `setAttribute`, so any
renderer reaching for it would have thrown under test rather than been caught.
It has one now, wired into `dataset` for `data-*` names the way the browser
does.

## Blackmarrow gets its own codec call

*2026-08-29*

Operation Blackmarrow now opens with its own transmission from Hikaru, the
second entry in `operations.<k>.intro` — Ironveil's was the first. Same
mechanism as before: no code changed, only `reference/gridfall-data.json`, and
`codectest.js` already covers a second intro by construction since it validates
every operation's `intro` block generically rather than naming Ironveil.

The call leans on the lore already in `operations.blackmarrow.lore` — the
sealed winch station, the confirmed nest, the dead power on gallery two — so
nothing it says contradicts the map page underneath. Own frequency (`203.14`,
vs. Ironveil's `141.80`) so the two calls don't read as the same broadcast.

Four operations still play straight to the map with no call: Sunderglass,
Lumenspire, Crownring, Shallowhelm. Same JSON-only pattern whenever one is
wanted.

## Sunderglass gets a codec call, with a different register

*2026-08-29*

Third entry in `operations.<k>.intro`, same JSON-only mechanism as Ironveil
and Blackmarrow. This one leans on the urgency already in Sunderglass's own
lore rather than mystery or dread: the crystal fields are actively shrinking,
and the call names the zones the map already shows (the Shallows, Prism
Ridge) plus the hazard the third zone implies — the Glassing, what's left
once the hive finishes feeding a field. Own frequency, `118.62`.

Three operations still play straight to the map: Lumenspire, Crownring,
Shallowhelm.

## Every operation now opens with a codec call

*2026-08-29*

The last three: Lumenspire, Crownring, Shallowhelm. Same data-only mechanism
throughout — `codectest` validates all six generically and required no
changes. Each leans on its own lore rather than repeating a formula:

- **Lumenspire** carries the moral weight already in its lore — the
  barricaded researchers are an "optional objective" on paper, but their
  families were told they were already out, and Hikaru says so before the
  Commander ever sees the dorms.
- **Crownring** is pure urgency — the burrowers are already inside the walls
  mid-summit, and the order is "whatever it costs," verbatim.
- **Shallowhelm** plays the dread the base lore sets up (gates sealed from
  the inside, "wears the Helm like a shell") without answering the question
  it raises — Hikaru doesn't know what's inside either, and says so.

Six operations, six calls, one frequency each so no two reference the same
broadcast: Ironveil 141.80, Blackmarrow 203.14, Sunderglass 118.62,
Lumenspire 174.05, Crownring 96.40, Shallowhelm 55.13.

## Shallowhelm rewrite: cultists, a named breach, and the Purge Protocol

*2026-08-29*

Shallowhelm's story gets a real cause instead of an unanswered mystery.
Fortress Shallow Helm is now explicitly the anchor of the whole defensive
line — while it holds, the hive breaks on the pass instead of the cities
behind it — and the nine days of silence has a reason: a cult that had
been quietly worshiping the invaders threw the gates open from the inside
and killed the wards with them. The mission is to arm what used to be
called "the Self-Cleanse" and scour the fortress clean of cultists and
hive alike.

Renamed throughout to **the Purge Protocol**, since "Self-Cleanse" never
had anything to purge that wasn't already implied — now there's an actual
enemy that got let in on purpose. The two map nodes it touches follow suit:
Cleanse Antechamber → Purge Antechamber, Cleanse Core → Purge Core (plus
the node lore and the final gate's reqText). `docs/SPEC.md`'s operation
summary was carrying the old names too and got the same pass.

The codec call was rewritten to match — beat two is now the actual reveal
(the cult, not fate, opened the gates) rather than a shrug at an unanswered
question. `sub` changed from "gone dark, no distress call" (now folded into
the lore) to "breached from within," which reads correctly on the ops list
now that the breach has an author.

## Cards that show their range instead of describing it

*2026-08-30*

One piece of feedback — card text should explain the ability and nothing else —
turned into five changes, and one of them exposed a genuine asymmetry in how the
board treats the two sides.

**`geomCells()` is the load-bearing addition.** `geomFor()` answers "what do I
hit"; the new one answers "where do I reach", returning cells regardless of what
stands in them. The card diagram and the board highlight both read it, so a
diagram cannot disagree with the board, and `geomtest.js` holds both to
`geomFor()`: every hostile struck must stand on a cell `geomCells()` lit. That
check is randomised across 400 boards with friendly blockers in the way, and it
caught a real off-by-one in `range3` on its first run — the blocker walk was
inclusive of the target cell where `geomFor()` checks strictly between.

**The board lights the whole footprint now.** Previously only tiles that already
had a hostile on them lit up, so a weapon covering empty ground showed nothing
until something walked into it — one turn too late to plan around. Cyan is
"I reach here", gold stays "and this one eats it".

**Hostiles became selectable**, which is the asymmetry: tapping one used to open
a popup and highlight nothing, while tapping yours showed its reach. Now the grid
obeys one rule. A new `foeSel` sits beside `mover`, mutually exclusive with it,
and `foeThreatCells()` in the rules layer turns `enemyIntent()`'s strike-versus-
advance decision into ground rather than a word. Three rules keep it coherent:
attacking still wins (a hostile already in a selected unit's sights is a target,
not an inspection), one selection at a time, and empty ground clears.

The threat band matters as much as the strike. A Spitter's whole lane is live,
not just its current target — put a body in the gap and it eats the shot instead.
`foeseltest.js` asserts exactly that, because a highlight that does not change
when the situation does is decoration.

**The copy cuts.** Descriptions mixed three things: the rule, a restatement of
numbers printed elsewhere on the same card, and the designer's opinion of the
card. Only the first is load-bearing. All 62 rewritten, average length 113 → 67
characters. Hostile copy survived better, with one change: the counter-guidance
moved to its own **Counter** line, because "how do I beat this" is a different
question from "what does it do".

**Three stat rows were pure duplication** — Deploy cost, Hull and Class are all
already printed on the card above the block (the cost badge, the HULL readout,
the subtitle). Footprint read "1 cell" on 59 of 62 cards and now appears only for
the three that differ; Mobility folded into the subtitle; Targeting is gone in
favour of the diagram. Yes/no facts became chips. With the cuts, plenty of cards
have no rows left at all, so the block is omitted rather than rendered empty.

**Two bugs the browser caught that the tests could not:** `foethreat` used a flat
fill darker than enemy territory, so on the hive's own ground the highlight read
as a hole — all three board states composite additively now. And the hostile
diagram was pinned to the left of its window wearing the card's gold palette;
hostiles advance toward column 0, so theirs reads right to left in magenta, with
lane effects in violet. The Chorus had no diagram at all until its board-wide
aura got its own case.

## The dropship window: a turning sky, and mortars in the loop

*2026-08-30*

The scene outside the window was unreadable, and measuring it said why rather
than guessing: the ridges sat within **3 to 8 points of luminance** of the sky
directly behind them. Three terrain bands, all of them invisible. That is not a
brightness problem you fix by turning brightness up — the sky and the ground
were simply the same colour.

So the sky turns, and every band turns with it. Four keyframes (night, dawn,
day, dusk) blended pairwise with a smoothstep ease, one full turn every 180
seconds, starting at a random point so two commanders do not open the hold
screen onto the same sky. Ridge colours come from the keyframe now instead of
being baked into the terrain, which is what actually fixes the legibility: the
terrain is a **pale ridge against a dark sky at night** and a **dark silhouette
against a bright one by day**. Measured separation, far to near:

| | far | mid | near |
|---|---|---|---|
| night | +22 | +29 | +38 |
| dawn | −39 | −44 | −53 |
| day | −69 | −84 | −99 |
| dusk | −39 | −49 | −63 |

Day is deliberately hazy and dust-blown rather than a clear blue — a bright
blue sky would read as a different game sitting inside this one's palette. The
starfield fades out as the sky comes up and is gone entirely by day, and the
horizon glow from the fighting below fades with it, since it cannot light a sky
that is already lit.

**Mortars joined the event loop.** The scene already had things falling (bombs,
released from aircraft) and things climbing (tracers, straight up); a mortar is
the shape neither of those draws — a full parabola that starts and ends on the
ground, gravity at 0.42, about two and a half seconds from tube to impact,
leaving a warm smoke arc behind it. That silhouette is what makes it read as
artillery rather than as another bomb.

**The build caught the one real hazard here:** a module-level `tone` collided
with `tone` in `sound.js`. The flat-concat bundler refuses duplicate top-level
names across the whole graph, so it failed loudly instead of letting two
modules quietly share a binding at runtime. Renamed to `skyTone`.

## Move and range on the same tile: green edge, gold middle

*2026-08-30*

Once reach turned gold, it started arguing with the green movement highlight,
and measuring how often said this was not an edge case: `moveTargets()` always
includes the cell directly ahead, which is inside the pattern of anything that
faces forward, so **28 of 30 mobile armed cards (93%) overlap**. The Assassin
and the Samurai overlap on all four of their move targets — every tile they
could step to is also a tile they cover.

Left to the cascade the two blended into a muddy gold-over-green, because
`.movetgt` sets the `background` shorthand (which wipes `background-image`) and
`.inrange` sets `background-image` — so both applied and neither read.

They split the tile instead: **green keeps the edge, gold keeps the middle.**
Green is the edge because movement is the *choice being offered*; gold is the
middle because reach is the *fact being reported*. Neither colour has to be
given up, and a tile that is only one of the two is untouched.

The same collision has a swap variant — a friendly you can trade places with,
standing in your own line of fire — and it gets the same treatment with cyan on
the edge.

One thing worth writing down because it cost time in the browser: a unit that
has just deployed carries `acted`, and `drawBoard` only attaches the selection
handler when `!u.acted`. So nothing is selectable on the turn it lands, and any
harness that deploys and immediately clicks sees an empty selection rather than
a bug.

## v2.1 — the objective you can read, the hand you can see

Two player reports, one root cause underneath both, and a third problem
found while measuring.

**"I don't know what the objective is."** `objText()` returned a live score,
not a task, and it lived in `#c-obj` — a header span set to `display:none`
below 999px. On a phone the objective was never on screen at all. The two
loss conditions that apply to every mission (breach allowance, holding at
least six tiles) existed only inside `lossCheck()` and were stated nowhere.

**"I don't know why I won."** Every loss called `finish(false, why)`.
All seven win paths called `finish(true)` with nothing. A win was the only
outcome in the game that arrived unexplained.

`objBrief()` now states the goal as an order with live progress, the clock,
and the loss conditions; `winWhy()` names every win, including the two
genuinely different ways Stronghold and Extraction end. `GROUND_FLOOR` and
`ENDGAME_TURNS` are named once and read by both the rule and the readout, so
the printed threshold cannot drift from the check that enforces it.

**The tray.** Measuring the combat screen to find room for the objective
turned up the real problem: on a 390px phone the hand spent 219 of 664
pixels — a third of the screen — to show **2 cards out of 9**, and the
screen overflowed its viewport by 192px. Desktop was already fine; this was
almost entirely a compact-layout failure nobody had measured.

`HAND_CAP = 6`, set by the narrowest phone the tray must fit on one row
rather than by balance. Card effects are exempt — the player spent DP on
those draws. A held draw is never destroyed. The tray is one row of `--cap`
cards dividing whatever width they are given:

```css
.hc{width:clamp(40px,calc((100% - (var(--cap) - 1) * var(--hgap)) / var(--cap)),128px)}
```

45px at 320 through 128px on desktop, no breakpoints. Two stale `.hc` width
rules (`@media(max-width:560px)` and the `data-ui="pc"` override) were
silently beating the new formula and had to go — worth remembering that a
new rule is not in force until the old ones are gone.

**A/B'd the cap over ~6,400 missions per arm: 57.2% against 57.4% overall**,
per-type differences within noise and going both ways. A single sim run
swings 20 points, so one comparison would have proved nothing.

**The log.** Median 5 lines a turn, up to 34. 43% your own orders, 28% kills
you watched happen, 17% a wave the header already announced — and the `loss`
class, the only category reporting something done *to* you, is **3.6%**,
about one line every four turns. The log was not too hidden; it was too
noisy. It also could not be deleted: the visual layer fires effects for
breach, clash, hit, shield and spawn, none of which carry a *reason*, so a
Mender healing or a Puppeteer seizing a unit had no other explanation.

So it split. The 3.6% became an alert strip under the board needing no tap;
the rest became an overlay. As a column the log cost the board a grid track
on every layout, was desktop-only, and folding it away did not even work —
the compact grid kept reserving its `minmax(8rem,1fr)` row. Hiding an
element does not reclaim its track.

**Bugs found on the way:**

* `breaches >= allow - 1`, meant as "one from the end", is `0 >= 0` with the
  standard allowance of 1 — true on turn one of every mission. The condition
  it guarded was a no-op that always fired.
* "Nothing selected." cost exactly the 51px of overflow the phone had left.
* Eradication Blitz asked for ten hostiles in its briefing and nine in the
  mission.
* A stray `—` in the combat header from the retired `#c-obj` span.
* Abort fell off the right edge once the action bar had three buttons.

Verified mid-game on a 390px phone with a full board, units deployed and the
alert firing: 0px overflow. Desktop board 440px → 518px.

`captest` covers the cap, the exemption, and that a held draw never consumes
a card. `handtest` pins the tray to `--cap` rather than a fixed width, since
a literal width there is exactly the bug this removed. `uitest` pins the
overlay contract.

## How we ship

**Batch the shipping — one publish per session, at the end.**

The live game is one Artifact, and the tool will not republish over a version
the current conversation has never seen. Confirming it by byte-comparing the
saved copy against the last shipped `dist/gridfall-embed.html` is not enough;
the guard wants the file Read, and at 482KB that is on the order of 400k
tokens. It is a per-conversation toll, not a per-publish one: once a session
has published to that artifact, every further update from that session is free.

So the cost is entirely in how often we start. Do a session's work, ship once
at the end, and it is paid once. Shipping three times in three sessions pays it
three times.

The real fix is to stop hosting the game as an Artifact at all. `dist/gridfall.html`
is a complete standalone page with no external dependencies — GitHub Pages on
this repo would give it a permanent URL that costs nothing to update. Deferred
until there is someone at a machine to set the Pages source up.

## v2.2 — the screen that holds still, and gear you can read

Eight things, all of them reported from play rather than found in the code.

### The board was moving, and it was not the objective text

The report was "grid screen moves when it could easily stay static and have
text do the work — objective text gets longer, it causes the rest to scroll
left and right and move."

The first hypothesis was horizontal: a long objective line growing its grid
track and re-centring the board inside it. That was wrong, and the measurement
said so. With `.cbcol{min-width:0}` removed and a 150-character objective
forced into the panel, the board's x and width did not change by a pixel at
390, 360 or 1440. Prose wraps; its min-content is its longest word.

The real one showed up on a 1024px display, running fourteen turns of a
campaign mission and recording the board's box every turn:

```
  t9  boardY 106.0   alert false
  t10 boardY  88.8   alert true
  t11 boardY  89.3   alert true
  t12 boardY 106.5   alert false
```

`17.7px`, up and back, every time a breach was reported. `.cbcol.mid` centred
its contents, the alert strip lives inside `.field` under the board, and
centring means anything that grows below the board pushes the board itself up
by half of it. The same jump was available from a wrapped stats row.

The fix is one word: `justify-content: flex-start`. The board is pinned to the
top of its column and the strip grows into the slack below it. Re-measured over
the same fourteen turns at both sizes: two values, `100.2` and `101.4`, one per
viewport, unchanged from t0 to t13. The sub-pixel wobble went with it.

Three more changes hold the same line, and `statictest.js` guards all of them:
`.cbcol{min-width:0}` so no column is ever sized by its own text, compact
`.cbmain{overflow-x:hidden}` so there is no sideways axis to wander on at all,
and `overflow-wrap:anywhere` on the objective's two prose lines.

### The objective panel keeps one shape

v2.1 showed the losing conditions on a phone only when they mattered — turn
one, and again when a threshold got close — because they were 20px of wallpaper
the rest of the time. Every one of those swaps resized the panel.

That conditional is gone, along with `objBrief`'s `press` field and the three
CSS rules that read it. What paid for it was the compact row template:
`max-content max-content` left the details row at its content height and parked
~180px of dead space above the hand tray. `minmax(max-content, 1fr)` still
cannot squeeze the panel below its content — which is what the original comment
was protecting against, and a plain `auto` row would do — but it stretches into
whatever the board leaves. `scaletest.js` now checks each track's *minimum*
rather than matching the literal string.

### The Shoulder Cannon is gear

It was a 2 DP tech card with `attach: "cannon"` that landed on a unit
mid-mission and gave it a second shot. As gear it is chosen at the armoury, so
`u.twin` is a property of the unit from the moment it deploys and
`src/rules/combat.js` reads that instead of `u.att.cannon`. Priced at 450 cr —
the most expensive piece in the pool, because doubling a heavy gun's output is
the strongest thing gear does.

Removing a card id from `POOL` is the one operation `migrate()` exists for, and
it does the right thing already: the id is stripped from decks and unlocks. But
stripping it silently would take 145 credits with it, so v6 issues the gear to
anyone who owned the card first. `geartest.js` covers both directions — the
record that owned it gets the piece, the record that never did is not handed a
free 450-credit item.

Shield is now the only `attach` card left. It was not part of the ask, so it
stays; the code path is unchanged and works.

### Gear you can actually choose

"Players are forgetting what the gear attachments do when putting their squads
out and need a better system to pick and see the gear and attach to units."

The old fitting UI was a row of chips carrying nineteen bare names. Choosing
gear therefore meant remembering nineteen rules texts, which players plainly
were not doing. Worse, exactly one copy of each piece exists per profile, so
fitting one that was already somewhere quietly stripped it off that card — with
no warning before the tap.

Both halves are now on the row: the piece's full rules text, and where it
currently is (`Fitted` / `On Rifleman` / `Free`). The role tabs and the search
filter survive; the filter now matches effect text as well as names.

The other direction did not exist at all. Fitting was reachable only from inside
a card's focus view, which asks the question backwards. The **gear locker** in
Squad lists every piece you own with its rules text and its current card; tap
one and it opens onto the list of deck cards it can go to, each saying whether
its slot is free or which piece would be displaced. Fitting from there stays on
the piece so you can see where it landed.

The hand card's gear caption went with this. At six cards across,
"Overclocked Uplink" wrapped to two lines under a name that had already
wrapped, and it still only said *which* piece. A cyan ◈ in the corner says the
card is geared; the piece and its rules text are one tap away in View card,
which now carries a read-only gear block in every mode that is not fitting.

### Squad organisation

Sort by A–Z, level (veteran rank, then deployments inside a rank), deploy cost,
or geared-first — and split the grids by class the way the Quartermaster shelf
does, which is where players learned the pool. Split-by-class is the default.
Both choices live on the profile, so a commander who thinks in classes does not
have to re-say so every time they open the panel.

### Three small ones

The **combat log** opens with the objective pinned above the scroller. The log
is where you go to reconstruct a turn, and scrolling back through forty lines
with the goal off screen is how you lose track of what you were trying to do.
`drawObjective(host)` takes a target id now; `#objblk` and `#objlog` are the
same renderer.

Every **codec advance control** is the cycling dots, the sign-off included —
`codecWait(onGo, label, kind)` builds all of them, and the sign-off wears the
channel's green. The commander's reply keeps its words, because that is
dialogue rather than navigation. The destination lives in `aria-label`, so a
screen reader still announces "Open the sector map".

**Tab rows** hide their scrollbar. A 4px bar under a row of tabs is a second
horizontal rule competing with the tabs, and on a phone it reports the row's
extent by drawing something nobody grabs. `markSwipe()` measures the row and
fades whichever edge still has content behind it — nothing when the row fits,
nothing at an edge you have already reached. The inbound-wave strip in the
combat header keeps its scrollbar: `headtest.js` asserts that deliberately, and
it was not what was asked about.

## v2.3 — the board grows a vertical axis

### Hostiles go sideways

The report: "when enemies reach a dead end like a bombardment field or something
have them move up or down instead. also give enemies on the field already the
choice to move up or down as well."

Before this, `actHostile` had exactly one answer to a cell it could not enter:
`break`. A bombardment crater — permanent `'x'` terrain — therefore turned into a
free permanent wall, and a Hulk could plug a lane for a whole mission with
everything behind it standing in a queue.

Three rules now, in this order, and the order is the whole design:

1. **A player's unit in front is a fight.** Never a wall to walk around. This is
   the game; nothing about open lanes either side changes it.
2. **Queued behind another hostile with a shot to take?** Take the shot. Firing
   past the body in front is the horde working as intended.
3. **Otherwise move** — forward if the road is open, sideways if it is not.

The third rule spends **one step, not the turn**. That distinction is worth more
than it looks: at whole-turn cost a Crawler that met a crater lost its tempo and
the detour read as a stall; at one step it flows round and keeps going, while a
Hulk still pays a full turn for the same detour. Preference order is a lane it
can keep advancing down, then the softest lane — the same reading `predictSpawns`
uses, so a flank is the horde being consistent rather than the horde cheating.

The spawn contract is untouched and `flanktest.js` pins that down explicitly:
the markers promise which lane a hostile **enters**, never where it stays.

**Two things this got wrong on the way, both caught by measurement:**

- The first cut let a queued hostile sidestep instead of firing. Over ~6,900
  simulated missions per arm that was **+14 points of win rate** handed to the
  player — the horde was trading its damage for a shuffle. Hence rule 2.
- Adding a "stopped, so shoot instead" fallback quietly armed every slow hostile
  on its off turn: a Hulk banking half a step is not *stopped*, it is walking.
  `steps > 0` guards it. The `mechtest` fixture caught this by accident, which is
  the argument for fixtures that play a real turn.

A third thing it broke, worth recording because it is the useful kind: `aimtest`
went from 0/40 flaky to 8/40. Not a defect in the rules — the test took
`enemies[0]` blindly and stood an Assassin at `foe.col - 1`, which is column −1
whenever the oldest hostile has reached the edge. Hostiles reach the edge far
more often now that an obstacle reroutes them instead of stalling them, so a
latent unsoundness in the fixture started firing. Fixed in the test, by picking
a hostile that has a cell in front of it.

**Balance:** 15 aggregated runs of `mtest` per arm, 6,900 missions each.
Overall **57.1% → 60.4%**, and it is concentrated: stronghold +7.2, blitz +12.0,
everything else inside ±3. The hard missions (uplink 31%, crystals 43%,
specimens 44%) did not move. Left as-is rather than compensating in the same
change — a wave-budget nudge would confound the measurement — but the spread is
wider than it was and that is the thing to watch.

### A matched pair of war frames

**Ashura Frame** (Specialist, 5 DP, 16 hull, blocker, 430 cr) targets `vert3` —
the column ahead across three lanes at once. *Crossing Cut* slides it one lane
toward the heavier side and cuts everything in front for 6.

**Oni Frame** (Specialist hostile, 18 hull, 5 damage, threat 7, wave 5+) carries
the new `flank` flag: it does not wait to be stopped, it re-reads the line every
step and crosses into the thinner lane while it still has the choice. `FLANK_GAIN
= 1.5` is what stops it drifting on rounding noise — and it cannot oscillate,
because `laneScore` reads the player's units and a hostile moving does not change
them.

They are a designed pair. The Oni exists because the board now has a vertical
axis and something should exploit it; the Ashura exists because something should
answer that. Both are guarded together in `mechtest.js` for exactly that reason —
if either half stops working the other stops meaning anything.

Single-pixel diagonals are noise at 12×12; both sprites went back for a second
pass with two-pixel blade shafts before they read as frames rather than static.

### Breaching Charge takes the short beat

Stratagems resolve at the *start of the following turn* by design — playing one
is a prediction, not an undo. Breaching Charge was the one call that delay made
close to unusable: a full turn is long enough for the column you aimed at to
empty itself.

It now declares `now: 1` and fires at the **end of the turn you call it**, after
the hostiles have moved and before the tiles flip — so a swept column is ground
you then hold. It is still a prediction, just a shorter one: you know where they
are, not where they will be. `breachtest` case F guards precisely that, by aiming
at where a Crawler *stands* and asserting the charge misses.

The class keeps its long beat; `now` is a per-call opt-in and only this call
takes it.

### Achievements, 15 → 24

Nine added: Long War, Not One Step, Marshal, Veteran Corps, Well Found, Colours
Flying, Deep Water, Chain of Command, Standing Order.

The constraint held: every badge is a pure function of what the save already
holds. *Not One Step* is the interesting one — "no breach yet" is not a stored
flag, it is the absence of one, so progress reads as deployments while the breach
count is nil and collapses to zero the moment a lane opens. `achievetest.js`
checks the list on a fresh record, a maxed one, and a v4 record that predates
half the fields it reads.

### Squad and gear, second pass

Sorting is **reserve-only** now. The twelve cards in a deck are twelve chosen one
at a time and their position is learned; rearranging them on a preference takes
something away. The reserve is the pile you hunt through and the pile that grows
to fifty.

The gear locker went back to the same `.gcard` tile the Quartermaster shelf and
the card grids use — a piece of gear should look like a piece of gear everywhere
— with the card carrying it printed on the front.

Opening a piece now leads with **which card it is linked to**, folded: that is
the fact you came for, and a thirteen-row picker unfurled above it buries the
answer under the means of changing it. Tap the name to unfold, "None" at the
bottom of the list.

## v2.4 — Frames

Built from a concept brief that said, correctly, to treat every number in it as
an argument rather than a value. What follows is what those arguments became
against the code as it actually is, and where they were bent.

### The shape

Three data flags carry the whole class, and nothing else in the game had to
learn about Frames to make them work:

- `pilot: 1` on a card — the cheap body a Frame needs. One cell, no weapon,
  two hull.
- `frame: 1` on a card — Specialist, two cells, deploys only onto or beside a
  friendly Pilot, consumes it.
- `frame: '<cardId>'` on a gear entry — that piece is a Frame weapon, bound to
  that Frame, and it REPLACES the printed weapon rather than riding on it.

The replacement is the part that touches the most code, because everything that
reads a card's targeting or damage had to learn to ask a different question.
`frameWeapon(id)` is the single accessor; `mkUnit`, `statRows`, the hitbox
diagram, and the combat details panel all go through it, and the card is the
fallback so a bare Frame is a real card rather than a dead draw.

`gearFits(cardId, gearId)` is the exclusivity rule, one function, read by both
fitting surfaces AND by both fitting handlers. A filter that is only applied
where options are *offered* is a filter you will eventually route around.

### Where the deployment rule lives

`validTiles` gets a `k.frame` branch that returns before the ownership loop
below it — deliberately, and the comment says so. A Silent Insertion charge
widens where ordinary cards may be played, and without the early return it
would have quietly turned a Frame into a card that drops anywhere. `frametest`
asserts that specifically.

The offer is: every two-cell footprint that is passable, contains at most one
Pilot and no other unit, and has some Pilot on it or orthogonally beside it.
Around a single Pilot that is eight cells. `frameAnchorFor()` is shared by
`validTiles` and `deploy`, so the cell you are offered and the Pilot you
actually spend cannot disagree.

Spending the Pilot is a filter, not a kill: `G.lost` does not move, because the
Pilot is climbing in rather than dying.

### The decisions the brief left open

Taken as recommended, with one exception:

- **Pilot first** — yes, and it falls out of the rule rather than being
  enforced separately.
- **Ejection** — yes. A destroyed Frame puts its Pilot back at one hull in the
  cell the wreck's front stood in. If something is standing there, the Pilot
  goes up with it, which keeps the mercy from being unconditional.
- **Two cells** — yes, matching Aegis Knights. Four was not tried; two already
  makes finding somewhere to land a real question.
- **No general gear on Frames** — yes, both directions.

**The exception is the cost, and it needs a decision.** A Pilot is 1 DP and a
Frame is 5 or 6, against a 6 DP turn. So:

- Heavy Arms (6) can *never* be fielded in one turn. The window is forced.
- White Devil and Seven Blades (5) can be, at the cost of the entire turn's
  deploy points and two cards drawn together.

That gradient is defensible — the cheaper Frames buy the option of skipping the
vulnerable window by spending everything else — but it is currently an accident
of the numbers rather than a decision, which is exactly what the brief warned
about. Push both to 6 to force the window everywhere, or leave it. It is one
value in `reference/gridfall-data.json`.

### The dials, in the order they will need turning

1. **Pilot fragility.** 2 hull, so a Crawler (2 damage) kills it in one hit and
   anything larger does so trivially. That is "genuinely vulnerable" as asked,
   and it is the number most likely to be wrong in either direction.
2. **Frame weapon pricing.** 440–540 credits, above the general pool's ceiling
   (450, Shoulder Cannon) as the brief required. But a Frame weapon is bound to
   one card, so it is buying less flexibility for more money — watch whether
   that reads as fair or as a tax.
3. **Frame cost**, per the decision above.

Balance was not re-measured against the bot, and deliberately: `mtest` plays
STARTER decks, which contain no Frames and no Pilot, so the harness cannot see
this feature at all. Numbers stayed in their usual band, which proves only that
nothing was broken in passing.

### The bug this found

`geomtest` is randomised on purpose — every firing pattern, scattered across
hundreds of boards, asserting that everything `geomFor()` strikes stands on a
cell `geomCells()` lit. Adding Frames put two-cell blockers into the fixture in
quantity for the first time, and it immediately failed on `range3`.

`geomFor`'s blocker check compared anchor columns (`f.col > front`), while
`geomCells`' `cutTo` walks `unitAt` and is footprint-aware. A two-cell blocker
anchored ON the shooter's own front cell covers front+1: the rules said the
shot was clear, the board said the tile was dark, and the game struck a hostile
from a cell it had never lit. Fixed by giving `geomFor` the same walk.

That bug predates Frames by months. It was unreachable only because the one
two-cell blocker in the game was rarely in the way.

`geomtest` also needed a fix of its own: three of the new geometries exist only
on gear, so the sampler now covers gear-declared patterns too — and it fits the
weapon per trial rather than once up front, because two of them live on the same
Frame and the second assignment was silently swallowing the first.

## v2.5 — Proto Frames take a slot

Four revisions to the Frames that shipped in v2.4, and one of them changes the
class more than the other three together.

### The slot

A Proto Frame is no longer a card in the deck. It has a slot beside the deck —
`active.loadout.frame` — holding one Frame, and the mission carries exactly one
deployment of it. `src/rules/frames.js` mirrors `stratagems.js` deliberately:
seed at launch, read from the hand tray, spend once, gone.

The argument for it is the same one that justifies the class at all. A Frame
costs a whole turn's deploy points AND a Pilot placed a turn earlier. A plan
that expensive cannot also be at the mercy of the shuffle — a Frame that never
draws is a wasted slot and a wasted 470 credits, and the player would correctly
stop building around it. Making it always available is what turns the cost into
a decision rather than a wish.

`consume()` closes the slot instead of splicing a hand it was never in.
`migrate()` moves any Frame that ended up among the twelve — a v6 save, a pack
drop from before the slot existed — into the slot rather than deleting it.
`packs.js` no longer auto-adds a Frame to the deck, which would have silently
evicted a real card.

### One cost, and the window it forces

All three Frames are 6 DP now, against a 6 DP turn. That was the open question
in the v2.4 notes and this settles it in the direction the brief wanted: the
Pilot costs 1, so 1 + 6 = 7 and the two can never be fielded on the same turn.
The vulnerable window is no longer a property of which Frame you picked. It is
the rule.

It also means a Frame turn is *only* a Frame turn — nothing else gets deployed
alongside it. Watching the bot script fumble this repeatedly was the clearest
demonstration that the cost is real: it kept spending three points on a
Barricade and then finding the Frame greyed out.

### Proto and Exo

`chassis` on a card is the whole classification, and the behaviour keys off it
rather than off a separate flag — so the lore word and the rule cannot drift.

- `chassis: 'proto'` — White Devil, Seven Blades, Heavy Arms. Prototypes:
  bigger, further along, and not trusted to walk themselves onto a battlefield.
  Pilot-anchored, slot-bound, one per mission.
- `chassis: 'exo'` — Aegis Knights, Ashura Frame, Exo Juggernaut, Thruster Ram.
  Proven suits in service, deployed like any other card, unchanged.

The four Exo cards were chosen as the heavy machine chassis already in the pool.
Nothing about them changed except the word on the card.

### White Devil, the all-rounder

Five weapons, against two on each of the other Frames. That asymmetry IS the
all-rounder — it is not better at any one thing, it is the only one that can be
re-specced to the mission:

- **Beam Rifle** (440) — `first`, single. The reliable lane shot.
- **Beam Saber** (480) — `adj`, single, riposte 3. Contact, and it answers back.
- **Beam Javelin** (480) — `ahead2`. Reach without giving up contact.
- **Hyper Napalm** (520) — a new `cone` geometry: one cell at the mouth, three
  across behind it, plus `scorch`. The only widening pattern in the game and
  the only weapon that leaves the ground burning.
- **Hyper Rail Cannon** (560) — `furthest`, single, `pen`. Punches past the
  front rank to whatever is deepest in the lane, and armour floors do not apply
  when it arrives.

The rail cannon was drafted as `first` + `pen`, which made it the Beam Rifle
with a bigger number for 120 more credits. In the general gear pool a strict
upgrade is fine — the two pieces sit on two different cards at once. In a Frame
slot you carry exactly one, forever, so the loser of a dominant pair is simply
dead. `furthest` gives it a job nothing else in the kit does: reaching the
Spitter or the Chorus dug in behind the rank. `frametest` guards the property
rather than the shape list — no two weapons on any Frame may cover the same
ground.

`pen` and `scorch` had to learn to ride on a Proto weapon in `mkUnit` — they
were card-only fields until now.

### The bug this revision introduced and caught

Moving Frames out of the deck grid removed the only surface that rendered their
weapon picker: `frameWeaponBlock` checked `mode === 'gear'`, and the new Frame
slot passes `mode === 'proto'`. For one build there was no way at all to change
what a Frame was carrying. Caught in the browser, not by a guard — the guards
test the rules, and this was a route that stopped existing.

## Still to decide

- **Frame weapon pricing** (480–560) sits above the general gear ceiling as the
  brief required, but a Frame weapon fits one card. Watch whether that reads as
  aspirational or as a tax.
- **Pilot fragility** is still 2 hull, still the first dial. Live play shows it
  dying to the first thing that reaches it, which is the intent — but it means
  a Frame turn can be wasted before it starts.
- **The bot cannot see any of this.** `mtest` plays STARTER decks with no Pilot
  and an empty Frame slot, so every balance number in this file is blind to the
  class. Frames need either a bot that drafts or a dedicated harness before any
  number about them means anything.

## Proto Frames: the balance check

`tests/frmtest.js`, run by hand rather than on every build. Eight arms over the
same rolled missions, 1,380 missions each, three independent passes aggregated —
±2.6 points at 95%, and the per-pass spread is printed so a wide one is visible
rather than hidden inside an average.

The bot had to be taught the line first, and that is worth being honest about:
without it a Frame never once reached the board, because the greedy
"first affordable card in hand" rule spends the turn's points on a Barricade
every turn and the Frame needs all six. So the Frame arms are played to a plan
(Pilot down early and rearmost; on a turn the Frame can land, it is the only
thing that lands) and the control arm is not. Every Frame number below is
therefore generous.

```
arm                      win%      n  landed%  vs pilot  vs ctrl   per-pass
control (no pilot)      61.4%   1380        —     +3.2    +0.0   [58.9, 63.9, 61.3]
pilot, no frame         58.2%   1380        —     +0.0    -3.2   [58.3, 58.7, 57.6]
White Devil bare        56.9%   1380    80.0%     -1.3    -4.5   [54.1, 62.8, 53.7]
Seven Blades bare       59.1%   1380    79.2%     +0.9    -2.3   [56.5, 61.7, 58.9]
Heavy Arms bare         60.9%   1380    80.6%     +2.8    -0.4   [61.1, 62.6, 59.1]
White Devil +saber      59.6%   1380    77.8%     +1.4    -1.8   [56.5, 63.7, 58.5]
Seven Blades +sword     64.3%   1380    77.5%     +6.2    +3.0   [63.7, 65.2, 64.1]
Heavy Arms +gatling     58.0%   1380    79.2%     -0.1    -3.3   [57.0, 58.3, 58.9]
```

### What it says

**The setup step costs 3.2 points**, and that number is solid — the pilot arm
reads 58.3 / 58.7 / 57.6 across three passes. Swapping one real card for a
Frame Pilot is a genuine price, which is what the design wanted.

**Landing is not the problem.** 77.5–80.6% across every arm and every pass: the
Frame reaches the board four missions in five. The vulnerable window works as a
window rather than as a wall.

**The machine does not pay the price back.** Against the control deck — twelve
cards, no Pilot, no Frame — six of the seven Frame configurations are level or
worse. Only Seven Blades with the Crystal Greatsword clears it, at +3.0, and it
is the most consistent arm on the board (63.7 / 65.2 / 64.1).

So the class is **underpowered, not overpowered**, and it is underpowered in a
legible way: the one weapon that beats a normal deck is the one with the widest
footprint. `sweep` covers six cells; every other Frame weapon covers between one
and four.

### Why, most likely

Six deploy points is a whole turn, and a whole turn otherwise buys two or three
cards — two or three bodies, in two or three lanes. A Frame is one body in one
lane. Twenty-five hull is excellent attrition and the mission is not decided by
attrition: you lose by dropping under six held tiles or taking a breach, and one
very tough unit cannot hold ground it is not standing on.

That reading is consistent with the data: the arms that do best are the ones
that reach across lanes, and the worst is the White Devil bare, whose service
blade hits one adjacent cell for 2.

### The footprint experiment, and a reversal

"2–4 squares is too big anyway for such a small grid space" — tested before
deciding, same harness, 1,380 missions per arm per size:

```
arm                     2 cells   1 cell   change
no frame at all           61.4%    60.2%    -1.2
pilot, no frame           58.2%    58.3%    +0.1
White Devil bare          56.9%    58.0%    +1.2
Seven Blades bare         59.1%    56.8%    -2.2
Heavy Arms bare           60.9%    60.2%    -0.7
White Devil +weapon       59.6%    59.6%    +0.1
Seven Blades +weapon      64.3%    62.8%    -1.6
Heavy Arms +weapon        58.0%    59.4%    +1.4

landed on the board:  2 cells 79.1%  →  1 cell 92.6%
```

Every win-rate change sits under the ±2.6 noise line. The landing rate does
not: at two cells wide, one mission in five the footprint never finds a legal
spot around its Pilot and the Frame rots in the tray. At one cell that failure
mode nearly disappears.

So the v2.4 brief's footprint argument — "more than one cell, or the Frame is
just a big Rifleman" — is reversed by its own standard: the size was never what
made the Frame feel big, the weapon arc is, and the two-cell body was measured
as pure downside. **Proto Frames are one cell now.** The guard in frametest
flips with it and says why.

(This also quietly simplifies the class: the two-Pilots-in-one-footprint edge
case and the Cipher-swap-into-a-one-cell-hole case both stop existing.)

### Lever 2, pulled and measured — and the prediction was wrong

The bases went wide: White Devil `adj` 2 → `adj4` 3 (every adjacent hostile at
once), Seven Blades `adj` 6 → `vert3` 5 (the column ahead across three lanes),
Heavy Arms `first` 5 single → `ahead3` 4 (fire walked three cells down the
lane). Same harness, same three-pass protocol, against the one-cell baseline:

```
arm                      narrow     wide   change  wide vs ctrl
no frame at all           60.2%    61.2%    +0.9             —
pilot, no frame           58.3%    59.3%    +1.0          -1.9
White Devil bare          58.0%    57.8%    -0.3          -3.4
Seven Blades bare         56.8%    59.4%    +2.6          -1.7
Heavy Arms bare           60.2%    60.2%    +0.0          -0.9
White Devil +weapon       59.6%    59.1%    -0.6          -2.1
Seven Blades +weapon      62.8%    62.6%    -0.1          +1.4
Heavy Arms +weapon        59.4%    59.5%    +0.1          -1.7
```

Every change is at or under the noise line. The footprint hypothesis — built on
the Greatsword arm winning — did not generalise to the service weapons, at
least not in the bot's hands, and the honest suspect is the bot itself: it
parks the Pilot in the rearmost cell, so the Frame spends the mission at the
back where a wide arc reaches nothing until the horde is already on top of it.
A sweep is worth what your positioning makes it worth, and the bot has none.

The wide bases are KEPT: they cost nothing measurable, they make a bare Frame
read as a Frame rather than a big soldier, and the first machine a new owner
fields should not be the dullest version of it. But the claim that they would
close the gap is withdrawn — that is what the harness is for.

Where this leaves the class: roughly cost-neutral to a couple of points
negative against a plain deck, at bot level, with the usual floor caveat — the
bot neither positions nor times the Frame, and both are exactly what a Frame
rewards. The one lever still standing is the territory one (a Frame that holds
the ground around it), and it is now the only lever with the evidence pointing
at it rather than away.

### Levers, if it needs one

Not applied — this is a design the numbers should inform rather than decide.

1. **Make Frames hold ground.** `claim` already exists as a card property. A
   Frame that claims the tiles around it addresses the actual loss condition
   rather than adding damage to a unit that already has enough.
2. **Widen the base weapons.** The bare arms are the weakest; a bare Frame is
   the one every new owner fields first, and it should not be the worst version.
3. **More damage.** Simplest, and the least interesting — it makes Frames better
   at the thing the game does not score.

Cost is deliberately not on the list: 6 DP is what forces the two-turn window,
and that window is the class.

## v2.7 — the gear-strengthening pass

The directive after the v2.6 verdict: bare Frames running a little weak is
acceptable, but the gear has to strengthen them. Three measured rounds, each
1,380 missions per arm, arms sharing a mission set within a round.

### Round 1 — damage alone (rejected by measurement)

All nine weapons got flat damage buffs (Beam Saber 10→12, Laser Gatling 6→9,
Missile Gatling 4→6, the rest +1 or +2). The result: nothing moved. Kitted
arms stayed level with or below bare. The lesson: for the adjacency and
centre-blind weapons, damage was never the constraint — the weapon rarely had
a target, so a bigger number just overkilled the few it saw. Geometry is the
lever, damage is not.

### Round 2 — geometry (half worked)

Laser Gatling wings extended two cells deep on both diagonals (the centre gap
stays — the gap is the card); Beam Saber riposte 3→6. The harness also grew
from one kit arm per Frame to two, which put the untested half of the arsenal
on the board for the first time — and that mattered more than either buff:

    whitedevil+beamsaber      58.1   −0.2 vs bare
    whitedevil+railcannon     59.4   +1.1
    sevenblades+greatsword    61.8   +3.2
    sevenblades+longsword     54.7   −3.9   ← a trap
    heavyarms+lasergat        59.6   −0.4   (was −3.7 before the deep wings)
    heavyarms+missilegat      63.6   +3.5   ← best arm on the board

The Longsword was actively harmful: trading the Seven Blades' three-lane
swing for a single-target poke at range three cost four points. A weapon a
player buys that makes the machine worse is the one outcome the directive
cannot tolerate.

### Round 3 — the rework (converged)

Longsword became a lane-pierce — `ahead3`, multi, dmg 8: the greatsword
answers width, the longsword answers depth. Rail Cannon 10→12. White Devil's
kit arms rotated to railcannon + napalm so the last unmeasured weapon got its
numbers:

    control                   61.3
    pilot                     61.0
    whitedevil (bare)         59.3      +napalm      64.3  (+4.9)
    sevenblades (bare)        60.1      +greatsword  63.3  (+3.3)
    heavyarms (bare)          58.3      +missilegat  64.1  (+5.7)
    railcannon −0.1 · longsword −0.4 · lasergat +0.0   (washes, not traps)

### The verdict

Every Frame now has at least one weapon that clearly strengthens it, and the
best kitted arms beat even the no-Frame control deck — the class pays for
itself when kitted, exactly as directed. The clean split that emerged: **area
weapons strengthen (+3 to +6), single-target weapons wash (±0.5)**.

The washes are left alone deliberately. The bot's missions are swarm-heavy,
and a single-target weapon's work is the armoured elite the harness
undervalues — Rail Cannon ignores armour floors, the saber duels at contact.
Pushing their damage until they registered against crawler floods would make
them degenerate in the fight they are actually for. The honest statement is:
at bot level they are even with bare, and their value is situational in a way
this harness cannot see. If a future harness rolls elite-heavy mission sets,
measure them again there before touching the numbers.

(Same standing caveat as every Frame number: the bot plays the Frame line to
a plan and the control arm greedily. Between-round drift on the shared arms
— control 61.1–61.6, pilot 57.1–61.0 across rounds — is the size of the
noise floor; only within-round comparisons are quoted above.)

## v2.8 — Operation bosses (the last unbuilt patch)

The design handoff bundle (`gridfallpatches.zip`) resurfaced with four patches.
Audit against the build: **Cards** (all 8 + Stim Injector + I-Field + the Medic
rework, no flamer), **Leads & Stratagems**, and **Frames** were already shipped
in earlier versions. **Bosses** — patch 3, "a system, not a content batch" —
was the one thing never built. Now it is.

### The one representational decision everything else fell out of

A boss body is N proxy entries in `G.enemies`, one per covered cell, all
routing damage into a shared pool on `G.boss` (`dmgBoss` in combat's damage
path). That one choice bought, for free: blocking (hostiles queue behind it,
`flankStep` walks around it), targeting (every geometry just sees enemies),
the drop-fight and territory rules, hostile selection/intel in the UI — and
the patch's headline rule, *an area weapon lands once per covered cell*, with
no special case anywhere. The guard proves it with one `blast(1,6,5)`: six
covered cells, thirty points, the Gantry's field gone in a swing.

### What shipped

- `boss` mission type: hard 18-turn clock (running out = loss), kill = win,
  `wave()` returns an empty manifest (the boss spawns its own adds), field
  events sit the fight out (`noEvents`), MAXDP+1 per turn per the patch's
  economy note. Final node of ironveil/blackmarrow/sunderglass; extraction
  stays the finale everywhere else. Gauntlet/daily/random pools exclude it.
- One irreversible phase flip, checked after every damage event — half hull
  default, shield collapse for the Gantry (the shield protects the player
  from phase two; that inversion is the fight).
- Immunity to deletion, not damage: drop-pod crush, Breaching Charge's
  999-through-the-threshold, Grapple Net, Outrider push, the Last-Stand
  grid sweep — all guarded against boss proxies.
- The three scripts: Gantry (ramp 1-2-3-hold fabrication, six-cell barrage
  after collapse), Brood Mother (lateral drift reversing at edges, seam one
  column forward every 3rd turn — the rig's "never reaches the player" bug —
  telegraphed breaches that a standing unit absorbs, untelegraphed row
  tendril, three-way split into disjoint lanes), Prism (25% reflection past
  shields that can kill, four growing fragments capped at 1.25x — the rig's
  unwinnable-growth bug, guarded).
- Four pixel tokens (the Gantry fills its frame; the Prism has no face
  because it has never needed one), bestiary entries that unlock on the
  first kill, board-wide influence hitbox diagrams, breach telegraph cells
  in the Burrow-Breach hazard language recast magenta, boss intel drawer
  (pool, field, phase, bodies, footprint), clock-forward objective block.
- `bosstest` in the guard suite: footprint/pool/blocking, both flip
  triggers, all three scripts beat by beat, clock loss + kill win, and nine
  bot fights that must resolve inside the clock.
- **Pre-fight briefings** (added on request, same release): the first launch
  of each Kill Order opens a codec call — Hikaru's holistic sitrep on the
  machine, mechanics delivered in fiction ("a soldier standing on a marked
  cell takes the hit and seals it") — riding the existing op-intro chassis:
  scene is data (`BOSSDEF[k].brief`), plays once per commander
  (`settings.briefs`), the launch itself waits for the channel to close, and
  Settings' *Replay intros* clears the flags. codectest guards the contract.
  The Gantry's briefing was then rewritten to the designer's own draft: the
  data-gone-wrong open, tech absorption via conveyor lines, and the clock
  reframed as lore — at eighteen cycles the GANTRY goes fully operational
  and the loss is bigger than the shipyards.
- **After-action debriefs** (same request): the first time the commander
  walks away from each boss kill, the channel opens again over the map —
  the world-state reveal. Gantry: bio-organic hostiles engaging UPE forces
  system-wide, absorbing and recreating our tech; *Zanshin Protocol
  activated across the system* (the title finally cashes in). Brood: the
  seams run off-world. Prism: the glass fields were an instrument, and it
  was measuring how the UPE fights. `BOSSDEF[k].debrief`, seen-once via
  `settings.debriefs`, fired from `leaveCombat()` after the result card,
  cleared by *Replay intros*. codectest walks the debrief too, and a
  headless bot-win → leaveCombat run proved the wiring.

### Numbers at bot level

First balance pass (informational suite): boss missions land ~37% bot win
rate — inside the brief's 35-60% band, on the first try, with the bot merely
taught to push forward. Left untuned on purpose: the brief itself says the
real read has to come from play, and the Prism's reflection punishes humans
harder than bots.

### Deliberately not built (backlog)

- Onslaught boss every ten waves (patch marks it optional).
- Bosses for Lumenspire, Crownring, Shallowhelm — three more machines, a
  content batch now that the system exists.
- Boss-kill achievements.
- Requiem Sage stays shelved with the cards patch's own reasoning.

## v2.9 — Frames move like prototypes; two bugs run to ground

Four asks in one batch, plus a difficulty-tier plan parked behind them.

- **Debrief never fired in real play.** The hook sat in `leaveCombat()`, but
  the result card's continue button is `$('rok')` in wiring.js — a different
  door that tears G down (`setG(null)`) before going to the map. The bot-win
  headless check had called `leaveCombat()` directly and proved the wrong
  path. Fixed in the rok handler (boss key read before teardown, debrief
  after packs), and re-verified through the actual button.
- **The Drop Pod "one-shot"** did not survive measurement: crush is never
  offered against a boss, and a full Hell Jumpers drop beside the Gantry is
  worth ~10 points into the field (the pods cannot land inside the
  footprint, so the impact blasts only clip the near column). No nerf, per
  the ask's own condition. The real bug found next door: `placeSquad()`
  skipped the crush code entirely, so a pod aimed at a hostile that survived
  the impact blast landed stacked ON TOP of it. Crush now applies on the
  squad path too.
- **Seven Blades rework** (designer's spec): the Crystal Longsword is the
  frame's standard weapon (`ahead3`, dmg 8); the gear slot became the
  Arm-Mounted Blade, which grants the game's first cell-targeted ability —
  Piercing Thrust: choose an empty cell down the lane, dash there, 8 into
  everything passed through; own units, craters and boss bodies stop the
  blade. New machinery: gear-granted abilities (`gear.ab`, dispatch on
  `ab.key`), an aim mode (`abAim`) with gold `piercetgt` cells, and
  `frameWeapon()` now requires `tg` so ability-gear does not eat the printed
  weapon. SAVE_VERSION 7 migrates longsword owners to the blade.
- **Omni frames**: all three protos aim in any direction — pattern weapons
  mirror through the machine's own cell (geomCells reflects, geomFor reads
  enemies out of the lit ground), seeking weapons hunt both ends of the lane
  (ahead-first, so the default strike is unchanged) — and step diagonally.
  Balance note: this is a deliberate buff to the class the last measured
  pass called "a couple points lean"; re-measure with frmtest when the
  difficulty tiers land.

## v2.10 — the combat theme lands (the audio handoff)

The gridfallaudio.zip handoff: a procedural combat soundtrack, zero audio
assets, everything synthesised at runtime. Integrated into the existing
music engine rather than bolted on beside it.

- **Two engines, three moods, one graph.** `music.js` keeps the hold
  "cruise" (92 BPM beat engine, untouched) and replaces the old combat
  mood with the handoff's 16-step sequencer: `combat` and `boss` share it
  (`step: true` moods). Everything still routes through the one mBus
  graph — shared lowpass (LFO nearly stilled for step moods so the build
  owns the cutoff), hall from a runtime noise impulse, dotted-8th delay
  run drier.
- **The theory is data, exported for the guards**: `M_PROG` (Em·G·D·F,
  roots 40/43/38/41 — the F natural is the borrowed ♭II and the only tone
  outside E natural minor; never "fix" it to F#), `M_BASS16` (the
  sixteenth gate, octave jumps on 4/12 once the lead is in), `M_LEAD`
  (the line per bar; the fourth bar falls a semitone onto E — the hook).
- **Pressure-driven build** (the brief's own recommended change):
  `pressureStage(g)` is pure — clock fraction ×2 + horde/6 ×2 + breaches/2
  + ground lost (15 tiles is the standing start), rounded, clamped 0–5;
  boss phase two returns 5 outright. At each completed rotation
  `mRotationGate` moves `mStage` via `buildStep(stage, target, jump)`:
  one stage per rotation in EITHER direction, jump only for boss p2.
  Stages gate layers directly: 1 bass16, 2 drums, 3 hats, 4 arp, 5 lead;
  filter opens 1800 + stage·520 eased over 1.2s.
- **Boss mood** pins stage 5 and the filter at 4200 from the first bar
  (wired in `enterCombat`: `G.type === 'boss' ? 'boss' : 'combat'`).
- **Per-op transpose**, one number each: ironveil 0, blackmarrow −1,
  sunderglass +3 (all three fixed by the spec), and my picks for the
  newer theatres — lumenspire +2 (glassy), crownring +1 (ceremonial,
  slightly wrong), shallowhelm −3 (drowned). Op-less modes play 0.
- **audiotest.js** ports the handoff's checkable assertions against the
  real module: progression note-for-note, the single-borrowed-F alarm,
  the semitone hook, rotation = 8.14s, the transpose table covers every
  op, pressure reads (quiet 0 / collapse 5 / eases back / p2 pegged),
  the one-step ramp walk both directions, silent no-op in the stub, and
  a source check that the scheduler still books ahead of the clock
  (plus: the shipped dist still contains the F chord). In run-all GUARDS.
- Browser-verified with an oscillator-type probe: boss node = square arp
  + kick sines inside the first bar; fresh profile's first node = saw
  pads + triangle roots only, no drums, for the whole opening. No page
  errors.

Not taken from the brief: the `audio.*` module surface (setBpm/setStage
manual overrides — the game has no UI for them and the existing
mood/toggle contract already covers start/stop/tier); the reference
file's analyser/viz. The handoff files live outside the repo; the spec's
numbers now live in the module and its guard.

## v2.11 — Kill Orders for the newer three operations

Backlog item "bosses for the 3 newer ops", done. Six bosses, six ops; the
final node of every operation is now a boss (run.js needed no change —
bossForOp covering the new ops did it). Each design deliberately claims a
mechanic none of the first three uses:

- **THE APERTURE** (lumenspire, hp 52, 1×3 column at c6): telegraphed
  lane beam. `G.boss.beam = {lane, dir}` — the marked lane burns for
  `beamDmg` (4) NEXT tick, then the mark steps one lane, ping-ponging at
  the edges. Deliberately deterministic where the Brood's marks are
  random: this one is about *reading*, and a player who reads it takes
  zero beam damage (the bot doesn't dodge, so human play skews easier
  than the measured rate — acceptable for a mechanics-reading fight).
  Phase two: the fan burns the marked lane ± 1. Raises a husk every
  `addEvery` (2) turns. Board shows the lit lane as a gold `.beamwarn`
  wash (soft on purpose — it covers a whole lane).
- **THE ENVOY** (crownring, hp 38, 2×2): censure — `adjDmg` (2) to every
  unit orthogonally adjacent to its footprint — and every `diveEvery`
  (3rd) turn it dives: proxies leave the board entirely, so nothing can
  target it (elegantly free of special cases), while the 18-turn clock
  keeps running. Next tick it surfaces at the fittable anchor with the
  fewest units under it (crushes only when it must), bringing `escortN`
  (2) burrowers. Phase two: dives every 2, surfaces at anchor col ≤ 2
  (your side), +1 escort.
- **THE RELIQUARY** (shallowhelm, hp 64, 2×2 at c6, never moves):
  `B.charge` counts to `chargeEvery` (4; 3 in phase two) — on discharge,
  every unit standing on ground you do NOT hold ('p' check at bossTick,
  which runs before territoryPhase, so "held" = held since last turn)
  takes `purgeDmg` (5), and `addN` (2) husks walk. Between discharges it
  anoints: converts `anoint` (2; 3 in p2) unoccupied held tiles to hive.
  Counterplay is presence on both halves of the kit; the purge countdown
  is in the log every turn and in the boss drawer.
- Shared plumbing: `summonAdds(kind, count)` extracted from gantryTick
  (identical placement, mid-field first); `beam/under/charge` seeded on
  G.boss for everyone; intel drawer grew Beam/Dives/Purge rows (`p2cut`
  helper for the shortened phase-two cycles).
- **Balance** (bot, 60 runs each after tuning): aperture 43%, envoy 53%,
  reliquary 52% — inside the 35–60 band. The tune that got there:
  aperture hp 44→52 + beamDmg 3→4 (was 70%), reliquary hp 48→60→64 +
  purgeDmg 3→5 + addN 2 (was 83%, then 70%). Envoy landed at ~50 untuned.
- **Codec**: briefs and debriefs for all three, in the established
  Hikaru voice, freqs 141.92/.95/.98. Debrief lore arc: the receiver of
  the Aperture's transmissions is unfound; the Envoy was imitating our
  institutions, not nesting; Shallow Helm's cult was not the only
  chapel (counter-intelligence task group stood up). MY DRAFTS — the
  user proofreads/rewrites codec text; offer these for review.
- Tests: bosstest count 3→6 + a mechanics block per machine (beam
  telegraph/sweep/fan, censure/dive-untouchable/surface-with-escort,
  purge-spares-held/anoint/static-seat/shortened-p2-cycle); resolve loop
  covers all six (18 bot fights). Browser-verified all three: brief
  intercepts launch, fight opens, beamwarn renders, drawer rows correct,
  no page errors (seeds in scratchpad newbossprofile.json + mkbossseed.mjs).

## v2.12 — Shallowhelm becomes the four-chapel pilgrimage

User direction (their words): shallowhelm fights human cultists; player
starts center with sub-bosses in 4 directions and returns to the center
for the final; sub-bosses = frames mixed with enemy DNA (their idea,
confirmed via options); final = the four combine into 1 (chosen over
one-at-a-time and two-at-a-time); elements = Fire·Frost·Volt·Crystal
(chosen); the Aperture = a human mixed with enemy DNA.

- **Hub map**: n1 The Nave (start, center) → four wings (approach +
  chapel each): n2/n3 Pyre, n4/n5 Brine (+n11 Drowned Archive side
  uplink off n4), n6/n7 Dynamo, n8/n9 Shard; n10 The Communion
  (role final, `req: [n3,n5,n7,n9]`). Map `req` gating already
  supported all of it.
- **Per-node bosses** (new engine capability): map nodes may carry
  `type:'boss', boss:'<key>'`; genRun copies `boss` onto the run row,
  launch → launchSpec → `G.bossK`; seedBoss uses `G.bossK ||
  bossForOp(op)`; map.js briefs the node's boss. BOSSDEF entries with
  `sub: 1` are excluded from bossForOp (finals stay 6, one per op).
- **The congregation** (3 human hostiles): zealot (hp4 dmg2 spd2),
  lector (spitter-pattern hold:4), choirwarden (human mender, mend 2).
  New waves.js capability: `OPS[op].foes` joins the wave pool from wave
  1, weighted by repetition — shallowhelm runs
  `["zealot","zealot","lector","choirwarden"]`.
- **Fallen Frames** (2×1 chassis, turns 18, `sub:1`): immolant hp42
  fireDmg3 — burns own lane then marches one lane (reverses at edges),
  zealot escort; drowned hp54 — freezes the DEEPEST un-frozen unit
  (u.stun) + chill 3; conduit hp50 — jams 3 guns (new `u.jam` flag:
  weapon dead one turn, legs fine; arcs 1 dmg only in p2); ossified
  hp48 — 2 breach marks/turn on the brood contract (shared
  eruptMarks/markBreaches helpers extracted from broodTick).
- **THE COMMUNION** hp84 2×2: hymn rotation pyre→brine→dynamo→shard
  (`G.boss.hymn`, "Next hymn" drawer row + log line each turn); pyre
  burns the most-manned lane for 4, brine freezes 2 deepest, dynamo
  jams 2, shard marks 2; choirwarden escort every 2; phase 2 = two
  hymns per turn. Replaces the Reliquary outright (v2.11's purge design
  died one patch old — the user's redesign supersedes it).
- **u.jam engine support**: fire() skips jammed, playerPhase ticks it
  down, board greys via the cooling class with its own tooltip.
- **Mend fix**: hostile menders can no longer heal boss proxies (would
  desync the mirror from the shared pool) — latent since v2.8, matters
  now that choirwardens stand next to bosses.
- **SAVE_VERSION 8**: strips `reliquary` from unlocks.enemies and drops
  any stored shallowhelm run (old node ids meant different things).
- **Aperture lore rewrite**: human researcher spliced with hive DNA,
  fused through the lens; brief beat 3 carries the tissue-return
  reveal, debrief the "we started it" turn. d/counter updated.
- **Balance** (bot): immolant 55, drowned 58, conduit 55, ossified 43,
  communion 55 (n=60 finals). Tuning history: all five started 85-100%
  (control elements don't kill; hull was low); hull+damage rounds got
  there; NOTE freezeN 2 on the drowned was a massive overshoot (28%) —
  freeze count is the sharpest lever in the kit.
- Tests: bosstest shape (6 finals + 4 subs, chapel wiring, final
  gating), per-frame element guards, communion rotation/flip guards,
  resolve ×30; maptest hub gating rewrite; codectest allows
  brief-only subs. Browser-verified: hub map, chapel brief intercept,
  Immolant walk drawer, gated Communion + Next-hymn row; seeds in
  scratchpad hubprofile.json/mkhubseed.mjs.
- MY CODEC DRAFTS (user proofreads): 4 chapel briefs, Communion
  brief + debrief, Aperture rewrite. Offer for review.

## v2.13 — the themes reassigned (user correction of v2.12)

User: "the frames ideas was for concordant / the human cultist enemies +
usual enemies are for the shallow helm / and the human and alien enemy
fusion is for the research one." So:

- **Crownring = the hub + frames.** Map: n1 Delegates' Concourse
  (start, center) → four wings (gallery + guard node each): n2/n3
  Pyreguard, n4/n5 Rimeguard, n6/n7 Stormguard, n8/n9 Shardguard;
  n10 The Summit Floor = THE ENVOY, `req` all four wings (my call,
  flagged to the user: keeps the shipped Envoy as the fight the guards
  were barring — veto welcome); n11 final = THE CONCORD, req n10;
  n12 Eastgate Relay side uplink. Frame lore = HIJACKED ceremonial
  guard chassis (machines taken — NO DNA splicing; fusion is
  Lumenspire's theme only). Concord = the hive's copy of the alliance;
  debrief escalates the imitation arc (machines → institutions →
  politics). Rotation labels are "motions" now (Pyre/Rime/Storm/Shard),
  drawer row "Next motion".
- **Key renames** (bestiary kills preserved via v9 migration):
  immolant→pyreguard, drowned→rimeguard, conduit→stormguard,
  ossified→shardguard, communion→concord. SAVE_VERSION 9 also drops
  stored shallowhelm AND crownring runs (node ids changed meaning).
- **Shallowhelm restored**: the original fortress map (Power Vault →
  Purge Antechamber/Core → Gatehouse chain) with THE RELIQUARY back as
  its final (v2.11 design: ward purge spares held ground, anoint
  erosion), acolytes now ZEALOTS (addN 3), and the congregation waves
  kept (zealot/lector/choirwarden via op.foes). Fortress lore rewritten
  to fold the cult in without the frames.
- **Lumenspire untouched** — the Aperture human/DNA fusion from v2.12
  is exactly where the user wanted it.
- **Balance after the reshuffle** (escort species mattered as much as
  hull): pyreguard 53, rimeguard 63, stormguard 47 (hp 56, burrower
  escort), shardguard 58 (markN back to 1 — the crawler/burrower breach
  pool is far meaner than the old zealot/lector one; 2 marks = 20%),
  envoy 50, concord 45, reliquary 53 (hp 70, 3 zealots per discharge;
  zealot acolytes are much softer than husks — hull had to carry more).
- Tests: bosstest shape = 6 finals + 5 node-placed (guards + envoy),
  Summit Floor gating, Concord-after-Envoy; reliquary guards restored;
  maptest G/H swapped to the new/old maps. Browser-verified all three
  surfaces (cr-map/cr-pyreguard/cr-concord/sh-reliquary shots; seeds
  in scratchpad v13profile.json/mkv13seed.mjs).
- MY CODEC DRAFTS for proofread: 4 guard briefs, Concord brief +
  debrief (new), Reliquary brief/debrief (restored v2.11 text),
  Aperture rewrite (v2.12). The Envoy's shipped text still stands.

## v2.14 — the Aperture leaves the lens

User: "change the aperture fight to something more human and hive
creature." Chose "it leaves the lens" from three offered shapes.

- Phase 1 unchanged (beam sweep + husks) except the p2 FAN IS GONE.
- phaseFlip → apertureUnbind(): body contracts to the middle lens cell
  (1 proxy), beam nulled, `G.boss.grace = 1`. Freed cells stay 'e' and
  flip naturally (deliberately no rubble — an 'x' at col 6 could stall
  enemy lane movement forever).
- The grace beat: the first unbound tick does nothing — one scripted
  human moment ("It stands where the lens was and looks at its hands"),
  deterministic, once.
- apertureStalk(): up to stalkMv (2) steps toward the nearest unit
  (closes the wider axis first, sidesteps when blocked, never crushes —
  steps only into empty cells), then claws ONE adjacent soldier for
  clawDmg (3), weakest first. Husk scream cadence continues in p2.
- Drawer: p2 shows Stalks/Claw rows; the Beam row disappears with the
  beam. New sprite: a walker with the lens for a head, so one map reads
  as the array mounted and the creature unbound.
- Balance: rework landed at 30% (the 1-cell unbound body starves area
  weapons and the clock bites; losses split breach-leak/clock-out).
  hp 52→42 + clawDmg 4→3 → 45% at n=60. Note for tiers work: a boss
  that SHRINKS its footprint mid-fight effectively gains armor against
  area decks — remember this lever.
- bosstest: fan guards replaced with contract-to-1/grace/closing-
  distance/claws-weakest-only guards. Bestiary d/counter updated
  (draft — user proofreads via the script doc).

## v2.15 — the Envoy takes the finale; THE CONCORD goes on the shelf

User: "can we save concord for something else down the line and keep the
envoy as the final boss." Done:

- Crownring is now exactly the user's hub shape: concourse start, four
  guard wings, and ONE final — the Summit Floor (n10, role final, req
  all four wings), where THE ENVOY sits. Envoy lost its `sub` flag
  (bossForOp finds it); n11 removed; SAVE_VERSION 10 strips 'concord'
  unlocks and resets stored crownring runs.
- Concord runtime removed (concordTick/carryMotion/MOTIONS, hymn state,
  Next-motion drawer row, glyph, sprite). The elemental helpers
  (elemBurn/elemFreeze/elemJam) stay — the guards use them, and a
  revived Concord would too.
- Envoy balance unchanged (50% at its last 60-run probe — the fight
  itself did not move).

### SHELVED FOR LATER: THE CONCORD — full design archive

The fused-guards rotation boss, fully built and tuned (55% bot win at
84 hull as a crownring final), pulled at the user's request to return
"down the line" — candidate futures: a late-campaign seventh operation,
an Onslaught super-spike, or the endgame reveal of the imitation arc
(machines → institutions → politics → ...). Mechanics: eruptMarks/
markBreaches + elemental helpers still live in boss.js; a revived
concordTick needs ~30 lines (rotation index on G.boss, one motion per
turn, two after the flip). Everything needed to restore it verbatim:

```json
{
 "bossdef": {
  "op": "crownring",
  "hp": 84,
  "w": 2,
  "h": 2,
  "l": 1,
  "c": 6,
  "turns": 18,
  "fireDmg": 4,
  "freezeN": 2,
  "jamN": 2,
  "markN": 2,
  "breachDmg": 3,
  "breachPool": [
   "burrower",
   "crawler"
  ],
  "escort": "burrower",
  "escEvery": 2,
  "p1": "In session — one motion per turn: pyre, rime, storm, shard, in rotation",
  "p2": "Unanimous — two motions per turn",
  "bt": "UNANIMOUS",
  "bb": "Four chassis, one body, no debate left in it. It carries two motions at once now.",
  "brief": {
   "freq": "141.95",
   "net": "残心ネット",
   "cap": "Kill Order · Priority target briefing",
   "from": {
    "n": "Hikaru",
    "r": "CC Liaison"
   },
   "beats": [
    {
     "say": [
      "Commander... the Envoy is dead and the readings from the Summit Hall got worse.",
      "The four guard chassis are moving. Not walking — being drawn. Everything the Envoy studied from that chair is assembling on the floor it held, and the wards keep logging one word for it: CONCORD."
     ],
     "reply": "Four of them in one body."
    },
    {
     "say": [
      "Four hijacked Frames, one mass. It has everything you already fought in the wings: the Pyreguard's lane, the Rimeguard's cold, the Stormguard's arc, the Shardguard's breaches — one motion per turn, in rotation, and the rotation is readable. The wards telegraph the next motion. Use that.",
      "You have fought every motion it can carry, Commander. It has never fought anyone who survived all four."
     ],
     "reply": "And when it's done?"
    },
    {
     "say": [
      "Then the Summit Hall is ours, the delegations reconvene under their own roof, and the hive's copy of our alliance dies on its floor.",
      "One more kill, Commander. The chamber is waiting on your descent."
     ],
     "reply": "Calling the vote. Out."
    }
   ],
   "close": "Channel closed. Final target: THE CONCORD. Read the next motion.",
   "go": "Begin descent"
  },
  "debrief": {
   "freq": "141.95",
   "net": "残心ネット",
   "cap": "After-action · CC uplink",
   "from": {
    "n": "Hikaru",
    "r": "CC Liaison"
   },
   "beats": [
    {
     "say": [
      "The Summit Hall is a ruin twice over, Commander — and it is ours twice over. The delegations reconvene under their own roof next month. That sentence exists because of you.",
      "Central's first pass on the Concord wreckage settled the argument the Envoy started. It did not fuse those Frames to fight you. It fused them the way the Concordat fuses factions — a body of members, speaking in turns. It was not building a weapon, Commander. It was practicing being an alliance."
     ],
     "reply": "First our machines. Then our institutions. Now our politics."
    },
    {
     "say": [
      "In order, and faster each time. Central's analysts will not say aloud what comes after politics, but the task group studying it has been widened twice this month.",
      "The alliance holds. The line holds. Whatever is directing these things now knows our unity is a weapon — because it tried to build one. Get some rest, Commander."
     ],
     "reply": "One for the many. Out."
    }
   ],
   "close": "Channel closed. The Concordat holds — the copy did not.",
   "go": "Close channel"
  }
 },
 "hostile": {
  "n": "The Concord",
  "t": "boss",
  "boss": 1,
  "hp": 84,
  "dmg": 0,
  "threat": 0,
  "spd": 0,
  "d": "Four hijacked honor-guard Frames drawn into one mass on the Summit Hall floor — the hive's working copy of the alliance it studied. One motion per turn, in rotation: the pyre's lane, the rime's cold, the storm's arc, the shard's breaches.",
  "counter": "The rotation is readable and the wards telegraph the next motion — position for the one that is coming, not the one that just ended. At half hull it stops taking turns."
 }
}
```

## v2.16 — SUBJECT ONE takes Lumenspire; THE APERTURE goes on the shelf

User: "shelf aperture and create a new boss based on the human and DNA
hybrid." Chose "the splice comes apart" from three offered hybrids
(over copy-your-soldiers and infection designs — both still good seeds).

- **SUBJECT ONE** (key 'subject', hp 50, 2×2, turns 18): the division's
  volunteer. Whole: walks its footprint one cell toward the nearest
  soldier each turn (never onto occupied cells — an early cut crushed
  the adjacent soldier every turn, an unintended instakill; now the
  strike is the threat) and hits everything orthogonally adjacent for
  strikeDmg 2; husk scream every addEvery 3.
- **THE SPLICE COMES APART** (half hull): two 1-cell halves, each with
  `role` on the body ('human'/'hive'), each ceil(remaining/2) hull. The
  human half spawns at the deepest free cell and FLEES (fleeMv 2, steps
  that maximize distance) while mending the hive half mendN 3/turn; the
  hive half hunts (huntMv 2) and claws the weakest adjacent for
  clawDmg 3. Kill the human half first and the mending stops — but the
  hive half enrages: +1 step, +1 claw. Both must die.
- Engine: shared `stepBody(body, away)` for 1-cell chase/flee steps;
  `beam`/aperture fields dropped from G.boss seed; beamwarn CSS and
  board telegraph removed with the Aperture.
- Balance: 37% at hp 56 (clock losses chasing halves) → hp 50 → 52%
  at n=60.
- SAVE_VERSION 11 strips 'aperture' bestiary unlocks; the Lumenspire
  map is untouched so stored runs survive.
- Codec brief/debrief drafted in the established voice (the volunteer's
  unread name; "it worked twice"; research sealed) — user proofreads.

### SHELVED FOR LATER: THE APERTURE — full design archive

The lens boss, fully built and tuned twice (43% as the fan design,
45% as the leave-the-lens design at n=60). Pulled at the user's request
in favor of a more creature-forward hybrid; candidate futures: the
receiver of the spire's transmissions builds another lens somewhere
else, or an Onslaught spike. Its p1 beam telegraph needs the beamwarn
CSS + drawBoard lane wash back (removed this patch, trivial); its p2
stalk logic now exists generically as stepBody(). Restore verbatim
from:

```json
{
 "bossdef": {
  "op": "lumenspire",
  "hp": 42,
  "w": 1,
  "h": 3,
  "l": 1,
  "c": 6,
  "turns": 18,
  "beamDmg": 4,
  "add": "husk",
  "addEvery": 2,
  "p1": "In the lens — one lane marked, burning next turn",
  "p2": "Unbound — it hunts your nearest soldier, two steps a turn",
  "bt": "IT LEAVES THE LENS",
  "bb": "The lens shatters from the inside. What steps out of the wreckage was a researcher once — and it remembers how to run.",
  "brief": {
   "freq": "141.92",
   "net": "残心ネット",
   "cap": "Kill Order · Priority target briefing",
   "from": {
    "n": "Hikaru",
    "r": "CC Liaison"
   },
   "beats": [
    {
     "say": [
      "Commander. The Lumenspire research division was working on focused-energy transmission when Meridian City fell. The spire is still transmitting — but not to anywhere on our grid.",
      "Something is using the array as a body. We are designating it: THE APERTURE."
     ],
     "reply": "Using it how?"
    },
    {
     "say": [
      "It burns a full lane of the grid at a time. The one mercy: the targeting is mechanical — it locks its firing line a full cycle before it fires, and it sweeps in order.",
      "Read the light, Commander. The lane it marks is the lane it burns. Do not be standing in it when it does."
     ],
     "reply": "And the researchers?"
    },
    {
     "say": [
      "The dorms went dark before your descent window opened. I'm sorry, Commander. The families have already been told.",
      "There is one more thing, and you will not like it. The probes pulled a tissue return off the lens housing. It reads HUMAN — spliced through with hive DNA. One of the researchers made it out of the dorms, Commander. Into the machine."
     ],
     "reply": "...Understood. Out."
    }
   ],
   "close": "Channel closed. Target designate: THE APERTURE. Read the light.",
   "go": "Begin descent"
  },
  "debrief": {
   "freq": "141.92",
   "net": "残心ネット",
   "cap": "After-action · CC uplink",
   "from": {
    "n": "Hikaru",
    "r": "CC Liaison"
   },
   "beats": [
    {
     "say": [
      "Confirmed kill, Commander. The spire is dark for the first time in six months.",
      "The lab data fills in the rest. The division's last project was not the lens — it was surviving the lens. Hive DNA spliced into a volunteer, so a human mind could fuse with the array and aim it. The hive did not build the Aperture, Commander. We started it. The hive only finished."
     ],
     "reply": "Does the family get told?"
    },
    {
     "say": [
      "That decision is above both of us, and I am glad of it.",
      "One loose end: the spire transmitted continuously, right up until your kill — and we cannot find the receiver. Somewhere in the system, something now knows how to build that lens, and what to put inside it. Stay sharp, Commander."
     ],
     "reply": "Acknowledged. Out."
    }
   ],
   "close": "Channel closed. Receiver location: UNKNOWN.",
   "go": "Close channel"
  },
  "stalkMv": 2,
  "clawDmg": 3
 },
 "hostile": {
  "n": "The Aperture",
  "t": "boss",
  "boss": 1,
  "hp": 42,
  "dmg": 0,
  "threat": 0,
  "spd": 0,
  "d": "What is left of a Lumenspire researcher, spliced with hive DNA and fused through the transmission lens — a human nervous system with an array for a body. It marks a lane of the grid and burns it a cycle later. Hurt it enough, and it tears itself out of the lens and hunts.",
  "counter": "While it is in the lens, read the light: the marked lane burns next turn, in an ordered sweep that reverses at the edges. At half hull it leaves the lens, and the fight becomes a hunt — it stalks your nearest soldier and claws the wounded first. Keep arm's reach clear and kill it in the open."
 }
}
```

## v2.17 — boss plating (the anti-swarm tax)

User diagnosis, confirmed by the numbers: boss threat was flat per turn
while player damage scales linearly with units fielded, so massing
cheap guns trivialized every boss except the Prism (whose reflect
scales with throughput — the proof case). Chose plating over raw
hp/dmg buffs and over scaling retaliation.

- **Mechanic**: `def.plate` (1 on every boss except prism: 0 — crystal
  reflects, it does not armor). Applied in dmgBoss AFTER shield
  absorption: `dealt = max(1, dealt - plate)`. Shields absorb untaxed
  (the field is energy; the plating is under it). Reflect still reads
  the RAW hit. Min 1 always lands.
- **Why not the other levers**: raw hull/dmg lengthens fights against
  the fixed 18-turn clock, which punishes small squads more than the
  flood; scaling retaliation needs per-boss design + telegraphs (still
  a good tier idea). Plating is one line and self-explaining.
- **Re-tune** (bot floods, so bot rates crater hardest — the plating
  pass deliberately lands the whole roster in a harder 35-48 band vs
  the old 45-60): hulls cut to re-fit the taxed throughput. Final:
  gantry 30 hull/shield 20 (38%), brood 28 (38%), prism 56 unplated
  (42%), subject 34 (43%), envoy 24 (35%), pyreguard 26 (48%),
  rimeguard 42 (43%), stormguard 38 (48%), shardguard 36 (45%),
  reliquary 60 (40%). Journey: plating at old hulls gave 0-33% —
  clock losses everywhere; two cut rounds + the prism/gantry special
  cases got the band.
- UI: seed log line "plated — armor shrugs N off every hit"; drawer
  Plating row. New bosstest plating guard (5 lands 4, 1 lands 1,
  shield absorbs untaxed); gantry blast + prism flip math re-derived.
- TIERS NOTE: plate is now a per-boss data knob — Veteran/Zanshin can
  raise it (plate 2 taxes even area blasts meaningfully).

## Boss-buff experiment (pending verdict) — the doubles test range

User asked to double Brood/Subject/Envoy hulls and set Prism 76, then
see data. Measured (bot, n=60, loss modes attached in session):

| config | brood | subject | envoy | prism |
|---|---|---|---|---|
| v2.17 shipped (28/34/24/56) | 38% | 43% | 35% | 42% |
| doubles @ 18t (56/68/48/76) | 2% | 0% | 2% | 25% |
| +50% @ 18t (42/50/36) | 3% | 8% | 18% | — |
| doubles @ 24-turn siege | 2% | 20% | 25% | — |

Key findings: plating makes hull a razor lever (taxed bot lands
~2.5-3.5 hull/turn → ~45-55 hull is the 18-turn ceiling); longer
sieges rescue Subject/Envoy but FEED the Brood (her tendril/crush/
breach kit scales with every extra turn — 2% at any clock).

Shipped in this commit (safe, no balance change): per-boss clocks
(`BOSSDEF[k].turns` now sets G.waves at seed — all 18 today) and
data-driven prism test math. NOT shipped: the doubled values — they
live in the published "Gridfall Test Range" artifact
(claude.ai/code/artifact/c2288eee-ac3c-4a19-9e5c-e227d8be165a), a
self-seeding test build with the user's requested deck (mortar, rifle,
hecate, railgun, pathfinder, exo, hell+dropod, assassin, samurai,
pilot + sevenblades/armblade, FIREBRAND) across three profiles
covering all ten bosses. Rebuild it via scratchpad
mktestseed.mjs + the localStorage-seed wrapper. Recommendation on the
table: prism 76 · subject 68@24t · envoy 48@24t · brood probed into
the same 20-25% band (~38-40 @ 22t). Waiting on the user's verdict
for v2.18.

## v2.18 — bulkheads (the anti-burst ceiling)

User playtested the Test Range doubles with an optimized burst deck
(mortar/hecate/railgun/dropod/sevenblades+armblade, FIREBRAND) and
killed EVERY boss in under 6 turns — including 68-hull Subject One.
Confirms: no hull number fits both audiences (bot 0% at doubles, top
deck 6-turn kills at doubles). Hull answers chip; it cannot answer
burst.

- **Mechanic**: `def.bulk` — max hull a boss can LOSE per turn, applied
  in dmgBoss after plating; the rest of the volley glances off ("The
  bulkhead seals" log, once per turn; drawer row shows max/turn and
  SEALED state). Shield damage uncapped (the Gantry collapse decision
  stays one swing). Reset on bossTick. Weak decks never touch it.
- **Values** (hp/bulk): gantry 30/5, brood 28/5, prism 56/10 (regen vs
  cap needs the headroom), subject 34/5, envoy 24/4, reliquary 60/8,
  pyre 26/4, rime 42/6, storm 38/6, shard 36/6.
- **The real guard is the speed-kill floor** (bosstest): simulate
  UNLIMITED damage per turn; assert every boss survives ≥6 turns and
  still dies ≥4 turns inside its clock. Measured floors: gantry 6,
  brood 6, prism 11, envoy 8, reliquary 8, guards 6-7, subject 8.
  Bot-independent — this is the guard that actually encodes the
  user's complaint. Mechanic test blocks run with bulk zeroed
  (bulkOff/bulkOn in bosstest) so exact hull math stays testable.
- **Bot band after bulkheads**: 18-38% (gantry 18, brood 28, envoy 38,
  subject 33, reliquary 28 at n=40) — the deliberate "difficult"
  setting per the user's verdict. Gantry lost the most (breach-flood
  losses, not clock) — watch it if early-game feels like a wall for
  NEW players; bulk is not its lever, fabricant ramp is.
- Tiers note: `bulk` is per-boss data — tiers can lower it (crueler
  ceiling) alongside plate.

## v2.19 — boss damage +~50% (user order, on top of bulkheads)

gantry cellDmg 2→3 · brood tendril 2→3, breach 4→5 · prism reflect
.25→.35 · envoy adjDmg 2→3 · reliquary purge 5→6 · subject strike 2→3,
claw 3→4(+1 enrage) · pyreguard fire 3→4 · rimeguard chill 3→4 ·
stormguard arc 1→2 · shardguard breach 4→5. Damage assertions in
bosstest now derive from data (reflect %, barrage cells×cellDmg).

Bot band after the raise: gantry 28, brood 23, prism 23, envoy 40,
reliquary 38, pyreguard 8(!), rimeguard 28, stormguard 45,
shardguard 45, subject 18 (n=40). Pyreguard is the outlier — a 4-dmg
lane burn every turn shreds the bot's packed lanes; a human who reads
the march eats far less of it, but if the user reports it as a wall,
fireDmg or hull is the lever. Speed-kill floors unchanged (damage
does not move them). The user calibrates by hand via the Test Range;
bot numbers recorded for the tiers work.

## v2.20 — four-boss redesign (user's spec, verbatim)

The user's redesign of four fights, applied as ordered:

**Prism scatter + resonance.** On shatter the 3 shards no longer stay
put: `prismShatter` places 2 via `freeIn(0,2)` (player half) and 1 via
`freeIn(4,6)` (seam). One shared hull as before. New weapon in phase 2:
each shard resonates every `prismTick`, hitting every soldier within
Chebyshev distance 1 for `fragDmg` (2). Data: `fragments:3, fragDmg:2`.

**Brood tendril = row OR column.** `broodTick` flips `randInt(2)`:
lash a full lane row or sweep a full column, `tendrilDmg` 3 either way
(user asked for "maybe lower to 3" — it was already 3 from v2.19, kept).

**Subject One: no clock, duet escalation.** `turns:0` in data →
`seedBoss` sets `G.waves=999`; mission/phases/objective text all carry
"no clock" variants. Kill the hive half → human half SNAPS: `B.snap++`
each turn, move `min(6, huntMv+snap)`, claw `clawDmg + snapStep*snap`
(unbounded — the user asked for exponential-feeling growth; linear per
turn with no cap reads that way in play). Kill the human half → hive
half's storm widens to radius `aoeR` (2) and stuns survivors. Either
solo survivor left standing `reviveEvery` (5) turns knits back to FULL
hull (`soloBeat`). Data: `turns:0, reviveEvery:5, aoeR:2, snapStep:2`.

**Gantry shield 24→30** — "allow for manufacturing of enemies to
surface": one more full barrage of chew time.

Bot band after (n=80): gantry 29, brood 21, **prism 0(!)**, envoy 31,
reliquary 40, pyreguard 8, rimeguard 25, stormguard 44, shardguard 45,
subject 25 (avgTurns 42 — no clock, so fights run long; "other" losses
are the sim's turn cap, not a bug). Prism 0% is a bot blind spot, not
a softlock: the two player-half shards sit behind the bot's firing
lines and resonance chews its packed soldiers, but the shared hull is
fully killable through the seam shard — a human retargets, the bot
can't. All 80 losses are clock, none breach. If the user reports it as
a wall in hands-on testing, levers are: hp 56 down, fragDmg down, or
scatter bands shifted toward the seam. Awaiting Test Range verdict.

Speed-kill floors (unlimited-damage sim): gantry 6, brood 6, prism 9,
envoy 8, reliquary 8, pyre 7, rime 7, storm 7, shard 6, subject 8 —
all ≥6, guard in bosstest holds. New bosstest guards: shield-30 blast
containment, scatter placement bands + resonance, subject duet
(storm+stun, snap escalation, knit-to-full, no-clock), run bulk-zeroed
via bulkOff()/bulkOn() so mechanic asserts aren't masked by bulkheads.

## v2.21 — Prism lance shard; Subject One charges (user's spec)

Follow-up to the v2.20 redesign, from the user's playtest notes.

**Prism: walls + lance.** `prismShatter` now marks roles: two `wall`
shards, each placed in a random band — player side `[0,2]` or middle
`[3,4]` — and one `lance` on the hive side `[5, COLS-1]`. Resonance
(Chebyshev-1 burn, `fragDmg`) is walls-only. The lance fires `javN`(2)
crystal javelins a turn for `javDmg`(2) at random soldier squares
ANYWHERE on the board — the walls are literally what it hides behind.
Kill the lance body and the javelins stop; the shared-hull kill path
through any shard still stands. Data adds `javDmg`/`javN`; `p2` text
updated (it still said "four fragments" from the pre-scatter era).

**Subject One: the charge.** The solo human half no longer walks with
a capped `min(6, huntMv+snap)` move — `chargeBody()` picks one of the
four straight lines, slides until a wall/terrain/body ends the run,
and if a soldier ended it, that soldier is hit the SAME turn for
`clawDmg + snapStep*snap`. A line ending in a soldier always wins
(nearest first); with no soldier in line it takes the slide that best
closes on the nearest one, lining up next turn. **Diagonal whiff
fixed** on the hive half: the duet claw is now Chebyshev-1, so a hive
half penned in by bodies still claws the soldier on its corner —
this was the real "moves but doesn't attack" case (Manhattan step +
orthogonal-only claw left it stalled diagonal to its prey).

Bot band (n=80): prism 3% (up from 0 — javelins don't change the
bot's blindness to player-half shards; still awaiting the user's
hands-on verdict), subject 15% (down from 25 — the full-line charge
and corner claw bite the bot hard; breach losses 33/80). Both fights
sit below the 8–45 band on bot numbers; the user calibrates by hand.

New/updated bosstest guards: wall/lance roles + placement bands,
javelins hit soldiers clear of all shards, javelins stop when the
lance dies while resonance continues, corner-claw (penned hive half
claws the diagonal soldier), aligned charge crosses the full lane and
deals escalation-1 damage same turn, escalation-2 on the next.

## v2.22 — the Envoy chess court (user's concept change)

The dive/surface Envoy is GONE, replaced wholesale per the user's spec:
"prepopulate the map with enemy units based on a chess board... envoy 1x1
and act as king piece... phase two is against envoy full health again with
the 4 frames fought against previously."

**The court.** `envoyFormation` (called from seedBoss) deploys the back
two columns: back rank col 7 = knight/bishop/KING(l2)/queen/bishop, pawn
screen col 6. All are bodies of the one boss with `role` set; `pieceSpot`
finds the nearest free cell when a map blocks a seat. Per-piece data:
pawnHp6/pawnDmg2, knightHp10/3, bishopHp10/3, queenHp14/5. King keeps
adjDmg 3 as an 8-square (Chebyshev) censure every turn.

**Chess movement.** `pieceMoves` implements real rules on 5×8: pawns
advance toward the player and take diagonally only; knight L-jumps over
anything; bishop diagonal rays; queen all eight rays; sliding pieces stop
on the square before a surviving target and take the square on a kill.
`envoyMove` plays ONE move per boss turn: a strike outranks any advance
(hardest hitter takes it), otherwise the move that best closes on the
nearest soldier, queen deprioritized as a scout.

**Engine hooks.** `def.kingFlip` exempts the envoy from the generic
half-hull phase flip; the flip fires in dmgBoss when the KING body dies
in phase 1 (`envoySecondSession`: pieces removed, king restored to FULL
hull, four throne bodies pyre/rime/storm/shard at frameHp 12 seeded
around him). Only the king is bulkheaded (bulk 4) — pieces and thrones
take full volleys, or thinning the formation would take all day. Phase 2:
two thrones act per turn in rotation (`frameAct`), each reusing its wing
fight's own numbers via the shared elemental helpers (elemBurn/
elemFreeze/elemJam/eruptMarks+markBreaches). Win = king AND all four
thrones down (engine default: bodies empty). Clock 26.

**Renderer.** Drawer hull bar/badge shows the KING's pool for kingFlip
bosses (formation carries its own); Formation/Thrones rows replace the
dead Dives row; board tiles render role'd bodies as piece glyphs
♟♞♝♛ / 🜂🜄🜁🜃 with names, king keeps the Envoy sprite. Roles outside
the map (prism wall/lance, subject hive/human) keep their sprites.

**Code check done with it:** dead `under`/`grace` fields removed from
the G.boss initializer (dive-era state; grace was orphaned even before),
old envoyTick dive/surface/escort code deleted, `diveEvery/escort/
escortN` dropped from data, bestiary d/counter rewritten, dive drawer
row removed. Bot band: envoy 1% (n=80, 79 clock) — the bot cannot
finish two boss fights in 26 turns; speed-kill floor is 12, so a burst
deck has 14 turns of slack. Levers if the user calls it a wall: turns
26→30, frameHp 12↓, or pawnHp down. Codec brief/debrief still describe
the dive era — user-owned story text, flagged for their pen.

## v2.23 — boss telegraphs on the board

Bosses now honour the same promise contract as spawns and breaches: a
threat is pre-rolled a turn ahead and drawn on the grid before it lands.

**The plan.** `G.boss.plan` holds pre-rolled threats. broodTick lands
`plan.lash` ({axis:'row'|'col', i}) then re-coils over current unit
lines; prismTick lands `plan.jav` (array of [l,c] squares) then re-aims
at unit squares. Both damage *whoever stands on the promised ground now*
— vacate and the blow misses, exactly like a breach mark. Both log the
wind-up ("The mass coils…", "The lance takes aim…") so the descent log
carries the promise too.

**bossWarnCells()** returns the promised cells (brood line, prism
javelin squares, pyreguard's burning lane) and drawBoard paints them
`.bosswarn` — a quiet striped magenta wash with a slow pulse, one z
under breach marks so a hot breach still outranks a whole coiled column.

**bossSelThreat(e)** answers foeThreatCells for boss proxies (forecast.js
routes `e.boss` to it), per role: chess pieces show pieceMoves ground
(prey = strike, reachable = threat), the king shows his 8-square censure,
wall shards show the resonance ring in phase 2, the hive half shows storm
ring or claw ring by phase, the charging human shows every chargeRuns
path (refactored out of chargeBody so both read the same lines), pyre
thrones and the pyreguard show their lanes, the reliquary shows the
ground purge will burn. Selection preview and tick stay mirrored — the
forecast.js discipline now extends to every boss.

**Tests.** broodtest rewritten for aim-then-land (breach only on turn 1,
lash on 2, vacate-misses guard), prism javelin test likewise (aim, land,
square-not-soldier guard), plus preview guards: knight/king moves, human
charge lines, pyreguard lane. Full suite + 6 randomized boss runs green;
speed-kill floors unchanged (telegraphs shift *information*, not
numbers).

## v2.24 — the board-control card batch

Items 1–4 of the card backlog below, shipped as four tech cards (pool
66→70). Each rides a rule the game already enforces, so the diffs are
small and the flags are data:

- **Demo Charge** (`demo`, instant, crater:1 blastDmg:3). validTiles
  gained a crater branch (any open tile, no bodies, no crystal/uplink);
  playInstant now takes (l, c) and carves the same permanent 'x' a Hull
  Breach does, after a 3×3 blast. The horde's own reroute rules do the
  rest — a crater you place is a lane you steer.
- **Cryo Projector** (`cryo`, chill:1). `chillFactor(lane)` in combat.js
  (0.5, non-stacking, beside dampenIn) multiplies the movement DEPOSIT in
  actHostile — banking preserved, so a chilled Crawler crosses every
  other turn and a Hulk needs four. Mirrored in enemyIntent and
  foeThreatCells.
- **Resonance Lens** (`lens`, lensBoost:2). `lensBonus(u, e)` adds the
  boost of every lens strictly between shooter and mark in their shared
  lane, applied per-target in fire(). Not a blocker, so it never cuts
  the beam it amplifies. supportTargets lights the armed friendlies
  behind it.
- **Field Degausser** (`degausser`, degauss:1). One line at the top of
  laneFloor(): a degausser in the lane returns 0 — innate floors and
  pylon lanefloors both stripped. influenceCells now washes chill and
  degauss lanes violet like dampen.

mkUnit carries the three new flags; focus.js gained four stat rows;
kanji 爆凍凸消 and four pixel tokens (pixtest demands full coverage,
instants included). New guard `fieldtest` covers all four plus the
highlight wiring; run-all runs it after flanktest.

Flake fixed while shipping: the gantry ramp guard let fabricants pile up
across ticks, and summonAdds rolls a random lane per body and fizzles
when that lane is full — turn 4 could legitimately come up short. The
loop now clears non-boss enemies before each tick, so the ramp is a
measurement again.

## v2.25 — pro/con leads (user's leadsv2 spec)

Implements the uploaded `leadsv2.json` revision: ten leads, every
non-starter carrying a con, so a lead pick is an archetype pick. The
spec's own rule — "a downside must be answerable by deckbuilding, never
by luck" — is now a leadtest guard (only Ironbrand may be clean).

**Adaptations from the spec, flagged for the user:** (1) Frames exist
here, so Ironwright ships now rather than being held; "machines" =
anything with a chassis, so the exo suits share her discount and dodge
her ban. (2) Wildfire (active-only) is cut per the spec's ten; her
`requisition` stratagem passes to Coronet, whose economy it fits. The
`p.lead` fallback in migrate() hands Wildfire commanders to Ironbrand.
(3) The spec's suggested achievement gating is NOT adopted — leads stay
Quartermaster store goods (the system task #12 built); Coldwire joins
the counter at 300 cr and migrate() v12 grants her to existing profiles
from the free era. New-lead bios are my drafts — user's pen may want
them.

**Mechanics, by knob (all data-driven off the lead object):**
- `deckCap` (coronet 9, quartermaster 8) → `deckCapOf()` in
  progression, enforced at launchSpec (loud refusal), Squad bar +
  warning, focus add-to-deck, card-html foot, pack auto-add.
- `dpMod` (+2 coronet, −2 riptide) → launchSpec turn-1 dp and endTurn
  refresh, floored at 1.
- `drawBonus` (quartermaster) → endTurn draw loop (2+1).
- `banTier` / `banNonMachine` (coldwire / ironwright) → `leadBan(id)`;
  validTiles returns [] (dead in hand, greyed with a tooltip), Squad
  lists refused cards in red.
- `minCol` (quietstep 2) → validTiles filter on body-landing branches;
  instants and attachments exempt.
- `frameDiscount`/`pilotHull` (ironwright) → costOf / mkUnit.
- Skunkworks con and Firebrand's Exposed key off passive/con names:
  mkUnit thins commons −2 (floor 1); dmgUnit adds +1 before dampen.
- Lone Edge ±: leadBonus alone +3 / adjacent −1 (a 1-dmg unit still
  lands 1 via the dmgEnemy floor — the con can't zero a weapon).
- Riptide move-and-fire = the servo path generalized in doMove; the old
  repositioned-damage-reduction passive and its `u.repositioned` state
  are deleted.

**Probe** (bot, one 8-card deck legal under all ten, n=200/lead):
ironbrand 73 · coldwire 76 · firebrand 74.5 · quartermaster 74 ·
ironwright 69 · coronet 66.5 · quietstep 65.5 · loneedge 63.5 ·
skunkworks 60.5 · riptide 59.5. No trap picks; riptide's floor is the
bot never repositioning (its pro is invisible to it) and skunkworks' is
a common-heavy probe deck — both are the trade working, not a hole. The
spec's watch-items (riptide dominance in HUMAN hands, lone edge making
support cards genuinely bad) need play, not sims.

## v2.26 — the Frame rework (user's framesdeckleadspatch spec)

The Pilot is deleted and the Frame system rebuilt per the uploaded spec:
a Frame is a 5 DP Specialist card seeded into the opening hand (same
mechanism and reasoning as the stratagem), deployed on held ground with
a functional base weapon; its gear are nine 1 DP CARDS in the deck,
exclusive to their machine and dead in hand without it.

**Cards.** Protos: dp 6→5, new hulls (16/14/18), base weapons per spec
(WD vulcans 2 adj + regen shield, SB arm blade 4 adj + riposte 2 trait,
HA gatling 4 first, immobile). omni kept — established identity. Gear
cards: beamrifle/beamsaber/booster, greatsword/longsword/resonator,
lasergatling (tg wings — the TGNAME already read "both forward
diagonals, nothing in the centre")/missilegatling (cross3)/ammohopper.
The armoury's nine frame pieces are deleted; migrate() v13 refunds
every one at full price, plus the Pilot's 70 cr, and hands Ironwright
commanders to Graham.

**Rules.** frames.js is the system now: seedFrame pushes loadout.frame
into G.hand at launch (G.frame just marks the mission carries one);
frameGateText gates a second Frame (one on board at a time) and absent-
frame gear — routed through validTiles beside leadBan, so dead-in-hand
falls out of the machinery the leads already built. applyFrameGear
mounts: weapon replaces tg/dmg/single (riposte = frame trait + weapon
rider, so Seven Blades keeps its temper under any sword), support adds
boost (2-cell strides in moveTargets + servo), twin, resonate (+1/adj
hostile at fire time). Reserve cycling can never re-deal the machine —
it was never in loadout.deck.

**The two Frame leads** (roster 9→11; both ship per the spec's "both is
fine"): salvagerights — Rushed Assembly halves proto hull at mkUnit
(ceil), salvageFrame() in the dmgUnit/pierceUnit death path returns
machine + kit to hand (still counts as a loss); fieldrefit — Single
Mount enforced inside applyFrameGear: anything carried returns to hand
(the pro paying for the con), the swap sets u.acted. Lone Edge's person
is CAINE now; Graham moved to the Frame chair. fieldrefit's spec colour
#5dffa0 collided with Skunkworks — shipped as #66e0c2, flagged.

**Everything deleted:** isPilot, frameAnchorFor, frameCells, ejectPilot,
frameWeapon, isMissionFrame, setPilotName/pilotName (the callsign
feature died with the card), the offdeck proto hand tile (the Frame IS
in the hand now, wearing the .proto rail), deck.js's pilot filter.

**frmtest** (arms rebuilt: control / bare frame — deck-free now — /
frame + two gear cards for two spine slots; n≈380/arm): control 50.4,
bare −1.1..−3.4, kits −5.9..+0.4. Frames land 100% of missions (the
Pilot era's failure mode, gone). The spec's open question — is losing a
kitted Frame correctly brutal or unplayable — is Graham's to answer in
real hands.

## v2.27 — command calls are cards (user's direction)

"Remove all stratagems ability from team leads and convert them to tech
cards. for breaching charge, make a horizontal version as well. for the
weapons for frames, they should be tech if not gear."

**The conversion.** Every lead's `stratagem` field is gone (leadtest
guards the badge shows no CALL tag). The six calls are tech cards
(`strat: '<key>'`, dp from the old def floored at 1, priced 190-260) and
a seventh joins them: `enfilade`, the lane-axis Breaching Charge. The
`refit` stratagem was renamed **Field Restoration** — its old name,
Field Refit, is Kaede's lead passive now and two things must not share
it. Pool 78→85.

**The engine kept its soul.** stratagems.js still owns the prediction
contract — arm on play, telegraph, land on the long beat (start of next
turn) or the demolition pair's short beat (end of this one). What
changed: `G.strat` (one seeded slot) became `G.calls` (a queue), so
several calls ride the air at once, each firing on its own beat;
`armCall(cid, l, c)` is the card's deploy branch, deriving the target
from the tap (unit / lane / column / none); seedStratagem, stratReady,
canPlayStratagem, playStratagem are deleted. validTiles gained a strat
branch (friendly → unit cells, banded → any open cell, none → held
tiles), exempt from Quietstep's minCol like the other non-bodies.

**UI deleted with them:** the stratSel state and its whole flow — the
offdeck call tile, the board-as-target-picker, the drawSel call panel,
the badge's CALL READY/SPENT tag — plus their orphaned CSS. A call now
plays exactly like a card because it IS one; the focus card carries
Call/Aim rows and a "Command call" chip. `G.leadUsed` (the old
once-per-mission latch) retired.

**Gear re-tier:** the nine frameGear cards are t 'tech' (+tech flag).
Side effect noted in the patch notes: Coldwire's banTier no longer
catches them (harmless — she can't field the Frames they fit).

stratagemtest rewritten for the card contract (shape, arm-then-fire,
both beats, enfilade, a two-call queue, duel, requisition);
grapple/breach harnesses moved onto the card path; kanji 決復潜砕掃鎖徴
and seven call tokens for the coverage guards.

## v2.28 — achievements catch up (+ the roster identity passes)

Eight badges for the new systems, all obeying the list's founding rule
(pure functions of the save — usage and unlocks only, no new counters):
Machine Spirit / Rollout Complete / Ace of the Line (proto usage),
Closed Kit (a frame's three gear cards owned), Gunsmith (gear usage 15),
Fire Mission / Full Spectrum (call usage, first and all seven), Ground
Writer (the four board-control cards owned). 24→32; achievetest's three
arms (fresh earns none, maxed earns all, old saves don't crash) pass
untouched — the maxed profile already owns every card and 200 uses.

Also this train, per the user's direction: Graham → Ace Pilot BUSHIDO
(blood red), passive renamed The Code; Kaede → CHIEF (orange);
Coronet → Ex-Commander, new bio, con renamed Efficiency Management;
Ironbrand's passive → Hardened Armor; Lone Edge → navy #3a5f9e.

## v2.29 — the navigation pass (user's direction)

Three moves, one idea: every screen gets exactly one menu entry point.

- **Combat**: the Abort secondary is a MENU button folding a `.cmenu`
  sheet up over the action bar — Abort mission, Main menu, Settings,
  UI/Music toggles, Patch notes. Abort keeps its stakes dialog (now a
  shared `abortStakes()`); Main menu confirms with the same stakes and
  lands on the hold via `exitToHold()`. When G.over the secondary is a
  one-tap Leave (the old behavior, kept deliberately). Selecting a
  card/unit/hostile folds the sheet away. The sheet reuses the
  drawmenu's visual language.
- **Modes/Ops/Map**: navfoot back buttons read just "Back" inside a
  `.navbtns` pair with a "Menu" button that drives the same global
  drawer (it literally clicks #drawtab); on navfoot screens the corner
  tab hides and the drawer rides up 66px clear of the footer, so there
  is never a doubled affordance. The corner tab is the HOLD's alone now
  (follow-up direction) — any future screen takes the footer Menu
  unless it genuinely has no room for one.
- **Hold**: #drawer moved from bottom-centre to bottom-right
  (right:14px, flex-end, sheet right-anchored).
- **Panels** (Squad/Quartermaster/Database/Record/Settings, follow-up):
  the shared panel footer carries Menu beside Close — Menu rightmost,
  matching every other footer — and an open panel hides the corner tab
  like every other non-hold surface. The drawer sheet leads with a
  "Main menu" row (hidden on the bare hold, where you already are), and
  combat's sheet dropped Abort — Main menu is the mission's ONE release,
  same stakes dialog, landing on the hold. Also: the
  slotless-card rule — kit cards, calls, instants, attachments (and
  Frames) take no armoury gear (gearFits + gearBlock + a migrate strip
  for old fitted pieces).

actbar.js rewritten for the menu flow (open/close/abort-inside/fold-on-
select/one-tap Leave); screenshot pass in scratchpad nav*.png. Same train: the Squad
reserve's "By class" tech section splits into Tech and Proto Frame
Tech, so the nine kit cards shelve apart from the field tech.

## Card backlog — the next pass

Not built. Recorded here so the next card batch starts from a list rather than a
blank page. Two sources: the lane-defence reference the brief pointed at, and
PvZ, which is the ancestor of the whole genre.

**Mechanics the game does not have yet, ranked by how well they fit the board:**

1. **Permanent cratering as a player tool.** A Doom-shroom analogue: an instant
   that turns cells to `'x'` for good. This was a blunt "stop" before v2.3 and is
   now a *steering* tool — you crater a lane to push the horde into your guns.
   The strongest synergy available with what just shipped, and the rules already
   support it.
2. **Slow / chill.** Nothing in the game costs a hostile tempo. With lateral
   movement in, slowing is spatially interesting rather than just arithmetic:
   the thing you slow is also the thing that reroutes.
3. **A conduit cell.** Torchwood: a friendly that amplifies any friendly fire
   passing through its cell. Fits a lane game exactly and nothing does it.
4. **Armour stripping.** Magnet-shroom: removes a hostile's damage floor.
   A direct counter to Hulk and Bulwark Pylon, which currently only Rail Sniper
   and `pen` gear answer.
5. **Coop attacks.** Two adjacent friendlies of a class firing as one. The
   reference calls this out as its own section; Gridfall has adjacency buffs but
   nothing that combines two units into one stronger action.
6. **Minimum range with self-damage.** A bazooka that is powerful at 3–6 and
   hurts its own line at 1–2. Gridfall has `hold` (a hostile stopping at range)
   but no player weapon with a dead zone.
7. **Stealth.** Not targetable until it attacks. Cheap to express — hostiles
   already pick targets through one search in `strike()`.
8. **A lane-spanning barrier.** Irisation: one deployment that shields three
   lanes rather than one cell. Aegis Knights shield a lane; nothing spans.

**Apply to every new hostile:** it needs an answer to the question the flank rule
now asks — does it cross lanes, and if so, why? `flank` is the flag; the Oni is
the worked example.

## Still open

1. **Crystals at a hot operation is better, not soft.** Auto-rolled Crystals
   nodes now cap at heat 1 regardless of the operation's own heat (see the
   entry below) — Crownring's went 26.7% → 33.0%, Shallowhelm's 23.8% →
   33.0% on a 600-run direct sample each. Real, but Crystals still sits at
   the bottom of the roster even at heat 0 (62-65%) against most other
   types' 50-90%, by design — four separate points is just harder to hold
   than one line. Nothing further planned unless it still feels wrong in
   play; the mission was always meant to be the hard one.
2. **No real card art yet.** The placeholder portraits stand in; the
   embedding pipeline is built and proven (see above) and waits on actual
   images, which replace a placeholder the moment they land in `CARD_ART`.
3. **Every win rate above comes from a near-random bot.** It never plans, rarely
   repositions and never uses manual targeting. Treat the numbers as floors.
4. **Forward Base is the riskiest of the new cards** — repair plus cooldown
   acceleration in the contested half props up Retake and Crystals directly.
   If it proves dominant in play, cut the cooldown half and keep the repair.
5. **`PACK_METER_GOAL` (3) is an untested guess.** If collection still races
   ahead or the drip now feels too slow, it's a one-line tune in
   `mission.js` either direction.
6. ~~Civilian Extract's heat scaling isn't monotonic yet~~ **Resolved by
   sampling, no code change.** The 30-runs-per-level number this was based
   on was noise. A 600-run direct sample per level (see below) actually
   steps down cleanly: 86%, 82%, 82%, 72%. Heat 0-2 is a shallow, sensible
   slope; heat 3 drops harder, mostly to breach losses (88 of 169 losses at
   heat 3, vs. 34 of 110 at heat 2) rather than the extraction goal itself.
   Left alone — Civilian Extract was always meant to sit on the easier end
   of the roster, and 72% at its hardest tier still comfortably clears that
   bar next to Crystals' 62-65% at its *easiest*.

Two things the structure now makes cheap:

- **More operations.** The map generator is data-driven — a new operation is an
  entry in `reference/gridfall-data.json` under `operations`, not code.
- **Cloud saves.** The save layer is versioned and sits behind `src/save/store.js`
  with a memory fallback. Swapping the backing store is the whole job.

## v2.30 — the balance pass

The roster was 85 cards on thirteen hull values and six damage values, with
twenty-one cards on 2 or 3 damage. A one-point difference is invisible in
play, and the card probe (random twelve-card decks, bot playouts, per-card
win delta) had already said so: the whole middle of the roster measured
within ±3% of itself. This pass snapped every unit onto two fixed ladders —
hull 2/3/5/8/12/18/24, damage 1/2/3/5/8 — and cut ten cards that were each a
weaker copy of a neighbour. `balancetest.js` now guards the ladders, so a
future card cannot land between rungs by accident.

**Cuts (85 → 75), all refunded at their sale price by the v14 migration:**
Knight (riposte moved onto the Bulwark, now 12 hull), Vanguard, Turret (the
Rampart inherits its starter slot and gets a real 2-damage rifle), Bio Medic,
Pulse Emitter, Suppressor, Lance Battery, Bore Lance, Supply Cache, Sapper
Turret. The Suppressor was also a bug: `dampenIn` returned a flat 1, so its
`dampen: 2` was never honoured. It now returns the strongest field in the lane.

**Pushbacks on the patch document, and why:** the Forward Base's `zoneMin`
is removed rather than tightened — it was the single worst card in the probe
(−27%) because it rotted in hand until you held column 3; the Shield gets two
charges rather than staying a one-hit card slot; the Medic loses its stale
Triage ability (it already healed every adjacent unit each turn, which was
what Triage claimed to add).

**Four new cards (75 → 79)**, each on a mechanic nothing else has:

- **Banner Bearer** — `pack`: +1 own damage per adjacent friendly, outside
  `MAX_BUFF`. The swarm payoff Zaku and Ashigaru never had.
- **Firing Step** — `parapet`: a blocker the five beam walks in targeting.js
  ignore. The bastion archetype stops cutting its own fire.
- **Ember Lance** — `ember` on the previously unused `cone` pattern: the cell
  under each hit burns for one turn (scorch = 1, so it survives the enemy
  phase and the capture pass, then clears).
- **Recoilless Team** — the new `window` pattern (cells 2 and 3 ahead, blind
  at 1) with `backblast`: the friendly directly behind takes 1 per shot.
  Backlog item 6, finally built.

Before/after probe numbers are in the commit message for this entry.

## v2.31 — the roster review

The user went through every card in the v2.30 roster with one rule: with
twelve slots, no two cards may do remotely the same thing. Their decisions,
as applied:

**Thirteen cuts (79 → 66), refunded by the v15 migration:** Pike Wall,
Sentry Ronin, Backstop Battery, Thruster Ram, Drop Beacon, Supply Drone,
Longshot, Herald, Relay, Reactor Core, Dynamo, Emergency Requisition,
Fireteam Zaku. "Remove all other DP generating cards" — the Forward Base is
now the only one (`dynamo: 1` on the base; the Dynamo code path is reused).

**Nine new cards (66 → 72):** the Fireteam (Specialist rifleman) with four
exclusive kits — Noble, Shadow, Osiris, Majestic — built on the Frame gear
mechanism generalised to any host (`kitHost()`, and `applyFrameGear` now
carries blocker / pen / indirect / aura / choose traits off the kit); the
Singer (`hymn`: hostiles within two cells strike 1 softer, read from the
ATTACKER's position, mirrored in the forecast and in spawn clashes); and the
elemental set — Pyre Emitter (`burnLane`), Cryo Projector, Volt Coil, Crystal
Lens — where three ids changed (scrambler→pyre, degausser→volt, lens→crystal)
and the migration follows them through unlocks, deck, fitted gear and usage.

**Reworks:** Bulwark → two-section parapet half wall (`squad: 2`,
`formation: 'column'`, `parapet`); Ashigaru files down the column too
(placeSquad's offsets are formation-aware); Naginata takes `around`, Samurai
takes the new `sweep5`; Mortar `cross4`; Rearguard `rearvert3`; Falconer
`radius2` with a pick, no draw; Rampart → twin-firing Exo Frame Specialist
(Archer takes its starter slot); Ashura → `adj` fists + Fatal Fury (4 × 2);
Aegis loses riposte; Hecate gains `pen`.

**Not built:** "fog of war" was named on Falconer and Forward Base. The game
has no fog-of-war system; both cards were built to their other half. If fog
comes, these two are the first to read it.

Kit and Singer designs, the Samurai's five cells and the Fatal Fury numbers
are my drafts against one-line briefs — flagged as such in the reply.

## v2.31.1 — Master Chief, and Shigure Forge

Twelfth lead: `masterchief` (JOHN-117 / MASTER CHIEF / Spartan / #6f8f3a).
Passive Spartan Company hooks `costOf` (the Fireteam and anything with
`frameGear: 'fireteam'` cost 1 less, floor 1); con No Frame hooks `leadBan`
(proto cards refused) and `seedFrame` (the slot is not seeded). Kaede became
SHIGURE FORGE with callsign FORGE, since CHIEF now belongs to the Spartan.
The bio is my draft.

## v2.32 — the Fireteam line, saved decks, fog of war

**Fireteam line.** The generic Fireteam + four team-locked kits (v2.31) were
the wrong shape: four closed kits and no deck. Now four hosts carry
`line: 'fireteam'` (one on the board at a time, gated in `frameGateText`)
and six armour abilities carry `fits: 'fireteam'` + `slot: 'armor'`. The
Frame gear path was generalised: `hostFor(k)` resolves a named Frame or any
unit of the line; `applyFrameGear`'s armour branch strips the previous
ability's flags and applies the new one's (`camo`/`cloaked`, `jet`/`servo`,
or a keyed `ab` dispatched through `ARMOUR` in abilities.js). Ordnance Drop
resolves in deploy.js and is never carried. Cloak, lock and hologram are
turn states cleared at the end of `territoryPhase`; `strike()` and
`forecastThreat()` honour all three together so the board never lies.

**Saved decks.** `p.presets` (≤ 6 of `{n, deck, frame}`), Squad page row,
`ask()` for the name; load drops cards the profile no longer owns.

**Fog of war.** A modifier (`fog`), never on boss missions. `visibleCells()`
in board.js: home third always, plus each unit's `sight` (default 2), plus a
Recon Lark's `G.reveal` for the turn, plus `e.revealUntil` for a hostile
that fired. `geomFor` filters through `foeVisible`, so nothing fires blind;
the forecast skips hidden hostiles; the board hides them and marks fogged
cells with 霧. Spawn markers are hidden under fog like Blackout.

The Halo names and roles are the user's; the ability numbers are my drafts.

## v2.32.1

The Shigure Forge rename was an accident; the Frame Engineer is KAEDE again, callsign CHIEF, as before. The Spartan's callsign is MASTER CHIEF, so the two share the word.

## v2.33 — one line per deck, Lone Spartan, saved-decks tab

`deckProblems(deck, frame)` in progression.js is the single source for the
build-table rules: the one-line rule (Fireteam cards + a fielded Frame) and
Lone Spartan (Master Chief, two Fireteams). The Squad page renders each as a
red bar, the launch guard in mission.js refuses on the first one with the
same title, and the saved-decks tab flags a preset that would break them.
Master Chief's No Frame con (and its leadBan/seedFrame hooks) are gone —
the global rule covers it. Saved decks moved from a row under the deck to a
`squadTab` beside Deck.

## v2.33.1 — kits do not cycle

User-reported: a fitted kit was drawn again once the reserve cycled, because drawCard() rebuilt the deck from the whole loadout minus the hand. `G.spent` (an array, so it survives any serialisation) now lists every kit card played this mission; drawCard skips it; Field Refit and The Code remove a kit from it when they hand it back.

## v2.33.2 — old runs get their boss

User could not find the Prism. genRun() types nodes once and stores them in `p.ops[op]`; runs dealt before v2.10 kept `extract` on the final node and no migration ever retyped them. v17 walks every stored run and sets the final node to `boss` where BOSSDEF names a boss for the operation. Cleared status and rewards are untouched.

## v2.33.3 — one-line rule shelved

User's call after weighing both sides: remove the one-line rule until testing says otherwise. `deckProblems()` stays as the hook (Squad page and launch guard still read it) but returns nothing. Master Chief's con is No Frame again, with its `leadBan` and `seedFrame` hooks restored; Lone Spartan is gone.

## v2.34 — Fireteams stack, Frames stride

User's call: no field limit on Fireteams (the line gate in frameGateText is gone; validTiles offers every standing team of the line for a `fits` card, and deploy checks the tapped cell's line). Proto Frames get `servo` at mkUnit — move then fire or use the ability in one turn — as the buff, with stats held; the fallback if the stride is not enough is hull/damage.

## v2.34.1

Shadow gets `drop`. The v2.33.1 spent list now holds Frame gear only: Fireteam abilities (and Ordnance Drop) cycle with the reserve like the teams, per the user.

## v2.34.2

Osiris: `drop` out, `boost` in (the Thruster Pack's two-cell straight stride, now readable off a card at mkUnit). Move or fire, not both — that stays the Jetpack's.

## v2.35 — one of each Fireteam, omni teams, sight 1

`recycleLineCard(u)` in deck.js is called from all six unit-destruction sites (combat ×2, boss, phases ×2, spawn): a lost `line` card goes back into `G.deck` at a random depth unless another copy stands or it is already in deck/hand. drawCard's reshuffle excludes standing teams; frameGateText gates a team card whose team is on the field. The four teams carry `omni`; sight 1 except Osiris (3).

## v2.35.1 — the first node is clean

Thirteen guards launch an operation's first node with whatever modifier genRun rolled; with `fog` in the pool a far hostile could be unseen and a Lancer 'hit 2, expected 3'. The start node now always rolls `none` — it was already meant to teach the base rules before any variant.

## v2.36 — sight 1

`DEFAULT_SIGHT` 2 → 1. Exceptions with a reason: eyes (Scout, Falconer, Forward Base, Osiris) 3; scopes (Pathfinder, Marksman, Rail Sniper) 2. balancetest pins the list so a stray `sight` value needs a reason written down.

## v2.36.1 — X-Grenade

`ordnance` → `xgrenade` (v18 migration follows unlocks, deck, presets, usage). `grenade: 5` + `pen`: thrown to front+2, hits the centre and its four diagonals, resolved in deploy.js like the old drop, never carried.

## v2.37 — Naginata/Samurai split, five Fireteam weapons

Naginata: around, 2 dmg, 8 hull. Samurai: sweep5, 3 dmg, burst 5, 5 hull. Five `fits: 'fireteam'` / `slot: 'weapon'` cards on the existing weapon branch of applyFrameGear, which now also carries `push`, `recharge` (and resets `cycling`). New `blast3` pattern (3x3 centred three out, cut by a wall directly ahead). Names and numbers are my drafts off the user's Halo brief.

## v2.37.1 — Fireteam weapons are armoury gear

User's call after weighing gear vs deck. The five weapons are GEAR entries with `fits: 'fireteam'` and a `tg`: mkUnit treats a gear with `tg` as a replacement gun (tg/dmg/single from the gear; push/recharge/choose added), gearFits refuses line gear off its line (and now enforces `frame` binding too), the hitbox diagram draws the fitted weapon, the Quartermaster shelves them under 'Fireteam weapons'. v19 refunds the card versions. Abilities remain deck cards.

## v2.37.2 — aimed X-Grenade

`throw: 2` on the card: validTiles offers every non-cratered cell within Chebyshev 2 of any standing Fireteam (occupied or not); deploy resolves the X at the tapped cell with the nearest team as the thrower, then consumes the card.

## v2.37.3

Fireteams carry `parapet` at mkUnit: the five beam walks in targeting.js pass them, the horde still stops at them.

## v2.37.4

User's call: Fireteam armour cards are one use a mission again (the v2.34.1 exception is gone). deploy.js marks every `fits` card spent, the grenade included; drawCard skips the spent list.
