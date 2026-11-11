# Full Code Review — 2026-10-07

Scope: the whole repository at **`850378b`** (the tip of `main` after the 2026-10-07 push), about 80k lines of JS/Vue plus the JSON data. **No code was changed.** This file is only a list of what should change.

This review was first written against `1df452f`. When 11 newer commits landed on `main`, I re-checked every finding against `850378b`. The five commits from 2026-10-04 had already fixed several items; those are marked **FIXED**. Section 7 reviews the six commits pushed on 2026-10-07 one by one.

How this was checked:

- I read every `engine/` rule file, the Vuex store, `server.js`, `merge-utils.js`, `dataService.js`, `dnd_utils.js`, `spellUtils.js`, and the stat/HP/rest/combat/spellbook components.
- For the larger components (`LevelUpTool.vue`, `NewCharacterTool.vue`, `encounter_utils.js`, ...) I searched for rules logic, constants, fetches and store writes instead of reading every line.
- I scanned all of `characters.json`, `party_items.json`, `published_features.json`, `published_spells.json`, `feats.json` and `feature-mechanics.json` with scripts.
- `cd engine && node --test` passes **583/583**.
- `npm run build` was **not** run: `node_modules` isn't installed in this cloud container, and the project rules say not to install anything without asking.

Every item marked **[CONFIRMED BUG]** was reproduced on `850378b` by running the real engine code, or checked against the real data files. It is not a guess.

---

## 0. How to read this

| Label                  | Meaning                                                                                            |
| ---------------------- | -------------------------------------------------------------------------------------------------- |
| **[CONFIRMED BUG]**    | Produces a wrong number or loses data today, and was reproduced.                                   |
| **[LATENT BUG]**       | Wrong logic that no current character triggers yet, or that only fires in a specific situation.    |
| **[LAYER]**            | Code is in the wrong layer (game rules in the UI, UI concerns in the engine, and so on).           |
| **[DUP]**              | The same fact or logic is implemented more than once, so the copies can drift apart.               |
| **[DATA]**             | A data-shape or data-integrity problem (derived values stored, inconsistent keys, links by name).  |
| **[MACHINE-READABLE]** | Rules exist only as prose, or as hardcoded `if (name === ...)` checks, instead of structured data. |
| **[CLEANUP]**          | Dead code, documentation drift, file size. Low risk.                                               |
| **MULTI-FILE**         | The fix has to touch several files together. Section 3 lists these; Section 4 points back to them. |

Section 1 is the target architecture you described, turned into concrete rules. Section 2 lists the confirmed bugs. Section 3 covers the cross-cutting (multi-file) problems. Section 4 is the file-by-file list. Section 5 is a suggested order of work. Section 6 lists my questions for you. Section 7 reviews the commits pushed on 2026-10-07.

---

## 1. Target architecture (what "done" looks like)

Your description maps to three layers. The current `CLAUDE.md` describes almost the same thing, but under different names: it calls your rules layer "Rules" and your engine layer "Game-aide engine", and it puts both inside `engine/`. I've used **your** names below.

```
rules/   (pure, never changes at runtime; ports to Godot)
  data/      every class, subclass, feature, feat, spell, species, item, condition, house rule
             ONE record per thing: { id, name, source, homebrew, text, effects[], choices[], grants[] }
  fn/        tiny pure formulas: abilityModifier, proficiencyBonus, point-buy cost, dice parsing
  schema/    JSON Schemas + the registry of legal modifier keys ("ac", "skill:stealth", ...)

engine/  (game state + actions; ports to Godot)
  derive/    character + rules -> computed sheet (AC, saves, skills, attacks, slots, resources, features)
             every number is { value, breakdown[] }
  actions/   pure reducers: applyDamage, heal, spendSlot, spendUse, toggleCondition, shortRest,
             longRest, levelUp(choices), createCharacter(choices), startCombat, nextTurn, ...
             (state, action) -> { state, events[] }
  io/        one data-loading adapter (Node fs today, a bundled manifest in the browser, Godot FileAccess later)

src/     (Vue only; NOT ported)
  store      a thin wrapper: dispatch an engine action -> replace state -> autosave
  components render the derived sheet; they never compute a D&D number
```

These rules come from your request:

1. **Rules records hold both text and effects.** Every feature, feat, spell, item, condition and house rule keeps its exact prose (`text`) **and** a machine-readable `effects[]` list. For example:
   ```json
   {
     "id": "fighting-style-defense",
     "name": "Defense",
     "text": "While you are wearing armor, you gain a +1 bonus to AC.",
     "effects": [
       {
         "op": "add",
         "target": "ac",
         "value": 1,
         "when": { "wearing_armor": true }
       }
     ]
   }
   ```
   Effect targets come from **one registry** (`rules/schema/modifier-keys.json`), and a validator rejects unknown keys. Homebrew uses the exact same schema, marked `homebrew: true` with a `source`. House rules become a **ruleset overlay** (`rules/data/house/`) that patches or replaces base records. The overlay carries its own numbers (DCs, dice, thresholds) as data, so the prose and the code can't disagree.
2. **Rules are pure and immutable at runtime.** Nothing at runtime copies rule facts onto a character (today `uses_max`, `action_type`, `recharge`, `proficiency_bonus`, `hit_die` and more are copied in; see 3.2).
3. **The engine owns every state change.** "Take 7 damage", "long rest" and "level up" are engine actions. The Vue store calls them; it doesn't contain them. The 2026-10-04 sweep already did this for rests and HP (see 3.5).
4. **One source of truth per fact.** A character file stores only **choices** (class levels, picks, base scores, equipped item ids) and **current state** (HP, uses spent, slots spent, conditions). Anything that can be derived gets derived.
5. **Live by default.** Every gameplay action is in the store immediately and autosaved. Only _drafts_ (a level-up in progress, a character being built) use an explicit Save button. Drafts live in a separate draft slot, not mixed into the live table (see bug 2.1).

---

## 2. Confirmed bugs

