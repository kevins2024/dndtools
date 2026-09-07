# Rules Engine — Build Checklist

Working log for the standalone `engine/` module (see `engine/package.json` — zero
dependencies, no Vue/Vuex imports anywhere in this folder, meant to be portable to
a future Godot port). If this work gets interrupted, **this file is the resume
point** — check what's ticked, read the "Notes" under the current phase, and
continue from the first unchecked item. Run `node --test` from inside `engine/`
to confirm everything still passes before continuing (179 tests as of this
writing, all green).

## `diffLevelUp.js`: real multiclass skill-proficiency picker (2026-09-07)

Level Up tool audit finding #9 (see `TODO.md`) — the PHB "Multiclassing
Proficiencies" table's skill grant (real for Bard/Ranger/Rogue, always
"choose 1 from the class's own list") only ever surfaced as a warning
telling the player to add it by hand. The old comment justifying this was
stale: it claimed "no class has a real skill/tool LIST anywhere in
engine/data," but `skill_choices.options` was added to every class file
during the New Character tool's own skill-picker build-out (see that
entry elsewhere in this file) — the multiclass code path just never got
updated to use it.

Added a new `multiclassSkillChoice` param (a skill id, e.g. `"stealth"`) —
on an actual pickup, resolves via `engine/rules/skills.js`'s `loadSkill`
(new import), validated against the class's own `skill_choices.options`
(`'any'` for Bard, a fixed array for Ranger/Rogue) via `loadClass`.
Unresolved → a real `multiclassSkillChoice` pendingChoice (`{count,
className}`) instead of a warning, matching every other choice type in
this file. An invalid skill id gets a warning and is re-offered as a
pendingChoice (doesn't silently apply or crash); a skill the character
already has gets a no-op note rather than wasting the pick or duplicating
the proficiency. Resolved into `patch.skill_proficiencies`, deduped
against the character's existing list.

**Tools deliberately NOT touched** — unlike skills, this app has no
`tool_proficiencies` field anywhere on the character schema at all (not
just for multiclassing; a starting class's own tool grants, e.g. Rogue's
thieves' tools, aren't tracked either). Building a real picker here would
mean inventing a new schema field used nowhere else in the app — a
bigger, separate decision than this multiclass-specific gap. Left as the
existing warning-note behavior.

New `engine/test/multiclassSkillChoice.test.js` (7 tests): unresolved
choice is a real pendingChoice not a warning; a valid choice resolves and
adds the real display name while preserving existing proficiencies; an
invalid skill (not on the class's own list) is rejected with a warning and
re-offered; an already-known skill is a no-op note, not wasted or
duplicated; Bard's `'any'` option set allows any real skill; a class with
no skill grant in the table (Fighter) never produces the pendingChoice;
and leveling an _existing_ class never offers this choice even if that
class would grant one on a fresh pickup. Also updated one pre-existing
test in `diffLevelUp.test.js` that asserted the OLD warning-only behavior
for Rogue's skill grant — it now asserts the pendingChoice instead (the
tool grant assertion is unchanged, since tools weren't touched).

New "Multiclass Skill Proficiency" card in `LevelUpTool.vue`, reusing
`allClasses` (already fetched, includes `skill_choices`) and a newly
fetched `skillsCatalog` (`GET /api/engine/skills`, same catalog the New
Character tool's picker uses) — no new server route needed, both already
existed. `cd engine && node --test` 213/213 (206 before this session's
spell-swap/spellbook-growth work plus 7 more here), `npm run build` clean.

## `diffLevelUp.js`: added the known-spell swap and Wizard spellbook growth mechanics (2026-09-06)

Found during a full Level Up tool audit (project owner wants to start
relying on the tool for real characters) — see `TODO.md`'s "Level Up tool
audit" entry for the complete list of findings; these two were the
mechanically-missing ones the project owner asked to fix immediately.

**Known-spell swap** (PHB: "when you gain a level in this class, you can
choose one of the spells you know and replace it with another spell...")
applies to every known-style caster — the same style==='known' set
`spellsKnownForClass` already identifies (Bard, Sorcerer, Warlock, Ranger,
Eldritch Knight, Arcane Trickster). Nothing modeled this at all before now
— not even a documented "deliberate cut" the way re-picking an Eldritch
Invocation on a later level is (see the multiclassing/invocations section
below). Added as a new `spellSwap: {from, to} | null` option on
`diffLevelUp()`. Deliberately NOT a `pendingChoice` — every other
`*Choices`/`*Resolution` param in this function becomes a pendingChoice
when unresolved and blocks `canConfirm` in the UI, but a swap is genuinely
optional per RAW (a player may simply decline it any given level), so it's
applied if present and silently skipped if not, same spirit as this file's
existing tolerance for an unrecognized Pact Boon name. An invalid `from`
(not actually a known spell) gets a warning, not a thrown error, matching
the rest of the file's error-tolerant style. Implementation note: the
removal has to happen on the BASE list `patch.spells` is built from (a new
`spellSwapRemoval` variable, applied via a `baseSpells` filter right before
the existing `extraGrantedSpells` merge) — the existing merge logic only
ever appended, so a straight reuse would have left the old spell sitting
there alongside the new one instead of replacing it.

**Wizard spellbook growth** (PHB: "whenever you gain a level in this class,
you can add two wizard spells to your spellbook") is a flat `2 ×
levelsGained`, entirely independent of any known-spell cap — Wizard is a
`prepared`-style caster with no known-spell limit at all, so the existing
`newKnownSpells` pendingChoice (gated on `style === 'known'`) never covered
it and silently showed nothing. Added as its own `spellbookChoices`/
`spellbookAdditions` pendingChoice path, Wizard-only (checked via
`classEntry.name`, not spellcasting style, since it's specific to the one
class). Critical difference from every other spell-grant path in this
function: added as `prepared: false`, not `true` — spellbook contents
still need to be prepared like any other Wizard spell before they're
castable, unlike a known-caster's known-spell pick (always-available) or a
cantrip pick (also always-available).

Both new params (`spellSwap`, `spellbookChoices`) threaded through
`server.js`'s `POST /api/engine/preview-level-up` route, and surfaced in
`LevelUpTool.vue`: a new non-blocking "Optional — Swap a Known Spell" card
(shown whenever `description.spellcasting.style === 'known'` and the
character already knows a leveled spell for that class — a "give up"
dropdown, then a searchable "learn instead" list fetched via a new
`spellSwapToOptions` array, reusing the exact same `/api/engine/
spell-choices` eligibility endpoint the mandatory known-spell picker
already uses) and a new "Add to Spellbook" card for Wizard, structurally
identical to the existing "New Spells Known" card (checkbox list + search,
capped at the pendingChoice's count).

New `engine/test/spellSwapAndSpellbook.test.js` (10 tests): swap applies
correctly and composes with an unrelated same-level known-spell pick,
rejects an invalid "from" with a warning rather than crashing, is a true
no-op when omitted (never a pendingChoice, never touches `patch.spells`),
and is correctly never offered to a prepared-style caster; spellbook
growth resolves fully/partially, scales with multiple levels crossed in
one call, adds spells as `prepared: false`, and is never offered to a
non-Wizard class. `cd engine && node --test` 206/206 (196 before this
session's Ranger/Sorcerer/Warlock stub work plus these 10), `npm run
build` clean.

**Still open** (see `TODO.md` for the full list, not duplicated here): the
shared `getBonusSpells` utility (`spellUtils.js`) only reads Artificer's
`expanded_spell_list` field — Cleric/Paladin/Druid/Sorcerer's own
domain/oath/circle/psionic/clockwork spell-by-level fields aren't read by
it at all, so leveling into a new spell tier for those subclasses shows
nothing in the Level Up tool and (near as traced) doesn't auto-surface on
the live Spellbook either. Bigger than this pass — flagged as its own
follow-up, not folded in here.

## Standardized naming convention for subclass "known options" tables (2026-09-04)

Partway through the per-class stub build-out (Fighter/Monk done, Barbarian
in progress), noticed the "learn more options as you level" mechanics —
Psi Warrior's Psionic Energy dice, Kensei's known weapons, Rune Knight's
known runes, Four Elements' known disciplines, Arcane Archer's known Arcane
Shots — had each picked up a bespoke field name
(`arcane_shot_known_by_level`, `runes_known_by_level`,
`kensei_weapons_known_by_level`, `elemental_disciplines_known_by_level`).
Same shape every time (`{level: count}`), different name every time —
real duplication risk as more classes hit the same pattern (Barbarian's
Totem Warrior, Storm Herald, Path of the Beast all have it too). Fixed
before it multiplied further:

- **`known_count_by_level`**: `{level: count}` — how many options from
  `option_catalog` are known/chosen at each tier. Used by any subclass
  with a growing "learn N more" mechanic.
- **`option_catalog`**: the real catalog of choosable options — a flat
  array of `published_features.json` ids when there's one choice-point
  (Kensei's runes... wait, Rune Knight's runes; Four Elements' disciplines;
  Arcane Archer's shots; Barbarian's Wild Magic table), or an object of
  named arrays when a subclass has multiple genuinely distinct choice
  points at different tiers (Totem Warrior: `totem_spirit` at 3rd,
  `aspect_of_the_beast` at 6th, `totemic_attunement` at 14th — each a
  fresh "choose 1 of N" with different real options, not a growing count).
- Resource-die-size tables (`psionic_energy_die_by_level`,
  `martial_arts_die_by_level`, `sneak_attack_dice_by_level`, etc.) are left
  as their own descriptively-named fields — a die SIZE progression is a
  different concept from a known-OPTION-COUNT progression, and this naming
  pattern already existed at the base-class level before this session
  (`ki_points_by_level`, `unarmored_movement_bonus_by_level`,
  `channel_divinity_uses_by_level`, `destroy_undead_cr_by_level`), so it's
  already consistent — nothing to fix there.

Retrofitted the 4 subclasses built before this convention existed
(`fighter-rune-knight.json`, `fighter-arcane-archer.json`,
`monk-way-of-the-kensei.json`, `monk-way-of-the-four-elements.json`) to
match. Nothing in `engine/` or `src/` consumes these fields yet (no
LevelUpTool UI reads them — they're forward-looking data for whenever that
UI gets built), so this was a zero-risk rename, not a breaking migration.
Going forward, every new subclass with this pattern uses these two field
names, full stop — no new bespoke names.

## Barbarian: all 7 stub Primal Paths built out to full 3/6/10/14 progressions (2026-09-04)

Fourth class in the per-class pass. 2 real characters (Rhuna/Berserker,
Chuknora/Path of the Giant) already on complete subclasses — no regression
risk. Base class table checked out on inspection.

4 parallel research passes covered Ancestral Guardian (XGE), Battlerager
(SCAG), Beast (TCE), Storm Herald (SCAG), Totem Warrior (PHB), Zealot
(XGE), Wild Magic (TCE). Real corrections found in the existing 3rd-level
stubs:

- **Ancestral Protectors** — "half damage" corrected to the real
  "resistance to the damage" (not numerically identical against a
  resistant creature), removed an invented 5ft-proximity condition.
- **Battlerager Armor** — real RAW needs no proficiency with the spiked
  armor and works against ANY target within 5ft, not specifically a
  grappler; was also missing a real bonus-damage-on-successful-grapple
  clause entirely.
- **Form of the Beast** — Bite's healing was wrongly "temp HP on first
  bite each rage" (real: HP regain once per turn, only while below half
  HP); Claws' extra attack is part of the Attack action, not a bonus
  action. Split into 3 catalog entries (`form_of_the_beast_option`).
- **Storm Aura** — source book was mislabeled (XGE, real: SCAG — same
  mislabel pattern as Sun Soul/Oath of the Ancients earlier this session).
  Replaced a vague "sears/pushes/chills" summary with the real per-level
  damage/temp-HP scaling (3rd/5th/10th/15th/20th). Split into 3 catalog
  entries (`storm_aura_option`).
- **Magic Awareness** — action cost was wrong (bonus action, real: action)
  and so was the use limit (once per short/long rest, real: proficiency
  bonus per long rest). Wild Surge's trigger was also wrong ("first rage
  per combat," real: every time you rage).
- **Divine Fury** — text was already accurate but bundled two real,
  separately-named 3rd-level features (Divine Fury + Warrior of the Gods)
  into one entry; split them.
- **Totem Spirit** — confirmed Spirit Seeker is a real, separate 3rd-level
  feature granted alongside it. Built out all three animal-choice tiers as
  their own catalog entries: Totem Spirit (3 options, 3rd), Aspect of the
  Beast (5 options — Bear/Eagle/Wolf/Elk/Tiger, 6th), Totemic Attunement (5
  options, 14th) — see the new `option_catalog` convention above, this
  subclass is the reason the object-of-named-arrays shape exists.
- **Wild Magic Surge table** — added the complete real d8 table (8 catalog
  entries, category `wild_magic_surge`) that didn't exist in the data at
  all before this pass.

`engine/test/stubSubclasses.test.js` lower-bound counts updated again
(49 → 42). `node --test` 196/196, `npm run build` clean.

**Fighter, Monk, Wizard, and Barbarian are now fully cleared.** Remaining
per the survey: Bard (6/8 stub), Cleric (12/14), Druid (5/7), Ranger (5/6),
Sorcerer (6/8), Warlock (8/9).

## Bard: all 6 stub Colleges built out to full 3/6/14 progressions (2026-09-04)

Fifth class. Bard's colleges only have 3 real tiers (3/6/14, no 10th), so
this was faster than most. 2 real characters (Lexica/Lore, Sorra/Spirits)
already on complete colleges — no regression risk.

3 parallel research passes covered Creation (TCE), Eloquence (TCE),
Glamour (XGE), Swords (XGE), Valor (PHB), Whispers (XGE). The single most
common correction: **every stub had silently merged 2 real, separately-
named 3rd-level features into one entry** — Mote of Potential was missing
Performance of Creation, Silver Tongue was missing Unsettling Words,
Mantle of Inspiration was missing Enthralling Performance, Psychic Blades
was missing Words of Terror, Bonus Proficiencies was correctly bundled
with Combat Inspiration/Blade Flourish (those really are one write-up
each) — split the four real double-feature cases into separate catalog
entries. Other real corrections:

- **Mote of Potential** — all three trigger effects were wrong (ability
  check is reroll-and-choose, not "+max result"; attack roll deals an
  AoE thunder burst, not flat extra damage; saving throw grants temp HP,
  which was actually already right).
- **Mantle of Inspiration** — was missing the real temp-HP-by-level table
  entirely (5/8/11/14 at 3rd/5th/10th/15th).
- **Psychic Blades** — was written as if it tracked Bardic Inspiration die
  size; real RAW has its own independent damage-by-level table
  (2d6→3d6→5d6→8d6) unrelated to the Inspiration die.
- **College of Swords** — confirmed the exact 2 Fighting Style options
  (Dueling, Two-Weapon Fighting — not a free choice of any style) and
  split all 3 Blade Flourishes into their own catalog entries (category
  `blade_flourish_option`), following the `option_catalog` convention.
- **College of Glamour** — 14th-level feature name was guessed wrong
  ("Mantle of Majesty" — that's actually the 6th-level feature; 14th is
  Unbreakable Majesty).

`engine/test/stubSubclasses.test.js` lower-bound counts updated again
(42 → 36). `node --test` 196/196, `npm run build` clean.

**Fighter, Monk, Wizard, Barbarian, and Bard are now fully cleared.**
Remaining per the survey: Cleric (12/14 stub — largest remaining gap),
Druid (5/7), Ranger (5/6), Sorcerer (6/8), Warlock (8/9).

## Cleric: all 12 stub Divine Domains built out to full 1/2/6/8/17 progressions + domain spell lists (2026-09-04)

Sixth class, and the largest single build-out of this pass — Cleric domains
have 5 tiers (not 3-4 like most subclasses) AND each needed a full 10-spell
domain spell list from scratch (none existed at all before this, unlike
every other class where at least the spell-list plumbing was already
present). 2 real characters (Petra/Life, Revven/Tempest) already on the 2
pre-existing complete domains — no regression risk.

6 parallel research passes covered all 12 remaining domains: Arcana (SCAG),
Order (TCE), Death (DMG), Grave (TCE, originally Guildmaster's Guide to
Ravnica), Forge (TCE), Peace (TCE), Knowledge (PHB), Light (PHB), Nature
(PHB), Twilight (TCE), Trickery (PHB), War (PHB). Every single domain's 1st
tier had at least one real gap or error — the most common pattern by far:
**a domain's 1st level grants 2 (sometimes 3) separately-named features,
and the stub had silently merged them into one, usually losing the second
feature's mechanic entirely** (Light's free Light cantrip, Nature's heavy
armor proficiency, Peace's Implement of Peace, Twilight's Vigilant
Blessing, Death's bonus necromancy cantrip, Grave's Spare the Dying grant
were ALL completely missing before this pass, not just under-described).
Other real corrections:

- **Forge Domain & Grave Domain** — source books were mislabeled (Forge:
  Xanathar's → real Tasha's Cauldron of Everything; Grave: Xanathar's →
  real Tasha's/Guildmaster's Guide to Ravnica) — same mislabel pattern as
  Sun Soul and Oath of the Ancients earlier this session.
- **Emboldening Bond** (Peace) — action cost was wrong (bonus action, real:
  action) and the affected-creature count was a flat "5" instead of the
  real "your proficiency bonus."
- **Blessing of the Trickster** — allowed self-targeting; real RAW
  explicitly excludes the caster ("a willing creature other than
  yourself").
- **Eyes of Night** (Twilight) — recharge was wrong (a flat per-long-rest
  count, real: a single use refreshed by a long rest OR an expended spell
  slot).
- **Twilight's 6th-level feature name was wrong** — guessed as "Vigilant
  Blessing" (which is real, but actually a 1st-level feature), the real
  6th-level grant is Steps of Night (a flight ability).
- **Peace's 17th-level capstone name was wrong** — guessed "Expert
  Peacemaker," real name is Expansive Bond.

**De-duplication applied while building, not after**: "Potent
Spellcasting" (the non-martial-domain 8th-level cantrip-damage feature) is
verbatim identical text across every domain that grants it. Rather than
create 5 duplicate `published_features.json` entries, built ONE shared
`pub_potent-spellcasting-cleric` entry (`class: "Cleric"`, not tied to one
domain) referenced by id from Arcana/Grave/Knowledge/Light/Peace's
`features_by_level`. "Divine Strike" by contrast genuinely differs per
domain (damage type varies — necrotic/fire/psychic/poison/radiant/cold-
fire-lightning/weapon's-own-type), so those stayed as separate entries;
that's real content variation, not duplication.

`engine/test/stubSubclasses.test.js` lower-bound counts updated again
(36 → 24). `node --test` 196/196, `npm run build` clean.

**Fighter, Monk, Wizard, Barbarian, Bard, and Cleric are now fully
cleared.** Remaining per the survey: Druid (5/7 stub), Ranger (5/6),
Sorcerer (6/8), Warlock (8/9).

## Druid: all 5 stub Circles built out to full 2/6/10/14 progressions (2026-09-04)

Seventh class. 2 real characters (Tackett/Stars, Therynv'l/Moon) already on
complete circles — no regression risk.

3 parallel research passes covered Dreams (XGE), Spores (TCE), the Land
(PHB — dedicated pass, has a real 8-way sub-table), the Shepherd (XGE),
Wildfire (TCE). Circle of the Land alone needed all 8 real land types
(Arctic/Coast/Desert/Forest/Grassland/Mountain/Swamp/Underdark — confirmed
8, not the 6 first assumed) with their own 8-spell circle-spell lists each
(64 spells total, `land_spells_by_type` on the subclass file), the largest
single spell table added this whole pass. Real corrections found:

- **Symbiotic Entity** (Spores) — action cost was wrong (bonus action,
  real: action), temp HP formula was a flat 10 instead of the real
  "4 per druid level," and its actual combat benefit was misdescribed
  (doubles the Halo of Spores damage roll, not a flat die-size bump).
- **Summon Wildfire Spirit** — action cost was wrong (bonus action, real:
  action); the spirit was only described in prose with no real stat block
  (AC/HP/attacks) — added the full block.
- **Balm of the Summer Court** (Dreams) — per-use spend cap was missing
  (real: half your druid level, not unlimited) and the temp-HP formula was
  wrong (flat 1 per die spent, not tied to whether the heal overflowed).
- **Natural Recovery** (Land) — recharge was "once per day," real RAW is
  once per long rest (a meaningful difference for a long adventuring day).
- Circle of the Shepherd's Spirit Totem (Bear/Hawk/Unicorn) and Circle of
  the Land's land types both split into `option_catalog`/named-table
  entries per the established convention — Spirit Totem's 3 options as
  `spirit_totem_option` catalog entries, Land's 8 types as the
  `land_spells_by_type` table (a different shape than `option_catalog`
  since it's a fixed "pick one, get its whole spell progression" choice
  made once at 2nd level, not a growing known-count).

`engine/test/stubSubclasses.test.js` lower-bound counts updated again
(24 → 19). `node --test` 196/196, `npm run build` clean.

**Fighter, Monk, Wizard, Barbarian, Bard, Cleric, and Druid are now fully
cleared.** Remaining per the survey: Ranger (5/6 stub), Sorcerer (6/8),
Warlock (8/9).

## Ranger: all 5 stub Conclaves built out to full 3/7/11/15 progressions (2026-09-06)

Eighth class. All 5 remaining stubs are Tasha's Cauldron of Everything
conclaves: Horizon Walker, Monster Slayer, Swarmkeeper, Beast Master
(revised), Fey Wanderer. No real characters currently on any of these five
— forward coverage, no regression risk. Base Ranger class table
(subclass_feature_levels [3,7,11,15]) checked out on inspection.

Parallel WebSearch/WebFetch research passes (dnd5e.wikidot.com, aidedd.org
stat-block mirrors, D&D Beyond forum quotes reproducing official text,
cross-checked against each other) covered all 5. Real corrections found in
the existing 3rd-level stub text, fixed alongside adding the missing
7th/11th/15th tiers:

- **Gathered Swarm** (Swarmkeeper) — was described as a flat "move target
  5ft closer/farther," real RAW is a choice of 3 effects on each hit (1d6
  piercing; move target 15ft on a failed STR save; or move yourself 5ft).
  The bundled "Swarmkeeper spells + Writhing Tide" text in the same stub
  entry was two different real features wrongly merged — split out
  **Swarmkeeper Magic** (a real, separate 3rd-level grant: mage hand +
  one bonus spell per tier at 3rd/5th/9th/13th/17th) as its own entry, and
  confirmed **Writhing Tide** is real but is a 7th-level feature, not part
  of the 3rd-level grant. The guessed Air/Earth/Fire/Water swarm-type
  choice doesn't exist — the real cosmetic option is a 4-choice Swarm
  Appearance table (insects/twig blights/birds/pixies), no mechanical
  effect either way.
- **Beast Master** — the existing stub used the original PHB "Ranger's
  Companion" (flat CR 1/4 beast, no scaling). Replaced with Tasha's
  Cauldron of Everything's revised **Primal Companion**, the standard
  modern version: beast options scale with proficiency bonus and ranger
  level, attacks use your own spell attack modifier, and it can't drop
  below 1 HP without your intervention.
- **Fey Wanderer** — the existing stub bundled 3 distinct real 3rd-level
  features (Dreadful Strikes, Otherworldly Glamour, Fey Wanderer Magic)
  into one entry; split into 3. Fey Wanderer Magic is a fixed 1-spell-per-
  tier progression (Charm Person/Misty Step/Dispel Magic/Dimension
  Door/Mislead) — one research pass surfaced a conflicting "2 spells per
  level" Cleric-domain-style list that didn't match a direct fetch of the
  primary source and wasn't reproducible on a second attempt; discarded as
  unreliable rather than treated as a tie needing a 3rd source.
- **Horizon Walker** / **Monster Slayer** — each also had its 3rd-level
  stub covering two bundled real features (Detect Portal + Planar
  Warrior; Hunter's Sense + Slayer's Prey); split each pair into its own
  catalog entry rather than leaving them merged.

`engine/test/stubSubclasses.test.js` lower-bound counts updated again
(19 → 14) and its header history comment extended. `node --test` 196/196,
`npm run build` clean.

**Fighter, Monk, Wizard, Barbarian, Bard, Cleric, Druid, and Ranger are now
fully cleared.** Remaining per the survey: Sorcerer (6/8 stub), Warlock
(8/9 stub).

## Sorcerer: all 6 stub Sorcerous Origins built out to full 1/6/14/18 progressions (2026-09-06)

Ninth class. All 6 remaining stubs: Aberrant Mind, Clockwork Soul (both
Tasha's Cauldron of Everything), Draconic Bloodline, Wild Magic (both
Player's Handbook), Shadow Magic, Storm Sorcery (both Xanathar's Guide to
Everything). No real characters currently on any of these six — forward
coverage, no regression risk. Base Sorcerer class table
(subclass_feature_levels [1,6,14,18]) checked out on inspection.

3 parallel WebSearch/WebFetch research passes (dnd5e.wikidot.com primary
text, cross-checked against dndbeyond.com/enworld.org/roll20.net/
dnd5ecompendium.wikidot.com secondary sources) covered all 6. Every one of
these stubs had bundled two real, separately-named 1st-level features
into a single catalog entry — split all 6 into their real pairs, following
the same pattern used for Ranger's Horizon Walker/Monster Slayer this
session:

- **Aberrant Mind**: split into Psionic Spells + Telepathic Speech (1st),
  added Psionic Sorcery + Psychic Defenses (6th), Revelation in Flesh
  (14th), Warping Implosion (18th). Psionic Spells' fixed bonus-spell
  table lives on the subclass file as `psionic_spells_by_level`, following
  the `oath_spells_by_level` convention already established for Paladins.
- **Clockwork Soul**: split into Clockwork Magic + Restore Balance (1st),
  added Bastion of Law (6th), Trance of Order (14th), Clockwork Cavalcade
  (18th). Clockwork Magic's bonus-spell table is `clockwork_spells_by_level`
  on the subclass file, same convention.
- **Draconic Bloodline**: split into Dragon Ancestor + Draconic Resilience
  (1st) — the existing stub's Dragon Ancestor text was missing the doubled-
  proficiency-on-dragon-Charisma-checks clause and the full 10-dragon-type
  damage table, both added. Added Elemental Affinity (6th), Dragon Wings
  (14th), Draconic Presence (18th, including the 24-hour immunity-on-save
  clause the stub-pass guess had omitted).
- **Shadow Magic**: split into Eyes of the Dark + Strength of the Grave
  (1st) — corrected Strength of the Grave's save from the stub-pass's
  guessed Constitution to the real Charisma, and added the
  radiant-damage/critical-hit exclusion clause. Added Hound of Ill Omen
  (6th), Shadow Walk (14th), Umbral Form (18th — confirmed it grants no
  flying speed, contrary to an early research-pass misremembering).
- **Storm Sorcery**: split into Wind Speaker + Tempestuous Magic (1st).
  Real level-placement correction found: **Storm Guide is 6th level**
  (paired with Heart of the Storm), not 14th as the original survey
  guessed — the real 14th-level feature is **Storm's Fury** (reaction
  lightning riposte + forced push), which the stub pass hadn't listed at
  all. Added Wind Soul (18th, confirmed immunity not just resistance, and
  the exact 3+CHA-mod ally count for the shared flying speed).
- **Wild Magic**: split into Wild Magic Surge + Tides of Chaos (1st).
  Added Bend Luck (6th, confirmed real cost is 2 sorcery points, not the
  1 a stub-pass guess might assume), Controlled Chaos (14th), Spell
  Bombardment (18th). The Wild Magic Surge table itself (a d100 DM-facing
  random-effect table) is referenced by name in Wild Magic Surge's
  description but not reproduced as its own catalog entry — it's narrated
  by the DM rather than a character-sheet-facing mechanic, consistent with
  how this app scopes other DM-facing random tables.

`engine/test/stubSubclasses.test.js` lower-bound counts updated again
(14 → 8) and its header history comment extended. `node --test` 196/196,
`npm run build` clean.

**Fighter, Monk, Wizard, Barbarian, Bard, Cleric, Druid, Ranger, and
Sorcerer are now fully cleared.** Remaining per the survey: Warlock (8/9
stub) — the last class.

## Warlock: all 8 stub Otherworldly Patrons built out to full 1/6/10/14 progressions (2026-09-06)

Tenth and final class in the per-class stub-clearing pass. All 8 remaining
stubs: The Archfey, The Fiend (both Player's Handbook), The Celestial, The
Hexblade (both Xanathar's Guide to Everything), The Fathomless, The Genie
(both Tasha's Cauldron of Everything), The Undead, The Undying (Van
Richten's Guide to Ravenloft / Sword Coast Adventurer's Guide). No real
characters currently on any of these eight — forward coverage, no
regression risk. Base Warlock class table (subclass_feature_levels
[1,6,10,14]) checked out on inspection.

4 parallel WebSearch/WebFetch research passes (dnd5e.wikidot.com primary
text, cross-checked against tabletopjoab.com/arcaneeye.com/DDB forums/
roll20.net/worldanvil.com secondary sources) covered all 8. As with
Sorcerer, every stub had bundled two real, separately-named 1st-level
features into one catalog entry — split all 8 into their real pairs.
Notable corrections found beyond the splits:

- **The Fathomless**: Tentacle of the Deep's attack is a melee spell
  attack with limited uses (= proficiency bonus per long rest), not
  at-will as some summaries implied; confirmed Fathomless Plunge (14th)
  is a pure teleport-into-water utility effect with no attack/burst
  component, contrary to the original survey's guess.
- **The Genie**: added the vessel's exact AC (= spell save DC) and HP
  (= warlock level + proficiency bonus) formulas and the "2× proficiency
  bonus hours" Bottled Respite duration, none of which were in the
  original 1st-level guess.
- **The Celestial**: Healing Light's per-use spend cap was missing (real:
  up to your Charisma modifier's worth of d6s, not an unbounded spend)
  and Celestial Resilience's ally formula (half warlock level + CHA mod,
  distinct from the self formula of full warlock level + CHA mod) needed
  confirming across sources.
- **The Undead**: the original stub attributed damage resistance to Form
  of Dread (1st) — real RAW splits this differently: Form of Dread grants
  only frightened immunity while transformed, and necrotic resistance
  (upgraded to immunity while transformed) belongs to 10th-level Necrotic
  Husk instead; also corrected 6th-level Grave Touched's real effect
  (change your own damage to necrotic once per turn, not a resistance
  grant) and confirmed Necrotic Husk's self-destruct recharge is gated
  behind a 1d4 long-rest roll, not a flat once-per-long-rest.
- **The Fiend**: corrected Fiendish Resilience's (10th) exclusion clause —
  it's magical/silvered weapon damage that bypasses the chosen
  resistance, not a restriction on which damage types can be selected.
- **The Hexblade**: confirmed Hex Warrior's Charisma substitution applies
  to one touched, chosen, non-two-handed weapon after a long rest (not a
  blanket rule for any weapon), Armor of Hexes' (10th) exact threshold is
  a d6 roll of 4+, and Master of Hexes' (14th) moved curse doesn't
  retrigger the original target's HP-regain-on-death clause.
- **The Undying**: Among the Dead's (1st) undead-resistance clause is an
  active Wisdom save against the app's earlier "passive indifference"
  framing — an undead attacker must save or retarget/forfeit, it isn't
  automatic; also found no textual support for an exhaustion-removal
  clause on Defy Death (6th) and dropped that unverified guess.
- **The Archfey** and **The Fiend**'s 1st-level guesses were both already
  accurate on inspection — verified and reclassified from stub to
  fully-checked without content changes.

`engine/test/stubSubclasses.test.js`'s two stub-count assertions changed
from lower-bound thresholds (`>= N`) to a hard `=== 0`, since this was the
last class with any remaining stubs — the header comment was rewritten to
close out the whole multi-session history rather than append one more
step. `node --test` 196/196, `npm run build` clean.

**All 13 classes — Fighter, Monk, Wizard, Barbarian, Bard, Cleric, Druid,
Ranger, Sorcerer, Warlock, Artificer, Rogue, and Paladin — are now fully
built out.** Every subclass in the app has all of its real feature tiers
filled in and is 2-source-verified; the stub-subclass pass that began in
Phase 7 (2026-09-02) is complete.

## Wizard: 8 stub Arcane Traditions built out to full 2/6/10/14 progressions (2026-09-04)

Third class in the per-class pass, right after Monk. Wizard has 3 real
characters (Lenn/Evocation, Kessara/Bladesinger, Lyria/Abjuration) — all
three already on already-complete subclasses, so this build-out is forward
coverage, not a live-character fix; no regression risk. Base Wizard class
table (subclass_feature_levels [2,6,10,14]) checked out on inspection.

4 parallel WebSearch/WebFetch research passes (dnd5e.wikidot.com) covered
the remaining 8 schools: Conjuration, Divination, Enchantment, Illusion,
Necromancy, Transmutation (all PHB), War Magic (XGE), Order of Scribes
(TCE). Unlike Monk, none of these needed a big sub-table (no Arcane-Shot-
or Four-Elements-style option lists) — each is 1 named feature per tier,
so this pass moved faster. Real corrections found in the existing 2nd-level
stub text, fixed alongside adding the missing 6th/10th/14th tiers:

- **Minor Conjuration** (Conjuration) — missing the dim-light clause and
  that the object breaks the instant it takes or deals any damage (not
  just after 1 hour/dismissal/recast).
- **Portent** (Divination) — said foretelling rolls could replace a d20
  roll "before or after" it; real RAW is before only. Made the once-per-
  turn cap explicit.
- **Hypnotic Gaze** (Enchantment) — missing the maintain-on-subsequent-
  turns clause, its three break conditions, and the long-rest/spell-slot
  reuse limitation entirely.
- **Improved Minor Illusion** (Illusion) — missing the already-know-Minor-
  Illusion fallback (learn a different cantrip instead).
- **Minor Alchemy** (Transmutation) — missing the real material list
  (wood/stone/iron/copper/silver) and the 10-minutes-per-cubic-foot working
  time.
- **Arcane Deflection and Tactical Wit** (War Magic) — a real mechanical
  error, not just missing detail: the stub said the cost of using Arcane
  Deflection was "disadvantage on your next attack roll." Real RAW cost is
  losing the ability to cast anything but cantrips until the end of your
  next turn — a materially different (and more thematically fitting)
  tradeoff. Cross-verified via a dedicated sageadvice.eu ruling thread, not
  just wikidot.
- **Wizardly Quill and Awakened Spellbook** (Order of Scribes) — missing
  the real quick-copy formula (2 minutes/spell level, not just "faster")
  and the constraint that the damage-type swap requires a same-level spell
  already in your spellbook.
- **Grim Harvest** (Necromancy) — already accurate, just added the missing
  "spell of 1st level or higher" qualifier and fixed category/verification.

Added all 24 missing higher-tier features (3 per subclass × 8). One item
flagged, not resolved: Order of Scribes' One with the Word (14th) has a
documented mechanic (3d6 roll, lose that much combined spell level from
your spellbook, or drop to 0 HP if it can't cover the cost per most
secondary sources) but no source gave a verbatim quote for that fallback
clause — noted in the entry's own `note` field rather than guessed at.

`engine/test/stubSubclasses.test.js` lower-bound counts updated again
(57 → 49), with the running history now in the file's own comment. `node
--test` 196/196, `npm run build` clean.

**Wizard now has 0 stub subclasses left** — Fighter, Monk, and Wizard are
the three classes fully cleared so far. Remaining per the survey:
Barbarian (7/9 stub), Bard (6/8), Cleric (12/14), Druid (5/7), Ranger
(5/6), Sorcerer (6/8), Warlock (8/9).

## Monk: all 9 Monastic Traditions built out to full 3/6/11/17 progressions (2026-09-04)

Continuing the per-class pass right after Fighter — Monk was the single
largest remaining gap in the survey: all 9 subclasses were `stub: true`
(only the 3rd-level tier existed). Base Monk class table (martial arts die,
ki points, unarmored movement, features 1-20) checked out against real PHB
on inspection, no changes needed. No existing characters use Monk at all
(0 of the roster), so this is pure forward-looking coverage.

5 parallel WebSearch/WebFetch research passes (dnd5e.wikidot.com +
XGE/TCE/SCAG cross-checks) pulled the complete real 3/6/11/17 progressions
for all 9 traditions, including three sub-tables of real size: Four
Elements' 17 elemental disciplines, Kensei's weapon-known progression, and
several die/ki-cost formulas that turned out to be wrong or missing in the
original stub guesses. Real corrections found and fixed:

- **Way of the Open Hand / Way of Shadow** (PHB) — both had accurate 3rd-
  level text already; just needed the 3 missing tiers each (Wholeness of
  Body/Tranquility/Quivering Palm; Shadow Step/Cloak of Shadows/Opportunist).
- **Way of the Four Elements** (PHB) — confirmed this subclass has exactly
  ONE named feature (Disciple of the Elements) across its whole progression;
  6th/11th/17th grant no new named feature, just another known discipline.
  Added all 17 real elemental disciplines as their own catalog entries
  (category `four_elements_discipline`), each with real ki cost and the
  spell it casts (or, for Elemental Attunement/Fangs of the Fire Snake/Fist
  of Unbroken Air/Shape the Flowing River/Water Whip, full standalone
  text) — flagged Fist of Unbroken Air's exact area-of-effect shape as the
  one detail sources disagreed on (transcribed the better-supported
  single-target reading, noted in-entry). Known-discipline count (2/3/4/5
  total by 3rd/6th/11th/17th, including the always-known Elemental
  Attunement) tracked as `elemental_disciplines_known_by_level`.
- **Way of the Kensei** (XGE) — real level table didn't match the stub's
  assumptions at all: Deft Strike is actually a 6th-level feature (under a
  named feature, "One with the Blade," not "no new feature"), Way of the
  Brush (calligrapher's/painter's supplies) was missing entirely from the
  3rd-level grant, and Unerring Accuracy (17th) is worded "monk weapon" in
  real RAW, not "kensei weapon" — transcribed as printed since kensei
  weapons already count as monk weapons anyway, but flagged as a widely-
  noted likely errata point. Known-weapon count (2/3/4 at 3rd/6th/11th)
  tracked as `kensei_weapons_known_by_level`.
- **Way of the Long Death** (SCAG) — Touch of Death's trigger was wrong
  (was "with a melee attack," real RAW is proximity — within 5ft when the
  creature drops to 0, any means). Added Hour of Reaping/Mastery of
  Death/Touch of the Long Death.
- **Way of the Sun Soul** (XGE) — source book was mislabeled as Sword Coast
  Adventurer's Guide (it's XGE), same mislabel pattern as Oath of the
  Ancients in the Paladin work. Confirmed Dexterity is correct for Radiant
  Sun Bolt. Added Searing Arc Strike/Searing Sunburst/Sun Shield.
- **Way of the Drunken Master** (XGE) — 3rd-level proficiency was wrongly
  "Performance or Persuasion" (real RAW: flat Performance, no choice).
  Added Tipsy Sway/Drunkard's Luck/Intoxicated Frenzy.
- **Way of Mercy** (TCE) — Hand of Healing/Hand of Harm's ki cost and
  formula were vague in the stub ("spend ki points... heal a creature");
  real RAW is a flat 1 ki point for Martial Arts die + WIS modifier on
  both. Added Physician's Touch/Flurry of Healing and Harm/Hand of Ultimate
  Mercy.
- **Way of the Astral Self** (TCE) — the biggest single-feature correction
  this pass: Arms of the Astral Self was stubbed as "usable X times per
  long rest" (real RAW: purely ki-gated, 1 ki per activation, no per-rest
  cap at all), was missing the Dexterity-save force-damage burst on
  activation entirely, was missing Empowered Arms' bonus damage, and had
  reach wrong (flat 10ft instead of +5ft over normal). Added Visage/Body/
  Awakened Astral Self.

`engine/test/stubSubclasses.test.js`'s lower-bound counts updated again
(66 → 57) with the running history now in the file's own comment. `node
--test` 196/196, `npm run build` clean.

**Fighter and Monk are now both fully built out — 0 stub subclasses in
either class.** Remaining per the survey: Barbarian (7/9 stub), Bard (6/8),
Cleric (12/14), Druid (5/7), Ranger (5/6), Sorcerer (6/8), Warlock (8/9),
Wizard (8/11).

## Fighter: 6 stub subclasses built out to full 3/7/10/15/18 progressions (2026-09-04)

Continuing the per-class pass ("we need them all eventually," project owner)
after Rogue's audit — Fighter was the next pick: second most-used class on
the roster (5 characters) with a real gap, 6 of its 10 subclasses were
still `stub: true` (only the 3rd-level tier existed): Arcane Archer,
Cavalier, Psi Warrior, Purple Dragon Knight (Banneret), Rune Knight,
Samurai. Battle Master, Champion, Echo Knight, and Eldritch Knight were
already complete; base Fighter's class table checked out against real PHB
on inspection, no changes needed there. None of the 5 existing Fighter
characters (Vaz/Battle Master, Kerra/Champion, Corwin/Champion,
Elucyne/Champion, Eldi/Echo Knight) use any of the 6 being built, so this
is pure forward-looking coverage, not a fix to anything currently in play.

3 parallel WebSearch/WebFetch research passes (dnd5e.wikidot.com + XGE/TCE
page scans, cross-checked against secondary compendia) pulled the complete
real levels 3/7/10/15/18 for all 6, plus each subclass's own sub-table:
Arcane Archer's 8 Arcane Shot options, Rune Knight's 6 runes, Psi Warrior's
Psionic Energy die-count/size formula. One research-stage correction worth
flagging: **Purple Dragon Knight has no separate 18th-level feature** —
real RAW upgrades Inspiring Surge (10th) in place, from one ally to two,
rather than granting a new named feature; the subclass file's
`features_by_level` deliberately has no `"18"` key, with a note explaining
why (would otherwise look like a missed grant).

Built, all in `src/data/published_features.json` + the matching
`engine/data/subclasses/fighter-*.json` (stub flag removed, full
`features_by_level`):

- **Arcane Archer** (XGE) — Arcane Archer Lore and Arcane Shot (3rd, fixed
  the uses-per-rest from a wrong proficiency-bonus-scaled guess to the real
  flat 2), all 8 Arcane Shot options as their own catalog entries (category
  `arcane_archer_shot`: Banishing/Beguiling/Bursting/Enfeebling/Grasping/
  Piercing/Seeking/Shadow Arrow, each with real damage-die-at-18th scaling),
  Magic Arrow + Curving Shot (7th), Ever-Ready Shot (15th). Known-option
  count (2/3/4/5/6 at 3/7/10/15/18) tracked as `arcane_shot_known_by_level`
  on the subclass file rather than fake feature grants at 10th/18th, where
  RAW adds a shot option but no new named feature.
- **Cavalier** (XGE) — completed Unwavering Mark's truncated mechanic (the
  bonus-action counter-attack + Strength-mod use cap), Warding Maneuver
  (7th), Hold the Line (10th), Ferocious Charger (15th, confirmed no
  per-rest cap unlike its siblings), Vigilant Defender (18th).
- **Psi Warrior** (TCE) — completed Psionic Power's three sub-options
  (Protective Field/Psionic Strike/Telekinetic Movement) and confirmed the
  die-count formula (twice proficiency bonus — verified specific to Psi
  Warrior, not just assumed by analogy to Soulknife Rogue) via
  `psionic_energy_die_by_level` (d6/d8/d10/d12 at 3/5/11/17, same
  breakpoints as Soulknife), Telekinetic Adept (7th), Guarded Mind (10th),
  Bulwark of Force (15th), Telekinetic Master (18th).
- **Purple Dragon Knight (Banneret)** (SCAG) — fixed Rallying Cry's heal
  amount (flat fighter level, was wrongly tied to the Second Wind roll),
  Royal Envoy (7th), Inspiring Surge (10th, its own description notes the
  18th-level two-ally upgrade), Bulwark (15th, Int/Wis/Cha saves only,
  matching Indomitable's own restriction).
- **Rune Knight** (TCE) — split Giant's Might out of the combined 3rd-level
  stub into its own feature entry (it's a big standalone mechanic — bonus
  action, Large-size, scaling bonus damage — that was previously just a
  trailing clause), added all 6 runes as individual catalog entries
  (category `rune_knight_rune`: Cloud/Fire/Frost/Stone available at 3rd,
  Hill/Storm at 7th), Runic Shield (7th), Great Stature (10th, also bumps
  Giant's Might's bonus damage to 1d8), Master of Runes (15th), Runic
  Juggernaut (18th, bumps damage to 1d10 and allows Huge size). Known-rune
  count (2/3/4/5 at 3/7/10/15) tracked as `runes_known_by_level`.
- **Samurai** (XGE) — fixed Fighting Spirit's temp-HP scaling (flat 5/10/15
  by character level breakpoint, not a formula — the original stub's
  "usable X times per long rest" framing was directionally right but the
  HP amount was a guess) and confirmed recharge is long-rest-only (the
  short-rest-like partial refill is the separate Tireless Spirit feature at
  10th, not part of Fighting Spirit itself), Elegant Courtier (7th),
  Tireless Spirit (10th), Rapid Strike (15th), Strength before Death
  (18th).

`engine/test/stubSubclasses.test.js`'s lower-bound counts updated
accordingly (72 → 66 stub subclass files and stub feature entries) — the
test file's own comment now says explicitly that this number only ever
goes DOWN as real build-out lands, so a future increase back toward 72
would mean something regressed, not "forgot to bump a constant."
`node --test` 196/196, `npm run build` clean.

**Still stub, not touched this pass**: Fighter has no remaining stubs —
6/10 done this session, the other 4 were already complete. The next class
needing this treatment per the earlier survey: Barbarian (7/9 stub), Bard
(6/8), Cleric (12/14), Druid (5/7), Monk (9/9 — fully stub), Ranger (5/6),
Sorcerer (6/8), Warlock (8/9), Wizard (8/11).

## Rogue full RAW audit — base class + all 9 subclasses (2026-09-03)

Project owner asked for the same treatment the Artificer audit got, this
time for Rogue: "pulling all the feats, features, level up choices, etc for
another full class and all subclasses." Base class data
(`engine/data/classes/rogue.json`) and all 9 subclass files
(`engine/data/subclasses/rogue-*.json` — Thief, Assassin, Arcane Trickster,
Inquisitive, Mastermind, Scout, Swashbuckler, Soulknife, Phantom) turned out
to already be unusually complete going in: no stub subclasses, no missing
tiers, no homebrew-flag mislabels (the `hb_rogue_*` id prefixes on several
real-RAW subclasses — Thief, Arcane Trickster, Scout, Phantom — are just
leftover naming from whenever those entries were first typed up; every one
of them is correctly `homebrew: false` with a real source citation). So this
was a genuine line-by-line accuracy pass (3 parallel WebSearch/WebFetch
verification agents against dnd5e.wikidot.com, split PHB/XGE/TCE), not a
build-from-scratch one — closer to the Explosive Cannon pattern (content
basically right, details subtly wrong) than the original Artificer gaps.

**Base Rogue class table**: verified in full against PHB — saving throws,
armor/weapon proficiencies, 4-skill choice list, subclass timing
([3,9,13,17]), sneak attack dice progression (1d6→10d6), and the full
`features_by_level` table. No discrepancies found.

**Fixed** (all in `src/data/published_features.json` unless noted):

- **Thief — Fast Hands**: was missing the "Use an Object" action entirely
  (had garbled duplicate disarm/pick-lock text instead) — real PHB text
  offers Sleight of Hand / thieves'-tools-disarm / Use an Object as the
  bonus-action options, not two versions of the same thing.
- **Arcane Trickster — Spell Thief**: added the missing "cantrips can only
  be negated, never stolen — only a 1st-level-or-higher spell can be
  captured for reuse" clarification.
- **Inquisitive — Insightful Fighting**: wrong duration entirely (had "until
  the end of your next turn"; real text is "1 minute or until you
  successfully use this feature against a different creature") plus a
  missing "but not if you have disadvantage on it" exclusion.
- **Mastermind — Master of Tactics**: missing the "provided the target can
  see or hear you" condition on the 30ft ranged Help.
- **Scout — Skirmisher**: wrong trigger — had "when a creature moves to a
  space within 5ft of you" (any approach), real text is "when an enemy
  _ends its turn_ within 5ft of you" (meaningfully more restrictive, no
  free reaction on mid-move passthrough).
- **Soulknife**, several real mechanical gaps, not just wording:
  - Psychic Blades damage was flat "1d6"/"1d4" — missing "+ your ability
    modifier" on both hits, and missing the "other hand must be free" gate
    on the second-blade bonus action.
  - Psi-Bolstered Knack had the expend-condition backwards: real RAW rolls
    the die first and only expends it if the roll turns the failure into a
    success, not "expend, then add."
  - Psychic Whispers: range was wrongly stated as "any range" — real cap is
    1 mile between all linked creatures.
  - Psychic Veil and Rend Mind were both missing their die-expenditure
    reuse clauses (Veil: another die to reuse before a rest; Rend Mind:
    3 dice to reuse before a long rest) and Rend Mind was missing that it
    only triggers off a Psychic-Blades Sneak Attack specifically.
  - The dice-**count** formula (twice your proficiency bonus) didn't exist
    anywhere in the data — only die _size_ did
    (`psionic_energy_die_by_level`). Added as prose to the
    `pub_soulknife-psionic-energy` catalog entry rather than a new static
    table, since the count is a live formula off proficiency bonus, not a
    fixed per-tier number — a hardcoded table would drift out of sync with
    `proficiencyBonus()` and risks the exact kind of subtle error this
    audit pass was for.
- **Phantom**:
  - Whispers of the Dead had an invented 11-skill restriction — real RAW is
    any one skill or tool proficiency, no list.
  - Ghost Walk was missing "attack rolls against you have disadvantage"
    while spectral.

**Verified correct, no changes**: base class table in full; Assassin (all 5
features); Arcane Trickster's other 4 features; Thief's other 4; Inquisitive/
Mastermind/Scout/Swashbuckler's remaining features; Soul Blades (both
benefits); Phantom's Wails from the Grave/Tokens of the Departed/Death's
Friend.

**Characters checked** (read-only, no changes needed): Siv (Rogue 9/Scout) —
all present-tier Scout features correct, Expertise granted twice (L1/L6)
matching her 4 `skill_expertise` entries. Torrin (Rogue 12, `subclass:
"Soulknife / Mastermind"`) — confirmed TODO.md's existing description of him
still matches reality; still explicitly out of scope for fixing (full
rebuild, not a priority, per the project owner).

`cd engine && node --test` still 196/196 throughout (this was almost
entirely `src/data/published_features.json` prose, not `engine/` schema —
nothing here touched a shape the engine tests exercise). `npm run build`
clean.

## Ability-score attribution + species/racial trait recording and display (2026-09-03)

The flagship item explicitly deferred earlier this session ("hold this for
when I have more tokens") — project owner: "They aren't just choosing stats,
they're choosing feats with effects and abilities, of course they need
recorded!" Two TODO.md entries closed: Jaygar's INT 20 (2 ASIs + Fade Away,
no recorded trail — his feat pick predates the mechanism this builds, see
that entry's own correction) and Siv's DEX 20 (Human racial + 2 ASIs,
reconstructed from memory, not from any recorded trail) were the motivating
cases for both halves of this work.

**Schema decision — additive/non-destructive, not a redefinition.** New
`ability_score_history` array on the character: `{ability, amount, source,
level_gained}`. `stat_str`/`stat_dex`/etc. keep meaning exactly what they
always have — "the final number" — so every one of the ~25 existing
character records stays correct with zero migration risk. History is purely
explanatory: the tooltip's "implied base" is computed as `stat_X - sum(history
for X)`, not stored anywhere. Chose this over redefining `stat_*` as
"base only" per the task's own steer and this session's established "don't
silently redefine an existing field's meaning" norm (see the feat-catalog
pass) — the redefinition option would have needed a real migration touching
every character's actual combat numbers, for a purely cosmetic tooltip
upgrade. Not retroactive: existing characters simply have no
`ability_score_history`, same precedent as feats before the catalog pass.

**Populated at two points, both new-data-going-forward only:**

- `engine/rules/diffLevelUp.js`, for every ASI and every feat-with-its-own-
  bump crossed during a level-up. `engine/rules/asiFeat.js`'s `bumpAbilities`
  now also returns `deltas` — the ACTUAL applied change per ability (after
  minus before), not the requested amount, so a bump that gets partially or
  fully capped at 20 still makes history sum correctly to the final stat
  (real regression test: an ASI requesting +2 into a 19 that caps at 20
  records `amount: 1`, not `2`). `applyFeatChoice` returns `deltas: []` for a
  feat with no `ability_score_increase` at all (Alert, Skilled) — no phantom
  history entry gets written for those. Source is `'Ability Score
Improvement'` for a plain ASI, or the feat's own name for a feat's bump —
  exactly the two cases the project owner asked to be able to tell apart.
- `NewCharacterTool.vue`'s new `abilityScoreHistorySeed` computed, folded
  into `characterShell()` — seeds the STARTING bonus (species racial via
  `useSpeciesBonus`, or the manual free +2/+1 when that toggle is off) at
  `level_gained: 1`, since a level-1 preview-level-up call never touches
  ability scores at all (no class grants an ASI at level 1) — diffLevelUp
  alone can't be the only entry point. `species_bonus_applied` (boolean) is
  a separate, simpler field recording WHETHER the toggle was on, independent
  of the amounts/sources in the history array.

**Tooltip breakdown — `dnd_utils.js`'s `statArray`.** Filters
`ability_score_history` by ability, sums it, and shows `${impliedBase} base
· +N (source, level N) · ... · = final (mod)` — matches the task's own
worked example almost verbatim (verified live on a synthetic INT 20 gnome:
`"INT: 15 base · +2 (Gnome racial, level 1) · +2 (Ability Score Improvement,
level 4) · +1 (Fade Away, level 8) · = 20 (+5)"`). Degrades gracefully to the
pre-existing flat `"INT: 20 (no modifiers) = +5"` tooltip when history is
empty/absent — verified live on Jaygar (real roster character, predates this
work) that this is exactly what still renders, not something broken.

**Species traits — sourced from `engine/data/species.json`, a real content
gap filled along the way.** The 4 subraced species (Elf/Dwarf/Halfling/Gnome)
already had real subrace-level trait data from an earlier session, but NONE
of the 9 standard species had any BASE-species-level traits at all — meaning
Fey Ancestry, Lucky, Brave, Gnome Cunning, Dwarven Resilience, etc. (the
exact named traits TODO.md's own motivating text called out) would never
have rendered even with the display mechanism built, since the data simply
didn't exist yet. Added real base-species traits for all 8 non-Human species
(Human correctly has none — its identity is the flat ability bonus, not
named traits, confirmed against the SRD cache's own trait list), verified
against dnd5e.wikidot.com (Dwarf, Dragonborn, Halfling, Half-Orc fetched
live; Elf/Gnome/Half-Elf/Tiefling cross-checked against this project's own
existing `published_features.json` entries, which already had real PHB text
for Fey Ancestry/Brave/Gnome Cunning/Hellish Resistance/Infernal
Legacy/Lucky (Halfling) from an earlier pass). New data-integrity test in
`engine/test/species.test.js`: every base + subrace trait has a non-empty
name/description, and the 4 subraced species specifically have base-level
traits (not just subrace ones).

**Character schema — `species_traits` array, populated at creation time**
in `NewCharacterTool.vue`'s new `speciesTraitRecords` computed (species'
own `traits` + chosen subrace's `traits`, merged — same set already shown
read-only in the Species tab's "Traits (flavor/reference only)" list, now
also landing on the actual character record with `type: 'speciesTrait'` and
which tier each came from). Not retroactive — same precedent as feats and
`ability_score_history`.

**Render path — deliberately bypasses name-based `lookupFeature` for these,
not just a new marker.** `FeaturePillsPanel.vue` merges `character.
species_traits` into the same list `character.features` already renders
(matching how feats mix in rather than getting a 4th UI location), with a
`Fingerprint` icon (lucide-vue) + "Species trait" title — visually distinct
from the feat `Star` in both shape and color, so a player can tell them apart
at a glance without reading the label. But the real design decision is in
`detailPopupBuilders.js`'s `buildFeaturePopupData`: a species trait's
tooltip renders straight from its OWN inline `description` (copied onto the
character record from `species.json` at creation time), skipping the
`lookupFeature(name, id)` name-based cascade entirely for this feature type.
This isn't just convenience — it deliberately sidesteps the exact "Lucky"
(Halfling racial trait) vs. "Lucky" (PHB feat) collision class of bug this
project already hit once and left unfixed (see this file's Phase 7b entry).
Giving every new trait a real catalog `id` to disambiguate by would have
worked too, but a self-contained description closes the ENTIRE bug class for
this feature type at once, for every trait (including ones this pass didn't
personally author), not just the ones that happened to get an id. Verified
live: opening a species trait's popup on a synthetic fixture character fired
zero network requests to `dnd5eapi.co`.

**Test coverage**: new `engine/test/abilityScoreHistory.test.js` (6 tests) —
plain ASI attribution, feat attribution (source = feat name, using Fade Away
— Jaygar's own real motivating feat), a feat with no ability bump at all
records nothing, history accumulates correctly across 3 separate level-ups
and sums back to exactly `starting base + total delta` (Jaygar's real
2-ASI-plus-feat shape), a capped ASI records the actual applied delta not
the requested one, and pre-existing history on a character is preserved
(appended to, not overwritten) on a subsequent level-up. Plus the 2 new
species-trait data-integrity tests in `species.test.js` described above.
Full suite green throughout (179 → 188 after this pass's own additions;
196 by the time of the final check, after other same-day concurrent engine
work in this same working tree — see below).

**Live-verified in the browser** (Playwright, backend restarted for the
`engine/` changes): (1) New Character tool, Gnome → Rock Gnome — species
tab correctly shows "Gnome Cunning" (base) + "Artificer's Lore"/"Tinker"
(subrace) merged. (2) A synthetic fixture character (Vuex-injected in-memory
only, same precedent as the Phase 7d invocations verification — never
written to disk, gone on reload) with `species_traits` + `ability_score_
history` set: `FeaturePillsPanel` renders "Fade Away" with the feat star and
"Gnome Cunning"/"Artificer's Lore"/"Tinker" with the trait fingerprint, all
in one Features list; the INT tooltip renders the full real breakdown; the
species-trait popup shows real text with zero `dnd5eapi.co` requests. (3) A
REAL roster character (Denna, Rogue 9→10, draft-preview only) through the
actual Level Up tool UI: picking STR for her level-10 ASI produced
`ability_score_history: [{ability:"str", amount:2, source:"Ability Score
Improvement", level_gained:10}]` in the live server response; switching to
Feat mode and picking Athlete (+1 STR, a real ability-choice feat) produced
`{ability:"str", amount:1, source:"Athlete", level_gained:10}`. Confirm
Level Up was never clicked. `git diff` confirms `characters.json` ended the
session with Denna's `stat_str` still 10 and no `ability_score_history` —
her real record was never touched, matching this task's explicit rule.
`npm run build` compiles clean.

**Concurrent work note**: this session found `engine/data/species.json` and
`NewCharacterTool.vue` being actively edited by a separate concurrent
session partway through this pass (a real class-skill-picker +
background/species language-picker build, its own entry now sits below this
one) — one intermediate save briefly clobbered this pass's base-species
`traits` additions while adding its own new `languages` field to the same
records. Re-applied on top of the newer content rather than reverting it;
both features now coexist correctly in the file. Also hit that session's
own in-progress `skillDisabled` render bug mid-edit while probing the New
Character tool live (not caused by, or fixed by, this pass) — confirmed
resolved on a later recheck once that other work had landed.

**Deliberately left out of scope**: retroactively backfilling
`ability_score_history`/`species_traits`/`species_bonus_applied` onto any
existing roster character (including Jaygar and Siv themselves, the two
motivating cases) — explicit project-owner rule, same as every prior
schema addition this session. Also did not add a `species_traits.id` field
for catalog lookup, per the render-path design decision above — the
self-contained description makes it unnecessary for this feature, though a
future pass adding real ids to species.json's traits (for some OTHER
consumer that isn't the sheet tooltip) would still be safe to layer in
later without touching anything built here.

## New Character tool: real class-level skill picker + background/species language pickers (2026-09-03)

Closes the gap logged in `TODO.md`'s "New Character tool has no class-level
skill picker at all" — confirmed twice this session (Siv ended up with 2 of
her expected 4 Rogue skills; Jaygar needed 2 more skills and all his
languages backfilled by hand), same root cause both times:
`NewCharacterTool.vue`'s `selectedSkills` was wired ONLY to the background's
fixed 2-skill grant, and no class file had any "choose N skills" data at all,
plus nothing anywhere prompted for a background's or species' language
grants.

**Real per-class skill_choices data, all 13 classes** — new `skill_choices:
{count, options}` field on each `engine/data/classes/*.json` (options is
either an array of real `skills.json` ids, or the literal string `'any'` for
Bard's "choose any three"). Verified against dnd5e.wikidot.com for all 13,
cross-checked against a second independent source for a sample: 5thsrd.org
(Rogue, Ranger, Bard, Monk — all matched exactly) and a WebSearch
cross-reference for Artificer, which turned out to be the one real surprise —
its skill list is Arcana/History/Investigation/Medicine/Nature/Perception
**plus Sleight of Hand** (7 options, not 6), confirmed independently by both
dnd5e.wikidot.com and a separate WebSearch before writing the data, exactly
the "don't trust training-knowledge alone" risk the task called out. Final
counts: Rogue 4 (from 11), Bard 3 (any), Ranger 3 (from 8), everyone else 2
(from 5-8 depending on class).

**Real per-background language_choices, all 41 curated backgrounds** — new
`language_choices: <int>` field on `engine/data/backgrounds.json`. The 13
real PHB backgrounds verified against dnd5e.wikidot.com with every entry
cross-checked against a second source (dndbeyond.com or an independent
WebSearch) — Acolyte/Sage both grant 2 (Sage is the exact case TODO.md named
for Jaygar), Guild Artisan/Hermit/Noble/Outlander grant 1,
Charlatan/Criminal/Entertainer/Folk Hero/Sailor/Soldier/Urchin grant 0. The
28 non-PHB backgrounds (SCAG/Ghosts of Saltmarsh/Tomb of Annihilation/
Guildmasters' Guide to Ravnica/Ravenloft: The Horrors Within/2024 PHB) got
the same per-entry web verification where a source existed. **One real
design fact surfaced along the way, not obvious going in**: the 10
2024-format backgrounds already in this curated list (the 6 real 2024 PHB
ones — Guard/Merchant/Scribe/Wayfarer/Farmer/Artisan — plus the 4 "Ravenloft:
The Horrors Within" ones — Investigator/Haunted One/Spirit Medium/Mist
Wanderer) all correctly get `language_choices: 0` — confirmed via
Investigator's fully-detailed grant list (no language line) and a WebSearch
on the 2024 rules change itself: 2024-ruleset backgrounds don't grant
languages at all anymore, every character just picks 2 free-standing
languages at creation independent of background/species. That flat
2024-style grant doesn't map onto this app's per-background/per-species
picker model (which is deliberately 2014-ruleset, per this file's own Phase
7 scope note) and is out of scope here — flagged, not built.

**Real per-species language grants, all 9 standard PHB species** — new
`languages: {automatic: [...], choice: {count} | null}` field on
`engine/data/species.json`, verified against dnd5e.wikidot.com (Human,
Half-Elf cross-checked directly — the two with an actual flexible-choice
component and the highest risk of being wrong). Every species gets Common
automatically; 7 of 9 also get one more fixed language automatically
(Dwarvish/Elvish/Halfling/Draconic/Gnomish/Orc/Infernal); Human and Half-Elf
additionally get 1 free language of choice. High Elf (the one subrace with
its own extra language per RAW, matching its pre-existing "Extra Language"
flavor trait) gets its own `languages: {choice: {count: 1}}` that stacks on
top of Elf's base grant, same additive pattern subrace ability score bonuses
already use. The 3 homebrew species (Catrin/Drevani/Hei'ugar, in
`api_data_cache/species.json`, predating this pass) already stored a flat
`languages: [...]` array with no choice component — left as-is and treated
as fully automatic (no picker needed) rather than migrated to the new shape,
since they have no real choice to model.

**New `engine/data/languages.json`** (16 entries: 8 standard + 8 exotic real
PHB player-choosable languages — Druidic/Thieves' Cant and monster-only
languages deliberately excluded, same "real options a player would actually
pick from" scoping `skills.json` already established) +
`engine/rules/languages.js` (`listLanguages`/`loadLanguage`) +
`GET /api/engine/languages` in `server.js`. Automatic grants store plain
language NAMES (not ids) directly, matching how `character.languages` and
the homebrew species' existing flat array already work — no id resolution
needed anywhere in the write path.

**`NewCharacterTool.vue`: three new picker sections**, each visually and
structurally separate from the existing background-skill picker (never
sharing a `v-model` array with it):

- **Class tab** — a new skill picker below the existing hit-die/saving-throw
  info, sized to `selectedClass.skill_choices.count`, options filtered to
  `skill_choices.options` (or the full list for Bard's `'any'`).
- **Background tab** — a new language picker below the existing skill
  picker, sized to `pickedBackground.language_choices`.
- **Species tab** — automatic languages shown as a note ("Languages: Common,
  Elvish"), plus a picker for the species' (+ subrace's) own flexible choice
  count when there is one.

**Overlap handling — the deliberate v1 simplification** (explicitly asked
about in the task): real RAW resolves a background/class skill overlap by
letting the player pick a replacement skill instead of double-dipping. Built
exactly that, both directions, via one shared `skillDisabled(skillId,
sourceArray, currentIndex)` method: an option already selected elsewhere in
the same array, or anywhere in the OTHER skill array (background vs. class),
renders `disabled` in the `<select>`. Same mechanism for languages
(`languageDisabled`) across all three sources at once (species automatic,
species choice, background choice) — you can't "choose" a language you
already automatically know either. Verified live: Guild Artisan (grants
Insight+Persuasion) + Rogue (skill list includes both) correctly disables
Insight/Persuasion in the class picker; Human's free language pick
(Draconic) correctly disables Draconic in Guild Artisan's own language
picker. **Not modeled, deliberately**: the full "which specific skill would
a real player pick instead" flow — this just prevents the double-grant by
disabling the option, matching the "flag the simplification rather than
half-build the nuance" pattern this session has used elsewhere (Tough's
retroactive HP, invocation swapping).

**Explicitly out of scope, flagged rather than silently skipped** (per the
task's own instruction to flag rather than guess): (1) Expertise skill
selection (Rogue needs this at both level 1 and level 6) — a Level Up tool
concern, not New Character tool, and a materially different mechanism
(picking AMONG already-known skills, not granting new ones); (2) a feature
mechanically granting a skill proficiency (Scout's Survivalist) — needs a new
`grants_skill`-style schema on features generally, a bigger and separate
lift than wiring up two already-existing choice counts. Both are still open,
same as before this pass.

**Test coverage**: new `engine/test/skillAndLanguageChoices.test.js` (8
tests) — every class's `skill_choices` count/options resolve to real skill
ids with no internal duplicates and `count <= options.length`; every
background has a valid `language_choices` int; every species has a real
`languages.automatic` including Common; a `languages.json` integrity check
(16 entries, no duplicate ids/names); spot-checks citing the verification
source for Rogue/Bard/Ranger/Wizard/Artificer's skill lists, Acolyte/Sage/
Hermit/Guild Artisan/Charlatan/Criminal/Soldier's language counts, and
Human/Half-Elf/Dwarf/Gnome/High Elf's language grants. Full suite: 196/196
passing (was 188 before this pass; the other 8 new tests since the last
CHECKLIST entry belong to a different, concurrent pass — see this file's
Warlock invocations / ability-score-history sections).

**Live-verified in the browser** (Playwright via the
`/Users/kevinsmith/.npm/_npx/e41f203b7505f1fb/node_modules` cache,
`NODE_PATH`-injected same as the invocations pass; backend restarted to pick
up the `engine/data`/`server.js` changes): a Human/Guild Artisan/Rogue
throwaway character exercised all three pickers and both cross-disable
directions in one run — Human's automatic-Common + 1-choice note rendered
correctly, Draconic picked and then correctly shown disabled in Guild
Artisan's own language select, Guild Artisan's Insight/Persuasion correctly
pre-filled AND correctly disabled in Rogue's 4-skill class picker, Create
Character stayed disabled until all choices were complete then enabled
correctly. Inspected the resulting in-memory character directly off Vuex
(`document.querySelector('.app-layout').__vue__` → walk `$parent` to
`$store`, since this app's Vue root replaces `#app` entirely rather than
preserving the id) — `skill_proficiencies` was the correct 6-skill union
(Insight, Persuasion, Acrobatics, Athletics, Deception, Stealth) and
`languages` the correct 3-language union (Common, Draconic, Sylvan), zero
console errors. **Never saved**: the throwaway character was removed
straight from the in-memory Vuex array (never through any save/persist
action), and `grep -c "Zzz Throwaway" src/data/characters.json` confirmed
zero matches in the file on disk afterward — `characters.json` does show as
modified in `git status`, but entirely from a separate, concurrent pass
running in this same working tree this session (the ability-score-history/
species-traits work logged elsewhere in this file); none of that diff
contains anything from this pass's test character.

## Homebrew-flag verification audit — findings only, NOT yet fixed (2026-09-03)

Ran the audit scoped in `TODO.md`'s "Homebrew-flag audit" entry, same method as
the 2026-09-02 Artificer RAW audit that caught `pub_eldritch-cannon-explosive-
cannon` (WebSearch/WebFetch against real sources — dnd5e.wikidot.com preferred
— verifying claimed-homebrew content against real published text). **This is
findings-only. No data files were touched.** Full report handed to the project
owner for review before any fix is applied.

Pool actually reviewed: all entries with `homebrew: true` — 42 in
`published_features.json` (count shifted up from the TODO's estimate of 37;
grew since that note was written) + 4 in `published_spells.json` = 46 total.

**Result: 1 confirmed mislabel, same pattern as Explosive Cannon.**
`pub_infusion-perfume-of-bewitching` ("Infusion: Perfume of Bewitching," tagged
as a custom Jaygar infusion) is a near-verbatim match for the real **Perfume of
Bewitching** — common wondrous item, _Xanathar's Guide to Everything_: apply as
an action, 1 hour, advantage on Charisma checks against humanoids CR 1 or
lower, target unaware they were influenced. Our description already matches
the mechanic almost word-for-word. Should become `homebrew: false` with a real
`source` citation once the fix pass runs.

One borderline case worth a second look but NOT called a hard mislabel:
`pub_infusion-helm-of-comprehending-languages` shares its name with a real DMG
uncommon item (which casts _Comprehend Languages_ at will — both spoken and
written), but our entry's actual mechanic is narrower (reads written language
only, no spoken-language comprehension, no spellcasting) — different enough
from the real item's actual grant that `homebrew: true` is defensible as-is.
Flagged for the project owner to make the final call.

The other 44 entries checked out as correctly labeled: character-unique
inventions (Torrin/Therynv'l/etc. signature abilities), unique-magic-item-tied
features (the `hb_*` entries tied to specific PCs' legendary items), or
real-base-plus-stated-extension entries whose `source` field already says
exactly what's custom (Primal Companion + Independent, Tactical Foresight vs.
the real Master of Tactics, Insightful Fighting (Revised) vs. the real
Insightful Fighting, Aasimar Transformation combining three real Aasimar forms
into a choose-one, Circle of Stars' 4th "Unbroken" constellation beyond the
real 3, and the whole "Infused Arbalist" homebrew-subclass set which openly
reskins real Artillerist features under a different, non-official subclass).
Verified each of these against the real source text via WebFetch/WebSearch
rather than trusting the `source` field's own claim.

**Lighter-touch pass on the unflagged pool** (230+ entries with no `homebrew`
field at all, per the TODO — grew to 331 in `published_features.json` + 182 in
`published_spells.json` by now). Spot-checked, not exhaustive, per the TODO's
own lower-priority framing:

- Random samples (15 spells, 25 features) came back essentially all correctly-
  cited real content (PHB/XGE/TCE/etc.) — confirms the TODO's own hypothesis
  that most of this pool is safe.
- Found a concrete, actionable sub-issue though: **9 entries already carry
  `needs_review: true` with no `homebrew` field either way** — a stale
  internal marker from an earlier session that never got resolved. Checked all
  9:
  - 7 are genuinely homebrew and should get `homebrew: true`:
    `pub_totemic-assault`, `pub_life-bearer`, `pub_totemic-blessing`,
    `pub_spirit-communion`, `pub_sacred-focus-mind` (all tagged class
    `"Shaman"`/`"Shaman (Witch Doctor)"` — not a real 5e class, so clearly
    homebrew), `pub_dagger-of-swift-strike` (unique item feature, no source),
    `pub_grandmaster-s-stitch` (campaign Legendary item, Weaver's Master-Awl).
  - 2 are verified real published content and should get `homebrew: false`
    (their own `source`/`note` fields already cite the right book, just never
    got the boolean set): `pub_tempest-cleric-thunderbolt-strike` (real
    Tempest Domain Cleric, 8th level, Player's Handbook) and
    `pub_blessed-strikes` (real optional Cleric feature, _Tasha's Cauldron of
    Everything_, already correctly noted as "replaces Divine Strike").
- Separately found `pub_independent` (the companion feature `pub_primal-
companion`'s own source note points to) has **no `homebrew` field set at
  all**, despite its own `description`/`source` text explicitly saying "Table
  houserule" and "Homebrew companion feature" — should get `homebrew: true`
  added to match what it already says about itself.

Nothing above has been changed in the data files — this entry and the report
handed back to the project owner are the record, pending a go-ahead to apply
the fixes.

## Phase 7d — Warlock Eldritch Invocations, Pact Boon, and a GENERIC known-

spell/cantrip picker (2026-09-02, project owner: "Add invocations the hard
way, please, same with boons... The level up wizard should be able to
display allowed-to-be-chosen spells and a number that must be selected and
add them... Make it happen please.")

Motivated by rebuilding Kerra (Fighter 4/Warlock 5 → 8) from scratch to fix
known bugs on her current sheet — but that rebuild is the project owner's
own job, done directly, NOT part of this pass; her record was never touched.
Closes 3 real gaps: no invocation catalog/picker existed at all, no Pact
Boon catalog/picker existed at all, and `diffLevelUp.js` already computed
`newKnownSpells` counts but the UI only ever showed a dead note ("pick them
on the spellbook" — no such flow exists), plus `cantripsBefore/After` was
computed and then silently thrown away, no pendingChoice at all.

**A lucky find that shaped the whole approach**: `src/data/api_data_cache/
features.json` (the SRD cache) already had full RAW text + structured
`prerequisites` for all 32 real PHB Eldritch Invocations, Pact Boon, and
Pact of the Blade/Chain/Tome — nobody had built a catalog or picker around
it yet, but the raw material was already sitting there, pre-verified by the
same source this project already trusts for every other feature tooltip.
Cross-checked the invocation list + every prerequisite against
dnd5e.wikidot.com (WebFetch) and the exact "Invocations Known" breakpoint
table (2:2, 5:3, 7:4, 9:5, 12:6, 15:7, 18:8) against 5thsrd.org's Warlock
class table — both independent sources, matching the feat-catalog task's
verification bar. **Deliberately excluded**: Sword Coast Adventurer's
Guide's 2 additional invocations (Eldritch Smite, Tomb of Levistus) — real
content, but not in the local SRD cache and not asked for; flagged in
`invocations.json`'s own `_schema` rather than silently added or silently
dropped, same "flag, don't guess or over-deliver" pattern as the Battlerager/
Drakewarden subclass skips elsewhere in this file.

**Schema — new `engine/data/invocations.json`** (32 entries) and
`engine/data/pact-boons.json` (3 entries), same `name -> {source, id,
prerequisite}` shape feats.json established. `id` deliberately equals the
SRD cache's own `index` field (and matches the id already sitting in
`feature-catalog.json` from an earlier bulk import) — this means
`lookupFeature(name, id)` resolves full real text straight from the SRD
cache tier with ZERO new `published_features.json` entries required for the
mechanism to work. Added them anyway (29 new invocation entries + Pact Boon

- its 3 options — 3 invocations already existed from Kerra's own sheet
  needing tooltips before this pass) for consistency with the project's
  established "every catalog gets a published_features.json entry too" rule,
  using condensed paraphrases matching that file's existing house style (not
  verbatim WotC text).

**Prerequisite schema — extended `featPrerequisites.js`'s `evaluatePrerequisite`**,
not a second parallel checker (explicit ask): 3 new condition types
invocations need that feats never did — `{type:'level', className, level}`
(a specific CLASS's level, since Warlock levels don't always equal character
level), `{type:'feature', feature}` (character already has a named feature —
how Pact Boon prerequisites are checked), `{type:'cantrip', spell}`
(character knows a specific cantrip — Agonizing Blast/Eldritch Spear/
Repelling Blast all require Eldritch Blast specifically, not just "any
cantrip"), plus `{type:'all_of', all:[...]}` for the 3 invocations gated on
TWO conditions at once (Thirsting Blade/Lifedrinker: level + Pact of the
Blade; Chains of Carceri: level + Pact of the Chain). `engine/rules/
invocations.js` is the new adapter (`loadInvocation`, `meetsInvocationPrerequisite`,
`invocationsKnownForLevel`, `loadPactBoon`, `listPactBoons`) — thin, mostly
just calling into the shared evaluator.

**Real bug found and fixed while building the live test**: a naive client
would evaluate invocation eligibility against the character's CURRENTLY
SAVED level, not the level they're in the middle of leveling UP TO — which
would make every level-gated invocation (Mire the Mind: "5th level", etc.)
show as unavailable WHILE picking that exact level's invocations, only
becoming pickable a level too late. Fixed in `LevelUpTool.vue`'s
`loadInvocationEligibility`: POSTs a one-off projected copy of the draft
character with the leveling-up class's level bumped to `targetLevel` before
asking the engine, without mutating `draftCharacter` itself (that still only
happens at Confirm, unchanged). Verified both directions live: Thirsting
Blade (needs level 5 + Pact of the Blade) shows `met: true` for a level 4→5
preview with Pact of the Blade already on the sheet, and `met: false` with
the exact "Requires the Pact of the Blade feature" reason for an otherwise-
identical character missing the boon.

**Pact Boon: strict one-time pick, no swap support** — gated on `!hasPactBoon
&& finalToLevel >= 3` in `diffLevelUp.js`, checked by scanning
`character.features` for any `type: 'pactBoon'` entry, ever. **Invocation
swapping (real RAW: "when you gain a level in this class, you can replace
one invocation you know with another") is a deliberate v1 cut**, flagged
here rather than half-built — same spirit as Tough's retroactive HP in the
feat-catalog pass. The count-owed math (`invocationsKnownForLevel(toLevel) -
(character's current invocation-typed feature count)`) is self-healing and
robust to re-running a preview mid-pick, but has no path for "replace X with
Y" at all yet; a future pass would need a distinct UI action for that, not
folded into the "pick N new ones" flow.

**Pact of the Tome's bonus cantrips reuse the SAME generic picker
mechanism**, not a bespoke one-off — `pool: 'any'` on
`listSpellsForClass`/`POST /api/engine/spell-choices` skips the class-list
filter entirely (verified live: the picker offered Guidance, a Cleric-only
cantrip, to a Warlock). Written to `patch.spells` with `featureGranted: true,
_source: 'Pact of the Tome'` — the same exemption mechanism
`validateCharacter.js`'s known-spell-cap check already honors for any
feat-granted spell, so these correctly don't count against the Warlock's own
known-spell limit, matching real RAW ("don't count against your number of
cantrips known").

**The generic spell/cantrip picker — the highest-leverage piece, not
Warlock-specific**: `diffLevelUp.js` now turns a positive
`cantripsAfter - cantripsBefore` delta into a `newCantrips` pendingChoice for
ANY spellcasting class (previously computed and silently discarded), and the
existing-but-dead `newKnownSpells` pendingChoice now actually resolves via
a picker instead of a note pointing at a spellbook flow that didn't exist.
New `engine/rules/spellLists.js` functions: `listSpellsForClass(className,
{maxLevel, cantripsOnly, pool, excludeNames})` (class-list + level-cap
filtering) and `effectiveMaxSpellLevel({className, subclassName, level,
otherClasses})` (the highest spell level actually selectable right now —
pact slot level for Warlock, highest nonzero normal/multiclass slot
otherwise) — both engine-side per the project's "engine stays the source of
truth" architecture, not client-side filtering convenience. New
`POST /api/engine/spell-choices` route composes them; third-caster subclasses
(Eldritch Knight/Arcane Trickster) are mapped to Wizard's list before
calling in, matching how every other spellcasting lookup in this codebase
already handles that case. Verified live: Suggestion (level 2, correctly
looked up via `findSpellRecord` rather than trusting a client-supplied
level) written into `patch.spells` with `type: 'chosen'` — the exact shape
Kerra's own real Eldritch Blast/Hex entries already use, not a new
convention.

**Real pre-existing data gap found and fixed along the way**: Hex — one of
the most iconic Warlock spells, and already sitting in Kerra's own real
`spells[]` — didn't exist ANYWHERE in the local spell catalog (neither the
SRD cache nor `published_spells.json`), so it could never have been offered
by the new picker. Verified real PHB text against dnd5e.wikidot.com and
added to `published_spells.json`. Not a full spell-catalog audit (7c is
still "not urgent" for the other ~500) — fixed because it directly
undermined this exact feature's usefulness for the motivating Warlock
use case, not sought out separately.

**UI (`LevelUpTool.vue`)**: 4 new always-visible one-time-choice cards
(matching the existing subclass/ASI cards' philosophy — required choices
live outside the step tabs so they're never mistaken for optional detail),
all gating `canConfirm` the same way subclass/ASI already do: Eldritch
Invocations (checkbox list, live description panel, a "Show all invocations
(ignore prerequisites)" DM-override checkbox identical in spirit to the
feat picker's own), Pact Boon (a 3-option `<select>`), Pact of the Tome's
bonus-cantrip sub-picker (appears automatically once Tome is chosen — same
pendingChoice-driven pattern as everything else, no special-casing), and the
generic cantrip/known-spell pickers (search-filterable checkbox lists,
capped at the count owed). New routes: `GET /api/engine/invocations`,
`POST /api/engine/invocation-eligibility` (mirrors `feat-eligibility`
exactly), `GET /api/engine/pact-boons`, `POST /api/engine/spell-choices`;
`preview-level-up` now also accepts `invocationChoices`, `pactBoonChoice`,
`pactBoonBonusSpells`, `spellChoices`.

**Live-verified in the browser** (Playwright, backend restarted for the
`engine/`+`server.js` changes): rather than test scenario characters
against the real roster (the task's own rule — draft-preview-only, no
Confirm/Save ever clicked, matching the feat-catalog precedent), 4 synthetic
fixture characters were injected directly into the in-memory Vuex store
(`$store.state.characters.push(...)`, never written to disk, gone on reload)
at Warlock levels 1, 2, and 4 — the only way to exercise levels 2/3/5's
pickers without ever calling `APPLY_LEVEL_UP`. All 4 round-tripped with zero
console/page errors: Warlock 1→2 (invocation picker count 2 + newKnownSpells
count 1, both resolved together), Warlock 2→3 (Pact Boon picker → Pact of
the Tome → 3-cantrip cross-class sub-picker → newKnownSpells, all in one
screen), Warlock 4→5 with Pact of the Blade already on the sheet (Thirsting
Blade correctly selectable) vs. an identical fixture without it (Thirsting
Blade correctly shown disabled with the real reason once "show all" is
toggled). `characters.json` and `user_prefs.json` confirmed untouched via
`git diff` after the run.

**Test coverage**: new `engine/test/invocationsAndPactBoon.test.js` (20
tests) — catalog integrity (32-count, id resolvability against both
feature-catalog.json and the SRD cache, every `level`/`feature` prerequisite
reference names something real, the verified known-count table), prerequisite
evaluation (cantrip-specific gating, `all_of` combinators), and `diffLevelUp`
behavior (count-owed math including the "already known, never re-offered"
case, Pact Boon as a true one-time pick, Pact of the Tome's bonus cantrips,
the generic cantrip pendingChoice firing for a non-Warlock class, and real
spell-level lookup on write). Full suite: 179/179 passing. `npm run build`
compiles clean.

## Phase 7b — Full feat catalog, "fully wired up" (2026-09-02, project owner:

"build out a full list of feats with the RAW wording and wired up to correctly
grant bonuses AND the tooltips that show calculations should be able to work
with all of them... prerequisites must be enforced... i've got tokens and
nowhere else to go")

Closes out the 7b gap logged below (was: 15 feats catalogued against a real
~50-72 total). **All 72 feats of the 2014 PHB/XGE/TCE feat list are now
catalogued** (42 PHB + 15 Tasha's Cauldron of Everything + 15 Xanathar's Guide
to Everything racial feats), each verified against dnd5e.wikidot.com and
cross-checked against aidedd.org's feat filter (the project owner's named
reference — used to confirm the roster is complete, not just as a text
source). Deliberately did NOT include Glory of the Giants' "Strike of the
Giants" line or Fizban's Treasury of Dragons' dragon-gift feats — those are
real WotC content but outside "PHB + the handful of XGE/TCE racial feats"
scope the project owner set, flagged rather than silently included.

**Three files stay in sync per feat** (unchanged convention, just scaled up):
`engine/data/feats.json` (structured mechanical data), `src/data/
published_features.json` (`category: "feat"`, real RAW-paraphrased text +
`source`), `engine/data/feature-catalog.json` (id→name). A new test,
`engine/test/featsCatalog.test.js`, asserts the 72-count and the 1:1 name
match between feats.json and published_features.json's `category:"feat"`
entries in both directions, plus id resolvability — this is now a real
regression guard, not just a one-time audit.

**Schema additions to feats.json** (documented inline in its own `_schema`
key — read that before adding feat #73):

- `prerequisite`: was free-text ("Gnome") before this pass, now structured —
  `{type:'ability_score'|'any_of'|'race'|'proficiency'|'spellcasting', ...}`.
  **Enforced**, not just recorded — see below.
- `choices`: a NEW generic schema for any in-feat pick beyond the ability
  score (Skilled's 3 skills/tools, Weapon Master's 4 weapons, Martial
  Adept's 2 maneuvers, Linguist's 3 languages, Elemental Adept's damage
  type, Fighting Initiate's Fighting Style, etc.) — `{id, label, type,
count, options?}`. One rendering path in LevelUpTool.vue handles every
  type generically (a `count`-many `<select>` from `options`, or a
  `<input>` for the two free-text types) — no per-feat special-casing.
  `grants_spells.choice` (Fey Touched/Shadow Touched's school-filtered
  spell pick) is synthesized into this same list client-side rather than
  duplicated into the choices schema, since it already had its own richer
  shape.
- `stat_bonuses`: reuses an EXISTING pattern, doesn't invent one — grepped
  `src/utils/dnd_utils.js` first and found `character.features[].
stat_bonuses` already read generically by `resolveStats()` for AC/saves/
  skills/passive Perception (used today by e.g. Fighting Style: Defense).
  Only added ONE new key to that vocabulary: `initiative` (Alert's +5) —
  `dnd.initiative()` didn't read `bonuses.initiative` at all before this
  pass, a one-line fix mirroring how `passivePerception()` already did.
  Deliberately did NOT add a `stat_bonuses.ac` for Dual Wielder or a "max
  Dex bonus" override for Medium Armor Master — those are conditional on
  current loadout, and the existing mechanism has no "only when X" concept;
  setting them unconditionally would be a correctness bug, not a
  discoverability win, so they stay text-only like before.
- `grants_saving_throw_proficiency` (Resilient only) and `hp_bonus_per_level`
  (Tough only, **deliberately NOT auto-applied** — RAW is a retroactive
  lump sum on the level Tough is taken, then +2/level after; expressing
  that without double-counting on a later re-preview is real complexity for
  one feat, flagged rather than guessed at, same spirit as the project's
  existing "feats beyond ASI/known-spell-count are recorded manually"
  boundary in `asiFeat.js`).

**Auto-application, extended beyond ability scores** (`engine/rules/
asiFeat.js` + `engine/rules/diffLevelUp.js`): taking a feat via the Level Up
tool's picker now writes a real `features[]` entry for the feat itself
(previously it silently applied ONLY the ability bump and added nothing to
`features[]` at all — the feat's own record, spells, and saving-throw
proficiency were 100% manual even for Fey Touched/Shadow Touched, despite
those two already having `grants_spells` data). Now: the ability bump (as
before), the feat's `stat_bonuses` (flows straight into the existing AC/
saves/skills/initiative calculators), Resilient's saving-throw proficiency
(→ `patch.saving_throws`), and `grants_spells` fixed + chosen spells (→
`patch.spells`, same `{name, level:null, prepared:true, featureGranted:true,
_source:featName}` shape a human was already hand-entering — verified
against Denna/Revven/Rith's real Fey Touched/Shadow Touched spell entries
before choosing this shape, not invented). `level:null` on a feat-granted
spell resolves the same way `spellUtils.js` already documented for this
exact case. Everything else about a feat (situational combat text, Weapon
Master's chosen weapons, Skilled's chosen skills) is recorded on the new
feature's `choices` field for display, but not further mechanically
simulated — same deliberate scope boundary as before, just now the feature
entry actually EXISTS to hold that data instead of nothing being written at
all.

**Prerequisites are ENFORCED, not just recorded** — project owner's explicit
call when asked (the honest tradeoff was "record now, enforce later" vs.
"enforce now"; owner chose enforce). New `engine/rules/featPrerequisites.js`
(`meetsFeatPrerequisites`, another `diffLevelUp.js`-style adapter — the only
other place besides that file and `validateCharacter.js` that knows the
characters.json shape) + `POST /api/engine/feat-eligibility` (mirrors
`preview-level-up`'s "POST the client's in-memory character, get a pure
computation back" pattern). LevelUpTool.vue's feat `<select>` filters out
anything with an unmet prerequisite by default, with a "Show all feats
(ignore prerequisites)" checkbox DM override (greys the option out with a
"(prereq not met)" label instead of hiding it, rather than a hard block —
matches this project's existing soft-override philosophy for multiclass
prerequisites). One real data-quality call made explicitly: almost no
character in `characters.json` populates `armor_proficiencies`/
`weapon_proficiencies` at all (checked before assuming otherwise), so a
proficiency-type prerequisite (Heavy Armor Master, Fighting Initiate, etc.)
on a character with no tracked data is treated as **met, with a note** —
hard-blocking here would hide Heavy Armor Master from a Fighter standing in
full plate for no reason but a blank field. Ability-score and race
prerequisites are always reliable (every character has stat_str..stat_cha
and a race) and ARE hard-enforced. Covered by `featsCatalog.test.js`.

**Live-verified in the browser** (Playwright, backend restarted to pick up
the `engine/data/` + `server.js` changes, frontend hot-reloaded) against
Denna (Human Rogue 9→10, a real ASI-level character already on the roster —
not touched, no Save/Confirm ever clicked): Resilient (ability+saving-throw
choice), Skilled (3-of-any-combination choice, a genuinely different choice
shape), Alert (no ASI, pure `stat_bonuses`), and Fey Touched (ability choice

- synthesized spell-text choice) all round-tripped through the picker with
  zero console/page errors, correct live description-panel updates, and
  `canConfirm` correctly gated ONLY by the (unrelated, pre-existing) party
  level cap. Prerequisite filtering confirmed both directions: Denna (Human,
  DEX 20) correctly sees Defensive Duelist/Skulker but not Grappler/Fade
  Away/Inspiring Leader/the spellcasting-gated PHB feats; toggling "show all"
  reveals Fade Away disabled with "(prereq not met)".

**One pre-existing bug found, not caused by this pass, and NOT fixed (flagged
instead — genuinely out of scope, a racial-trait gap not a feat gap)**: Vaz
and Tackett (both Halfling) each carry a `features[]` entry literally named
"Lucky" — the Halfling RACIAL TRAIT (reroll natural 1s), not the PHB feat.
`published_features.json` has never had a distinct "Lucky (Halfling)" entry,
so `lookupFeature`'s name-only matching has silently resolved their racial
trait's tooltip to the FEAT's "3 luck points" text since before this
session. Confirmed via `characters.json` that this predates any change made
here (the collision exists whether or not `pub_lucky` carries
`category:"feat"`) — a real gap in the racial-traits catalog, not
introduced or worsened by this pass, left for a future racial-traits pass
rather than guessed at here.

## Phase 7 — Full RAW content coverage (2026-09-02, project owner: "the engine

## is meant to be ported into a Godot game eventually so we do need it all...

## I would like to have all the subclasses pulled and ready to use so that

## when I'm building characters we don't end up with illegal stuff like what

## we have now")

Scope change from Phase 2 ("only the subclasses currently on the roster") —
this project now wants full coverage of the classic 5e (2014 PHB/SCAG/XGE/
TCE/VRGR — NOT the 2024 revised PHB; matches existing content like "Circle
of the Moon," "Bladesinger," "Great Old One") ruleset, not just what's
in active use, so character creation never has to reach for something
unbuilt. This is genuinely a many-session undertaking — sized honestly
below rather than faked. Started from the Jaygar Artificer audit, which
found the same "roster-only" gap pattern repeating everywhere: missing
subclasses, missing feats, missing feature descriptions.

### 7a — Subclasses (started 2026-09-02, Artificer 4/4 done this session)

`Rogue` (9/9) and `Artificer` (4/4) are complete. Everything else has real
gaps — exact counts as of this session:

- [x] **Artificer — 4/4 done.** Alchemist, Armorer, Battle Smith built this
      session (Artillerist already existed but had 2 real bugs — see the
      Jaygar audit section above — now fixed). All verified against 2
      independent sources, covered by `test/artificerSubclasses.test.js`.
- [ ] **Barbarian — 2/9 done** (Berserker, Path of the Giant). Missing:
      Ancestral Guardian (XGE), Beast (TCE), Storm Herald (XGE), Totem
      Warrior (PHB), Wild Magic (XGE), Zealot (XGE). (Battlerager (SCAG) is
      Forgotten-Realms/Zariel-specific — lower priority, skip unless asked.)
- [ ] **Bard — 2/8 done** (College of Lore, College of Spirits). Missing:
      College of Creation (TCE), College of Eloquence (TCE), College of
      Glamour (XGE), College of Swords (XGE), College of Valor (PHB),
      College of Whispers (XGE).
- [ ] **Cleric — 2/~14 done** (Life, Tempest). The biggest gap of any class.
      Missing: Arcana (SCAG), Death (DMG), Forge (XGE), Grave (XGE),
      Knowledge (PHB), Light (SCAG), Nature (PHB), Order (TCE), Peace
      (TCE), Trickery (PHB), Twilight (TCE), War (PHB).
- [ ] **Druid — 2/7 done** (Circle of the Moon, Circle of Stars). Missing:
      Circle of Dreams (XGE), Circle of the Land (PHB), Circle of the
      Shepherd (XGE), Circle of Spores (TCE), Circle of Wildfire (TCE).
- [ ] **Fighter — 4/10 done** (Battle Master, Champion, Echo Knight,
      Eldritch Knight). Missing: Arcane Archer (XGE), Cavalier (XGE), Psi
      Warrior (TCE), Purple Dragon Knight/Banneret (SCAG), Rune Knight
      (TCE), Samurai (XGE).
- [ ] **Monk — 0/9 done.** Fully empty — `classes/monk.json` exists but zero
      subclasses. Missing: Way of the Astral Self (TCE), Way of the Drunken
      Master (XGE), Way of the Four Elements (PHB), Way of the Kensei
      (XGE), Way of the Long Death (SCAG), Way of Mercy (TCE), Way of the
      Open Hand (PHB), Way of Shadow (PHB), Way of the Sun Soul (SCAG/XGE).
- [x] **Paladin — 8/8 done, 2026-09-02.** Oath of Devotion, Vengeance,
      Conquest, Redemption, and Glory built this session (on top of the
      existing Oath of the Ancients, Oath of the Crown, and homebrew Oath
      of the Open Road [Ferghus's]) — all verified against
      dnd5e.wikidot.com, covered by `test/paladinOaths.test.js`. Found and
      fixed a real content gap along the way: Oath of Conquest's 3rd-level
      oath spell **Armor of Agathys didn't exist anywhere in the local
      spell catalog at all** — added to `published_spells.json` with real
      text. First concrete evidence for the 7c spell-audit question below —
      the "504 unique spells, probably fine" guess was optimistic; expect
      more gaps like this as the remaining classes get built out, not just
      missing descriptions on things that already resolve.
- [ ] **Ranger — 1/7 done** (Gloom Stalker). Missing: Beast Master (PHB),
      Fey Wanderer (TCE), Horizon Walker (XGE), Monster Slayer (XGE),
      Swarmkeeper (TCE). (Drakewarden (Fizban's) is dragon-setting-flavored
      — lower priority, skip unless asked.)
- [ ] **Sorcerer — 2/8 done** (Divine Soul, Weave Attunement [homebrew,
      Iyani's]). Missing: Aberrant Mind (TCE), Clockwork Soul (TCE),
      Draconic Bloodline (PHB), Shadow Magic (XGE), Storm Sorcery
      (XGE/SCAG), Wild Magic (PHB).
- [ ] **Warlock — 1/9 done** (Great Old One). Missing: Archfey (PHB),
      Celestial (XGE), Fathomless (TCE), Fiend (PHB), Genie (TCE), Hexblade
      (XGE), Undead (VRGR), Undying (SCAG).
- [ ] **Wizard — 3/9 done** (Abjuration, Bladesinger, Evocation). Missing:
      Conjuration (PHB), Divination (PHB), Enchantment (PHB), Illusion
      (PHB), Necromancy (PHB), Transmutation (PHB), War Magic (XGE), Order
      of Scribes (TCE). (Chronurgy/Graviturgy (Explorer's Guide to
      Wildemount) are setting-specific — lower priority, skip unless asked.)

Total remaining for the FULL treatment: **~60 subclasses** across 9 classes
(skipping the setting-specific handful noted above). Each still needs the
same rigor as Artificer/Paladin: 2-independent-source verification, real
`published_features.json` entries (not stubs), all 4 tiers filled in, and a
coverage test — don't shortcut verification just to move faster, that's
exactly what produced Jaygar's mess in the first place.

- [x] **2026-09-02: all ~72 remaining subclasses (every class except
      Rogue/Artificer/Paladin, which were already complete) got a STUB
      entry** — project owner wants every real subclass visible and
      pickable in the Level Up tool immediately, even before the full
      multi-tier treatment lands, "so if I go to the level up tool I at
      least can see the options for subclassing." Each stub has: a real
      `class`/`name`, a short flavor `description`, `stub: true`, and
      ONLY the class's first real `subclass_choice_level` filled in with
      real (not hallucinated) feature text — written from training
      knowledge rather than the 2-source-verified pass the complete ones
      get, and each stub feature entry in `published_features.json`
      carries a `verification` field saying so explicitly, plus
      `category: "subclass_feature_stub"` so they're easy to find and
      queue for the real pass later. Covered by
      `test/stubSubclasses.test.js` (every file resolves, has a
      description, first-tier features match the class's real
      `subclass_choice_level`, and every referenced feature actually
      exists in the catalog).
- [x] **Also added: `description` field on every class (`engine/data/
classes/*.json`, all 12) and every previously-built subclass (40 files
      — the ones that predate this stub pass, including the Artificer and
      Paladin sets built earlier this session) that didn't already have
      one** — direct answer to "are there descriptions for classes and
      subclasses we should have and display in the UI?" There wasn't one
      anywhere before this. Short 1-2 sentence flavor/identity text, not
      mechanics (mechanics still live on individual features).
- [x] **UI wired to actually show it**: `LevelUpTool.vue`'s subclass
      picker now has a `title` tooltip per `<option>` (hover before
      picking) and shows the picked subclass's `description` above its
      feature list once selected, with a small "(early preview...)" flag
      when the picked subclass is a stub (`isSubclassChoiceStub`) so a
      player isn't misled into thinking a stub's 1-tier preview is the
      whole subclass. No server changes needed — `GET /api/engine/classes`
      and `GET /api/engine/subclasses/:className` already spread the full
      class/subclass record, so `description`/`stub` flow through
      automatically. `NewCharacterTool.vue` NOT touched yet — same
      treatment would apply there, just not done this pass.

### 7b — Feats (audited 2026-09-02, ~~not yet built out~~ \*\*DONE 2026-09-02

later same day — see the new "Phase 7b" section above this one for the full
writeup\*\*: all 72 PHB/XGE/TCE feats catalogued, mechanically wired,
prerequisite-enforced, live-verified.)

Two different things exist and were both incomplete for different reasons
(original audit below, kept for history):

- `engine/data/feats.json` — deliberately narrow, structured mechanical
  grants for feats that GRANT SPELLS (so known-spell-count math works).
  Only 2 entries (Fey Touched, Shadow Touched) — correct as scoped (still
  "only feats actually in use on the roster," per its own `_notes`), but
  real TCE also added Telekinetic, Telepathic, Metamagic Adept
  (grants-none-directly, already catalogued separately), Skill Expert,
  Fighting Initiate, etc. — expand as they come up, same as before.
- `published_features.json` (`type: "feat"`) — the general feat-text
  catalog, same roster-only pattern as subclasses. **14 entries exist**
  (Sentinel, Dual Wielder, Great Weapon Master, Sharpshooter, War Caster,
  Mobile, Observant, Inspiring Leader, Slasher, Fey Touched, Shadow
  Touched, Lucky, Metamagic Adept, Resilient (Constitution)) against a real
  PHB+TCE total of **~50 feats**. Missing roughly **36**, including some
  very commonly-wanted ones: Alert, Athlete, Actor, Charger, Crossbow
  Expert, Defensive Duelist, Dungeon Delver, Durable, Elemental Adept,
  Grappler, Healer, Heavy Armor Master, Herd Whip? (no), Keen Mind, Linguist,
  Lightly/Moderately/Heavily Armored, Magic Initiate, Martial Adept, Medium
  Armor Master, Mounted Combatant, Polearm Master, Resilient (other 5
  abilities — only CON built so far), Ritual Caster, Savage Attacker,
  Skilled, Skulker, Speedy? (no), Spell Sniper, Tavern Brawler, Tough,
  Weapon Master, plus TCE's Artificer Initiate, Chef, Fey Touched (have),
  Gunner, Metamagic Adept (have), Shadow Touched (have), Skill Expert,
  Telekinetic, Telepathic. Not started — needs the same real-text,
  2-source-verified treatment, not stubs.

### 7c — Feature/spell descriptions

- [x] **All 25 remaining `needs_description: true` stub entries filled
      in**, 2026-09-02 (base Bard/Cleric/Druid/Fighter/Monk/Paladin/
      Ranger/Sorcerer/Wizard Spellcasting and other core features, plus
      Champion's Improved/Superior Critical). One real naming bug caught
      and fixed in the process: the Monk 9th-level Unarmored Movement
      stub was mislabeled "(nonmagical difficult terrain)" — verified via
      web search that the real 9th-level text is about vertical
      surfaces/liquids, not difficult terrain; renamed and fixed
      (`feature-catalog.json`'s id→name entry updated to match).
- [ ] **Spells — likely in decent shape, not urgent.** Local caches
      (`api_data_cache/srd_spells_full.json` + `published_spells.json`)
      cover **504 unique spell names** combined, which is in the right
      ballpark for the full classic-5e spell list (~500 across all
      sourcebooks through TCE) — probably close to complete already
      thanks to the `scripts/build-srd-cache.js` rebuild earlier this
      session. Not spot-checked spell-by-spell for missing/blank
      descriptions — lower priority than subclasses/feats unless a real
      gap turns up in play.

### Priority order for picking this back up

Subclasses first (highest character-creation-legality risk, matches why
this session started), roughly smallest-gap-first for quick wins along the
way: ~~Paladin (done 2026-09-02)~~ → Druid (5 left) → Ranger (5) → Bard (6)
→ Sorcerer (6) → Fighter (6) → Wizard (8) → Warlock (8) → Barbarian (6) →
Monk (9) → Cleric (12, biggest, save for when there's a big block of time).
Feats (7b) can interleave whenever — they're independent of any specific
class's subclass work. Expect real spell-catalog gaps (7c) to keep turning
up as a side effect of each class's oath/domain/expanded spell lists
getting verified — fix them inline when found (like Armor of Agathys
above), same as everything else in this phase.

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
