# Ideas / Nice-to-Haves

Backlog for "when we've got tokens to burn" — not urgent, not scheduled, just things
worth coming back to. Add freely; check off or delete when done or no longer wanted.

See `TODO_ARCHIVE.md` for completed items (kept for the record, out of this file so it stays short to read).

- [ ] **Live-combat feedback dump, 2026-09-18 — most items fixed same-day, 4 deferred (need characters.json/party_items.json edits that weren't safe mid-battle).** Project owner sent ~18 items found while actually playing a fight; asked to fix as many as possible without input. Fixed same session (see individual entries/commits for full detail): player HP/temp/heal changes now show in the Battle Log (previously enemy-only); a generic spend/restore mechanism for limited-use features and item/weapon-effect charges (previously every uses_max/uses_current counter in the whole app was read-only — this also fixed Gauntlet of the Sundering Blow's missing tracker, since its data was already there, just never surfaced); Battle Map's toolbar restructured to a fixed 2-row/1500px-min-width/scrollable layout instead of squeezing at narrow widths; a manual token-size override (Tiny–Gargantuan) for enemies added outside the bestiary; a real `Raging` condition plus `dnd.rageDamageBonus` (PHB table, wired into the weapon damage tooltip); condition pills' active-state legibility (was condition-colored text on a same-hue tinted background, hardcoded rgba not even theme-aware — now solid background + `var(--color-bg)` text); custom free-text condition pills ported from enemies to players; the "Free cast via X" spell tooltip reworded (it claimed free-of-cost for every feature-granted bonus spell, but only Weave Attunement's own level-1 pips are actually free — most, like Gloom Stalker Magic, still cost a normal slot); The Retired Special's wording; and `stored_spells` (Ring of Spell Storing-type items) made addable/removable instead of a read-only tag list.

  **Investigated, found correct — not a bug**: "Next Turn doesn't refresh everyone's actions/bonus/reactions on a new round." Traced through `combatTurn.js`'s `advanceTurn`, `CombatContext.vue`'s handler, and the Battle.vue/ActionEconomyRow template binding — all three correctly refresh only the NEWLY ACTIVE combatant's resources each call, which is actually the real RAW rule (your action economy refreshes at the start of _your_ turn, not everyone's at once at round start) — verified directly with a synthetic 3-combatant wraparound test. If the project owner wants batch-refresh-everyone-at-round-start instead, that's a deliberate rules-house-rule change, not a bug fix — flag if so.

  **Deferred — all 4 need editing `characters.json` and/or `party_items.json`, which had large unstaged live-autosave changes (the actual mid-battle progress) throughout this session that were never touched**:

  - **Chuknora's Channel Divinity shows no effects.** Root cause found: her single feature entry `"Channel Divinity (Nature's Wrath / Turn the Faithless)"` has no `id`, so name-based lookup can't match either real option. Both real catalog entries already exist with correct, verified text (`pub_channel-divinity-nature-s-wrath`, `pub_channel-divinity-turn-the-faithless`) — the fix is splitting her one bundled entry into two properly-`id`'d ones (matching how Enauweyn's Oath of the Crown Channel Divinity is already modeled), each with `action_type: "action"`. Also closes the separate "Channel Divinity needs action icons" report — `FeaturePillsPanel` already renders `ActionCostIcon` from `action_type`, it just needs to be set.
  - **Cold Valley Axe's "ranged smite"** doesn't fit Chuknora (no ranged weapon) — project owner's own read: "Smite From Afar sounds like she should get to use a melee attack from range," i.e. the mechanic should let her make her existing melee smite attack targeting something at range, not require an actual ranged weapon. Needs the item's `effect` text and mechanic reworked in `party_items.json`.
  - **Torrin's Soulknife combat panel has several real gaps**, project owner's own list: (1) Psychic Blades are a class feature, not a `party_items.json` weapon, so `WeaponTable.vue` never computes their attack/damage/modifiers — has to be mathed by hand every fight; (2) his armor has a real combat effect not shown on his combat sheet, suggesting it may not be mechanically wired at all; (3) Psychic Blade damage scaling with level isn't shown anywhere; (4) Homing Blades/teleport (Soul Blades) are buried under a single flat feature pill instead of their own tiles. Project owner also asked for a broader audit: any class feature that's really a hidden sub-menu of several distinct abilities should get its own tile per ability, each with a real action/bonus/reaction/free indicator — Torrin was just the character where this was most visible. Real design work, not a quick data patch; needs its own session.
  - **Backfill missing `uses_max`/`uses_current`/`recharge`** on Action Surge/Second Wind for the characters missing it entirely (Vaz, Elucyne, and the `TestFighter`/`Kerra` fixtures currently have bare name-only stubs; Corwin/Eldi already have the real data) and Rage for any barbarian missing it — same shape as the already-correct Rhuna/Chuknora entries, now that there's finally a UI to spend a use once this lands. 19 rules files (`abilities.js` through `subclasses.js` — see `CLAUDE.md`'s architecture section for the full list) and their ~16 backing data files/folders (`classes/`, `subclasses/`, `species.json`, etc.) moved via `git mv`, with every `require()` across `engine/index.js`, the 2 non-moving files that depend on moved ones (`npcBuilder.js`, `validateCharacter.js`), `server.js`'s direct `feats.json` require, and every engine test file updated to match. Also fixed 4 files that build their data path from `__dirname` instead of a plain `require()` specifier (`classFeatures.js`, `subclasses.js`, `featureCatalog.js`, and one not originally caught — `spellLists.js`, which reaches all the way out to `src/data/` at the repo root and needed a 3rd `..`, not just 2) — these needed manual fixing since an automated import-rewrite wouldn't have caught them. `combatTurn.js`/`npcBuilder.js`/`validateCharacter.js`/`pointBuy.js` deliberately left in place (not New Character/Level Up specific). `node --test` 295/295, `npm run build` clean, plus a live server smoke-test (classes/species/feats/preview-level-up routes, including a real Dwarven Toughness HP check) since the build only covers the frontend bundle. `CLAUDE.md`'s architecture section updated to the new paths.

