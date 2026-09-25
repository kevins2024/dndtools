# Completed TODO Items (Archive)

Finished items moved out of `TODO.md` on 2026-09-10 to keep that file short. Kept here verbatim, not summarized, so no detail from the original writeups is lost.

- [x] **Feat picker's near-alphabetical order was never actually enforced, and Sorra's rebuild — completed and validated — 2026-09-25.**

  **Feat picker**: `server.js`'s `/api/engine/feats` route just returned `Object.entries(feats.json)` with zero `.sort()` call — it only LOOKED "somewhat alphabetized" because that file happens to have been hand-authored in roughly-alphabetical batches over time, not because anything enforced it. Any feat added out of order (or any future one) broke the pattern. Added `.sort((a,b) => a.name.localeCompare(b.name))` — confirmed it's the only consumer of that route (`LevelUpTool.vue`).

  **Sorra's rebuild**: the character rebuild queue's last open item (Kerra/Torrin/Lexica were done earlier — see below). Built entirely through the New Character tool (Roll for Stats, per this session's other work) — validated with `engine.validateCharacter()` (clean, zero issues) and a direct spell-cap check (`spellsKnownForClass('Bard', 9)` = 12, and she has exactly 12 non-feature-granted leveled spells — no over-cap, unlike her old record's real 13-vs-12 violation). One minor non-bug worth knowing about, not fixed: she has "Invisibility" both as a normal chosen spell and via Shadow Touched's free-cast — legal under RAW, just a possibly-redundant pick; left as the project owner's own choice to revisit or not.

  Swapped over from `Sorra (Old)`, matching the same pattern the Lexica/Torrin/Kerra rebuilds used: `appearance`, `notes`, and `persona_notes` (none of which the fresh build had) transferred onto the new record; `full_name`/`image` already matched so needed no change. Checked beyond just `characters.json` this time — found and fixed 10 more references the earlier rebuilds' pattern would also have needed to check: 6 `party_items.json` entries' `equipped_by` field (her weapons/armor) PLUS 4 more via `carried_by` specifically (a field the equipped_by-only rename missed on the first pass — two of those, a pair of Boots of Speed and an Unnamed Horse, weren't even in the equipped_by list at all, just carried) — and 4 references across `user_prefs.json`'s active party (`members`, `marching_order`, and `watch_assignments`). Grepped the whole project afterward to confirm zero remaining references anywhere. `Sorra (Old)` deleted entirely.

  `npm run build` clean, `cd engine && node --test` 303/303, roster-wide `validateCharacter` sweep now comes back **fully clean** — Sorra (Old) was the one character still carrying a real known-spell-cap violation, so this closes out the very last item on the original character-rebuild queue.

- [x] **Alphabetized spell lists within each level, and a new "Roll for Stats" tool built into New Character creation — 2026-09-25.**

  **Alphabetization**: `CharacterSpellbook.vue`'s `spellGroups` (prepared/unprepared, each) and `SpellPillsByLevel.vue`'s (combat sheet) spell lists both now sort alphabetically within each level group, instead of showing spells in whatever order they were added/granted. Small, contained change, no engine involvement.

  **Roll for Stats**: project owner's ask — a fun, animated dice-rolling tool for generating ability scores (PHB standard method: 4d6, drop the lowest die, six times, freely assign the totals), built directly into `NewCharacterTool.vue`'s Abilities tab as a second method alongside the existing Point Buy option, rather than a separate standalone tool (project owner's own call: "once it exists, if we keep the UI small, it could actually live in the new character creator instead of a separate tool — that's probably better"). Verified the real rule via WebSearch (wikidot 404'd on several guessed URLs for this specific page) before building anything — multiple independent sources agreed, and this specific mechanic has no known 2014/2024 divergence.

  Split cleanly along the engine/UI line per the project's standing architecture rule (a real D&D mechanic belongs in `engine/` as a pure, portable function, not embedded in a Vue component):

  - `engine/rules/5e/abilityScoreRoll.js` — `abilityScoreFromDice(dice)` is the actual RULE, pure and deterministic (given 4 die values, which one gets dropped and what the total is — drops only ONE occurrence of the lowest value when two dice tie, not both). `rollD6`/`rollAbilityScore`/`rollAbilityScoreSet` wrap it with real randomness. Zero dependencies (no fs/path, no other rule file) — same as `combatTurn.js`, so it qualifies for the same direct-browser-require exception documented in `CLAUDE.md`.
  - `src/utils/abilityScoreRoll.js` — thin wrapper requiring the engine file directly (not through the `engine/index.js` barrel, which breaks webpack via other rule files' `fs`/`path` use — see `combatTurn.js`'s own header comment for the full story), same reasoning: this is rapid-click, session-local UI state with no reason to round-trip a server call per die roll.
  - 7 new engine tests (`abilityScoreRoll.test.js`) covering the pure function's real edge cases (tied-lowest-dice drops only one, worst/best possible rolls) plus sanity bounds on the randomized wrappers.
  - `NewCharacterTool.vue`: a Point Buy / Roll for Stats method toggle at the top of the Abilities tab (defaults to Point Buy — unchanged behavior for anyone not using the new option). Rolling shows a ~800ms "tumbling dice" animation (rapid-fire fake rolls via `setInterval`, including a live-shuffling fake total so the number doesn't sit frozen while the dice above it visibly change) before settling on the real result, with the dropped die shown struck-through/faded only at the moment of settling (a deliberate "tumble, then reveal" beat, not a constant flicker). Each of the 6 rolls gets its own "assign to ability" dropdown (mutual exclusion — picking an ability for one roll clears it from any other), an "Apply Rolled Scores" button (disabled until all 6 are validly assigned) writes the results into the same `baseScores` field Point Buy already uses — so everything downstream (species bonus preview, `finalScores`, the character shell) works identically regardless of which method produced the numbers — and a small always-visible "currently on character" summary confirms the click landed without needing to switch tabs. Freely re-rollable (this app doesn't enforce "one set, must use it," matching its general DM-arbitrated-not-enforced design elsewhere).

  `npm run build` clean, `cd engine && node --test` 303/303 (296 + 7 new).

- [x] **Cross-character spell search (`CharacterSpellbook.vue`) blind to full-class-list casters' preparable-but-unrecorded spells — fixed 2026-09-24.** Project owner's report: searching from another character's spellbook didn't surface Tackett (Circle of Stars Druid) for Pass Without Trace. Initial investigation had a false start — my own test script queried the spell as `'Pass without Trace'` (wrong casing) against the engine, which returned `false` and looked like it confirmed the spell simply wasn't on the Druid list at all. Recorrected the casing (`'Pass Without Trace'`, matching the real data) and it resolved cleanly: it IS a real Druid-list spell, well within Tackett's max preparable level (5), and genuinely not recorded in his `spells[]` — so the report was accurate.

  **Root cause**: `sharersMap`'s cross-character check used `getCharacterSpells()`, which only returns what's actually recorded on a character — correct for known-spell casters (Bard/Sorcerer/Warlock/etc.), where "recorded" and "knows" are the same thing, but wrong for the 5 full-class-list-prep classes (Cleric/Druid/Paladin/Ranger/Artificer), who can prepare ANY class-list spell at their next long rest whether or not it's sitting in their record. The component already drew this exact distinction for the CURRENTLY VIEWED character (`availableToPrepare`, `classSpellList`, `usesFullClassList` — an existing "browse and prepare from the full list" section), it just never got extended to the cross-character search.

  **Fix**: `sharersMap` now also checks, per other character, whether they `usesFullClassList` and — if so — matches the search term against their full class spell list (`getClassSpellList`) up to their own max preparable spell level (from `spell_slots`), in addition to the existing `getCharacterSpells()` check. Deduped via a small `add()` helper so a character matching both ways doesn't appear twice.

  **Also fixed the reported layout issue while in there**: `.sb-cross-search` was `flex: 1`, taking the whole search-bar row and leaving almost no room for the "known by: ..." results next to it (which is where the actual answer lives). Changed to `flex: 0 0 33%`, with the results span taking the remaining space and wrapping instead of forcing a single `nowrap` line.

  `npm run build` clean; no engine changes (client-side Vue + CSS only).

- [x] **Roster-wide combat-panel tile audit, remainder — closed out 2026-09-23.** Finishes the 3 items left open from the 2026-09-18 first pass (see below): a full by-hand read of every active character's complete feature list (not just the earlier keyword/bundling scan), the Arcane Recovery backfill, and Torrin's cosmetic text cleanup.

  **Arcane Recovery (Lenn/Kessara/Lyria)** — all 3 were completely untracked despite being a real once-per-day resource. Added `uses_max: 1, uses_current: 1, recharge: "long_rest"` to all three (real RAW: "once per day when you finish a short rest" — modeled as long-rest-cadence, matching every other once-per-day feature already in this data, since a long rest resets it same as a fresh day would).

  **Torrin's "Soulknife — Psionic Energy" redundant text** — reworded its `notes` field to point at the Psi resource pip (`resources[]`, built 2026-09-18) instead of restating the die count/recharge in prose, which could silently drift out of sync with the tracked value on a future level-up.

  **10 real action-icon/action-economy bugs found and fixed via the full by-hand read, each verified against RAW (dnd5e.wikidot.com, or a WebSearch fallback with 2014/2024/UA-contamination awareness when wikidot 404'd) before editing — not just pattern-matched:**

  - **Action Surge inconsistency, roster-wide**: Corwin and Eldi were tagged `action_type: "action"` (implying it consumes your action, defeating the entire point of the feature) while Vaz/Elucyne/Kerra/the TestFighter fixture correctly used `"free"` (a real, documented value in `dnd_utils.js`'s own schema). Real RAW: Action Surge costs no action at all. Both outliers fixed to `"free"`.
  - **Cunning Action missing its `bonus_action` tag on 5 of 6 rogues/multiclassers** (Denna, Pirra, Elucyne, Siv, Torrin) — only Eldi had it. A well-established, unambiguous RAW feature; no verification needed, just a roster-wide consistency fix.
  - **Vaz's Battle Master maneuvers Riposte and Parry** were both bare — real RAW: both are reactions (Riposte on a missed attack against you, Parry on a melee hit against you), unlike the game's other maneuvers (Disarming/Precision/Menacing Attack), which are correctly bare hit-riders with no separate action cost.
  - **Petra's "Inspiring Leader" was tagged `action_type: "action"`** — real RAW (verified via wikidot): a 10-minute activity, not a combat action at all. The feature's own `description` field already said "10-minute speech," so the wrong tag was likely a copy-paste default when it was first added. This app's `action_type` enum only has `action`/`bonus_action`/`reaction`/`free` — none fit a 10-minute activity, so the tag was removed entirely, matching the established convention for other narrative-time features (e.g. Vaz's "Know Your Enemy," already correctly bare).
  - **Eldi's "Echo: Reposition" (Echo Knight)** — real RAW (verified via wikidot): explicitly "no action required." Tagged `"free"`, matching Action Surge's precedent for zero-cost features, and distinct from the character's own separately-tracked "Echo: Swap Places" (a real bonus action).
  - **Chuknora's "Elemental Cleaver" (Path of the Giant)** — real RAW: auto-infuses on rage for free, but changing the infused damage type later costs a bonus action. The bonus-action half was untagged; added.
  - **Pirra's "Insightful Fighting (Revised)" (Rogue Inquisitive)** — real RAW (verified via wikidot): marking a target costs a bonus action. Was bare.
  - **Torrin's "Soulknife — Psychic Whispers"** — real RAW (verified via wikidot): costs a full action to establish the telepathic link. Was bare.
  - **Jaygar's "Flash of Genius" (Artificer)** — real RAW (verified via WebSearch, wikidot 404'd on the Artificer's page): a reaction, usable a number of times equal to Intelligence modifier (his is +5, INT 20), recharging on a long rest. Was completely untracked; added `action_type: "reaction"` + `uses_max/uses_current: 5` + `recharge: "long_rest"`.
  - **Siv's "Skirmisher" (Rogue Scout)** — real RAW (verified via wikidot): a reaction (move half speed when an enemy ends its turn within 5ft). Was bare.
  - **Rhuna's "Great Weapon Master"** — real RAW (verified via wikidot): the bonus attack after a crit/kill costs a bonus action. Was bare.

  **Checked and confirmed correctly bare, not bugs** (verified via wikidot before leaving alone, to avoid both false positives and false negatives): Rhuna's "Frenzy" (activates automatically while raging, no separate action cost — only the bonus-action attack it grants each turn is trackable, and that's inherent to the already-tracked Rage resource, not a separate feature); Revven's Destructive Wrath/Thunderous Strike (passive riders, already correctly bare per the 2026-09-18 pass); Iyani's "Loom Fire" (modifies how an already-cast cantrip works, not a new action cost).

  `npm run build` clean, `cd engine && node --test` 296/296 (pure `characters.json` data edits, engine untouched), and a targeted `validateCharacter` sweep on every touched character (15 of them) came back clean.

- [x] **Lexica's 13-vs-12 known-spell cap resolved, plus 4 real UI bugs found and fixed via live testing, 2026-09-22/23.** Project owner rebuilt Lexica from scratch as a throwaway test character ("LexicaBugTest") through actual New Character + Level Up tool use, specifically to try to reproduce both the Additional Magical Secrets pick-drop (see the still-open item above) and the spell-cap mystery live.

  **The spell-cap mystery, actually solved this time**: a clean level-1→9 engine simulation (no feats, plain ASI only) independently confirmed `engine.spellsKnownForClass('Bard', 9)` really is 12, not 13 — ruling out an engine math bug. Then LexicaBugTest's own from-scratch rebuild landed on exactly 12 known spells, and — critically — matched Lexica's real 13 name-for-name except for one: **Mass Cure Wounds**, present only on the real Lexica. Direct-comparison proof, not inference. Project owner's call: rather than delete Mass Cure Wounds, retroactively treat it as the (skipped, at the time) optional PHB spell-swap — Suggestion (2nd level) swapped out for Mass Cure Wounds (5th level) — since they now have slots to cast it and were "99% sure" the swap is legal. **Suggestion removed from Lexica's `spells[]`**; Mass Cure Wounds kept. `engine.validateCharacter(lexica)` now returns `[]` — no warning. `LexicaBugTest` deleted from `characters.json` entirely per project owner's request (never referenced elsewhere — `party_items.json`/`user_prefs.json`/`relationships.json` all clean).

  **4 real, independently-confirmed UI bugs found live-testing the rebuild, all fixed same session:**

  - **`NewCharacterTool.vue`'s background-skill picker let a curated background's fixed skill collide with one genus already granted.** Two stacked gaps: `skillDisabled()` only checked a species' own _choice_-based skill grant (`speciesSkillChoiceValues`), never a species' _fixed_ `grants_skill_proficiency` trait — widened to read `resolvedSpeciesGrants.skills` instead, which already aggregates both. Separately, picking a curated background pre-filled its skills straight into the `<select>`s' `v-model` with zero collision-checking against genus at all — since a `disabled` `<option>` only blocks a _new_ manual pick, not an already-bound value, the dropdown could show an invalid selection as "chosen." Now the pre-fill itself skips (leaves blank) any skill genus already grants, per PHB p.13's real "choose a different proficiency instead" overlap rule.
  - **Spell/cantrip pickers flashing/re-rendering on every single click, in `NewCharacterTool.vue`.** The whole "Spells & Features" tab body was gated behind a bare `v-if="loading"`, and `togglePick()` re-runs `runPreview()` (which sets `loading`) on every checkbox toggle — so the entire tab, pickers included, tore down and rebuilt on every pick. `LevelUpTool.vue` already fixed this _exact_ bug on 2026-09-11 (`v-if="loading && !preview"`, keeping existing content mounted through a routine re-fetch) — it just never got ported to `NewCharacterTool.vue`. Ported now, verbatim pattern.
  - **College of Lore's Bonus Proficiencies picker (built 2026-09-22) disappeared the instant all 3 were picked, blocking any change.** Its options list read directly from `pendingBonusProficienciesChoice?.options` — once the 3rd pick resolved the choice, the server stopped returning it as a pendingChoice at all, so that computed went null and the options list silently collapsed to empty (the card itself stayed visible via `bonusProficienciesDraft.length`, just with nothing inside). Fixed by caching the options into their own persisted `bonusProficienciesOptions` data property in `runPreview()`, matching every other spell/feature picker in the file (`magicalSecretsSpellOptions`, `bonusCantripOptions`, etc.) — none of which had this bug, since none of them read straight off the transient pendingChoice for their option list either.
  - **Feat picker layout imbalance — description column crammed to ~10vw.** An unstyled `<select>` sizes its closed-state width to its widest `<option>` text in most browsers; the feat catalog list is long and several options get a "(prereq not met)" suffix appended, so `.lut-subclass-picker` (flex: 0 0 auto, sized to content) was blowing out far past what a closed dropdown needs, squeezing `.lut-subclass-summary` down to a sliver. Capped `.lut-select`'s `max-width` (20rem) and added a matching cap to `.lut-subclass-picker` itself as backup — invisible to every other picker in the file, whose option text is short enough to never hit the cap.

  `npm run build` clean, `cd engine && node --test` 296/296 throughout (both rounds of fixes).

- [x] **Free-cast spell tracking expansion pass, 2026-09-22 — searched for more real cases beyond the original 7 feats + 2 species traits, per the method the original TODO item itself laid out.** Confirmed `feats.json`'s `grants_spells.free_cast` (7 feats) and `species.json`'s `tiered`/`uses` (2 species traits: Drow Magic, Infernal Legacy) are the only entries with real charge-tracked free casts in their respective catalogs — no gaps there. The real find was in the roster DATA, not the catalogs: cross-referenced every roster character's `features[]` against a keyword search (`at will`, `once per long rest`, `without expending a spell slot`, `regaining the use`, etc.) over `published_features.json`'s 849 entries, narrowed the ~91 raw keyword hits down to features actually present on the roster, then checked each candidate's actual RAW text and current data state by hand (most were false positives — generic Spellcasting blurbs, non-spell reaction/resource features like Tattoo of Warding or Tides of Chaos, or already-correctly-handled cases like Kerra's Book of Ancient Secrets, which already has its 2 chosen ritual spells properly stamped in `spells[]`).

  **Two real, concrete gaps found and fixed:**

  - **Elucyne (Tiefling, character level 9) was missing both tiers of her own Infernal Legacy** — she had the fixed Thaumaturgy cantrip, but neither the 3rd-level Hellish Rebuke (1/long rest) nor the 5th-level Darkness (1/long rest) free cast, despite being well past both thresholds. Root cause: `diffLevelUp.js`'s species-tiered-spell resolution block (built alongside the original free-cast pass) only fires when a tier's level is crossed DURING an active level-up call (`tier.level > totalLevelBefore`) — a character already past both thresholds before the mechanism existed gets skipped by every future level-up too, the same class of gap Caster Prestidigitation hit for existing Wizards. Fixed by adding the same two `speciesTrait`-type feature entries `diffLevelUp.js` would have generated at the time (`"Infernal Legacy: Hellish Rebuke"` / `"Infernal Legacy: Darkness"`, each with `spells_granted`, `uses_max: 1`, `recharge: "long_rest"`) directly to her `features[]` — confirmed via `engine.validateCharacter(elucyne)` returning `[]` after the edit. Checked the rest of the roster for the same gap (any other Tiefling, or any Drow for Drow Magic) — nobody else has either trait, so this was an isolated fix, not a batch one.
  - **Tackett (Circle of the Stars Druid) was missing Guiding Bolt from his Star Map feature** — RAW text: "You learn the Guidance cantrip, and you have the Guiding Bolt spell prepared at all times — it doesn't count against your number of spells known." He had Guidance but not Guiding Bolt. This isn't actually a free-cast/charge case (Guiding Bolt still costs a normal spell slot, it's just always-prepared and free of the known-spell cap) — same shape as Caster Prestidigitation, no `uses_max` needed. **Deliberately NOT fixed at the engine level**: `druid-circle-of-stars.json` has no `grants_spells` hook at all (unlike `feats.json`/`species.json`), so there's no existing mechanism to stamp onto — building one would be new engine design (a `grants_spells` field + resolution block for class/subclass features generally), not a "find and stamp" task within this pass's scope. Fixed Tackett's own character data directly (`spells_granted: ["Guiding Bolt"]` added to his Star Map feature entry) since he's the only Circle of the Stars character on the roster; **flagging that any future Circle of the Stars character built through New Character/Level Up will have the same gap until that engine work exists.**

  **Also confirmed, not a gap**: `cast_as_level` (used on Infernal Legacy's Hellish Rebuke tier in `species.json`, "cast once as a 2nd-level spell") is present in the data but read nowhere in the codebase — `diffLevelUp.js`'s species-tiered resolution only reads `tier.uses`, never `tier.cast_as_level`. Purely descriptive/unused today, not something this pass's fix depends on or changes — noted here so it isn't mistaken for a fixed bug if it comes up again.

  `engine.validateCharacter` clean on both fixed characters, `npm run build` clean, `cd engine && node --test` 296/296 (engine itself untouched — pure `characters.json` data edits).

- [x] **Every spell picker in LevelUpTool.vue now shows already-known spells disabled instead of hiding them, 2026-09-22.** The other half of the request that produced Caster Prestidigitation ("can we have the spell pickers show the spells the character already knows but have them disabled from selection?") — deferred at the time for budget, picked back up once Caster Prestidigitation landed.

  **Root cause of the old behavior**: `/api/engine/spell-choices` and `/api/engine/feat-spell-choices` (server.js) built `excludeNames` from `character.spells` only and fed it into `engine.listSpellsForClass`/`engine.listFeatSpellChoices`, which silently dropped matching names from the returned list — so an already-known spell just never appeared, with no visual indication why a list felt shorter than expected. This was also already quietly wrong for Caster Prestidigitation specifically: that grant lives in `character.features[].spells_granted`, not `character.spells`, so it was never excluded at all even under the old hide-it approach.

  **Fix**: both server routes stopped computing/passing `excludeNames` — they now always return the full eligible list regardless of what's already known. `LevelUpTool.vue` gained a `knownSpellNamesLower` computed (built from `spellUtils.js`'s `getCharacterSpells()`, the same 4-source resolution — class list/spellbook, subclass bonus spells, feature/feat grants, equipped items — `CharacterSpellbook.vue`/`CombatPanel.vue` already use) and an `isSpellKnown(name)` helper, applied across all 8 picker locations: bonus cantrips (Pact of the Tome), generic new cantrips, new known spells, spellbook adds, spell swap's "to" side, Magical Secrets (spells + cantrips tabs), and the `spell_choice`-type feat dropdowns (Fey Touched/Shadow Touched/Magic Initiate/Ritual Caster/Spell Sniper/Artificer Initiate/Wood Elf Magic). Each already-known option now renders checked-or-disabled with opacity (reusing the existing `.lut-pick-disabled` class already used by the Invocations picker) and a "(known)" label, rather than vanishing.

  Deliberately scoped to `LevelUpTool.vue` only — `NewCharacterTool.vue` calls the same `/api/engine/spell-choices` route twice, but both call sites already always pass an empty `character.spells` (a brand-new character has none yet), so the old server-side exclusion was already a no-op there and this change doesn't affect it. Noted in passing: a High Elf's species-granted cantrip (`features[].spells_granted`) was never cross-checked against the class-cantrip picker there either, before or after this change — a real latent gap, but pre-existing and out of scope for this pass.

  `npm run build` clean, `cd engine && node --test` 296/296 (engine itself untouched — this was server.js request-shape + Vue template/computed work only).

