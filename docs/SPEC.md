# Gridfall: Zanshin Protocol — mechanics spec

Extracted from the reference build. Numbers here match `gridfall-data.json`; that file is the source of truth.

## Board and economy

- **5 lanes x 8 columns.** Columns 0-2 start yours, 5-7 hostile, 3-4 neutral.
- **6 deploy points per turn**, flat. Unspent points are lost.
- **Deck: 12 cards, no duplicates.** Opening hand 5, draw 2 per turn, reshuffles when empty.
- **3 breaches loses.** Holding fewer than 6 tiles also loses.
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

### Common (22)

| Card | DP | Hull | Targeting | Notes |
|---|---|---|---|---|
| Scout | 1 | 3 | — | — |
| Recon Lark | 1 | 2 | — | — |
| Pathfinder | 1 | 4 | First hostile in lane | single-target |
| Vanguard | 3 | 7 | Adjacent cell | single-target |
| Rifleman | 2 | 5 | First hostile in lane | single-target |
| Medic | 2 | 3 | — | heals the four adjacent cells, ability: Triage |
| Fireteam Zaku | 1 | 3 | First hostile in lane | single-target, two bodies from one card |
| Cipher | 2 | 3 | First hostile in lane | single-target, may trade places with any friendly anywhere (uses its action) |
| Engineer | 2 | 4 | — | Tech unit directly ahead: +2 damage and repairs 2/turn |
| Outrider | 3 | 5 | Adjacent cell | single-target, charges up to 2 cells forward, drives survivors back a cell |
| Archer | 2 | 4 | Two ahead plus both rear diagonals | single-target |
| Assassin | 2 | 3 | One adjacent hostile | single-target, deploys anywhere |
| Samurai | 3 | 7 | All eight surrounding cells | — |
| Marksman | 3 | 4 | Furthest hostile in lane | single-target |
| Lancer | 3 | 4 | Three cells ahead | — |
| Mortar | 3 | 3 | 3x3 at exactly range 4 | indirect |
| Bulwark | 3 | 10 | Adjacent cell | single-target, blocks lane, shield regen, ability: Brace |
| Knight | 3 | 9 | Adjacent cell | single-target, blocks lane, shield regen, riposte 1 |
| Ronin | 3 | 6 | The cell ahead and the cell behind | — |
| Naginata | 2 | 5 | Both cells one and two ahead | — |
| Kunoichi | 2 | 3 | The four diagonals only | deploys anywhere |
| Herald | 2 | 4 | — | — |

### Tech (14)

| Card | DP | Hull | Targeting | Notes |
|---|---|---|---|---|
| Barricade | 1 | 12 | — | blocks lane |
| Supply Drone | 1 | 3 | — | — |
| Drop Beacon | 2 | 4 | — | — |
| Supply Cache | 1 | — | — | instant |
| Shield | 1 | — | — | attachment |
| Shoulder Cannon | 2 | — | — | attachment |
| Turret | 2 | 8 | First hostile in lane | single-target |
| Relay | 2 | 4 | — | — |
| Tech Blade | 2 | 6 | Three cells vertically, one column ahead | — |
| Pulse Emitter | 2 | 5 | All eight surrounding cells | — |
| Scrambler | 2 | 6 | — | — |
| Lance Battery | 3 | 7 | Exactly three cells ahead | single-target |
| Forward Base | 3 | 10 | — | held ground in column 3+ only; adjacent friendlies repair 2/turn and cool down faster (never to zero) |
| Minefield | 1 | 1 | — | any ground in column 3+; 6 damage to the first hostile in, then spent; steers the horde away |

### Specialist (9)

| Card | DP | Hull | Targeting | Notes |
|---|---|---|---|---|
| Aegis Knights | 5 | 18 | Adjacent cell | single-target, blocks lane, shield regen, riposte 2, ability: Aegis Field |
| Bio Medic | 4 | 4 | — | — |
| Tech Medic | 4 | 4 | — | ability: Full Restore |
| Orbital Dragoon | 4 | 5 | Exactly two cells ahead | single-target, ability: Thruster Leap |
| Rail Sniper | 5 | 4 | Every hostile in the lane | — |
| Hell Jumpers | 4 | 5 | All eight surrounding cells | deploys anywhere |
| Plasma Artillerist | 5 | 3 | 3x3 at exactly range 4 | indirect |
| Exo Juggernaut | 5 | 20 | Adjacent cell | single-target, blocks lane, ability: Hammer Charge |
| Hecate Platform | 5 | 4 | Furthest hostile on the board | single-target, ignores lanes and blockers, needs a turn to cycle between shots |

## Gear

One slot per card, bought with salvage.

