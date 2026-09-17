// travel_events.js
// Content pool for the Travel Event wizard. Each entry is a "topic" — a
// situation that can arise while traveling. The wizard rolls a topic first
// (filtered by terrain + continent), then a Survival check picks which of
// the topic's five authored variants actually happens:
//   extremeBad / bad / mundane / good / extremeGood
//
// navigationRisk: topic is about the party's own way-finding. "Do you know
//   where you're going?" has three states (see KNOWS_WAY):
//     yes              — advantage on the roll; uses the default `variants`
//                         (wording assumes an established path/route exists)
//     general_direction — flat roll; uses `offPathVariants` if present
//                         (wording assumes no path, just a known bearing)
//     no               — disadvantage on the roll; also uses `offPathVariants`
//   Topics without navigationRisk ignore knowsWay entirely — always a flat
//   roll on `variants`. Topics with navigationRisk but no `offPathVariants`
//   just reuse `variants` regardless of path state (fine for topics whose
//   wording never assumed a path to begin with).
// combatFlagged: the bad/extremeBad variant describes real hostility — the
//   wizard offers a one-click link into the Encounter Generator for those.
//
// terrains: 'any' or an array of terrain ids this topic can come up on.
// continents: 'any' or an array of continent names this topic is limited to.
// {tracker} in variant text is replaced with the lead tracker's name.

export const TERRAINS = [
  { id: 'road', label: 'Road' },
  { id: 'grassland', label: 'Grassland / Plains' },
  { id: 'forest', label: 'Forest' },
  { id: 'swamp', label: 'Swamp / Marsh' },
  { id: 'mountains', label: 'Mountains' },
  { id: 'caves', label: 'Caves / Underground' },
  { id: 'water', label: 'Water Crossing' },
  { id: 'desert', label: 'Desert' },
  { id: 'snow', label: 'Snow / Tundra' },
]

export const KNOWS_WAY_OPTIONS = [
  {
    id: 'yes',
    label: 'Yes',
    blurb:
      'A known route or established path exists. Advantage against getting lost.',
  },
  {
    id: 'general_direction',
    label: 'General Direction',
    blurb: 'No established route, but you know which way to head. Flat roll.',
  },
  {
    id: 'no',
    label: 'No',
    blurb:
      "No route, no bearing — you're navigating blind. Disadvantage against getting lost.",
  },
]

export const CONTINENTS = [
  {
    id: 'Kaemahz',
    label: 'Kaemahz',
    blurb: 'The fantasy-familiar continent — grounded, traditional tropes.',
  },
  {
    id: 'Yetgrese',
    label: 'Yetgrese',
    blurb: 'Deliberately unusual — lean all the way into the wrongness.',
  },
]

