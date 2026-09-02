# Rules Engine — Build Checklist

Working log for the standalone `engine/` module (see `engine/package.json` — zero
dependencies, no Vue/Vuex imports anywhere in this folder, meant to be portable to
a future Godot port). If this work gets interrupted, **this file is the resume
point** — check what's ticked, read the "Notes" under the current phase, and
continue from the first unchecked item. Run `node --test` from inside `engine/`
to confirm everything still passes before continuing (125 tests as of this
writing, all green).

## Homebrew monster support — first two creatures, Ravine Stalker + Greyback (2026-09-01)

Not engine work (no `engine/` involvement — Vue + data only), logged here
since this file has been the running session log throughout. Project owner
gave rough flavor for two Fol-native predators; asked for full playable
stat blocks, not just lore text.

- [x] **Real gap found**: monsters had no homebrew path at all, unlike
      spells/features. `monsters_index.json` is a lightweight index only
      (name/CR/type/size/publisher/book — no stat block) sourced from an
      external bulk import (Kobold Press, WotC, etc.); `lookupMonster` in
      `lookupService.js` was 100% live-API, no local-first check the way
      `lookupSpell`/`lookupFeature` already have.
- [x] **New `src/data/published_monsters.json`** — full stat blocks in the
      exact shape dnd5eapi.co's API returns (verified against a live fetch
      of Owlbear and Skeleton for the actions/resistances/vulnerabilities
      field shapes), so they run through the same `normalizeMonster()` a
      real API response would, not a hand-rolled shape.
- [x] **`lookupMonster` now checks `published_monsters.json` locally first**
      (by exact name), same pattern as spells/features, before ever hitting
      the live API.
- [x] **2 lightweight entries added to `monsters_index.json`** (`publisher:
  "Homebrew"`) so they actually show up in `MonsterBrowser.vue`'s
      search/list — that component only ever reads this one file for its
      browsable list.
- [x] **New "Homebrew" filter chip** in `MonsterBrowser.vue` (previously
      would've been lumped into "Other") — added to both `SOURCES` and
      `MAIN_PUBLISHERS` so the "Other" bucket still excludes it correctly.
- [x] **Ravine Stalker** — Large Beast, CR 5. Grab+Crush as actually
      distinct mechanics (Claw grapples on hit, Crush is a follow-up
      bludgeoning attack usable only against something already grappled),
      not just flavor text — matches the "Grab/Crush attack pattern" brief
      literally. Climb speed added (not in the brief, but "coordinated
      drop-ambush from rock faces" doesn't work without one).
- [x] **Greyback** — Large Beast, CR 7 ("elite-tier"). Resistant to cold/
      piercing/slashing (thick hide deflects edged weapons; explicitly NOT
      resistant to bludgeoning or fire, matching "fire/bludgeoning
      effective, edged weapons less effective"), higher HP/AC/damage output
      than the Ravine Stalker to earn "elite" relative to it. Added Snow
      Camouflage (stealth bonus in icy terrain) as a reasonable extrapolation
      from "pale... den in ice caves" — flagged as an addition, not
      something stated outright.
- [x] **Real pre-existing bug found and fixed while verifying live**:
      `MonsterBrowser.vue`'s `formatSpeed()` appended its own " ft" suffix
      to speed values that already include one in the real API shape
      (`"40 ft."`, confirmed against a live fetch) — every monster with
      more than a walk speed (climb/swim/fly/burrow) was rendering "40 ft.
      ft, climb 30 ft. ft". Not specific to the two new monsters — affects
      the whole bestiary, homebrew and SRD alike. `formatSenses()` doesn't
      have the same bug (never appended its own unit).
- [x] Verified live end-to-end: both search, select, and render full stat
      blocks correctly (screenshot-checked), "Homebrew" source filter
      works, zero console errors.

## Siv's real level 1→9 audit found two real bugs (2026-09-01)

Project owner leveled Siv to 9 through the actual tools and asked for a full
accuracy/legality audit. Ability scores, HP, proficiency bonus, subclass
timing, and the rest of her feature list all checked out RAW-correct — but
two things didn't:

- [x] **Fixed: `diffLevelUp.js`'s newFeatures dedup silently ate her level 6
      Expertise.** The dedup matched on feature name alone, so once
      "Expertise" existed on her sheet from level 1, the level-6 grant
      (Rogue gets it twice, RAW) was treated as "already have this" and
      dropped. Same bug would hit Bard (Expertise ×2, Magical Secrets ×3),
      Ranger (Favored Enemy/Natural Explorer improvements), Monk (Unarmored
      Movement scaling) — anything with a repeating feature name. Fixed to
      key on name+level, while still treating a same-named feature with NO
      `level_gained` recorded (older/hand-entered data) as the ambiguous
      "probably this one" case the original dedup was protecting —
      `test/diffLevelUp.test.js`'s existing "Potent Cantrip" test confirmed
      that case still works. New regression test using Rogue's real
      Expertise-at-1-and-6 case.
- [x] **Fixed: `NewCharacterTool.vue` never actually saved saving throw
      proficiencies.** `selectedClass.saving_throw_proficiencies` was
      already being read and shown as info text in the Class tab, just
      never assigned into `characterShell()` — `saving_throws` was
      hardcoded `[]` for every character ever created through this tool.
      One-line fix.
- [x] **Applied both fixes to Siv's saved record** directly (her level-6
      Expertise added with the correct id, `saving_throws: ["dex","int"]`),
      since the underlying character predates today's code fixes.
- [x] **Also fixed while reviewing: Survivalist's own automatic skill
      grant never applied.** RAW text is "gain proficiency in Nature and
      Survival if you don't already have it" — a real effect, not a choice
      — but nothing in the engine models "this feature grants a skill
      proficiency" at all (matching how no feature currently has structured
      grants the way `feats.json` does for feats). Added Nature/Survival to
      Siv's `skill_proficiencies` by hand for now; the general mechanism is
      a real gap, not fixed here.

**Found, not fixed — needs the project owner's input, not a bug fix:**
Siv only has 2 of her expected 4 Rogue class skill proficiencies. Turned out
`NewCharacterTool.vue`'s `selectedSkills` picker is wired ONLY to the
background's skill grant (confirmed: `rogue.json` has no skill-choice data
at all — no class file does) — there is currently no mechanism anywhere for
a class's own "choose N skills from this list" step. This is a real,
systemic gap affecting every character made through the tool, not specific
to Siv or Rogue. Also nothing prompts for which skills get Expertise
(needed at both her level-1 and level-6 grants) — same underlying "no
picker exists for this kind of choice yet" issue. See TODO.md.

## Feature lookup switched from name-based to ID-based (2026-09-01)

Project owner's call, after hitting the "Spellcasting" name collision twice
in one session (Weave Attunement's phases, then Eldritch Knight/Arcane
Trickster): "it's the right way to go... I'm ok to go ahead with that."
Scoped explicitly to **data model now, content later** — every class/
subclass file's `features_by_level` now references features by id, but
writing real descriptions for everything newly discovered to be missing one
stays a separate future task (31 features below are placeholder stubs).

- [x] **Audited all 45 class + subclass files**: 276 unique feature-name
      references total. 146 already had a `published_features.json` entry,
      119 matched the SRD features cache by name (using its own `index` as
      the id — cross-checked against `class` where the SRD cache had
      multiple entries sharing a name, e.g. "Ability Score Improvement" ×63),
      31 had no catalog entry anywhere and got a new stub (real name/class/
      level, `description: null`, `needs_description: true`) — mostly base
      class fundamentals nobody had gotten to yet: every full-caster's own
      "Spellcasting" (Wizard/Sorcerer/Cleric/Druid/Paladin/Ranger — turned
      out to be a FOURTH+ instance of the exact collision that started this),
      Ranger's Favored Enemy/Natural Explorer, Artificer's capstone
      features, Champion's crit-range features.
- [x] **Backfilled a stable `id` onto 206 of 255 `published_features.json`
      entries that didn't have one** — turned out most of the catalog
      predates ids entirely; only entries added this session already had
      them. `pub_<slugified-name>` — safe since this file has zero name
      duplicates (confirmed before generating).
- [x] **New `engine/data/feature-catalog.json`** — flat id→name index (693
      entries: 255 published + every SRD feature), engine-local so `engine/`
      stays self-contained rather than reaching into `src/data` a second
      time (the one existing exception is `spellLists.js`, for spell text
      specifically — documented there).
- [x] **`engine/rules/featureCatalog.js`** — the one function
      (`featureName(id)`) everything else resolves ids through.
- [x] **`classFeatures.js` / `subclasses.js`**: `loadClass`/`loadSubclass`
      transparently resolve `features_by_level` from ids back to names at
      load time — every EXISTING consumer (dozens of tests included) keeps
      seeing exactly the name arrays it always has, zero breakage, **124/124
      tests passed unchanged** on the first run after the full 45-file
      migration. Raw ids kept alongside under a new `features_by_level_ids`
      field for anything that wants them.
- [x] **`levelUp.js` / `diffLevelUp.js`**: `baseFeaturesGained`/
      `subclassFeaturesGained` groups now carry parallel `.ids` alongside
      `.names`; `newFeatures` entries carry `id` alongside `name`. This is
      the actual new capability — a character's `features[]` gains real ids
      for anything leveled up from this point forward (old/existing
      character data stays name-only, not retroactively migrated — see
      scope note above).
- [x] **`lookupService.js`**: `lookupFeature(name, id)` — new optional `id`
      param checked first (exact match, no ambiguity) before falling back to
      the existing name cascade unchanged. `detailPopupBuilders.js` and both
      tools' tooltip loaders now pass `.id` through wherever they have one.
- [x] **`scripts/assign-feature-ids.py`** — the migration script itself,
      kept in the repo as a record and in case new ids are ever needed in
      bulk again; not meant for routine re-running (a newly-added feature
      just gets a real id assigned by hand, matching the `hb_`/`pub_`/SRD-
      index/`gen_` prefix convention already established).
