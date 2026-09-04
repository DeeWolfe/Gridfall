# Gridfall: Zanshin Protocol — mechanics spec

The systems, not the numbers. Per-card, per-hostile and per-lead numbers live
in `reference/gridfall-data.json`, which is the source of truth and is what
`tools/gen-content.js` builds `src/content/` from. This document describes the
rules those numbers feed, and is kept free of copied stat tables on purpose.

## Board and economy

- **5 lanes x 8 columns.** Columns 0-2 start yours, 5-7 hostile, 3-4 neutral.
- **6 deploy points per turn**, +1 on a boss mission, shifted by the lead's
  `dpMod` (Coronet +2, Riptide -2) and floored at 1. Unspent points are lost.
- **Deck: 12 cards, no duplicates**, or fewer under a lead that runs a short
  manifest (`deckCap`). Opening hand 5; the turn draw is 2, plus the
  Quartermaster's `drawBonus`, and stops at a hand of 6 — card effects that
  call in cards ignore that cap on purpose. The reserve reshuffles when empty.
- **Last-Stand Protocol.** Each lane carries one grid charge: the first hostile to cross that lane's line is destroyed along with every hostile in the lane (kills and quota progress from the purge do not count), and the charge is spent. **One breach past a spent lane loses.** Holding fewer than 6 tiles also loses.
- Tiles flip to whoever ends the turn on them. You may only deploy on tiles you hold.

## Turn order

1. Player deploys and acts (immediate, irreversible)
2. Units that did not act auto-fire, healers heal
3. Hostiles act — each either moves **or** attacks, never both
4. Territory flips, plasma decays
5. Win/loss checks
6. Previewed wave spawns in its promised lane
7. Next wave rolled and previewed

## Cards

The pool is 85 cards across three tiers — 25 Common, 41 Tech, 19 Specialist.
Per-card numbers live in `reference/gridfall-data.json` and are surfaced in
the game's own Collection screen; they are deliberately not copied here,
because a copy goes stale and the data cannot.

A card is one of six shapes, and its data fields say which:

| Shape | Marked by | Behaviour |
|---|---|---|
| Unit | `hp` | Lands a body on a held tile, takes the cell, fires by its `tg` geometry |
| Instant | `instant` | Resolves and is gone — no body, no tile taken |
| Command call | `strat` | Arms a marked effect that lands this turn's end or next turn's start |
| Attachment | `attach` | Rides on a standing unit rather than taking a cell of its own |
| Frame kit | `frameGear` | Re-specs one named Proto Frame's weapon or support slot |
| Fireteam kit | `fits` | An armour ability that fits any standing team of that line |

Every card carries `dp` (deploy cost), `t` (tier) and `price` (credits at the
Quartermaster). A unit adds `tg` (its firing geometry — see `targeting.js`
for the named patterns and `geomCells()` for the cells each one lights).

### Veterancy

Every deployment of a card counts, for the life of the profile: Standard at 0,
Veteran at 10, Elite at 30, Legend at 75. Rank is cosmetic recognition of use,
not a stat buff — it colours the card and its board token.

## Gear

One slot per card, bought with credits at the Quartermaster. Exactly one copy
of each piece exists per profile: fitting a piece strips it off whatever was
wearing it. 24 pieces, grouped by dominant stat into Offense, Defense and
Utility on the fitting surface.

Two exclusivity rules, both enforced in one predicate (`gearFits()`) so
neither surface can enforce it while the other forgets:

- A Proto Frame wears no armoury gear — its kit is cards, not pieces.
- A piece bound to a card (`frame`, `team`) or a line (`fits`) goes nowhere
  else, and a card with no body (kit, call, instant, attachment) has no slot.

## Hostiles

30 hostile types across the same three tiers, plus 10 bosses. Each carries
`hp`, `dmg`, `threat` (its cost against a wave's budget), `spd` (cells per
turn; 0 is an emplacement, 0.5 moves every other turn) and a behaviour flag
or two — `jam` (blocks indirect fire in its lane), `floor` (reduces every hit
it takes), `burrow`, `split`, `mend`, and so on. Numbers live in the data.