- [ ] **Full class/subclass feature audit — discovery pass done 2026-09-16, real fixes not started.** Confirmed pattern: Fighting Style (fixed 2026-09-09), Favored Enemy + Natural Explorer (fixed 2026-09-16), and Expertise (fixed 2026-09-17) were all the same root bug — a `features_by_level` entry resolves to a generic catalog name with zero mechanism turning it into a real `pendingChoice`, so New Character/Level Up just list a bare, unpickable feature forever. Ran a systematic scan of every base class (`engine/data/5e/classes/*.json`) and every subclass (`engine/data/5e/subclasses/*.json`) against `diffLevelUp.js`'s actual `pendingChoices.push({type: ...})` call sites (the only reliable ground truth — currently: `asiOrFeat`, `fightingStyleChoice`, `expertiseChoice`, `favoredEnemyChoice`, `naturalExplorerChoice`, `invocationChoice`, `pactBoonChoice`, `bonusSpellChoice`, `subclassChoice`, `multiclassSkillChoice` — anything else is unwired by definition).

  **Confirmed real gaps, base classes** (verified against each feature's actual stored description text, not just guessed from a keyword match):

  - **Sorcerer's Metamagic** (L3: pick 2 options; L10/L17: +1 each) — zero wiring anywhere (`grep -n metamagic engine/rules/5e/diffLevelUp.js` returns nothing). High value — Metamagic is Sorcerer's core identity and every Sorcerer hits L3.
  - **Bard's Magical Secrets** (L10/14/18: pick 2 spells from ANY class's list) — also zero wiring, despite this file previously assuming CLAUDE.md's dedup-comment mention meant a picker existed; that comment is about level-keyed dedup only, not a real choice mechanism. High value — directly relevant to Lexica/Sorra's already-documented spell-cap history above.
  - **Warlock's Mystic Arcanum** (L11/13/15/17: pick 1 specific spell per tier, always-castable once/long rest) — zero wiring. Medium value, only matters at high Warlock levels.
  - **Wizard's Spell Mastery** (L18: pick a specific 1st- and 2nd-level spell) and **Signature Spells** (L20: pick two specific 3rd-level spells) — zero wiring. Low value in practice (rarely reached) but real.

  **Confirmed real gaps, subclasses** (spot-checked, not exhaustive — see methodology note below):

  - **Fighter Battle Master's Combat Superiority** (L3: learn 3 maneuvers from the real ~16-option list; +2 more at L7/L10/L15, can also swap a known one each time you learn new ones) — zero wiring. This is a **major miss**: Battle Master is one of the most commonly played Fighter subclasses and maneuvers are its whole mechanical identity, yet it never surfaced in the initial "choose/pick/select" keyword scan because its stored description doesn't use those words ("You learn maneuvers... you can also replace one you know with a different one") — see the methodology note below, this is exactly the kind of miss a keyword-only scan produces.
  - **Fighter Champion's Additional Fighting Style** (L10) — same underlying mechanism as base Fighting Style but a second, separate grant; needs the same per-class/per-level dedup treatment already built for the base feature, not yet confirmed to actually fire correctly for Champions specifically.
  - **Rogue Mastermind's Master of Intrigue** (L3: extra languages of your choice + accent mimicry) — a real one-time pick, unwired.
  - **Sorcerer Divine Soul's Divine Magic** (L1: pick a Cleric-domain affinity — Life/Light/Nature/Storm/Tempest/Trickery/War — that determines a bonus spell) and **Draconic Bloodline's Dragon Ancestor** (L1: pick a dragon type, same shape as Dragonborn's own Draconic Ancestry) — both unwired. Rith (Divine Soul) already has this resolved correctly in his own data per the earlier spell audit, but that was a manual fix, not something the level-up tool can currently reproduce for the next Divine Soul/Draconic Bloodline sorcerer built.
  - **Wizard Bladesinger's Training in War and Song** (L2: pick one one-handed weapon type for the Bladesong proficiency) — unwired; Kessara's rapier pick was set by hand, same caveat as above.
  - **Bard College of Lore's Additional Magical Secrets** (L6: same shape as base Magical Secrets, doesn't count against known-spell total) — unwired, shares a fix with the base Magical Secrets item above.
  - **Ranger Gloom Stalker's Iron Mind** (L7: Wisdom save proficiency, or Int/Cha instead if already Wisdom-proficient) — a narrow conditional choice, only matters for a Ranger multiclassed with something that already grants Wis saves.

  **Methodology note, important for whoever continues this**: the discovery pass used a regex over each feature's stored description text (`choose|pick one|pick two|of your choice|select one|select two`) across `src/data/api_data_cache/features.json` + `src/data/published_features.json`, filtered against `diffLevelUp.js`'s real pendingChoice types. This produced ~15 confirmed hits above but also **~70 further "REVIEW" hits across nearly every subclass that were NOT individually verified** (most are very likely false positives — in-play tactical choices like "deal damage of a type of your choice" or "you can choose to end it early," not build-time picks) — AND it has a proven false-negative problem: Combat Superiority (above) was missed entirely because its real text doesn't contain any of those keywords. A trustworthy full audit needs either a much smarter heuristic or a manual read of every subclass's actual feature text against `dnd5e.wikidot.com`/a second source per this project's usual RAW-verification standard (CLAUDE.md) — not another keyword pass. The raw REVIEW list from this scan wasn't preserved verbatim in this file (it's reproducible by re-running the same scan), to keep this entry from becoming unreadable.

  Not started: implementing any of the confirmed fixes above. Recommended order matches value: Metamagic and Combat Superiority first (highest player impact), then Magical Secrets (both base and College of Lore's early version, same fix), then the rest as time allows.

- [x] **`fighting-styles.json` was missing Tasha's Cauldron of Everything's additions — fixed 2026-09-17.** Real correction found while verifying: TCE added **7** new fighting styles, not the 5 this item originally named — 5 general options (Blind Fighting, Interception, Superior Technique, Thrown Weapon Fighting, Unarmed Fighting) plus 2 single-class-exclusive cantrip-granting ones (Blessed Warrior — Paladin only, 2 Cleric cantrips; Druidic Warrior — Ranger only, 2 Druid cantrips) that hadn't been on this project's radar at all. Verified per-class availability and exact mechanics against 2 independent sources each — one real correction along the way (Superior Technique's bonus superiority die is a d6, not the d4 one source first suggested). Final per-class option counts: **Fighter 11** (all 5 general ones), **Paladin 7** (Blind Fighting + Interception + Blessed Warrior), **Ranger 8** (Blind Fighting + Thrown Weapon Fighting + Unarmed Fighting + Druidic Warrior) — Superior Technique is Fighter-exclusive. Added as 7 new `src/data/published_features.json` entries (not SRD content, so they don't belong in the SRD cache) with real descriptions, wired into `fighting-styles.json` and `feature-catalog.json`; no engine code changes needed since the existing `fightingStyleChoice` pendingChoice mechanism (built 2026-09-09, extended 2026-09-16) already reads option lists generically. Updated `fightingStyle.test.js`'s hardcoded counts/option arrays to match. `node --test` 295/295, `npm run build` clean, plus a live server smoke-test picking Unarmed Fighting through the real `/api/engine/preview-level-up` route.

- [x] **Gloom Stalker Ranger's tiered bonus spells (Gloom Stalker Magic) — fixed 2026-09-17, plus 3 more subclasses with the identical gap.** The original diagnosis (needs the species-trait `tiered` engine pattern generalized) turned out to be wrong — a completely different, already-proven mechanism already existed and just needed a data entry + one config line: `src/utils/spellUtils.js`'s `getBonusSpells`/`getBonusSpellsAtLevel` read a `BONUS_SPELL_FIELDS` list of `{field, classOnly}` pairs straight off each subclass's own data (already how Cleric domain spells, Paladin oath spells, Druid circle spells, and 2 Sorcerer subclasses' bonus spells all work) — no `diffLevelUp.js`/engine changes needed at all, since this is frontend-derived live from `character.classes[].level`, never written to the character record.

  Searched every subclass for the same "always-prepared bonus spell at level N, doesn't count against known spells" shape and found **3 more** with the exact same unwired gap the original item only named Gloom Stalker for: **Ranger Fey Wanderer** (3rd Charm Person, 5th Misty Step, 9th Dispel Magic, 13th Dimension Door, 17th Mislead) and **Ranger Swarmkeeper** (3rd Faerie Fire, 5th Web, 9th Gaseous Form, 13th Arcane Eye, 17th Insect Plague) both had real tiers documented only in prose, never in structured data; **Sorcerer Shadow Magic** (3rd Darkness) had neither. All 3 now have a new `bonus_spells_by_level` field (a new shared field name, since none of them needed Aberrant Mind/Clockwork Soul's swap mechanic or multi-spell-per-tier shape) plus 2 new `BONUS_SPELL_FIELDS` entries (`ranger`, `sorcerer`) in `spellUtils.js`. Live-verified with a synthetic level-9 Gloom Stalker: correctly surfaces exactly Disguise Self/Rope Trick/Fear, not the not-yet-reached Greater Invisibility/Seeming — matches Elucyne's real sheet. No frontend test runner exists to cover this in CI (per `CLAUDE.md`), so this was verified by hand outside the engine test suite; `node --test` 295/295 and `npm run build` clean cover everything else touched. Not touched: Aberrant Mind/Clockwork Soul (already correctly wired before this pass) and Oath/Domain/Circle spells (a different, larger, already-working mechanism, not a gap).

- [x] **Subrace mechanics — fully resolved 2026-09-17.** Re-investigated this whole item and found its original premise partly stale: `traitsFor(race, subrace)` already merges subrace traits into `raceTraits` in `diffLevelUp.js`, and that function already drives both the flat HP-per-level bonus (Dwarven Toughness) and tiered bonus spells (Drow Magic, Infernal Legacy) — fully built and covered by `engine/test/speciesLevelUpMechanics.test.js` since 2026-09-10, not missing engine plumbing as this item originally claimed. `NewCharacterTool.vue`'s creation-time wiring (`resolvedSpeciesGrants`, `speciesTraitRecords`, `speciesLanguageChoiceTotal`) is equally complete — weapon/armor/tool/skill proficiency grants, resistances, saving-throw advantages, fixed/choice spells, and the subrace's own extra-language choice (High Elf) all resolve correctly for a character built through the tool today. **Confirmed via Torrin**, who already has real `species_traits` (including Dwarven Toughness) — his 2026-09-12 Level Up tool rebuild picked all of this up automatically with zero extra work, which is the best evidence the mechanism holds up end-to-end.

  What was actually broken was pre-existing character DATA that predates this mechanism (same "deliberately not retroactive" gap as `ability_score_history`/`species_traits` generally — see the Character-Schema entry in `engine/CHECKLIST.md`, 2026-09-07). Fixed today: **Pirra and Tackett**, the two characters with `subrace: null` outright — both backfilled to **Lightfoot Halfling** (Pirra: no contrary evidence, and it fits her Rogue Inquisitive stealth/awareness build; Tackett: confirmed by his own sheet, which already had loose "Lucky (Halfling)"/"Brave"/"Naturally Stealthy" feature stubs before this fix — those were replaced with a real `species_traits` entry rather than left duplicated). Both now have `subrace`, `species_traits` (species + subrace traits with real descriptions), `speed: 25`, and `saving_throw_advantages: ["being_frightened"]` (Brave). Ability scores/HP were deliberately left untouched — same precedent as Jaygar/Siv's original ability-history backfill decision, not something to guess retroactively.

  **Kessara and Jaygar backfilled 2026-09-17** (the "still open" pair from the original pass, done separately once there was time to do it carefully rather than rushed alongside Pirra/Tackett): Kessara now has `species_traits` for Fey Ancestry/Trance/Keen Senses/Elf Weapon Training/Cantrip/Extra Language, `speed: 30`, `saving_throw_advantages: ["being_charmed"]`, and Elf Weapon Training's 4 weapons added to `weapon_proficiencies` (her loose, undescribed "Fey Ancestry" `features` entry replaced by the proper `species_traits` one, same migration Tackett got). Jaygar now has `species_traits` for Gnome Cunning/Artificer's Lore/Tinker, `speed: 25`, `saving_throw_advantages: ["magic"]`, and `tool_proficiencies: ["tinker's tools"]`.

  **Real side-effect gap found while backfilling Kessara, not fixed**: her High Elf Cantrip (Minor Illusion) is tagged in `species_traits` with `spells_granted: ["Minor Illusion"]` per convention, but her Wizard spells now come from the **shared spellbook** (`spellbook_id: "sb_1"`, per the Lenn/Kessara/Lyria migration) — `spellUtils.js`'s spellbook-read path (`getCharacterSpells`'s step 1') treats every spell in a shared spellbook uniformly, with no concept of "this one's exempt from the cap" the way `character.features[].spells_granted` (step 3) or `BONUS_SPELL_FIELDS` (step 2) do. Since Minor Illusion is already present in `sb_1`'s own spell list, the aggregator's name-based dedup means the spellbook's plain copy wins and the `species_traits` exemption is silently dropped for display — meaning her racial cantrip may now be counting against her normal Wizard cantrip cap for the first time since the spellbook migration. Not fixed here (a real design question about how per-member exemptions should work on a _shared_ spellbook, bigger than a data backfill) — worth its own pass, and worth checking whether Lenn/Lyria have any similar racial/feature-granted spells riding in their own copy of `sb_1` with the same silent-exemption-loss risk.

  **Unrelated near-miss found and fixed while working this item**: while cleaning up a formatting mistake in this same file, a `git show HEAD:... > characters.json` reset briefly wiped an uncommitted, already-working Shared Spellbook migration (Lenn/Kessara/Lyria's `spellbook_id`/`prepared_spells`, linking them to the new `spellbooks.json`) that had nothing to do with subraces. Caught before committing (`spellUtils.js`'s existing "Wizard missing spellbook_id fails safe to `character.spells`" fallback meant nothing broke server-side, but the linkage itself was gone) and restored from the still-intact `spells[].prepared` flags, which matched the lost `prepared_spells` lists exactly. All 3 wizards' old `spells` arrays are now redundant leftover data (harmless — ignored once `spellbook_id` is set — but worth deleting in a future pass rather than carrying dead weight forever).

- [x] **Homebrew languages weren't offered in New Character's language
      pickers — fixed 2026-09-12.** `NewCharacterTool.vue`'s
      `languagesList` came straight from `/api/engine/languages` (the
      SRD's 16 standard/exotic languages only) — `src/data/
weapon_types_and_languages.json`'s `languages` array (the same file
      `HOMEBREW_WEAPON_PROPS` already reads for homebrew weapon types)
      was never merged in anywhere. Now merged client-side in `created()`,
      feeding both the species and background language pickers (they
      share the same `languagesList`). `npm run build` clean.

                                                        **Real finding worth flagging**: that file currently holds exactly
                                                        **one** homebrew language — Solvalean ("official language of the
                                                        Solvale Empire"). Checked `world.json` and `lore/` for any other
                                                        named language mentioned anywhere in the setting and found none. If
                                                        there are more homebrew languages that exist only in the project
                                                        owner's head (or in chats not yet mined into this repo — see the
                                                        standing "[USER ACTION] Mine other chats for lore" item), they need
                                                        to actually be added to `weapon_types_and_languages.json`'s
                                                        `languages` array before they can show up here — the plumbing is
                                                        ready, the content isn't. Same shape as an existing entry: `{name,
                                                        type, description, speakers}`.

- [x] **Weapon proficiency indicator — 2026-09-11, project owner's high-
      priority request ("I have no idea if Elucyne can use a longbow
      properly").** Added `category: 'simple'|'martial'` to all 36 weapon
      categories in `dnd_constants.js` (mirroring the earlier damage_type
      pass) plus the 2 homebrew weapon types (Saber correctly piggybacks on
      real rapier proficiency per its own documented text via a new
      `counts_as_proficiency` field). New `dnd.isProficientWithWeapon
(character, weapon)` in `dnd_utils.js`; a "⚠ Not proficient" badge now
      shows on equipped/carried/pool weapon rows in `CharacterInventory.
vue` when the character's `weapon_proficiencies` doesn't cover it.

                                                                    **Real finding while building this, bigger than Elucyne alone: 23 of
                                                                    27 roster characters have no `weapon_proficiencies` field at all** —
                                                                    only Kerra, Jaygar, and this session's 2 new builds have it. Showing
                                                                    "not proficient" for a missing field would've been noise, not signal
                                                                    (every weapon on 23 characters would falsely warn), so the badge
                                                                    distinguishes a confirmed violation from "Proficiency?" (dashed,
                                                                    neutral) when the field is simply absent. **Fixed Elucyne specifically**
                                                                    (the project owner's own example) — Ranger is her `started` class, so
                                                                    her real proficiencies are the full `["simple", "martial"]`, added
                                                                    along with her also-missing `armor_proficiencies` (`light, medium,
                                                                    shields`). Confirms she legitimately can use a longbow.
                                                                    **Backfilled 2026-09-12** for the 19 active-roster characters that had
                                                                    it (skipped the 3 archived `(Old)` characters slated for rebuild —
                                                                    Lexica, Sorra, Torrin — not worth the effort on records about to be
                                                                    replaced). Used `engine/data/5e/classes/*.json`'s real per-class
                                                                    proficiency lists (already engine-verified) as the source, plus
                                                                    `engine/data/multiclass-proficiencies.json`'s reduced grant table for
                                                                    the 2 actual multiclass characters (Chuknora: started Paladin +
                                                                    multiclass Barbarian; Eldi: started Fighter + multiclass Rogue — in
                                                                    both cases the multiclass addition turned out to add nothing beyond
                                                                    what the starting class already covered). Also accounted for 2 real
                                                                    subclass-granted bonus proficiencies found via each subclass's own
                                                                    recorded feature text rather than guessed from memory (Cleric Tempest
                                                                    Domain: martial weapons + heavy armor; Wizard Bladesinger: light
                                                                    armor + one chosen one-handed weapon — Kessara's is a rapier, matching
                                                                    her actual equipped weapon) and 1 item-granted proficiency (Siv's
                                                                    equipped, attuned Bracers of Archery: longbow + shortbow). Also found
                                                                    and fixed a small related gap while validating: Kerra's Fighter class
                                                                    was missing its `started: true` flag (present since her rebuild, just
                                                                    never set) — `engine.validateCharacter` was correctly flagging it.
                                                                    `engine.validateCharacter` clean across the whole roster except
                                                                    Sorra (Old)'s already-documented, unrelated spell-cap overage.
                                                                    `node --test` 260/260, `npm run build` clean.

- [x] **Character sheet weapon-set toggle UI — built 2026-09-17.** Built in `WeaponTable.vue` (the actual character-sheet weapon display, used by `CharacterSheet.vue`/`CharacterCombatPanel.vue`/`BattleItemsPanel.vue`), not `CharacterInventory.vue` — that page is the equip/assign-to-set _manager_ (mixed armor/rings/weapons in one flat list, individually assigned to Set 1/2/Any), a different job from "show me both loadouts at a glance," and left untouched. Matches the spec: both sets now render side by side, active one at `flex-grow: 7` full-size interactive table (inspect/effects/spell-cast/grip-toggle all still work, unchanged), inactive one at `flex-grow: 3` with small text and a condensed name+atk/dmg preview list; clicking the inactive pane swaps which is active; `flex-grow`/`background-color`/`font-size` all transition (0.25–0.35s ease) for the "smooth animation on switch" ask. A character who's never assigned a weapon to a set still gets the old unsplit single-table view, unchanged, matching the existing "don't clutter the panel" gating. Reuses `dnd.buildWeaponRows` unmodified for both sets' numbers (a shallow-cloned character with `active_weapon_set` overridden per pane, since that's the only place `dnd_utils.js` reads that field — verified by grep, not guessed) — no `dnd_utils.js` changes needed. `npm run build` clean; no frontend test runner exists to cover this (per `CLAUDE.md`) and Playwright stays off, so **this needs your own click-through** — Vaz, Rhuna, Jaygar, Eldi, Revven, Elucyne, Chuknora, and Torrin all have real 2-weapon-set data on the roster to check it against, including the flex-grow transition animation itself, which can't be verified by reading code alone.

- [x] **Shield of Retribution — resolved 2026-09-12.** Confirmed real item
      (Critical Role campaign, not core PHB/DMG/Xanathar's), verified
      against `dnd5e.wikidot.com/wondrous-items:shield-of-retribution`, but
      the local copy's effect (1d6 force on the wearer being hit, no AC
      bonus) is materially weaker/different than the real one (+1 AC,
      triggers on a miss instead, 4d6 force, plus a push) — see the earlier
      note in this file for the full comparison. Project owner's call: kept
      the existing lighter homebrew effect as-is, but **renamed the item to
      "Shield of Reprisal"** to stop it colliding with the real item's name,
      and made the AC situation explicit in its own `effect` text ("No
      bonus to AC (base shield +2 only)") instead of just staying silent on
      it. `notes` field records why/when it was renamed for anyone who
      finds the old name in old session logs or memory. `npm run build`
      clean.

- [ ] **Combat screen layout pass — project owner's first-glance feedback
      after using turn/round tracking, 2026-09-11.** Nothing broken, just
      real space/ergonomics notes from actually using it, to talk through
      when the project owner is back (they'll be remoting in over the
      weekend to discuss next steps — this needs a conversation, not a
      unilateral redesign):

  - **`DiceRoller.vue` (mounted globally in `AppLayout.vue`, not
    combat-specific) is a full-width bottom drawer that eats a lot of
    vertical space during combat.** Project owner's suggestion: the new
    `.turn-controls` row (round counter, Next Turn, `ActionEconomyRow`)
    added to `Battle.vue` this session could sit _beside_ the dice
    roller instead of taking its own separate row, reclaiming real
    space. Nontrivial because these are two unrelated components in
    different parts of the tree today (`DiceRoller` at the `AppLayout`
    level, `.turn-controls` inside `Battle.vue` inside `CombatContext.
vue`) — needs a real layout decision, not a CSS tweak, on how/
    whether to coordinate them.
  - **The "Add enemy mid-fight" sidebar section in `Battle.vue`** (manual
    name/mod inputs + a Manual/Bestiary mode toggle + bestiary search,
    `sidebar-add-enemy` block) **takes up a lot of permanent sidebar
    space for something used occasionally.** Project owner's
    suggestion: collapse it to a single button that opens a wizard
    instead. `VehicleCombatWizard.vue` already has a real reusable
    step-wizard shape in this codebase (`step` data property, `v-if=
"step === N"` panels, back/next buttons) worth pattern-matching
    rather than inventing a new wizard shell from scratch — the actual
    step content would obviously differ (add-enemy needs name/mod or
    bestiary search, not ship selection), but the wizard _shell_
    (modal, step indicator, back/next) could plausibly be extracted
    and shared.
  - **Action economy resources are tracked as a single boolean today**
    (available/spent) — the project owner floated, as a hedge rather
    than a firm request ("or two if the player for some reason has
    two"), that some feature could plausibly grant a second action/
    bonus action/reaction in a turn. Not built — `engine/rules/
combatTurn.js`'s resources are booleans, not counts, and changing
    that is a real engine-level model change (plus a UI change to show
    N pips instead of 1), not a quick add. Worth a real example coming
    up at the table before building speculatively.
  - Not started — flagged for discussion first per the project owner's own
    request, then implementation.

- [ ] **Battle Map and Vehicle Combat both flagged as "good but basic,"
      2026-09-11.** Direct project owner quote: "make the battle map more
      robust and user friendly. It's already very good but very basic."
      and "The vehicle combat is also really cool but perhaps needs to
      support more variety." No specifics yet on what "more robust" or
      "more variety" means concretely — worth a real conversation before
      guessing at scope, this is a discovery task, not a defined feature.

- [x] **Real turn/round tracking + action/bonus-action/reaction economy
      added to the combat tracker — 2026-09-11.** Previously `Battle.vue`
      had only a local `activeTurn` index (set by clicking a card) with no
      round counter, no wraparound, and no resource tracking anywhere.
      Planned via a full Plan-mode session (see the approved plan for full
      design reasoning) specifically because the project owner wants this
      logic reusable for the Godot port planned to start next week — see
      CLAUDE.md's new standing rule about core D&D logic living in
      `engine/`, not Vue components.

      New `engine/rules/combatTurn.js`: pure, framework-free state/
      transition functions (`createCombatTurnState`, `advanceTurn`,
      `setActiveTurnIndex`, `setResource`, `spendResource`,
      `resetResourcesFor`, `syncOrder`) — round increments only on
      wraparound, a combatant's action/bonus action/reaction all refresh
      only at the start of *their own* turn (real RAW), manual DM overrides
      never silently reset resources. 17 new engine tests (243 → 260
      passing). State lives in `CombatContext.vue` (already the real owner
      of ephemeral combat-session state) and flows down to `Battle.vue` via
      a new `combat-turn` prop + 5 new emits, mirroring the existing
      `@override-roll`/`@add-enemy` pattern. New `ActionEconomyRow.vue`
      shows the active combatant's 3 resources as clickable chips.

      **Real technical finding, worth remembering for any future engine/
      module meant for direct browser use**: `src/utils/combatTurn.js`
      originally imported the whole `engine/index.js` barrel (mirroring
      `server.js`'s own `require('./engine/index')`) and broke `npm run
      build` — several other rule modules (`classFeatures.js`, etc.) call
      Node's `fs`/`path` at require-time to read `engine/data/*.json` off
      disk, which webpack can't bundle for a browser build ("Can't resolve
      'fs'"/"'path'"). Fixed by requiring `engine/rules/combatTurn.js`
      directly instead of the barrel — it has zero dependencies on any
      other rule file, so it bundles cleanly alone. Documented as a
      standing constraint in CLAUDE.md.

      Per project owner's explicit coaching mid-plan: this UI doubles as a
      testing/debugging surface that can do things a real game never would
      (rewind the round, un-spend a resource, jump the turn out of
      sequence) — those specific controls (round ±, Reset Resources, and
      an out-of-sequence initiative-card click) are marked with lucide-vue's
      `BugOff` icon + a tooltip, visually distinct from the real-game
      controls (Next Turn, resource toggle-on-your-turn).

      `cd engine && node --test`: 260/260. `npm run build` clean. Real
      interaction logic — Playwright stays off per CLAUDE.md, so this needs
      the project owner's own click-through; the approved plan file lists 8
      specific scenarios worth checking (round increments exactly on
      wraparound, reaction persists across others' turns but refreshes on
      your own, manual card-click doesn't reset resources, add/remove
      mid-fight, roll-override reorder keeps the active highlight on the
      same person not the same row, round ± only touches the round, fresh
      state on a new fight).

- [x] **"Torrin (Claude)" — a hand-built, fully optimized level 9 Rogue
      Soulknife added 2026-09-11** as a comparison exercise against the
      project owner's own build attempt, per their request. Same species
      (Dwarf) as the real Torrin; Hill Dwarf picked over Mountain Dwarf
      (Dwarven Toughness beats a dump-stat STR bonus and armor training a
      DEX-based Soulknife doesn't want). Full reasoning in that session's
      chat, not duplicated here — the character record and its 3 equipment
      items are real, playable data (`characters.json`/`party_items.json`),
      not just a writeup. `engine.validateCharacter` clean, `npm run build`
      clean.

      **Bonus finding while verifying**: running the full engine test suite
      for the first time since the Kerra rebuild and the Torrin archival
      rename (both earlier this same session) surfaced 2 stale test
      fixtures — `validateCharacter.test.js` had a test asserting Kerra's
      *old* wis/cha saving-throw bug still existed (fixed for real during
      her rebuild, which is exactly what broke the test); `recoveredData.
      test.js` looked up a character named plain `"Torrin"`, which no
      longer resolves post-rename. Both fixed (the Kerra one switched to a
      synthetic fixture instead of depending on a real character staying
      broken forever; the Torrin one just needed the updated name). Worth
      remembering: this project's test suite uses real `characters.json`
      rows as fixtures in several places, so a character rename or a fixed
      bug can silently break a test until `node --test` actually runs —
      run it after character data changes too, not just `engine/` changes.

- [x] **Duplicate-named items sweep, prompted by the Halberd of Warning +2
      rename (2026-09-11) — one real bug found and fixed, rest confirmed
      already safe.** `WeaponTable.vue` built its per-weapon rows keyed by
      `w.name` and looked equipped weapons back up by name too
      (`weaponItem(row.name)`, plus `weaponEffectsFor`/`weaponSpellsFor`) —
      two equipped weapons sharing a name (a matched pair, twin daggers,
      etc.) would collapse onto whichever came first: duplicate Vue `:key`,
      wrong item's inspect popup, and casting a weapon-granted spell (Staff
      of Power, etc.) could spend charges off the wrong physical item.
      Fixed by adding `id` to `dnd.buildWeaponRows`'s returned summary
      objects and re-keying everything in `WeaponTable.vue` off `id`
      instead of `name`. Checked everywhere else items get looked up:
      `CharacterInventory.vue`, `BattleItemsPanel.vue`, and the
      `UPDATE_ITEM`/`DELETE_PARTY_ITEM`/`SPEND_CHARGE` store mutations were
      all already id-based (the generic `UPDATE_TABLE_ITEM` mutation only
      falls back to name-matching when an item has no `id`, and every
      `party_items.json` entry has one, so that path is safe too). Found
      two components doing name-based item lookups the old, unsafe way —
      `Items.vue` and `ItemDetails.vue` — but both are dead code, not
      imported or reachable from anywhere in the app; left alone rather
      than fixing unreachable code, worth deleting outright next time
      someone's in that area. `npm run build` clean.

- [x] **Enemy combat sheet was missing damage type and a magical/nonmagical
      indicator — added 2026-09-11**, follow-on to the weapon detail popup
      work above. Found a real latent bug while at it: `Battle.vue`'s
      `exportEnemyAbilities` and `EncounterGenerator.vue`'s own export text
      both already _referenced_ `enc.weapon.damageType`, but nothing ever
      actually set that field when a real monster was added mid-fight via
      `addFromBestiary` — it was always `undefined`. Procedurally-generated
      humanoid enemies (`encounter_utils.js`'s `generateWeapon`) already had
      it right; only the real-monster bestiary-add path was missing it.
      Fixed: `addFromBestiary` now pulls `damage_type` off the real monster
      action data, detects a **magical** attack from a `"Magic Weapons"`
      special ability (common on higher-CR fiends/celestials) or a nonzero
      weapon enhancement, and also now actually sets `attackBonus` from the
      real monster data (previously hardcoded `null`, a separate small gap
      found along the way — the DM had to type it in by hand every time
      even though the real number was already fetched and sitting unused).
      `Battle.vue`'s `activeEnemyMeta` now folds damage type into the
      existing free-text Damage chip and exposes a new toggle-able
      **Magical** chip in `EnemyStatsChipRow.vue`, both overridable by hand
      like every other enemy stat in this system. `npm run build` clean.

- [x] **Weapon detail popup had zero combat stats — fixed 2026-09-11.**
      `buildItemPopupData` (shared by `WeaponTable.vue` and
      `BattleItemsPanel.vue`'s inspect button) only ever showed flavor text
      (effect/description/notes/enhancement) — no attack bonus, no damage
      die, nothing, for any weapon. Added Attack + Damage fields, computed
      the same way `WeaponTable.vue`'s own row already does
      (`dnd.attackBonus`/`dnd.damageBonus`/`dnd._weaponProps`), now that the
      builder optionally takes `character`/`partyItems`. Versatile and
      thrown each get their own line rather than one blended number — a
      versatile weapon shows One-Handed and Two-Handed separately, a thrown
      weapon shows its range; a weapon that's both (Spear, Trident) combines
      "One-Handed / Thrown" into one line since those numbers are identical
      (same ability mod, same base die per real RAW — see the thrown/grip
      TODO entry above) rather than repeating them. Also added real
      `damage_type` (bludgeoning/piercing/slashing) to all 36 weapon
      categories in `dnd_constants.js`'s `WEAPON_PROPS` table — it never
      existed as tracked data before this, so damage type couldn't have
      been shown anywhere even if something had asked for it. `npm run
build` clean.

- [x] **Weapon slot capacity ignored weapon sets — fixed 2026-09-11.**
      Follow-on bug from the 1H/2H grip toggle added earlier this session:
      two two-handed weapons equipped, one in each weapon set (a normal,
      legal loadout — only one set is ever in-hand at once), falsely showed
      as "overloaded" because `CharacterInventory.vue`'s slot-capacity
      counting was global across both sets. Fixed: `melee1h`/`melee2h`/
      `ranged1h` capacity is now counted per weapon set (an unassigned/"Any"
      weapon counts toward both, matching how "Any" already behaved
      elsewhere), while non-weapon slots (rings, armor, etc.) keep the old
      global count. Also relaxed `canEquip`/`cannotEquipReason` to never
      hard-block on a weapon slot specifically — equip-then-assign-a-set is
      a two-step flow, and a weapon defaults to "Any" until deliberately
      assigned, so the old hard block could've prevented equipping a second
      two-hander at all before you got the chance to put it in Set 2.
      `npm run build` clean.

- [x] **Thrown attacks with a versatile+thrown weapon (Spear, Trident)
      showed the wrong damage die when gripped two-handed — fixed
      2026-09-12** (grabbed off this list as a bonus fix, having already
      designed the fix shape while building the weapon detail popup
      earlier). `dnd.buildWeaponRows` now also computes `thrownDamage`
      (always the base one-handed die, per real RAW — the versatile bonus
      die only applies to a two-handed melee attack, never a thrown one),
      surfaced only when it actually differs from the main melee `damage`
      value shown (a thrown-and-currently-1H weapon has nothing extra worth
      displaying — the two numbers are identical). `WeaponTable.vue` shows
      it as a small "(Xd\_ thrown)" note under the main damage number when
      relevant, with a tooltip explaining why the two differ. `npm run
build` clean.

- [x] **"Selling an item" appeared to have disappeared — actually a labeling
      bug, not a missing feature, fixed 2026-09-11.** Project owner reported
      losing the ability to sell items after the Weave Dust destroy feature
      was added (2026-09-08, see `TODO_ARCHIVE.md`). Traced it: selling
      never actually broke — `CharacterInventory.vue`'s delete dialog always
      had a gold-vs-dust toggle and calling `ADJUST_PARTY_GOLD` on confirm
      worked the whole time — but every label in that flow said "Delete"
      regardless of whether gold changed hands, and the entry-point ✕
      button's tooltip just said "Delete item," giving no hint that selling
      was even possible from there. Fixed the labeling only, no logic
      changed: the ✕ tooltip, dialog title, body text, and confirm button
      now all say "Sell" whenever a sale value is entered (gold path) or
      "Destroy" (dust path), falling back to "Delete" only for a genuine
      zero-value discard; the gold toggle button itself now reads "Sell for
      Gold" instead of bare "Gold". `npm run build` clean.

- [x] **Familiar support (Find Familiar) — built 2026-09-11**, for Kerra's
      rebuild (Book of Ancient Secrets ritual pick). No familiar tracking
      existed anywhere before this. Turned out the app already had a full
      "owned secondary combatant" system built for a different purpose —
      `companions.json` + `CompanionSummonStrip.vue`/`CompanionPanel.vue`,
      already wired into `CharacterSheet.vue` and the Combat Tracker
      (`CombatContext.vue` auto-adds a summoned companion to the initiative
      order under `type: 'companion'`). Reused it wholesale rather than
      building a parallel system: new `FamiliarSummon.vue` shows a "Summon a
      Familiar" picker on the sheet whenever a character knows Find Familiar
      and has no companion record yet, offering the real 15 PHB forms (Bat,
      Cat, Crab, Frog, Hawk, Lizard, Octopus, Owl, Poisonous Snake, Quipper,
      Rat, Raven, Sea Horse, Spider, Weasel). On pick, calls the existing
      `lookupMonster()` (dnd5eapi.co, same 3-tier cache every other lookup
      uses) for the real stat block and writes a `companions.json` row
      (`companion_type: 'familiar'`) — no hand-authored stat blocks, so
      accuracy rides on the same API the Monster Browser already trusts.
      Added a `notes` panel to `CompanionPanel.vue` (it previously showed
      attacks but never notes) specifically so a real RAW caveat is visible,
      not just buried in JSON: **a familiar summoned this way can't attack**
      (needs Pact of the Chain, which this isn't) — the natural stat-block
      attacks are stored for reference only. `npm run build` clean. Not
      tested against every one of the 15 forms' live API response shape —
      worth a live try with a couple of different forms before trusting it
      fully; malformed/missing fields from the API would currently just
      show up blank rather than erroring.

- [x] **Versatile weapons had no way to be equipped two-handed — fixed
      2026-09-11.** `dnd_utils.js`'s damage-die calc already had a
      `gripDie()` heuristic inferring two-handed grip whenever a versatile
      weapon was the only one-handed weapon equipped, but (a) that
      inference doesn't check for a shield in the other hand, and (b) there
      was no way to deliberately choose two-handed when it WOULDN'T be
      inferred (e.g. a second one-hander or shield also equipped). Added a
      1H/2H toggle button on equipped weapons in `CharacterInventory.vue`
      (shown only for weapons that actually resolve as versatile) that sets
      `item.slot` explicitly to `melee1h`/`melee2h`. The shield-blind-spot
      in the inference itself wasn't touched — still worth fixing
      separately if a shield-plus-versatile-weapon case actually comes up.

- [x] **Warlock spell catalog had real gaps — found and fixed 2026-09-11**,
      while the project owner was rebuilding Kerra and the known-spell
      picker looked suspiciously short. Diffed the local catalog
      (`classes` field on SRD/published spell entries) against a verified
      real list (`dnd5e.wikidot.com/spells:warlock`): 5 spells existed
      locally but weren't tagged Warlock-eligible (Mislead, Planar Binding,
      Teleportation Circle, Gate, Weird — tagged now), and 11 real Warlock
      spells were missing from the catalog entirely — Witch Bolt, Distort
      Value, Arms of Hadar (1st); Cloud of Daggers, Crown of Madness, Flock
      of Familiars (2nd); Incite Greed (3rd); Galder's Speedy Courier, Gate
      Seal, Raulothim's Psychic Lance (4th); Arcane Gate (6th). Added full
      entries for all 11 to `published_spells.json` (`homebrew: false`,
      real source citations — Acquisitions Incorporated, SCAG, Xanathar's,
      Fizban's, Strixhaven — none are 2024-ruleset content). `npm run
build` clean. Same class of bug as the Artificer spell-list gap found
      earlier this session — worth checking other classes' `classes`-field
      coverage the next time a known-spell picker looks thin for no
      obvious reason.

- [ ] **Full character rebuild pass, once the level-up tool and all
      subclasses are at high confidence (project owner's target: 4.9/5).**
      Rebuild every roster character from level 1 through their current
      level using the (by-then-verified) level-up tool, and diff against
      what's currently on their sheet. Flagged as the natural follow-up to
      the 2026-09-09 discovery that a systematic character-wide ability
      score / feat-granted-feature audit turned up real gaps (see the
      2026-09-09 CHECKLIST.md entry). Project owner's own words: "Wizards
      who have learned additional spells from scrolls and books being the
      most difficult to manage" — expect that to be the hardest category to
      reconcile, since those spells aren't derivable from level-up math
      alone and need to be preserved through the rebuild rather than
      dropped as "extra."

- [ ] **Character rebuild queue: Sorra, Lexica still open; Kerra and Torrin
      DONE (see below).** All four were renamed to `"<Name> (Old)"`
      2026-09-11 to free up the real name for a fresh build. Project owner is
      building the replacements themselves;
      once each new character exists, delete the corresponding `(Old)`
      record and manually transfer over any notes worth keeping first.
      Lexica wasn't previously flagged for a rebuild in this file (her spell
      audit came back clean) — included per the project owner's explicit
      2026-09-11 call, for reasons outside the spell audit's scope.
      Renaming updated every functional reference to the old name, not just
      the character record, so the archived sheets keep working correctly
      until deleted: `party_items.json`'s `equipped_by`/`carried_by` on
      their gear (27 fields), and `user_prefs.json`'s `parties[].members`,
      `parties[].marching_order`, and `savedParties[].members` (9 entries).
      `npm run build` clean after. Consolidated here 2026-09-11 so this
      stops getting re-asked about piecemeal; each character has its own
      distinct reason it was queued:

  - **Sorra (Bard, College of Spirits, level 9).** 13 known leveled spells
    against a real cap of 12 (confirmed via `engine.spellsKnownForClass`).
    Project owner (2026-09-11): her stats are also illegal on top of the
    spell overage — full rebuild, not a 1-spell trim.
  - **Kerra — DONE, 2026-09-11.** Rebuilt from level 1 Fighter through the
    Level Up tool as originally suggested, real-world-tested the tool along
    the way and found/fixed several real bugs surfaced by the process
    (Eldritch Invocations letting duplicate picks through, no spell-granting
    invocation ever prompting a picker — Book of Ancient Secrets specifically
    — and the level-up preview view losing scroll position on every spell
    pick). Full audit of the finished sheet came back clean (ability scores,
    HP, saves, spell/cantrip counts, invocation count all check out against
    real caps); Deception in her skill list and her eventual Dueling fighting
    style were both deliberate project-owner choices, not bugs. Image,
    persona_notes, notes, and all 6 inventory items transferred from the old
    sheet; `Kerra (Old)` deleted once the project owner confirmed they were
    happy with the result. Also gave her a real Find Familiar familiar via a
    new feature — see the Familiar support entry below.
  - **Lexica (Bard, College of Lore).** Spell audit came back clean (see
    below) — this rebuild is for a different reason the project owner
    has, not spell-related.
  - **Torrin — DONE, 2026-09-12.** The hand-built "Torrin (Claude)"
    comparison build (real level 9 Rogue Soulknife, single clean subclass)
    was promoted to the real `Torrin` record — project owner: "good enough
    to keep live." Flavor fields (image, appearance, location, alignment,
    a trimmed persona_notes) transferred from `Torrin (Old)`; his 3 real
    established items (The Weaver's Master-Awl, Wolf Hunter's Rags, Hand
    Crossbow of the Old Trail) moved over too, alongside the 2 mundane
    placeholder items from the original build (Studded Leather Armor, 2
    Daggers) — no slot conflicts, so both stayed. Nice continuity find:
    the Weaver's Master-Awl's "Psionic Reinforcement" property (+2 to
    Psychic Blades attack/damage) was clearly written for a Soulknife
    already, well before this rebuild — the old homebrew dual-subclass
    build and the new clean one were pointing at the same character the
    whole time. That bonus isn't mechanically wired into the app yet
    (Psychic Blades aren't a `party_items.json` entry to attach an
    enhancement_bonus to) — DM-tracked for now. `Torrin (Old)` not
    deleted yet — ask before removing. `engine.validateCharacter` clean,
    `node --test` 260/260, `npm run build` clean.

    No priority order set between the remaining two (Sorra, Lexica) — ask
    before starting one. Project owner's own call: since both need real
    spellcasting choices worked through (a much bigger set of decisions
    than Torrin needed), they'll likely build those two themselves.

- [x] **Party membership + inventory-pool ambiguity when a character is
      listed in more than one party — raised 2026-09-12, resolved
      2026-09-14.** Project owner decided the `active_party_id` design (and
      its alternative) was "too much to worry about" — punted on solving
      multi-party membership itself. Instead, shipped the specific pain
      point that made deletion risky: deleting a party
      (`PartyEditModal.vue`'s `deleteParty`) used to silently orphan any
      pool item (`carried_by:'party'`) still pointing at that party's now-
      gone id. It now checks for pool items first — zero, and delete stays
      one click; any, and a confirmation dialog asks where they go (another
      remaining party, or "Unassigned" — the existing no-party pool bucket
      `CharacterInventory.vue` already supports) via a new
      `REASSIGN_PARTY_POOL` mutation, before the party record itself is
      removed. Characters' own personal gear (`equipped_by`/`carried_by`
      keyed by character name) is untouched by any of this — only party-
      pool items were ever at risk.

- [ ] **Full spell/cantrip audit across the roster (2026-09-08, re-verified
      2026-09-11) — mostly resolved now, see below for what's still open.**
      Wrote a one-off audit script (engine's own `cantripsKnownForClass`/
      `spellsKnownForClass`/`isSpellOnClassList`) across every caster. Real
      findings, confirmed by digging into git history and each character's
      actual feats/features before touching anything (several first-glance
      "bugs" turned out to be legitimate RAW mechanics the audit script just
      didn't know about — worth remembering next audit: don't trust a flat
      script's output, verify against feats/subclass data before reporting
      or fixing, and re-check the CURRENT character sheet before trusting an
      old note in this file, which can go stale once someone else fixes the
      thing it describes):

  - **Wizards (Lenn/Kessara/Lyria) — NOT a bug, no changes made.** All
    three show 10 cantrip entries against a cap of 4. Traced via
    `git log -S` to the commit that gave the party "Iyani's goddess
    mother's gift" (synced wizard spellbooks) — confirmed each wizard's
    real 4 pre-gift cantrips are exactly the ones tagged `prepared: true`
    today; the other 6 (`prepared: false`) represent spells visible in
    the shared spellbook but not actually known, which is the right call
    since cantrips genuinely can't be learned from a spellbook/scroll
    under RAW. Data was already modeling this correctly; the audit
    script just didn't account for the flag. Kessara's High Elf racial
    cantrip (Minor Illusion, tagged `featureGranted`) also correctly
    doesn't count against her 4.
  - **Rith (Sorcerer, Divine Soul) — NOT a bug, confirmed accurate, no
    changes made.** Project owner was right to be confident. Verified:
    his Divine Magic affinity bonus spell (Bless, Law affinity) is
    correctly tagged `featureGranted`; Fey Touched's free Misty
    Step/Silvery Barbs are correctly tagged and don't need a normal
    known-spell slot; his 5 "off Sorcerer list" spells are legal Divine
    Magic Cleric-list substitutions (still count against the cap, which
    they do); his cantrip count (5) and known-spell count (10) both hit
    their real level-9 caps exactly.
  - **Enauweyn (Paladin, Oath of the Crown) — DONE.** Her "Fey Step"
    feature is the real Eladrin racial trait (a non-spell teleport, no
    spells[] entry needed) — NOT the Fey Touched feat, and doesn't
    explain her recorded "Misty Step" spell. No other source found;
    removed it. Bigger gap: **Oath of the Crown's subclass file had no
    oath-spell table at all** (checked `engine/CHECKLIST.md` — its
    `features_by_level` was verified against her real feature list in an
    earlier session, but the oath-spell table was simply never added,
    unlike sibling subclasses built the same pass). Added the real
    PHB/SCAG table (3rd: Command/Compelled Duel, 5th: Warding
    Bond/Zone of Truth, 9th: Aura of Vitality/Spirit Guardians, 13th:
    Banishment/Guardian of Faith, 17th: Circle of Power/Geas) — her
    existing tagged oath spells (Aura of Vitality, Spirit Guardians,
    Warding Bond) already matched this table exactly, confirming it's
    right; added her 2 missing legitimate picks (Command, Compelled
    Duel, Zone of Truth).
  - **Revven (Cleric, Tempest Domain) — DONE.** Charm Person had no
    supporting feat/domain/background (project owner: "I don't know").
    Removed.
  - **Ferghus (Paladin, homebrew Oath of the Open Road) — DONE, this note
    was stale.** Fixed a real bug: the subclass file's oath-spell table
    was keyed `"1"` instead of `"3"` (every other built-out oath in this
    project keys by real character level). The 5th-level pick was later
    changed to Enlarge/Reduce + Silence (2026-09-08, project owner's
    choice, replacing the earlier unconfident Misty Step/Shatter), and
    9th/13th/17th were filled in 2026-09-09 (Incite Greed/Galder's
    Tower, Banishment/Summon Greater Demon, Temporal Shunt/Steel Wind
    Strike) — confirmed present and correct on Ferghus's own sheet
    through his current level during the 2026-09-10 subclass audit.
    Nothing left open here.
  - **Elucyne (Ranger, Gloom Stalker) — DONE (confirmed again 2026-09-11).**
    Confirmed level-5 Ranger really does cap at 4 known spells (checked
    `engine/data/spellcasting-tables.json`, not memory). Real gap found
    beyond just "1 spell short": her Rope Trick and Fear were tagged as
    normal known picks, but both are actually **Gloom Stalker Magic**
    free bonus spells (checked the subclass's own feature text) — Rope
    Trick (5th level) is legitimate but was mistagged; Fear (9th level)
    was outright premature at Ranger 5 and has been removed; Disguise
    Self (3rd level), the one she was missing entirely, has been added.
    Re-checked 2026-09-11 against the live sheet: she now has exactly
    4/4 known spells (Fog Cloud, Longstrider, Pass without Trace,
    Hunter's Mark), with Disguise Self/Rope Trick still correctly
    tagged `featureGranted`. Nothing left to do here.
  - **Sorra (Bard, College of Spirits) — superseded, see the rebuild queue
    above.** Confirmed via her features list: no early-Magical-Secrets-
    granting feature exists for this subclass (unlike Lexica below), so
    her Counterspell/Revivify (tagged `magical_secret`) had no
    legitimate source at level 9 — removed, along with an off-list
    cantrip (Green-Flame Blade, also unexplained). Cantrip count now
    correct (3/3). Her remaining 13 leveled known spells are all
    legitimately on Bard's list individually, but that's still 1 over
    the real cap of 12 — moot as a standalone fix now that she's queued
    for a full rebuild (illegal stats too, per the project owner).
  - **Lexica (Bard, College of Lore) — DONE (confirmed again 2026-09-11).**
    Her "Magical Secrets (level 6 — used)" feature, with its own note
    naming Counterspell/Scrying, is College of Lore's real **Additional
    Magical Secrets** — a different, RAW-legal, and explicitly free
    ability (unlike base Bard's 10th-level Magical Secrets, Lore's
    6th-level version doesn't count against spells known). Re-tagged
    both as `featureGranted` instead of removing them — the project
    owner's instinct to reset her was reasonable caution, but the data
    turned out to already be correct, just mistagged. Re-checked
    2026-09-11: Phantasmal Killer (the previously-flagged unexplained
    off-list spell) is gone from her sheet — she now has exactly 12/12
    known spells + 3/3 cantrips, magical secrets still correctly
    tagged. Nothing left to do here.
  - **Jaygar (Artificer, Infused Arbalist) — cantrips DONE; leveled spells
    were a real gap, partially fixed 2026-09-11, one part still open.**
    He has exactly 2 cantrips (Guidance, Resistance), matching
    Artificer's real cap of 2 at level 9 (verified via
    `engine.cantripsKnownForClass`, not memory — the cap only rises to 3
    at 10th level). Both are legitimate Artificer-list cantrips.
    **New finding 2026-09-11**: he had zero leveled spells recorded at
    all despite being a 9th-level half-caster — the original cantrip-
    only note missed this entirely. Added his 6 always-prepared Infused
    Arbalist bonus spells (Shield, Thunderwave, Scorching Ray, Shatter,
    Fireball, Wind Wall — his subclass's own `expanded_spell_list`,
    don't count against his normal prepared total). **Still open**: his
    INT-based prepared count (`engine.preparedSpellCount('Artificer', 9,
5, 'Infused Arbalist')` = 9, from INT 20) worth of real picks from
    the Artificer list — project owner is choosing these via the Spell
    Browser and will report back.

                                                                                                                                                                                                                Also surfaced a **data gap worth fixing separately, not urgent**:
                                                                                                                                                                                                                the local Artificer spell-list tagging (the `classes` field on SRD/
                                                                                                                                                                                                                published spell entries) is badly incomplete — only 29 spells total
                                                                                                                                                                                                                carry an `Artificer` class tag across every level, versus the real
                                                                                                                                                                                                                Tasha's list's 60+ entries through 5th level (confirmed against
                                                                                                                                                                                                                `dnd5e.wikidot.com/spells:artificer`). This means the Spell
                                                                                                                                                                                                                Browser's "Class: Artificer" filter under-reports for now — anyone
                                                                                                                                                                                                                filtering by Artificer there should know the shortlist is a cache
                                                                                                                                                                                                                gap, not the real set of legal options. Not fixed this session;
                                                                                                                                                                                                                would mean re-tagging dozens of existing SRD entries.

  - **Tackett (Druid, Circle of Stars) — DONE.** Project owner's call: he's
    a "legendary" character, RAW-accuracy isn't the goal, just a clean
    in-fiction reason for his 6 recorded cantrips (cap 3). Added a new
    homebrew feature, "Legendary Repertoire" (`published_features.json`,
    id `hb_tackett_legendary_cantrips`), granting a flat +3 cantrips,
    and added it to his `features[]`.
  - **Chuknora (Barbarian/Paladin) — DONE, cosmetic tagging fix only,
    2026-09-11.** A fresh cross-roster cantrip/known-spell cap sweep
    this session flagged her Giant's Power cantrip (Thaumaturgy) as
    uncapped — false alarm, she's fully RAW-legal (Path of the Giant's
    Giant's Power grants Thaumaturgy or Druidcraft for free, confirmed
    against `published_features.json`). The entry just used an informal
    `note` field instead of the project's normal `featureGranted: true` + `_source` tagging convention that every other free/bonus spell
    uses, which is what made the script flag it. Fixed the tag so
    future audits don't re-flag her; no rules content changed.
  - **Minor, not yet acted on**: all 3 wizards' spellbooks reference
    "Negative Energy Flood (homebrew spell from necromancer's
    spellbook)," which doesn't exist anywhere in the local spell
    catalog — fine to leave as flavor text, but if it's ever actually
    cast at the table it'll need a real homebrew spell entry.

    Verification: `npm run build` clean; `cd engine && node --test`
    218/218. The audit script itself lives at `scratchpad/spell_audit.js`
    in this session's scratchpad, not committed to the repo — one-off,
    not a permanent tool.

- [ ] **[USER ACTION] Mine other chats for lore.** User has a lot of world
      lore (history, locations, factions, etc.) scattered across other chat
      conversations, not in this repo. Action item is on the user: go
      through those chats, pull out the lore/location/history content, and
      get it into `lore/` (see `lore/README.md` for the convention —
      `places/`, `history/`, `beasts/`, `factions/`, `people/`). Not
      something Claude can do — the source material only exists in those
      other conversations.

- [ ] **[USER ACTION] Add more homebrew languages — the New Character
      picker only has one to offer.** 2026-09-12: New Character's language
      pickers now correctly pull in homebrew languages from
      `src/data/weapon_types_and_languages.json`'s `languages` array (they
      previously didn't at all — see the fixed entry in `TODO_ARCHIVE.md`
      once this session's work is archived, or search this file's history
      for "Homebrew languages weren't offered"). But that array currently
      holds exactly **one** entry — Solvalean (Solvale Empire's official
      language) — and nothing else in `world.json` or `lore/` names a
      second one. If Kaemahz's other regions, Senkolai's five Boles (each
      already flagged in `lore/places/Senkolai.md` as culturally distinct
      enough to want their own naming conventions), Yetgrese, or anywhere
      else in the setting have their own languages in the project owner's
      head — or sitting in one of the other chats covered by the "Mine
      other chats for lore" item above — they need to be written into that
      array before they can show up anywhere. Same shape as the existing
      entry: `{"name": "...", "type": "regional"|"exotic"|whatever fits,
"description": "...", "speakers": ["...", "..."]}`. Hand Claude the
      names/flavor and this is a fast add; inventing campaign languages
      unprompted isn't something to do without that input.

- [ ] **Background expansion + species.json SRD-scope reconciliation — both intentionally on hold, not forgotten.** Two separate, unrelated gaps left over after the racial-mechanics work below was completed (now archived, see TODO_ARCHIVE.md): (1) only 40 of ~360 backgrounds have real curated skill data (`engine/data/backgrounds.json`) — explicitly deprioritized 2026-09-07 (project owner: "I don't think we need that many more backgrounds. skip them for now"); the picker's "Other (custom)" escape hatch covers the gap for now. (2) `src/data/api_data_cache/species.json`'s SRD flavor-entry scope is unresolved — the cache went missing and was rebuilt from dnd5eapi.co with only the 13 real races/subraces the API has, not the ~380 previously noted here; project owner wants to reconcile against another hard drive before trusting either number, not something Claude can resolve alone.
- [ ] **[LOW PRIORITY] "Plan all levels ahead" preview toggle**, per the
      Character Builder Blueprint's New Character Mode wireframe — preview
      levels 2-20 in one pass rather than one level at a time. `describeLevelUp`
      already supports arbitrary level ranges; this would just call it
      repeatedly and build a UI for the result. Marked low priority 2026-09-03
      per project owner.

- [ ] **Level-up UI: add a 4th "preview the future" section at the bottom.**
      Once the wizard/tabs and stats/spells panels exist (see the Character
      Builder Blueprint artifact from this project), add a section previewing
      what the next 3 levels of the currently-selected class would offer —
      lets a player quickly compare "stay in this class" vs. "multiclass here
      instead" without leaving the screen. `engine/rules/levelUp.js`'s
      `describeLevelUp` already returns exactly this shape (features gained,
      ASI levels, spell slot/known changes) for any level range, so this is
      mostly a UI consumer of what already exists, not new engine work.
