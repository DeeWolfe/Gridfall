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
