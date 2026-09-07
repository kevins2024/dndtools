# Ideas / Nice-to-Haves

Backlog for "when we've got tokens to burn" — not urgent, not scheduled, just things
worth coming back to. Add freely; check off or delete when done or no longer wanted.

- [ ] **Gems need a real system — current approach (one flat `contents[]`
      array per haul on a single "Gemstones" `party_items.json` entry,
      matching an even older pre-existing entry's own shape) isn't
      sustainable, but isn't a problem yet.** Flagged 2026-09-03 by project
      owner right after a second gem haul got added the same way the first
      one already existed (`items_163` and the new `items_236`, both named
      "Gemstones," both just an `effect` prose summary + a `contents[]` of
      `{type, value_gp, quantity}`). Works fine for two hauls; doesn't
      scale to spending/selling individual gems, merging hauls, or tracking
      total party gem wealth at a glance without manually reading through
      every "Gemstones" item entry and summing by hand. No specific design
      proposed yet — revisit once it's actually causing friction, not
      before.

- [x] ~~"Crowd" (project owner's homebrew group-of-mooks mechanic) needs a
      real home in the Combat tracker.~~ Done 2026-09-03. Source found
      2026-09-03 — it wasn't in this repo at all (confirmed by the
      2026-09-02 search below), the project owner re-stated it from memory
      and it's written up in full as a house rule, `src/data/house_rules.json`
      (name: "Crowd" — deliberately not "Swarm," which is already a real,
      distinct D&D creature type). Summary: up to 5 weak/uninteresting
      creatures merge into one tracked unit with pooled HP; a "Strength"
      rating (1 to n) steps down as HP crosses even thresholds of max HP
      and drives both AC/ability flavor and one of two interchangeable
      offense-scaling approaches (fewer attacks vs. weaker attacks — left
      as an open per-Crowd choice, not a settled default); AoE saves always
      succeed but damage is the normal halved amount multiplied by current
      Strength. Full mechanical text is in the house rule entry itself, not
      duplicated here.

      Built as: a new "Crowd" chip (1-5) on `EnemyStatsChipRow.vue`, stored
      through the existing generic `enemyMeta` override dict in `Battle.vue`
      (`setEnemyMeta('crowdSize', ...)`, no new state dict needed — same
      pattern as AC/attackBonus/etc.). Current Strength is fully derived
      (not stored) in a new `activeCrowdStrength` computed in `Battle.vue`:
      `ceil((currentHp / maxHp) * crowdSize)`, shown as a "Strength: X/n"
      badge next to the HP tracker whenever `crowdSize > 1`, with a tooltip
      reminding the AoE-damage formula. Deliberately did NOT add a stored
      "offense mode" toggle (fewer attacks vs. weaker attacks) — the
      existing "Attacks" chip is already manually editable each round, so
      the DM can apply either interpretation live without new UI; adding a
      mode selector would be enforcing a mechanic the app doesn't otherwise
      automate. Verified via `npm run build` only, per the Playwright-disabled
      rule — worth a quick manual check in the actual Combat tab: add an
      enemy, set Crowd to e.g. 5, set Max HP, apply damage, confirm the
      Strength badge updates and disappears again if Crowd is cleared.

      2026-09-02 note, kept for the record: searched this repo for the
      mechanic before its source was known — checked
      `src/data/house_rules.json`, `published_features.json`,
      `custom_items.json`, `monsters_index.json`, `companions.json`,
      `npcs.json`, and `lore/`, found nothing (the only "swarm" hits were
      generic bulk-imported bestiary entries like Adamantine Wasp Swarm,
      unrelated). Confirms it genuinely wasn't written down anywhere in
      this repo before now, not a search miss.

- [x] ~~Species/racial effects need the same treatment feats just got —
      whether a character used the standard species ability bonus should
      be recorded, and species traits need to actually show on the
      character sheet.\*\* Flagged 2026-09-02, same session as the ability-
      score-attribution gap above and directly related to it. Immediate
      case: Siv's DEX 20 has zero notes explaining it — project owner
      worked it out from memory (Human, standard +1-all racial applied:
      15 point-buy base → 16 after the Human +1 → 20 after two Rogue ASIs
      at levels 4 and 8) but had to reconstruct that by hand with no
      recorded trail, exactly the same problem as Jaygar's missing
      Fade Away. Two distinct asks, don't conflate them: (1) record
      _whether_ a character's build applied the species' standard ability
      bonus at all (not the mechanical bonus itself — `NewCharacterTool.vue`
      already has the `useSpeciesBonus` toggle for this at creation time,
      per its own code; the gap is that this yes/no isn't persisted
      anywhere on the resulting character record for later reference); (2)
      actual species traits (Darkvision granting mechanics aside — real
      _named_ traits like Fey Ancestry, Lucky, Brave, Stout Resilience,
      Gnome Cunning, etc.) need to render on the character sheet the same
      way `FeaturePillsPanel.vue` now shows feats with a star marker — right
      now `engine/data/species.json`'s `subraces[].traits` (added during
      the subrace work) has real trait data with nowhere on an actual
      character record to land, and standard-species-level traits (e.g.
      Human has none, but Elf/Dwarf/Halfling do via their subrace) have no
      home either. Likely needs a `species_traits` or similar array on the
      character schema, populated at creation time from
      `engine/data/species.json`, and a render path in
      `FeaturePillsPanel.vue` (or wherever feats' star-marker pattern
      lives) alongside feats and class features rather than a fourth
      separate UI location.

      **DONE 2026-09-03** — this entry itself had gone stale (still marked
      open after the work landed); corrected after directly confirming in
      the code: `species_traits` on the character record, populated at
      creation by `NewCharacterTool.vue` from `engine/data/species.json`,
      rendered in `FeaturePillsPanel.vue` alongside feats with its own
      marker. Same build also did the ability-score-history entry directly
      below.

