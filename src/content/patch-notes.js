// Player-facing changelog. Unlike everything else under src/content, this is
// hand-authored rather than generated from reference/gridfall-data.json —
// it's prose for a person to read, not balance data. Bump VERSION and add a
// new entry to the front of PATCH_NOTES with every release worth telling a
// commander about; skip the ones that are pure internal cleanup.

export const VERSION = '2.17';

export const PATCH_NOTES = [
  {
    v: '2.17',
    notes: [
      'Bosses are PLATED now. Every hit that reaches a boss\'s hull loses one point of damage — a minimum of one always lands, and the Gantry\'s containment field still absorbs cleanly. Ten pings from massed small arms lose ten damage; two heavy shells lose two. The arithmetic of flooding the board with cheap rifles and out-shooting the hull is over: heavy guns, area strikes and the Proto Frame line are the boss answer they were always meant to be.',
      'The one exception is honest about itself: THE PRISM is crystal, not armor. It has no plating — it has reflection, and reflection was always its whole argument.',
      'Every hull was re-sized for the new arithmetic, and every fight re-measured — hundreds of simulated Kill Orders per boss. The whole roster now sits meaningfully harder than before: a boss is a wall you bring the right tools to, not a health bar you rush. The intel drawer shows each machine\'s plating, and the target line announces it on descent.',
    ],
  },
  {
    v: '2.16',
    notes: [
      'Lumenspire has a new heart, and it used to be a person. SUBJECT ONE — the research division\'s volunteer, spliced with hive DNA — holds the spire now. Whole, it walks at your line the way something heavy does and strikes everything within arm\'s reach when it arrives, screaming the dead of Meridian up as it comes.',
      'At half hull, THE SPLICE COMES APART. The human half runs — all the way to the deep board, and every turn it knits the hive half back together. The hive half hunts. You will work out quickly that shooting the one that runs is the efficient play. The game will not pretend otherwise, and neither will the hive half: put the human half down and there is nothing holding it back anymore.',
      'The Aperture has been decommissioned and its lens crated for study — somewhere, something that was learning from the spire\'s transmissions is still listening, and this is not the last the war has seen of that design.',
    ],
  },
  {
    v: '2.15',
    notes: [
      'One throne room, one throne. Crownring ends at the Summit Floor now: silence the four honor guards and the way to THE ENVOY opens — still in session, still diving beneath the wards, still choosing where it surfaces. Kill it and the operation is won. No second act behind it.',
      'The Concord has left the building — but not the war. What the Envoy was assembling has been withdrawn to somewhere deeper in the hive\'s plans, and somewhere deeper in ours. You will meet it again.',
    ],
  },
  {
    v: '2.14',
    notes: [
      'The Aperture fights like what it is now. Phase one is still the array — read the light, the marked lane burns a turn later, the sweep reverses at the edges. But at half hull the lens shatters from the inside, and what climbs out of the wreckage was a researcher once.',
      'Unbound, it is a hunt: one cell of spliced flesh and glass loose on the grid, closing two cells a turn on your nearest soldier and clawing the wounded first. Your area weapons lose their three-cell target the moment it tears free — the fight you finish is not the fight you started.',
      'It does not attack on the turn it climbs out. It stands where the lens was and looks at its hands. Then it runs.',
    ],
  },
  {
    v: '2.13',
    notes: [
      'The themes found their homes. The four-wing pilgrimage belongs to OPERATION CROWNRING now — the Concordat summit, where it always made sense: start at the Delegates\' Concourse, four wings in four directions, and a gated return to the center. The four Frames are no longer cult splices but HIJACKED HONOR GUARDS — the delegations\' own ceremonial Proto chassis, taken at their posts: the Pyreguard marches and burns, the Rimeguard freezes your deepest, the Stormguard arcs weapons dead, the Shardguard works the foundations.',
      'Silence all four wings and the Summit Floor opens — the Envoy is still in session, and now nothing bars your way to it. Kill it, and what it convened assembles: THE CONCORD, four guard chassis drawn into one mass, carrying one motion per turn in a readable rotation the wards telegraph. The hive\'s working copy of the alliance itself. At half hull the vote goes unanimous — two motions a turn.',
      'Fortress Shallow Helm got its own story back: the original fortress map — power the vault, arm the Purge Core, fight back to the Gatehouse — with THE RELIQUARY waiting at the end, and the congregation in the waves the whole way: zealots, lectors, choir wardens, and the hive they invited. The ward purge still spares only ground you hold, and zealot acolytes now answer every discharge.',
      'Lumenspire keeps what was always its: the fusion. The Aperture is the research division\'s own work — a human spliced with hive DNA, fused through the lens. One theme per operation, where each belongs.',
      'Every fight re-tuned after the reshuffle — escort species turned out to matter as much as hull — and all seven Crownring and Shallowhelm encounters sit in the fair-fight band. Bestiary kills carry across under the new names.',
    ],
  },
  {
    v: '2.12',
    notes: [
      'Operation Shallowhelm is a pilgrimage now. You start at the Nave — the fortress heart — with four chapel wings singing around you. Each wing ends in a Kill Order against a FALLEN FRAME: a stolen Proto Frame chassis with a cult pilot spliced into it by hive DNA. Silence all four, and something comes back to the altar. The way out is through it.',
      'THE IMMOLANT walks the pyre: its lane burns every turn, and then it steps one lane over — a procession you can read. THE DROWNED stands in the flooded chapel and stops your deepest soldier cold, no move, no fire. THE CONDUIT arcs your weapons dead while the soldiers holding them stand unharmed — bring more guns than it has lightning. THE OSSIFIED is rooted crystal on the Brood Mother\'s breach contract: stand on the mark and nothing surfaces.',
      'THE COMMUNION is all four at once. The congregation carries its dead Frames back to the altar and the altar takes them in — four pilots, one body, one hymn per turn in a rotation the wards telegraph: pyre, brine, dynamo, shard. Read the next hymn and position for the verse that is coming. At half hull the choir stops taking turns.',
      'And Shallowhelm fights like a fallen fortress should: against PEOPLE. Zealots run your lanes, Lectors read fortress rifles down them, Choir Wardens knit the wounded — human cultists in the waves from the first turn, with the hive they invited mixed through. The Reliquary is gone; the cult built something worse.',
      'Lumenspire\'s Aperture is no longer merely a machine. The tissue return off the lens housing reads human, spliced through with hive DNA — one of the researchers made it out of the dorms. Into the machine. The briefing and the after-action call now carry what that means.',
      'All five new fights were tuned through hundreds of simulated Kill Orders — the chapels land around a fair fight each, and the Communion sits where an operation finale belongs.',
    ],
  },
  {
    v: '2.11',
    notes: [
      'Every operation ends in a Kill Order now. Lumenspire, Crownring and Shallowhelm each got their own machine, their own Central Command briefing before the descent, and their own after-action call — six bosses, six operations, no extraction point left unguarded.',
      'THE APERTURE holds the Lumenspire — the research division\'s transmission lens with something living fused through it. It marks a lane of the grid a full turn before it burns it, and the sweep is mechanical: one lane over, reversing at the edges. Read the light and you never eat it; at half hull the fan opens to three lanes and reading it stops being optional. The dead of Meridian City walk for it.',
      'THE ENVOY sits where the Concordat\'s chair sits. Everything within arm\'s reach of the floor it holds is struck; every third cycle it dives beneath the wards — untouchable, while your clock keeps running — and surfaces where it pleases with its burrower delegation. At half hull it stops pretending the Summit Hall matters and starts surfacing on your side of the board.',
      'THE RELIQUARY is what the cult made of Fortress Shallow Helm\'s ward core. It charges the fortress grid on a countdown you can read, and when the wards fire, everything standing on ground you do not hold burns — the old friend-or-foe logic survived, inverted. Between purges it converts your held ground back, tile by tile. Hold your ground. Literally.',
      'Each new machine was run through hundreds of simulated Kill Orders and tuned into the same fair-fight band as the first three — and the combat theme already knows what to do with them: every boss opens at full arrangement, in its operation\'s own key.',
    ],
  },
  {
    v: '2.10',
    notes: [
      'A new combat theme, composed for this game and generated live — no track file, no loop splice, about a page of code. Four bars at 118 BPM in E minor with one deliberately wrong note: the F natural, borrowed from outside the key, is doing all the tension work, and the lead falls a semitone onto home to close every loop.',
      'The soundtrack is a readout now, not a recording. Combat opens on bare pads and a low root, and the arrangement listens to the fight: the driving bass, the kick and snare, the hats, the arpeggio and the lead each enter as the pressure climbs — how deep into the clock you are, how big the horde on the board is, breaches taken, ground lost. It moves one layer at a time, never lurches, and when you clear the board it thins back out. A fight that eases sounds like it eased.',
      'Bosses do not build. A Kill Order opens with the full arrangement from the first bar, filter wide open — a boss should not wait to sound like one. Phase two slams any fight to full, whatever the meters say.',
      'Every operation plays the theme in its own key. Ironveil as written, cold and mechanical; Blackmarrow a semitone down into the dark; Sunderglass a minor third up, bright and brittle; Lumenspire, Crownring and Shallowhelm each get their own cast. Same music, six colours, zero downloads.',
      'The hold keeps its own cruise — 92 BPM, unhurried — so stepping out of a fight still feels like stepping out of it. The Atmosphere switch in Settings governs all of it, as before.',
    ],
  },
  {
    v: '2.9',
    notes: [
      'Proto Frames fight like the prototypes they are. All three now aim in any direction — every weapon pattern strikes behind as readily as ahead, the Beam Rifle and Rail Cannon hunt both ends of the lane — and they step diagonally, a fencer\'s footwork the rest of the roster does not get.',
      'The Seven Blades carries the Crystal Longsword as standard now: one running thrust, three cells deep, fore or aft. Its old longsword gear slot became the ARM-MOUNTED BLADE — an ability, not a weapon swap. Piercing Thrust: pick an empty cell down the lane and the frame dashes there, running the blade through every hostile it passes. Your own line stops the dash; the horde does not. Anyone who owned the longsword holds the blade already.',
      'The after-action calls actually play now. The channel was wired to a door nobody used — walking away from your first boss kill through the result card skipped the debrief entirely. Fixed, and verified the long way.',
      'A Drop Pod on Hell Jumpers crushes what it lands on, as the card always said. Before this, the first pod could come down on a hostile tough enough to survive the impact and simply stand on top of it for the rest of the mission. Checked the books while in there: no, it cannot one-shot the Gantry — a full drop beside a boss is worth about ten points into the field.',
      'Units whose recharge weapon is cycling grey out on the board, and the Hecate Platform takes manual aim at any hostile on the board (deepest by default) — both from the last patch wave, now with the paperwork.',
      'Once the mission\'s Frame has flown, the Pilot retires from the reserve cycle — an unarmed body with its whole job done was the one truly dead redraw in the game, and the deck no longer deals it back.',
      'Your pilot answers to a callsign now. Open the Frame Pilot card in Squad and name them — the hand, the board, the deck list and every field report will use it. The one we heard was 行きます.',
    ],
  },
  {
    v: '2.8',
    notes: [
      'Operation bosses. Ironveil, Blackmarrow and Sunderglass no longer end at an extraction point — each ends at a Kill Order: one machine, a hard 18-turn clock, and a mission you win by bringing it down. The hive sends no waves; everything on the board is the boss\'s own work. Boss fights run a deploy point richer per turn.',
      'A boss fills a rectangle of cells and every one of them shares a single hull pool — so an area weapon lands once per cell it covers. Your cone, your sweep, your cross of warheads: that is the anti-boss arsenal, and nobody had to design it. Bosses block movement like terrain and cannot be crushed, netted or demolition-charged — only damaged.',
      'Every boss turns once, irreversibly, and loudly. THE GANTRY fabricates behind a 30-point containment field and does not fight — until the field breaks, and then every cell it has fires. Breaking the shield is what makes it dangerous; that is the decision.',
      'THE BROOD MOTHER works the field like a seam of ore: drifting across lanes, crushing what it rolls over, lashing whole rows, and marking breach points anywhere on the board a full turn before something surfaces. Stand a soldier on the mark and it takes the hit instead — nothing surfaces. At half hull it splits into three bodies, and all three must die.',
      'THE PRISM has never attacked anything. It reflects a quarter of every hit back up the barrel that fired it, past shields, and it can kill. At half hull it shatters into four fragments that each grow every turn — up to a cap, because a fight you cannot win is a bug wearing a difficulty costume.',
      'Bringing a boss down completes the operation and lands the Specialist requisition pack. First kills enter the Database, bestiary page and all.',
      'Central Command calls before every first Kill Order. Hikaru delivers the full sitrep on the machine you are about to fight — what it is, what it does to your line, and the read Command wants you to hear — before your descent is cleared. The call plays once; Replay intros in Settings brings all three back.',
      'And Command calls again after. Walk away from your first kill of each boss and the after-action channel opens: what the fight revealed, how far this goes, and what it means for the system. The yards were only the beginning — as of the Gantry\'s destruction, Zanshin Protocol is active system-wide.',
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