- [x] Verified live end-to-end: `POST /api/engine/preview-level-up` for both
      a base-class feature (Fighter's Action Surge → SRD id
      `action-surge-1-use`) and a subclass one (Eldritch Knight's
      Spellcasting → `hb_fighter_ek_spellcasting`) — both carry `id`
      correctly in the response. Scout's tooltip summary in the Level Up
      tool still shows real text end-to-end through the new id path, zero
      console errors.

**Not done** (explicitly deferred, per the "data model now" scope): writing
real descriptions for the 31 stub entries (`needs_description: true` is the
filter for finding them later); retroactively backfilling ids onto the ~24
existing characters' already-saved `features[]` (only newly-granted features
carry ids going forward — old data works exactly as it did before, just
without the new disambiguation benefit until it's re-granted or hand-edited).

## Third-caster spellcasting: Eldritch Knight + Arcane Trickster (2026-09-01)

The gap flagged when the Rogue subclasses were audited: nothing in this
engine let a SUBCLASS grant spellcasting a base class doesn't have — Fighter
and Rogue both have `spellcasting: {type: 'none'}`, and `spellcasting.js`'s
functions only ever resolved `type` from `loadClass(className)`, never a
subclass. Real engine work, not data entry — see the "Missing Rogue
subclasses" entry below for why this was deferred out of that pass. Verified
feature levels/slot tables against dnd5e.wikidot.com + a second WebSearch
pass each, same as every other subclass this session.

- [x] **New `third_caster_slots` table** in `spellcasting-tables.json` —
      starts at character level 3, caps at 4th-level spells, identical for
      both subclasses. Plus `cantrips_known`/`spells_known` entries keyed by
      **subclass** name (`"Eldritch Knight"`, `"Arcane Trickster"`), not
      class name — Fighter/Rogue have no table of their own to key under.
- [x] **`spellcasting.js` made subclass-aware**: every function
      (`spellSlotsForClassAtLevel`, `cantripsKnownForClass`,
      `spellsKnownForClass`, `preparedSpellCount`) now takes an optional
      trailing `subclassName`, resolved through a new shared
      `resolveSpellcasting(className, subclassName)` — class's own
      spellcasting if it has real spellcasting, else the subclass's, else
      null. Backward compatible: every existing caller that doesn't pass
      `subclassName` behaves exactly as before (124/124 pre-existing tests
      still pass unchanged).
- [x] **`levelUp.js` and `diffLevelUp.js` updated** to resolve and pass
      `subclassName` through everywhere spellcasting gets computed,
      including the multiclass-combination paths (`combinedClasses` arrays
      now carry `subclass` too, so `casterLevelContribution`'s existing
      Eldritch Knight/Arcane Trickster level-÷3 check — which was already
      sitting in `multiclass.js` unused — actually gets exercised).
      `character.spellcasting_ability` (set once at creation, would stay
      null forever for a Fighter/Rogue that later becomes EK/AT) now falls
      back to the resolved class-or-subclass `spellcasting.ability`.
- [x] **New `fighter-eldritch-knight.json` / `rogue-arcane-trickster.json`**
      — `spellcasting: {type: 'third', ability: 'int'}` plus real
      `features_by_level`. Both subclasses have a feature literally named
      "Spellcasting" in the PHB — real collision risk since this project's
      feature lookup is name-based with no class disambiguation (same class
      of problem as the Rogue subclasses' "Spellcasting" would have hit).
      Disambiguated as `"Spellcasting (Eldritch Knight)"` /
      `"Spellcasting (Arcane Trickster)"`, matching the parenthetical
      pattern Weave Attunement's phase features already established.
      Project owner's note: `published_features.json` entries already carry
      an `id` field that nothing actually looks up by — switching the real
      lookup mechanism to ID-based would fix this class of bug properly, but
      it's a genuine refactor (`lookupService.js` + every character's stored
      `features[]` + the UI components that render them), flagged as its
      own future item rather than folded in here.
- [x] **11 new `published_features.json` entries** (2 Spellcasting variants + 5 Eldritch Knight + 4 Arcane Trickster features), same treatment as
      the Rogue subclasses' features — needed for the feature-tooltip work
      to actually show anything for these.
- [x] **New `test/thirdCaster.test.js`** (6 tests) — slot/cantrip/known
      tables match RAW at both ends (level 3 and 20) for both subclasses; a
      mundane subclass (Battle Master/Champion) still gets zero
      slots/cantrips, no leakage; `describeLevelUp` produces real
      `type: 'third'` spellcasting end-to-end; multiclass caster-level
      contribution recognizes both (level ÷ 3, verified at levels 2 and 6).
- [x] **Real regression caught and fixed before landing**: first version of
      `resolveSpellcasting`'s fallback returned the class's own
      `{type: 'none'}` object instead of `null` when a mundane subclass
      (e.g. Champion) had no spellcasting of its own — a _truthy_ object,
      unlike `null`. Both `NewCharacterTool.vue` and `LevelUpTool.vue` gate
      their entire spellcasting UI section on `description.spellcasting`
      being truthy, so this would have shown an empty "Cantrips: 0→0"
      summary for every mundane subclass of every class, not just Fighter —
      caught via a live curl check against `/api/engine/preview-level-up`
      before it ever reached the UI, not by the unit tests (which only
      checked the _values_ stayed zero/empty, not that the object itself
      stayed `null` — a permanent regression test for exactly this now
      exists in `thirdCaster.test.js`). Also hit two rounds of stale dev
      server processes during verification — `npm run serve` runs frontend
      and backend as separate processes on different ports (8080/3001), and
      killing the frontend's port doesn't touch the backend, which is the
      one that actually holds the engine's `require()` cache; had to
      `ps aux | grep node` and kill both explicitly before curl checks
      reflected the real code.

## Level Up tool: removed the "show one-time choices" toggle entirely (2026-09-01)

Direct follow-up to the two entries below — project owner's call: "there is
absolutely no reason that one-time choices during level up should be hidden
... they should all be visible all the time." Fully agreed with in hindsight;
the toggle was the root cause of the original "no way to choose a subclass"
report, and hiding a choice that blocks Confirm outright was never a good
default in the first place.

- [x] **Toggle removed** — `showOneTimeChoices` data field, the chip UI, the
      `resetChoices()`/`runPreview()` wiring around it, all gone. The
      subclass and ASI/feat cards now render unconditionally whenever
      there's something to show (or a "No one-time choices at this level"
      note when there isn't) — no click required to discover them.
