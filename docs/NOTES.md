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

## Still open

1. **Crystals still loses to "Three breaches"** more than anything else — the
   mission stretches a defence thin by design. 45% is a floor a planning
   player beats, but if it needs another notch, the next lever is one extra
   endgame turn (`G.extra >= 4` for crystals only in `endgameCheck()`).
2. **No real card art yet.** The placeholder portraits stand in; the
   embedding pipeline is built and proven (see above) and waits on actual
   images, which replace a placeholder the moment they land in `CARD_ART`.
3. **Every win rate above comes from a near-random bot.** It never plans, rarely
   repositions and never uses manual targeting. Treat the numbers as floors.
4. **Forward Base is the riskiest of the new cards** — repair plus cooldown
   acceleration in the contested half props up Retake and Crystals directly.
   If it proves dominant in play, cut the cooldown half and keep the repair.

Two things the structure now makes cheap:

- **More operations.** The map generator is data-driven — a new operation is an
  entry in `reference/gridfall-data.json` under `operations`, not code.
- **Cloud saves.** The save layer is versioned and sits behind `src/save/store.js`
  with a memory fallback. Swapping the backing store is the whole job.
