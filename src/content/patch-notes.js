// Player-facing changelog. Unlike everything else under src/content, this is
// hand-authored rather than generated from reference/gridfall-data.json —
// it's prose for a person to read, not balance data. Bump VERSION and add a
// new entry to the front of PATCH_NOTES with every release worth telling a
// commander about; skip the ones that are pure internal cleanup.

export const VERSION = '2.8';

export const PATCH_NOTES = [
  {
    v: '2.8',
    notes: [
      'Operation bosses. Ironveil, Blackmarrow and Sunderglass no longer end at an extraction point — each ends at a Kill Order: one machine, a hard 18-turn clock, and a mission you win by bringing it down. The hive sends no waves; everything on the board is the boss\'s own work. Boss fights run a deploy point richer per turn.',
      'A boss fills a rectangle of cells and every one of them shares a single hull pool — so an area weapon lands once per cell it covers. Your cone, your sweep, your cross of warheads: that is the anti-boss arsenal, and nobody had to design it. Bosses block movement like terrain and cannot be crushed, netted or demolition-charged — only damaged.',
      'Every boss turns once, irreversibly, and loudly. THE GANTRY fabricates behind a 30-point containment field and does not fight — until the field breaks, and then every cell it has fires. Breaking the shield is what makes it dangerous; that is the decision.',
      'THE BROOD MOTHER works the field like a seam of ore: drifting across lanes, crushing what it rolls over, lashing whole rows, and marking breach points anywhere on the board a full turn before something surfaces. Stand a soldier on the mark and it takes the hit instead — nothing surfaces. At half hull it splits into three bodies, and all three must die.',
      'THE PRISM has never attacked anything. It reflects a quarter of every hit back up the barrel that fired it, past shields, and it can kill. At half hull it shatters into four fragments that each grow every turn — up to a cap, because a fight you cannot win is a bug wearing a difficulty costume.',
      'Bringing a boss down completes the operation and lands the Specialist requisition pack. First kills enter the Database, bestiary page and all.',
    ],
  },
  {
    v: '2.7',
    notes: [
      'A Frame weapon should be worth its price tag. Every one of the nine got stronger this patch, and each change went through more than four thousand simulated missions before it stayed: bare Frames may run a touch lean, but bolting the kit on now pulls them ahead.',
      'The area weapons carry the class. Hyper Napalm, the Crystal Greatsword and the Missile Gatling each buy their Frame three to six points of win rate over running it bare — the Missile Gatling arm is now the single best-performing deck in the harness, ahead of decks that skip the Frame line entirely.',
      'The Crystal Longsword was measured as a trap — a single poke traded away the Seven Blades\' whole three-lane swing — so it is a different weapon now: a running thrust through everything in the lane, three cells deep. The greatsword answers width, the longsword answers depth.',
      'The Laser Gatling\'s wings run two cells deep on both diagonals now. The hole in the centre stays — the gap is the card — but a machine that cannot move needed more sky to fire into.',
      'Damage up across the rest of the rack: Beam Rifle 9, Beam Saber 12 with a riposte of 6, Beam Javelin 8, Hyper Napalm 6, Hyper Rail Cannon 12, Greatsword 6, Missile Gatling 6.',
      'The single-target weapons — saber, rail cannon, longsword before its rework — measure even with a bare Frame against the swarm, and that is by design left alone: their work is the armoured elite the harness undervalues, and pushing their numbers until they showed against crawler floods would break the other fight.',
    ],
  },
  {
    v: '2.6',
    notes: [
      'Proto Frames stand on one square now. Measured first, changed second: the two-cell body altered no win rate anywhere, but it failed to find a legal landing spot around its Pilot in one mission of five. What makes a Frame big is its weapon arc, not its parking space.',
      'The service weapons got the arcs to prove it. The White Devil\'s blade now cuts every hostile at contact, all four sides at once. Seven Blades takes the column ahead across all three lanes in one swing. Heavy Arms walks gatling fire three cells down its lane. A bare Frame is a Frame, not a big soldier.',
      'The Frame line has been through roughly ten thousand simulated missions and the verdict is: fair. Committing a deck slot, a Pilot and a whole turn costs about three points of win rate, the machine pays most of it back, and it reaches the board in nineteen missions of twenty. It is not the strongest thing you can do — it is a way of playing.',
      'The equipped Frame now shows beside the Active deck, the deck bar counts it, and everything you bring that the deck did not deal — the Frame, your lead\'s call — sits apart from the drawn cards in the combat tray.',
      'Every card is a fireteam, not a soldier. The Squad briefing and the Database now say so.',
      'The hold ticker knows about the launch bays. 行きます。',
    ],
  },
  {
    v: '2.5',
    notes: [
      'Frames are Proto Frames now, and they have a slot of their own. One per deck, beside the twelve rather than inside them, and one deployment per mission. It sits at the front of your hand from the first turn, never drawn — a plan this expensive should not also be a gamble on the shuffle.',
      'Every Proto Frame costs a full turn of deploy points. Six, against a six-point turn: fielding one IS the turn, and since the Pilot has to be standing there already, the machine is always a turn behind the person. That window is the price, and it is now the same price for all three.',
      'The machines you already had — Aegis Knights, the Ashura Frame, the Exo Juggernaut, the Thruster Ram — are Exo frames: proven suits, in service, deployed like any other card. The three new ones are prototypes, and the cards say which is which.',
      'The White Devil is the all-rounder, and it now carries five weapons — no other Frame has more than two. Beam Rifle and Beam Saber are joined by the Hyper Rail Cannon, which punches through the front rank to whatever is deepest in the lane and ignores armour floors when it gets there; the Beam Javelin, a two-cell thrust that gives up nothing at contact; and Hyper Napalm, a widening cone that leaves the ground burning behind it.',
      'All five cover different ground on purpose. You only ever carry one at a time, so a weapon that was simply a worse version of another would be dead for the rest of your career.',
      'Squad has a Proto Frame section: field one, choose its weapon, and see at a glance that it cannot deploy without a Frame Pilot among your twelve.',
    ],
  },
  {
    v: '2.4',
    notes: [
      'Frames. A Frame is a Specialist war machine that cannot deploy on its own — it needs a Frame Pilot already standing on the board, and it lands on or beside that Pilot and takes them aboard. Two cards, two deployments, and a setup step the hive gets a turn to punish.',
      'Three of them. White Devil holds a lane behind a regenerating shield. Seven Blades wants to be standing exactly where you put it. Heavy Arms never moves, carries the heaviest hull on the field, and shells whatever is in front of it.',
      'A Frame carries a weapon you choose before the mission, not gear you bolt on during it. Frame weapons REPLACE the machine\'s service weapon rather than adding to it, and each one fits one Frame and nothing else — a Beam Saber is a White Devil weapon and will not go anywhere near a Rifleman. A bare Frame is always playable, just less specialised.',
      'Six weapons: Beam Rifle and Beam Saber for the White Devil, Crystal Greatsword and Crystal Longsword for Seven Blades, Laser Gatling and Missile Gatling for Heavy Arms.',
      'The Laser Gatling fires both forward diagonals and nothing at all through the centre. It is the only weapon in the game with a hole in its own pattern, and the card draws it.',
      'A destroyed Frame is not a destroyed Pilot. The Pilot ejects at one hull and stays on the board — you lose the machine, keep the person, and that Pilot can climb into another Frame later. If something is standing in the wreck, they go up with it.',
      'Squad only offers a card the gear it can actually take, and the Quartermaster shelves Frame weapons separately and says which Frame each one needs. Buying a Beam Saber with no White Devil is money gone.',
      'A deck carrying a Frame with no Pilot in it says so on the Squad screen, rather than letting you find out on the board with five deploy points spent.',
      'Fixed: a weapon firing at exactly three cells was blocked by your own two-cell units inconsistently — the rules cut the shot where the board had not dimmed the tile, so it struck from a cell that never lit up.',
    ],
  },
  {
    v: '2.3',
    notes: [
      'Hostiles go round dead ends. A bombardment crater used to park whatever was behind it for the rest of the mission, and a slow body plugged a lane for everything queued up behind it. Both step into an open lane now — a fast one keeps its tempo doing it, a slow one pays a turn. A unit of yours standing in front is still a fight, never a wall to walk around.',
      'New Specialist: the Ashura Frame. Sixteen hull, blocks a lane, and its scythes sweep the column ahead across three lanes at once. Crossing Cut slides it one lane toward the heavier side and cuts everything in front for 6.',
      'New hostile: the Oni Frame. The hive read the same brief. It does not queue and it does not wait — every step it crosses toward whichever lane is thinnest, so it will always turn up where you are weakest.',
      'Breaching Charge now lands at the end of the turn you call it, after the horde has moved, instead of at the start of the next. It is still a prediction — you aim at where a body will be — just a shorter one. A full turn was long enough for the column to empty itself.',
      'Nine new achievements, including a no-breach record, a seven-day Daily streak, the full uniform rack, and the deep end of Onslaught.',
      'Squad sorting applies to the Reserve only. The twelve cards in your deck are twelve you chose one at a time, and rearranging those on a preference takes something away.',
      'Gear in the locker looks like gear everywhere else in the game again — the same tile as the Quartermaster shelf, with the card carrying it printed on the front.',
      'Opening a piece of gear now leads with which card it is linked to. Tap that to unfold the full list of units, "None" included, instead of scrolling past a picker to find the answer.',
      'Every Central Command transmission control is the cycling dots, sign-off included.',
    ],
  },
  {
    v: '2.2',
    notes: [
      'The combat board holds its place. It used to jump upward the moment an alert appeared beneath it and drop back when the alert cleared — a measured 17.7px on a 1024px display, several times a mission. Nothing under the board can move it now.',
      'The objective panel keeps one shape for the whole mission. The losing conditions used to appear and vanish depending on how close you were to them, resizing the panel and shunting everything under it; they simply stay up, and the panel fills the room the board leaves rather than parking dead space above your hand.',
      'The combat log opens with the objective pinned to the top of it. Forty lines of history scroll underneath while the goal stays put — the log is where you go to work out what just happened, and losing the goal on the way there was backwards.',
      'The Shoulder Cannon is gear now, not a card. Fit it at the armoury and that unit fires twice from the moment it lands. If you had already bought the card, the piece is in your locker.',
      'A gear locker in Squad: every piece you own, what it does in full, and which card is carrying it. Tap one to choose where it goes. Gear used to be reachable only from inside a card, which asked the question backwards — you had to know which piece you wanted before you could read what any of them did.',
      'Fitting gear from a card now lists each piece with its rules text and where it currently is. It was a row of nineteen bare names, and one copy of each piece exists, so fitting one silently took it off something else. Both halves are now on screen before you tap.',
      'Squad can be sorted — A–Z, level, deploy cost, or geared first — and split by class the way the Quartermaster shelf is. The choice is remembered on your record.',
      'The gear on a card in hand is no longer a caption crushed under its name. The hand card carries a small ◈, and the piece and what it does are in View card, where there is room to read them.',
      'Every "next part" control in a Central Command transmission is the same cycling dots now, the sign-off included. A worded button in the middle of a call read as a decision; these are a beat of silence on an open channel.',
      'Tab rows that scroll sideways — Service Record, Database, the gear roles — fade at the edge instead of drawing a scrollbar under themselves.',
    ],
  },
  {
    v: '2.1',
    notes: [
      'Every mission now states its objective on the field, as an order rather than a score — with live progress, the wave clock, and the two ways to lose. It was previously a line in the header that no phone ever showed.',
      'A win says why it was a win. Every loss already named its reason; wins arrived with nothing but a kill count. Holding the line and clearing the field are now told apart, because they are not the same victory.',
      'Ground and Breaches under the board turn gold as they approach the line and magenta at it.',
      'Your hand holds six cards and the whole hand is on screen — one row, no sideways scrolling, on any size of screen. Cards size themselves to the display instead of a fixed width that fitted two of them on a phone.',
      'Cards that call in more cards — Recon Lark, Falconer — ignore the hand limit. You paid for those draws.',
      'A full hand holds the turn draw rather than discarding it. Nothing is ever lost to the limit; the card is waiting when you deploy.',
      'The hand no longer folds away, because it no longer needs to. The combat log took its place as the thing that folds, and it is a floating panel now instead of a column — so it is finally readable on a phone, where the log used to be desktop-only.',
      'Anything that happens TO you — a unit destroyed, a lane cratered, a breach — now surfaces under the board the moment it happens, instead of scrolling past in a log you had to go looking for.',
      'The combat board is a third larger on desktop, using the room the hand tray and log column gave back.',
      'Fixed: Eradication Blitz asked for ten hostiles in its briefing and nine in the mission.',
    ],
  },
  {
    v: '2.0',
    notes: [
      'Every card with a weapon now draws its firing pattern instead of describing it — the shape it covers, at a glance, no counting cells out of a sentence.',
      'Selecting a unit lights every tile its weapon reaches, not just the ones that already have something standing in them. Gold still marks what actually gets struck.',
      'Tapping a hostile now selects it the same way your own units do: its threat lights up, and Deselect / View card work on it too. Attacking still comes first — a hostile already in your sights is a target, not a thing to inspect.',
      'Card text is trimmed to the ability itself. Deploy cost, hull and class come off the stat block — all three were already printed on the card.',
      'Hostiles gained a Counter line: how to beat it, kept separate from what it does.',
      'Central Command calls ahead of every operation now. A transmission before the drop, paced by you — it plays once per operation, and Settings can reset them.',
      "Operation Shallowhelm's story is rewritten. The fortress anchors the whole line, a cult opened its gates from the inside, and the Self-Cleanse is now the Purge Protocol.",
      'Four new cards fight over the back line: Longshot and Sapper Turret reach into theirs, Rearguard and Backstop Battery defend yours. Optics Relay and Rear Sights join the gear list.',
      'Recon Lark and Backstop Battery are instants — they resolve and leave no body behind.',
      'New hostile: the Puppeteer. It never moves, and every third turn it seizes the nearest unit in its lane and turns it on you.',
      'New field event: Burrow Breach. The floor opens under a marked tile and swallows whatever is still standing on it.',
      'Field events explain themselves now — tap a research pod or a bombardment crater for what it is and how long it lasts.',
      'Civilian Extract is a shelter to hold rather than a scatter of static pods, and every operation has a signature hazard of its own.',
      'Pixel units on the grid have centred visors and redrawn weapons, so you can tell a Marksman from a Lancer without reading the label.',
      'The gear-fitting list groups by role, with a filter once you own enough to need one.',
      'A cleared operation stays cleared and offers a Replay button, instead of silently rolling a fresh set of missions behind you.',
      'Daily Challenge sits at the top of the mode list.',
      'Fixed: specialist card art was off-centre in its frame, and gauntlet packs let you keep a card without letting you look at it first.',
    ],
  },
  {
    v: '1.8',
    notes: [
      'The hand tray in combat now collapses, so you can see more of the board.',
      "Card art no longer prints the card's name a second time on top of the seal — and the seal is centred in the frame.",
      'Four new uniform schemes: Umber, Teal, Sand, Indigo.',
      'Quartermaster cleanup — fewer redundant labels in the shop.',
    ],
  },
  {
    v: '1.7',
    notes: [
      'Salvage is gone. Cards, gear and uniforms all spend the same credits now.',
    ],
  },
  {
    v: '1.6',
    notes: [
      '12 new cards and 6 new gear pieces join the roster.',
      'Requisition packs arrive a little slower, to make room for the bigger collection.',
    ],
  },
  {
    v: '1.5',
    notes: [
      'Daily Challenge: one mission a day, the same for every commander, with a streak to protect.',
      'Squad, Quartermaster, Database and Service Record each walk a new commander through once.',
      'Combat has its own music now, distinct from the hold screen.',
      'An animated title screen.',
    ],
  },
  {
    v: '1.4',
    notes: [
      'Turn events, lane charges, the Dynamo card, and enemy intent readouts.',
      'Achievements, and a pull-up drawer for quick settings mid-mission.',
    ],
  },
  {
    v: '1.3',
    notes: [
      "Every unit — yours and the hive's — gets a hand-drawn pixel sprite on the board.",
      'Purchasable uniform schemes for your whole roster.',
      'A darker, more tactical palette.',
    ],
  },
  {
    v: '1.2',
    notes: [
      'Ink-seal card art for every card, and chip-style tiles throughout the shop and squad screens.',
      'Desktop and compact interface modes.',
    ],
  },
  {
    v: '1.1',
    notes: [
      'Eight team leads, each with a passive and a stratagem call.',
      'Three new hostiles, three new campaign operations.',
    ],
  },
  {
    v: '1.0',
    notes: [
      'First release: campaign operations, lane-defence combat, Squad, Quartermaster and Database, local save records.',
    ],
  },
];