- [x] **ASI/feat card given the same sticky-visibility + live-outcome
      treatment the subclass card got** — new `asiChoiceLevel` (mirrors
      `subclassChoiceLevel`), and a right-hand summary column: - **ASI mode**: live ability-score deltas (`STR 12 → 14`), computed
      directly off the current form selection — updates as soon as you
      pick an ability, before clicking Apply, same as the subclass card
      updates as soon as you pick from the dropdown. This level's
      contribution specifically (against `draftCharacter`'s current
      scores), not the cumulative multi-level total. - **Feat mode**: the picked feat's name + description, resolved via
      the same `lookupFeature` service the tooltip work uses — live too,
      via a new watcher on `liveFeatName`, so typing a free-text feat name
      (most feats aren't in the tiny `feats.json` mechanical catalog yet)
      shows its description without clicking Apply first. - Verified live end-to-end: picked DEX for Siv's level-4 ASI, saw
      "DEX 16 → 18" before applying, clicked Apply, card stayed visible
      (previously would have vanished — see below), summary still showed
      the applied result, Confirm Level Up correctly enabled.

## Level Up tool: subclass picker was completely non-functional; added a live summary panel (2026-09-01)

Follow-up to the "Confirm Level Up disabled with no visible reason" fix
above (this same session) — turned out that fix only solved half of it.
The `<select>` for choosing a subclass was bound to `subclassChoiceDraft`
via `v-model` and nothing else touched it anywhere: not sent to the
preview-level-up server call, never written into `draftCharacter`. Picking
"Scout" from the dropdown did literally nothing — `diffLevelUp` reads the
chosen subclass off `character.classes[].subclass` (same field a saved
character carries), not a request parameter, so the preview never knew a
choice had been made. This is why Scout showed no features at all: there
was nothing wrong with the Scout data (see above), the pick just never
reached the engine.

- [x] **`applySubclassChoice()`** — `@change` on the select now writes the
      pick into `draftCharacter.classes[]` (matching entry by
      `selectedClassName`) and re-runs the preview, exactly like
      `submitAsi`/`submitFeat` already did for ASI/feat choices.
- [x] **Live summary panel**, per project owner's request — the choice card
      is now two columns: picker on the left, and on the right,
      `preview.description.subclassFeaturesGained` (already returned by
      `diffLevelUp`, just not read by the UI before) rendered with full
      descriptions inline via the `featureDescriptions` map from the
      tooltip work above. No more tabbing to "③ Feature" to see what a
      subclass grants.
- [x] **Sticky choice-card visibility**: applying the choice makes
      `pendingSubclassChoice` go null (diffLevelUp no longer considers it
      unresolved) — without care, the card (and its title, which reads
      `pendingSubclassChoice.level`) would disappear the instant you picked
      something. New `subclassChoiceLevel` data field captures the level
      once, on first sight of the pending choice, and survives resolution;
      the card now shows while `pendingSubclassChoice || subclassChoiceDraft`.
      **Same latent issue likely exists for the ASI/feat card** (`submitAsi`/
      `submitFeat` probably make `pendingAsiChoice` go null the same way) —
      not fixed here since it needs a different shape (show what was picked,
      not just keep the form open) and wasn't what was reported; flagging
      for a future pass.
- [x] **Real layout bug found and fixed**: this specific state (subclass
      card actually populated with real content) was never reachable before
      the fix above, so a latent bug in `.lut-work`'s flexbox sizing had
      never been exposed. `.lut-root` is a fixed-height flex column with
      `overflow-y: auto`; `.lut-work`'s explicit `min-height: 5rem` overrides
      the browser's automatic "don't shrink below content" floor, so once
      content here got taller than the remaining flex space, it shrank
      below its own content instead of growing and letting `.lut-root`
      scroll — the box would visually overlap the next sibling
      (Stats Block/Spell Slots). Fixed with `flex-shrink: 0`.

## Missing Rogue subclasses: Thief, Scout, Phantom built; Arcane Trickster deliberately deferred (2026-09-01)

Found while fixing Siv's rebuild: only 5 of 9 real Rogue subclasses existed
(Assassin, Inquisitive, Mastermind, Soulknife, Swashbuckler). Built the 3
that are pure data — same `features_by_level` pattern as the existing ones,
each feature name verified against 2 independent sources before writing:

- [x] **`rogue-thief.json`** (PHB) — Fast Hands/Second-Story Work (3),
      Supreme Sneak (9), Use Magic Device (13), Thief's Reflexes (17).
      Descriptions already existed in the SRD spell/feature cache (Thief is
      SRD-legal content) — nothing new needed there.
- [x] **`rogue-scout.json`** (Xanathar's) — Skirmisher/Survivalist (3),
      Superior Mobility (9), Ambush Master (13), Sudden Strike (17). This is
      what Siv's original sheet actually was (`"Scout — Skirmisher"` etc. in
      her old feature list) — now pickable for real via the Level Up tool.
- [x] **`rogue-phantom.json`** (Tasha's) — Whispers of the Dead/Wails from
      the Grave (3), Tokens of the Departed (9), Ghost Walk (13), Death's
      Friend (17).
- [x] **15 new `published_features.json` entries** (5 per subclass, `Rogue
(Scout)` / `Rogue (Phantom)` style class field, real book citations,
      `homebrew: false`) — Scout/Phantom aren't SRD content so the local
      cache had nothing for them; without this the new feature-tooltip work
      (see below) would silently show no tooltip for any of these 10.
- [x] **New `test/rogueSubclasses.test.js`** — all three resolve with
      exactly Rogue's real `subclass_feature_levels` ([3,9,13,17]), and
      cross-checks every feature name against `published_features.json` so
      a typo between the subclass file and the features catalog fails loudly
      instead of silently rendering no tooltip.

**Deliberately NOT built: Arcane Trickster.** It's the 6th real PHB-era
Rogue subclass and the reason it's not just "one more JSON file": it grants
spellcasting, and nothing in this engine currently supports a subclass
granting spellcasting a base class doesn't have.
`engine/rules/spellcasting.js` (`spellSlotsForClassAtLevel`,
`cantripsKnownForClass`, etc.) all resolve `type` from `loadClass(className)`
only — there's no subclass-aware path, and no third-caster (Eldritch
Knight/Arcane Trickster) slot table in `spellcasting-tables.json` either.
Building this properly means: a `third_caster_slots` table (slots start at
level 3, cap at 4th-level spells), a `type: 'third'` branch in
`spellSlotsForClassAtLevel`/`preparedSpellCount`, and a way for a subclass
record to override its base class's `spellcasting: {type: 'none'}` — real
engine work, not data entry, and it'd be the first of its kind here (no
Eldritch Knight file exists yet either, same gap). Flagged as its own item
rather than half-building a "spellcaster" subclass with no spells.

## Feature tooltips in New Character / Level Up tools (2026-09-01)

Project owner asked for the same dotted-underline + hover-tooltip pattern
already used elsewhere (`StatChip.vue`, `SkillList.vue`, etc. — a `.has-tip`
class + native `title` attr) on the feature lists shown while creating or
leveling a character, so what you're about to gain is visible without
alt-tabbing to a wiki.

- [x] **`NewCharacterTool.vue` + `LevelUpTool.vue`**: both `newFeatures`
      lists now resolve each name through the existing `lookupFeature`
      service (local SRD/homebrew catalogs first, traits API fallback for
      racial traits) into a `featureDescriptions` map, async, one lookup per
      unique name (results kept for the component's lifetime rather than
      re-fetched every preview tick).
- [x] **Real bug found and fixed along the way**: the "choose a subclass"
      picker was already fully implemented and working, but sat behind a
      "show one-time choices" toggle that silently reset to OFF on every new
      level, with no hint that anything required was hiding there — "Confirm
      Level Up" was just disabled with a note to "resolve the choices above,"
      pointing at a collapsed section. `runPreview()` now auto-opens that
      panel whenever the level actually has a pending subclass or ASI/feat
      choice. This is very likely why Siv's 2→3 level-up looked like it had
      no way to pick a subclass at all.

## Weave Attunement: made the subclass itself reusable, not just Iyani's sheet (2026-09-01)

Prompted by rebuilding `src/data/api_data_cache/` after it went missing on a
fresh checkout (see below — a separate, larger incident). While auditing what
that touched, checked the open TODO item "finish Weave Attunement past level
9" and found it was based on a misconception: Sorcerous Origins only ever get
features at levels 1/6/14/18 for _any_ subclass (official or homebrew) — there
is no level 9-14 gap to fill. `engine/data/subclasses/sorcerer-weave-attunement.json`
already had all four correctly, and every feature's full mechanical text
(Weave Empowerment, Unraveling included) was already committed in
`src/data/published_features.json`. Iyani's own sheet also already audits
100% RAW-correct at her actual level (9) — verified known-spell count (10),
cantrip count (5, Sacred Flame/Light correctly excluded as feature-granted),
spell slots, Metamagic count (2, correct pre-level-10) all against the
engine's real tables. Nothing was actually broken.

What _was_ missing, once the actual ask became "make this subclass playable
by a brand-new character, not just readable off Iyani's sheet": the 15-spell
Weave Phase grid (5 spells × Leno/Twill/Satin) only ever existed as
`spells_granted` arrays on Iyani's own character features — there was no
subclass-level version a new character could start from. Fixed:

- [x] **New `weave_grid` field** on the subclass file, following the same
      convention `warlock-great-old-one.json`'s `expanded_spell_list` already
      established (subclass-level data, not yet read by any engine rule —
      there for a future New Character/level-up UI to consume). Populated
      with Iyani's actual picks as the default, since they were already
      built spell-by-spell against real school data rather than guessed.
      Each phase also lists its `schools` pair explicitly.
- [x] **New `house_rules` field** — the grid-substitution rule ("any spell of
      the correct level from the phase's two schools"), promoted from prose
      in `_notes` into its own structured field, matching the recovered
      pre-migration homebrew.json design notes' own `house_rules` array shape.
- [x] **New third test in `test/weaveAttunement.test.js`** (alongside the two
      already there) — verifies every one of the 15 `weave_grid` spells
      actually resolves via `findSpellRecord`, is
      genuinely the right spell level, and genuinely belongs to one of its
      phase's two schools. Caught nothing wrong (Iyani's picks were already
      correct — including "Rary's Telepathic Bond" resolving to the SRD's
      "Telepathic Bond", same spell) — but a real regression catcher going
      forward now that this is reusable, not just descriptive.
- [x] **Fixed a latent schema bug this surfaced**: the SRD spell cache's
      `school` field needs to be a plain string (`"Abjuration"`), not the raw
      dnd5eapi.co API's `{index, name, url}` object — `WeavePhaseGrid.vue`'s
      spell-swap picker and `SpellBrowser.vue` both compare `s.school`
      directly with no `.name` unwrapping, matching `published_spells.json`'s
      already-flat convention. The now-deleted original cache must have been
      normalized this way already; the rebuild script (see below) didn't do
      that at first and would have silently broken the swap picker for every
      SRD-sourced grid spell. Fixed in `scripts/build-srd-cache.js` alongside
      the same treatment `classes`/`subclasses` already got.

**Not done, and deliberately not guessed at:** the other ~380 SRD species
entries the old cache apparently had (vs. the 13 real dnd5eapi.co races +
subraces the rebuild produced) — project owner confirmed 380 is way more than
should exist and it'll get sorted out once their other hard drive (which may
have the original files) is back online. Also Dhovari (a 4th homebrew
"species" in the pre-migration data) is lore-only, not a playable species —
confirmed with the project owner rather than inventing mechanics for it.

## `src/data/api_data_cache/` went missing — recovered and un-gitignored (2026-08-31/09-01)

On a fresh run, `npm run serve` failed outright — webpack couldn't resolve
`@/data/api_data_cache/*.json` at all. Root cause: that whole directory was
gitignored (treated as a disposable "fetched on demand" cache) despite real
code statically/dynamically importing it at build time — a "cache" the app
can't actually run without isn't a cache, it's undeclared load-bearing data.
Worse: the 2026-08-27 `homebrew.json`→`species.json` migration commit
(`6edef04`) moved the project's 4 homebrew species into that same gitignored
file, so that commit is where they left version control entirely — a real
example of the fragility, not just a hypothetical one.

- [x] **New `scripts/build-srd-cache.js`** — rebuilds `features.json`,
      `srd_spells_full.json` + 8 per-class spell lists, and `species.json`
      from dnd5eapi.co, in the exact flat schemas each consumer already
      expects (see the schema note above).
- [x] **Recovered Catrin/Drevani/Hei'ugar** (full lore/traits/speed/languages)
      from `homebrew.json` at commit `ce5a64f`, the last commit before it was
      deleted — genuinely complete, not reconstructed/guessed. Dhovari
      intentionally left out (lore-only, not playable — see above).
- [x] **`.gitignore`**: removed the `api_data_cache/` exclusion. Per the
      project owner: moving away from live API dependency generally, using
      APIs only for real gaps — everything the app needs should be a
      committed local copy, not something that can silently vanish.