export const TRAVEL_EVENTS = [
  {
    id: 'weather',
    label: 'Weather Turns',
    terrains: [
      'road',
      'grassland',
      'forest',
      'swamp',
      'mountains',
      'water',
      'desert',
      'snow',
    ],
    continents: 'any',
    navigationRisk: false,
    combatFlagged: false,
    variants: {
      extremeBad:
        'The sky breaks open without warning — a violent storm, or somewhere cold enough a full blizzard — forces emergency camp wherever shelter can be found. Visibility drops to nothing, gear gets soaked or frozen through, and the rest of the day is lost to it.',
      bad: 'The weather turns foul — hard rain, biting wind, or oppressive heat depending on the season — and the pace slows to a miserable crawl. Nothing dangerous happens, but everyone arrives at camp exhausted and irritable.',
      mundane:
        'The weather holds steady — overcast, mild, forgettable. The march continues at a normal pace with nothing worth remarking on.',
      good: 'The weather cooperates — clear skies, a cool breeze, easy footing. The party makes better time than expected, and for a while travel feels almost pleasant.',
      extremeGood:
        'The sky puts on a show — a perfect, cloudless day that opens up a sweeping view of the land ahead, or if evening falls, a sky full of stars bright enough to travel by. Spirits lift. Someone remarks it feels like a good omen.',
    },
  },
  {
    id: 'merchant',
    label: 'Traveling Merchant',
    terrains: 'any',
    continents: 'any',
    navigationRisk: false,
    combatFlagged: true,
    hostileTiers: ['bad', 'extremeBad'],
    encounterSource: 'humanoid',
    encounterSize: 'group',
    variants: {
      extremeBad:
        "A friendly-seeming merchant on the road turns out to be running a con — or worse, leads the party into an ambush once they're isolated enough to be worth robbing.",
      bad: 'The merchant they meet is unpleasant and dishonest — inflated prices, insults thinly disguised as haggling, and goods that turn out shoddier than advertised once examined closely.',
      mundane:
        'A merchant passes going the other way, hauling something unglamorous — salt, rice, nails — point to point. They trade a few words and a scrap of local news, then move on.',
      good: 'The merchant they meet is genuinely likeable — good stories, fair prices, and wares a cut above the usual. A pleasant break in the journey, and maybe a useful item changes hands.',
      extremeGood:
        "The merchant turns out to be exactly the right person to meet at exactly the right time — unusual goods, a genuinely useful rumor, or an offer too good to be entirely explainable. {tracker} can't quite say why, but it feels like luck.",
    },
  },
  {
    id: 'tracks',
    label: 'Tracks on the Trail',
    terrains: 'any',
    continents: 'any',
    navigationRisk: false,
    combatFlagged: true,
    hostileTiers: ['bad', 'extremeBad'],
    encounterSource: 'Beast',
    encounterSize: 'solo',
    variants: {
      extremeBad:
        '{tracker} finds tracks crossing the path — and realizes, a beat too late, that whatever made them has circled back and is watching the party right now.',
      bad: '{tracker} finds tracks crossing the path, fresh enough to be unsettling. Whatever made them is close, and hostile.',
      mundane:
        '{tracker} finds tracks crossing the path — cold, several days old, headed away from the route. Nothing comes of it.',
      good: '{tracker} reads the tracks easily: what passed, roughly when, and which direction it went. Useful to know, even if nothing comes of it directly.',
      extremeGood:
        '{tracker} reads the tracks like a page of text — species, age, direction, even pace — and realizes they point toward something worth investigating: a den, a cache, or a shortcut nobody else would find.',
    },
  },
  {
    id: 'fork_in_trail',
    label: 'Fork in the Trail',
    offPathLabel: 'No Clear Path',
    terrains: ['forest', 'mountains', 'road', 'desert'],
    continents: 'any',
    navigationRisk: true,
    combatFlagged: false,
    variants: {
      extremeBad:
        "The trail forks, and the markers — if there ever were any — are long gone. The party commits to a direction and walks for hours before admitting they're thoroughly lost, having doubled back through the same stretch twice without realizing it.",
      bad: 'The trail forks with no clear markers. {tracker} makes a call, but it costs time — the wrong choice, corrected an hour later, at the cost of daylight and patience.',
      mundane:
        'The trail forks. {tracker} reads the ground, picks a direction with reasonable confidence, and the party moves on without incident.',
      good: 'The trail forks, but {tracker} spots the signs immediately — worn stone, a bent branch, subtle but clear — and the right path is obvious.',
      extremeGood:
        'The trail forks, and {tracker} not only picks correctly but notices the fork itself is unusual — a deliberately hidden second path, likely known only to locals, that shaves real time off the journey.',
    },
    offPathVariants: {
      extremeBad:
        "There's no trail here, just terrain — and after pushing through it for hours in what should have been the right direction, the party has to admit they've lost true bearing entirely. Doubling back doesn't help; nothing here looks like anything they've already crossed.",
      bad: 'With no path to follow, {tracker} has to read the terrain itself — and gets it wrong. An hour is lost correcting course before the general direction feels right again.',
      mundane:
        "There's no trail, but {tracker} keeps a reasonable bearing by terrain and instinct alone. Slower going than a real path, but on course.",
      good: 'No trail exists here, but {tracker} reads the land — the lay of a ridge, the drainage of a slope — and holds a confident line toward the destination.',
      extremeGood:
        "{tracker} finds the most efficient route through pathless terrain as if one had always been there — reading wind, water, and stone together — and the party makes time that shouldn't be possible without a real trail.",
    },
  },
  {
    id: 'territorial_creature',
    label: 'Territorial Creature',
    terrains: [
      'forest',
      'mountains',
      'caves',
      'swamp',
      'desert',
      'snow',
      'grassland',
    ],
    continents: 'any',
    navigationRisk: false,
    combatFlagged: true,
    hostileTiers: ['bad', 'extremeBad'],
    encounterSource: 'Beast',
    encounterSize: 'solo',
    variants: {
      extremeBad:
        "Something large and territorial doesn't just notice the party — it's already closing the distance, and there's no good way around it. This is a fight.",
      bad: 'Something territorial blocks the way — posturing, loud, and clearly unwilling to let the party pass without a confrontation.',
      mundane:
        'Something territorial postures at a distance. The party gives it space, goes around, and it loses interest.',
      good: "Something that could have been territorial turns out to be more curious than aggressive, and keeps its distance once it's clear the party means no harm.",
      extremeGood:
        'The creature that could have been a threat turns out to be unexpectedly useful — its presence alone seems to have kept something worse away from this stretch of the route, or it leads the party toward safer ground before losing interest.',
    },
  },
  {
    id: 'water_crossing',
    label: 'Water Crossing Trouble',
    terrains: ['water'],
    continents: 'any',
    navigationRisk: false,
    combatFlagged: false,
    variants: {
      extremeBad:
        "The crossing goes wrong — the ferry's gone, the bridge is out, and the current is stronger than it looked. Someone very nearly goes into the water, and something important might not make it across dry.",
      bad: 'The usual crossing point is unusable — bridge out, ferryman absent — and the workaround costs real time and no small amount of frustration.',
      mundane:
        'The crossing takes a little longer than expected, but goes fine. Boots get wet. Nothing worse.',
      good: 'The crossing is easier than expected — a helpful local, a sturdier ford than the map suggested, or simply good timing with the tide.',
      extremeGood:
        'The crossing turns up something unexpected — a hidden ford, a friendly ferryman with useful information, or a shortcut across the water that saves real distance.',
    },
  },
  {
    id: 'canopy_blocks_sky',
    label: 'Canopy Blocks the Sky',
    terrains: ['forest'],
    continents: 'any',
    navigationRisk: true,
    combatFlagged: false,
    variants: {
      extremeBad:
        "The canopy closes overhead so completely that the sun disappears entirely. Hours pass with no way to check direction, and by the time the trees thin out again, nobody's certain how far off course they've wandered.",
      bad: "The forest canopy is thick enough to blur the sun's position for a long stretch. {tracker} keeps the party roughly on course, but 'roughly' costs time.",
      mundane:
        'The canopy is thick overhead, but the trail underfoot is clear enough to follow without trouble.',
      good: 'The canopy breaks just often enough for {tracker} to keep a solid bearing, and the party moves through the deep woods with real confidence.',
      extremeGood:
        '{tracker} reads the forest itself for direction — moss growth, root patterns, the lean of the branches — with enough precision to cut a meaningful shortcut through territory that would lose most travelers.',
    },
    offPathVariants: {
      extremeBad:
        "With no trail to anchor against, the canopy's cover erases the sun completely, and hours pass with no way to check direction. By the time the trees thin, nobody can say with confidence they're still headed the right way.",
      bad: "Deep, pathless forest and thick canopy combine badly — {tracker} keeps the general bearing, barely, but 'barely' costs real time.",
      mundane:
        "The canopy is thick and there's no trail to follow, but {tracker} holds a workable bearing by instinct and terrain.",
      good: '{tracker} reads gaps in the canopy and the lean of the trees to hold a confident bearing, despite there being no path at all.',
      extremeGood:
        '{tracker} moves through pathless deep forest as if it were mapped — canopy gaps, root patterns, the terrain itself all read at a glance — cutting a route that saves real time.',
    },
  },
  {
    id: 'cave_tunnels_split',
    label: 'Cave Tunnels Split',
    terrains: ['caves'],
    continents: 'any',
    navigationRisk: true,
    combatFlagged: false,
    variants: {
      extremeBad:
        'The tunnel splits into an unmapped warren, and after enough turns, nobody can say with confidence which way leads back out. Somewhere in the dark, something echoes — large, distant, and not proof that turning around will help.',
      bad: 'The passage splits more than the map showed. {tracker} picks a route, but it dead-ends, and backtracking costs time none of them wanted to spend underground.',
      mundane:
        'The tunnel splits, but the way is clear enough — a slight downward grade, air moving in the right direction — for {tracker} to keep the party on track without much trouble.',
      good: 'The tunnel splits, and {tracker} reads the airflow and stone-wear correctly on the first try. No time lost.',
      extremeGood:
        '{tracker} navigates the unmapped warren perfectly and notices something the map-makers missed — a natural passage that connects two points far more directly than the known route ever did.',
    },
    offPathVariants: {
      extremeBad:
        "This passage was never mapped, and there's no known route to fall back on. After enough blind turns, nobody can say which way leads back to the surface — and somewhere in the dark, something echoes.",
      bad: 'Unmapped tunnels branch more than expected. {tracker} picks a direction on instinct alone, and it dead-ends — backtracking costs time nobody wanted to spend underground.',
      mundane:
        'The tunnels are entirely unmapped, but {tracker} reads airflow and stone-wear well enough to keep a general bearing.',
      good: 'With no map to rely on, {tracker} reads the cave itself — air, water, wear — and holds a confident line through the dark.',
      extremeGood:
        '{tracker} navigates the totally unmapped warren as if born to it, and finds a natural passage the world has never had a map for — a genuine discovery, not just a shortcut.',
    },
  },
  {
    id: 'blizzard_whiteout',
    label: 'Blizzard Whiteout',
    terrains: ['snow'],
    continents: 'any',
    navigationRisk: true,
    combatFlagged: false,
    variants: {
      extremeBad:
        'Snow comes down hard enough to erase the horizon entirely. Within minutes nobody can say which way camp is, let alone the destination — and the cold is not a patient problem to have while lost.',
      bad: "A heavy snow squall cuts visibility to almost nothing for a stretch. {tracker} manages to keep the party moving roughly the right way, but it's slow, cold, miserable work.",
      mundane:
        'Snow falls steadily but visibility holds. The party presses on at a slightly reduced pace.',
      good: '{tracker} reads the wind and the drift patterns well enough to keep pace through snow that would otherwise slow the party considerably.',
      extremeGood:
        "{tracker} finds a route the snow itself reveals — a wind-scoured ridge, a frozen-solid shortcut across water that wouldn't hold in any other season — and the party makes excellent time despite the weather.",
    },
    offPathVariants: {
      extremeBad:
        'With no route to fall back on and the horizon erased by snow, nobody can say which way is which — and the cold does not wait patiently for the party to figure it out.',
      bad: "No trail exists to anchor against in this whiteout. {tracker} holds the general direction through sheer instinct, but it's slow, cold, miserable work.",
      mundane:
        'No path to follow and snow falling steadily, but {tracker} keeps a workable bearing.',
      good: '{tracker} reads wind and drift patterns well enough to hold a confident line, despite there being no trail at all to guide by.',
      extremeGood:
        '{tracker} finds a route the snow itself reveals, with no path to begin with — a ridge, a frozen crossing — and the party makes excellent time despite the odds.',
    },
  },
  {
    id: 'wildlife_moves_wrong',
    label: 'Something Unusual About the Wildlife',
    terrains: 'any',
    continents: ['Yetgrese'],
    navigationRisk: false,
    combatFlagged: true,
    hostileTiers: ['bad', 'extremeBad'],
    encounterSource: 'Beast',
    encounterSize: 'group',
    variants: {
      extremeBad:
        "The herd — if that's the word for it — moves as a single mind wearing a dozen bodies, and that mind has just noticed the party. It converges with a coordination that is deeply uncanny to watch, and unmistakably hostile.",
      bad: "A group of local creatures moves in that same unnerving unison Yetgrese wildlife is known for, and something about the party's presence has agitated it. It hasn't attacked — not yet — but it isn't leaving either, and the tension shows no sign of breaking on its own.",
      mundane:
        'A herd of local creatures passes by, moving in that same eerie unison, entirely uninterested in the party. Deeply unsettling to watch. Nothing happens.',
      good: "One creature breaks from the herd-mind's unison to approach alone — clumsy, almost startled by its own independence — before rejoining the group. Harmless, and strangely moving to witness.",
      extremeGood:
        'One creature breaks from the group and offers something — a gesture, an object, a direction indicated with unmistakable intent — before rejoining the unified motion of the herd. Whatever just happened, it felt like a gift.',
    },
  },
  {
    id: 'ground_breathing',
    label: 'The Ground is Warm and Breathing',
    terrains: 'any',
    continents: ['Yetgrese'],
    navigationRisk: false,
    combatFlagged: false,
    variants: {
      extremeBad:
        "The ground underfoot is warm, and — impossibly — it's rising and falling, slow and rhythmic, like breath. Whatever the party is standing on just shifted, and it did not appreciate the disturbance.",
      bad: "A wide patch of ground is unnervingly warm, and faintly, rhythmically moving. Nothing happens immediately, but everyone crosses it faster than they'd like to admit, and it's hard to shake the feeling of having trespassed.",
      mundane:
        "The ground here is oddly warm underfoot for no discernible reason. It's Yetgrese; nobody investigates too hard.",
      good: 'The warm ground here seems almost soothing to walk across — aches ease, exhaustion lifts slightly. Whatever it is, it means no harm today.',
      extremeGood:
        'Resting on the warm, faintly breathing ground leaves the whole party feeling genuinely restored — more than the short break should account for. Something vast and patient beneath the earth seems, for whatever reason, to like them.',
    },
  },
  {
    id: 'roadside_shrine',
    label: 'Roadside Shrine / Waystone',
    terrains: ['road', 'grassland', 'forest', 'mountains', 'desert', 'swamp'],
    continents: 'any',
    navigationRisk: false,
    combatFlagged: true,
    hostileTiers: ['extremeBad'],
    encounterSource: 'humanoid',
    encounterSize: 'group',
    variants: {
      extremeBad:
        "The shrine isn't what it appears — bandits have been using travelers' habit of stopping to pray as an easy ambush point, and the party has just made the same mistake.",
      bad: 'The shrine is in poor repair, vandalized or looted — an uneasy place to linger, and the feeling follows the party for the rest of the day.',
      mundane:
        'An old shrine or waystone sits at the roadside, worn and mostly forgotten. Worth a glance, nothing more.',
      good: 'The shrine is well-tended despite its age — someone still visits. A quiet moment of rest here genuinely helps; the party presses on a little steadier than before.',
      extremeGood:
        'The shrine offers something real — a moment of clarity, an unmistakable sense of being watched over, or, rarely, and never explained, a small and genuinely useful blessing that lingers for the rest of the journey.',
    },
  },
  {
    id: 'lost_cargo',
    label: 'Lost Cargo',
    terrains: [
      'road',
      'grassland',
      'forest',
      'swamp',
      'mountains',
      'desert',
      'snow',
    ],
    continents: 'any',
    navigationRisk: false,
    combatFlagged: true,
    hostileTiers: ['extremeBad'],
    encounterSource: 'Beast',
    encounterSize: 'solo',
    variants: {
      extremeBad:
        "The wrecked cart isn't as abandoned as it looked — whatever tore through this cargo in the first place never left, and it's not happy to be interrupted.",
      bad: 'A wrecked cart or dropped pack lies half-buried in the brush, its contents smashed, soaked, or rotted past any use. A wasted stop.',
      mundane:
        'A wrecked cart or dropped pack sits abandoned at the roadside, already picked clean by whoever passed before. A few unremarkable scraps remain.',
      good: 'A wrecked cart or dropped pack yields genuinely salvageable goods — nothing spectacular, but worth the few minutes it takes to collect.',
      extremeGood:
        'Whoever lost this cargo lost something valuable — coin, a well-made tool, or trade goods worth real money — and evidently never made it back for it.',
    },
  },
  {
    id: 'local_rumor',
    label: 'Local Rumor',
    terrains: [
      'road',
      'grassland',
      'forest',
      'swamp',
      'mountains',
      'desert',
      'snow',
    ],
    continents: 'any',
    navigationRisk: false,
    combatFlagged: false,
    variants: {
      extremeBad:
        "The 'helpful' rumor turns out to be bait — deliberately planted to send travelers somewhere they shouldn't go.",
      bad: 'A passing local shares a rumor that turns out to be stale, wrong, or already resolved by the time it would have mattered.',
      mundane:
        'A passing local, or a scrap of overheard gossip, offers a small and largely forgettable detail about the road ahead.',
      good: 'A genuinely useful rumor turns up — a hazard worth avoiding, a person worth meeting, or a shortcut worth knowing.',
      extremeGood:
        "The rumor points at something significant, specific enough that it's obviously worth following up on.",
    },
  },
  {
    id: 'old_battlefield',
    label: 'Old Battlefield',
    terrains: ['grassland', 'forest', 'swamp', 'mountains', 'desert', 'snow'],
    continents: 'any',
    navigationRisk: false,
    combatFlagged: true,
    hostileTiers: ['bad', 'extremeBad'],
    encounterSource: 'Undead',
    encounterSize: 'solo',
    variants: {
      extremeBad:
        "Something out here never stopped fighting the last battle, and it doesn't distinguish between old enemies and new arrivals.",
      bad: "Whatever's left on this old battlefield hasn't entirely settled — a restless presence makes itself known, and it isn't friendly.",
      mundane:
        'The ground here still shows the scars of some past battle — broken weapons, old bones, a churned and unnatural stretch of earth. Long since quiet.',
      good: 'The old battlefield yields something worth having, missed by whoever picked over it before — a serviceable weapon, a bit of coin, an old marker worth noting.',
      extremeGood:
        'Amid the old wreckage sits something genuinely valuable — a weapon or piece of equipment well beyond scavenger-grade, missed by everyone who came before.',
    },
  },
  {
    id: 'distant_smoke',
    label: 'Distant Smoke',
    terrains: [
      'road',
      'grassland',
      'forest',
      'swamp',
      'mountains',
      'desert',
      'snow',
    ],
    continents: 'any',
    navigationRisk: false,
    combatFlagged: true,
    hostileTiers: ['extremeBad'],
    encounterSource: 'humanoid',
    encounterSize: 'group',
    variants: {
      extremeBad:
        "The smoke marks a camp, and whoever's in it has already spotted the party coming — with clearly hostile intent.",
      bad: "The smoke leads to a burned-out ruin — a homestead or camp, recently and violently destroyed. Whoever did it is long gone, but the sight isn't easily shaken.",
      mundane:
        'Smoke rises on the horizon — a campfire, a chimney, a controlled burn. It resolves before the party gets close enough for it to matter.',
      good: 'The smoke marks a small, friendly camp — travelers or locals willing to share warmth, a meal, or a few minutes of conversation.',
      extremeGood:
        "The smoke leads to an unexpectedly welcoming stop — food, shelter, and good company, exactly when it's needed most.",
    },
  },
  {
    id: 'something_buried',
    label: 'Something Buried',
    terrains: [
      'road',
      'grassland',
      'forest',
      'swamp',
      'mountains',
      'desert',
      'snow',
    ],
    continents: 'any',
    navigationRisk: false,
    combatFlagged: true,
    hostileTiers: ['extremeBad'],
    encounterSource: 'Undead',
    encounterSize: 'solo',
    variants: {
      extremeBad:
        "Whatever's buried here didn't appreciate being disturbed, and it's no longer buried.",
      bad: 'A disturbed patch of ground turns out to be a grave — recently robbed, the contents long gone. An unsettling find, nothing more.',
      mundane:
        'A half-exposed object in the ground — a stone, a bone, an old marker — turns out to be exactly as unremarkable as it looks.',
      good: 'Something worth having lies half-buried nearby — an old cache, a dropped item, small but genuinely useful.',
      extremeGood:
        'The buried object is a real find — something old, valuable, and clearly not meant to be found by just anyone.',
    },
  },
  {
    id: 'old_mining_works',
    label: 'Old Mining Works',
    terrains: ['caves'],
    continents: 'any',
    navigationRisk: false,
    combatFlagged: true,
    hostileTiers: ['extremeBad'],
    encounterSource: 'Beast',
    encounterSize: 'solo',
    variants: {
      extremeBad:
        "The old works aren't as abandoned as the rust and rot suggest — something has moved in since the miners left, and it's already aware of the party.",
      bad: 'Old support beams groan overhead, and part of the passage has to be picked through rubble from a long-past collapse. Slow, unpleasant going.',
      mundane:
        'Abandoned mining equipment — carts, timber supports, rusted tools — litters the passage. Long since stripped of anything valuable.',
      good: 'The old works still hold a few overlooked tools or supplies, dusty but serviceable.',
      extremeGood:
        'A missed vein or a forgotten cache turns up among the old works — genuinely valuable, and entirely unclaimed.',
    },
  },
  {
    id: 'cave_swarm',
    label: 'Startled Swarm',
    terrains: ['caves'],
    continents: 'any',
    navigationRisk: false,
    combatFlagged: true,
    hostileTiers: ['bad', 'extremeBad'],
    encounterSource: 'Swarm',
    encounterSize: 'solo',
    variants: {
      extremeBad:
        "The swarm doesn't just startle and scatter — it surges toward the party, and there's nowhere to retreat to in the tunnel.",
      bad: 'A startled swarm of bats or insects floods the passage in a chaotic, biting rush before finally dispersing.',
      mundane:
        "A colony of bats or insects stirs at the party's approach, fills the passage with noise and motion, and settles again once they've passed.",
      good: 'The swarm scatters harmlessly at a distance, more spectacle than danger — an oddly striking sight in the dark.',
      extremeGood:
        'The disturbed swarm reveals something useful in its wake — a clear path forward, an overlooked side passage, or simply a spectacular, safe show worth remembering.',
    },
  },
  {
    id: 'crystal_formation',
    label: 'Crystal Formation',
    terrains: ['caves'],
    continents: 'any',
    navigationRisk: false,
    combatFlagged: true,
    hostileTiers: ['extremeBad'],
    encounterSource: 'Aberration',
    encounterSize: 'solo',
    variants: {
      extremeBad:
        "The crystal formation isn't just beautiful — something has made its home in or around it, and the party has just intruded.",
      bad: 'The crystal formation is genuinely striking, but the passage around it is treacherous — sharp, unstable footing costs time and no small amount of caution.',
      mundane:
        "A formation of natural crystal catches the torchlight beautifully. Worth a moment's pause, nothing more.",
      good: 'The crystal formation is stunning — and a portion of it is loose enough to carefully extract, worth a fair bit to the right buyer.',
      extremeGood:
        "The formation is extraordinary — rare enough that a piece of it alone could be worth a small fortune, and there's more here than the party can carry.",
    },
  },
  {
    id: 'cave_marking',
    label: 'Ancient Marking',
    terrains: ['caves'],
    continents: 'any',
    navigationRisk: false,
    combatFlagged: false,
    variants: {
      extremeBad:
        "The markings are a warning, and the party only realizes what they meant after it's already too late to heed it.",
      bad: 'Old markings cover a stretch of wall — deliberate, but faded and damaged beyond any real interpretation.',
      mundane:
        'Faint, ancient markings cover a stretch of wall — clearly deliberate, long since faded past any easy meaning.',
      good: 'The markings are legible enough to make out real meaning — a boundary, a warning, or a record of who passed this way before.',
      extremeGood:
        'The markings tell a genuinely significant story, complete enough to be a real discovery — the kind of thing a scholar would pay well to hear about.',
    },
  },
  {
    id: 'sudden_drop',
    label: 'Sudden Drop',
    terrains: ['caves'],
    continents: 'any',
    navigationRisk: false,
    combatFlagged: false,
    variants: {
      extremeBad:
        'The floor gives way without warning, and the fall is a long one — painful, and costly in more than just bruises.',
      bad: 'The floor gives way underfoot. The fall is short but rough, and whoever went down needs a hand back up.',
      mundane:
        'The floor drops away sooner than expected — a short scramble down and back up, nothing worse than scraped knees.',
      good: 'A drop in the floor turns out to be an easy, short climb down to a lower passage that actually saves time.',
      extremeGood:
        'The drop opens into an unexpected lower passage that connects back to the route far more directly than the known way — a genuine shortcut.',
    },
  },
  {
    id: 'something_already_here',
    label: 'Something Already Living Here',
    terrains: ['caves'],
    continents: 'any',
    navigationRisk: false,
    combatFlagged: true,
    hostileTiers: ['bad', 'extremeBad'],
    encounterSource: 'Monstrosity',
    encounterSize: 'solo',
    variants: {
      extremeBad:
        "Whatever's made this stretch of tunnel home is already awake, already aware, and already closing the distance.",
      bad: "Clear signs that something has claimed this stretch of tunnel as its den — and it's home, and unwilling to share.",
      mundane:
        "Old signs — bedding, bones, worn stone — suggest something has denned here before, but it's long gone now.",
      good: 'Whatever denned here has clearly moved on, leaving behind a few overlooked, genuinely useful scraps.',
      extremeGood:
        'The abandoned den yields a real find — something its former occupant collected and left behind, valuable and entirely unclaimed.',
    },
  },
  {
    id: 'debris_field',
    label: 'Debris Field',
    terrains: ['water'],
    continents: 'any',
    navigationRisk: false,
    combatFlagged: true,
    hostileTiers: ['extremeBad'],
    encounterSource: 'Beast',
    encounterSize: 'solo',
    variants: {
      extremeBad:
        "Something is still with the wreckage, and it's not willing to share whatever's left of it.",
      bad: 'Wreckage or cargo drifts past — already picked over, waterlogged, and worthless by the time it can be reached.',
      mundane:
        'Driftwood, wreckage, or lost cargo floats past — unremarkable, and not worth the effort to retrieve.',
      good: 'Salvageable debris drifts within easy reach — nothing spectacular, but worth pulling in.',
      extremeGood:
        "The debris includes something genuinely valuable, remarkably intact despite however long it's been in the water.",
    },
  },
  {
    id: 'fog_on_water',
    label: 'Fog on the Water',
    terrains: ['water'],
    continents: 'any',
    navigationRisk: true,
    combatFlagged: false,
    variants: {
      extremeBad:
        "The fog closes in completely, swallowing every landmark. {tracker} loses all sense of the crossing's far bank, and the party drifts well off the intended line before the fog finally breaks.",
      bad: "Fog rolls across the water thick enough to blur the far bank. {tracker} keeps the crossing roughly on line, but 'roughly' costs time and nerves.",
      mundane:
        'A light fog drifts across the water, but the known crossing point is easy enough for {tracker} to hold to without much trouble.',
      good: 'The fog breaks just often enough for {tracker} to keep a confident line across the known crossing, despite the poor visibility.',
      extremeGood:
        '{tracker} reads the water itself for bearing — current, sound, the pull of the crossing — with enough precision to cut straight across despite the fog, saving real time.',
    },
    offPathVariants: {
      extremeBad:
        "With no known crossing to anchor against, the fog erases every landmark entirely. The party loses true bearing on the water, and doubling back doesn't help — nothing here looks familiar in this soup.",
      bad: 'No known crossing exists here, and the fog makes reading the water by eye useless. {tracker} manages a rough bearing, but it costs real time and nerve.',
      mundane:
        'No known crossing, and fog besides — but {tracker} reads current and drift well enough to hold a workable line across.',
      good: 'With no known ford, {tracker} reads the water itself for a bearing — current, depth, the pull of the crossing — and holds a confident line despite the fog.',
      extremeGood:
        "{tracker} finds the most efficient line across pathless, fog-bound water as if it had always been mapped — reading current, depth, and drift together — and the party makes a crossing that shouldn't have been possible blind.",
    },
  },
  {
    id: 'waterlogged_gear',
    label: 'Waterlogged Gear',
    terrains: ['water'],
    continents: 'any',
    navigationRisk: false,
    combatFlagged: false,
    variants: {
      extremeBad:
        'The crossing goes wrong enough that real gear is lost to the water — soaked past saving, or gone entirely, swept away before anyone can grab it.',
      bad: "The crossing leaves a fair amount of gear soaked through — nothing lost outright, but plenty that'll need drying out before it's useful again.",
      mundane:
        'The crossing leaves boots and packs a little wetter than ideal. A minor annoyance, nothing more.',
      good: 'The party crosses drier than expected — good footing, careful packing, or simple luck keeps gear mostly untouched.',
      extremeGood:
        'The crossing goes better than anyone had a right to expect — gear stays completely dry, and the pace barely slows at all.',
    },
  },
  {
    id: 'old_wreck',
    label: 'Old Wreck',
    terrains: ['water'],
    continents: 'any',
    navigationRisk: false,
    combatFlagged: true,
    hostileTiers: ['extremeBad'],
    encounterSource: 'Undead',
    encounterSize: 'solo',
    variants: {
      extremeBad:
        "The wreck isn't empty — something went down with the vessel, and it's still aboard, and it's noticed the party.",
      bad: 'The old wreck is picked clean and structurally treacherous — exploring it costs time and nearly costs someone a nasty fall.',
      mundane:
        'A sunken or beached wreck sits half-visible in the water — old, picked over, and not worth the time to search further.',
      good: 'The old wreck still holds a few overlooked, salvageable items, worth the short detour to retrieve.',
      extremeGood:
        'The wreck yields a genuine find — cargo or fittings that survived remarkably intact, worth real money to the right buyer.',
    },
  },
  {
    id: 'territorial_aquatic_creature',
    label: 'Territorial Aquatic Creature',
    terrains: ['water'],
    continents: 'any',
    navigationRisk: false,
    combatFlagged: true,
    hostileTiers: ['bad', 'extremeBad'],
    encounterSource: 'Beast',
    encounterSize: 'solo',
    variants: {
      extremeBad:
        "Something large and territorial doesn't just notice the party in its water — it's already closing in, and there's no good way around it. This is a fight.",
      bad: 'Something territorial surfaces and blocks the crossing — posturing, loud, and clearly unwilling to let the party pass without a confrontation.',
      mundane:
        'Something territorial surfaces at a distance, postures, and loses interest once the party gives it space.',
      good: "Something that could have been territorial turns out to be more curious than aggressive, and keeps its distance once it's clear the party means no harm.",
      extremeGood:
        'The creature that could have been a threat turns out to be unexpectedly useful — its presence seems to have kept something worse out of these waters, or it guides the party toward safer footing before losing interest.',
    },
  },
]
