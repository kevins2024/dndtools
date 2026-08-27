# Rules Engine — Build Checklist

Working log for the standalone `engine/` module (see `engine/package.json` — zero
dependencies, no Vue/Vuex imports anywhere in this folder, meant to be portable to
a future Godot port). If this work gets interrupted, **this file is the resume
point** — check what's ticked, read the "Notes" under the current phase, and
continue from the first unchecked item. Run `node --test` from inside `engine/`
to confirm everything still passes before continuing (115 tests as of this
writing, all green).

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