- [ ] **Not yet committed** — project owner wants their other hard drive
      (possibly holding the pre-loss files, including whatever the real
      ~380-entry species set was) reconnected first, to diff/merge against
      before anything here gets committed.

## Curated backgrounds + skill picker (2026-08-27)

The New Character tool's Background tab used to be a free-text field against
the raw `api_data_cache/backgrounds.json` cache (405 entries, no skill data at
all) with a note saying "add skills manually" — but nowhere to actually do
that. Fixed both problems:

- [x] **New `engine/data/backgrounds.json`** — a curated 40 real backgrounds,
      each a clean fixed 2-skill grant. Verified against a real reference
      table (a dndbeyond-sourced skill/source list fetched via WebSearch), not
      trusted from memory alone — memory alone had already misattributed two
      of these (Anthropologist/Archaeologist) to the wrong sourcebook before
      the fetch caught it. `engine/rules/backgrounds.js` (`listBackgrounds`,
      `loadBackground`). Deliberately excludes backgrounds whose RAW skill
      list involves a player choice (Cloistered Scholar, Faction Agent, etc.)
      rather than picking an arbitrary default.
- [x] **New `engine/data/skills.json` + `engine/rules/skills.js`** — the real
      18 5e skills, each with its governing ability score.
- [x] **New server endpoints**: `GET /api/engine/backgrounds`,
      `GET /api/engine/skills`.
- [x] **Real skill-proficiency picker** in `NewCharacterTool.vue` — a
      background pick from the curated 40 pre-fills two skill dropdowns
      (still overridable), or "Other (custom)" for a freeform name with
      skills picked manually. `backgrounds.json`'s raw ~360-unique-name SRD
      cache is no longer used by this tool at all.
- [ ] Deferred: the ~320 other unique backgrounds beyond this curated 40 (see
      `TODO.md` — expand the curated list over time as specific ones come up,
      rather than trying to cover everything at once).
- [x] **Added "Born Adventurer"** — a 41st, deliberately homebrew background
      (`homebrew: true`, empty `skill_proficiencies`, `free_choice: {count:2}`)
      letting the player pick ANY two skills freely, since no real background
      does that (every published one has a fixed or narrowly-choice-limited
      list). Checked first whether RAW excludes any skill from background
      grants — it doesn't: a real-data tally across ~150 published background
      instances shows every one of the 18 skills appears at least a handful
      of times (Medicine rarest at 9, Athletics/Persuasion/Insight most
      common at 26) — so the free choice isn't restricted either.

## New Character tool (2026-08-26)

Built `src/components/NewCharacterTool.vue` — a real level-1 character creator,
alongside the Level Up tool, both under the Tools context. No subclass step
(deferred to a later level-up, same as any class reaching its own
`subclass_choice_level`).

- [x] **Level-1 HP is always max hit die, not rolled/averaged** (RAW).
      `hpGainForLevel` (`progression.js`) takes an optional `level` param;
      `describeLevelUp` passes it through and labels the `hp[]` entry
      `method: 'max'` at level 1 regardless of what was requested.
- [x] **`diffLevelUp` needed no changes** to support a from-scratch
      0→1 level-up — it already works once given a character shell with
      `classes: [{ name, level: 0 }]`. Verified against a real end-to-end
      preview-level-up call (Half-Elf Cleric, point-buy stats): correct HP
      (max d8 + CON mod), correct level-1 slots/cantrips, correct new
      features, correctly flags the subclass choice as a `pendingChoice`
      rather than blocking.
- [x] **New `engine/rules/pointBuy.js`** — standard 5e point buy (27 points,
      8-15, real cost table), tested (`test/pointBuy.test.js`).
