# Ideas / Nice-to-Haves

Backlog for "when we've got tokens to burn" — not urgent, not scheduled, just things
worth coming back to. Add freely; check off or delete when done or no longer wanted.

- [ ] **Level Up tool shows a multi-level feature's entire description at
      every level, not just what's gained at the level being viewed.**
      Flagged by project owner (2026-09-02) while leveling up the new
      Jaygar. Real RAW pattern for a feature that grants something at
      several different levels (e.g. a subclass's always-prepared bonus
      spells) is just "You gain the following spells," with the actual
      per-level table understood from context — a player reading their own
      character sheet only cares about their current level's row. This
      app's version instead bakes the _entire_ table into one flat
      `description` string in `published_features.json` (e.g. "Arbalist
      Bonus Spells" / "Artillerist Bonus Spells" list all 5 breakpoints —
      3rd/5th/9th/13th/17th — in one blob), and `LevelUpTool.vue` renders
      that description verbatim next to the feature name
      (`featureDescriptions[name]`, populated via `lookupFeature()` in
      `LevelUpTool.vue` around line 735-740) with no level-awareness at
      all — so leveling up to 3rd shows the 5th/9th/13th/17th content too,
      confusingly. Fix needs to make the preview level-aware for these
      features specifically: where a subclass already has structured
      per-level data (e.g. `expanded_spell_list` in
      `engine/data/subclasses/*.json`, which already breaks spells out by
      the exact level they're granted), the tool should synthesize
      "what's new at _this_ level" from that instead of dumping the whole
      static description. Project owner explicitly flagged they hadn't
      read every feature description looking for more instances of this —
      likely other multi-level features (not just bonus-spell lists) have
      the same problem; worth a real audit pass across
      `published_features.json` for anything describing more than one
      level's worth of content in a single static string, not just a
      one-off fix to the spell-list features.

- [ ] **Cloak of Displacement doesn't match RAW — two copies, both wrong the
      same way.** Flagged by project owner (2026-09-02): "the RAW one feels
      very powerful to me." Confirmed: `party_items.json` has two equipped
      instances (`items_30`/Rhuna, `items_57`/Jaygar), both with identical
      `effect` text — "Attacks against you have disadvantage on the first
      attack roll each turn. Ends if you are incapacitated until the start
      of your next turn." Real RAW gives disadvantage on _every_ attack
      roll against the wearer each turn (not just the first), and the
      effect ends when the wearer _takes damage_ (not when incapacitated —
      that's actually a separate real clause about when the property
      doesn't work at all, e.g. while restrained/unable to move).
      `bg3_items.json`'s catalog entry for the same item is closer to
      correct ("subjects enemy attacks against its wearer to Disadvantage
      until the wearer takes damage") but is missing the
      incapacitated/restrained exception. Either fix both `party_items.json`
      instances to real RAW text, or if the weaker version was intentional
      homebrew, rename it so it's not presented as the real magic item.

- [ ] **Shields aren't consistently categorized — lets a character equip
      more than one.** Found 2026-09-02. `CharacterInventory.vue`'s
      equip-slot-conflict check (`canEquip`/`isSlotOverfilled`, around
      line 854-877) keys purely off the literal `item.slot` string, capped
      at 1 per slot value. Real shield items in `party_items.json` use two
      different `slot` values for the same conceptual slot: `Shield +2`
      (`items_211`) is `"offhand"`, while `Shield of Retribution`
      (`items_59`), `Shield of Expression` (`items_79`), and `Collapsible
Shield +2` (`items_115`) are all `"melee1h"` — the same slot used for
      one-handed melee weapons. So a character can equip a `melee1h` shield
      alongside an `offhand` one (or a real one-handed weapon) without
      tripping the slot cap at all. Needs: (1) pick one consistent slot
      value for shields (probably its own `"shield"` slot, distinct from
      `melee1h` weapons and `offhand` generically), (2) migrate all 4
      existing shield items to it, (3) decide whether `offhand` should be
      reserved for shields specifically or genuinely shared with off-hand
      weapons/items, since right now the slot taxonomy conflates several
      different real equip-slot concepts under a few loose string values.

- [ ] **Removing an item from a character sends it to the globally-active
      party's pool, not the character's own party.** Found 2026-09-02.
      `CharacterInventory.vue`'s `toPool`/`retrieveFromStorage`/
      `assignToParty` (lines ~903-948) all set `party_id:
this.activeParty?.id`, where `activeParty` (`store/index.js:694`) is
      whichever single party has `active: true` globally — not necessarily
      the party `this.character.name` actually belongs to (party membership
      is `party.members[]`, looked up nowhere in these methods). If a
      character belongs to Party B but Party A is the one currently flagged
      active (e.g. because that's what's selected elsewhere, like the
      Combat screen), taking an item off that character routes it into
      Party A's pool instead. Needs these methods to resolve the party
      containing the character being edited, not just read the global
      active flag.

- [ ] **Homebrew-flag audit — some entries marked `homebrew: true` are
      actually real published content, mislabeled.** Root cause identified
      2026-09-02 by project owner: an earlier session operated under the
      mistaken belief that only SRD + PHB material could legally be
      referenced (false — non-SRD sourcebook content, e.g. Tasha's
      Cauldron of Everything, Xanathar's Guide, Eberron: Rising from the
      Last War, is freely and legally available to look up on sites like
      dnd5e.wikidot.com; the actual legal line is around building/selling a
      commercial product, not caching reference text for personal use), so
      anything not found in the local SRD cache got stamped homebrew rather
      than verified against those other real books. Confirmed one concrete
      case during the 2026-09-02 Artificer audit: `pub_eldritch-cannon-
explosive-cannon` was labeled "homebrew extension... this specific
      higher-level detonate option is custom" but is actually the real,
      verbatim 9th-level Artillerist feature from Tasha's Cauldron of
      Everything (see `engine/CHECKLIST.md`/that audit's writeup) — now
      fixed. Scope: `src/data/published_features.json` has 37 entries
      flagged `homebrew: true`, `published_spells.json` has 4 — that's the
      full review pool (41 entries), not the whole file. A first pass
      sampling those 37 feature entries suggests most are correctly
      labeled (character-unique inventions, or reskins that already cite a
      real book for their base and explain what's custom about the
      extension) — so this is a verify-each-one-against-real-sources pass
      to catch the exceptions like Explosive Cannon, not a wholesale
      rewrite. Also worth a lighter follow-up: 230 of 396
      `published_features.json` entries and 181 of 186
      `published_spells.json` entries have no `homebrew` field at all
      (neither true nor false) — lower priority since most are likely
      legitimate SRD-cache pulls, but not yet confirmed either way. Don't
      start this now — do it as its own pass, same method as the Artificer
      audit (WebSearch/WebFetch against real sources, one report before any
      fixes).

- [ ] **Torrin needs a full rebuild — not a priority.** Project owner
      (2026-09-02): "I don't even use him, it was a bad concept." His
      `subclass` field is literally the string `"Soulknife / Mastermind"`
      (both real Rogue subclasses, combined into one string that doesn't
      resolve via `loadSubclass`) — a deliberate homebrew dual-subclass
      hack from an earlier session, not worth preserving or cleaning up
      since he's getting rebuilt from scratch eventually. No action needed
      until the project owner actually wants to rebuild him.

- [ ] **New Character tool has no class-level skill picker at all.** Found
      auditing Siv (Rogue 9, real level-up through the tool) — she only has
      2 of her expected 4 Rogue skill proficiencies. Turned out
      `selectedSkills` in `NewCharacterTool.vue` is wired only to the
      background's fixed 2-skill grant; no class file (`engine/data/
classes/*.json`) has any "choose N skills from this list" data at
      all, so there's genuinely nothing to prompt from yet. Needs: (1) real
      skill-choice data added per class (count + eligible list, verified
      RAW per class — 13 classes), (2) a second picker section in
      NewCharacterTool.vue for it, separate from the background section.
      Related, same root cause: nothing prompts for which skills get
      Expertise either (Rogue needs this at both level 1 and level 6), and
      no feature can grant a skill proficiency as a mechanical effect
      (Scout's Survivalist does this in real RAW — currently has to be
      applied by hand). See `engine/CHECKLIST.md` for the full Siv audit.
      Confirmed again 2026-09-02 on Jaygar's rebuild (2 skills instead of 4) — same root cause, same fix needed. Same gap exists for
      languages: nothing in the tool prompts for a background's "N
      languages of your choice" (Sage grants 2; Jaygar's had to be
      backfilled by hand) or a species' own automatic languages beyond
      Common — worth folding into the same picker work rather than a
      separate pass, since it's the same missing-choice-data problem.

- [ ] **[USER ACTION] Mine other chats for lore.** User has a lot of world
      lore (history, locations, factions, etc.) scattered across other chat
      conversations, not in this repo. Action item is on the user: go
      through those chats, pull out the lore/location/history content, and
      get it into `lore/` (see `lore/README.md` for the convention —
      `places/`, `history/`, `beasts/`, `factions/`, `people/`). Not
      something Claude can do — the source material only exists in those
      other conversations.

- [x] ~~Eldritch Knight / Arcane Trickster (third-caster spellcasting).~~
      Done 2026-09-01 — a subclass can now grant spellcasting a base class
      doesn't have (Fighter/Rogue's own `spellcasting.type` is `none`).
      Third-caster slot/cantrip/known tables added, `spellcasting.js`
      resolves class-or-subclass. Caught and fixed a real bug before it
      landed: a mundane subclass (Champion) was briefly resolving to a
      truthy `{type:'none'}` object instead of `null`, which would've shown
      an empty spellcasting summary for every mundane subclass in both New
      Character and Level Up tools. See `engine/CHECKLIST.md` for the
      full writeup, including the disambiguated "Spellcasting (Eldritch
      Knight)" / "Spellcasting (Arcane Trickster)" feature-name collision.

- [x] ~~Multiclassing — picking up a brand-new class isn't supported.~~
      **DONE 2026-09-01.** `diffLevelUp` now handles a genuine pickup
      (prerequisites checked as a soft warning, reduced proficiency list
      granted, HP correctly non-max at that "level 1"), and
      `LevelUpTool.vue` has a second "+ Multiclass into…" selector listing
      every class the character doesn't already have — including handling
      Cleric/Sorcerer/Warlock's subclass-at-level-1 case via a level-0
      placeholder entry. Full writeup in `engine/CHECKLIST.md`'s Phase 6
      section. Still-open sub-gap, unchanged from before: skill/tool
      proficiency choices the reduced list grants (Bard/Ranger/Rogue
      skills; Bard/Rogue/Artificer tools) aren't structurally modeled
      anywhere — surfaced as a warning telling the player to add it by
      hand, same as the New Character tool's missing class-skill picker
      below.

- [x] ~~Feature lookup is name-based, not ID-based — real collision risk.~~
      Done 2026-09-01, scoped to "data model now, content later" per project
      owner. All 45 class/subclass files now reference features by id
      (276 unique names audited: 265 matched an existing catalog entry,
      31 got new stub entries needing real descriptions later —
      `needs_description: true` is the filter to find them). 206 of 255
      `published_features.json` entries were missing an id entirely and got
      one backfilled. `lookupFeature(name, id)` now takes an optional id
      that short-circuits to an exact match. Existing character data (~24
      characters' already-saved `features[]`) intentionally NOT
      retroactively migrated — only features granted from this point
      forward carry an id. See `engine/CHECKLIST.md` for the full writeup.
      Still open: writing real descriptions for the 31 stub entries.

- [x] ~~Finish Iyani's Weave Attunement reskin past level 9.~~ Done
      2026-09-01 — turned out to be a misconception: Sorcerous Origins only
      ever get features at 1/6/14/18 (true for every origin, official or
      homebrew), so there was no 9-14 gap. Audited Iyani's sheet against the
      engine's real tables instead — already 100% RAW-correct at her actual
      level (9). What genuinely was missing: the 15-spell Weave Phase grid
      only existed on her own sheet, not as reusable subclass data — added a
      `weave_grid` field (+ `house_rules`) to
      `engine/data/subclasses/sorcerer-weave-attunement.json` so a brand-new
      Weave Attunement sorcerer has a real default grid to start from, same
      pattern as Great Old One's `expanded_spell_list`. New test verifies
      every grid spell resolves, is the right level, and the right school.
      See `engine/CHECKLIST.md` for the full writeup, including a latent
      schema bug this caught (SRD spell `school` field needed flattening).

- [ ] **Cantrip audit** (known-cantrip counts vs. RAW caps, similar to the
      known-spell-cap work). User wants to hold off until there's a real UI
      spell browser to see things more clearly first — don't start this
      blind against raw JSON.

- [ ] **Icons/colors for schools of magic, and colors per class.** Visual
      polish for spell/character UI — no design direction picked yet.

- [ ] **Real racial/background mechanical data — partially done.** The New
      Character tool (2026-08-26) auto-applies ability score bonuses for the 9
      standard PHB species (`engine/data/species.json`) plus the 4 homebrew
      species, and now (2026-08-27) has real skill proficiencies for a
      curated 40 backgrounds (`engine/data/backgrounds.json`, verified against
      a real reference table, not guessed). Still not covered: the ~320
      other unique backgrounds beyond the curated 40, and whatever the real
      scope of `src/data/api_data_cache/species.json`'s SRD flavor entries
      should be — that cache went missing and was rebuilt from dnd5eapi.co
      (2026-09-01, see `engine/CHECKLIST.md`); the rebuild only has the 13
      real races/subraces the API has, not the ~380 previously noted here,
      which the project owner says is too many and wants to reconcile
      against another hard drive before trusting either number. Expand the
      curated background list over time as specific ones are needed — the
      picker already has an "Other (custom)" escape hatch for anything not
      yet curated.

- [ ] **Starting equipment automation.** New characters don't get equipment
      auto-assigned — `backgrounds.json` has a partial equipment/gold list per
      background, but no per-class starting-equipment tables exist anywhere.
      Add gear through the normal items UI for now.

- [ ] **"Plan all levels ahead" preview toggle**, per the Character Builder
      Blueprint's New Character Mode wireframe — preview levels 2-20 in one
      pass rather than one level at a time. `describeLevelUp` already supports
      arbitrary level ranges; this would just call it repeatedly and build a
      UI for the result.

- [ ] **Kerra needs at least a partial rebuild/verification.** She's STR 20,
      but the user's point-buy/weighted-cost stat method (a real official 5e
      option, comfortable max ~17 at level 1) means STR 20 requires ASIs to
      have actually been spent getting her there — needs checking that her
      real level-up path (Fighter 1-4, then Warlock) could actually produce
      this, not just trusting the end-state numbers. User's suggestion:
      "might be easier and safer to just reset her to level 1 fighter and
      level her up completely through the [level-up] tool" once it exists —
      i.e. this is also a good real-world test case for the Level Up tool,
      now that it exists (see `engine/CHECKLIST.md`). Also still
      open from the 2026-08-26 audit: her `started: true` class was corrected
      to Fighter, which surfaced a real saving-throw mismatch (wis/cha
      recorded, str/con expected), and her known-spell count is 13 against a
      cap of 6 once a real `isBonusSpell` classification bug was fixed — a
      rebuild would resolve all of this at once rather than patching pieces.

- [x] ~~Fill remaining spell-cache gaps.~~ Done 2026-08-24 — all 344 unique spells
      across all 8 class spell lists now have full local text between
      `srd_spells_full.json` and `published_spells.json`. Added the 23 missing
      Paladin/Ranger spells (all smite spells, auras, and conjure/hunter's-mark-style
      spells), verified against real rules text.

- [x] ~~Fill remaining feat/feature-cache gaps.~~ Done 2026-08-24/25 — of 192 unique
      feature names referenced across `characters.json` + `companions.json`, 54 had
      no local resolution (would render blank in the UI popup, e.g. Lyria's
      "Abjuration Savant"). Added 54 entries to `homebrew.json`'s `features` array
      (racial traits, feats, class features, subclass features, and a few
      already-self-described entries just needed copying into the shared catalog).
      "Daunting Strike" (Enauweyn, Paladin Oath of the Crown) turned out to be a 3.5e
      maneuver (Shaken for 1 minute) with no 5e/5.5e equivalent — removed from
      Enauweyn's feature list entirely, since his Paladin kit is already RAW-complete
      for a level 9 Oath of the Crown Paladin without it (Divine Sense, Lay on Hands,
      Fighting Style, Divine Smite, Divine Health, Extra Attack, both Channel
      Divinity options, Aura of Protection, Divine Allegiance).

- [ ] **Build a real level-up tool.** Huge lift, but crucial — the user has been
      using the BG3 character-builder tool as a stand-in and it isn't exact RAW.
      Wants a tool that shows all available options at each level (ASIs/feats,
      subclass features, spell choices, etc.) per class/race, each tagged with the
      book/source it's from, unlike BG3's builder. Not scheduled — revisit when
      there's a large block of tokens/time to dedicate to it, likely its own
      multi-session project. (In progress as of 2026-08-25 — see `engine/CHECKLIST.md`
      for the rules-engine groundwork already built.)

- [ ] **Item-granted spells with per-spell charge costs aren't modeled at all.**
      Lyria's Staff of Power (`items_109`) grants 8 spells from a shared 20-charge
      pool, each spell costing a different number of charges per RAW (Magic
      Missile/Ray of Enfeeblement: 2, Fireball/Lightning Bolt: 3, Cone of
      Cold/Hold Monster/Wall of Force: 4-5, Globe of Invulnerability: 6) — right
      now it's 100% prose in `effect`, doesn't even use the existing
      `spells_granted` array other items use. Needs: (1) a structured way to
      list per-spell charge cost on an item, not just "spells_granted: [names]",
      (2) actual charge-tracking on cast (the item already has
      `charges_current`/`charges_max`/`charges_recharge`, but nothing decrements
      it per spell cast today), (3) the future spellbook UI reading this as one
      more spell source alongside class/feat grants. Bigger than a single-item
      fix — worth its own pass once a few more multi-spell charged items turn up
      so the schema is designed from real examples, not just this one.

- [ ] **Rebuild CharacterSheet.vue / CharacterCombatPanel.vue — hard to find
      things, lots of wasted space.** User's words: "these should really be
      the same component with some v-ifs probably, or break down their
      components into reusable chunks." Not top priority right now — revisit
      once there's a real block of time for a UI pass, separate from the
      engine/level-up-tool work.

- [ ] **Level-up UI: add a 4th "preview the future" section at the bottom.**
      Once the wizard/tabs and stats/spells panels exist (see the Character
      Builder Blueprint artifact from this project), add a section previewing
      what the next 3 levels of the currently-selected class would offer —
      lets a player quickly compare "stay in this class" vs. "multiclass here
      instead" without leaving the screen. `engine/rules/levelUp.js`'s
      `describeLevelUp` already returns exactly this shape (features gained,
      ASI levels, spell slot/known changes) for any level range, so this is
      mostly a UI consumer of what already exists, not new engine work.

- [ ] **Spellbook/spell-list color coding is inconsistent and needs a real
      pass.** Currently cantrips and unprepared spells look the same on some
      characters, all one color on others. Not urgent — the little circle
      icon is fine for now — but flagged for a future spellbook UI overhaul.
      See `engine/CHECKLIST.md`'s "spell readiness states" note for the full
      breakdown of states worth designing around.

- [ ] **Revven needs a flavor-appropriate signature spell.** He's a Cleric of
      a custom deity/calling, and had a spell called "Fast Friends" in his
      list that didn't resolve to anything real (not in any spell catalog —
      removed 2026-08-25, was likely never actually written). He was supposed
      to have something thematic here; needs the same treatment as Sixty
      Leagues Before Dusk (Therynv'l) or the Rootbound Ward/Broken Vein
      stones — a real homebrew spell tied to his deity, verified to slot in
      at whatever level/school makes sense, then written into `homebrew.json`
      properly (not left as a dangling name with no definition).

- [x] ~~Jaygar needs a proper from-scratch Artificer rebuild.~~ **DONE
      2026-09-02.** Old record deleted, rebuilt level 1→9 from scratch via
      the New Character + Level Up tools onto a new homebrew subclass,
      **Infused Arbalist** (`engine/data/subclasses/artificer-infused-
  arbalist.json`) — built on Artillerist's framework but reworked so his
      established alchemical heavy crossbow _is_ the bonded weapon directly
      (Calculating Arbalister/Infuse Weapon/Arcane Payload/Unstable Rounds/
      Twin Barrels) instead of a separately-summoned cannon object. Full
      design log lived in `JAYGAR_REBUILD.md`, now deleted per the project
      owner (its content either landed in the subclass/feature data itself
      or is superseded by it). Along the way this also caught and fixed 7
      real RAW errors in the pre-existing Artificer data (see
      `hb_artillerist_eldritch_cannon`'s fabricated explosion-on-0hp clause,
      among others — git history has the full list) and confirmed his old
      INT 20 was illegal under this table's point-buy rules (both ASIs had
      gone to feats); the new build reaches INT 20 by legally spending both
      ASIs (levels 4, 8) on stats instead.

      Backfilled by hand after the mechanical rebuild (still not covered by
      the New Character tool itself — see the gaps below): `id` (was
      missing entirely, see the ADD_CHARACTER note below), 2 more skill
      proficiencies (Investigation, Perception — the tool only applies a
      background's fixed skills, not the class's own "choose N" list, same
      root cause as the existing skill-picker TODO above), languages
      (Common/Gnomish racial + Elvish/Draconic for Sage's "two of your
      choice," none of which the tool prompts for at all), darkvision/
      hit_die/weapon_proficiencies (simple — none of which the tool writes),
      his 3 active infusions (Lantern of Revealing, Helm of Comprehending
      Languages, Clockwork Amulet — dropped Perfume of Bewitching per the
      project owner's read that it's "probably pointless"; the crossbow's
      and armor's old infusions no longer count at all, both now enchanter-
      made per the project owner rather than self-infused), the Arbalist
      Bonus Spells list (`arbalist_bonus_spells`, mechanically fixed/
      deterministic so safe to fill in), and restored image/appearance/
      persona_notes (corrected — the old notes claimed "two eldritch
      cannons active at level 9," which was never legal; that's now a real
      15th-level-only Twin Barrels effect).

      **Still open, deliberately not filled in:** his actual prepared spell
      list (`spells[]`) — an active build choice (which of the whole
      Artificer list to prepare, INT mod 5 + half level 4 = 9 total), not
      something to invent unilaterally. **Also flagged, not resolved:** his
      signature weapon is a *heavy* crossbow, which is a martial weapon —
      base Artificer only grants simple weapon proficiency, and nothing in
      Infused Arbalist grants martial proficiency either, so strictly he
      isn't proficient with his own bonded weapon. Needs a decision: give
      Infused Arbalist proficiency with the bonded weapon specifically (like
      Battle Smith's real "one type of martial weapon" grant), or reflavor
      to a light crossbow (simple, no gap) instead.

      **Two real app bugs found and fixed along the way, not Jaygar-
      specific:** (1) `ADD_CHARACTER` in `store/index.js` never assigned an
      `id` — every character built through New Character Tool (confirmed on
      both Siv and Jaygar) was silently missing one; fixed in
      `NewCharacterTool.vue`'s `characterShell()`, and backfilled `id` by
      hand on both existing records. (2) Selecting a feat with more than one
      ability-score option (e.g. Fey Touched, Fade Away) in the Level Up
      tool used to submit before the ability choice was made, which the
      engine correctly rejected — but the resulting error hid the entire
      level-up UI (including the picker needed to fix it) behind a bare
      error message, a real dead end. Fixed in `LevelUpTool.vue`'s
      `submitFeat()` (wait for the ability choice first) plus a "Dismiss"
      button on any error as a general safety net.

- [ ] **Siv needs a rebuild — her subclass doesn't exist. IN PROGRESS
      2026-09-01, currently mid-rebuild with no character record at all.**
      She was `Fighter` / `subclass: "Scout"`, but Scout is a real Rogue
      subclass, not a Fighter one. Concept (user's own words): "highly
      mobile, highly accurate, long range capable, but sometimes stealthy
      archer" — no sneak attack, so Rogue's out. Decided 2026-08-25: **Battle
      Master** fits best — fully mundane (no unwanted arcane-magic flavor,
      unlike Arcane Archer, the other real archer-flavored Fighter subclass),
      and its maneuvers map directly onto the concept (Precision Attack for
      accuracy, Evasive Footwork for mobility), same as any weapon including
      a bow.

      Approach chosen: full from-scratch rebuild via the real tools, both to
      fix her and to genuinely test the Level Up tool end-to-end (real-world
      test case, same idea floated for Kerra below). Her old level-9 record
      is gone — deleted after discovering her DEX 20 wasn't legally reachable
      via point buy alongside her established Sharpshooter + Mobile feats
      (would need two full ASIs on DEX alone, leaving no ASI for either
      feat). Also discovered along the way: the Level Up tool has no
      ability-score/point-buy step (only Hit Points / New Spells / Feature)
      — that only exists in the New Character tool, so a genuine from-scratch
      rebuild needs both tools, in that order, not Level Up tool alone.

      Her narrative fields (appearance, image, persona_notes, languages
      Common+Goblin) are saved outside the repo pending recreation — **not
      yet reattached to a new record**. Next steps: (1) create a fresh "Siv"
      via New Character tool — Human, point buy, Fighter, Fighting Style —
      user doing point buy live themselves; (2) reattach her saved narrative
      fields; (3) level her 1→9 via Level Up tool, subclass Battle Master at
      3 with real maneuver/superiority-die picks, ASI/feat choices at 4/6/8
      (keeping Sharpshooter + Mobile, one real ASI into DEX) — same
      collaborative process as Jaygar's rebuild below.

      Also found along the way: the Level Up tool's Hit Points step shows
      working Roll/Take-Average controls at level 1, but level-1 HP is
      always forced to max hit die per RAW regardless of what's picked
      (verified: clicked Roll 6 times live, HP never changed) — the controls
      just don't apply yet at that level. Minor, but worth a UI pass so
      level 1 doesn't show controls that silently do nothing.

- [x] ~~Ferghus's Oath of the Open Road and Torrin's Soulknife/Mastermind
      rebuild.~~ Done 2026-08-26 — see `engine/CHECKLIST.md` for the full data-
      recovery story (git history recovered the "Vow of the Open Road"
      mechanic that had been silently stripped in April; Torrin was actually
      already fully intact and just needed the 4 real Soulknife/Mastermind
      features he was missing added).

- [x] ~~Combat: need to rename an enemy mid-combat, especially duplicated
      ones.~~ Done 2026-08-25 — added a click-to-rename control both in the
      setup-phase enemy list (`CombatContext.vue`, plain input bound directly
      to the enemy) and in the battle-phase active-enemy header
      (`Battle.vue`, click-to-edit text mirroring the existing initiative-
      score-override pattern, emits `rename-enemy` up to `CombatContext.vue`).
      Verified via `vue-cli-service build` (compiles clean) and by matching
      an already-working pattern exactly — **not yet click-tested live in a
      browser**, flagging that explicitly rather than claiming full UI
      verification.