| Gear | Cost | Effect |
|---|---|---|
| Extended Barrel | 45 sv | +1 damage to this unit. |
| Reactive Plating | 40 sv | +3 hull. |
| Servo Legs | 80 sv | May move AND fire in the same turn. |
| Targeting Uplink | 60 sv | Ignores hostile armour floors. |
| Field Kit | 75 sv | Costs 1 less deploy point, minimum 1. |
| Coolant Core | 90 sv | Ability cooldowns are 1 turn shorter, minimum 1. |
| Phase Cloak | 105 sv | The first killing blow leaves it at 1 hull instead. Once per deployment. |
| Ablative Weave | 70 sv | +1 shield capacity. Stacks with regenerating shields. |
| Drop Pod | 110 sv | May deploy straight onto a hostile below Specialist tier, crushing it on landing and holding the cell. |
| Stim Injector | 70 sv | +2 damage. The unit loses 1 hull every turn it lives — it can burn out entirely. |
| I-Field | 90 sv | Immune to any strike that arcs in from beyond the adjacent cell. |

## Hostiles

| Hostile | Tier | Hull | Damage | Threat | Speed | Behaviour |
|---|---|---|---|---|---|---|
| Crawler | Common | 3 | 2 | 1 | 2 | Cheap, fast, endless. Moves two cells a turn and floods whatever lane you leave open. |
| Breacher | Common | 7 | 4 | 3 | 1 | Prioritises Tech over personnel. Punishes Barricade and Turret spam. |
| Spitter | Common | 5 | 3 | 3 | 1 | Stops at range four and fires down the lane. Outranges most of your roster. Punishes turtling. |
| Burrower | Common | 5 | 3 | 3 | 1 | Emerges mid-board, behind your front line. Punishes over-committing forward. |
| Hulk | Common | 14 | 6 | 4 | 0.5 | Slow, heavy, reduces all incoming damage by 1. Punishes chip damage. |
| Spore Node | Tech | 10 | — | 4 | immobile | Immobile emplacement. Releases a Crawler every two turns and holds its tile until destroyed. |
| Bulwark Pylon | Tech | 12 | — | 5 | immobile | Immobile emplacement. +1 damage floor to every hostile in its lane. |
| Jammer | Tech | 8 | — | 4 | immobile | Immobile emplacement. Blocks all indirect fire in its lane. Shuts off Mortar and Artillerist entirely. |
| Harrower | Specialist | 12 | 6 | 7 | 1.5 | Tunnels straight past blockers. Barricades and Bulwarks do not stop it. |
| Chorus | Specialist | 14 | — | 8 | immobile | Immobile at the far edge. +1 damage to every hostile on the board. Kill it first — if you can reach it. |
| Sovereign | Specialist | 40 | 8 | 10 | 0.5 | Moves every other turn. Every tile it crosses becomes hostile ground permanently. |
| Husk | Common | 6 | 2 | 2 | 1 | Falls apart when destroyed - two Crawlers crawl out of the wreck. |
| Mender | Tech | 8 | - | 4 | 1 | Unarmed. Advances with the horde and knits 2 hull into the most wounded hostile in its lane each turn. |
| Screamer | Specialist | 10 | 4 | 7 | 1 | Its death sends every hostile on the board one step forward - time the kill. |

## Command

You are the task force commander. A team lead runs the squad in the field and
answers to you; your rank ladder is Acting Commander through Marshal.

## Team leads

| Lead | Role | Perk | Stratagem | Unlock |
|---|---|---|---|---|
| VALE "IRONBRAND" | Line Commander | **Hardened Frames** Every unit deploys with +1 hull. | - | free |
| KESTREL "WILDFIRE" | Strike Officer | - | **Emergency Requisition** (0 DP) +4 deploy points when the call lands. | free |
| SABLE "COLDWIRE" | Field Engineer | **Nanite Weave** All units repair 1 hull per turn. | - | free |
| GRAHAM "LONE EDGE" | Frontline Duelist | **Lone Edge** A unit with no adjacent friendly deals +2. | **Duel Protocol** (3 DP) One unit: +4 damage and untouchable for a turn. | 420 cr |
| KUDELIA "SKUNKWORKS" | R&D Officer | **Field Fabrication** Tech deploys +2 hull, repairs 1/turn. | **Field Refit** (2 DP) Every Tech unit restored to full hull. | 420 cr |
| ALLENBY "QUIETSTEP" | Infiltrator | **Quietstep** Cards that land on hostile ground cost 1 less, min 1. | **Silent Insertion** (2 DP) Next three deployments land anywhere. | 450 cr |
| CAGALLI "FIREBRAND" | Saboteur | **Firebrand** +2 DP on any turn after you lost a unit. | **Breaching Charge** (3 DP) Destroy every hostile in a column at or below 8 hull. Ignores blockers. | 480 cr |
| YAZAN "RIPTIDE" | Skirmisher | **Riptide** Units that repositioned take 1 less damage. | **Grapple Net** (2 DP) Drag every hostile in a lane two cells back. | 380 cr |