A hostile does one thing a turn: it moves **or** it attacks, never both.


## Command

You are the task force commander. A team lead runs the squad in the field and
answers to you; your rank ladder is Acting Commander through Marshal.

## Team leads

Twelve leads, and from v2.25 every one of them is a trade: a passive that
bends a rule your way and a con that bends one against you. Ironbrand is the
free default and the only lead with no con. The rest are Quartermaster goods,
recruited with credits.

The roster, its perks and its prices live in `gridfall-data.json` under
`leads`. What matters to the code is that **a lead's rules key off its id,
never off the display name of its perk** (`leadIs('ironbrand')`, not
`leadOf().passive.n === 'Hardened Armour'`) — perk prose is prose, and
rewording it must not switch a rule off.

Three cons are structural rather than numeric, and each is enforced at the
door as well as in the rules: a banned tier (`banTier`), a deck ceiling
(`deckCap`), a rearmost-column lockout (`minCol`), and the Master Chief's
No Frame, which empties the Frame slot entirely.

## Frames

A Proto Frame is a prototype the deck commits to: it rides its own loadout
slot rather than a deck slot, is **seeded into the opening hand at launch**
(outside the deck, so a reshuffle never deals it again), and runs a closed kit
of 1 DP gear cards no other unit may wear. One Frame stands at a time.

Three chassis — the White Devil, the Seven Blades, the Heavy Arms — each with
its own kit. A kit card is either a **weapon** (replaces the chassis's base
weapon: its geometry, its damage, its traits) or a **support** (rides
alongside the weapon). Every kit card is spent the moment it is played, so a
reshuffle never deals a dead kit into your hand.

Two leads are built around the line: Bushido returns a destroyed Frame and its
kit to hand, 2 DP cheaper for its next deployment, at the cost of fielding it
at half hull; Kaede swaps kit freely and heals 3 hull a swap, at the cost of
carrying one piece at a time.

## The Fireteam line

Four named teams, each a squad in one cell that fights facing either way. One
of each may stand at a time, and while a team stands **its card leaves the
deck entirely**, returning to a random position in the reserve when the team
is lost — so the line cycles rather than flooding. Six armour abilities fit
any standing team, one carried at a time (two under the Kit Rack), each one
use a mission.

## Bosses

Ten bosses, one per operation ending plus the Crownring guard set. A boss is a
multi-cell body with shared hull, a shield, and phases that flip at hull
thresholds; each carries a telegraphed attack pattern drawn on the board a
turn ahead. Boss missions run a turn clock rather than a wave count.

## Command calls

A command call is a card, not a button: seeded into the mission at start
(outside the deck), one per mission, costs DP. Playing it commits the call —
the effect resolves at the **start of the following turn** (or this turn's
end, for the calls marked `now`), with the affected cells marked in between.
A prediction, not an undo.


## Missions

| Type | Waves | Objective |
|---|---|---|
| Defend Stronghold | 8 | Hold the line through every wave. Each lane's grid charge absorbs one breach - after that, one body through ends it. |
| Protect Civilians | 7 | Three civilian pods sit on your ground. Lose all three and the operation fails. |
| Acquire Specimens | 7 | Destroy the marked hostile type to fill the quota. |
| Fight for Crystals | 6 | Four crystal nodes on the field. Hold three when the last wave clears. |
| Retake Ground | 7 | Hold 3 or more tiles in the hostile half when the last wave clears. Bring something that deploys behind their line. |
| Extraction | 6 | Short and heavy. Survive to extraction. Reserved for the final node of every operation. |
| Establish Uplink | 7 | A marked relay tile in the neutral band. Hold it three turns IN A ROW - losing it resets the charge. |
| Eradication Blitz | 6 | Destroy nine hostiles before the wave count runs out. |
| Boss | 18 | A single multi-cell body with phases. Turn clock, not a wave count. |