> **Update 2026-10-08 (after merging `main` @ `dbf0fd4`):** every bug in 2a below is now resolved on `main`. Live status is tracked in `BUGLIST.md`. 2.1, 2.2, 2.3, 2.4, 2.6, 2.9, 2.11, 2.12, 2.13, 2.14, 2.15 and 2.16 are fixed with regression tests (618/618 engine tests pass, and 2.2/2.3/2.4/2.14 were re-run with the original reproductions on the merged code). **2.8 was my error and is not a bug:** the 2014 Artificer prepares "Intelligence modifier + half your artificer level, rounded down"; rounding up applies only to the multiclass spell-slot calculation. The table below is kept as originally written, for the record.

Original status line: as of `850378b`. "Fixed" means fixed by the 2026-10-04 commits (`7c45bda` and following).

### 2a. Still present: fix these first (each is small)

| #    | Bug                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Where                                                                                                                       | Who's affected today                                                                                                                                                                                                         |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.1  | **A pending (unsaved) level-up or new character gets written to disk by autosave.** `APPLY_LEVEL_UP`/`ADD_CHARACTER` deliberately don't mark `characters` dirty. But any _other_ edit to any character (HP, a condition, a spell slot) does mark it dirty. `AppLayout.vue`'s 1.5 s autosave then runs `saveAll` → `save('characters')`, which sends the **whole** in-memory array, including the "pending" character. So the explicit Save/Revert flow can be bypassed silently.                                           | `store/index.js` (`APPLY_LEVEL_UP`, `ADD_CHARACTER`, `saveAll`), `AppLayout.vue` watcher, `mixins/pendingCharacterSaves.js` | Anyone who levels up a character, then touches any HP or condition before pressing Save.                                                                                                                                     |
| 2.2  | **Skill proficiency ignored when the skill name has a space.** `checks.js`'s `SKILL_MAP` keys are `AnimalHandling`/`SleightOfHand`, but character data mixes `"Animal Handling"`, `"Sleight of Hand"` and `"SleightOfHand"`. Reproduced: proficient in "Sleight of Hand", DEX +2, prof +3 → shows **+2**, should be **+5**.                                                                                                                                                                                                | `engine/rules/5e/checks.js`, `characters.json`, `engine/data/5e/skills.json` (a third scheme: ids `animal-handling`)        | **Therynv'l**, **Lexica**, and now **Brick** (added 2026-10-07) on Animal Handling; **Torrin** on Sleight of Hand. All show skill totals that are too low.                                                                   |
| 2.3  | **Versatile weapon + shield shows the two-handed die.** `gripDie()` counts only `melee1h` weapons and ignores a shield. Reproduced: longsword + shield → `1d10` (should be `1d8`). The new `weaponHands.js` already knows about the shield (`loadoutHands().shield`), but `gripDie` doesn't use it.                                                                                                                                                                                                                        | `engine/rules/5e/weaponAttack.js` `gripDie`                                                                                 | **Enauweyn** (Longsword +2 + shield).                                                                                                                                                                                        |
| 2.4  | **Proficiency is always added to weapon attacks, even when the character isn't proficient.** `isProficientWithWeapon()` exists but `attackBonusBreakdown` never calls it. Reproduced: a simple-weapons-only character with a greataxe still gets +3.                                                                                                                                                                                                                                                                       | `engine/rules/5e/weaponAttack.js`                                                                                           | Any non-proficient weapon use.                                                                                                                                                                                               |
| 2.6  | **(Partly fixed.)** The prepared _count_ is now right (`preparedSpells.js` excludes Ranger). But `characterSpells.js`'s `FULL_CLASS_LIST_CLASSES` still lists `ranger`, so the spellbook still offers a Ranger the **whole** class list to "prepare" from. The comment says "left as found". 2014 Rangers _know_ spells.                                                                                                                                                                                                   | `engine/rules/5e/characterSpells.js`                                                                                        | **Elucyne** and any Ranger.                                                                                                                                                                                                  |
| 2.8  | ~~Not a bug (see update above).~~ **Artificer prepared count rounds down; RAW rounds up** ("half your artificer level, rounded up"). It's now wrong in **two** engine implementations, and the new file's header comment states the wrong rule.                                                                                                                                                                                                                                                                                                              | `engine/rules/5e/preparedSpells.js`, `engine/rules/5e/spellcasting.js` `preparedSpellCount`                                 | **Jaygar** (Artificer 9 → shows INT + 4, should be INT + 5).                                                                                                                                                                 |
| 2.9  | **Short-rest healing uses the wrong hit die and the base CON score.** The logic moved into the engine (`rest.js`), but the bugs moved with it:<br>• `hitDieSides(character.hit_die)` falls back to **d8** when `hit_die` is missing. **Neither `NewCharacterTool.vue` nor `diffLevelUp.js` ever writes `hit_die`**, so 6 characters have none.<br>• CON comes from `stat_con` (base), ignoring items.<br>• One hit-die size per character, so multiclass is wrong.<br>The engine already has `progression.hitDieForClass`. | `engine/rules/5e/rest.js`; the missing field in `NewCharacterTool.vue` / `diffLevelUp.js`                                   | **Brick** (Barbarian 8 / Fighter 1: rolls d8 instead of d12/d10), **Elowenne** (Wizard: d8 instead of d6), **Kerra** (d10/d8 mix), **Jaygar** (Amulet of Health: CON 14 used, real 19), **Chuknora**, **Eldi**, **Elucyne**. |
| 2.11 | **Duplicate feature id** `pub_primal-companion` appears twice in `published_features.json`. There's also an orphan `pub_celestial-resistance` next to the real `pub_celestial-resilience`. (The same kind of bug, four duplicate spells, was found and fixed in `published_spells.json` in `73dcdc7`. A uniqueness test would catch both.)                                                                                                                                                                                 | `src/data/published_features.json`                                                                                          | Lookups for those features.                                                                                                                                                                                                  |
| 2.12 | **A 3-way merge can delete features.** `merge-utils.js` picks the array key from the _first_ element (`id`). Features with no id all get the key `"undefined"` and collapse into **one** row when a real merge happens.                                                                                                                                                                                                                                                                                                    | `merge-utils.js` `getKeyField`/`keyOf`                                                                                      | Only triggers on a real concurrent edit, but then it loses data silently.                                                                                                                                                    |
| 2.13 | **The production / server-down fallback crashes for `spellbooks` and `mounts`.** `store.loadAll` loads them, but `dataService.staticTables` doesn't include them.                                                                                                                                                                                                                                                                                                                                                          | `src/utils/dataService.js`                                                                                                  | `npm run deploy` build, or dev with the backend down.                                                                                                                                                                        |
| 2.14 | **Stat-override items can _lower_ a score.** `resolveEffectiveStats` sets `scores[key] = override` unconditionally. RAW says "no effect if your score is already ≥ X". Reproduced: CON 20 + Amulet → **19**.                                                                                                                                                                                                                                                                                                               | `engine/rules/5e/characterStats.js` pass 1                                                                                  | No roster character today. It will hit the first time someone's base passes their item.                                                                                                                                      |
| 2.15 | **Tavern Brawler's d4 unarmed strike never applies.** `unarmedAttacks.js` reads `character.unarmed_strike_die`, but nothing ever sets it. The feat record (`feats.json`) has no mechanic, and `diffLevelUp` doesn't write the field.                                                                                                                                                                                                                                                                                       | `engine/rules/5e/unarmedAttacks.js`, `engine/data/5e/feats.json`                                                            | **Brick** has Tavern Brawler. Hidden today because his Unarmed Fighting d6/d8 is bigger, but a Tavern Brawler without that style gets 1 damage.                                                                              |
| 2.16 | **Monk Unarmored Defense still counts a shield.** `computeAC` adds `shieldBonus` whatever formula is in use. RAW Monk Unarmored Defense only works "while wearing no armor _and not wielding a shield_". (Barbarian's does allow a shield.)                                                                                                                                                                                                                                                                                | `engine/rules/5e/armorClass.js`                                                                                             | No roster monk today. [LATENT BUG]                                                                                                                                                                                           |

### 2b. Fixed since `1df452f` (by the 2026-10-04 sweep)

| #    | Bug                                                                                       | Fixed by                                                                |
| ---- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 2.5  | Interrupted long rest added `"Exhaustion"` to `conditions` instead of `exhaustion_level`. | `engine/rules/5e/rest.js` now uses `exhaustion_level` only.             |
| 2.7  | Prepared-spell limit used total character level for multiclass characters.                | `engine/rules/5e/preparedSpells.js` works it out per class.             |
| 2.10 | Martial Arts die scaled with total level, not Monk level.                                 | `engine/rules/5e/unarmedAttacks.js` reads the Monk table at Monk level. |

---

## 3. Cross-cutting problems (MULTI-FILE)

These are the root causes of the two problem classes you named ("data duplication bugs" and "the machine can't read the rules").

### 3.1 [MACHINE-READABLE] Rules are prose plus hardcoded checks, not structured effects — MULTI-FILE

What's there now:

- `published_features.json`: about 860 features. Almost all are prose only.
- `engine/data/5e/feature-mechanics.json`: the structured layer has grown to about 20 entries; `item-mechanics.json` exists for items. Each new mechanic adds a **new bespoke field name** rather than using a general effect: `uses_formula`, `tier_family`, `adds_ability_to_initiative`, `unarmored_defense`, `grants_spells`. That's better than prose, but every field still needs its own code path.
- Mechanics are still recognized **by name or by a hardcoded id**:
  - `armorClass.js`: `'dual wielder'` and `'Unarmored Defense'`
  - `checks.js`: `'jack of all trades'`
  - `weaponAttack.js`: the `'Raging'` condition
  - `diffLevelUp.js`: `'Font of Inspiration'`, `'Fighting Initiate'` (new), and about 15 `class === 'x' && subclass === 'y'` branches
  - `unarmedAttacks.js`: `UNARMED_FIGHTING_ID` _or_ the name string
  - `hurlSomething.js`: `fighting-style-thrown-weapon-fighting`, `hb_hurlers_rage`
  - `hurlYourself.js`: `hb_hurl_yourself`
  - The same rule can have several ids. Fighting Style: Defense is both `fighter-fighting-style-defense` and `fighting-style-defense`, so an id check has to know every variant. Three characters' fighting styles (Chuknora, Enauweyn, Eldi) have **no id at all**, so any id check misses them.
- House rules: the prose is in `house_rules.json`, but the **numbers** (Falling: DC 14 + tier, d8/d6, lethal over 60 ft; Hurl: 5×STR, 1d4 per 8 lb, splash over 40 lb) are JS constants in `fall.js`/`hurlSomething.js`. If someone edits the prose, the code won't follow.
- `src/data/conditions.js` is a JS module with prose tooltips; no condition has machine effects.

What to change:

1. Define one **effect schema** (`op`: add / set_min / set_base / advantage / grant_proficiency / grant_spell / resource / choice / custom; `target` from a key registry; an optional `when` condition). Add a validator test over every data file.
2. Add `effects[]` to features, feats, items, species traits, conditions and house rules. Keep the bespoke fields only as `op: "custom"` for truly one-off logic (Hurl Yourself is a fair example).
3. Replace each `name === ...` / hardcoded-id check with "does any resolved feature, item or condition carry effect X".
4. Convert `diffLevelUp.js`'s ~30 bespoke `*Choice` parameters into one data-driven `choices: { [choiceId]: value }` map. Each feature declares its `choices[]` in data. `server.js` and `LevelUpTool.vue` shrink a lot.
5. Move `src/data/conditions.js`, `travel_events.js` and `house_rules.json` into rules data with effects and parameters.

Files: `engine/rules/5e/{armorClass,checks,weaponAttack,diffLevelUp,characterStats,unarmedAttacks,fall,hurlSomething,hurlYourself}.js`, `engine/rules/houseRules.js`, `engine/data/5e/*`, `src/data/{published_features,house_rules}.json`, `src/data/conditions.js`, `server.js`, `LevelUpTool.vue`.

### 3.2 [DATA][DUP] Derived values and rule mechanics are stored on characters — MULTI-FILE

`characters.json` stores values that should be computed:

| Stored field                                                                       | Should come from                               | Evidence of drift / risk                                                                                                                                                                                                                                            |
| ---------------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `level`                                                                            | `sum(classes[].level)`                         | Nothing enforces it.                                                                                                                                                                                                                                                |
| `proficiency_bonus` (all characters)                                               | `proficiencyBonus(level)`                      | `proficiency.js` treats the stored value as a **"Manual override"** for everyone.                                                                                                                                                                                   |
| `hit_die`                                                                          | the classes                                    | **Missing on 6 characters → bug 2.9.**                                                                                                                                                                                                                              |
| `saving_throws`, `unarmored_ac_formula`, `darkvision`, `speed`, `resistances`      | first class / class data / features / species  | `32be090` now infers Barbarian/Monk Unarmored Defense when the field is absent, but 20 characters still have it stored, and a stored value always wins.                                                                                                             |
| `features[].uses_max/action_type/recharge/per_turn_cap/adds_ability_to_initiative` | rules data                                     | `applyFeatureMechanics` only fills fields that are _missing_, so a stale value is never corrected.                                                                                                                                                                  |
| **Homebrew mechanics that exist _only_ on the character**                          | the feature's rules record                     | New in `73dcdc7`: **Elegant Ward**'s `unarmored_defense` and **Hulking Build**'s `stat_bonuses` (+2 STR/+2 CON) are on Elowenne's and Brick's records, not on `hb_elegant_ward`/`hb_hulking_build`. A second character given the feature wouldn't get the mechanic. |
| `unarmed_strike_die`                                                               | the Tavern Brawler feat                        | Never set → bug 2.15.                                                                                                                                                                                                                                               |
| `spell_slots.max`, `pact_magic.max`, `resources[].max`                             | spellcasting tables / class data               | Only correct if the last level-up wrote them.                                                                                                                                                                                                                       |
| `stat_str..stat_cha` **and** `ability_score_history`                               | base scores + history                          | Two sources of truth. `abilityScoreBreakdown.js` back-calculates an "implied base".                                                                                                                                                                                 |
| `features[]` itself                                                                | classes + subclass + species + feats + choices | About half have no id; e.g. "Caster Prestidigitation" on Elowenne has `id: null`.                                                                                                                                                                                   |

What to change: write a **character schema v2** (choices + current state only), add one migration script, and derive everything else in the engine.

Files: `src/data/characters.json`, `engine/CHARACTER_SCHEMA.md`, `engine/rules/5e/{proficiency,armorClass,diffLevelUp,characterStats,rest,unarmedAttacks}.js`, `engine/rules/validateCharacter.js`, `NewCharacterTool.vue`.

### 3.3 [DATA] Cross-file references use display names; ids aren't stable — MULTI-FILE

- Items link to characters by **name** (`equipped_by`, `carried_by`, `attunement_by`). So do companions, relationships, parties and NPC locations.
- Store mutations find rows by name (`SET_TABLE_ROW`, `SPEND_FEATURE_USE`, `SPEND_SPELL_USE`). Feature names repeat on purpose (8 "Divine Strike"s, 4 "Extra Attack"s), so spending one use can hit the wrong entry.
- `update-ids.js` renumbers ids by array position. New ids are minted by "max + 1" in the browser, so two tabs can mint the same id.
- Character spells and `published_spells.json` are keyed by name.
- Progress: `80b2126`/`20d306e` made party items **reference an item library by `catalog_id`**, which is exactly the right pattern. But the link is made by `autoLinkItem` → `matchLibraryEntry`, which **matches by name on every save** (`server.js` POST with `link: true`) and deletes the local `effect` text when it "doesn't diverge". A custom item that happens to share a name with an official one gets linked silently. Prefer linking once (a migration or an explicit button), not on every write.

What to change: give every record a permanent id, never renumber, reference by id everywhere, and only show names.

### 3.4 [DUP] The same rules data lives in several stores — MULTI-FILE

| Fact                   | Copies                                                                                                                                                                                                                                         |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Feature names          | `feature-catalog.json` (now about 1,530 entries after `5270b59` added 261, hand-maintained, though it's now test-guarded), `published_features.json`, `api_data_cache/features.json`, plus per-character copies                                |
| Feature mechanics      | `feature-mechanics.json`, fields inside `published_features.json` (e.g. `hb_timeline_freeze` repeats `action_type`/`recharge`), character copies                                                                                               |
| Spells                 | `srd_spells_full.json`, `published_spells.json`, 9× `<class>_spells.json`, live `dnd5eapi.co`, `spellLists.js` (which reads `src/data` directly)                                                                                               |
| Prepared-spell formula | `preparedSpells.js` **and** `spellcasting.preparedSpellCount`. Two engine implementations, and both carry bug 2.8. The comment says the second exists only because the first loads class data through `fs` → 3.8                               |
| Species / classes list | `engine/data/5e/species.json`, `api_data_cache/species.json`, `character_utils.js` `GENERA`/`CLASSES`                                                                                                                                          |
| Weapons / armor        | `engine/data/5e/weapons.json`/`armor.json`, `weapon_types_and_languages.json`, `startingGearCatalog.js`, `encounter_utils.js`, shield `+2` in `armorClass.js`                                                                                  |
| Skills                 | `skills.json` (ids), `checks.js` `SKILL_MAP` (CamelCase), character data (both forms) → **bug 2.2**                                                                                                                                            |
| Rage                   | **Uses** now come from `barbarian.json` `rages_by_level` (`5270b59`, good), but **damage** is still a hardcoded table in `weaponAttack.rageDamage` while `barbarian.json` has `rage_damage_by_level`. Now they're inconsistent with each other |
| Subclass bonus spells  | Six differently named fields (`expanded_spell_list` with two meanings, `domain_/oath_/circle_/psionic_/clockwork_spells_by_level`, plus `bonus_spells_by_level`); three "free spell" flags on characters                                       |
| Ability score cap      | `asiFeat.js` `SCORE_CAP`, `LevelUpTool.vue` `Math.min(20, …)`                                                                                                                                                                                  |
| Dice                   | The engine now has `dice.js` (good), but `encounter_utils.js`, `startingGearCatalog.js`, `LongRestModal.vue` and others still roll on their own                                                                                                |
| Spell picker UI        | About 6 copies in `LevelUpTool.vue`, plus 2 more added to `NewCharacterTool.vue` in `0fc78bc` (spellbook + prepared). The TODO already proposes one shared component                                                                           |

### 3.5 [LAYER] Game rules in the UI layer — MULTI-FILE (much improved)

The 2026-10-04 sweep moved a lot of rules logic out of the UI and into the engine. Status:

| Rule / transition                                                                       | Status at `850378b`                                                                                                                         |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Short/long rest                                                                         | **Done**: `engine/rules/5e/rest.js` (still has bug 2.9)                                                                                     |
| HP / damage / concentration DC                                                          | **Done**: `hitPoints.js` (`Battle.vue` now calls `concentrationDC`)                                                                         |
| Limited-use spend/restore                                                               | **Done**: `limitedUse.js`                                                                                                                   |
| Prepared spells, character spell list, bonus spells                                     | **Done**: `preparedSpells.js`, `characterSpells.js` (`spellUtils.js` is now 59 lines)                                                       |
| Unarmed strike, martial arts, sneak attack, psychic blades                              | **Done**: `unarmedAttacks.js`                                                                                                               |
| Ability score breakdown                                                                 | **Done**: `abilityScoreBreakdown.js`                                                                                                        |
| Initiative, calendar, travel, weekly events, Weave Dust                                 | **Done**: `initiative.js`, `calendar.js`, `travel.js`, `weeklyEvents.js`, `houseRules.js`                                                   |
| Falling, Hurl Something/Yourself, jump                                                  | **Done** (new, `ce2439e`)                                                                                                                   |
| Conditions / exhaustion toggling, spell-slot toggling                                   | Still component-side (`ConditionsRow.vue`, `SpellSlotsTracker.vue`, `ClassResourcesPanel.vue` build records and commit `UPDATE_TABLE_ITEM`) |
| Character creation (skills, languages, proficiencies, species grants, saves, `hit_die`) | Still in `NewCharacterTool.vue` `characterShell` → `engine/actions/createCharacter.js` (and fixes bug 2.9's missing `hit_die`)              |
| Encounter/enemy generation (2,318 lines)                                                | Still `src/utils/encounter_utils.js`; a second generator to `engine/rules/npcBuilder.js`                                                    |
| Attunement limit, starting gear, ships/vehicle combat                                   | Still UI-side                                                                                                                               |

### 3.6 [DATA] Game state is spread across many persistence locations; combat isn't saved — MULTI-FILE

The places state lives today:

1. `src/data/*.json` via the server.
2. `user_prefs.json`: parties, `game_day`, calendar notes, level cap. It's written with a whole-file read-modify-write.
3. `localStorage`: `game_day` fallback, `savedEncounters`, the lookup cache.
4. Vuex-only: `vehicleCombatSession`, `currentEncounter`.
5. Component `data()`: the whole live fight in `CombatContext.vue`.

A refresh mid-combat loses the fight. Make one `GameState` owned by the engine, with one persistence path. Side effects inside mutations (`patchUserPrefs`, `localStorage`) should move into actions or a store plugin.

### 3.7 [DUP][LAYER] Player characters and enemies use different models — MULTI-FILE

`HpTracker`/`EnemyHpTracker`, `ConditionsRow`/`EnemyConditionsRow`, `AbilityScoreGrid`/`EnemyAbilityScoreGrid` and `VitalsChipRow`/`EnemyStatsChipRow` are four near-duplicate pairs (about 1,870 lines). One engine **Creature/Combatant** shape would let each pair collapse to one component.

### 3.8 [LAYER] Two ways to reach the engine; only the dev server has all of it — MULTI-FILE

- About 25 thin `src/utils/*` wrappers (13 before the sweep, about 12 more added) `require()` engine leaf files directly.
- Level-up, new character, feats, invocations, spell choices, the NPC builder and the item catalog go over `/api/engine/*`, because `classFeatures.js`, `subclasses.js`, `featureCatalog.js`, `featureMechanics.js` and `spellLists.js` use `fs`/`readdirSync`.
- So the `npm run deploy` build has no level-up, no new character and no NPC builder.
- It also forces duplicate implementations such as the prepared-spell formula (3.4).
- `itemCatalog.js` and `preparedSpells.js` show the fix already: plain `require()` of JSON bundles fine.

What to change: one data-loading adapter (a generated manifest instead of `readdirSync`), and one `src/engine.js` facade instead of 25 wrappers.

### 3.9 [CLEANUP] AI context cost: narrative comments and huge logs — MULTI-FILE

Many functions carry 20–40 lines of dated history ("Real bug found …", "Moved to engine …") above a few lines of logic. `engine/CHECKLIST.md` is now **3,547 lines** and `CLAUDE.md` tells every session to read it first. Keep comments to _what and why now_, leave history to git, and trim `CHECKLIST.md` to a short current-state summary.

Doc drift to fix:

- `CLAUDE.md` says "~125 tests" (actually 583).
- `CHECKLIST.md` mentions 179/218.
- `CHARACTER_SCHEMA.md` says saves are `"strength"` (the data uses `"str"`).
- `PORTING.md` says the barrel is "shaped like a Godot Autoload" (it can't be bundled).

---

## 4. File-by-file

`→ 3.x` means "part of multi-file item 3.x above".

### Root

- **`server.js`**
  - `ALLOWED_TABLES` lists `factions` and `quests`, which don't exist. [CLEANUP]
  - `/api/engine/preview-level-up` passes about 30 named choice params → 3.1.
  - `/api/engine/spell-choices` re-implements the Eldritch Knight / Arcane Trickster → Wizard rule [DUP].
  - Writes aren't atomic (write a temp file, then rename). [LATENT BUG]
  - No schema validation on save → 3.2.
  - `PATCH /api/homebrew/:section` upserts by name → 3.3.
  - `party_items` auto-links by name on every save → 3.3.
  - `addIndexToFile` renumbers ids, and nothing calls it; `startupScripts` is empty. [CLEANUP]
  - `/api/user_prefs` overwrites the whole file → 3.6.
- **`merge-utils.js`**: **bug 2.12**. `deepEqual` via `JSON.stringify` depends on key order, which gives false conflicts.
- **`update-ids.js`**: positional renumbering → 3.3.
- **`user_prefs.json`**: game state → 3.6.
- **`CLAUDE.md`, `TODO.md`, `TODO_ARCHIVE.md`, `CHARACTER_AUDIT.md`** → 3.9.
- **`.claude/settings.json`**: has Windows-only permission paths. Consider a cloud setup script so `npm ci` runs and `npm run build` works in cloud sessions.
- **`scripts/pre-commit`**: `xargs git add` re-stages the whole file after Prettier, which sweeps unstaged hunks into the commit. [LATENT BUG]
- **`package.json`**: point `test` at `cd engine && node --test`.

### engine/

- **`index.js`**: can't be bundled; the export surface is incomplete → 3.8.
- **`rules/5e/characterStats.js`**:
  - **Bug 2.14**.
  - Ignores `attuned`. Six equipped, un-attuned items still apply bonuses (Ioun Stone of Mastery, The Lexicon, Robe of Stars, Staff of Power, Belt of Giant Strength, Bracers of Swiftness). See Q3.
  - Ignores `active_effects`, conditions and species traits.
  - Accepts unknown `stat_bonuses` keys; `attack`, `speed` and `darkvision` exist in data but nothing reads them → 3.1.
- **`rules/5e/abilityScores.js`**: an alias of `characterStats`; delete it after migrating the callers. [DUP]
- **`rules/5e/armorClass.js`**:
  - **Bug 2.16**.
  - Dual Wielder and Unarmored Defense found by name.
  - The new `unarmoredFormula()` still lets a stored `unarmored_ac_formula` win → 3.2.
  - Shield `+2` is hardcoded.
- **`rules/5e/checks.js`**:
  - **Bug 2.2**.
  - Jack of All Trades found by name and not applied to initiative; Remarkable Athlete missing.
  - Stats are re-resolved on every call.
  - `spellcasting_ability` is a single value, which is wrong for multiclass casters.
  - `adds_ability_to_initiative` (new) is good, but it's a bespoke field → 3.1.
- **`rules/5e/initiative.js`** (new): turn-order rolling and sorting (not the modifier, which stays in `checks.js`). Clean; no duplication.
- **`rules/5e/proficiency.js`**: the stored value is always treated as an override → 3.2.
- **`rules/5e/weaponAttack.js`**: **bugs 2.3, 2.4**. Rage damage table is hardcoded → 3.4. Rage is triggered by the `'Raging'` string → 3.1.
- **`rules/5e/weaponHands.js`** (new): good. Make `gripDie` use it (bug 2.3).
- **`rules/5e/unarmedAttacks.js`**: **bug 2.15**. The Unarmed Fighting check matches by id _or_ name → 3.1.
- **`rules/5e/rest.js`**: **bug 2.9**. Make it per-class hit dice with effective CON.
- **`rules/5e/preparedSpells.js` / `spellcasting.js`**: **bug 2.8**, and they duplicate each other → 3.4 / 3.8.
- **`rules/5e/characterSpells.js`**: **bug 2.6** (Ranger in `FULL_CLASS_LIST_CLASSES`). The six bonus-spell field names → 3.4.
- **`rules/5e/spellLists.js`**: reads `src/data` at runtime → 3.8.
- **`rules/5e/classFeatures.js` + `subclasses.js`**: `resolveFeatureIds` is copy-pasted between them; they use `fs`/`readdirSync` → 3.8.
- **`rules/5e/featureCatalog.js` + `feature-catalog.json`**: a hand-maintained duplicate; now test-guarded (good) → 3.4. Extend the test so every catalog id also has _text_ somewhere.
- **`rules/5e/featureMechanics.js` + `feature-mechanics.json`**, **`itemCatalog.js` + `item-mechanics.json`**: the right direction; converge on one effect schema → 3.1.
- **`rules/5e/diffLevelUp.js`** (about 2,600 lines):
  - About 30 bespoke choice params and about 15 class/subclass branches, plus the new `Fighting Initiate` name check → 3.1.
  - Never writes `hit_die` → bug 2.9.
  - Copies mechanics onto characters → 3.2.
  - Split it into modules.
- **`rules/5e/fall.js`, `hurlSomething.js`, `hurlYourself.js`, `jump.js`, `rules/houseRules.js`**: see Section 7.
- **`rules/5e/levelUp.js`, `dice.js`, `hitPoints.js`, `limitedUse.js`, `calendar.js`, `travel.js`, `weeklyEvents.js`**: clean, pure, tested.
- **`rules/validateCharacter.js`**: `isBonusSpell` reconciles three conventions → 3.4.
- **`rules/npcBuilder.js`**: one of two enemy generators → 3.5.
- **`test/`**: 583 tests. Add regression tests for 2.2–2.4, 2.8, 2.9, 2.14–2.16, and data tests (unique ids in every `published_*.json`, known modifier keys, every character has derivable hit dice).

### src/store, src/mixins, src/AppLayout.vue

- **`store/index.js`** (934 lines, down from 1,187):
  - **Bug 2.1**.
  - Rests now delegate to the engine (good).
  - `markDirty` is still repeated inline about 30 times.
  - Persistence side effects inside mutations → 3.6.
  - Lookups by name → 3.3.
  - Many resource shapes → 3.2.
- **`mixins/pendingCharacterSaves.js`** + **`AppLayout.vue`**: **bug 2.1**. Use a draft slot.

### src/utils

- **`dnd_utils.js`** (976 lines, down from 1,146): mostly engine delegates now. `buildWeaponRows` still filters `partyItems` itself (ignoring `character.items`). [LATENT BUG]
- **`encounter_utils.js`** (2,318 lines) → 3.5 / 3.4.
- **`lookupService.js`**: runtime network lookups of rules text with fuzzy name fallback → 3.4.
- **`dataService.js`**: **bug 2.13**.
- **`character_utils.js`**: hardcoded `GENERA`/`CLASSES` → 3.4.
- **`dnd_helpers.js`**: **dead**. Its imports don't exist and nothing imports it. Delete. [CLEANUP]
- **`jsonIntakeSchemas.js`**: move to the shared `rules/schema/` and reuse it for server-side validation → 3.2.
- **`startingGearCatalog.js`, `shipConfigs.js`** → 3.5 (depends on Q1).
- **About 25 one-function engine wrapper files** → 3.8.

### src/data

- **`characters.json`** → 3.2 / 3.3. Bugs 2.2 (Brick added a new case) and 2.9 (6 characters with no `hit_die`). Homebrew mechanics stored only on characters (Elegant Ward, Hulking Build).
- **`party_items.json`**: now by-reference (good); six un-attuned items still apply bonuses (Q3).
- **`published_features.json`**: **bug 2.11**; prose only → 3.1; inconsistent `category` vocabulary. The new homebrew entries (`hb_hulking_build`, `hb_hurlers_rage`, `hb_fearless`, `hb_elegant_ward`) carry **no** mechanics. Fearless (presumably frightened immunity) has no machine form anywhere.
- **`published_spells.json`**: duplicates fixed in `73dcdc7`; ids are still missing → 3.3.
- **`house_rules.json`**: prose, with the numbers living separately in JS → 3.1.
- **`conditions.js`, `travel_events.js`**: rules content as JS modules → 3.1.
- **`scripts.js`**: a commented-out Node script inside the data folder; delete it. [CLEANUP]

### src/components

- **`LevelUpTool.vue`** (about 4,700 lines): split it into step components; spell-picker duplication → 3.4; `Math.min(20, …)`; `ScrollSelect.vue` (new) is a nice reusable piece.
- **`NewCharacterTool.vue`** (about 3,200 lines): character assembly → 3.5; never sets `hit_die` (bug 2.9); 2 new spell pickers → 3.4; mints ids by max+1 → 3.3.
- **`CharacterSpellbook.vue`**: now uses the engine for counts (good). The uses-counter UI is duplicated with `FeaturePillsPanel`/`WeaponTable` → extract a `UsesCounter.vue`.
- **`ShortRestModal.vue` / `LongRestModal.vue`**: now delegate to `rest.js` (good). Local roll code remains → 3.4.
- **The `Enemy*` duplicate pairs** → 3.7.
- **`Battle.vue` / `CombatContext.vue`**: combat state isn't persisted → 3.6.
- **`ConditionsRow.vue`, `SpellSlotsTracker.vue`, `ClassResourcesPanel.vue`**: transitions still built in the component → 3.5.
- **`FallDamagePanel.vue`** (new, 488 lines): see Section 7.
- **`DmExport.vue`**: hardcoded `http://localhost:3001`. [LATENT BUG]
- **`CharacterInventory.vue`**: the attunement 3-limit rule lives here → 3.5.
- **Ship/vehicle/calendar/travel/map components**: depends on Q1.

---

## 5. Suggested order of work

Each step is a separate PR, so you can review them one at a time.

1. **Quick bug fixes**: 2.2–2.4, 2.6, 2.8, 2.9, 2.11, 2.13–2.16, each with a regression test. Delete the dead files.
2. **Fix the save model**: bug 2.1 (draft slot), 2.12 (merge key safety), atomic writes.
3. **Stable ids everywhere** (3.3), plus a one-time item link instead of linking on every save.
4. **Effect schema + key registry + validator test** (3.1). Move character-only homebrew mechanics onto their rules records.
5. **Single rules store** (3.4).
6. **Character schema v2** (3.2).
7. **Remaining engine actions** (3.5): conditions, slots, `createCharacter`, generic level-up `choices`.
8. **Browser-bundleable engine + one facade** (3.8); persisted combat state (3.6); a unified Combatant (3.7).
9. **Docs/comment diet** (3.9).

---

## 6. Questions for you

1. **What is the Godot game?** A rules/character companion, or a playable game with travel, calendar, ships and encounters? The 2026-10-04 sweep already moved calendar, travel and weekly events into the engine, which suggests "playable game". If so, ships, encounters and conditions should follow.
2. **Is the static `npm run deploy` build still used?** If yes, the engine has to run in the browser (3.8).
3. **Attunement:** should un-attuned items stop granting bonuses (RAW)? Six equipped items are `attuned: false` but still apply bonuses.
4. **Character data migration:** are you OK with a one-time scripted rewrite of `characters.json` (ids, removing derived fields, normalizing skills and saves)?
5. **Ability scores:** should `stat_*` store the _base_ score with history applied (one source of truth), or stay the final number?
6. **Explicit-save exceptions:** besides level-up and new character, are there other flows you want behind a Save button?
7. **Concurrency:** will more than one person or tab ever edit at once?
8. **Hurl Yourself / Hurler's Rage / Fearless / Hulking Build:** do you want these written up as data effects (so any character could be given them), or are they intentionally one-offs that stay as code?

---

## 7. Review of the six commits pushed 2026-10-07

Overall they're good, careful commits. Each engine change is pure, has tests (583 total, all passing), and keeps its UI thin. The main problems repeat patterns from Section 3, and the new data adds a few concrete bugs.

### `5270b59` Engine: Chronurgy Magic subclass, complete the feature catalog, Rage uses

- **Good:** the new `featureCatalogIntegrity.test.js` fails whenever a class or subclass grants an id the catalog can't resolve, so 261 sheet entries no longer show as raw ids. Rage uses now come from `barbarian.json`'s `rages_by_level` through a new `class_table` formula, so the table is the single source.
- **Chronurgy data** (`wizard-chronurgy-magic.json`, mechanics entries): the levels (2/2/6/10/14) and uses all match the published EGtW subclass: Chronal Shift 2/long rest; Momentary Stasis INT mod (minimum 1)/long rest; Arcane Abeyance once per short or long rest; Convergent Future as a reaction. I checked this against my own knowledge; I didn't fetch dnd5e.wikidot.com in this session. Convergent Future's exhaustion cost isn't modeled as a mechanic (text only), which is fine for now.
- **Issues:**
  - The catalog is still a hand-maintained duplicate (3.4). The new test checks names but not that the feature has _text_; extend it.
  - **Rage damage** is still hardcoded in `weaponAttack.rageDamage`, while uses now read the class table. Use `rage_damage_by_level` the same way (3.4).
  - `adds_ability_to_initiative` is another one-off mechanic field (3.1).

### `32be090` Engine: Unarmed Fighting, Rage on unarmed strikes, feature-defined unarmored AC

- **Good:** Unarmed Fighting follows 2014 Tasha's correctly: 1d6 + STR, 1d8 with no weapon or shield, and 1d4 to a grappled creature. Rage on STR unarmed strikes is correct. The Wizard's first-level spellbook is now 6 spells (RAW), and that holds for multiclass pickups too. `recharge: "manual"` is a clean way to model DM-refilled abilities. Barbarian/Monk Unarmored Defense is now inferred from features, so a new Barbarian gets CON in AC without hand-editing.
- **Issues:**
  - Tavern Brawler reads `character.unarmed_strike_die`, which nothing sets → **bug 2.15**.
  - `hasUnarmedFighting` matches by id **or** name, and `unarmoredFormula` matches `'Unarmored Defense'` by name (3.1).
  - A stored `unarmored_ac_formula` still beats the inference, and 20 characters have one stored (3.2).
  - The feature formula and the Monk formula both still add a shield → **bug 2.16** (Monk).
  - Barbarian/Monk multiclass picks Barbarian first; RAW says you keep whichever you gained first. Rare; just noting it.
  - `diffLevelUp` gains another hardcoded name branch (`'Fighting Initiate'`) (3.1).

### `ce2439e` Falling house rule, Hurl Something / Hurl Yourself, and a Fall button on the dice roller

- **Good:** all the logic is in pure engine modules (`fall.js`, `hurlSomething.js`, `hurlYourself.js`, `jump.js`) with an injectable `rng` and thorough tests. Hurl Yourself reuses fall damage and the Landing On Someone rule instead of copying them. The UI panel only renders.
- **Issues:**
  - **The house rule's numbers live in JS, not in `house_rules.json`.** DC 14 + tier, d8/d6, triangular dice, lethal over 60 ft, 5×STR, 1d4 per 8 lb, splash over 40 lb, auto-crit above 20 ft. If the prose is changed, nothing updates the code (3.1). Put the parameters in the house-rule record and have the module read them.
  - `fall.js` is a **campaign house rule** but lives in `rules/5e/` (RAW 5e), while `houseRules.js` sits in `rules/`. Put house rules in their own namespace (`rules/house/`) so "what is RAW" stays obvious, which matters for the Godot port and for your 2014-only rule.
  - Hurl checks feature ids such as `fighting-style-thrown-weapon-fighting`. The same style has other ids (`fighter-fighting-style-…` variants for some styles), and several characters' styles have no id. That's fine for Brick today, but fragile (3.1).
  - `FallDamagePanel.vue` (488 lines) correctly goes through the engine (`rollFall`, `d20Test.rollD20Test`) for every roll.

### `0fc78bc` Level Up character picker scrolls; New Character wizard spellbook

- **Good:** `ScrollSelect.vue` is a reusable component. The Wizard's prepared count comes from the engine's preview (`preparedAfter`), not UI math.
- **Issues:**
  - Two more copies of the checkbox spell-picker (spellbook, prepared) → about 8 copies across the two tools (3.4; already in TODO).
  - `spellbookPickLimit = pendingChoice.count + draftPicks.length` depends on the engine shrinking `count` as picks are made. It works, but it's fragile; have the engine return the total, not the remainder.
  - `isWizard` compares the class name string.
  - The New Character tool still doesn't write `hit_die` → **bug 2.9**.

### `73dcdc7` Campaign data: Elowenne and Brick rebuilt, homebrew features, duplicate spells removed

- **Good:** four duplicate spells removed; Brick's and Elowenne's features carry ids and `level_gained`; Rage/Chronurgy uses match the class tables.
- **Issues:**
  - **Brick:** `"Animal Handling"` with a space → **bug 2.2** (the skill proficiency is silently lost). No `hit_die`, so short rests roll d8 instead of d12/d10 → **bug 2.9**. Tavern Brawler has no working mechanic → **bug 2.15**.
  - **Elowenne:** no `hit_die` (d8 used for a Wizard's d6) → **bug 2.9**. "Caster Prestidigitation" has `id: null`.
  - **Rule mechanics stored only on characters:** Elegant Ward's `unarmored_defense` (Elowenne) and Hulking Build's `+2 STR/+2 CON` (Brick) aren't on their `published_features.json` records. Hurler's Rage and Fearless have no mechanics anywhere (3.1/3.2).
  - Timeline Freeze's `action_type`/`recharge` are now in three places: `feature-mechanics.json`, `published_features.json`, and the character (3.4).
  - Add a test that fails on duplicate ids/names in every `published_*.json`, so the duplicate-spell problem can't come back (2.11 is the same kind of bug, still present).

### `850378b` Docs: TODO and engine checklist for this round

- Fine as a log. `CHECKLIST.md` is now 3,547 lines and keeps growing (3.9). The test-count references in `CLAUDE.md`/`CHECKLIST.md` are stale (583 now).