### Stratagems

A stratagem is a card, not a button: seeded into the mission at start (outside
the deck), one per mission, costs DP. Playing it commits the call; the effect
resolves at the **start of the following turn**, with the affected cells
marked in between - a prediction, not an undo. Coronet's General Advance is
shelved: it breaks the one-action-per-unit rule everything else rests on.
Unlockable leads are Quartermaster goods, recruited with credits.

## Missions

| Type | Waves | Objective |
|---|---|---|
| Defend Stronghold | 8 | Hold the line through every wave. Three breaches ends it. |
| Protect Civilians | 7 | Three civilian pods sit on your ground. Lose all three and the operation fails. |
| Acquire Specimens | 7 | Destroy the marked hostile type to fill the quota. |
| Fight for Crystals | 6 | Four crystal nodes on the field. Hold three when the last wave clears. |
| Retake Ground | 7 | Hold 3 or more tiles in the hostile half when the last wave clears. Bring something that deploys behind their line. |
| Extraction | 6 | Short and heavy. Survive to extraction. Reserved for the final node of every operation. |
| Establish Uplink | 7 | A marked relay tile in the neutral band. Hold it three turns IN A ROW - losing it resets the charge. |
| Eradication Blitz | 6 | Destroy ten hostiles before the wave count runs out. |

## Campaign map structure

Nodes carry a role. The `start` node is always Defend Stronghold and the
`final` node is always Extraction - clearing it completes the operation and
rerolls the map; side objectives not collected by then are forfeit. `side`
nodes are optional bonus objectives: they draw from the objective pool
(Crystals, Specimens, Uplink, Blitz) and pay 1.5x reward plus extra salvage.
A node may also carry `req`, a gate: it stays locked - whatever adjacency
says - until the named nodes are cleared, with its `reqText` shown on the
map ("Power offline - reset the Power Junction in the Deep Shaft").

Two more node/operation fields: `type` pins a node's mission type instead of
rolling it (an Archive that is always an Uplink, a rescue that is always
Civilians; a pinned `side` node may sit outside the usual side pool), and an
operation-level `heat` (1-3) adds that much threat to every wave's budget
and pays +25% credits and +heat salvage per point; a node-level `heat`
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
- **Shallowhelm** (heat 3) - a fortress gone dark. Three branches off the
  Gatehouse: the Power Vault (always Crystals), the optional Records Hall
  (always Uplink), and the Cleanse wing - gated on power, ending in the
  Cleanse Core (always Blitz). Extraction is back at the Gatehouse, gated
  on the armed Self-Cleanse.

## Modifiers

| Modifier | Effect |
|---|---|
| Nest | Emplacements from wave one. |
| Blackout | No wave preview and no spawn markers. |
| Hull breach | The top lane is impassable. |
| Salvage | Each kill refunds 1 deploy point. |
| Swarm | Crawler counts doubled. |

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

Three items offered, keep one. Standard packs draw Commons and Tech only - Specialists come from specialist packs or the shop. One slot guarantees an unowned card while any remains; the other slots may draw duplicates, offered as field promotions (+12 deployments toward that card's next rank). Once cards run out the guaranteed slot degrades to unowned gear, then promotions, then salvage. The pack never opens empty.

## Modes

- **Campaign** - node-by-node through an operation. Ironman toggle rerolls the operation on any loss.
- **Onslaught** - endless waves, threat scales 1.9x per wave. Tracks personal best.
- **Gauntlet** - three missions back to back, escalating rewards. One loss ends the chain.

## Save schema

```json
{
  "version": 4,
  "id": "pmtapjx9y",
  "callsign": "CALLSIGN",
  "created": 1787785879606,
  "lastPlayed": 1787785879606,
  "progress": {
    "rank": 1,
    "xp": 0,
    "credits": 300,
    "salvage": 120
  },
  "unlocks": {
    "cards": [
      "scout",
      "rifle",
      "marks",
      "wall",
      "medic",
      "turret",
      "lancer",
      "bulwark",
      "assassin"
    ],
    "enemies": [],
    "gear": []
  },
  "loadout": {
    "deck": [
      "scout",
...
```

`migrate()` runs on every load regardless of version, fills missing fields, resets unknown operations, and strips cards and gear that no longer exist.