- [x] ~~Ability score increases (ASI and a feat's own bump) aren't recorded
      anywhere — only the final folded-together number survives.** Found
      2026-09-02: Jaygar's INT showed 20 with no way to tell it was 2 ASIs,
      or (his real history) one +2 ASI plus Fade Away's +1 INT — the feat
      pick itself had silently failed to save (see the entry below, now
      fixed by hand for Jaygar specifically) and even if it hadn't, nothing
      would have shown _which_ level or _source_ each point came from.
      `diffLevelUp.js` applies both ASI and a feat's `ability_score_increase`
      by directly mutating `stat_int`/etc. via `bumpAbilities` — the engine's
      newer feat-catalog work already attributes a feat's _other_ effects
      properly (flat bonuses like Alert's +5 initiative, saving throw
      grants, all via `stat_bonuses` on a real feature entry, per
      `engine/CHECKLIST.md`), but the ability-score bump itself erases the
      trail. Project owner's own words: "They aren't just choosing stats,
      they're choosing feats with effects and abilities, of course they
      need recorded!" Real fix needs each ability-score increase (ASI or
      feat) recorded as an attributable entry (level, source, amount) —
      touches `diffLevelUp.js`'s application logic, the character schema
      (every existing character's `stat_str` etc. currently means "the
      final number," not "base" — changing that meaning needs either a
      migration or a parallel history field, not a silent redefinition),
      and the ability-score tooltip in `dnd_utils.js`/`CharacterSheet.vue`
      to actually render the breakdown once it exists. Explicitly not
      started — project owner wants to hold this for "when I have more
      tokens," not do it piecemeal per-character. **Project owner's
      explicit caution: "We can't go rebuilding all our characters when
      the tool is lacking!"\*\* — i.e. don't treat other from-scratch
      rebuilds (Kerra, etc.) as blocked on this specific gap, but do flag
      it before starting one.

      Correction (twice), 2026-09-02, same day, later in session — first
      guess ("crash ate it") and second guess ("no way to redo a past
      level's choice") were both wrong; project owner clarified the real
      sequence: the crash hit during the original 7→8 level-up attempt
      (unsaved, forcing a full redo of that level), and the *second*
      attempt picked Fade Away successfully through the UI with no crash,
      at the correct level, in a normal forward in-progress level-up — not
      a retroactive edit. So why didn't it persist? Because at that point
      in the session, the feat-application code was still in its earliest
      form (only Fey Touched/Shadow Touched existed) and — per the later
      72-feat-catalog task's own report, which explicitly says it
      "extended feat application beyond ability scores" — it only ever
      applied a feat's ability-score bump directly to the raw stat; there
      was no mechanism yet to record the feat itself as an inspectable
      feature entry at all. The ability-score half worked correctly (which
      is why Jaygar's INT math always checked out); the identity of *which
      feat* granted it had nowhere to go until that later task built the
      `type: 'feat'` feature-record mechanism (`ability_choice`,
      prerequisites, etc.) in `diffLevelUp.js`. Jaygar's record is simply a
      snapshot from before that mechanism existed, never revisited since —
      not a live bug. Confirmed the current pipeline is correct end to end
      (`diffLevelUp.js`'s `patch.features = [...character.features,
      ...newFeatures]` → `LevelUpTool.vue`'s `confirmLevelUp()` commits
      `preview.patch` wholesale → `APPLY_LEVEL_UP` spreads it onto the
      character) — a feat picked today, going forward, should record
      correctly. No further action needed on the historical-loss question;
      the only remaining real gap is the attribution/breakdown one this
      entire entry is actually about.

      **DONE 2026-09-03** — this entry had gone stale too (still marked
      open after landing); corrected after confirming directly in the
      code: `diffLevelUp.js` now records `ability_score_history` (additive
      — `stat_str` etc. still mean "the final number," no migration of
      existing characters), and the ability-score tooltip renders a real
      breakdown (e.g. "20 = 15 base + 2 racial + 2 ASI (lvl 4) + 1 Fade
      Away (lvl 8)") when history exists, degrading gracefully to a flat
      number when it doesn't. Verified live (pre-Playwright-disable) on
      Jaygar's real sheet.

- [x] ~~Level Up tool shows a multi-level feature's entire description at
      every level, not just what's gained at the level being viewed.~~
      **DONE 2026-09-03** for the specific case flagged (Arbalist/
      Artillerist Bonus Spells). `LevelUpTool.vue` now has
      `bonusSpellsDescriptionAtLevel(name, level)`, called from
      `loadFeatureDescriptions` before it falls back to the static catalog
      lookup: for any feature name matching `/bonus spells/i`, it resolves
      the character's actual subclass from `store.state.subclasses` (same
      app-wide data `spellUtils.js`'s `getBonusSpells` already uses) and
      synthesizes "New at level N: X, Y — always prepared..." straight from
      `expanded_spell_list[level]`, instead of showing the full 5-breakpoint
      blob from `published_features.json`. Verified `npm run build`
      compiles clean, per the Playwright-disabled rule — worth leveling an
      Artillerist/Infused Arbalist character to 3rd in the actual tool to
      confirm the tooltip now shows only "Shield, Thunderwave" instead of
      all 5 breakpoints.

      **Follow-up DONE same day:** levels 5/9/13/17 don't re-grant the
      "Bonus Spells" feature (`features_by_level` only lists it once, at
      level 3), so nothing hung a description on those later breakpoints —
      added a `newBonusSpellsThisLevel` computed (`LevelUpTool.vue`) that
      reads `currentSubclassData.expanded_spell_list[targetLevel]`
      independent of `newFeatures`, and a concise "Bonus spells gained: X,
      Y" line in the Step 3 panel whenever it's non-empty. Suppressed on the
      level the feature itself is first granted (3rd) so it doesn't
      duplicate the tooltip text from `bonusSpellsDescriptionAtLevel` above
      — both now share one `currentSubclassData` computed rather than each
      re-resolving the subclass lookup.

      **Real pre-existing bug found and fixed while scoping this — not
      Artificer-only, and that's exactly what surfaced it**: `engine/data/
      subclasses/*.json`'s `expanded_spell_list` field is used by 6
      subclasses, not just Artillerist/Infused Arbalist —
      Alchemist/Armorer/Battle Smith (also Artificer, same real "auto-
      prepared bonus spells" mechanic, just missing a dedicated feature
      entry to hang a name on) and **Warlock's Great Old One**, which reuses
      the identical data shape for a genuinely different 5e mechanic
      (spells *added to the pool you can choose to learn*, not auto-
      granted). `spellUtils.js`'s `getBonusSpells` — which both the live
      Spellbook UI and my new `newBonusSpellsThisLevel` above are built on
      — didn't distinguish the two, so **Kerra (Warlock 5, Great Old One)
      was already, in production, being shown Dissonant Whispers/Tasha's
      Hideous Laughter/Detect Thoughts/Phantasmal Force/Clairvoyance/
      Sending/Dominate Beast/Evard's Black Tentacles/Dominate Person/
      Telekinesis as always-prepared bonus spells she'd never actually
      chosen to learn** — a real, live display bug, unrelated to today's
      Level Up tool work except that gating my new addition by class is
      what caught it. Fixed both `getBonusSpells` (`spellUtils.js`) and
      `newBonusSpellsThisLevel` (`LevelUpTool.vue`) to gate on
      `class === 'Artificer'` — the actual real-RAW distinction, not a
      guess. Worth a look at Kerra's Spellbook tab to confirm her spell
      list shrank to what she's actually supposed to have.

      **"Destroy Undead" — also DONE 2026-09-03, small follow-up.** Turned
      out `cleric.json` already had a real, unused
      `destroy_undead_cr_by_level` table (`{"5": 0.5, "8": 1, "11": 2, "14":
      3, "17": 4}`) sitting in the class data — so no new schema was needed,
      just the same treatment as Bonus Spells. Bigger finding along the
      way: base Cleric's `features_by_level` was missing **Channel Divinity
      (1/rest), Turn Undead, Destroy Undead, and Channel Divinity's 2/rest
      and 3/rest upgrades entirely** — none of core PHB Cleric's Channel
      Divinity progression (levels 2, 5, 6, 18) was wired into the class
      file at all (only levels 1/10/20 existed), so any Cleric leveling
      through the tool never actually received these — they only existed on
      2 characters' records because someone added them by hand. Fixed by
      adding the 4 missing `features_by_level` entries (ids already existed
      in the SRD cache — `channel-divinity-1-rest`,
      `channel-divinity-turn-undead`, `channel-divinity-2-rest`,
      `channel-divinity-3-rest` — plus `pub_destroy-undead-cr-1`), verified
      against `dnd5eapi.co`'s own level fields for each. Added
      `destroyUndeadDescriptionAtLevel` (grant-level tooltip, level 5) and
      `destroyUndeadCrIncreaseThisLevel` (a concise "Destroy Undead
      threshold rises to CR X" line at 8th/11th/14th/17th, mirroring
      `newBonusSpellsThisLevel`) to `LevelUpTool.vue`. All 196 engine tests
      still pass; `npm run build` clean. Worth leveling any Cleric to 2nd
      through 18th in the tool to confirm Channel Divinity/Turn Undead/
      Destroy Undead now actually show up as real feature grants.

      The project owner's original ask for a fuller audit pass across
      `published_features.json` for other multi-level-blob descriptions is
      still open — a pattern-based search (3+ distinct "Nth level"
      ordinals) only turned up these two, but wasn't exhaustive (other
      phrasings like "at level X you gain..." wouldn't match), and this
      Cleric gap suggests other classes may have similar missing-features
      holes worth checking too, not just description-formatting issues.

- [x] ~~Cloak of Displacement doesn't match RAW.~~ **DONE 2026-09-03.** Both
      `party_items.json` copies (`items_30`/Rhuna, `items_57`/Jaygar) had
      identical wrong text ("disadvantage on the first attack roll each
      turn... ends if incapacitated"). Fixed to real RAW (verified via web
      search): disadvantage on _every_ attack roll against the wearer,
      ends when the wearer _takes damage_, suppressed while incapacitated/
      restrained/unable to move.

- [x] ~~Shields aren't consistently categorized.~~ **DONE 2026-09-03.**
      Found a 5th shield the original audit missed —
      `Hlifar'dhe'gar` (`items_184`, Rith/Eldi's transforming construct
      shield) — it's a real "+1 small shield" per its own effect text but
      had no `armor_type: "shield"` tag, so a name/armor_type search alone
      wouldn't have caught it. All 5 shields (`items_59`, `79`, `115`,
      `184`, `211`) now share one consistent `slot: "shield"` (a new value,
      distinct from `melee1h`/`offhand`) and `Hlifar'dhe'gar` got its
      missing `armor_type: "shield"` tag added too. No code change needed
      — `CharacterInventory.vue`'s slot-cap logic already defaults any
      unlisted slot string to a cap of 1. Verified live (Rhuna's Equipment
      tab), build clean.

- [x] ~~Removing an item sends it to the globally-active party's pool, not
      the character's own party.~~ **DONE 2026-09-03.** Same root cause as
      several other bugs this project — "whichever party is globally
      active" standing in for "the party this action actually concerns."
      Added a real `characterParty` computed to `CharacterInventory.vue`
      (resolves the party whose `members[]` actually contains
      `this.character.name`) and renamed every one of the 13 places the
      component used the global `activeParty` getter instead — both the
      pool-assignment methods (`toPool`/`retrieveFromStorage`/
      `assignToParty`/`assignAllToParty`) and the display logic (which
      pool's items show, "Claim all for X" labels). Verified live, no
      console errors, build clean.

- [x] ~~Homebrew-flag audit — some entries marked `homebrew: true` are
      actually real published content, mislabeled.~~ **DONE 2026-09-03.**
      Root cause (2026-09-02): an earlier session mistakenly believed only
      SRD + PHB material could legally be referenced, so anything not in the
      local SRD cache got stamped homebrew rather than checked against real
      non-SRD sourcebooks (Tasha's, Xanathar's, Eberron, etc. — all legally
      referenceable, per `dnd5e.wikidot.com` and similar). Pool had grown to
      42 flagged features + 5 flagged spells by the time this ran (more
      character-specific item/feature work landed between the original scan
      and this pass). WebSearch/WebFetch-verified the entries most likely to
      repeat the earlier `pub_eldritch-cannon-explosive-cannon` mistake
      (claims "real feature X as a base, homebrew-extended" — exactly the
      pattern that caught Explosive Cannon): - `pub_primal-companion` (Ranger, Beast Master) — its description
      turned out to be pure real RAW (shares initiative, Dodges unless
      commanded) with **no actual custom mechanics of its own** — the
      genuine house-rule (a fully independent turn instead of Dodge) lives
      entirely on the separate `pub_independent` feature. Reclassified
      `pub_primal-companion` to `homebrew: false` with a real TCE
      citation; left `pub_independent` as `homebrew: true` (and gave it an
      explicit `homebrew` field — it was missing one despite its own
      source text already saying "Homebrew"). - `pub_insightful-fighting-revised` (Rogue Inquisitive) — verified
      against real XGE text: adds a genuine new crit-fishing mechanic
      (matching d20 result to the Insight roll triggers an automatic
      crit) not present in RAW. Correctly homebrew, left as-is. - `pub_tactical-foresight` (Rogue Mastermind, Torrin) — verified
      against real XGE Master of Tactics: the repo's saving-throw-bonus/
      two-ally mechanic isn't in RAW at all. Correctly homebrew, left
      as-is. - `pub_aasimar-transformation` — verified against Volo's Guide: real
      Aasimar RAW is a fixed one-of-three pick at 3rd level, not a
      per-use choice among all three. Correctly homebrew, left as-is. - The 4 pre-existing homebrew spells (Undead Ward, Starfall, Smite
      From Afar, The Stones Agree) — quick pass confirmed none are a real
      published spell reinvented under a new name (closest analogs like
      Magic Circle/Guiding Bolt/Elemental Weapon differ mechanically).
      Correctly homebrew, left as-is.

      The remaining ~38 flagged entries (character-unique magic-item
      abilities, Torrin's narrative-only Legendary features, Weave
      Attunement's Lunar Sorcery reskins, the Infused Arbalist subclass,
      etc.) already cited their real basis where one exists and correctly
      described what's actually custom — no other mislabels found. Verified
      `npm run build` compiles clean.

      **Not doing the "missing `homebrew` field" follow-up** (230 of 396
      `published_features.json` entries, 181 of 186 `published_spells.json`
      entries with no field at all) — project owner's call 2026-09-03: an
      absent field already reads the same as `homebrew: false` everywhere
      it's checked, so there's nothing to fix.

- [ ] **Torrin needs a full rebuild — not a priority.** Project owner
      (2026-09-02): "I don't even use him, it was a bad concept." His
      `subclass` field is literally the string `"Soulknife / Mastermind"`
      (both real Rogue subclasses, combined into one string that doesn't
      resolve via `loadSubclass`) — a deliberate homebrew dual-subclass
      hack from an earlier session, not worth preserving or cleaning up
      since he's getting rebuilt from scratch eventually. No action needed
      until the project owner actually wants to rebuild him.

- [x] ~~New Character tool has no class-level skill picker at all.~~ **DONE
      2026-09-03.** Found auditing Siv (Rogue 9, real level-up through the
      tool) — she only had 2 of her expected 4 Rogue skill proficiencies;
      confirmed again the same day on Jaygar's rebuild (2 skills instead of
      4). Root cause was `selectedSkills` in `NewCharacterTool.vue` being
      wired only to the background's fixed 2-skill grant, with no class file
      having any "choose N skills" data at all. Fixed: real `skill_choices`
      data added to all 13 `engine/data/classes/*.json` (verified RAW per
      class against dnd5e.wikidot.com + a second source), a second picker
      section added to the Class tab, kept structurally separate from the
      background picker with cross-disable in both directions so a
      background/class skill overlap can't double-grant (real RAW: pick a
      replacement instead). Same pass also closed the parallel language gap:
      real `language_choices` per background (Sage's 2, the case that
      motivated Jaygar's manual backfill) and real `languages` (automatic +
      flexible choice) per species, each with their own picker. Full writeup
      in `engine/CHECKLIST.md`. **Still open, deliberately not folded in**:
      Expertise skill selection (Level Up tool concern, not New Character)
      and a feature mechanically granting a skill proficiency (Scout's
      Survivalist) — both flagged as separate, out-of-scope work rather than
      half-built.

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

- [x] ~~Icons/colors for schools of magic, and colors per class.~~ **DONE
      2026-09-03.** Direction picked via an Artifact swatch preview before
      touching code. 8 school colors use this app's own `dataviz`-skill
      validated 8-slot categorical palette (dark-surface steps — this app
      is dark-only, no light theme to design for), mapped by thematic fit
      (Abjuration blue, Evocation red, Illusion violet, Necromancy green,
      Conjuration orange, Divination aqua, Enchantment magenta,
      Transmutation gold). 13 class colors are hand-picked (13 exceeds the
      validated palette's 8-slot colorblind-safe ceiling, and each class
      already has a real icon via `ClassIcon.vue` carrying identity, so
      color is a secondary accent, not identity-bearing) — project owner
      adjusted 3 after seeing the preview: Paladin yellow, Cleric white,
      Monk light blue.

      Built: `--color-school-*` (8) and `--color-class-*` (13) tokens added
      to `src/theme.css` (the app's one live theme — `theme-steel.css`/
      `theme-graphite.css` turned out to be unused preview mockups, not
      wired into `App.vue`, so nothing needed touching there). New
      `SchoolIcon.vue` (same pattern as the existing `ClassIcon.vue`, same
      `lucide-vue` package already installed — Shield/Sparkles/Eye/Repeat2/
      Heart/Skull/Ghost/Flame). New `dnd.schoolColorVar()`/
      `dnd.classColorVar()` helpers in `dnd_utils.js` alongside the existing
      `schoolAbbr()`. Wired into `SpellBrowser.vue` (full icon + color,
      roomier list/detail panel), `CharacterSpellbook.vue` and
      `SpellPillsByLevel.vue` (color-only on the existing abbreviation
      badge — added an icon too would clutter the dense per-spell grid),
      and `CharacterContext.vue` (class color on the existing `ClassIcon`).
      `npm run build` compiles clean. Worth a look at the Spellbook and
      character roster to confirm colors render as expected — not checked
      live per the Playwright-disabled rule.

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

- [x] ~~Starting equipment automation.~~ **DONE 2026-09-03**, class side —
      real PHB starting-equipment tables (WebSearch/WebFetch-verified against
      dnd5e.wikidot.com) added to all 13 `engine/data/classes/*.json` as a
      `starting_equipment` block: fixed items, lettered a/b/c choices (each
      option a bundle of items), and the real gold-alternative dice
      expression (Monk's `5d4` with no `x10` multiplier confirmed as the one
      real exception). Symbolic PHB choices like "any simple weapon" resolve
      via a `filter` field + a weapon-category sub-picker rather than being
      hardcoded to one specific weapon.

      New `src/utils/startingGearCatalog.js` resolves every referenced item
      name into real `party_items.json` fields using the app's EXISTING
      weapon/armor conventions (`weapon_category`/`armor_type` keyed against
      `dnd_constants.js`'s `WEAPON_PROPS`/`ARMOR_BASE_AC` — the same tables
      magic items already reference, so a mundane starting longsword needs no
      new stat data). Packs (Explorer's Pack, etc.) are one "misc" item with
      real contents in the description, not exploded into ~8 sub-items each —
      no precedent in this app's data for that granularity, and every
      existing item is a named whole rather than loose components.

      New "Equipment" tab in `NewCharacterTool.vue` (same picker pattern as
      the existing skill/language choice tabs): one dropdown per PHB choice,
      a sub-dropdown for any "Any Simple/Martial Weapon"-style pick, and a
      "take Xgp instead" checkbox that skips equipment entirely and adds the
      rolled gold to `finances.party_purse` via the existing
      `ADJUST_PARTY_GOLD` mutation (chose that route deliberately — the
      party's actual purse is already 241,732gp at this point in the
      campaign, so a level-1 starting-gold roll is closer to a nice-to-have
      than a meaningful economic choice, but it's real RAW so it's there).

      **Real pre-existing bug found and fixed along the way**: `ADD_PARTY_ITEM`
      (`store/index.js`) computed its next id via `Math.max(...ids)`, but
      EVERY item in `party_items.json` has a string id (`"items_N"`) —
      `Math.max` against strings is `NaN`, so every call was minting a
      broken `id: NaN` item. Same bug class as the `ADD_CHARACTER`
      missing-id bug found during Jaygar's rebuild. Fixed the id calc
      (parse the numeric suffix, same pattern as `nextCharacterId()`) and
      added a new `ADD_PARTY_ITEMS` batch mutation for minting a whole
      loadout's worth of sequential ids in one commit, which starting
      equipment uses.

      Verified: a standalone Node smoke-test script resolved every single
      fixed/choice/gold-alternative entry across all 13 classes' real data
      through the actual catalog module (not by hand-inspection) — zero
      unresolved names, zero broken filters. `cd engine && node --test`
      (196/196, unaffected — this is pure `src/` work) and `npm run build`
      both clean. **Not done, explicitly out of scope**: background
      equipment — turned out `backgrounds.json` has NO equipment/gold field
      on any of its 41 entries despite this TODO's original text claiming a
      "partial" list existed (stale/incorrect when checked directly this
      session) — background gear in real 5e is much smaller (a few fixed
      items, rarely a real choice), so it's a separate, much smaller
      follow-up, not folded in here. Not live-tested in the browser per the
      Playwright-disabled rule — worth creating one test character per class
      (or at least one from each equipment "shape": Fighter's nested
      weapon+shield-or-two-weapons choice is the most complex) to confirm
      the picker and the resulting inventory look right.

- [ ] **[LOW PRIORITY] "Plan all levels ahead" preview toggle**, per the
      Character Builder Blueprint's New Character Mode wireframe — preview
      levels 2-20 in one pass rather than one level at a time. `describeLevelUp`
      already supports arbitrary level ranges; this would just call it
      repeatedly and build a UI for the result. Marked low priority 2026-09-03
      per project owner.

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

- [x] ~~Item-granted spells with per-spell charge costs aren't modeled at all.~~
      **DONE 2026-09-06.** Surveyed every one of the 13 items using
      `spells_granted` first — turned out `spells_granted` was _always_ a flat
      array of bare spell-name strings across the whole app (not just Staff of
      Power), with every differentiated cost living in `effect` prose only.
      Designed and migrated all 13 to a new per-entry object shape (see
      `dnd.normalizeItemSpellGrant` in `dnd_utils.js` for the full field
      reference): `action_type` (the REAL cost of casting THIS spell via THIS
      item, which can differ from the spell's own casting time and from other
      spells on the same item — e.g. Necklace of Prayer Beads' beads are all
      bonus action, not the item-level "action" it had before), `charge_cost`
      (a fixed number drawn from the item's own charge pool, OR `{min,max}`
      when the player chooses how many charges to spend — Wand of Magic
      Missiles' variable-level upcast), `uses_max`/`uses_current`/`recharge`
      (an independent per-spell use count NOT drawn from any shared pool, same
      shape `weapon_effects` already used), `material_component_required`
      (whether the wielder must still provide the spell's own real material
      component vs. the item substituting, per the DMG's general rule), and
      `choice_group` (links entries that share ONE use — Necklace of Prayer
      Beads' Curing bead offering Cure Wounds _or_ Lesser Restoration from the
      same daily use, the real "player choice" case this TODO called out).

      WebSearch/WebFetch-verified real DMG numbers for Staff of Power, Wand of
      Magic Missiles, Helm of Brilliance, and Necklace of Prayer Beads
      (cross-checked 2-3 sources each) — corrected several wrong assumptions
      along the way: Necklace of Prayer Beads uses a bonus action per bead
      (not action) with no shared charge pool and only 6 real bead types (no
      "silence" bead), Helm of Brilliance's real destruction trigger is
      failing a save against fire damage (not "in sunlight"), Staff of Power's
      last-charge risk is losing its bonus properties (not disintegrating).
      Helm of Brilliance's existing 6/9/5-gem homebrew split was kept as-is
      (a deliberate campaign simplification of real RAW's random-gem-count
      rule) but is now backed by real per-spell `uses_max` instead of one
      generic shared pool, which fits the "gem type" mechanic far better than
      a fungible charge count did.

      Built the cast UI: `BattleItemsPanel.vue` and `WeaponTable.vue` (Staff of
      Power lives here, since it's a weapon-slot item, not a wondrous item)
      both render each spell's real action-type badge, its cost (a charge
      count, an inline number input for a range cost, or a uses-remaining
      counter), and a "Cast" button that actually spends the right resource —
      shared cast logic lives in a new `src/mixins/itemSpellCasting.js` so
      it's one implementation, not two. `store/index.js` gained
      `SPEND_GRANT_USE`/`RESTORE_GRANT_USE` mutations for the independent
      per-spell resource, and `SPEND_CHARGE`/`RESTORE_CHARGE` now accept an
      optional `{itemId, amount}` payload (still backward-compatible with
      `CharacterInventory.vue`'s existing flat +/- buttons, which pass a bare
      itemId). `rechargeItems()` now resets per-spell `uses_current` on rest
      the same way it already reset item-level `charges_current`.

      The paired Stone of the Rootbound Ward / Stone of the Broken Vein
      (`items_229`/`items_230`) turned out NOT to need real cross-item
      plumbing once looked at closely — their "shared charge" is actually two
      independent 1-charge/long-rest pools spent *together*, not one merged
      resource (confirmed by their own already-existing `published_spells.json`
      entry for The Stones Agree). Added a `linked_item_id` field purely for
      documentation/discoverability, no special-case code needed.

      **Real pre-existing bug found and fixed along the way**: `items_228`
      (Rith's Signet Ring) has `charges_recharge: "long_rest"`, but the
      `LONG_REST` store mutation's `rechargeItems()` call only ever passed
      `['daily', 'short_rest']` — the literal string `'long_rest'` was never
      in the list it checked against, so that ring's charge could never
      recharge on any rest, ever. Fixed the call site; would have silently
      broken the two new Stone items' recharge too if left as-is.

      Also fixed a real consumer bug this same pass would have introduced:
      `spellUtils.js`'s equipped-item-spell aggregator (source 4 of
      `getAllSpells`) iterated `item.spells_granted` expecting bare strings —
      updated it to normalize via `dnd.normalizeItemSpellGrant` so item-granted
      spells still resolve to real names in the Spellbook instead of
      `[object Object]`. `character.features[].spells_granted` (feat/race/
      class-granted spells — Weave Attunement's phase grid, Fey Touched, etc.)
      is a completely separate, untouched domain — deliberately left as plain
      strings, since `WeavePhaseGrid.vue` depends on that exact positional
      shape for its per-slot spell picker.

      **Not done, explicitly out of scope**: `CharacterSpellbook.vue`'s own
      `openSpell` detail popup builds its fields inline rather than calling
      the shared `buildSpellPopupData` (a pre-existing inconsistency, not
      something this pass introduced) — so it doesn't yet show the new
      per-grant Cost/Material/Via-item fields the way `BattleItemsPanel`'s and
      `WeaponTable`'s popups now do. Worth a follow-up if that popup is ever
      unified with the shared builder. `npm run build` compiles clean; `cd
      engine && node --test` unaffected (196/196, this is pure `src/` work).
      Not live-tested in the browser per the Playwright-disabled rule — worth
      clicking through Lyria's Staff of Power and Ferghus's Necklace of Prayer
      Beads in the actual Combat tab to confirm the Cast buttons spend the
      right amount and the Curing bead's choice_group keeps both options in
      sync.

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

- [x] ~~Revven needs a flavor-appropriate signature spell.~~ **DONE
      2026-09-03.** He's Cleric 9 (Tempest Domain) of Veleth, god of love/
      desire/friendship/physical connection — persona notes emphasize he
      leads with his heart, blushes easily, and finds lightning storms
      beautiful even when dangerous. Wrote **Stormward Vow** (3rd-level
      Abjuration, Cleric), added to `src/data/published_spells.json`
      (`homebrew: true`, `classes: ["Cleric"]`, full description/higher-
      levels text) and to Revven's own prepared spell list in
      `src/data/characters.json`. Mechanic ties Veleth's connection domain to
      Revven's storm magic directly: touch a willing creature to forge a
      bond, then spend a reaction when they're hit to grant them resistance
      to that damage and blast a thundercrack outward (2d8 thunder + push/
      prone) at nearby foes — a single, impulsive protective burst that ends
      the spell, matching his "brilliant observations paired with terrible
      decisions" streak. Verified both JSON files parse and `npm run build`
      compiles clean, per the Playwright-disabled rule — worth a quick look
      at Revven's actual sheet/spellbook UI to confirm it renders like his
      other prepared spells.

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

- [x] ~~Siv needs a rebuild — her subclass doesn't exist.~~ **DONE, and this
      entry was stale — corrected 2026-09-03 after directly re-checking her
      current record**, which no longer matches what this entry described.
      She's now `Rogue 9 / Scout` with real stats (DEX 20 — legally
      explained: 15 point-buy base → 16 after Human's +1 → 20 after two
      Rogue ASIs at levels 4 and 8, confirmed 2026-09-02), skills,
      expertise, and Scout's real homebrew features (Skirmisher,
      Survivalist, Superior Mobility) all present and structurally sound.
      Her `id` was missing (a real app bug, not specific to her — see the
      `ADD_CHARACTER` fix in Jaygar's entry below) and has been backfilled.
      Narrative fields (appearance, persona_notes, languages Common+Goblin)
      are back on the record.

      **Worth flagging rather than silently accepting:** this diverged from
      the plan this entry originally documented — decided 2026-08-25 as
      **Fighter / Battle Master** (mundane, maneuvers mapping onto "highly
      mobile, accurate archer"), keeping her established Sharpshooter +
      Mobile feats. The actual rebuild is Rogue/Scout instead, with no
      feats at all (both ASIs went to raw DEX). Not necessarily wrong — a
      live collaborative session may well have changed direction on purpose
      — but nothing in this repo records *why* the plan changed, and
      Sharpshooter/Mobile are simply gone rather than deliberately dropped
      on record. If that switch wasn't intentional, worth a real
      conversation before treating her current build as final.

      Two still-true tool findings from that build, independent of Siv's
      own outcome: (1) the Level Up tool has no ability-score/point-buy
      step (only Hit Points / New Spells / Feature) — that only exists in
      the New Character tool, so any from-scratch rebuild needs both tools
      in that order. (2) the Level Up tool's Hit Points step shows working
      Roll/Take-Average controls at level 1, but level-1 HP is always
      forced to max hit die per RAW regardless of what's picked (verified
      live: clicked Roll 6 times, HP never changed) — the controls just
      don't apply yet at that level. Minor, but worth a UI pass so level 1
      doesn't show controls that silently do nothing.

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

- [ ] **Level Up tool audit (2026-09-06)** — project owner wants to start
      relying on this tool for real characters and asked for a full flow
      walkthrough: check the existing TODOs, verify every choice a level-up
      needs (mechanically and for the player's own understanding) actually
      exists. Read the entire `LevelUpTool.vue` (2350 lines) plus
      `diffLevelUp.js`/`levelUp.js`. Findings, roughly in priority order:

      **Done same day** (project owner: "#1 is definitely needed, as is #2
      ... hit them both if you can"):
      1. ~~**Known-spell swap (Bard/Sorcerer/Warlock/Ranger/Eldritch
         Knight/Arcane Trickster) was completely unimplemented.**~~ Real PHB
         clause: every known-style caster may replace one known spell with
         another, every level, fully optional. Not even a documented
         "deliberate cut" the way Eldritch Invocation re-picking is (see
         `engine/CHECKLIST.md`) — just silently absent from both the engine
         and the UI. Added as `diffLevelUp.js`'s new `spellSwap: {from, to}`
         option — deliberately NOT a `pendingChoice` (unlike everything else
         in this file, it must never block Confirm Level Up, since it's
         genuinely optional per RAW) — plus a new non-blocking "Optional —
         Swap a Known Spell" card in `LevelUpTool.vue`, shown whenever
         `description.spellcasting.style === 'known'` and the character
         already knows a leveled spell for that class. New
         `/api/engine/spell-choices` fetch (`spellSwapToOptions`) reuses the
         exact same eligibility endpoint the mandatory known-spell picker
         already uses.
      2. ~~**Wizard spellbook growth (+2 spells/level, PHB) was completely
         unimplemented.**~~ Different mechanic than "known spells" — Wizard
         is a `prepared` caster with no known-spell cap at all, so the
         existing `newKnownSpells` pendingChoice (gated on
         `style === 'known'`) never covered it. Added a dedicated
         `spellbookChoices`/`spellbookAdditions` pendingChoice path (flat
         `2 × levelsGained`, Wizard-only, added as `prepared: false` since
         spellbook contents still need daily preparation like any other
         Wizard spell — unlike every other spell-grant path in
         `diffLevelUp.js`, which adds `prepared: true`), plus a new "Add to
         Spellbook" choice card in `LevelUpTool.vue`, structurally identical
         to the existing "New Spells Known" card. New
         `engine/test/spellSwapAndSpellbook.test.js` (10 tests, all passing)
         covers both mechanics, including that a prepared-style caster never
         gets offered a swap and a non-Wizard class never gets a
         spellbookAdditions choice. `cd engine && node --test` 206/206,
         `npm run build` clean.

      **Also done** (2026-09-07, next session):
      3. ~~**The shared `getBonusSpells` utility (`spellUtils.js`) only read
         Artificer's `expanded_spell_list` field.**~~ Generalized to a new
         `BONUS_SPELL_FIELDS` table covering `expanded_spell_list`
         (Artificer), `domain_spells_by_level` (Cleric),
         `oath_spells_by_level` (Paladin), `circle_spells_by_level` (Druid),
         and `psionic_spells_by_level`/`clockwork_spells_by_level`
         (Sorcerer) — each gated to the one real class it means (critical
         for `expanded_spell_list`, which Warlock's Great Old One patron
         also uses for a genuinely different, non-automatic mechanic).
         Artificer keeps its verified `ceil(atLevel/4)` spell-level formula;
         every other field is left `level: null` and resolved asynchronously
         the same way feature/item-granted spells already are
         (`CharacterSpellbook.vue`'s `loadMeta()`), since no single formula
         holds generally (Circle of Spores grants a cantrip at one
         breakpoint and leveled spells at others). New exported
         `getBonusSpellsAtLevel(subclassData, className, level)` helper
         shares the same table so `LevelUpTool.vue`'s "Bonus spells gained"
         note (previously Artificer-only) now fires for all 6 fields too —
         real gap this closed: none of the other 5 ever granted a named
         feature at ANY breakpoint (not just later ones), so the Level Up
         tool showed literally nothing when a Cleric/Paladin/Druid/Sorcerer
         gained new domain/oath/circle/psionic/clockwork spells, at every
         single level, not just the later ones. Verified safe against every
         existing Cleric/Paladin/Druid character (their domain/oath/circle
         spells are all already hand-entered in `character.spells[]`; the
         existing name-based dedup in `getCharacterSpells` means the new
         auto-derived entries are silently skipped as already-seen, so nothing
         changes for them — confirmed directly against Revven's Tempest
         Domain spells, all 10 already present). **Not included**:
         `land_spells_by_type` (Circle of the Land) — keyed by land TYPE,
         not level, so it needs the character's chosen type recorded
         somewhere first; no character has picked this circle yet and no
         such field exists on the schema, so it's left for whenever one
         does rather than inventing a field with no real example. `npm run
         build` clean; `cd engine && node --test` 206/206 (unaffected, this
         is pure `src/` work) — no frontend test suite exists per
         CLAUDE.md, verified via build + direct reasoning against real
         character data instead.
      4. ~~**Step 3's base `newFeatures` list was hover-tooltip-only.**~~
         **DONE 2026-09-07.** Now shows descriptions inline (`<strong>Name
         </strong> — description`), matching every other choice card in the
         tool. Also removed the now-dead `.has-tip` CSS rule it was the last
         user of.
      5. ~~**The spell/cantrip picker checkboxes showed no spell description
         at all.**~~ **DONE 2026-09-07.** New shared `spellDescriptions`
         cache + `loadSpellDescriptions()` method (mirrors the existing
         `featureDescriptions`/`loadFeatureDescriptions` pattern exactly,
         backed by `lookupSpell` instead of `lookupFeature`), wired to all 5
         spell-picking draft arrays (cantrips, known spells, Pact of the
         Tome bonus cantrips, the spellbook picker, the spell-swap "to"
         pick) via watchers. Every picker's summary panel now shows what
         each picked spell actually does.
      6. ~~**Level-1 HP step's Roll/Take-Average controls were fully
         clickable but silently did nothing.**~~ **DONE 2026-09-07.** New
         `isForcedMaxHp` computed (reads `preview.description.hp[0].method
         === 'max'`, already set correctly by `levelUp.js`) disables all
         three controls and shows a note explaining why, exactly at a
         character's true first level ever.
      7. ~~**The live ASI preview didn't cap at 20** while picking (e.g.
         could show "19 → 21").~~ **DONE 2026-09-07.** `liveAsiDeltas` now
         wraps its result in `Math.min(20, ...)`, matching `asiFeat.js`'s
         real `SCORE_CAP`.
      8. ~~Minor: the HP step's text said "+ CON mod" literally instead of
         showing the actual modifier number.~~ **DONE 2026-09-07**, same
         pass as #6 — new `hpGainTotal`/`conModPart` computeds back the real
         numbers out of `preview.patch.hp_max` (correct even when this same
         level's ASI bumped CON, since it reads the actual applied total
         rather than re-deriving from `draftCharacter.stat_con`, which could
         be stale pre-Confirm) instead of showing a bare "CON mod" phrase.
         `npm run build` clean for all four (6-8); `cd engine && node
         --test` 213/213 (unaffected, pure `src/` UI work).
      9. ~~**Multiclass skill/tool proficiency picks surfaced only as a
         warning telling the player to add them by hand.**~~ **Skills DONE
         2026-09-07**; tools deliberately left as-is. `diffLevelUp.js` now
         has a real `multiclassSkillChoice` param and
         `multiclassSkillChoice` pendingChoice for the PHB "Multiclassing
         Proficiencies" table's skill grant (real for Bard/Ranger/Rogue,
         always "choose 1") — reuses the exact same `skill_choices.options`
         data (`engine/data/classes/<class>.json`) the New Character tool's
         own class-skill picker already reads, resolved to a real display
         name via `engine/rules/skills.js`'s `loadSkill` and merged into
         `patch.skill_proficiencies` (deduped against what the character
         already has, with a no-op note rather than a wasted/duplicate
         pick). New "Multiclass Skill Proficiency" card in `LevelUpTool.vue`
         and a new `engine/test/multiclassSkillChoice.test.js` (7 tests:
         unresolved choice, valid resolution, invalid-skill rejection,
         already-known no-op, Bard's `'any'`-options case, a class with no
         skill grant, and confirming an *existing* class never offers this
         even if it would on pickup). **Tools deliberately NOT built** —
         unlike skills, this app has no `tool_proficiencies` field
         anywhere on the character schema (not just for multiclassing — a
         starting class's own tool grants, e.g. Rogue's thieves' tools,
         aren't tracked either), so a real picker would mean inventing a
         new schema field used nowhere else in the app — a bigger, separate
         decision than this multiclass-specific gap, left as the existing
         warning-note behavior. `cd engine && node --test` 213/213, `npm
         run build` clean.
