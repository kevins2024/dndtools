# Completed TODO Items (Archive)

Finished items moved out of `TODO.md` on 2026-09-10 to keep that file short. Kept here verbatim, not summarized, so no detail from the original writeups is lost.

- [x] **Spot-check of the low-effort subclass build batch found a real,
      systemic gap: 7 of 8 Warlock patrons had no Expanded Spell List at all
      (2026-09-09).** Fixed — see `engine/CHECKLIST.md`'s matching entry for
      the full story (random sample, what was found, how it was verified).
      Built `engine/SUBCLASS_AUDIT.md` as a permanent per-subclass checklist
      covering all 113 subclasses, specifically so future spot-checks (this
      was explicitly NOT a full audit — only Warlock patrons' spell lists
      and 2 randomly-sampled subclasses got real verification) can pick
      unchecked ones without repeating work. Check that file before picking
      "a couple subclasses to verify" again.

- [x] **NPC location now lives only on the NPC record, not on both the NPC
      and a place's `npcs_present` array (2026-09-09 design decision,
      implemented same day).** Grew out of finding Argentveil's copy-NPCs
      button only surfaced 1 of 15 real NPCs because `npcs_present` had
      gone stale relative to `npcs.json`. Matches a pattern already proven
      elsewhere in this app (`party_items.json`'s `carried_by`/
      `equipped_by` live on the item, not as a reverse list on the
      character). Explicitly decided AGAINST building separate
      location-relationship/ownership tables or pre-splitting `npcs.json`
      into per-location sub-lists — both would just reintroduce the same
      staleness bug under a different name.
      **DONE**: backfilled `location` on 32 real NPCs across Ravenquay,
      Khemrise, Argentveil, Tilawam, Cindermarch, and Halvenmoren to name
      the specific shop, not just the city (`"Settlement, Shop Name"`,
      matching the one existing example that already did this right —
      Zav'rel's "Valdmere, The Tallow and Tar inn"). Found 5 names
      referenced in `places.json`'s `npcs_present` that had **never
      actually had an npcs.json record at all** — Wainkur, Torvaine,
      Kovran, Duvrak (all Argentveil shopkeepers), and Kerra Flint
      (Khemrise's Vineyard Estate) — added as clearly-marked stubs
      (name/location/role only, no invented personality) so they at least
      exist and resolve correctly; flesh out when actually used at the
      table. Removed `npcs_present` from all 55 places/locations that had
      it (`places.json`) now that it's genuinely dead data. Switched
      `LocationBrowser.vue`'s per-sub-location "NPCs: X, Y" tree label to
      the same `dnd.npcsAtLocation` lookup the settlement-level copy button
      already used — one real source now, both UI surfaces read it.
      Verified `npm run build` clean, `node --test` 218/218.

- [x] **Lexica was genuinely corrupted, not just a stray spell (2026-09-08)
      — project owner pushed back hard on the earlier "she's basically fine"
      read, correctly.** Full harsh re-audit found: her `stat_int: 19` was
      not a real base score at all — it exactly matches the "Headband of
      Intellect" item's `stat_overrides: {int: 19}` (`party_items.json`),
      which sits unequipped in the general party pool. Confirmed this app's
      ability-score display genuinely applies `stat_overrides` live from
      equipped items (real code path, `dnd_utils.js`) — someone baked the
      override's resulting value directly into her permanent base stat
      instead of it only applying while worn, and it was never reverted
      after the item left her hands. **DONE**: reset her stats to a clean
      build the project owner specified (STR8/DEX16/CON12/INT10/WIS11/CHA19)
      that reconciles perfectly under STANDARD 15-cap point buy once you
      account for her War Caster feat consuming one of her two ASIs (Half-Elf
      +2 CHA racial + one full ASI = 19 CHA; +1 DEX racial flex = 16 DEX) —
      no need to invoke the "generous ~17 ceiling" system for her at all.
      Added `ability_score_history` for the corrected build. Also removed
      Phantasmal Killer (a full audit this pass found zero supporting
      feat/feature/item anywhere — closing out the open question from the
      previous, less-thorough pass).
      Real process lesson, called out directly by the project owner and
      worth remembering: **checking a character's spell list in isolation
      isn't enough — cross-check stats against the FULL feat/ASI budget**,
      not just "does this spell make sense." The earlier pass missed this
      because it never asked "does she even have enough ASI points left,
      given the feat she's recorded as having, to reach these stats at
      all" — that budget check is what actually surfaced the corruption.
      Also caught and fixed a real (if lower-impact) bug while re-verifying
      the ability-score tooltip code the project owner asked about:
      `dnd.statArray()` in `dnd_utils.js` had `if (SCORE_BONUS_KEYS.has(key));`
      — note the trailing semicolon — which silently turned the guard into
      a no-op, so every item/feature `stat_bonuses` key (not just real
      ability-score keys) was being pushed into the tooltip's effects map.
      Never visibly corrupted output (only the 6 real ability keys are ever
      read back out), but real dead code, now a proper `if (!...) continue`.
      The "tooltip just says INT 19" complaint itself wasn't a bug, though —
      that's the correct degrade-to-"no modifiers" behavior for a character
      with no `ability_score_history` recorded, working as designed.
      **Sorra — confirmed, not just suspected, to need a real rebuild, not
      a spot-fix.** Same budget check applied to her: she has one feat
      (Slasher), leaving only one ASI's worth of points (max 2) for her
      entire stat progression, but her DEX 20 and CHA 20 together need at
      least 3 more points than that even under the most generous point-buy
      assumptions, and no item anywhere (checked the whole catalog, not
      just her own) explains either stat. Project owner: built entirely
      through AI-assisted level-ups without a real character builder before
      this session's tools existed, and it produced a sheet that doesn't
      reconstruct under any legitimate combination of rules. Not worth
      further spot-fixing — added to the same rebuild queue as Kerra/Torrin.
      **2026-09-08, later same day: project owner wants Lexica on that same
      rebuild queue too**, despite the stat fix above landing clean — even
      a reconciled patch isn't the same confidence level as a real
      from-scratch build through the Level Up tool, and if that tool is
      doing its job the rebuild should just confirm the same numbers
      anyway. Full rebuild queue as of now: **Kerra, Torrin, Sorra, Lexica.**
      Verification: `npm run build` clean, `cd engine && node --test`
      218/218 (the tooltip fix touches display logic only, no engine code).

- [x] **High Elf / Drow (Dark Elf) racial cantrips — DONE for Kessara
      2026-09-09; Drow still has no roster character to apply to.**
      Confirmed real RAW: High Elf grants a free Wizard cantrip (INT-based),
      Drow grants a free Dancing Lights cantrip (CHA-based, plus tiered
      Faerie Fire/Darkness at 3rd/5th level not yet modeled — see that
      trait's own `_note`). Both are already correctly present as
      `grants_spells` on the Elf species' subrace traits in
      `engine/data/species.json`. **Kessara** was recorded as `race: "Elf",
subrace` unset — set to `"High Elf"` (her INT 20 fits High Elf's math
      exactly: 15 point-buy + 1 racial + 2 full ASIs), and her existing
      "Minor Illusion" cantrip (previously one of the 6 "visible in the
      shared spellbook, not really hers" entries) re-tagged as her real,
      free racial cantrip. This was a reasonable best guess cross-checked
      against her stats, not a directly confirmed fact — flagged clearly in
      her own `_source` note in case Minor Illusion isn't the right pick or
      High Elf isn't actually her intended subrace.

- [x] **`LocationBrowser.vue`'s per-location "NPCs: X, Y" tree label —
      DONE 2026-09-09.** Switched to the same `dnd.npcsAtLocation` lookup
      the settlement-level button already used, now that `npcs.json`'s
      `location` field has been backfilled to shop-level specificity (see
      the "NPC location should live only on the NPC record" entry above).

- [x] **Weave Dust from Broken-Down Magic Items — new house rule + destroy-item
      UI (2026-09-08)** — grew out of a Wand of Wonder RAW question (confirmed
      via live web lookup, not just training knowledge: it DOES require
      attunement, specifically "by a spellcaster" — DMG text, not a blanket
      "wands never need it" rule; some do, some don't, per-item). Project
      owner didn't like the wand's real chaotic d100 table and, while
      discussing what to do with unwanted magic items generally, designed a
      full house rule for destroying one into Weave Dust instead of selling
      for gold. Final formula (see `house_rules.json`'s new entry for the
      complete writeup): `base = floor(value_gp / 15)`, a missing-charges
      penalty (up to -30% at 0 charges remaining, plus the gp-equivalent
      material cost of missing charges for material-recharging items, not
      just free rest-recharging ones), then a d20 roll for texture (20
      doubles, 1 halves, otherwise ±1% per step away from the 10/11
      midpoint, so roll 2 = -9%, roll 19 = +9%). Explicitly rejected an
      earlier idea of deriving value from a rarity-only band table — project
      owner correctly called this out as not actually distinguishing
      anything, since it's just rarity restated. Real fix: every magic item
      should carry a real recorded `value_gp` at authoring time (found by
      matching a real/similar published item's price — benefits gold sales
      too, not just dust), a one-time lookup rather than a per-calculation
      one.
      Implemented: `dnd.weaveDustForRoll(item, roll)` / `dnd.
weaveDustEstimateRange(item)` in `dnd_utils.js` (pure, returns null
      when an item has no `value_gp` — nothing to calculate from). Wired into
      `CharacterInventory.vue`'s existing item-delete dialog (it already had
      a gold-vs-dust currency toggle, just no auto-calculation) —
      `confirmDelete` now auto-rolls (uniform 2-19, no crits in the
      auto-roll — crits are part of the formula but this UI path doesn't
      invoke them) and pre-fills the amount for any item with a recorded
      `value_gp`, shows the 2-19 estimate range as a note, and defaults to
      the dust currency type for such items; still a plain editable number
      afterward for DM override or a manual gold sale instead. Dialog title/
      button read "Destroy" instead of "Delete" when the dust path is
      active. No items were backfilled with `value_gp` this pass except the
      test wand below — that's real per-item authoring work for later.

- [x] **Test items added to Jaygar's inventory (2026-09-08) — DELETE ONCE
      VERIFIED.** `TEST Wand of Magic Missiles` (`items_235` in
      `party_items.json`), carried but deliberately NOT equipped
      (`equipped_by: null`), to check whether `BattleItemsPanel.vue`'s
      `battleItems` filter shows a carried-but-unequipped item as usable in
      combat. Reading the filter code, it currently only includes an item if
      `equipped_by` matches the character, or it's carried with
      `equipped_by: 'disallowed'` — plain "carried, no equip flag" isn't
      covered, so this is expected to currently NOT show up, and — this is
      the real finding — neither does Revven's actual real `Wand of Magic
Missiles` (`items_131`, also `equipped_by: null, carried_by:
"Revven"`), which means this is a live, pre-existing gap affecting
      real roster data, not just a hypothetical. Not fixed yet — project
      owner wanted to verify the current (broken) behavior firsthand before
      deciding on a fix, per this project's own established preference for
      hands-on UI verification over guessing blind. Also doubles as a test
      of the new Weave Dust destroy flow above (`value_gp: 500` set,
      `charges_recharge_type: "rest"`). Delete this item once both have been
      checked.

- [x] **Post-redesign manual-verification checklist findings (2026-09-08)**
      — project owner clicked through the checklist handed off after the
      character-sheet-redesign era and reported back several real issues,
      all fixed same session: 1. ~~"Test Spell" references lingering in game chats.~~ Searched the
      entire repo (all `src/data/*.json`, `engine/data/*.json`, `lore/`)
      for "test spell" in any casing — genuinely not present anywhere.
      Whatever the project owner is seeing lives in an external chat log,
      not this codebase's data. 2. ~~Homebrew species (Catrin, Drevani, Hei'ugar) showed a garbled
      "Ability bonus: +P 0, +l 1, +a 2..." string in New Character.~~
      **DONE.** Root cause: all three had `ability_score_bonus: "Player's
choice"` (a literal string) instead of a `{ability: amount}`
      object — `NewCharacterTool.vue`'s `fixedBonusText` did
      `Object.entries()` on the string, which iterates its characters.
      Real bonuses decided with the project owner via brainstorm, tied to
      each species' actual traits (not guessed): Catrin +2 CON/+1 WIS
      (Long Memory/History reads as a Wisdom-flavored trait per project
      owner), Drevani +2 DEX/+1 CHA (small punk-rock folk — explicitly
      NOT a STR bonus despite Ferocious Bite scaling off STR mod), Hei'ugar
      +2 WIS/+1 CON (Far Sight + sky-reverent farmer/fisherman culture
      over a STR/CHA guess neither trait supports). Fixed at the actual
      source — `scripts/build-srd-cache.js`'s `HOMEBREW_SPECIES` array,
      not just the generated `src/data/api_data_cache/species.json` cache
      — since the cache is meant to be fully regenerable and a rebuild
      would have silently reintroduced the bug otherwise. Backend
      restarted and confirmed serving the fix via curl. 3. ~~"Homebrew species need their unique traits wired up correctly"~~
      — deliberately NOT started this session (project owner scoped it as
      a separate next step, this pass was the ability-bonus bug only). 4. ~~The class-skill-picker's "already granted by background" message
      was confusing — read like it might be showing the same list twice
      rather than a second, separate one.~~ **DONE**, reworded to say
      explicitly that it's a second list (class skills, on top of
      background skills) and that greyed-out options are only disabled
      to prevent picking the same skill twice, not because the section
      itself is broken. 5. ~~Ability score pickers didn't surface which abilities actually
      matter for the chosen class, and had no tooltips explaining what
      each ability governs.~~ **DONE** in both New Character and Level
      Up's ASI form. Added `ABILITY_DESCRIPTIONS` (plain-language, per
      ability) and `priorityAbilitiesForClass()` (PHB's own "Quick
      Build" suggested ability order, real RAW guidance — not a guess —
      plus each class's actual `spellcasting.ability` field for casters)
      to `dnd_utils.js`, shared by both tools. Melee classes intentionally
      list both STR and DEX per PHB's own quick-build hedge (finesse/
      ranged builds are equally valid) rather than forcing one answer. 6. ~~New Character's HP section showed a "why these controls are
      disabled" note instead of just showing the number.~~ **DONE** —
      removed the (permanently-disabled, dead) Roll/Take Average buttons
      entirely; the HP number now carries a tooltip with the actual
      breakdown (`d{hitDie} (max) {±}CON = {total} HP`). Also deleted the
      now-unreachable `rollHp`/`setAverage` methods. 7. ~~New Character's Spells & Features tab showed known-caster spell
      counts (e.g. "Cantrips: 2 · Spells known: 4" for a Bard) with no
      way to actually choose which spells.~~ **DONE** — built a real
      cantrip/known-spell picker (search + checkbox list, capped at the
      computed count), reusing `LevelUpTool.vue`'s existing
      `/api/engine/spell-choices` pattern verbatim (same route, same
      `spellChoices: {cantrips, spells}` param on `preview-level-up` —
      zero engine changes needed, `diffLevelUp.js`'s cantrip/known-spell
      grant logic already treats a 0→1 level transition as "gained =
      full count" with no special-casing required). Gated `canCreate` on
      the picks being complete. Deliberately did NOT build an equivalent
      picker for PREPARED casters (Cleric/Druid/Wizard's starting
      spellbook, Paladin) — prepared casters choose spells dynamically
      rather than a fixed initial known-list, a different mechanic not
      covered by the project owner's specific Bard-shaped complaint; flag
      if that's wanted too.

                             Verification: `npm run build` clean, `cd engine && node --test`
                             218/218 (unaffected — no engine logic changed, only a class-file data
                             fix and Vue UI work). Backend restarted and re-verified via curl per
                             CLAUDE.md's own stale-cache gotcha. Not manually clicked through in a
                             live browser (Playwright is disabled by default again after the prior
                             one-time authorized pass) — worth the project owner's own quick check
                             of: New Character's spell picker end-to-end for a Bard, and creating a
                             Catrin/Drevani/Hei'ugar character to confirm the ability bonus now
                             renders and applies correctly.

- [x] ~~Gems need a real system — current approach (one flat `contents[]`
      array per haul on a single "Gemstones" `party_items.json` entry,
      matching an even older pre-existing entry's own shape) isn't
      sustainable, but isn't a problem yet.~~ **DONE 2026-09-08.** Project
      owner's design: every named party gets a homebrew Bag of Holding (see
      the existing "Bag of Holding Capacity" house rule), and inside it a
      single "Gem Pouch" per party — one running numbered list instead of
      one entry per haul. Added a real `Bag of Holding` item
      (`party_items.json`, `carried_by: 'party'`, scoped by `party_id`) for
      all 4 real parties (East Full, Valdmere, Yetgrese, Twins). The two old
      "Gemstones" entries were renamed to "Gem Pouch" in place (kept their
      `id`s and `contents[]` untouched to avoid a transcription error) and
      assigned per the project owner's call: `items_163` (spinel/sapphire/
      diamond/ruby/fire opal/garnet) → Yetgrese; `items_236` (the large
      2026-09-03 mixed haul) → East Full (briefly misheard as "Eastern1,"
      a name that doesn't match any of the 4 real parties — corrected same
      day once clarified). Valdmere and Twins each got a fresh empty Gem
      Pouch (`contents: []`) ready for future hauls; East Full's
      once-redundant empty pouch was removed once `items_236` was assigned
      to it instead. Stated policy going forward, for the record: a
      reorganized/unclear party's pooled loot lands in the unassigned pool
      rather than being guessed at.
      Also built real UI for what was the original complaint ("doesn't
      scale to spending/selling individual gems... without manually reading
      through every entry and summing by hand"): `CharacterInventory.vue`'s
      existing item-inspection/edit panel now shows a live-editable
      "Contents (N gp total)" section for any item with a `contents[]`
      array — per-gem-type +/- quantity buttons, a remove button, an
      "+ Add gem type" row, and a running total, saved via the same
      `UPDATE_ITEM` mutation the rest of that panel already uses. Fixed a
      real latent bug found while wiring this up: `inspectItem()`'s
      `editDraft = {...item}` was a shallow copy, so editing `contents` in
      place (quantity++/--, splice) would have mutated the live item even
      before hitting Save, making Cancel not actually cancel — `contents`
      is now cloned row-by-row on inspect. Verified `npm run build` clean;
      worth clicking into a party's Gem Pouch (Yetgrese has real data) to
      confirm the +/- controls and running total work as expected.

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

- [x] ~~Build a real level-up tool.~~ **Stale entry, checked off 2026-09-08**
      — this was written 2026-08-25 when the tool didn't exist yet; it's
      since been built into exactly what this entry describes.
      `LevelUpTool.vue` now shows ASIs/feats, subclass features, and spell
      choices per class, each backed by real `engine/` rules data with
      sourced descriptions (`published_features.json`'s own `source`
      field) — not a BG3-style stand-in anymore. Whatever real gaps remain
      in it are tracked as their own specific entries elsewhere in this
      file, not under this now-obsolete umbrella.

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

- [x] ~~Spellbook/spell-list color coding is inconsistent and needs a real
      pass.~~ **DONE 2026-09-07.** Found the actual root cause: two
      different tagging conventions for "always prepared, doesn't count
      against the limit" spells had accumulated across characters built in
      different sessions — a boolean flag (`spell.domain`/`spell.bonusSpell`,
      what `getBonusSpells`' auto-derived entries use) and a string
      `spell.type` (`'domain'`/`'oath'`, what several hand-entered Cleric/
      Paladin characters use instead — e.g. Revven's 10 Tempest Domain
      spells). `CharacterSpellbook.vue`'s `isReady()`/`canToggle()`/
      `prepTitle()`/badge rendering only ever checked the boolean flags, so
      a hand-entered domain/oath spell silently rendered as an ordinary
      toggle-it-yourself prepared spell — no badge, no "always ready"
      color — even though it's mechanically identical to an auto-derived
      one. That's the real explanation for "looks the same on some
      characters, all one color on others": a data-tagging inconsistency,
      not a rendering bug — the existing 3-tier dot-color system (green
      "prepared, togglable" / gold "always ready, fixed" / gray "not
      prepared") plus source-letter badges (D/B/H/F/I) already matched
      `engine/CHECKLIST.md`'s own "spell readiness states" design
      recommendation, it just wasn't applied consistently.

      Fixed: new `isDomainSpell()`/`isOathSpell()`/`isAlwaysReady()` helpers
      recognize BOTH conventions, used consistently everywhere readiness is
      decided — including a second, more consequential bug this surfaced:
      `preparationInfo`'s prepared-spell-count (used for the "X/Y prepared"
      counter and the over-limit warning) only excluded the boolean-flagged
      spells from counting against the limit, so a type-tagged domain/oath
      caster's always-prepared spells were being wrongly counted against
      their cap. Added a new "O" (Oath) badge alongside the existing D/B/H/
      F/I ladder — Paladin oath spells had no badge at all before. Also
      replaced the file's hardcoded `#5a9e5a` green (7 occurrences) with
      the theme's real `--color-success`/`--color-success-rgb` tokens, and
      added a compact readiness legend (dot colors + badge letters) at the
      top of the Spellbook tab, since neither was explained anywhere
      before. `npm run build` clean; `cd engine && node --test` 218/218
      (unaffected, pure `src/` UI work — no frontend test suite exists per
      CLAUDE.md, verified via build + direct reasoning against real
      character data, same as the `getBonusSpells` fix earlier this
      session). Not live-tested in the browser per the Playwright-disabled
      rule — worth opening Revven's Spellbook tab specifically to confirm
      his 10 Tempest Domain spells now show the gold "always ready" dot +
      D badge and no longer count toward his prepared limit.

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

- [x] **Level Up tool audit (2026-09-06)** — all 9 findings resolved. project owner wants to start
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

- [x] **Live Playwright UI audit of New Character / Level Up (2026-09-08)**
      — project owner explicitly authorized a one-time, temporary Playwright
      run (installed ad hoc into the scratchpad only, never added to
      `package.json` — the Playwright-disabled rule at the top of this file
      stays the default going forward). Walked both tools end to end across
      several species/class combinations, screenshotting every tab/step.
      Found the running dev server was serving STALE `engine/data/`
      (backend hadn't been restarted since earlier engine edits this
      session — see CLAUDE.md's own note on this) — restarted it before
      trusting any result. Real findings, all fixed: 1. ~~**The "+ Multiclass into…" dropdown rendered completely blank**
      (no placeholder text, not just "unselected") whenever the
      character being leveled already had an existing class selected.~~
      **DONE.** Root cause: it shared one `v-model="selectedClassName"`
      with the existing-classes dropdown right next to it — a native
      `<select>` whose bound value matches none of its own `<option>`s
      renders fully blank. New `multiclassDropdownValue` computed only
      reflects `selectedClassName` here when it's actually one of this
      dropdown's own choices, falling back to the placeholder otherwise. 2. ~~**NewCharacterTool.vue's "Spells & Features" tab said "Pick a
      species and class first"** even when both were already picked —
      the real blocker (an unresolved flexible ability-score choice,
      e.g. Half-Elf's +1/+1) wasn't distinguished from the missing-
      species/class case at all, since both just fell through to the
      same generic fallback whenever `preview` was null for any
      reason.~~ **DONE.** Split into two real messages: one for actually
      missing species/class, one naming the specific unresolved ability
      choice. 3. ~~**NewCharacterTool.vue's own HP Roll/Take-Average controls were
      fully clickable but did nothing** — confirmed by clicking Roll 5
      times, HP never changed.~~ **DONE.** This is a second, independent
      occurrence of the same bug already fixed in `LevelUpTool.vue`
      during the Level Up audit — and worse here, since every character
      made through this tool is level 1, these controls can _never_ do
      anything in this tool, not just sometimes. Now unconditionally
      disabled with an explanatory note. 4. ~~**Equipment tab's two "Choose one:" dropdowns had identical,
      generic labels** — a player had to open both to discover one was
      a weapon choice and the other a gear-pack choice.~~ **DONE.** New
      `equipmentChoiceLabel()` derives a real category (Weapon / Armor /
      Spellcasting Focus / Equipment Pack) from the option names already
      in `engine/data/classes/*.json` — no new data field needed, since
      all 37 real choices across the 13 classes fall into just those 4
      shapes.

      **Not a confirmed bug**: a "+ Multiclass into…" dropdown once
      appeared blank for a couple of single-classed characters, but a
      clean, isolated re-test showed the real underlying cause was flaky
      test-script iteration (a Playwright script re-selecting options by
      index on a list that reflows between iterations), not an app defect
      — same root cause as #1 above, already covered by that fix once
      identified honestly rather than reported blind.

      `npm run build` clean; `cd engine && node --test` 218/218
      (unaffected, pure `src/` UI work).

- [x] ~~Real racial/background mechanical data.~~ **DONE in full 2026-09-10**
      (racial mechanics were already DONE 2026-09-07; the remaining
      "deliberately not built" gaps closed this session). Background
      expansion and species.json SRD-scope reconciliation split out to their
      own still-open TODO.md entry — see there.

      **Racial mechanics DONE 2026-09-07** — the 9 standard species already
      had full, real trait TEXT (verified per-trait descriptions, not
      placeholders), but nothing wired those traits into actual character
      fields; `NewCharacterTool.vue`'s `characterShell()` didn't even write
      `speed`/`darkvision` (computed for creation-time display only, never
      saved), and neither the class's own nor any species-granted weapon/
      armor proficiency was ever written to a new character at all. Added:
      structured `grants_weapon_proficiency`/`grants_armor_proficiency`/
      `grants_tool_proficiency(_choice)`/`grants_skill_proficiency(_choice)`/
      `grants_resistance`/`grants_spells` fields directly on the relevant
      trait objects in `species.json`, a new `ancestry_options` table for
      Dragonborn (10 real dragon types, each with damage type + breath
      shape/save), and full wiring in `NewCharacterTool.vue`:
      `characterShell()` now writes real `speed`/`darkvision`/
      `weapon_proficiencies`/`armor_proficiencies` (class + species merged)
      plus two brand-new fields, `tool_proficiencies` and `resistances`
      (species-only for now — no class ever grants either directly).
      Species-granted cantrips (High Elf's wizard cantrip choice, Forest
      Gnome's Minor Illusion, Drow's Dancing Lights, Tiefling's
      Thaumaturgy) ride in as ordinary `features[].spells_granted` entries,
      reusing spellUtils.js's existing feature-granted-spell aggregation
      with zero engine changes — the same path Fey Touched/Shadow Touched
      already use. New pickers for every trait needing a real choice: Dwarf
      artisan tool (1 of 3), Half-Elf Skill Versatility (2 of any), High
      Elf's wizard cantrip (fetched live via the same `/api/engine/
      spell-choices` endpoint the Level Up tool's pickers use), and
      Dragonborn's dragon-type ancestry. `VitalsChipRow.vue` gained
      Darkvision and Resist chips — neither had anywhere to display on the
      PC-facing sheet before (darkvision was creation-time-only; resistance
      had no field at all).

      **The three "deliberately NOT built" gaps flagged 2026-09-07, DONE
      2026-09-10:**
      1. **Flat "+1 HP per level" from a non-class source** (Dwarven
         Toughness — Draconic Resilience is a Sorcerer subclass feature,
         out of scope for a species-only pass). Added `grants_hp_per_level`
         to Hill Dwarf's trait in `species.json`; `diffLevelUp.js` now reads
         it via a new `traitsFor(race, subrace)` helper (`rules/species.js`)
         and folds `hpPerLevelBonus * levelsGained` into `hpGained` right
         alongside the existing hit-die/CON math. Multiplying by
         `levelsGained` covers "+1 at 1st level" for free — a brand-new
         character's very first level-up call is `fromLevel 0 -> toLevel 1`
         (`levelsGained === 1`), so no separate creation-time special case
         was needed.
      2. **"Advantage on a specific saving throw" traits** (Dwarven
         Resilience/Stout Resilience vs. poison, Halfling Brave vs.
         frightened, Elf/Half-Elf Fey Ancestry vs. charmed, Gnome Cunning
         vs. magic). Added `grants_saving_throw_advantage` (a plain trigger
         string) to each real trait in `species.json`. Deliberately kept
         informational, not mechanized — this app doesn't roll dice or
         resolve advantage anywhere, matching its DM-arbitrated design (see
         CLAUDE.md) — so it's wired the same shallow way `resistances`
         already was: a new `saving_throw_advantages` array on the
         character record (`NewCharacterTool.vue`'s `resolvedSpeciesGrants`
         + `characterShell()`), surfaced as a new "Adv. Saves" chip on
         `VitalsChipRow.vue` (count + a hover tooltip listing which saves),
         same pattern as the existing Resist chip.
      3. **3rd/5th-level tiered spells** (Drow Magic's Faerie Fire/Darkness,
         Infernal Legacy's Hellish Rebuke/Darkness) — species grants past
         1st level need a level-up-time check independent of which class is
         actually leveling. Added a `tiered` array (`{level, spell, uses}`)
         to each trait's `grants_spells` in `species.json`. `diffLevelUp.js`
         now computes `totalLevelBefore`/`totalLevelAfter` (summed across
         ALL of a character's classes, not just the one being leveled) and
         grants any tier whose threshold falls in that range as a new
         feature (`type: 'speciesTrait'`, `spells_granted: [spell]`) —
         verified via a real multiclass smoke test (Rogue 2 picking up
         Fighter 0->1 still correctly grants Faerie Fire at total level 3,
         even though Fighter itself only just reached its own level 1).
         Routed through the exact same `existingByLevel`/`existingNoLevel`
         dedup as every other feature grant, so re-running an unchanged
         level-up preview never double-grants.

      New `engine/test/speciesLevelUpMechanics.test.js` (11 tests) covers
      both the HP bonus and the tiered-spell mechanic end to end, including
      the multiclass total-level case and the no-duplicate-on-rerun case;
      `engine/test/species.test.js` gained 7 more tests guarding the new
      `traitsFor()` helper and the three new field shapes (including an
      explicit `deepEqual` over every real trait carrying
      `grants_saving_throw_advantage`, so a future new species trait forgets
      the field loudly instead of silently). `cd engine && node --test`
      243/243, `npm run build` clean. Not live-browser-tested per the
      Playwright-disabled rule — worth creating a Hill Dwarf and a Drow (or
      Tiefling) test character and leveling them through the tool to confirm
      the HP bump and the "Adv. Saves" chip actually render as expected.

- [x] ~~Re-audit the 17 subclasses that only got partial verification during
      the 2026-09-09 full subclass audit.~~ **DONE 2026-09-10 — all 113
      subclasses now have a genuine, source-verified full audit.** Found and
      fixed real bugs in 13 of the 17 (Tempest Domain, Circle of Stars, Oath
      of the Ancients, Oath of the Crown, Oath of the Open Road, Gloom
      Stalker, Divine Soul, and 6 of the 8 Warlock patrons — Archfey and
      Fiend confirmed clean). Circle of Stars was the single biggest finding
      of the whole pass: every one of its 5 features had a real error,
      including Star Map's entire mechanical payload (a free cantrip plus an
      always-prepared, slot-free-castable spell) being completely absent
      from the catalog text — it had previously only ever been 📎
      cross-referenced via Tackett, never actually checked against a source.
      Full per-subclass writeups now live in `engine/SUBCLASS_AUDIT_ARCHIVE.md`
      (moved there from `engine/SUBCLASS_AUDIT.md`, which now just holds the
      legend/conventions with all 113 rows archived). `cd engine && node
    --test` 243/243, `npm run build` clean throughout.

- [x] ~~LevelUpTool.vue: gray out or hide a tab (Hit Points/New Spells/
      Feature) when it has nothing to show for the current class/level, and
      renumber the remaining tab labels if one's hidden.~~ **DONE
      2026-09-10.** Hit Points is never hidden (every level grants HP). New
      Spells hides when the class has no spellcasting at all this level
      (`!preview.description.spellcasting` — the one existing gate the tab's
      own body already used to decide between the summary view and the "X
      doesn't grant spellcasting" note, so no new condition was invented).
      Feature hides when there's nothing in `preview.newFeatures`, no bonus
      spells/Destroy Undead threshold bump this level, AND none of the
      `lut-onetime` block's one-time choice cards (subclass, multiclass
      skill, ASI/feat, invocations, pact boon, fighting style) would
      actually render — reused the exact same `pendingXChoice || xDraft`
      guard each card already checks, so the tab can never disappear while
      something is still visibly rendered under it. New `visibleSteps`
      computed replaces the old static `steps` data array as the tab row's
      render source, renumbering the circled digits (①②) so hiding the
      middle tab doesn't leave a gap (①③) — each entry keeps its real
      `index` (0/1/2) so `activeStep`'s meaning throughout the rest of the
      component, and the body's existing `v-if="activeStep === N"` branches,
      needed zero changes. `npm run build` clean; `cd engine && node --test`
      243/243 (unaffected, pure `src/` UI work). Not live-tested in the
      browser per the Playwright-disabled rule — worth leveling a mundane
      Fighter (no spellcasting, no ASI this level) through the tool to
      confirm both non-Hit-Points tabs can disappear at once and the tab bar
      doesn't render empty.