- [x] **Caster Prestidigitation house rule (house_rules.json) — fully wired and backfilled across the whole roster, 2026-09-22.** Rule: Sorcerer/Wizard → Prestidigitation, Druid → Druidcraft, Cleric → Divine Prestidigitation, Warlock → Dark Prestidigitation (both homebrew variants already existed as real `published_spells.json` entries, just never granted to anyone) — free, always prepared, doesn't count against spell allotment, can't be removed.

  **First attempt modeled it as a direct `character.spells[]` entry** (matching how Fey Touched's free-cast spells work) — worked for 6 of 9 affected characters (Petra, Revven, Rith, Iyani, Therynv'l, Kerra), but **completely failed for Lenn/Kessara/Lyria**, the 3 Wizards sharing a spellbook (`spellbook_id: "sb_1"`): `spellUtils.js`'s spellbook-read path REPLACES `character.spells[]` wholesale for display once that field is set, silently swallowing anything written there. This is the exact same class of gap already flagged from an earlier Kessara racial-cantrip backfill.

  **Project owner's fix, cleaner than the original approach**: model it as a `character.features[]` entry with `spells_granted: [name]` instead (the same convention `spellUtils.js`'s own doc comment already names for "Shadow Touched, Fey Touched, Drow Magic, Tiefling Legacy, etc.") — that resolution step runs unconditionally regardless of `spellbook_id`, so it reaches every caster the same way with no special-casing needed. Also a genuinely better fit for "cannot be removed" (no per-feature remove action exists, unlike a spells[] entry) and needs no per-spell state, unlike Fey Touched's charge-tracked free casts (which correctly stay spells[]-based, since a feature-level `spells_granted` array has nowhere to hang individual uses_max/uses_current/recharge on when one feature can imply multiple independently-tracked spells).

  `diffLevelUp.js` now pushes a `{name: 'Caster Prestidigitation', spells_granted: [cantrip], _source: '...'}` feature unconditionally per matching base class (no subclass/level gating — every character who has the class gets it from 1st level). Re-backfilled the roster onto the new shape: removed the 6 now-wrong `spells[]` entries from the first attempt, added the correct feature-based grant to all 9 affected characters (Petra, Revven, Rith, Iyani, Therynv'l, Kerra, **plus Lenn/Kessara/Lyria, finally**). Tackett was left alone — he already independently knows Druidcraft as a normal chosen cantrip, predating this rule; adding a second, redundant grant on top wasn't worth it for a cosmetic "does it count against his cap" nicety.

  **Real, separate, still-open gap found while double-checking Kessara's original racial-cantrip issue wasn't accidentally fixed by this**: it wasn't — `species_traits[].spells_granted` (where her Minor Illusion racial cantrip actually lives) is a completely different array from `character.features[]`, and `spellUtils.js`'s step 3 only ever reads the latter. Confirmed by direct inspection, not assumed. Worth fixing in the same pass as the original Kessara TODO note whenever that gets picked up — outside this rule's own scope, not touched here.

  5 engine tests needed updating (fixtures using Sorcerer/Wizard/Cleric/Warlock characters now correctly pick up an extra unconditional feature grant that pre-existing exact-match assertions didn't account for) — all confirmed as expected new behavior, not regressions, before adjusting. `npm run build` clean, `cd engine && node --test` 296/296, and a roster-wide `validateCharacter` sweep shows no new issues.

## Batch archived 2026-09-21 (project owner asked for a TODO.md cleanup pass — everything below was fully done, just never moved)

- [x] **Live-combat feedback dump, 2026-09-18 — fixed.** Project owner sent ~18 items found while actually playing a fight; asked to fix as many as possible without input. Fixed same session: player HP/temp/heal changes now show in the Battle Log (previously enemy-only); a generic spend/restore mechanism for limited-use features and item/weapon-effect charges (previously every uses_max/uses_current counter in the whole app was read-only — this also fixed Gauntlet of the Sundering Blow's missing tracker, since its data was already there, just never surfaced); Battle Map's toolbar restructured to 2 flexible rows that wrap onto more lines instead of squeezing (an initial fixed-1500px-width attempt was corrected same-day per project owner feedback — the ask was never a forced size), plus the Close button moved to the panel's top-right corner where users expect it; a manual token-size override (Tiny–Gargantuan) for enemies added outside the bestiary; a real `Raging` condition plus `dnd.rageDamageBonus` (PHB table, wired into the weapon damage tooltip); condition pills' active-state legibility (was condition-colored text on a same-hue tinted background, hardcoded rgba not even theme-aware — now solid background + `var(--color-bg)` text); custom free-text condition pills ported from enemies to players; the "Free cast via X" spell tooltip reworded (it claimed free-of-cost for every feature-granted bonus spell, but only Weave Attunement's own level-1 pips are actually free — most, like Gloom Stalker Magic, still cost a normal slot); The Retired Special's wording; and `stored_spells` (Ring of Spell Storing-type items) made addable/removable instead of a read-only tag list.

  **Investigated, found correct — not a bug**: "Next Turn doesn't refresh everyone's actions/bonus/reactions on a new round." Traced through `combatTurn.js`'s `advanceTurn`, `CombatContext.vue`'s handler, and the Battle.vue/ActionEconomyRow template binding — all three correctly refresh only the NEWLY ACTIVE combatant's resources each call, which is actually the real RAW rule (your action economy refreshes at the start of _your_ turn, not everyone's at once at round start) — verified directly with a synthetic 3-combatant wraparound test. If the project owner wants batch-refresh-everyone-at-round-start instead, that's a deliberate rules-house-rule change, not a bug fix — flag if so.

  **All data-level items fixed 2026-09-18, once the live battle progress was confirmed saved:**

  - **Chuknora's Channel Divinity** split into `pub_channel-divinity-nature-s-wrath` / `pub_channel-divinity-turn-the-faithless`, each with `action_type: "action"`; the shared 1/short-rest pool tracks on one entry only (the other carries a note), so this doesn't double her real uses.
  - **Cold Valley Axe's Smite From Afar** reworked (`published_spells.json`) — no longer requires a thrown/ranged attack; now lets the wielder's next melee attack target a creature within 30ft instead, matching the name and the project owner's read of the intended mechanic.
  - **Torrin's `psychic_blades` flag turned on.** The full attack/damage computation (finesse mod, proficiency, item bonuses) already existed in `dnd_utils.js` since 2026-09-15 — it was just never activated on his own record, which also explains why his armor's `psychic_blade_attack`/`_damage` bonuses looked unwired (they weren't; nothing was reading them because the whole block was gated off). **Correction to the project owner's report**: verified via 2 independent sources that Psychic Blade damage does NOT scale with level — only the separate Psionic Energy die _size_ does (d6→d8→d10→d12 at levels 3/5/11/17), which his data already modeled correctly for level 9. Likely a mix-up between the two mechanics.
  - **Homing Strikes and Psychic Teleportation** split out of Torrin's bundled "Soul Blades" entry into their own tiles (`reaction` / `bonus_action`). Found and fixed a real content error along the way: the old bundled description invented a follow-up attack after Psychic Teleportation that isn't real RAW (verified 2 sources — you throw the blade, teleport to it, it vanishes, no attack).
  - **Backfilled missing `uses_max`/`uses_current`/`recharge`**: Action Surge + Second Wind for Vaz, Elucyne, and the `TestFighter`/`Kerra` fixtures (all were bare name-only stubs). Petra's Channel Divinity (2/rest) got the same treatment. Rhuna's Rage got its missing `action_type`.
  - **Superiority Dice (Vaz) and Psionic Energy (Torrin) converted to `character.resources[]` entries** instead of a count frozen in a feature's name/notes text — both now render through `ClassResourcesPanel.vue`'s clickable-pip UI, same component sorcery points/ki already use.

  **Roster-wide combat-panel tile audit — first real pass done 2026-09-18.** Went through every active roster character (excluding `(Old)` archived sheets and the `TestFighter` fixture) looking for the Soul Blades pattern (one pill bundling several sub-abilities with genuinely different action costs) plus a systematic scan for tracked-use features missing `action_type`. The bundling pattern itself turned out rare — most subclass features are either one clear action or a passive/rider effect that's correctly bare — but the pass surfaced real, unrelated data bugs along the way worth fixing regardless:

  - **Therynv'l (Circle of the Moon) — the one genuine new bundling fix.** "Combat Wild Shape" bundled 2 different things (bonus-action Wild Shape activation, already separately shown on the Wild Shape tile's own `action_type`; and a genuinely distinct bonus-action ability to expend a spell slot for 1d8 HP/level of healing while shaped) into one undifferentiated pill. Split the healing half into its own "Combat Wild Shape: Healing" tile (`bonus_action`). **Real content error found and corrected along the way**: the old description also claimed you could cast a 1-action-casting-time spell while shaped by expending a slot — verified via dnd5e.wikidot.com that this isn't real RAW at all (only the healing option exists); removed.
  - **Enauweyn (Oath of the Crown) — real double-counting bug.** Both her Channel Divinity options (Champion Challenge, Turn the Tide) independently carried `uses_max: 1`, giving her 2 real uses instead of the correct shared 1/short-rest pool — same class of bug this session already fixed for Chuknora/Petra, just not caught for her at the time. Also **a real action-cost error**: Champion Challenge was tagged as a full action; verified via 2 independent sources that both Oath of the Crown options are bonus actions.
  - **Ferghus (homebrew Oath of the Open Road) — missing action icons.** "Vow of the Open Road" (his homebrew Channel Divinity option) and "Sacred Weapon" both lacked `action_type` despite their own `published_features.json` catalog entries already correctly specifying `action` — added, plus cross-reference notes clarifying both share the one bare "Channel Divinity" bookkeeping entry's pool (a third, equally valid data-modeling convention already in use elsewhere on the roster — Ferghus/Petra keep a generic tracked pool entry, Chuknora/Enauweyn track on one named option — not something this pass tried to unify roster-wide). Also added the missing `action_type: "action"` to his Lay on Hands (Enauweyn's own copy already had it correctly).
  - **Revven (Tempest Domain) — the worst-off character found, near-total backfill.** Every single class feature was a bare name-only stub with zero `action_type`/`uses_max` anywhere. Fixed: Wrath of the Storm (real RAW: reaction, uses = Wisdom modifier [5], long rest — was completely untracked); Channel Divinity: Turn Undead (action, 2 uses at Cleric 9, short rest — also untracked); Destructive Wrath given a shared-pool cross-reference note (it's a free rider on a damage roll, no action cost of its own — correctly bare, just needed the note). **Two more real content errors found**: her "Tempest Cleric — Thunderbolt Strike" isn't a real feature name — verified via 3 independent sources the actual PHB 6th-level feature is "Thunderous Strike" (a passive push rider, not its own action); and she had BOTH "Blessed Strikes" (Tasha's optional feature) and "Divine Strike" (the base PHB feature it explicitly replaces, per its own catalog note) simultaneously — a genuine RAW contradiction, not a real build choice (both were bare unexplained stubs) — removed the duplicate Blessed Strikes, kept Divine Strike.
  - **Kessara (Bladesinger) — missing action icon.** Bladesong had its uses/recharge correctly tracked (fixed in an earlier session) but no `action_type` — added `bonus_action`.

  **Verification**: `python3 -c "import json; json.load(...)"` clean, `npm run build` clean, `cd engine && node --test` 295/295 (pure data edits, engine untouched). Safety-checked before editing: `characters.json` had a large uncommitted diff at the start of this pass from the party's own live long-rest autosave (every `hp_current` landing exactly on `hp_max`, confirmed with the project owner before touching anything) — my own edits are isolated to the specific characters/fields listed above, verified via a post-edit diff scoped to just those names.

  Remaining open work from this pass (a full one-by-one roster read, Arcane Recovery uses_max/recharge tracking for Lenn/Kessara/Lyria, and a cosmetic redundant-text cleanup on Torrin) is still tracked as its own open item in `TODO.md`.

- [x] **Full class/subclass feature audit — discovery pass done 2026-09-16, all 10 confirmed gaps fixed 2026-09-18.** Confirmed pattern: Fighting Style (fixed 2026-09-09), Favored Enemy + Natural Explorer (fixed 2026-09-16), Expertise (fixed 2026-09-17), and now **Sorcerer's Metamagic (fixed 2026-09-18)** were all the same root bug — a `features_by_level` entry resolves to a generic catalog name with zero mechanism turning it into a real `pendingChoice`, so New Character/Level Up just list a bare, unpickable feature forever. Ran a systematic scan of every base class (`engine/data/5e/classes/*.json`) and every subclass (`engine/data/5e/subclasses/*.json`) against `diffLevelUp.js`'s actual `pendingChoices.push({type: ...})` call sites (the only reliable ground truth — currently: `asiOrFeat`, `fightingStyleChoice`, `expertiseChoice`, `favoredEnemyChoice`, `naturalExplorerChoice`, `metamagicChoice`, `invocationChoice`, `pactBoonChoice`, `bonusSpellChoice`, `subclassChoice`, `multiclassSkillChoice` — anything else is unwired by definition).

  **Metamagic fixed 2026-09-18.** New `engine/data/5e/metamagic.json` + `engine/rules/5e/metamagic.js` (mirrors `fighting-styles.json`/`fightingStyles.js` exactly — per-class named-option catalog, case-insensitive lookup) catalog all 10 real options: the 8 core PHB ones (Careful/Distant/Empowered/Extended/Heightened/Quickened/Subtle/Twinned Spell — already present in the SRD cache under real ids, reused unchanged so the frontend's existing `lookupFeature` description path resolves them with zero extra plumbing) plus 2 Tasha's Cauldron of Everything additions (Seeking Spell, Transmuted Spell — not in the SRD cache, so given matching `published_features.json` entries, same convention as `fighting-styles.json`'s own TCE additions). All costs/effects verified against dnd5e.wikidot.com (2 independent fetches) plus a WebSearch cross-check on the 2 TCE additions specifically. `diffLevelUp.js` now resolves all 3 of Sorcerer's grant points (3rd: pick 2, generic id `metamagic-1`; 10th/17th: pick 1 each, `gen_sorcerer_base_metamagic-3rd-option`/`-4th-option`) into individually-named `type: "metamagic"` feature entries (matching how Rith/Iyani's existing data already stored picks, rather than Expertise's single-combined-name convention), with level-scoped dedup and an already-known-options filter (so a Sorcerer who also has Metamagic Adept — see Lenn — isn't offered a name they already know). `server.js`'s `preview-level-up` route needed a matching `metamagicChoice` passthrough — **caught by hand via a live curl test against the real route, not just the direct-function test**, since the route silently drops any param it doesn't explicitly destructure/forward; a first curl attempt hit a stale leftover server process from earlier in the session and looked broken until restarted, which is what surfaced the missing passthrough. `LevelUpTool.vue` gets a new checkbox-list picker card (mirrors Expertise's `togglePick`-based UI, not Fighting Style's radio buttons, since Metamagic can pick more than 1 at 3rd level) — not added to `NewCharacterTool.vue`, since that tool only ever builds level-1 characters and Metamagic's earliest grant is 3rd. `cd engine && node --test` 295/295, `npm run build` clean, plus a direct `diffLevelUp` sanity check (level 3 pick-2, level 10 dedup excluding an already-known option) and a real end-to-end curl against `/api/engine/preview-level-up`.

  **Confirmed real gaps, base classes** (verified against each feature's actual stored description text, not just guessed from a keyword match):

  - **Sorcerer's Metamagic** (L3: pick 2 options; L10/L17: +1 each) — zero wiring anywhere (`grep -n metamagic engine/rules/5e/diffLevelUp.js` returns nothing). High value — Metamagic is Sorcerer's core identity and every Sorcerer hits L3.
  - **Bard's Magical Secrets — fixed 2026-09-18, alongside College of Lore's Additional Magical Secrets (same underlying fix).** Real RAW distinction confirmed by re-reading the SRD cache's own stored text (`src/data/api_data_cache/features.json`, ids `magical-secrets-1` and `additional-magical-secrets`) rather than assumed: base Bard Magical Secrets (10th/14th/18th, same generic id reused 3× — dedup scoped to `level_gained` like Favored Enemy) explicitly says its 2 picks "are included in the number in the Spells Known column," i.e. they **count against** the normal known-spell total — the opposite of what this TODO item originally assumed ("doesn't count against known spells," a description that actually only fits College of Lore's version). College of Lore's Additional Magical Secrets (6th, its own distinct id, subclass-scoped) explicitly says the opposite: "don't count against the number of bard spells you know." `diffLevelUp.js` models this as the one real difference between two otherwise-identical resolution blocks — base grants a plain `character.spells` entry (`_source: "Magical Secrets"`, no `featureGranted`), College of Lore's gets `featureGranted: true` (exempt, same convention as every other bonus-spell grant in this app). Both share ONE new `magicalSecretsChoice` param (single value, not level-keyed — confirmed safe because `LevelUpTool.vue`'s own `targetLevel` computed is always `currentLevel + 1`, so a multi-level jump crossing more than one grant point is never actually reachable through this tool, unlike the theoretical case Combat Superiority's `maneuverChoices` accumulator defends against). Eligible spells are "any class's list, up to the level you can cast, or a cantrip" — since `spellLists.js`'s own doc comment records a deliberate project-owner instruction that a cantrip pool and a leveled-spell pool are "never conflated," the new `LevelUpTool.vue` picker fetches both pools as two SEPARATE lists (via 2 calls to the existing `/api/engine/spell-choices` route, `pool: 'any'`) under a shared tab UI, rather than extending `listSpellsForClass` to merge them — no engine data-layer changes needed for this part at all. `server.js`'s passthrough added (same class of gap the last 2 fixes each caught by hand). `cd engine && node --test` 295/295, `npm run build` clean, direct `diffLevelUp` sanity checks for both mechanisms (confirmed opposite `featureGranted` behavior), and a real end-to-end curl against `/api/engine/preview-level-up`.
  - **Warlock's Mystic Arcanum — fixed 2026-09-18.** 4 distinct grant ids (one per spell level: 6th at 11th, 7th at 13th, 8th at 15th, 9th at 17th), resolved like Metamagic — each independently, no level-keyed accumulator needed. Eligible options computed via the existing `listSpellsForClass('Warlock', {maxLevel, pool:'class'})` filtered to the EXACT spell level (not ≤maxLevel — a real distinction from every other spell-list caller in this file, which all want a range). Resolved into a `character.features[]` entry with `uses_max: 1, uses_current: 1, recharge: 'long_rest'` — reusing this session's earlier `SPEND_FEATURE_USE`/`RESTORE_FEATURE_USE` combat-panel mechanism for free, rather than a `character.spells[]` entry, since RAW casts it completely outside the normal spell-slot/known-spell economy. **Caught a real regression via `cd engine && node --test`, not found by hand**: `npcBuilder.js`'s synthetic-NPC generator has a fixed switch/case list of pendingChoice types it knows how to auto-resolve, and it hard-throws after 8 failed attempts for anything not listed — Warlock is one of its 5 tested roles, so this fix immediately broke `npcBuilder.test.js`'s "builds cleanly... for every role" test the moment it reached 11th level. Fixed by adding a case for `mysticArcanumChoice`, and (since the same class of gap silently affects every OTHER new pendingChoice type this session added — Metamagic/Maneuvers/Magical Secrets/Iron Mind/Bladesinger's weapon pick/Divine Magic/Dragon Ancestor — none of which happen to collide with `npcBuilder.js`'s 5 tested roles today, purely by luck) added all 7 of those cases too, defensively, so a future role reaching any of them doesn't hit the identical wall. `cd engine && node --test` 295/295, `npm run build` clean, a direct `diffLevelUp` sanity check, and a real end-to-end curl against `/api/engine/preview-level-up`.
  - **Wizard's Spell Mastery and Signature Spells — both fixed 2026-09-18.** Real architectural constraint found while wiring: both RAW-require the spells already be "in your spellbook," but a migrated Wizard's actual known-spell list lives in `spellbooks.json` (a `src/data`-only concept `engine/` has no access to by design, per CLAUDE.md's engine/src split) — so unlike every other picker this session, these don't validate "already known," only the required spell LEVEL (1st+2nd for Spell Mastery, two 3rd for Signature Spells), trusting the rest to the player/DM per this project's existing DM-flexibility precedent. `LevelUpTool.vue` gets free-text inputs instead of a `<select>` for the same reason (no fixed catalog to offer). **`npcBuilder.js` needed a `spellMasteryChoice`/`signatureSpellsChoice` case too** — Wizard/Evocation is one of its 5 tested roles and the test suite's level-19 case crosses Spell Mastery's 18th-level grant, so this was caught immediately by `node --test` the same way Mystic Arcanum's regression was. `cd engine && node --test` 295/295, `npm run build` clean, a direct `diffLevelUp` sanity check, and a real end-to-end curl against `/api/engine/preview-level-up`.

  **This closes out the full class/subclass feature audit** — all 9 confirmed gaps (Metamagic, Combat Superiority, Magical Secrets ×2, Fighter Champion's Additional Fighting Style, Ranger Gloom Stalker's Iron Mind, Wizard Bladesinger's Training in War and Song, Sorcerer Divine Soul's Divine Magic, Draconic Bloodline's Dragon Ancestor, Warlock's Mystic Arcanum, and Spell Mastery/Signature Spells) are fixed, tested, and verified end-to-end.

  **Confirmed real gaps, subclasses** (spot-checked, not exhaustive — see methodology note below):

  - **Fighter Battle Master's Combat Superiority — fixed 2026-09-18.** New `engine/data/5e/maneuvers.json` + `engine/rules/5e/maneuvers.js` (mirrors `metamagic.json`/`metamagic.js` exactly) catalog all 23 real maneuvers: the 16 core PHB ones plus 7 Tasha's Cauldron of Everything additions (Ambush, Bait and Switch, Brace, Commanding Presence, Grappling Strike, Quick Toss, Tactical Assessment) — none exist in the SRD cache (unlike Metamagic's 8 core options), so all 23 got their own `published_features.json` entries with real descriptions, verified against dnd5e.wikidot.com (4 fetches: opening lines, 2 targeted full-text follow-ups, one for all 7 TCE maneuvers) plus a WebSearch cross-check on a 5-maneuver sample. **Structurally different fix than Metamagic/Fighting Style/Expertise**: Combat Superiority's own `features_by_level` entry ("pub_combat-superiority") only exists ONCE, at 3rd level — 7th/10th/15th each list a genuinely different feature (Know Your Enemy, Improved Combat Superiority d10, Relentless), not a reusable "learn more maneuvers" placeholder, so there was nothing to match/replace at those 3 later levels the way every other picker in this file works. Resolved instead the same way `asiOrFeatLevels` already is: a fixed level→count table (`{3:3, 7:2, 10:2, 15:2}`) checked directly against `classEntry.subclass`, looped over every level actually crossed by one `diffLevelUp` call (supports a multi-level jump hitting more than one grant point at once) — `maneuverChoices` is a new param keyed by level for the same reason `asiOrFeatResolutions` is, not a single value per call like `metamagicChoice`. **Real crash bug caught by the engine test suite, not written into the code from the start**: the new subclass check (`normalizeName(classEntry.subclass) === 'battle master'`) initially had no null guard — `normalizeName` (the local one in `diffLevelUp.js`, unlike every catalog module's own null-safe copy) throws on `null.trim()`, and `classEntry.subclass` is legitimately `null` for any Fighter who hasn't picked a subclass yet (i.e. every Fighter below 3rd level) — `cd engine && node --test` failed immediately on an unrelated species test that happened to use a subclass-less Fighter, caught and fixed with a `classEntry.subclass &&` guard before the crash could reach anyone leveling up a real character. `LevelUpTool.vue` gets a new picker (mirrors Expertise's checkbox/`togglePick` shape, but needs its own `toggleManeuverPick` instead, since a completed level's picks have to be written into the `maneuverChoices` accumulator, not just synced into a single draft array like every other picker) — also fixed a real pre-existing gap while touching the "No one-time choices at this level" gate: it was missing Favored Enemy/Natural Explorer/Expertise/Metamagic (added earlier this session and never added there) alongside the new Maneuver entry, so that message could show at the same time as an actual pending picker. Not added to `NewCharacterTool.vue` (same reasoning as Metamagic — Battle Master's earliest grant is 3rd level, never reachable at character creation). `server.js`'s `preview-level-up` route needed the matching `maneuverChoices` passthrough (same class of gap Metamagic's fix caught — the route silently drops any param it doesn't explicitly forward). `cd engine && node --test` 295/295, `npm run build` clean, plus direct `diffLevelUp` sanity checks (level-3 pick-3, a multi-level 2→10 jump crossing all 4 grant points in one call, cross-level dedup excluding already-known maneuvers) and a real end-to-end curl against `/api/engine/preview-level-up`. Tasha's Martial Versatility's "swap a known maneuver" option was deliberately left unimplemented, same precedent as Fighting Style's own Martial Versatility note in `fighting-styles.json` — no swap mechanic exists yet for any similar feature in this app.
  - **Fighter Champion's Additional Fighting Style — fixed 2026-09-18.** Confirmed it really was broken: the base Fighting Style block's `fightingStyleGenericIds` map only knows each class's FIRST grant id (`fighter-fighting-style`), but Champion's 10th-level grant uses a completely different id (`additional-fighting-style`, its own real SRD entry: "At 10th level, you can choose a second option from the Fighting Style class feature") — so it fell through with no picker at all. Also would have been wrong to just add the id to the existing map: that block's `alreadyHasStyle` check (scoped by class only) exists specifically to enforce "one pick per class," which would have wrongly suppressed Champion's real, intentional SECOND pick the moment the 1st-level one resolved. New dedicated block scoped by `level_gained` instead (same shape as Favored Enemy/Natural Explorer's multi-grant handling below it) — reuses the existing `fightingStyleChoice` param and `loadFightingStyle`/`listFightingStyles('Fighter')` catalog functions unchanged, correctly excludes the already-known 1st-level style from the 2nd pick's options (RAW: never the same option twice, regardless of source). **No frontend changes needed at all** — `LevelUpTool.vue`'s existing Fighting Style picker already reads `pendingFightingStyleChoice?.level` dynamically with no level-1 assumption baked in, so it "just worked" once the engine started emitting the pendingChoice. `cd engine && node --test` 295/295, `npm run build` clean, a direct `diffLevelUp` sanity check (level 9→10, existing Dueling correctly excluded from the offered options, Archery resolves as a second `fightingStyle` feature without disturbing the 1st-level one), and a real end-to-end curl against `/api/engine/preview-level-up`.
  - **Rogue Mastermind's Master of Intrigue — fixed 2026-09-18.** Real RAW (`pub_master-of-intrigue`): disguise kit + forgery kit + ONE gaming set of your choice (proficiencies), TWO languages of your choice, and accent mimicry (pure flavor, nothing to track). The language half reuses `engine/rules/5e/languages.js`'s existing catalog directly — this is its first LEVEL-UP use; it already powered `NewCharacterTool.vue`'s species/background language picker at character creation, so no new catalog was needed there. The 4 real PHB gaming sets are kept as a local list inline in `diffLevelUp.js` rather than their own data file — narrow and single-use enough (unlike `weapon-types.json`) not to earn one. New `extraToolProficiencies`/`extraLanguages` accumulators (parallel to Bladesinger's `extraArmorProficiencies` etc.) merge into `patch.tool_proficiencies`/`patch.languages`. The gaming-set and language picks resolve **independently** — a real design choice, not an oversight: the fixed kit proficiencies apply the moment the block runs regardless of which (if either) pick is complete, and the two pendingChoices (`masterOfIntrigueGamingSetChoice`, `masterOfIntrigueLanguageChoice`) are each pushed/withheld on their own, so completing one doesn't block or reset progress on the other — verified via a direct 3-call sanity test (no picks → both pending; gaming set only → language still pending; both → fully resolved, kits present at every stage). `LevelUpTool.vue` gets a `<select>` for the gaming set and a checkbox list (reusing the generic `togglePick`) for the 2 languages. `npcBuilder.js` cases added proactively (no currently-tested role uses Mastermind, so this wasn't caught by `node --test`, but the last 2 fixes' near-misses made it clear every new pendingChoice type needs one on principle). `cd engine && node --test` 295/295, `npm run build` clean, and a real end-to-end curl against `/api/engine/preview-level-up`.
  - **Sorcerer Divine Soul's Divine Magic and Draconic Bloodline's Dragon Ancestor — both fixed 2026-09-18.** Real correction found while wiring Divine Magic: this TODO item's own description ("pick a Cleric-domain affinity — Life/Light/Nature/Storm/Tempest/Trickery/War") was wrong — `sorcerer-divine-soul.json`'s own `grants_spells.affinity_bonus_spell` table (real XGE data, already correct) is keyed by **alignment** (good/evil/law/chaos/neutrality), not Cleric domain, and matches Rith's own already-correct hand-set data exactly (`_source: "Divine Magic (Law affinity)"`). New `divineMagicChoice` param/pendingChoice resolves any of the 5 affinities into a real bonus spell (`featureGranted: true`, doesn't count against spells known) — **verified Rith's own existing data is correctly recognized as "already chosen" and never re-prompted** (checked via a dedicated sanity test, not just assumed). Dragon Ancestor reuses Dragonborn's own `ancestry_options` table in `species.json` directly via the already-exported `loadSpecies()` (no separate catalog needed — same 10 dragon types, same damage-type mapping) — resolved into a `type: "dragonAncestor"` feature entry carrying the matched `damage_type` for any future mechanical use (Elemental Affinity's CHA-to-damage bonus isn't wired anywhere yet — a separate, not-yet-requested gap, out of scope here). `cd engine && node --test` 295/295, `npm run build` clean, direct `diffLevelUp` sanity checks for both mechanisms plus the Rith non-re-prompt check, and real end-to-end curls against `/api/engine/preview-level-up` for both.
  - **Wizard Bladesinger's Training in War and Song — fixed 2026-09-18.** Real scope turned out bigger than "just the weapon pick": the feature's other two grants (light armor proficiency, Performance skill if not already had) are unconditional, but nothing in `diffLevelUp.js` applies ANY armor/skill/weapon proficiency for a normal (non-multiclass) level-up at all — that machinery previously only existed inside the multiclass-pickup branch. Fixed with 2 new accumulators (`extraArmorProficiencies`, `extraSkillProficiencies`, alongside a new `extraWeaponProficiencies` for the actual pick) merged into `patch.armor_proficiencies`/`skill_proficiencies`/`weapon_proficiencies` the same Set-based dedup way `saving_throws` already was. New `engine/data/5e/weapon-types.json` + `engine/rules/5e/weaponTypes.js` catalog the 21 real PHB one-handed melee weapons (9 simple + 12 martial, versatile weapons included since they CAN be used one-handed) — names stored lowercase to match this app's existing `weapon_proficiencies` string convention exactly (`character.weapon_proficiencies.push(...)`-ready, no case conversion needed). New `bladesingerWeaponChoice` param/pendingChoice, `server.js` passthrough, and a `LevelUpTool.vue` `<select>` picker mirroring Favored Enemy's shape. **Not retroactive** — Kessara (this project's one real Bladesinger) already has her weapon pick ('rapier') set by hand from an earlier session, but her Performance skill grant was never backfilled and still isn't (confirmed missing from her `skill_proficiencies` while auditing this fix) — left alone rather than editing live character data as a side effect of an engine fix; worth a deliberate one-line backfill in a future pass. `cd engine && node --test` 295/295, `npm run build` clean, a direct `diffLevelUp` sanity check (all 3 grants resolve correctly together), and a real end-to-end curl against `/api/engine/preview-level-up`.
  - **Bard College of Lore's Additional Magical Secrets** — fixed alongside base Magical Secrets, see that item above.
  - **Ranger Gloom Stalker's Iron Mind — fixed 2026-09-18.** Small, cheap fix once found: the common case is NOT a real choice at all (RAW just grants Wisdom save proficiency outright), so `diffLevelUp.js` adds it straight to a new `extraSavingThrowProfs` accumulator (merged into `patch.saving_throws` alongside the existing feat-only `featSavingThrowProfs`) with zero pendingChoice — only when the character already has Wisdom save proficiency (checked directly against `character.saving_throws`, e.g. from a Cleric/Druid multiclass) does a real 2-option `ironMindChoice` (`'Intelligence' | 'Charisma'`) pendingChoice/param pair get used, resolved the same single-value-per-call way as `fightingStyleChoice`. New `LevelUpTool.vue` picker mirrors Favored Enemy's plain `<select>` shape (a fixed 2-item list needs no server fetch, unlike Favored Enemy's own catalog-backed options). `cd engine && node --test` 295/295, `npm run build` clean, direct `diffLevelUp` checks for both branches (auto-grant when Wis isn't already proficient; real 2-option pick + correct resolution when it is), and a real end-to-end curl against `/api/engine/preview-level-up`.

  **Methodology note, important for whoever continues this**: the discovery pass used a regex over each feature's stored description text (`choose|pick one|pick two|of your choice|select one|select two`) across `src/data/api_data_cache/features.json` + `src/data/published_features.json`, filtered against `diffLevelUp.js`'s real pendingChoice types. This produced ~15 confirmed hits above but also **~70 further "REVIEW" hits across nearly every subclass that were NOT individually verified** (most are very likely false positives — in-play tactical choices like "deal damage of a type of your choice" or "you can choose to end it early," not build-time picks) — AND it has a proven false-negative problem: Combat Superiority (above) was missed entirely because its real text doesn't contain any of those keywords. A trustworthy full audit needs either a much smarter heuristic or a manual read of every subclass's actual feature text against `dnd5e.wikidot.com`/a second source per this project's usual RAW-verification standard (CLAUDE.md) — not another keyword pass. The raw REVIEW list from this scan wasn't preserved verbatim in this file (it's reproducible by re-running the same scan), to keep this entry from becoming unreadable. The ~70 unverified REVIEW hits are the only thing left, and per this note, most are likely false positives; worth a manual pass against `dnd5e.wikidot.com` sometime, not urgent.

- [x] **`fighting-styles.json` was missing Tasha's Cauldron of Everything's additions — fixed 2026-09-17.** Real correction found while verifying: TCE added **7** new fighting styles, not the 5 this item originally named — 5 general options (Blind Fighting, Interception, Superior Technique, Thrown Weapon Fighting, Unarmed Fighting) plus 2 single-class-exclusive cantrip-granting ones (Blessed Warrior — Paladin only, 2 Cleric cantrips; Druidic Warrior — Ranger only, 2 Druid cantrips) that hadn't been on this project's radar at all. Verified per-class availability and exact mechanics against 2 independent sources each — one real correction along the way (Superior Technique's bonus superiority die is a d6, not the d4 one source first suggested). Final per-class option counts: **Fighter 11** (all 5 general ones), **Paladin 7** (Blind Fighting + Interception + Blessed Warrior), **Ranger 8** (Blind Fighting + Thrown Weapon Fighting + Unarmed Fighting + Druidic Warrior) — Superior Technique is Fighter-exclusive. Added as 7 new `src/data/published_features.json` entries (not SRD content, so they don't belong in the SRD cache) with real descriptions, wired into `fighting-styles.json` and `feature-catalog.json`; no engine code changes needed since the existing `fightingStyleChoice` pendingChoice mechanism (built 2026-09-09, extended 2026-09-16) already reads option lists generically. Updated `fightingStyle.test.js`'s hardcoded counts/option arrays to match. `node --test` 295/295, `npm run build` clean, plus a live server smoke-test picking Unarmed Fighting through the real `/api/engine/preview-level-up` route.

- [x] **Gloom Stalker Ranger's tiered bonus spells (Gloom Stalker Magic) — fixed 2026-09-17, plus 3 more subclasses with the identical gap.** The original diagnosis (needs the species-trait `tiered` engine pattern generalized) turned out to be wrong — a completely different, already-proven mechanism already existed and just needed a data entry + one config line: `src/utils/spellUtils.js`'s `getBonusSpells`/`getBonusSpellsAtLevel` read a `BONUS_SPELL_FIELDS` list of `{field, classOnly}` pairs straight off each subclass's own data (already how Cleric domain spells, Paladin oath spells, Druid circle spells, and 2 Sorcerer subclasses' bonus spells all work) — no `diffLevelUp.js`/engine changes needed at all, since this is frontend-derived live from `character.classes[].level`, never written to the character record.

  Searched every subclass for the same "always-prepared bonus spell at level N, doesn't count against known spells" shape and found **3 more** with the exact same unwired gap the original item only named Gloom Stalker for: **Ranger Fey Wanderer** (3rd Charm Person, 5th Misty Step, 9th Dispel Magic, 13th Dimension Door, 17th Mislead) and **Ranger Swarmkeeper** (3rd Faerie Fire, 5th Web, 9th Gaseous Form, 13th Arcane Eye, 17th Insect Plague) both had real tiers documented only in prose, never in structured data; **Sorcerer Shadow Magic** (3rd Darkness) had neither. All 3 now have a new `bonus_spells_by_level` field (a new shared field name, since none of them needed Aberrant Mind/Clockwork Soul's swap mechanic or multi-spell-per-tier shape) plus 2 new `BONUS_SPELL_FIELDS` entries (`ranger`, `sorcerer`) in `spellUtils.js`. Live-verified with a synthetic level-9 Gloom Stalker: correctly surfaces exactly Disguise Self/Rope Trick/Fear, not the not-yet-reached Greater Invisibility/Seeming — matches Elucyne's real sheet. No frontend test runner exists to cover this in CI (per `CLAUDE.md`), so this was verified by hand outside the engine test suite; `node --test` 295/295 and `npm run build` clean cover everything else touched. Not touched: Aberrant Mind/Clockwork Soul (already correctly wired before this pass) and Oath/Domain/Circle spells (a different, larger, already-working mechanism, not a gap).

- [x] **Subrace mechanics — fully resolved 2026-09-17.** Re-investigated this whole item and found its original premise partly stale: `traitsFor(race, subrace)` already merges subrace traits into `raceTraits` in `diffLevelUp.js`, and that function already drives both the flat HP-per-level bonus (Dwarven Toughness) and tiered bonus spells (Drow Magic, Infernal Legacy) — fully built and covered by `engine/test/speciesLevelUpMechanics.test.js` since 2026-09-10, not missing engine plumbing as this item originally claimed. `NewCharacterTool.vue`'s creation-time wiring (`resolvedSpeciesGrants`, `speciesTraitRecords`, `speciesLanguageChoiceTotal`) is equally complete — weapon/armor/tool/skill proficiency grants, resistances, saving-throw advantages, fixed/choice spells, and the subrace's own extra-language choice (High Elf) all resolve correctly for a character built through the tool today. **Confirmed via Torrin**, who already has real `species_traits` (including Dwarven Toughness) — his 2026-09-12 Level Up tool rebuild picked all of this up automatically with zero extra work, which is the best evidence the mechanism holds up end-to-end. (Note, 2026-09-19: the `race`/`subrace` field names mentioned throughout this entry were later renamed to `genus`/`subgenus` — see the genus/genera rename work; this writeup is kept as originally written for the historical record.)

  What was actually broken was pre-existing character DATA that predates this mechanism (same "deliberately not retroactive" gap as `ability_score_history`/`species_traits` generally — see the Character-Schema entry in `engine/CHECKLIST.md`, 2026-09-07). Fixed today: **Pirra and Tackett**, the two characters with `subrace: null` outright — both backfilled to **Lightfoot Halfling** (Pirra: no contrary evidence, and it fits her Rogue Inquisitive stealth/awareness build; Tackett: confirmed by his own sheet, which already had loose "Lucky (Halfling)"/"Brave"/"Naturally Stealthy" feature stubs before this fix — those were replaced with a real `species_traits` entry rather than left duplicated). Both now have `subrace`, `species_traits` (species + subrace traits with real descriptions), `speed: 25`, and `saving_throw_advantages: ["being_frightened"]` (Brave). Ability scores/HP were deliberately left untouched — same precedent as Jaygar/Siv's original ability-history backfill decision, not something to guess retroactively.

  **Kessara and Jaygar backfilled 2026-09-17** (the "still open" pair from the original pass, done separately once there was time to do it carefully rather than rushed alongside Pirra/Tackett): Kessara now has `species_traits` for Fey Ancestry/Trance/Keen Senses/Elf Weapon Training/Cantrip/Extra Language, `speed: 30`, `saving_throw_advantages: ["being_charmed"]`, and Elf Weapon Training's 4 weapons added to `weapon_proficiencies` (her loose, undescribed "Fey Ancestry" `features` entry replaced by the proper `species_traits` one, same migration Tackett got). Jaygar now has `species_traits` for Gnome Cunning/Artificer's Lore/Tinker, `speed: 25`, `saving_throw_advantages: ["magic"]`, and `tool_proficiencies: ["tinker's tools"]`.

  **Real side-effect gap found while backfilling Kessara, not fixed**: her High Elf Cantrip (Minor Illusion) is tagged in `species_traits` with `spells_granted: ["Minor Illusion"]` per convention, but her Wizard spells now come from the **shared spellbook** (`spellbook_id: "sb_1"`, per the Lenn/Kessara/Lyria migration) — `spellUtils.js`'s spellbook-read path (`getCharacterSpells`'s step 1') treats every spell in a shared spellbook uniformly, with no concept of "this one's exempt from the cap" the way `character.features[].spells_granted` (step 3) or `BONUS_SPELL_FIELDS` (step 2) do. Since Minor Illusion is already present in `sb_1`'s own spell list, the aggregator's name-based dedup means the spellbook's plain copy wins and the `species_traits` exemption is silently dropped for display — meaning her racial cantrip may now be counting against her normal Wizard cantrip cap for the first time since the spellbook migration. Not fixed here (a real design question about how per-member exemptions should work on a _shared_ spellbook, bigger than a data backfill) — worth its own pass, and worth checking whether Lenn/Lyria have any similar racial/feature-granted spells riding in their own copy of `sb_1` with the same silent-exemption-loss risk.

  **Unrelated near-miss found and fixed while working this item**: while cleaning up a formatting mistake in this same file, a `git show HEAD:... > characters.json` reset briefly wiped an uncommitted, already-working Shared Spellbook migration (Lenn/Kessara/Lyria's `spellbook_id`/`prepared_spells`, linking them to the new `spellbooks.json`) that had nothing to do with subraces. Caught before committing (`spellUtils.js`'s existing "Wizard missing spellbook_id fails safe to `character.spells`" fallback meant nothing broke server-side, but the linkage itself was gone) and restored from the still-intact `spells[].prepared` flags, which matched the lost `prepared_spells` lists exactly. All 3 wizards' old `spells` arrays are now redundant leftover data (harmless — ignored once `spellbook_id` is set — but worth deleting in a future pass rather than carrying dead weight forever).

- [x] **Homebrew languages weren't offered in New Character's language pickers — fixed 2026-09-12.** `NewCharacterTool.vue`'s `languagesList` came straight from `/api/engine/languages` (the SRD's 16 standard/exotic languages only) — `src/data/weapon_types_and_languages.json`'s `languages` array (the same file `HOMEBREW_WEAPON_PROPS` already reads for homebrew weapon types) was never merged in anywhere. Now merged client-side in `created()`, feeding both the species and background language pickers (they share the same `languagesList`). `npm run build` clean.

  **Real finding worth flagging**: that file currently holds exactly **one** homebrew language — Solvalean ("official language of the Solvale Empire"). Checked `world.json` and `lore/` for any other named language mentioned anywhere in the setting and found none. If there are more homebrew languages that exist only in the project owner's head (or in chats not yet mined into this repo), they need to actually be added to `weapon_types_and_languages.json`'s `languages` array before they can show up here — the plumbing is ready, the content isn't. Same shape as an existing entry: `{name, type, description, speakers}`. (Note, 2026-09-19: Yetgresian Common/Catrinese/Drevani were added — see that work; this writeup is kept as originally written.)

- [x] **Weapon proficiency indicator — 2026-09-11, project owner's high-priority request ("I have no idea if Elucyne can use a longbow properly").** Added `category: 'simple'|'martial'` to all 36 weapon categories in `dnd_constants.js` (mirroring the earlier damage_type pass) plus the 2 homebrew weapon types (Saber correctly piggybacks on real rapier proficiency per its own documented text via a new `counts_as_proficiency` field). New `dnd.isProficientWithWeapon(character, weapon)` in `dnd_utils.js`; a "⚠ Not proficient" badge now shows on equipped/carried/pool weapon rows in `CharacterInventory.vue` when the character's `weapon_proficiencies` doesn't cover it.

  **Real finding while building this, bigger than Elucyne alone: 23 of 27 roster characters have no `weapon_proficiencies` field at all** — only Kerra, Jaygar, and this session's 2 new builds have it. Showing "not proficient" for a missing field would've been noise, not signal (every weapon on 23 characters would falsely warn), so the badge distinguishes a confirmed violation from "Proficiency?" (dashed, neutral) when the field is simply absent. **Fixed Elucyne specifically** (the project owner's own example) — Ranger is her `started` class, so her real proficiencies are the full `["simple", "martial"]`, added along with her also-missing `armor_proficiencies` (`light, medium, shields`). Confirms she legitimately can use a longbow. **Backfilled 2026-09-12** for the 19 active-roster characters that had it (skipped the 3 archived `(Old)` characters slated for rebuild — Lexica, Sorra, Torrin — not worth the effort on records about to be replaced). Used `engine/data/5e/classes/*.json`'s real per-class proficiency lists (already engine-verified) as the source, plus `engine/data/multiclass-proficiencies.json`'s reduced grant table for the 2 actual multiclass characters (Chuknora: started Paladin + multiclass Barbarian; Eldi: started Fighter + multiclass Rogue — in both cases the multiclass addition turned out to add nothing beyond what the starting class already covered). Also accounted for 2 real subclass-granted bonus proficiencies found via each subclass's own recorded feature text rather than guessed from memory (Cleric Tempest Domain: martial weapons + heavy armor; Wizard Bladesinger: light armor + one chosen one-handed weapon — Kessara's is a rapier, matching her actual equipped weapon) and 1 item-granted proficiency (Siv's equipped, attuned Bracers of Archery: longbow + shortbow). Also found and fixed a small related gap while validating: Kerra's Fighter class was missing its `started: true` flag (present since her rebuild, just never set) — `engine.validateCharacter` was correctly flagging it. `engine.validateCharacter` clean across the whole roster except Sorra (Old)'s already-documented, unrelated spell-cap overage. `node --test` 260/260, `npm run build` clean.

- [x] **Character sheet weapon-set toggle UI — built 2026-09-17.** Built in `WeaponTable.vue` (the actual character-sheet weapon display, used by `CharacterSheet.vue`/`CharacterCombatPanel.vue`/`BattleItemsPanel.vue`), not `CharacterInventory.vue` — that page is the equip/assign-to-set _manager_ (mixed armor/rings/weapons in one flat list, individually assigned to Set 1/2/Any), a different job from "show me both loadouts at a glance," and left untouched. Matches the spec: both sets now render side by side, active one at `flex-grow: 7` full-size interactive table (inspect/effects/spell-cast/grip-toggle all still work, unchanged), inactive one at `flex-grow: 3` with small text and a condensed name+atk/dmg preview list; clicking the inactive pane swaps which is active; `flex-grow`/`background-color`/`font-size` all transition (0.25–0.35s ease) for the "smooth animation on switch" ask. A character who's never assigned a weapon to a set still gets the old unsplit single-table view, unchanged, matching the existing "don't clutter the panel" gating. Reuses `dnd.buildWeaponRows` unmodified for both sets' numbers (a shallow-cloned character with `active_weapon_set` overridden per pane, since that's the only place `dnd_utils.js` reads that field — verified by grep, not guessed) — no `dnd_utils.js` changes needed. `npm run build` clean; no frontend test runner exists to cover this (per `CLAUDE.md`) and Playwright stays off, so this needed the project owner's own click-through — Vaz, Rhuna, Jaygar, Eldi, Revven, Elucyne, Chuknora, and Torrin all have real 2-weapon-set data on the roster to check it against, including the flex-grow transition animation itself.

- [x] **Shield of Retribution — resolved 2026-09-12.** Confirmed real item (Critical Role campaign, not core PHB/DMG/Xanathar's), verified against `dnd5e.wikidot.com/wondrous-items:shield-of-retribution`, but the local copy's effect (1d6 force on the wearer being hit, no AC bonus) is materially weaker/different than the real one (+1 AC, triggers on a miss instead, 4d6 force, plus a push). Project owner's call: kept the existing lighter homebrew effect as-is, but **renamed the item to "Shield of Reprisal"** to stop it colliding with the real item's name, and made the AC situation explicit in its own `effect` text ("No bonus to AC (base shield +2 only)") instead of just staying silent on it. `notes` field records why/when it was renamed for anyone who finds the old name in old session logs or memory. `npm run build` clean.

- [x] **Real turn/round tracking + action/bonus-action/reaction economy added to the combat tracker — 2026-09-11.** Previously `Battle.vue` had only a local `activeTurn` index (set by clicking a card) with no round counter, no wraparound, and no resource tracking anywhere. Planned via a full Plan-mode session specifically because the project owner wants this logic reusable for the Godot port planned to start next week — see CLAUDE.md's new standing rule about core D&D logic living in `engine/`, not Vue components.

  New `engine/rules/combatTurn.js`: pure, framework-free state/transition functions (`createCombatTurnState`, `advanceTurn`, `setActiveTurnIndex`, `setResource`, `spendResource`, `resetResourcesFor`, `syncOrder`) — round increments only on wraparound, a combatant's action/bonus action/reaction all refresh only at the start of _their own_ turn (real RAW), manual DM overrides never silently reset resources. 17 new engine tests (243 → 260 passing). State lives in `CombatContext.vue` (already the real owner of ephemeral combat-session state) and flows down to `Battle.vue` via a new `combat-turn` prop + 5 new emits, mirroring the existing `@override-roll`/`@add-enemy` pattern. New `ActionEconomyRow.vue` shows the active combatant's 3 resources as clickable chips.

  **Real technical finding, worth remembering for any future engine/ module meant for direct browser use**: `src/utils/combatTurn.js` originally imported the whole `engine/index.js` barrel (mirroring `server.js`'s own `require('./engine/index')`) and broke `npm run build` — several other rule modules (`classFeatures.js`, etc.) call Node's `fs`/`path` at require-time to read `engine/data/*.json` off disk, which webpack can't bundle for a browser build ("Can't resolve 'fs'"/"'path'"). Fixed by requiring `engine/rules/combatTurn.js` directly instead of the barrel — it has zero dependencies on any other rule file, so it bundles cleanly alone. Documented as a standing constraint in CLAUDE.md.

  Per project owner's explicit coaching mid-plan: this UI doubles as a testing/debugging surface that can do things a real game never would (rewind the round, un-spend a resource, jump the turn out of sequence) — those specific controls (round ±, Reset Resources, and an out-of-sequence initiative-card click) are marked with lucide-vue's `BugOff` icon + a tooltip, visually distinct from the real-game controls (Next Turn, resource toggle-on-your-turn).

  `cd engine && node --test`: 260/260. `npm run build` clean. Real interaction logic — Playwright stays off per CLAUDE.md, so this needed the project owner's own click-through; the approved plan file lists 8 specific scenarios checked (round increments exactly on wraparound, reaction persists across others' turns but refreshes on your own, manual card-click doesn't reset resources, add/remove mid-fight, roll-override reorder keeps the active highlight on the same person not the same row, round ± only touches the round, fresh state on a new fight).

- [x] **"Torrin (Claude)" — a hand-built, fully optimized level 9 Rogue Soulknife added 2026-09-11** as a comparison exercise against the project owner's own build attempt, per their request. Same species (Dwarf) as the real Torrin; Hill Dwarf picked over Mountain Dwarf (Dwarven Toughness beats a dump-stat STR bonus and armor training a DEX-based Soulknife doesn't want). The character record and its 3 equipment items are real, playable data (`characters.json`/`party_items.json`), not just a writeup. `engine.validateCharacter` clean, `npm run build` clean.

  **Bonus finding while verifying**: running the full engine test suite for the first time since the Kerra rebuild and the Torrin archival rename (both earlier this same session) surfaced 2 stale test fixtures — `validateCharacter.test.js` had a test asserting Kerra's _old_ wis/cha saving-throw bug still existed (fixed for real during her rebuild, which is exactly what broke the test); `recoveredData.test.js` looked up a character named plain `"Torrin"`, which no longer resolves post-rename. Both fixed (the Kerra one switched to a synthetic fixture instead of depending on a real character staying broken forever; the Torrin one just needed the updated name). Worth remembering: this project's test suite uses real `characters.json` rows as fixtures in several places, so a character rename or a fixed bug can silently break a test until `node --test` actually runs — run it after character data changes too, not just `engine/` changes.

- [x] **Duplicate-named items sweep, prompted by the Halberd of Warning +2 rename (2026-09-11) — one real bug found and fixed, rest confirmed already safe.** `WeaponTable.vue` built its per-weapon rows keyed by `w.name` and looked equipped weapons back up by name too (`weaponItem(row.name)`, plus `weaponEffectsFor`/`weaponSpellsFor`) — two equipped weapons sharing a name (a matched pair, twin daggers, etc.) would collapse onto whichever came first: duplicate Vue `:key`, wrong item's inspect popup, and casting a weapon-granted spell (Staff of Power, etc.) could spend charges off the wrong physical item. Fixed by adding `id` to `dnd.buildWeaponRows`'s returned summary objects and re-keying everything in `WeaponTable.vue` off `id` instead of `name`. Checked everywhere else items get looked up: `CharacterInventory.vue`, `BattleItemsPanel.vue`, and the `UPDATE_ITEM`/`DELETE_PARTY_ITEM`/`SPEND_CHARGE` store mutations were all already id-based (the generic `UPDATE_TABLE_ITEM` mutation only falls back to name-matching when an item has no `id`, and every `party_items.json` entry has one, so that path is safe too). Found two components doing name-based item lookups the old, unsafe way — `Items.vue` and `ItemDetails.vue` — but both are dead code, not imported or reachable from anywhere in the app; left alone rather than fixing unreachable code, worth deleting outright next time someone's in that area. `npm run build` clean.

- [x] **Enemy combat sheet was missing damage type and a magical/nonmagical indicator — added 2026-09-11**, follow-on to the weapon detail popup work above. Found a real latent bug while at it: `Battle.vue`'s `exportEnemyAbilities` and `EncounterGenerator.vue`'s own export text both already _referenced_ `enc.weapon.damageType`, but nothing ever actually set that field when a real monster was added mid-fight via `addFromBestiary` — it was always `undefined`. Procedurally-generated humanoid enemies (`encounter_utils.js`'s `generateWeapon`) already had it right; only the real-monster bestiary-add path was missing it. Fixed: `addFromBestiary` now pulls `damage_type` off the real monster action data, detects a **magical** attack from a `"Magic Weapons"` special ability (common on higher-CR fiends/celestials) or a nonzero weapon enhancement, and also now actually sets `attackBonus` from the real monster data (previously hardcoded `null`, a separate small gap found along the way — the DM had to type it in by hand every time even though the real number was already fetched and sitting unused). `Battle.vue`'s `activeEnemyMeta` now folds damage type into the existing free-text Damage chip and exposes a new toggle-able **Magical** chip in `EnemyStatsChipRow.vue`, both overridable by hand like every other enemy stat in this system. `npm run build` clean.

- [x] **Weapon detail popup had zero combat stats — fixed 2026-09-11.** `buildItemPopupData` (shared by `WeaponTable.vue` and `BattleItemsPanel.vue`'s inspect button) only ever showed flavor text (effect/description/notes/enhancement) — no attack bonus, no damage die, nothing, for any weapon. Added Attack + Damage fields, computed the same way `WeaponTable.vue`'s own row already does (`dnd.attackBonus`/`dnd.damageBonus`/`dnd._weaponProps`), now that the builder optionally takes `character`/`partyItems`. Versatile and thrown each get their own line rather than one blended number — a versatile weapon shows One-Handed and Two-Handed separately, a thrown weapon shows its range; a weapon that's both (Spear, Trident) combines "One-Handed / Thrown" into one line since those numbers are identical (same ability mod, same base die per real RAW) rather than repeating them. Also added real `damage_type` (bludgeoning/piercing/slashing) to all 36 weapon categories in `dnd_constants.js`'s `WEAPON_PROPS` table — it never existed as tracked data before this, so damage type couldn't have been shown anywhere even if something had asked for it. `npm run build` clean.

- [x] **Weapon slot capacity ignored weapon sets — fixed 2026-09-11.** Follow-on bug from the 1H/2H grip toggle added earlier this session: two two-handed weapons equipped, one in each weapon set (a normal, legal loadout — only one set is ever in-hand at once), falsely showed as "overloaded" because `CharacterInventory.vue`'s slot-capacity counting was global across both sets. Fixed: `melee1h`/`melee2h`/`ranged1h` capacity is now counted per weapon set (an unassigned/"Any" weapon counts toward both, matching how "Any" already behaved elsewhere), while non-weapon slots (rings, armor, etc.) keep the old global count. Also relaxed `canEquip`/`cannotEquipReason` to never hard-block on a weapon slot specifically — equip-then-assign-a-set is a two-step flow, and a weapon defaults to "Any" until deliberately assigned, so the old hard block could've prevented equipping a second two-hander at all before you got the chance to put it in Set 2. `npm run build` clean.

- [x] **Thrown attacks with a versatile+thrown weapon (Spear, Trident) showed the wrong damage die when gripped two-handed — fixed 2026-09-12.** `dnd.buildWeaponRows` now also computes `thrownDamage` (always the base one-handed die, per real RAW — the versatile bonus die only applies to a two-handed melee attack, never a thrown one), surfaced only when it actually differs from the main melee `damage` value shown (a thrown-and-currently-1H weapon has nothing extra worth displaying — the two numbers are identical). `WeaponTable.vue` shows it as a small "(Xd\_ thrown)" note under the main damage number when relevant, with a tooltip explaining why the two differ. `npm run build` clean.

- [x] **"Selling an item" appeared to have disappeared — actually a labeling bug, not a missing feature, fixed 2026-09-11.** Project owner reported losing the ability to sell items after the Weave Dust destroy feature was added. Traced it: selling never actually broke — `CharacterInventory.vue`'s delete dialog always had a gold-vs-dust toggle and calling `ADJUST_PARTY_GOLD` on confirm worked the whole time — but every label in that flow said "Delete" regardless of whether gold changed hands, and the entry-point ✕ button's tooltip just said "Delete item," giving no hint that selling was even possible from there. Fixed the labeling only, no logic changed: the ✕ tooltip, dialog title, body text, and confirm button now all say "Sell" whenever a sale value is entered (gold path) or "Destroy" (dust path), falling back to "Delete" only for a genuine zero-value discard; the gold toggle button itself now reads "Sell for Gold" instead of bare "Gold". `npm run build` clean.

- [x] **Familiar support (Find Familiar) — built 2026-09-11**, for Kerra's rebuild (Book of Ancient Secrets ritual pick). No familiar tracking existed anywhere before this. Turned out the app already had a full "owned secondary combatant" system built for a different purpose — `companions.json` + `CompanionSummonStrip.vue`/`CompanionPanel.vue`, already wired into `CharacterSheet.vue` and the Combat Tracker (`CombatContext.vue` auto-adds a summoned companion to the initiative order under `type: 'companion'`). Reused it wholesale rather than building a parallel system: new `FamiliarSummon.vue` shows a "Summon a Familiar" picker on the sheet whenever a character knows Find Familiar and has no companion record yet, offering the real 15 PHB forms (Bat, Cat, Crab, Frog, Hawk, Lizard, Octopus, Owl, Poisonous Snake, Quipper, Rat, Raven, Sea Horse, Spider, Weasel). On pick, calls the existing `lookupMonster()` (dnd5eapi.co, same 3-tier cache every other lookup uses) for the real stat block and writes a `companions.json` row (`companion_type: 'familiar'`) — no hand-authored stat blocks, so accuracy rides on the same API the Monster Browser already trusts. Added a `notes` panel to `CompanionPanel.vue` (it previously showed attacks but never notes) specifically so a real RAW caveat is visible, not just buried in JSON: **a familiar summoned this way can't attack** (needs Pact of the Chain, which this isn't) — the natural stat-block attacks are stored for reference only. `npm run build` clean. Not tested against every one of the 15 forms' live API response shape — worth a live try with a couple of different forms before trusting it fully; malformed/missing fields from the API would currently just show up blank rather than erroring.

- [x] **Versatile weapons had no way to be equipped two-handed — fixed 2026-09-11.** `dnd_utils.js`'s damage-die calc already had a `gripDie()` heuristic inferring two-handed grip whenever a versatile weapon was the only one-handed weapon equipped, but (a) that inference doesn't check for a shield in the other hand, and (b) there was no way to deliberately choose two-handed when it WOULDN'T be inferred (e.g. a second one-hander or shield also equipped). Added a 1H/2H toggle button on equipped weapons in `CharacterInventory.vue` (shown only for weapons that actually resolve as versatile) that sets `item.slot` explicitly to `melee1h`/`melee2h`. The shield-blind-spot in the inference itself wasn't touched — still worth fixing separately if a shield-plus-versatile-weapon case actually comes up.

- [x] **Warlock spell catalog had real gaps — found and fixed 2026-09-11**, while the project owner was rebuilding Kerra and the known-spell picker looked suspiciously short. Diffed the local catalog (`classes` field on SRD/published spell entries) against a verified real list (`dnd5e.wikidot.com/spells:warlock`): 5 spells existed locally but weren't tagged Warlock-eligible (Mislead, Planar Binding, Teleportation Circle, Gate, Weird — tagged now), and 11 real Warlock spells were missing from the catalog entirely — Witch Bolt, Distort Value, Arms of Hadar (1st); Cloud of Daggers, Crown of Madness, Flock of Familiars (2nd); Incite Greed (3rd); Galder's Speedy Courier, Gate Seal, Raulothim's Psychic Lance (4th); Arcane Gate (6th). Added full entries for all 11 to `published_spells.json` (`homebrew: false`, real source citations — Acquisitions Incorporated, SCAG, Xanathar's, Fizban's, Strixhaven — none are 2024-ruleset content). `npm run build` clean. Same class of bug as the Artificer spell-list gap found earlier this session — worth checking other classes' `classes`-field coverage the next time a known-spell picker looks thin for no obvious reason.

- [x] **Kerra and Torrin's character rebuilds — DONE, part of the larger "Sorra/Lexica/Kerra/Torrin" rebuild queue** (Sorra and Lexica remain open, still tracked in `TODO.md`). All four were renamed to `"<Name> (Old)"` 2026-09-11 to free up the real name for a fresh build; renaming updated every functional reference to the old name, not just the character record — `party_items.json`'s `equipped_by`/`carried_by` on their gear (27 fields), and `user_prefs.json`'s `parties[].members`, `parties[].marching_order`, and `savedParties[].members` (9 entries). `npm run build` clean after.

  - **Kerra — DONE, 2026-09-11.** Rebuilt from level 1 Fighter through the Level Up tool as originally suggested, real-world-tested the tool along the way and found/fixed several real bugs surfaced by the process (Eldritch Invocations letting duplicate picks through, no spell-granting invocation ever prompting a picker — Book of Ancient Secrets specifically — and the level-up preview view losing scroll position on every spell pick). Full audit of the finished sheet came back clean (ability scores, HP, saves, spell/cantrip counts, invocation count all check out against real caps); Deception in her skill list and her eventual Dueling fighting style were both deliberate project-owner choices, not bugs. Image, persona_notes, notes, and all 6 inventory items transferred from the old sheet; `Kerra (Old)` deleted once the project owner confirmed they were happy with the result. Also gave her a real Find Familiar familiar via the Familiar support feature (see above).
  - **Torrin — DONE, 2026-09-12.** The hand-built "Torrin (Claude)" comparison build (real level 9 Rogue Soulknife, single clean subclass) was promoted to the real `Torrin` record — project owner: "good enough to keep live." Flavor fields (image, appearance, location, alignment, a trimmed persona_notes) transferred from `Torrin (Old)`; his 3 real established items (The Weaver's Master-Awl, Wolf Hunter's Rags, Hand Crossbow of the Old Trail) moved over too, alongside the 2 mundane placeholder items from the original build (Studded Leather Armor, 2 Daggers) — no slot conflicts, so both stayed. Nice continuity find: the Weaver's Master-Awl's "Psionic Reinforcement" property (+2 to Psychic Blades attack/damage) was clearly written for a Soulknife already, well before this rebuild — the old homebrew dual-subclass build and the new clean one were pointing at the same character the whole time. That bonus isn't mechanically wired into the app yet (Psychic Blades aren't a `party_items.json` entry to attach an enhancement_bonus to) — DM-tracked for now. `Torrin (Old)` was, at the time of this writeup, not yet deleted (ask before removing if it's still lingering). `engine.validateCharacter` clean, `node --test` 260/260, `npm run build` clean.

- [x] **Party membership + inventory-pool ambiguity when a character is listed in more than one party — raised 2026-09-12, resolved 2026-09-14.** Project owner decided the `active_party_id` design (and its alternative) was "too much to worry about" — punted on solving multi-party membership itself. Instead, shipped the specific pain point that made deletion risky: deleting a party (`PartyEditModal.vue`'s `deleteParty`) used to silently orphan any pool item (`carried_by:'party'`) still pointing at that party's now-gone id. It now checks for pool items first — zero, and delete stays one click; any, and a confirmation dialog asks where they go (another remaining party, or "Unassigned" — the existing no-party pool bucket `CharacterInventory.vue` already supports) via a new `REASSIGN_PARTY_POOL` mutation, before the party record itself is removed. Characters' own personal gear (`equipped_by`/`carried_by` keyed by character name) is untouched by any of this — only party-pool items were ever at risk.

- [x] **Background expansion (still on hold) + species.json SRD-scope reconciliation — resolved 2026-09-19.** Two separate, unrelated gaps: (1) only 40 of ~360 backgrounds have real curated skill data (`engine/data/backgrounds.json`) — **still explicitly deprioritized**, untouched (project owner 2026-09-07: "I don't think we need that many more backgrounds. skip them for now"); the picker's "Other (custom)" escape hatch covers the gap for now. (2) **species.json's SRD scope — resolved.** Project owner checked another hard drive for an older, possibly-richer copy: nothing there, no uncommitted changes. Investigated `scripts/build-srd-cache.js` (the script that actually builds this file from `dnd5eapi.co/api/2014`) — it pulls every single race AND every single subrace the live API exposes, no arbitrary cutoff, so there was never a mechanism that could have silently dropped content down to 13. Conclusion: **13 real SRD entries (9 races + 4 subraces) is the genuine, complete scope of what the free SRD API has ever had.** Project owner clarified 2026-09-19: the "~380" figure was never about species at all — it came from estimating how many backgrounds would be needed to cover every real skill-proficiency combination, and got attached to the wrong line in an earlier note. Not needed either way — nothing was ever actually lost from species.json.

  **Real bug found and fixed along the way**: `species.json` currently has **19** entries, not 13 — 13 SRD + **6** homebrew (Catrin, Drevani, Hei'ugar, Lithkin, Dhovari, Olwood Trolls) — but `build-srd-cache.js`'s own `HOMEBREW_SPECIES` list only knew about the first 3. The other 3 were added straight to the committed file in an earlier session (2026-09-09, lore extraction from The Liliveth arc) and never synced back into the script, which still carried a stale comment claiming Dhovari specifically was "deliberately omitted." Net effect: the next person to re-run this script to refresh the SRD cache would have silently deleted all 3 (all correctly `playable: false` world-flavor species, not real PC options) with no warning at all. Fixed: added all 3 to `HOMEBREW_SPECIES` verbatim and corrected the stale comment — verified byte-for-byte identical to what's already committed via a direct comparison (not just eyeballed), so a future rebuild now reproduces `species.json` exactly instead of regressing it. `node --check` clean, `npm run build` clean.

- [x] **"Negative Energy Flood" was never actually homebrew — fixed 2026-09-19.** The spell IS a real published entry in `published_spells.json` (5th-level Necromancy, Xanathar's Guide to Everything, no `homebrew` flag at all — same as most non-homebrew entries in that file). The bug was purely a naming one: all 5 places this spell was referenced (`spellbooks.json`'s shared `sb_1` spell list, all 3 wizards' — Lenn/Kessara/Lyria — legacy `character.spells[]` entries, and Lyria's real `character.prepared_spells` list) stored the name as the literal string `"Negative Energy Flood (homebrew spell from necromancer's spellbook)"` — someone baked an in-fiction flavor note directly into the `name` field itself instead of a separate field, which broke every name-based spell lookup (`lookupSpell`, `findSpellRecord`) since nothing matches that string. Renamed all 5 occurrences to the clean `"Negative Energy Flood"`, matching the published entry (lookups are case-insensitive so the Title Case used elsewhere in `spellbooks.json`'s list is fine). The "found in a necromancer's spellbook" flavor detail itself wasn't preserved anywhere else — didn't invent a new field for it since nothing asked for it to be kept, but worth knowing if that backstory still matters to the campaign. `npm run build` clean, `cd engine && node --test` 295/295.

- [x] **Homebrew languages — Yetgresian Common, Catrinese, and Drevani added 2026-09-19.** Follow-up to the "New Character language picker only offers one homebrew language (Solvalean)" gap. Rather than waiting on the project owner to hand over new language names/flavor, checked whether the 3 playable homebrew species already had languages recorded in `src/data/api_data_cache/species.json` — they did: Catrin (`["Yetgresian Common", "Catrinese"]`), Drevani (`["Yetgresian Common", "Drevani"]`), Hei'ugar (`["Yetgresian Common", "Undercommon"]` — Undercommon is already a standard language, not a new one). Added the 2 new unique ones plus the shared regional tongue to `src/data/weapon_types_and_languages.json`'s `languages` array, same shape as the existing Solvalean entry. Project owner confirmed this covers it (2026-09-19: "you can remove that as well") — Kaemahz's other regions/Senkolai's five Boles potentially having their own languages (named in the original item) is left for whenever that's actually decided, not blocking this closure. `npm run build` clean.

- [x] **"Mine other chats for lore" — confirmed complete by the project owner, 2026-09-19.** Was a pure user-action item (pulling world lore out of other chat conversations into `lore/`) with no Claude-side task ever attached to it.

- [x] **Full spell/cantrip audit across the roster (2026-08-08, re-verified 2026-09-11, closed out 2026-09-19).** Wrote a one-off audit script (engine's own `cantripsKnownForClass`/`spellsKnownForClass`/`isSpellOnClassList`) across every caster. Real findings, confirmed by digging into git history and each character's actual feats/features before touching anything (several first-glance "bugs" turned out to be legitimate RAW mechanics the audit script just didn't know about — worth remembering next audit: don't trust a flat script's output, verify against feats/subclass data before reporting or fixing, and re-check the CURRENT character sheet before trusting an old note, which can go stale once someone else fixes the thing it describes):

  - **Wizards (Lenn/Kessara/Lyria) — NOT a bug, no changes made.** All three show 10 cantrip entries against a cap of 4. Traced via `git log -S` to the commit that gave the party "Iyani's goddess mother's gift" (synced wizard spellbooks) — confirmed each wizard's real 4 pre-gift cantrips are exactly the ones tagged `prepared: true` today; the other 6 (`prepared: false`) represent spells visible in the shared spellbook but not actually known, which is the right call since cantrips genuinely can't be learned from a spellbook/scroll under RAW. Data was already modeling this correctly; the audit script just didn't account for the flag. Kessara's High Elf racial cantrip (Minor Illusion, tagged `featureGranted`) also correctly doesn't count against her 4.
  - **Rith (Sorcerer, Divine Soul) — NOT a bug, confirmed accurate, no changes made.** Project owner was right to be confident. Verified: his Divine Magic affinity bonus spell (Bless, Law affinity) is correctly tagged `featureGranted`; Fey Touched's free Misty Step/Silvery Barbs are correctly tagged and don't need a normal known-spell slot; his 5 "off Sorcerer list" spells are legal Divine Magic Cleric-list substitutions (still count against the cap, which they do); his cantrip count (5) and known-spell count (10) both hit their real level-9 caps exactly.
  - **Enauweyn (Paladin, Oath of the Crown) — DONE.** Her "Fey Step" feature is the real Eladrin racial trait (a non-spell teleport, no spells[] entry needed) — NOT the Fey Touched feat, and doesn't explain her recorded "Misty Step" spell. No other source found; removed it. Bigger gap: **Oath of the Crown's subclass file had no oath-spell table at all** (checked `engine/CHECKLIST.md` — its `features_by_level` was verified against her real feature list in an earlier session, but the oath-spell table was simply never added, unlike sibling subclasses built the same pass). Added the real PHB/SCAG table (3rd: Command/Compelled Duel, 5th: Warding Bond/Zone of Truth, 9th: Aura of Vitality/Spirit Guardians, 13th: Banishment/Guardian of Faith, 17th: Circle of Power/Geas) — her existing tagged oath spells (Aura of Vitality, Spirit Guardians, Warding Bond) already matched this table exactly, confirming it's right; added her 2 missing legitimate picks (Command, Compelled Duel, Zone of Truth).
  - **Revven (Cleric, Tempest Domain) — DONE.** Charm Person had no supporting feat/domain/background (project owner: "I don't know"). Removed.
  - **Ferghus (Paladin, homebrew Oath of the Open Road) — DONE, this note was stale.** Fixed a real bug: the subclass file's oath-spell table was keyed `"1"` instead of `"3"` (every other built-out oath in this project keys by real character level). The 5th-level pick was later changed to Enlarge/Reduce + Silence (2026-09-08, project owner's choice, replacing the earlier unconfident Misty Step/Shatter), and 9th/13th/17th were filled in 2026-09-09 (Incite Greed/Galder's Tower, Banishment/Summon Greater Demon, Temporal Shunt/Steel Wind Strike) — confirmed present and correct on Ferghus's own sheet through his current level during the 2026-09-10 subclass audit. Nothing left open here.
  - **Elucyne (Ranger, Gloom Stalker) — DONE (confirmed again 2026-09-11).** Confirmed level-5 Ranger really does cap at 4 known spells (checked `engine/data/spellcasting-tables.json`, not memory). Real gap found beyond just "1 spell short": her Rope Trick and Fear were tagged as normal known picks, but both are actually **Gloom Stalker Magic** free bonus spells (checked the subclass's own feature text) — Rope Trick (5th level) is legitimate but was mistagged; Fear (9th level) was outright premature at Ranger 5 and has been removed; Disguise Self (3rd level), the one she was missing entirely, has been added. Re-checked 2026-09-11 against the live sheet: she now has exactly 4/4 known spells (Fog Cloud, Longstrider, Pass without Trace, Hunter's Mark), with Disguise Self/Rope Trick still correctly tagged `featureGranted`. Nothing left to do here.
  - **Sorra (Bard, College of Spirits) — superseded, see the rebuild queue in `TODO.md`.** Confirmed via her features list: no early-Magical-Secrets-granting feature exists for this subclass (unlike Lexica below), so her Counterspell/Revivify (tagged `magical_secret`) had no legitimate source at level 9 — removed, along with an off-list cantrip (Green-Flame Blade, also unexplained). Cantrip count now correct (3/3). Her remaining 13 leveled known spells are all legitimately on Bard's list individually, but that's still 1 over the real cap of 12 — moot as a standalone fix now that she's queued for a full rebuild (illegal stats too, per the project owner).
  - **Lexica (Bard, College of Lore) — DONE (confirmed again 2026-09-11).** Her "Magical Secrets (level 6 — used)" feature, with its own note naming Counterspell/Scrying, is College of Lore's real **Additional Magical Secrets** — a different, RAW-legal, and explicitly free ability (unlike base Bard's 10th-level Magical Secrets, Lore's 6th-level version doesn't count against spells known). Re-tagged both as `featureGranted` instead of removing them — the project owner's instinct to reset her was reasonable caution, but the data turned out to already be correct, just mistagged. Re-checked 2026-09-11: Phantasmal Killer (the previously-flagged unexplained off-list spell) is gone from her sheet — she now has exactly 12/12 known spells + 3/3 cantrips, magical secrets still correctly tagged. Nothing left to do here.
  - **Jaygar (Artificer, Infused Arbalist) — fully DONE 2026-09-19.** Cantrips were correct from the start (2, Guidance/Resistance — matches Artificer's real cap of 2 at level 9, verified against two independent sources plus a full verbatim table transcription cross-checked against his own `spell_slots`; the cap doesn't rise to 3 until level 10). His 6 always-prepared Infused Arbalist subclass spells (Shield, Thunderwave, Scorching Ray, Shatter, Fireball, Wind Wall) were added 2026-09-11. His 9 INT-based normal prepared picks were the last open piece — blocked for a while by an unrelated bug (Artificer's Spellbook tab had no way to add spells at all; see the Spellbook/Spell Browser fixes elsewhere in this file) until that got fixed 2026-09-19, at which point the project owner picked his final 9 directly through the newly-working UI: Identify, Faerie Fire, Detect Magic, Absorb elements (1st); Invisibility, Heat Metal, See Invisibility (2nd); Protection From Energy, Haste (3rd) — all verified against the real Artificer spell list, count matches `engine.preparedSpellCount('Artificer', 9, 5, 'Infused Arbalist')` = 9 exactly.
  - **Tackett (Druid, Circle of Stars) — DONE.** Project owner's call: he's a "legendary" character, RAW-accuracy isn't the goal, just a clean in-fiction reason for his 6 recorded cantrips (cap 3). Added a new homebrew feature, "Legendary Repertoire" (`published_features.json`, id `hb_tackett_legendary_cantrips`), granting a flat +3 cantrips, and added it to his `features[]`.
  - **Chuknora (Barbarian/Paladin) — DONE, cosmetic tagging fix only, 2026-09-11.** A fresh cross-roster cantrip/known-spell cap sweep this session flagged her Giant's Power cantrip (Thaumaturgy) as uncapped — false alarm, she's fully RAW-legal (Path of the Giant's Giant's Power grants Thaumaturgy or Druidcraft for free, confirmed against `published_features.json`). The entry just used an informal `note` field instead of the project's normal `featureGranted: true` + `_source` tagging convention that every other free/bonus spell uses, which is what made the script flag it. Fixed the tag so future audits don't re-flag her; no rules content changed.

  One thread spun back out as its own open `TODO.md` item rather than being buried here: the "Negative Energy Flood" homebrew spell the 3 wizards' spellbooks reference doesn't actually exist in the local catalog yet.

  Verification: `npm run build` clean; `cd engine && node --test` 218/218 at the time of the original audit, 295/295 as of the 2026-09-19 closeout. The audit script itself lived at `scratchpad/spell_audit.js`, never committed — one-off, not a permanent tool.

- [x] **Artificer was missing from the Spell Browser entirely, and its local spell-list tagging was badly incomplete — fixed 2026-09-19.** Surfaced while working out Jaygar's (Artificer, Infused Arbalist) still-open prepared-spell picks. Two compounding gaps: only 29 spells total carried an `Artificer` tag in the `classes` field on SRD/published spell entries, versus the real list's 100 entries cantrip-through-5th (confirmed against `dnd5e.wikidot.com/spells:artificer`, cross-checked against a full-page re-fetch after the first two passes returned inconsistent 4th/5th-level results — worth remembering: this page's content can come back scrambled on a narrow follow-up prompt, always ask WebFetch for the whole table verbatim in one shot on a re-check); and separately, **Artificer wasn't even an option in the Spell Browser's `CLASSES` filter list at all** (`src/components/SpellBrowser.vue`) — that list is a hardcoded array of the 8 core PHB casters, not derived from the data, so even correctly-tagged spells couldn't have been filtered to.

  **Root cause, worth remembering for any future class added outside the free SRD**: `dnd5eapi.co`'s 2014 API (what `lookupSpell`/the SRD cache/`scripts/build-srd-cache.js` all source from) only has the 12 core PHB classes — no Artificer at all, since Artificer is Tasha's Cauldron of Everything content, never part of the free SRD. Any spell's `classes` array sourced from that API can never include a class the API doesn't know exists; the 29 pre-existing Artificer tags were all manual patches from earlier session work, not anything a cache rebuild would reproduce.

  **Fix**: added `'Artificer'` to `SpellBrowser.vue`'s `CLASSES` array, and tagged all 94 real Artificer-list spells that already exist locally (68 needed the tag added; 26 already had it) across `srd_spells_full.json`/`published_spells.json` — done via a depth-aware line-based text edit (not a full `JSON.stringify(data, null, 2)` re-save, which was tried first and rewrote every array in the 500KB file onto multiple lines, a ~5000-line diff of pure reformatting noise for a ~70-line real change; reverted and redone surgically). **6 real Artificer spells don't exist in local data at all yet** (not just untagged — genuinely absent, so no other class's filter shows them either): Air Bubble, Ashardalon's Stride, Leomund's Secret Chest, Mordenkainen's Faithful Hound, Mordenkainen's Private Sanctum, Create Spelljamming Helm. Left for a future pass (would need real description text added, not just a tag) — none of them ended up on Jaygar's own picks, so not blocking. `npm run build` clean, `cd engine && node --test` 295/295 (the engine's `listSpellsForClass` reads `srd_spells_full.json` directly).

- [x] **Artificer's Spellbook tab had no way to change prepared spells at all — fixed 2026-09-19, same session as the Spell Browser fix above.** Found while working out how Jaygar (Artificer) was ever supposed to pick his 9 prepared spells: `CharacterSpellbook.vue`'s own `PREPARATION_CLASSES`/`HALF_CASTER_CLASSES` constants already listed Artificer correctly, but a **second, disagreeing class list** — `spellUtils.js`'s `FULL_CLASS_LIST_CLASSES` (`['cleric', 'druid', 'paladin', 'ranger']`, deliberately excluding Wizard since Wizard prepares from a spellbook instead) — had simply never had Artificer added, even though Artificer is RAW-identical to Cleric/Druid/Paladin/Ranger here (no "known spells," prepares from the whole class list each long rest — not the Wizard spellbook model). Since `characterUsesFullClassList` reads off that second list, Jaygar fell into the "Wizard spellbook" UI branch instead, which only lets you toggle prepared/unprepared on spells already sitting in `character.spells[]` — with nothing in his record yet, there was no way to add anything at all through the UI. Exactly the class of bug the project owner flagged when correcting how `TODO.md` should be used: two near-identical lists silently drifting apart.

  **Fix**: built `src/data/api_data_cache/artificer_spells.json` (96 entries, `{index, name, level}`, same shape as `cleric_spells.json` etc.) from the spells now correctly tagged `Artificer` in `srd_spells_full.json`/`published_spells.json` (see the fix above) — there's no `dnd5eapi.co` `/classes/artificer/spells` endpoint to build this from the normal way, so it's derived from this project's own tagging instead. Wired it into `spellUtils.js`'s `CLASS_SPELL_LISTS` and added `'artificer'` to `FULL_CLASS_LIST_CLASSES`. Also deduplicated the two disagreeing class-name lists themselves: moved `PREPARATION_CLASSES`/`HALF_CASTER_CLASSES` out of `CharacterSpellbook.vue` and into `spellUtils.js` as exported `PREPARED_CASTER_CLASSES`/`HALF_CASTER_PREPARED_CLASSES` (plus a new `isPreparedCaster(character)` helper), so there's one source of truth instead of two that can silently diverge again. The rest of the "browse class list, click to prepare/unprepare, respects the preparation-limit cap" UI was already fully generic and needed no changes — it just needed real data to browse.

  **Also added, per the project owner's request**: a reminder banner in `LongRestModal.vue`, shown on the Marching Order step right after a long rest is applied, listing any prepared caster in the party (Cleric/Druid/Wizard/Artificer/Paladin/Ranger — generalized from "just Artificer" since the same gap exists for all of them and nothing in the app reminded anyone before) who should re-prepare spells, via a new `preparedCastersToRemind` computed (uses the same new `isPreparedCaster` helper) — excludes anyone in `overwatchChars` (stood watch in 2+ slots, so didn't actually get the rest benefit) since they haven't earned a fresh prepared list either. `npm run build` clean, `cd engine && node --test` 295/295. Not verified live (Playwright stays off per `CLAUDE.md`) — worth a real click-through: open Jaygar's Spellbook tab and confirm the Artificer class-list browser now appears and can add/remove prepared spells, and trigger a long rest with an Artificer/Cleric/etc. in the party to see the new reminder banner.

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