- [x] **New `engine/rules/species.js` + `engine/data/species.json`** — the 9
      standard PHB species with real, hand-authored ability score
      bonuses/speed/darkvision (no external data source needed — this is
      stable, well-known content). Homebrew species (Catrin, Drevani,
      Hei'ugar, Dhovari) are NOT duplicated here — `GET /api/engine/species`
      (server.js) merges this with the homebrew entries already living in
      `src/data/api_data_cache/species.json` (which already carry their own
      `ability_score_bonus`/`traits`/`speed`, added when homebrew.json was
      split up — see above). The other ~380 SRD entries in that cache are
      pure flavor text with no mechanical fields and are deliberately
      excluded. Tested (`test/species.test.js`), including the flexible
      "+1 to two abilities of your choice" pattern (Half-Elf).
- [x] **New server endpoints**: `GET /api/engine/classes` (full class records,
      not just names — the tool needs `spellcasting.ability` to build a
      character shell), `GET /api/engine/species` (above).
- [x] **Shared save/revert extracted from the Level-Up work** —
      `src/mixins/pendingCharacterSaves.js` (the `pendingCharacterNames` /
      `revertCharacter` / `saveOnlyCharacter` / `saveChanges` logic, unchanged
      in behavior) + `src/components/PendingCharacterSaveBar.vue` (the UI),
      used by both tools now. One real fix made in the extraction:
      `revertCharacter` used to no-op when a character has no matching row in
      `originals` (fine for an edited existing character, silently wrong for
      a brand-new never-saved one) — now removes the row via a new
      `REMOVE_CHARACTER` mutation instead. New characters use a new
      `ADD_CHARACTER` mutation (doesn't mark `characters` dirty, same
      reasoning as `APPLY_LEVEL_UP` — no autosave for either).
- [ ] Deferred (see `TODO.md`): real racial/background mechanical data beyond
      the 9+4 species covered, starting-equipment automation, "plan all
      levels ahead" preview toggle.

## ✅ `homebrew.json` reorganization — DONE 2026-08-26

`homebrew.json` (114KB, 216 features + spells + races + rules + weapon_types +
languages all mixed together, growing indefinitely) is now **deleted**.
Content moved to live alongside its RAW counterpart, per project owner's
principle: "things that are actually just non-SRD content should not [be]
marked homebrew... ideally will have what book they came from." Only content
with no real-world basis gets `homebrew: true`; everything else gets a real
`source` book citation instead.

- `spells` → merged into `published_spells.json` (4 entries, all flagged `homebrew: true`)
- `features` (216) → new `published_features.json`. Classified: **25 flagged
  `homebrew: true`**, **132 given a real book citation** (mostly already had
  correct content, just needed the actual book name — Xanathar's/Tasha's/PHB/
  Bigby's/SCAG — instead of an abbreviation or a bare "(Subclass) — level"
  note), **50 already had one**, **9 left `needs_review: true`** rather than
  guessed at (5 orphaned/unused entries — Totemic Assault, Life Bearer,
  Totemic Blessing, Spirit Communion, Sacred Focus: Mind; 2 that look
  item-flavor-text-misfiled-as-features — Dagger of Swift Strike, Grandmaster's
  Stitch; and 2 tied to a real, separate bug found along the way — see below).
- `races` (4) → merged into `api_data_cache/species.json`, flagged `homebrew: true`.
- `rules` (7 house rules) → new `house_rules.json` (no RAW counterpart makes
  sense for these — they modify RAW, so they get their own file).
- `weapon_types` + `languages` (2 + 1, no existing counterpart file of the
  right shape) → new `weapon_types_and_languages.json`.
- `domain_spells` and the `subclasses` design-notes array → **deleted, not
  migrated** — confirmed nothing reads either live, and both are already
  superseded by tested `engine/data/subclasses/*.json` files (the Weave
  Attunement design notes were absorbed into that subclass file's `_notes`
  first — see below, this is where the 14th/18th-level gap was found).

**Found a real bug while merging races: `HomebrewBrowser.vue` statically
importing `species.json` bundled the entire ~1.7MB SRD species cache into the
main `app.js`** (confirmed nothing had ever imported that file client-side
before — it grew the bundle from ~3.5MB to ~5.2MB). Fixed with a dynamic
`import()` so Webpack code-splits it into its own lazy-loaded chunk instead.

**Code touched:** `server.js` (PATCH `/api/homebrew/:section` now writes to
`published_spells.json`/`published_features.json`; GET `/api/homebrew`
returns both combined, moved to before the generic `/api/:table` route so it
isn't shadowed — that route doesn't call `next()`, so registration order
matters); `lookupService.js` (dropped the now-redundant separate homebrew
check in both `lookupSpell`/`lookupFeature` — one fewer resolution tier);
`HomebrewBrowser.vue`, `dnd_utils.js`, `SpellBrowser.vue` (repointed imports,
`SpellBrowser.vue`'s SRD/Published/Homebrew filter now splits
`published_spells.json` by its own `homebrew` flag instead of reading two
files); `dataService.js` + `store/index.js` (removed `homebrew` from the
generic table load/save lists — confirmed `store.state.homebrew` was never
read anywhere, purely dead wiring); `engine/rules/spellLists.js` (dropped the
homebrew.json read, `published_spells.json` already has everything).

**While auditing Revven's actual features for a book citation, found a
separate real bug, unrelated to the reorg:** he has both `"Blessed Strikes"`
and `"Divine Strike"` as separate active features — these are the same
mechanic under its 2024 and 2014 names respectively, not two different
things. Also `"Tempest Cleric — Thunderbolt Strike"` doesn't match any real
feature name (verified real Tempest Domain 6th-level feature is "Thunderous
Strike") — likely a typo. Both left as `needs_review: true`, not silently
fixed, since removing one of two active features is a build decision.

## ✅ RESOLVED 2026-08-26 — Ferghus + Torrin, recovered from git history

Both of the open questions below turned out to be recoverable, not actually
gone — the project owner reacted (rightly) to the apparent data loss, which
prompted digging through `git log -p` on `characters.json` instead of
accepting "it's gone" at face value. **Lesson applied going forward: an
automated "does a catalog entry exist for this name" check is not the same
as "does it have real content" — one entry here was a literal placeholder
(`"Details not fully specified — confirm with DM."`) that had been sitting
unresolved since an earlier session, and my own earlier audits treated
existence as sufficient. Added an automated placeholder-stub detector to the
verification script for this reason (see the resolution-check snippets
throughout this file) so this can't quietly happen again.**

- **Torrin ("Soulknife / Mastermind") — was actually fine.** Confirmed by the
  project owner: Torrin is an intentionally "legendary," rarely-appearing
  character built with **all** benefits of **both** real Rogue subclasses at
  once (his own `notes` field already said exactly this — nothing was lost
  here). What WAS genuinely incomplete: he was missing 4 of the real
  RAW features from those two subclasses at his effective level (12) —
  Soulknife's Psychic Whispers and Soul Blades (9th), Mastermind's Master of
  Intrigue and Insightful Manipulator (9th). Added all four, verified via
  WebFetch against dnd5e.wikidot.com, with new `data/subclasses/rogue-
soulknife.json` and `data/subclasses/rogue-mastermind.json` (complete
  through 17th level, for reuse by any future character — Torrin's own data
  intentionally stops at what a level-12 character would have).
- **Ferghus's Oath of the Open Road — recovered, not lost.** Git history
  (`git log -p -- src/data/characters.json`) found the exact commit
  (`b0798271`, 2026-04-23, "updates to character sheet and data schema for
  weapons and ac") that shortened a whole batch of characters' feature
  _names_ from `"X - <mechanical text>"` down to just `"X"`, apparently as
  part of a move toward looking descriptions up from a shared catalog — but
  no catalog entry was ever created for "Vow of the Open Road" specifically,
  so the mechanical text went from "ugly but present" to "gone" instead of
  "properly homed." Recovered text: **Vow of the Open Road** — Channel
  Divinity, action, WIS save or the target is compelled to move in an
  unexpected direction (fitting his deity, Carix, god of mischief and
  unexpected consequences — also recovered from his own `notes` field, which
  mostly survived unlike the mechanic). **Sacred Weapon** turned out to
  already have correct real text in `homebrew.json` from an earlier session
  — false alarm on that one specifically. Built
  `data/subclasses/paladin-oath-of-the-open-road.json`. This is NOT the same
  as the one official-sounding third-party "Oath of the Open Road" (a
  Patreon subclass) found via search — that one uses entirely different
  feature names. This is the project owner's own custom oath, now correctly
  cataloged instead of guessed-at.

## ~~NEW OPEN QUESTION — Siv's subclass doesn't exist~~ RESOLVED 2026-08-25

Siv (`Fighter`/`subclass: "Scout"`) had a subclass that doesn't exist — Scout
is really a Rogue archetype. Concept was "highly mobile, highly accurate,
long range capable, sometimes stealthy archer, no sneak attack." Decided:
**Battle Master** (fully mundane, maneuvers map onto the concept directly —
Precision Attack for accuracy, Evasive Footwork for mobility — vs. Arcane
Archer, the other real Fighter archer subclass, which is explicitly magical
and doesn't fit an otherwise-mundane concept). Not yet applied to her actual
data — logged in TODO.md as her own rebuild task (change `subclass` field,
then pick real maneuvers and verify the rest of her sheet), same as Jaygar's.

## Spell readiness states (for the future spellbook UI color-coding pass —

## logged in TODO.md, not built yet)

Full enumeration, since "how many states are there" came up directly:
cantrip (always ready); prepared/known spell with a slot available (ready);
prepared/known spell with no matching slot (not ready); known but not yet
prepared, for prepared-casters only (not ready — different reason than
slot-blocked); always-prepared bonus spell (oath/domain/patron/Divine-Magic-
style) with a slot available (ready) or without one (not ready); feat-granted
spell with its once-per-long-rest free cast still available (ready, no slot
needed) vs. already used (falls back to needing a real slot, ready or not
depending on that); item-granted spell with charges available (ready) vs.
depleted/item not attuned-or-equipped (not ready); a ritual-tagged spell cast
as a ritual (ready regardless of slots, but costs 10 extra minutes — more of a
tooltip/secondary indicator than its own color). Recommendation when this gets
built: a 3-tier READY / NOT READY / ALWAYS-READY color axis as the primary
signal (matches "I want to quickly see what's castable"), with SOURCE (class /
bonus / feat / item) as a small secondary badge or icon rather than its own
color — crossing source × readiness would be ~12 combinations, more than
needed.

## ⚠️ OPEN QUESTIONS — need project owner input, do not guess

- ~~Chuknora's saves/starting-class ambiguity.~~ **RESOLVED 2026-08-25** —
  project owner confirmed Paladin as her starting class (class features like
  Unarmored Defense are gained per level-in-class regardless of start order,
  only proficiencies/saves are start-order-restricted, so Paladin-first gives
  her the better proficiency set while keeping Barbarian's features intact).
  Tagged `started: true` on her Paladin entry. Her extra saves (str/con from
  Barbarian) were left as-is — not RAW-strict, but the project owner chose not
  to strip them, only asked for the spell slot fixed.
  ~~Chuknora's extra spell slot.~~ **FIXED** — corrected `spell_slots.level_1`
  from 3 to 2, matching `multiclassSpellSlots` exactly.
- **Jaygar (Artificer 9) has no normal spellbook at all** — `spells` was a
  completely missing key (not even an empty array) until this session, when
  Misty Step + Command were added for his Fey Touched feat specifically. His
  actual Artificer known/prepared spell list — everything beyond the feat
  grant — still doesn't exist anywhere in his data. Needs the same kind of
  from-scratch build Rith/Enauweyn/Therynv'l got earlier this project, not
  something to invent unprompted.
- **Revven has a spell called "Fast Friends" that doesn't resolve anywhere**
  — not in `srd_spells_full.json`, `published_spells.json`, or
  `homebrew.json`. Either a homebrew spell that was never added to any
  catalog, or a typo/misremembering of a real spell name. Needs the project
  owner to say what it's supposed to be.

**Data-cleanliness rule (project owner, 2026-08-25): we don't write dirty data
with a note — we write clean data.** When a character's spell list has an entry
that isn't a normal class-granted known/prepared pick, it must be tagged
`featureGranted: true, _source: "<exact feat/feature/subclass-feature name>"` —
the same pattern already used for Rith's Fey Touched spells. And the _feat or
feature itself_ must have a matching structured `grants_spells` entry somewhere
in `engine/data/` (`feats.json`, or a subclass's own file) so the tag can be
verified against real RAW, not just trusted blindly. Spell-slot/cantrip/known-
spell tables here are progression RULES (how many a class of level N is
entitled to) — they are NOT duplicates of `published_spells.json` /
`srd_spells_full.json` / `api_data_cache/*_spells.json`, which hold spell TEXT.
Same relational split as classes.json (rules) vs. characters.json (instances).

**Current priority (per project owner, 2026-08-25): audit feats/features for
what they mechanically GRANT (spells first — that's the active pain point),
not prepared-spell-cap or cantrip-cap overages — those are explicitly
deprioritized/ignored for now.**

Scope decision (per project owner): build for the 13 base classes and the ~24
subclasses actually in use on the current roster (see `TODO.md` for the full
subclass list). Do not attempt full 5e/all-sourcebook coverage — new subclasses
get added in small batches as new characters need them.

Rules used unless a character's data says otherwise: 2014 core rules (PHB
Ranger, not the Tasha's revised Ranger variant), Artificer from Tasha's/Eberron.

---

## Phase 0 — Infrastructure ✅ DONE

- [x] `engine/` folder scaffold, isolated `package.json`, `index.js` barrel
- [x] `data/leveling.json` — proficiency bonus table, ASI levels (+ Fighter/Rogue
      overrides), hit dice by class
- [x] `rules/abilities.js`, `rules/progression.js` + passing tests
      (`abilityModifier`, `proficiencyBonus`, `isAsiLevel`, `hitDieForClass`)

## Phase 1 — Base class data ✅ DONE

- [x] Verified Ranger spells-known table and Artificer cantrips/slots table via
      WebFetch against dnd5e.wikidot.com (2026-08-25) — Artificer cantrip
      breakpoints were **wrong in my first memory-only guess** (assumed 1/6/10,
      actually 1/10/14) — corrected before writing the data file
- [x] `data/classes/<class>.json` x13, all built and verified against
      dnd5e.wikidot.com class tables: Barbarian, Bard, Cleric, Druid, Fighter,
      Monk, Paladin, Ranger, Rogue, Sorcerer, Warlock, Wizard, Artificer
- [x] `data/spellcasting-tables.json` — full/half/pact/artificer slot tables,
      cantrips-known breakpoints, spells-known tables (Bard/Sorcerer/Warlock/
      Ranger), Artificer infusions table, Mystic Arcanum levels
- [x] `rules/spellcasting.js`, `rules/classFeatures.js` + 21 passing tests,
      cross-checked against **real roster data**: Rith/Therynv'l (Druid 9,
      full-caster slots), Enauweyn (Paladin 9, half-caster slots — matched
      characters.json exactly), Jaygar (Artificer 9, matched exactly)
- [x] Found and fixed a real bug during testing: `preparedSpellCount` conflated
      slot-progression type (full/half/pact) with known-vs-prepared style, so
      Bard (a full-caster that's still a _known_-spell class) incorrectly got
      a prepared-count formula. Fixed by checking `spellsKnownForClass` first.

## Phase 2 — Subclass data (only the subclasses currently on the roster)

Each subclass: `data/subclasses/<class>-<slug>.json` with `class`, `name`,
`features_by_level` (name strings only, same rule as Phase 1).

Done, verified against dnd5e.wikidot.com (feature levels also cross-checked
against the base class's own `subclass_feature_levels`):

- [x] Paladin — Oath of the Crown (matches Enauweyn's real feature list exactly)
- [x] Druid — Circle of the Moon
- [x] Wizard — Abjuration
- [x] Sorcerer — Divine Soul
- [x] Paladin — Oath of the Ancients (matches Chuknora's actual feature list;
      her Oath Spells — Ensnaring Strike/Speak with Animals at 3rd — already
      correctly tagged `domain: true` in her data, pre-dating this session)
- [x] Fighter — Battle Master, Champion, Echo Knight
- [x] Barbarian — Berserker, Path of the Giant
- [x] Rogue — Assassin
- [x] Cleric — Life Domain, Tempest Domain (Tempest's domain-spell table
      verified against Revven's actual 10-spell list — matches exactly)
- [x] Warlock — Great Old One (file is named/keyed "Great Old One", NOT "The
      Great Old One" — matches how the roster's own `subclass` field is
      written; the slug-based file lookup silently returns null on a mismatch
      here, so this one's easy to get wrong again if extended later)
- [x] Ranger — Gloom Stalker

While building this batch, found and fixed **a real duplicate + several stale
cross-references in `homebrew.json`** — not just missing content:

- A second, redundant "Metamagic Adept" entry existed from _before_ this
  session (using an older `category`-based schema instead of `type`), making
  the one added earlier THIS session unreachable dead data (`.find()` only
  ever returns the first match). Removed the old one.
- Two more full generations of near-duplicate Abjuration Wizard entries
  existed ("Abjuration Wizard — Arcane Ward" plus a second "...(18HP max)"
  variant, both baking a character-specific computed HP value into the
  _name_ itself — bad practice, since Arcane Ward's HP scales with level).
  Replaced both with clean canonical names (`Arcane Ward`, `Projected Ward`,
  etc.) and renamed Lyria's actual feature entries to match, rather than
  leaving three names for the same feature.
- Ran a full duplicate-name sweep afterward (194 entries, 194 unique) to
  confirm nothing else was silently shadowed the same way.

Also done in the next round (all 24 subclasses on the roster now built, except
the two genuinely blocked ones — see OPEN QUESTIONS above):

- [x] Rogue — Inquisitive, Swashbuckler
- [x] Artificer — Artillerist. **Found and fixed a real bug while building
      this one**: `data/classes/artificer.json`'s `subclass_feature_levels`
      was wrong from Phase 1 — had `[3, 5, 9, 13, 17]`, verified-correct value
      is `[3, 5, 9, 15]` (no 13th/17th-level subclass slot at all). Caught
      because Fortified Position (verified 15th level) didn't line up.
- [x] Wizard — Evocation, Bladesinger (file/name is `Bladesinger`, matching
      the roster's own subclass string — NOT "Bladesinging", the more common
      web spelling)
- [x] Bard — College of Lore, College of Spirits
- [x] Druid — Circle of Stars (roster spells it without "the" — matches
      `data/subclasses/druid-circle-of-stars.json`)
- [x] Sorcerer — Weave Attunement (homebrew, fully self-described already on
      Iyani's own character sheet — organized into level slots, nothing
      invented; Mother's Whim's own text states its level explicitly)
- [ ] Rogue — Soulknife/Mastermind (Torrin) and Paladin — Oath of the Open
      Road (Ferghus) — see OPEN QUESTIONS, both genuinely blocked, not
      hallucinated around

Added a permanent regression test (`test/subclassesRound3.test.js`) that
checks every subclass file's slug matches `slugify(class, name)` — this is
the second time a filename/name-field mismatch caused `loadSubclass` to
silently return `null` (first was Great Old One, second was Bladesinger),
so it's now caught automatically instead of relying on re-discovering it.

- [ ] "Ranger — Scout" was on this list originally but is WRONG — see the new
      OPEN QUESTION at the top of this file. Scout is a real subclass, just
      not of Ranger (or Fighter, which is what Siv's data actually says)

## Phase 3 — Feats/features "what does this grant" audit (CURRENT PRIORITY)

Reframed 2026-08-25: not just flavor text — every feat/feature that grants a
spell (or other mechanical effect code needs to reason about) gets a
structured entry in `engine/data/feats.json` (feats) or the owning subclass's
own file (`grants_spells`, subclass bonus mechanics), verified against real
RAW before writing. The character's own spell entry then just points at it via
`featureGranted: true, _source: "<name>"` — the grant's _rules_ live on the
feat/feature, not re-described per character.

Done so far (both proven against real roster data, not hypothetical):

- [x] `data/feats.json` — **Fey Touched** (fixed: Misty Step; choice: one 1st-
      level Divination/Enchantment spell) — verified via WebSearch. Matches
      Rith's actual Silvery Barbs + Misty Step tags exactly.
- [x] `data/subclasses/sorcerer-divine-soul.json` — Divine Magic's two-part
      rule (pick any normal known spell from the Cleric list instead of
      Sorcerer's; separately, one FIXED bonus spell by chosen affinity that
      never counts) — verified via WebFetch. Rith's affinity is Law → Bless,
      confirmed by matching an untagged spell already in his list.
- [x] Fixed Rith's characters.json entry: tagged his Bless as
      `featureGranted: true, _source: "Divine Magic (Law affinity)"` — this
      was the one piece of genuinely dirty data in his sheet, now clean.
      `validateCharacter` now shows 0 known-spell-count issues for him.
- [x] `data/feats.json` — **Shadow Touched** (fixed: Invisibility; choice: one
      1st-level Illusion/Necromancy spell) — verified via WebSearch.
- [x] `homebrew.json` features — **Metamagic Adept** (Tasha's: 2 sorcerer
      Metamagic options usable by any spellcaster + 2 dedicated sorcery
      points) — verified via WebSearch. This one wasn't just a missing-content
      gap — see the `lookupService.js` bug fix below.
- [x] Synced three characters' spell lists to match what their OWN feature
      entries already documented (the grant info existed, it just hadn't been
      propagated into `spells[]` — found by checking `spells_granted`/`note`
      on each feat's own feature object before assuming anything needed
      inventing):
  - Jaygar (Fey Touched): added Misty Step + Command
  - Denna (Shadow Touched): added Invisibility + Inflict Wounds
  - Revven (Fey Touched): added Misty Step + Comprehend Languages (his
    "Fey Touched" feature already had a `note` naming the choice spell)
- [x] **Found and fixed a real app bug while doing this**, not just a content
      gap: `lookupFeature()` in `src/utils/lookupService.js` checked the SRD
      cache's fuzzy (startsWith) match BEFORE homebrew's exact match, so
      "Metamagic Adept" resolved to the SRD's generic "Metamagic" _class
      feature_ text instead of its own homebrew entry (`"Metamagic
Adept".startsWith("Metamagic")` + the boundary-guard regex both passed).
      Reordered so exact matches — from either source — always beat fuzzy
      ones. Bumped `CACHE_VERSION` to `v4` so any browser that already cached
      the wrong resolution picks up the fix (same category of bug as the
      earlier Detect Magic/Enauweyn cache issue).
- [x] Chuknora: added her missing **Unarmored Defense** (automatic Barbarian
      1st-level feature, no player choice involved — safe to add outright,
      unlike everything in the OPEN QUESTIONS section above).
- [ ] **Latent landmine, not yet active:** the SRD cache has two DIFFERENT
      class features both literally named "Unarmored Defense" (Barbarian:
      DEX+CON; Monk: DEX+WIS) with no class-aware disambiguation in the
      lookup — it just returns whichever happens to be first in the array
      (currently Barbarian). No Monk exists on the roster yet, so nothing is
      broken today, but the first Monk character added will need this fixed
      (lookup needs to know which class is asking, not just match by name).

Not yet audited — every other feat/feature that appears on the roster needs
the same treatment before it can be trusted as clean. Start by re-running the
`featureGranted`/`_source` grep below after each addition to track what's
actually been structured vs. what's still just prose:

```
node -e "const c=require('./src/data/characters.json'); for (const ch of c) for (const s of (ch.spells||[])) if (s.featureGranted||s._source) console.log(ch.name,'->',s.name,'|',s._source)"
```

- [ ] Remaining feats on the roster with no spell grant (don't need
      `grants_spells` structure, but worth a pass to confirm nothing else
      needs code-visible modeling): Sentinel, Great Weapon Master, War
      Caster, Inspiring Leader, Observant, Mobile, Bountiful Luck, Slasher,
      Elven Accuracy, Resilient — all already have real prose text in
      `homebrew.json`, this is just about whether any of them need
      structured (non-prose) grants beyond what's there
- [ ] Racial spellcasting traits that grant spells (Aasimar's Light cantrip,
      Tiefling's Infernal Legacy — already described in `homebrew.json` prose,
      needs a structured `grants_spells` counterpart)
- [ ] Homebrew subclass-flavor grants (Iyani's "Loom Fire" — grants Sacred
      Flame free of cantrip count; Weave Attunement subclass more broadly)
- [ ] `data/races/*.json` — lower priority, user has said background/carrying
      capacity etc. don't matter for this app; only build if a race's
      mechanical grant needs modeling (most just need the spell-grant pattern
      above, not a full race file)

## Phase 1.5 — Class spell list membership ✅ DONE (2026-08-25)

Different from Phase 1's slot/known-count tables — this is "is spell X even
allowed on class Y's list at all," needed so a Wizard can't scribe/learn a
scroll that isn't a Wizard spell.

- [x] `rules/spellLists.js` — `isSpellOnClassList(className, spellName)`,
      `findSpellRecord(spellName)`. Deliberately reaches OUTSIDE `engine/data`
      into `src/data/api_data_cache/srd_spells_full.json` +
      `src/data/published_spells.json` + `src/data/homebrew.json` (spells)
      rather than copying spell text into `engine/` — that data already exists
      once in this repo (each spell record's own `classes` field), and copying
      it would just create a second copy to drift. This is the one place in
      `engine/` that reaches outside its own `data/` folder — worth knowing
      before extracting `engine/` wholesale to another project later.
- [x] Found and fixed a real gap while building this: **none of the 4
      homebrew.json spells had a `classes` field at all.** Added them: "Undead
      Ward" → `["Wizard"]` (Abjuration, "a wizard's own spellbook creation" —
      fits Lyria's line). "Starfall" / "Smite From Afar" / "The Stones Agree"
      → `classes: [], item_only: true` (each is exclusively granted by a
      specific item — Ring of the Fallen Star / Cold Valley Axe / the two
      Stones — not a spell any class can normally learn or scribe).

## Phase 6 — Multiclassing (project owner, 2026-08-25: "we do a lot of

## multiclassing... we will need the level up tool and the validator to be

## able to handle it" — this is required, not a nice-to-have)

- [x] `rules/multiclass.js` — `multiclassCasterLevel`, `multiclassSpellSlots`,
      `multiclassPactSlots`. Implements the real PHB combined-caster-level
      rule: full casters (Bard/Cleric/Druid/Sorcerer/Wizard) count in full;
      Paladin/Ranger count half rounded DOWN (only at 2+ levels); **Artificer
      is the one exception — rounds UP**; Fighter/Rogue only contribute via
      Eldritch Knight/Arcane Trickster at 3+ levels (currently unused on the
      roster, implemented anyway since it's cheap and correct); Warlock never
      contributes — Pact Magic stays fully separate always. Verified against
      Kerra (Fighter Champion 4 / Warlock 5): correctly resolves to zero normal
      slots + pact magic only, matching real 5e (Champion isn't a spellcasting
      subclass, so she has nothing from the Fighter side at all).
- [x] Saving-throw proficiencies fix: added an explicit `started: true` marker
      to the correct entry in `classes[]` for the roster's unambiguous
      multiclass cases — **Kerra (Warlock)**, confirmed by her saves (wis/cha)
      AND her own `notes` field ("Target build: 4 Fighter / 8 Warlock" — she's
      building toward Warlock as the dominant class); **Elucyne (Ranger)**,
      confirmed by her saves (str/dex, distinct from Rogue's dex/int and
      Fighter's str/con); **Eldi (Fighter)**, confirmed by his saves matching
      Fighter's (str/con) exactly. `validateCharacter` now checks saving
      throws against whichever class is marked `started` for multiclass
      characters, instead of skipping the check outright or guessing from
      array order (which is NOT reliable — Kerra lists Fighter first despite
      starting Warlock).
- [ ] **Chuknora is NOT resolved — see the OPEN QUESTION at the top of this
      file.** No confident guess was made; her data was left untouched.
- [x] `data/multiclass-proficiencies.json` + `expectedProficienciesForCharacter`
      — verified via WebFetch against 5thsrd.org (PHB Multiclassing
      Proficiencies table). Starting class gets its full normal armor/weapon
      list (from `data/classes/<class>.json`); every class taken later via
      multiclassing only gets the REDUCED list here (e.g. multiclassing into
      Fighter never grants heavy armor, only light/medium/shields — that's
      only available if Fighter was the starting class). This is the same
      "starting class matters" pattern as saving throws, applied to a second
      thing it affects — prompted directly by the project owner asking "are
      any other things dependent upon that choice?" **Artificer's multiclass
      proficiency grant is NOT verified yet** (not in the original PHB table)
      — don't trust it until checked against Tasha's own text.
- [x] **2026-08-26**: `validateCharacter`'s known-spell-cap check now loops
      over EVERY class on the character, not just `classes[0]` — fixes the
      case of a known-caster class that isn't listed first (nothing on the
      current roster hit this, but it was a latent bug). A character with
      exactly one known-spell-cap class (the common case, including a caster
      multiclassed with non-caster classes like Elucyne's Ranger/Rogue/
      Fighter) is checked fully. **Still not done:** a character with TWO OR
      MORE known-spell-cap classes at once (e.g. a real Bard/Sorcerer
      multiclass) genuinely has two separate pools under RAW, but
      `character.spells` entries aren't tagged with which class granted
      them, so the pools can't be split — this case is now flagged as an
      `info` issue explaining why, instead of silently checked wrong.
      **New real finding surfaced by this fix**: Kerra (Fighter 4/Warlock 5)
      was never checked before today (her primary class, Fighter, isn't a
      caster, so the old classes[0]-only check skipped her entirely) — she's
      now flagged at 7 spells known vs. a level-5 Warlock's cap of 6. Not
      fixed here — which spell to cut/retag is a player decision.
- [ ] `expectedProficienciesForCharacter` isn't wired into `validateCharacter`
      yet — needs a `started: true`-tagged character to test against for
      real, and skill proficiencies (Bard/Ranger/Rogue's "one skill of your
      choice" multiclass grant) aren't modeled at all, just armor/weapons
- [x] **2026-09-01: picking up a brand-new class is now fully supported**,
      both engine and UI — the actual gap this whole phase was tracking
      ("a UI path to add a new class distinct from leveling an existing
      one").
  - `data/multiclass-prerequisites.json` (new) — PHB p.163 "Multiclassing
    Prerequisites" table, verified via 2 independent WebSearch passes.
    `all_of`/`any_of` semantics (Fighter's STR-or-DEX is the only `any_of`
    case). Artificer added too (not in the PHB, verified against Tasha's
    own multiclassing text).
  - `rules/multiclass.js` — new `meetsMulticlassPrerequisites(className,
scores)`.
  - **`rules/diffLevelUp.js` now handles a genuine pickup**: `className`
    not already on `character.classes` (`classIndex === -1`) starts the
    new class at level 0 and runs the exact same feature/HP/spellcasting
    machinery as leveling an existing class, via a synthesized
    `classEntry`. Pickup-specific additions: the prerequisite check above
    surfaces as a soft warning (not a hard block — matches
    `validateCharacter`'s general philosophy), and
    `data/multiclass-proficiencies.json`'s REDUCED armor/weapon list gets
    unioned into the patch (Artificer's previously-unverified entry was
    fixed in the same pass — light/medium/shields, no weapons, thieves'/
    tinker's tools, verified against Tasha's own text). Skill/tool grants
    the reduced list also owes aren't structurally modeled anywhere yet
    (same gap noted above) — surfaced as a warning string telling the
    player to add it by hand, not guessed at or silently dropped.
  - **`rules/levelUp.js`**: new `isCharactersFirstLevelEver` param
    (default `true`) on `describeLevelUp` — the "1st level HP is always
    max" RAW rule applies once per CHARACTER, not once per class.
    `diffLevelUp` passes `false` whenever the character already has other
    classes, so a multiclass pickup's level 1 correctly rolls/averages HP
    like any other level instead of getting free max HP a second time.
  - **The subclass-at-level-1 problem**: Cleric/Sorcerer/Warlock all
    choose a subclass on their very first level, which is exactly the
    level being picked up here — but `describeLevelUp` only ever reads
    the subclass off `character.classes[].subclass`, and a pickup-in-
    progress has no entry there yet to write it onto. Fixed by letting a
    **level-0 entry** in `character.classes` act as a UI-owned placeholder
    for a subclass draft made before the pickup is confirmed;
    `diffLevelUp` treats a found level-0 entry exactly like no entry at
    all (still a genuine pickup — no real saved character ever has a
    level-0 class), and folds its drafted subclass into the final patch
    entry rather than leaving a duplicate. Covered by a dedicated test
    (Cleric pickup with Life Domain drafted via the placeholder).
  - **UI**: `src/components/LevelUpTool.vue` — added a second class
    selector ("+ Multiclass into…") listing every class from
    `/api/engine/classes` the selected character doesn't already have,
    alongside (not replacing) the existing "level up a class already on
    the sheet" selector. `applySubclassChoice` now creates the level-0
    placeholder described above when the class being chosen isn't in
    `draftCharacter.classes` yet. No server changes were needed —
    `POST /api/engine/preview-level-up` already passed `className`
    straight through to `diffLevelUp`, which now understands pickups on
    its own. Verified against the real HTTP endpoint (server + engine,
    not just unit tests) with a Fighter 5 picking up Cleric 1 and
    drafting Life Domain through the placeholder: single clean Cleric
    entry at level 1 with the right subclass, non-max average HP, correct
    Cleric level-1 + Disciple of Life features, reduced armor
    proficiencies, a real 1st-level spell slot, zero pending choices, zero
    warnings.
  - `engine/test/diffLevelUp.test.js`: 8 new tests (real patch on pickup;
    HP never forced max at pickup; reduced proficiency list + no new
    saving throw; prerequisite warning surfaces but doesn't block; no
    warning when met; Fighter's `any_of` case; skill/tool grant notes;
    level-0 placeholder subclass draft). Full suite: 133/133 passing.

## Phase 4 — Validation / derivation layer

- [x] `rules/validateCharacter.js` — reproduces the Lyria audit as code.
      **Prepared-spell-cap and cantrip-cap checks are deliberately NOT
      implemented right now** (deprioritized 2026-08-25 — see note at top of
      this file). Known-spell-cap check (Bard/Sorcerer/Warlock/Ranger) IS
      active, and now correctly excludes anything tagged `featureGranted:
true` (general) as well as the older `oath`/`domain`/`patron`/`racial`
      type conventions. **2026-08-26: now checks every class on the
      character, not just the primary one** (see the dated note below) — the
      saving-throw check uses the `started: true` marker on multiclass
      characters (Phase 6) instead of skipping outright, falling back to
      skipping with an info-level note when no class is marked `started`
      (e.g. Chuknora). Multiclass spell-slot math (`rules/multiclass.js`,
      Phase 6) still isn't wired into a slot-overage check here — only the
      known-spell-COUNT cap is checked, not whether slots themselves are
      being tracked correctly.
- [x] `rules/grants.js` — `loadFeat(name)`, `isFeatGrantedSpell(featName,
spellName)` — cross-checks a character's `featureGranted`/`_source` tag
      against the feat's actual catalog entry, so a mistagged spell can be
      caught later instead of silently trusted.
- [x] `rules/levelUp.js` — `describeLevelUp({className, subclassName,
fromLevel, toLevel, abilityModifierAtLevel, otherClasses, hpMethod,
hpRolls})` — returns features gained, ASI/feat levels crossed,
      subclass-choice-needed flag, HP gained per level, and before/after
      spell slots + cantrips + known-or-prepared count. This is the function
      the future UI wizard calls one level at a time.
- [x] **2026-08-26: HP roll-vs-average** — `progression.js` `hpGainForLevel
(className, method, rolledValue)`. Per project owner: doesn't need to be
      tracked/audited, just offered as a choice each level, defaulting to
      `'roll'` (not the safer `'average'`) — `'average'` is always
      `floor(hitDie/2)+1`; `'roll'` accepts an already-rolled value (e.g.
      physical dice) or generates one itself if none is given. Wired into
      `describeLevelUp`'s new `hp` array (one entry per level crossed,
      hit-die portion only — **CON modifier per level is the caller's job**,
      this function doesn't know a character's ability scores).
- [x] **2026-08-26: ASI vs. feat choice** — new `rules/asiFeat.js`:
      `resolveAsiOrFeat(scores, resolution)` where resolution is either
      `{type:'asi', increases:{str:1,dex:1}}` (validates total is exactly
      +2, each ability +1 or +2) or `{type:'feat', featName, abilityChoice?}`
      (applies the ability bump ONLY for feats in `data/feats.json` that
      declare one — e.g. Fey Touched's INT/WIS/CHA choice; an uncatalogued
      feat returns a note instead of crashing or guessing, same "flag don't
      guess" pattern as everywhere else in this file). All increases cap at
      20 (standard 5e cap; Epic Boons out of scope), noting when they do.
- [x] **2026-08-26: real multiclass spell-slot bug fix, found while wiring
      this in** — `multiclass.js`'s `multiclassSpellSlots` was (correctly,
      per the checklist note above) never actually called by anything yet,
      which is exactly how this slipped through 70 passing tests: when only
      ONE of a character's classes actually contributes to spellcasting
      (e.g. Elucyne's Ranger 5/Rogue 2/Fighter 2 — Rogue/Fighter aren't
      casters here), the old code ran that one class through the COMBINED
      multiclass formula (`floor(5/2)=2` → `full_caster_slots[2]` → `[3]`
      slots) instead of using its own single-class table (`half_caster_slots
[5]` → `[4,2]`, the real answer). Per RAW, the combined-table formula only
      applies once two or more classes are genuinely combining — one caster
      among several classes just uses its own table, full stop. Fixed by
      special-casing "exactly one contributor" to defer to
      `spellSlotsForClassAtLevel` directly; verified against Elucyne's real
      roster data (test: `levelUpChoices.test.js`). Now wired into
      `describeLevelUp` via an `otherClasses` param.
- [x] **2026-08-26: Warlock pact slots were never actually computed** in
      `describeLevelUp` — `slotsBefore`/`slotsAfter` were hardcoded `null`
      for `type === 'pact'` and nothing filled in the real numbers. Added
      `pactSlotsBefore`/`pactSlotsAfter` via `pactMagicForLevel`, which
      already existed in `spellcasting.js` but was never called from here.
- [x] **2026-08-26: the "what changed" diff — `rules/diffLevelUp.js`**,
      `diffLevelUp(character, {className, toLevel, hpMethod, hpRolls,
asiOrFeatResolutions})`. The adapter (like `validateCharacter.js`) that
      finally compares `describeLevelUp`'s isolated computation against a
      REAL character record and produces an apply-able `patch` object —
      `level`, `proficiency_bonus`, `hp_max`/`hp_current`, `hit_dice_current`,
      the leveled class's entry, `stat_*` ability scores (only if an ASI/feat
      resolution was supplied for a crossed level), `features` (new ones
      only — de-duplicated by name against what the character already has,
      omitted entirely from the patch if there's nothing new), and either
      `spell_slots` (multiclass-aware, reuses the 2026-08-26 fix above) or
      `pact_magic` depending on the class's spellcasting type. Returns
      `pendingChoices` for anything it can't resolve itself instead of
      guessing — an ASI/feat level with no resolution supplied, a subclass
      choice needed, or new known-spell picks owed — plus `warnings` (e.g.
      an ability score that got capped at 20) and the raw `description` for
      full transparency. Pure — doesn't mutate the character or write
      anything to disk; a future UI is responsible for showing
      `pendingChoices` to the player and actually saving `patch`. Only
      levels up a class the character already has — picking up a brand-new
      class via multiclassing isn't supported yet (returns a clear warning).
      Tested against synthetic fixtures AND a real roster smoke test (Lenn,
      single-classed Wizard 9→10).
- [ ] Still not done: applying the patch back to `characters.json` (or a UI
      that calls this at all) — this function is the missing piece, but
      nothing wires it up yet. This is now the ONLY remaining blocker before
      a real level-up-and-save UI flow is possible; see Phase 5.

### Roster sweep findings — ran validateCharacter against every character on

### 2026-08-25. Prepared/cantrip numbers below are informational only now

### (those checks are off) — kept for whenever that work picks back up:

- Kessara: 24 prepared spells vs. a cap of 14 (not previously flagged, unlike
  Lyria who was already manually trimmed) — **not currently checked**
- Kerra (Fighter 4 / Warlock 5): the "missing both saving throws" finding was
  **my validator's bug, not her data** — she's multiclass, and RAW only grants
  saving-throw proficiencies from your _first_ class. **Resolved** — tagged
  `started: true` on Warlock (Phase 6), validator now checks correctly.
- Rith: **resolved** — see Phase 3 above.
- Chuknora: **new finding, unresolved — see the OPEN QUESTION at the top of
  this file.**
- Lexica, Sorra, Iyani, Tackett, Elucyne: cantrip/known-spell overages —
  **not currently checked** (deprioritized) other than the known-spell-cap
  check, which still runs for Lexica/Sorra (Bard) and would need the same
  "what actually grants this" treatment as Rith got before trusting the number.
- **2026-08-26**: Kerra (Fighter 4/Warlock 5) — three real findings, none
  fixed here, all needing a project-owner decision:
  1. **`started: true` corrected from Warlock to Fighter.** Confirmed by the
     project owner ("definitely a fighter first before going warlock" — also
     matches her own notes field, "Target build: 4 Fighter / 8 Warlock").
     This immediately surfaced a genuine, previously-hidden inconsistency:
     her recorded `saving_throws` are `["wis","cha"]` (Warlock's), but RAW
     only ever grants saving-throw proficiencies from your FIRST class — a
     Fighter start should show str/con. Now flagged by `validateCharacter`
     instead of hidden. Not corrected — could mean her saves were entered
     wrong, or this is a deliberate deviation nobody documented.
  2. **Real `isBonusSpell` misclassification bug found and fixed**: `type:
"patron"` (Warlock Otherworldly Patron expanded spell list) was in
     `BONUS_SPELL_TYPES` alongside genuinely-free Paladin oath/Cleric domain
     spells. That's wrong — RAW explicitly says oath/domain spells "don't
     count against the number of spells you can prepare," but a Warlock's
     expanded list just adds spells to the pool you can CHOOSE a known spell
     from; picking one still spends a normal known-spell slot. Removed
     `patron` from the exempt set. This changed Kerra's real known-spell
     count from "7 vs. a cap of 6" to the true **13 vs. a cap of 6** — she'd
     picked all 6 of Great Old One's level 1-3 expanded-list spells
     (Dissonant Whispers, Tasha's Hideous Laughter, Detect Thoughts,
     Phantasmal Force, Clairvoyance, Sending) on top of 7 normally-chosen
     spells, none of which are actually free.
  3. **No ASI/feat entries at all in her `features`**, despite having
     crossed 2 ASI-eligible levels (Fighter's own level 4, Warlock's own
     level 4 — `asiLevelsForClass` tracks these per-class, correctly,
     since ASI eligibility is per-class-level under real multiclassing
     rules). Her STR 20 is consistent with an ASI having been spent there,
     but this can't be confirmed from the data alone without knowing her
     starting array — flagged for the project owner to confirm, not guessed.

## Homebrew subclass features added directly to `data/subclasses/*.json`

- **2026-08-26: Wild Symbiosis** (Circle of the Moon, homebrew, 8th level) —
  table house rule: while in Wild Shape, retain numerical bonuses (not other
  effects) from equipped magic gear made of natural/organic materials (see
  `src/data/materials.json` for the new "Vixivirite" living-mineral material
  this references). Full text lives in both
  `data/subclasses/druid-circle-of-the-moon.json` (engine model, under
  `homebrew_features`) and `src/data/published_features.json` (on-sheet
  catalog, `homebrew: true`) — same dual-model pattern as everything else
  post-reorg. **Required a real engine fix, not just a data add**: level 8
  isn't one of Druid's real `subclass_feature_levels` ([2,6,10,14]), so
  `describeLevelUp`'s subclass-feature loop was gated on that list and would
  have silently never surfaced this. Changed the gate to be purely
  data-driven from the subclass file itself (any level it defines a feature
  for is now checked, not just the class's official schedule) — see
  `levelUp.js`. `test/subclasses.test.js` still guards every OTHER level
  against an accidental typo via an explicit allowlist of known intentional
  exceptions, so this doesn't weaken that safety net for anything else.

## Phase 5 — Not started, not scoped yet

- [ ] Any actual UI (Vue components) — explicitly deferred, this whole
      checklist is engine-only
- [ ] API boundary / how Vue calls into this — deferred per the "decide it
      when it matters" call made earlier in the conversation that started
      this file