## Campaign map structure

Nodes carry a role. The `start` node is always Defend Stronghold and the
`final` node is always Extraction - clearing it completes the operation and
rerolls the map; side objectives not collected by then are forfeit. `side`
nodes are optional bonus objectives: they draw from the objective pool
(Crystals, Specimens, Uplink, Blitz) and pay 1.5x reward plus a flat bonus.
A node may also carry `req`, a gate: it stays locked - whatever adjacency
says - until the named nodes are cleared, with its `reqText` shown on the
map ("Power offline - reset the Power Junction in the Deep Shaft").

Two more node/operation fields: `type` pins a node's mission type instead of
rolling it (an Archive that is always an Uplink, a rescue that is always
Civilians; a pinned `side` node may sit outside the usual side pool), and an
operation-level `heat` (1-3) adds that much threat to every wave's budget
and pays +25% credits per point; a node-level `heat`
overrides it (Shallowhelm's mandatory Crystals hold runs at 1, not 3).
`lore` on a node prefixes its map briefing line.

- **Ironveil** - a split route converging on the Extraction Point; the
  Zone C Cache is a bonus spur.
- **Blackmarrow** - the way out runs through The Throat, but that approach
  is gated on the Power Junction down in the Deep Shaft.
- **Sunderglass** - twin routes over Prism Ridge; The Glassing is a
  two-node bonus chain.
- **Lumenspire** (heat 1) - a linear push through an overrun research city:
  the Archive Core is always an Uplink (the data), the Researcher Dorms are
  an optional Civilians rescue, and Extraction is gated on the Archive.
- **Crownring** (heat 2) - a concentric summit city ambushed mid-accord:
  X routes from the Summit Hall to the second ring, a plus of ward gates
  beyond it. The Northgate Delegation (always Civilians) must be walked out
  before the Accord Extraction unlocks; the west and east gates are bonus.
- **Shallowhelm** (heat 3) - a fortress breached from within by a cult that
  opened its gates to the hive. Three branches off the Gatehouse: the Power
  Vault (always Crystals), the optional Records Hall (always Uplink), and
  the Purge wing - gated on power, ending in the Purge Core (always Blitz).
  Extraction is back at the Gatehouse, gated on the armed Purge Protocol.

## Field events

One-turn conditions on the spawn-marker promise contract: each is telegraphed
a full turn ahead ("Field report: ... expected next turn"), lives for exactly
one turn, then expires. Roughly one turn in three carries one.

| Event | Effect while live |
|---|---|
| Supply Drop | +2 deploy points this turn. |
| Seismic Tremor | Every hostile strike deals 1 less (min 1). |
| Grid Overclock | Your Tech units strike +1. |
| Hive Surge | The wave marked this turn rolls +2 threat. |
| Dead Air | The wave marked this turn is empty. |

Surge and Dead Air shape the manifest rolled while they are live, so the
markers the player reads already reflect them. The tremor and overclock are
mirrored in forecastThreat/dmgPreview - the previews never lie.

## Enemy intents

Every hostile chip carries an intent badge for the coming turn, computed by
`enemyIntent()` (a strict mirror of `actHostile()`): ⚔n strike for n, ▸/▸▸
advance (fractional speeds show banked steps), ✚ mend, ✱ spawn, … hold. Each
hostile type also carries a fixed glyph, shown on its chip and in the incoming
strip (▪ Crawler, ⬢ Hulk, ◣ Breacher, ◆ Spitter, ✠ Harrower, ♚ Sovereign, and
so on for all thirty) — see `FOE_GLYPH` in `src/render/combat.js`.

## Modifiers

| Modifier | Effect |
|---|---|
| Nest | Emplacements from wave one. |
| Blackout | No wave preview and no spawn markers. |
| Hull breach | The top lane is impassable. |
| Scavenge | Each kill refunds 1 deploy point. |
| Swarm | Crawler counts doubled. |
| Crumbling Ground | Every couple of turns one open tile collapses for good. |
| Fog of War | The middle and far ground are hidden. Units see one cell around them; scopes see two; scouts, the Falconer, the Forward Base and Osiris see three; a Recon Lark lifts it for a turn. |

An operation's first node always rolls `none`: a modifier on the opening
mission decides the run before the player has a deck on the board.

## Enemy doctrines

Rolled fresh each wave; decides how the wave distributes across lanes.

| Doctrine | Weight | Behaviour |
|---|---|---|
| Concentrated push | 26 | Hammers the two softest lanes |
| Broad assault | 38 | One per lane, cycling, softest first |
| Probing attack | 36 | Weakest lane, each arrival making it less attractive |

## Spawn-cell combat

When a hostile drops onto one of your units they fight to the death and the survivor keeps its damage.

- **Hostile wins** - your unit dies, the hostile lands in that cell carrying its wounds
- **Your unit wins** - the hostile is destroyed on arrival, your unit survives wounded
- **Both fall** - the cell is left empty
- **Zero-damage emplacements** cannot force a landing at all; they hold at the edge

Shields absorb one blow each. Riposte adds to your side. Armour floors reduce what your unit deals.

## Requisition packs

| When | Pack |
|---|---|
| Every second campaign node secured | Standard |
| Operation completed | Specialist |
| Gauntlet leg cleared | Standard |
| Gauntlet full clear | Specialist |
| Onslaught | One per 5 waves survived |
| Bought at the Quartermaster - 100 cr | Standard, ~1 in 8 upgrades to Specialist |

Three items offered, keep one. Standard packs draw Commons and Tech only - Specialists come from specialist packs or the shop. One slot guarantees an unowned card while any remains; the other slots may draw duplicates, offered as field promotions (+12 deployments toward that card's next rank). Once cards run out the guaranteed slot degrades to unowned gear, then promotions, then raw credits. The pack never opens empty.

## Modes

- **Campaign** - node-by-node through an operation. Ironman toggle rerolls the operation on any loss.
- **Onslaught** - endless waves, threat scales 1.9x per wave. Tracks personal best.
- **Gauntlet** - three missions back to back, escalating rewards. One loss ends the chain.

## Save schema

`SAVE_VERSION` is 20. A fresh profile:

```json
{
  "version": 20,
  "id": "pmtapjx9y",
  "callsign": "CALLSIGN",
  "created": 1787785879606,
  "lastPlayed": 1787785879606,
  "progress": {
    "rank": 1,
    "xp": 0,
    "credits": 420
  },
  "unlocks": {
    "cards": [
      "scout",
      "rifle",
      "marks",
      "wall",
      "medic",
      "archer",
      "lancer",
      "bulwark",
      "assassin"
    ],
    "enemies": [],
    "gear": [],
    "leads": [],
    "schemes": [
      "standard"
    ]
  },
  "loadout": {
    "deck": [
      "scout",
      "rifle",
      "marks",
      "wall",
      "medic",
      "archer",
      "lancer",
      "bulwark",
      "assassin"
    ],
    "gear": {},
    "scheme": "standard",
    "frame": null
  },
  "stats": {
    "deployments": 0,
    "held": 0,
    "lost": 0,
    "breaches": 0,
    "kills": 0,
    "unitsLost": 0
  },
  "ship": "ANVIL-7",
  "lead": "ironbrand",
  "usage": {},
  "op": "ironveil",
  "ops": {},
  "mode": "campaign",
  "ironman": false,
  "gaunt": null,
  "bests": {
    "onslaught": 0,
    "gauntlet": 0
  },
  "settings": {}
}
```

`migrate()` runs on every load regardless of version, fills missing fields,
resets unknown operations, and strips cards and gear that no longer exist —
so a save written by any earlier build still opens. Each numbered step is
kept for as long as saves at that version could still exist in the wild; a
new step is added only when a change alters the shape of the save, not
merely its balance numbers.
