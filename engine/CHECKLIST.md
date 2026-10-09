# Rules Engine — Build Checklist

Working log for the standalone `engine/` module (see `engine/package.json` — zero
dependencies, no Vue/Vuex imports anywhere in this folder, meant to be portable to
a future Godot port). If this work gets interrupted, **this file is the resume
point** — check what's ticked, read the "Notes" under the current phase, and
continue from the first unchecked item. Run `node --test` from inside `engine/`
to confirm everything still passes before continuing (179 tests as of this
writing, all green).

## Full RAW audit of the 6 subclasses needed for the Torrin/Kerra/Sorra/Lexica rebuilds (2026-09-09)

Project owner's explicit ask, after the Warlock patron finding: do a real
✅-grade audit (every feature checked against a live source this session,
not memory) of whichever subclasses the 4 characters slated for a full
rebuild will actually need — Fighter Champion + Warlock Great Old One
(Kerra), Rogue Soulknife + Rogue Mastermind (Torrin — his old
`subclass: "Soulknife / Mastermind"` string hack needs replacing with one
real pick), Bard College of Spirits (Sorra), Bard College of Lore (Lexica).

Results: **Champion, Great Old One, Soulknife, and Mastermind all checked
out completely accurate** — no fixes needed on any of them (Great Old One's
`expanded_spell_list` was already confirmed correct; this pass added
verification of its other 4 named features). **College of Lore also checked
out clean.** **College of Spirits had 3 real, substantive gaps**, not just
one narrow miss like Swords/Archfey:

- Tales from Beyond's description dropped its entire second step — real
  RAW is a bonus action to roll on the Spirit Tales table, THEN a separate
  action to target a creature within 30ft (can target self). Local text
  only had the bonus-action roll, with no targeting step at all.
- Guiding Whispers was missing that its free Guidance cantrip explicitly
  doesn't count against the normal cantrip limit.
- Spirit Session was missing its "up to proficiency bonus" participant cap
  and "doesn't count against spells known" clause, and its own source note
  incorrectly implied it was just an alternate name for Spiritual Focus's
  6th-level bonus rather than a second, genuinely separate feature that
  happens to also trigger at 6th level (both are real and both apply).

All 3 fixed in `published_features.json`. `SUBCLASS_AUDIT.md` updated to ✅
for all 6, with an honest note on Champion's search results nearly getting
contaminated by 2024-ruleset content (that revision moves Remarkable
Athlete to 3rd level and changes several breakpoints) — worth remembering
for any future Fighter/other-post-2024-revised-class searches, since results
increasingly blend both rulesets without saying so. Verification:
`npm run build` clean, `node --test` 218/218.

**See `SUBCLASS_AUDIT.md`** for the per-subclass RAW-accuracy checklist — the
113 subclasses in `data/subclasses/` were built quickly (2026-08-25 through
2026-09-06) and most have never been verified against real published text.
Pick unchecked rows from that file when there's budget to spare; update its
Status column when you do, so the same ones don't get re-checked twice.

## 7 of 8 Warlock patrons were missing their entire Expanded Spell List (2026-09-09)

Project owner grew worried, after finding Lexica/Sorra's character data was
genuinely corrupted (not just "one bad spell" — see `TODO.md`), that the whole
low-effort subclass build batch might be similarly unreliable. Asked for a
couple of random subclasses to be spot-checked at full depth.

Randomly drew **Bard College of Swords** and **Warlock The Archfey** (a real
random sample via `python3 random.sample`, not cherry-picked). Swords had one
narrow, real error — Mobile Flourish's description was missing its entire
second clause ("you can then immediately use your reaction to move up to your
walking speed to an unoccupied space within 5ft of the target"), fixed in
`published_features.json`. Archfey had something much bigger: **no
`expanded_spell_list` field at all** — one of a Warlock patron's two or three
defining mechanics, entirely absent.

Checked all 8 non-Great-Old-One patrons: **7 of 8 were missing it entirely**
(only Great Old One, built in an earlier separate pass, had one). Sourced and
added real tables for all 7 (Archfey, Celestial, Fathomless, Fiend, Genie,
Hexblade, Undead, Undying), each verified via live web search/fetch this
session, not trained-knowledge recall — see each file's own content. The
Genie is a structural outlier worth remembering: its expanded list genuinely
branches by which genie kind (Dao/Djinni/Efreeti/Marid) the warlock bonded
with, so it's shaped `{all, dao, djinni, efreeti, marid}` per level instead of
a flat array like every other patron — any future code reading
`expanded_spell_list` generically needs to handle both shapes.

Then ran a cheap, zero-web-search **structural sweep** across all 113
subclasses (comparing `features_by_level`'s keys, plus the documented
`option_catalog_level_gained`/`known_count_by_level` alternates, against each
class's real `subclass_feature_levels` table) to see how far this class of
bug — an entire mechanic silently missing — actually spreads. Found only 3
more flags, and checking each one individually showed all 3 were legitimate,
already-documented non-bugs (Circle of the Moon's homebrew level-8 addition,
Purple Dragon Knight's documented in-place 18th-level upgrade, and Oath of the
Open Road's already-known incomplete table). **Zero new structural gaps found
outside the Warlock patrons.**

Explicit scope note, per the project owner: fixing the Warlock patrons' spell
lists is **not** the same thing as a full RAW audit of those patrons (their
other 4 named features per patron were never independently re-verified this
session), and the structural sweep only catches "is a whole mechanic missing
or a level wrong" — it says nothing about whether existing feature text is
accurate the way the Mobile Flourish bug was. See `SUBCLASS_AUDIT.md` for the
honest, per-subclass breakdown of exactly what has and hasn't been checked —
built specifically so future sessions don't have to re-derive this or
accidentally re-check the same ones. Verification: `npm run build` clean,
`node --test` 218/218.

## "Ready for a real game" architecture audit (2026-09-08)

Project owner's framing: this app is a sunset PoC and will eventually hand off
to a real game (Godot port has been discussed elsewhere — see
`engine/package.json`'s own description). Asked for an audit of how the data
and methods are structured toward that, plus small/medium fixes along the way.
Also did a one-time, explicitly-authorized live Playwright pass over New
Character / Level Up first (Playwright is normally disabled entirely per
`CLAUDE.md` — that default resumes immediately after this session; nothing was
installed into the real `package.json`) and found + fixed 4 real UI bugs; see
`TODO.md` for that writeup, this entry is the data/architecture half only.

**Findings, roughly most → least actionable:**

1. **No canonical character schema doc existed anywhere** — the shape of a
   `characters.json` entry was only ever tribal knowledge scattered across
   `validateCharacter.js` comments, `diffLevelUp.js`, and whichever Vue
   component last needed a field. This is the actual blocker for a new
   consumer (Godot or otherwise) — they'd have no starting point. **Fixed**:
   wrote `engine/CHARACTER_SCHEMA.md`, sourced from what `validateCharacter.js`/
   `diffLevelUp.js` actually read, including the messy parts called out
   explicitly rather than smoothed over (3 different "this spell is free"
   conventions, `classes[].started` being load-bearing but optional, no
   `tool_proficiencies` field anywhere, spells not tagged by granting class).
   Deliberately did NOT migrate `characters.json` to fix any of these — that's
   real roster surgery, a bigger call than this pass's scope, and now has a
   checklist for whenever that migration actually happens.

2. **`engine/rules/spellLists.js` reaches outside `engine/data/`** into
   `src/data/api_data_cache/srd_spells_full.json` and
   `src/data/published_spells.json`. Checked whether this was an oversight —
   it isn't: the file has its own comment explaining this is deliberate (spell
   _text_ already lives in `src/data`; copying it into `engine/data` would just
   be a second copy to drift out of sync). Left as-is; noted here only so a
   future porter doesn't have to rediscover the reasoning.

3. **`classFeatures.js`'s `listClasses()` and `subclasses.js`'s
   `listSubclasses()` both use `fs.readdirSync`** to enumerate every file in
   `data/classes/`/`data/subclasses/` — the one real portability gap in
   engine/, since "list a directory" is Node/host-filesystem-specific in a way
   plain "read this named file" isn't (every other engine/ file does the
   latter). Not fixed — the real fix (a generated static manifest, or bundling
   every class/subclass into one JSON blob) changes how classes/subclasses get
   authored day-to-day, which is a bigger call than this pass's scope while
   this app is still the active editing tool. Added inline comments at both
   call sites pointing here so it's not rediscovered as a surprise later.

4. **`src/utils/dataService.js` and `server.js` already have the right shape**
   for this transition and needed no changes — `dataService.save()` already
   no-ops in production with an explicit "saved parties are a DM/dev tool"
   comment, `server.js` is explicitly headed "NEVER deployed — development
   only," and `merge-utils.js`'s 3-way merge is genuinely solid (keys array
   elements by `id`/`name`, not index). Confirmed rather than assumed by
   reading both in full.

5. Confirmed `engine/` has zero real Vue/Vuex coupling (one comment in
   `diffLevelUp.js` mentions `LevelUpTool.vue` by name, not an import) — the
   "framework-free" promise in `engine/package.json` holds today.

Verification: `node --test` 218/218 (untouched — this pass added a doc file
and two comments, no logic changes); `npm run build` clean.

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

(Note, 2026-09-25: most engine work after this point got logged in
`TODO_ARCHIVE.md` instead of here for a long stretch — this file went stale.
CLAUDE.md's standing rule is that engine work gets a dated entry HERE, so
resuming that convention below rather than deciding it's obsolete.)

## Feature-mechanics catalog — real single source of truth for action_type/uses_max/recharge (started 2026-09-24/25)

**The problem this solves**: `action_type`/`recharge`/`uses_max` for a tracked-use feature (Action Surge, Second Wind, Divine Sense, ...) had NO canonical source anywhere — not the SRD cache (raw description text only), not `feature-catalog.json` (a bare id->name map), not `classFeatures.js`/`subclasses.js`. Every character's copy was independently hand-typed, and — worse — `diffLevelUp.js`'s generic feature-grant code never set these fields at all, so a BRAND NEW character built through the Level Up tool today would still need a human to notice and hand-type them afterward, same as the hand-authored roster. Confirmed via `grep`: zero references to `action_type` anywhere in `diffLevelUp.js`/`classFeatures.js`/`subclasses.js`/`feature-catalog.json` before this work started. Project owner's framing, after finding this from a live audit: "That's now a huge project that we either do well or ignore... it's worth doing but it has to be done well."

**Design, worked out in discussion before building anything**:

- `diffLevelUp` stays the sole rules/legality authority — this project doesn't change that, only where MECHANICAL METADATA (not choices) comes from.
- `uses_max` is a pure function of character state where RAW says so (level, ability modifier) — computed fresh each time, not hand-typed once and trusted forever. `uses_current` is the one genuinely mutable, per-character, persisted fact.
- A per-turn cap (Action Surge 17th: "twice before a rest, but only once on the same turn"; Sneak Attack: same shape, no pool at all) is a THIRD axis, separate from uses_max/recharge — modeled as ephemeral combat-session state (`combatTurn.js`'s existing per-combatant `resources` object, generalized to accept extra keys beyond action/bonusAction/reaction), not persisted to the character record, since "used this turn" only has meaning inside an active encounter and `combatTurn.js` already correctly resets on both triggers that matter (start of that combatant's own turn, and combat ending/restarting).
- Declarative data over code where the shape allows it (a flat number, a level-tiered table) — but not forced into a fixed taxonomy where a real rule doesn't fit; `uses_formula`'s two shapes (`ability_mod`, `level_multiple`) were added only because Divine Sense and Lay on Hands genuinely needed them, not speculatively.
- **Incremental, feature by feature** — deliberately not a big-bang rewrite of the whole ~1221-entry catalog. `engine/data/5e/feature-mechanics.json` is a small, separate file (not a reshape of the existing name-only `feature-catalog.json`), and an uncataloged feature falls back to today's bare-grant behavior rather than erroring.

**Built**:

- `engine/data/5e/feature-mechanics.json` — the catalog itself. 7 entries so far: `action-surge-1-use`/`-2-uses` (tiered, `per_turn_cap`), `indomitable-1-use`/`-2-uses`/`-3-uses` (tiered), `sneak-attack` (`per_turn_cap`, no pool at all), `second-wind` (flat), `uncanny-dodge` (reaction, no pool), `divine-sense` (`uses_formula: ability_mod`), `lay-on-hands` (`uses_formula: level_multiple`).
- `engine/rules/5e/featureMechanics.js` — loader, mirrors `featureCatalog.js`'s existing pattern exactly.
- `diffLevelUp.js`'s new `applyFeatureMechanics(features, character)` — runs once on the FULL final feature list (existing + newly granted) right before `patch.features` is built. Three jobs: (1) fill in missing mechanical fields from the catalog by id, never overwriting a value already present; (2) merge tiered ids into ONE character-facing entry instead of stacking duplicates (Action Surge showing as two separate tiles was the original bug that started this whole project); (3) for a `uses_formula`-backed entry, RECOMPUTE AND OVERWRITE `uses_max` every call, since the formula's inputs (ability score, class level) can genuinely change between calls — this one does NOT follow the fill-if-missing rule the other two do, on purpose.
- **Real bug found building this, not just a design nicety**: the call to `applyFeatureMechanics` was originally gated behind `if (newFeatures.length)`. Several classes have "quiet" levels granting nothing new at all (Paladin 4/7/8/9, for instance) — a `uses_formula` feature still needs to recompute on those calls too, since the level it depends on changed even though no new FEATURE did. Caught via a Paladin 1->9 simulation: Lay on Hands' pool froze at 30 (stale, from whichever was the last level with an actual new grant) instead of the correct 45 (9 x 5). Fixed by removing the guard — `applyFeatureMechanics` is a safe no-op pass-through for anything without a catalog match, so running it unconditionally costs nothing.
- `combatTurn.js` — `freshResources`/`createCombatTurnState`/`advanceTurn`/`resetResourcesFor`/`syncOrder` all generalized to accept extra per-combatant resource keys, fully backward compatible (default empty).
- UI threading: `turnResources` prop + `feature-turn-toggle` event through `CombatContext.vue -> Battle.vue -> CharacterCombatPanel.vue -> FeaturePillsPanel.vue`, reusing the SAME generic `toggle-resource`/`setResource` mechanism the existing action/bonus/reaction pips already use — no new Vuex plumbing. `FeaturePillsPanel.vue` disables a per-turn-capped spend once used this turn (even with pool remaining), and shows a manual mark-used toggle for a pool-less per-turn feature like Sneak Attack (the app has no way to detect a qualifying attack happened, so this has to stay a human's call).
- Validated end-to-end with a real throwaway test character (`ActionSurgeTest`, Fighter 17/Rogue 1, built via actual `diffLevelUp` calls, not hand-typed) — confirmed Action Surge merges to one tile at `uses_max: 2` with `per_turn_cap: true`, Indomitable merges to `uses_max: 3`, Sneak Attack grants cleanly with no pool. Deleted after the project owner confirmed the UI wiring worked.
- Roster backfill (`applyFeatureMechanics` run directly over every existing character, plus a hand-verified name->id backfill for the ~23 existing entries that predated this catalog and had no id at all): unified 4 different "Sneak Attack (Nd6)" name variants into one canonical "Sneak Attack" across 6 Rogues; added the missing `action_type: reaction` to Uncanny Dodge on all 4 characters who had it untracked; backfilled Divine Sense (previously untracked entirely on 2 of 3 Paladins) and Lay on Hands' ids on all 3.

**Real bug in `uses_formula: ability_mod`, caught by the project owner 2026-09-25, corrected same day**: the backfill first landed Chuknora's Divine Sense at `uses_max: 0` and Enauweyn's at `4`, both computed from BASE `character.stat_cha` only (9 and 17 respectively). Both were wrong — `resolveUsesFormula` has no access to equipped-item stat bonuses at all, because that data (`party_items.json`, and the `dnd.resolveStats()` function that aggregates it) lives in `src/`, outside `engine/`'s boundary on purpose (Godot-port portability). Chuknora has a Bright Red Cloak (`stat_bonuses: {cha: 1}`, base 9 -> effective 10, mod +0 -> Divine Sense should be **1**); Enauweyn has a Green Fey Armor (`stat_bonuses: {cha: 1}`, base 17 -> effective 18, mod +4 -> Divine Sense should be **5**). Ferghus has no CHA-boosting item, so his `5` was already correct. Both corrected by hand in `characters.json`.

Note this bug is isolated to `ability_mod`-formula features specifically — Action Surge/Indomitable/Second Wind (flat/tiered) and Lay on Hands (`level_multiple`, no ability score involved at all) were never exposed to it. Precedent check: `diffLevelUp.js`'s existing HP-from-CON calculation (`conMod = abilityModifier(scores.con)`) has this exact same base-stat-only limitation and always has — so this isn't a new inconsistency introduced by this work, but for HP that's arguably fine (RAW generally treats HP-per-level as locked in at the level it's gained), whereas Divine Sense's RAW text ("a number of times equal to 1 + your Charisma modifier") reads as evaluated live, not locked at a level milestone — meaning the base-stat-only limitation is a more genuine miss here than it is for HP.

**Fixed for real the same day, not left as an open question** — the project owner's own framing settled it: "do we not pass into the engine the things that we want to be computed?... when a character needs a rules expert (the engine) to make a calculation, the engine needs to get the information required to make an accurate output." `engine/` still never reads `party_items.json` itself (that stays a hard boundary — see `abilityScores.js`'s own header comment), but it's now a real INPUT the caller can supply:

- New `engine/rules/5e/abilityScores.js` — `resolveEffectiveScores(character, equippedItems)`, a pure, portable function mirroring `dnd_utils.js`'s `resolveStats()` ability-score-resolution passes exactly (stat_overrides, then item stat_bonuses, then feature stat_bonuses), scoped to just the 6 ability scores (not the AC/derived-bonus fields `resolveStats` also handles, which aren't relevant here).
- `diffLevelUp`/`applyFeatureMechanics`/`resolveUsesFormula` all gained an `equippedItems` parameter (default `[]`, fully backward compatible — a caller with no equipment data still gets a correct base-only answer, just not equipment-aware, same as every simulation run before this fix).
- `server.js`'s `/api/engine/preview-level-up` route now reads `party_items.json`, filters to `equipped_by === character.name`, and passes that through — this is the ONE place in the whole app that reads that file specifically to feed the engine, matching the project owner's framing precisely: the engine is a calculator, the caller supplies its inputs.
- Verified end-to-end against Chuknora's real data: `resolveEffectiveScores` correctly returns `cha: 10` (base 9 + Bright Red Cloak's +1), and a full `diffLevelUp` call with her real equipped items now resolves Divine Sense to `uses_max: 1` directly, no manual correction needed.

**Verification**: `npm run build` clean, `cd engine && node --test` 296/296 throughout every step, a targeted `validateCharacter` sweep across the entire roster came back clean except the one already-known, already-tracked Sorra (Old) known-spell-cap warning (awaiting her full rebuild, unrelated to this work).

**Not done / open**:

- Only 7 features cataloged so far — this is explicitly meant to grow incrementally, feature by feature, as real duplication/bugs are found, not as a batch project to "finish."
- No `db read_db`/`resources[]`-shaped pools (Ki, Sorcery Points, Superiority Dice) folded into this catalog yet — those live in a different mechanism (`character.resources[]`) and weren't touched here; whether/how to unify them is a separate, not-yet-discussed design question.
- `scripts/assign-feature-ids.py` (the id-backfill script referenced by this whole id-based approach) is confirmed stale — hardcoded macOS path, globs the pre-2026-09-17 `engine/data/classes/` path instead of `engine/data/5e/classes/`. Not fixed yet; today's id backfill was done by hand for a small, verified, specific set of features instead.

**2026-09-26 — feature-mechanics catalog gains a 4th job: `grants_spells` (Circle of Stars' Star Map gap, TODO.md 2026-09-22).**

The TODO item this closes: Star Map's real RAW ("you have the Guiding Bolt spell prepared at all times — it doesn't count against your number of spells known") didn't fit `BONUS_SPELL_FIELDS`' table-keyed-by-level shape, and `druid-circle-of-stars.json` had no `grants_spells` field at all (unlike `feats.json`/`species.json`). Tackett (the only Circle of Stars character on the roster) had been fixed by hand directly on his `characters.json` entry; any _future_ Circle of Stars character built through New Character/Level Up would've hit the identical gap.

**First, a correction to the TODO item's own framing**: re-reading Star Map's full published text (`published_features.json`'s `pub_stars-druid-star-map`, itself corrected 2026-09-10) showed it grants MORE than the TODO note assumed — not just Guiding Bolt always-prepared, but also a free **Guidance** cantrip, AND Guiding Bolt is castable _without expending a spell slot_ a number of times equal to proficiency bonus per long rest. Tackett's own hand-fix only ever captured the "always-prepared" half (`spells_granted: ["Guiding Bolt"]`, no Guidance, no free-cast tracking) — a second real gap on his own sheet, left untouched per the project owner's explicit call to handle Tackett's record personally rather than have this session touch it.

**Scope decision**: checked whether any OTHER subclass shares this "single fixed always-prepared spell" shape before building anything (the TODO item's own stated precondition — "if it's just this one case, a character-level workaround may keep being cheaper than new engine plumbing"). Only one other subclass file has a top-level `grants_spells` at all (`sorcerer-divine-soul.json`'s `affinity_bonus_spell`), and that's a genuinely different shape (a player CHOICE among 5 options, already fully wired via its own picker in `diffLevelUp.js` around line 1489) — Circle of Stars remains the only real case of "fixed, no choice, always-prepared." Built the general mechanism anyway (it's cheap and this exact shape — a class/subclass feature granting one specific bonus spell — is a plausible fit for a future subclass), but explicitly did NOT build the proficiency-bonus-scaled free-cast tracking: that's a materially bigger lift (a per-SPELL uses_max/recharge, recomputed live the way this catalog's `uses_formula` fields already are for a FEATURE — nothing here does that for a spell entry today) for a mechanic only one feature on one character currently needs. Deferred per this catalog's own "deliberately incremental" philosophy, documented directly in `feature-mechanics.json`'s schema so it isn't silently forgotten.

**Built**:

- `feature-mechanics.json` gains a `grants_spells` field: `{fixed: [spellName, ...]}`, mirroring `feats.json`'s own `grants_spells.fixed` semantics (always known/prepared, doesn't count against normal totals). One entry so far: `pub_stars-druid-star-map` → `{fixed: ["Guidance", "Guiding Bolt"]}`.
- `applyFeatureMechanics`'s job 4: fill-only-if-missing `spells_granted` from `mech.grants_spells.fixed` — same protective rule as job 1's `uses_max` (never overwrites a value already present), specifically so Tackett's existing hand-set `spells_granted: ["Guiding Bolt"]` is left exactly as-is rather than silently gaining "Guidance" mid-session out from under a record the project owner asked to review personally.
- No changes needed to the newFeatures-building loop itself — `applyFeatureMechanics` already runs on the full `[...character.features, ...newFeatures]` list right before `patch.features` is built, so a bare "Stars Druid — Star Map" feature grant (no `spells_granted` at all) picks up the fill automatically the same way it already picks up `action_type`/`recharge`/`uses_max`.

**Verified**: a fresh Circle-of-Stars pickup simulation (`diffLevelUp` on a brand-new level-1 Druid → level 2) now produces a Star Map feature with `spells_granted: ["Guidance", "Guiding Bolt"]` with zero hand-authoring. Running `applyFeatureMechanics` directly over Tackett's real feature list confirms his `spells_granted: ["Guiding Bolt"]` comes back byte-for-byte unchanged. `node --test` 303/303, full-roster `validateCharacter` sweep clean, `npm run build` clean.

**Not done / open**: Guidance/Guiding Bolt's proficiency-bonus-scaled free-cast pool (see above) — deferred, documented in the schema, not silently dropped. Tackett's own sheet is still missing the Guidance cantrip and the free-cast tracking on Guiding Bolt; left for the project owner to fold in whenever they finish their own pass on his record, not touched here.

**2026-09-26 — `species.json` gets 2 missing playable races (Goliath, Aasimar) + Eladrin as a real Elf subrace, ids on every trait, and a full roster completeness sweep. Real scope change mid-session, not a small follow-up.**

Started as "why doesn't Goliath/Aasimar/Eladrin exist in `species.json`" (found while auditing why 3 characters' racial traits had no catalog match during the Circle-of-Stars-adjacent id sweep). The project owner's answer reframed the whole task: **"I do want to have a full data store now, that's become a goal. The Godot game needs to not rely on external APIs and those races are playable so we need them"**, plus **"if we're using IDs, everything should use them. If we have a file with species data, it should have all the ones we have in the game."** Root cause for why they were missing at all: `species.json` didn't exist until 2026-08-27, and Chuknora (Goliath) predates it by 4+ months (April 2026) — it just never got backfilled once the structured system existed, consistent with this project's incremental "build what's touched" pattern rather than a deliberate exclusion.

**RAW added** (WebFetch/WebSearch against dnd5e.wikidot.com, cross-checked per this project's standing 2014-vs-2024-contamination caution — one real near-miss caught: a WebSearch for Eladrin's seasonal Fey Step effects surfaced text from an unrelated _monster_ stat block sharing the same book/name, not the player race trait; the original direct wikidot fetch was the correct source and is what got used):

- **Goliath** (Volo's Guide to Monsters): Natural Athlete, Stone's Endurance, Powerful Build, Mountain Born.
- **Aasimar** (Volo's Guide to Monsters): base traits (Celestial Resistance, Healing Hands, Light Bearer) plus all 3 subraces (Protector/Radiant Soul, Scourge/Radiant Consumption, Fallen/Necrotic Shroud) — the subrace numbers cross-checked against a second source (a structured aurorabuilder XML mirror of the actual book) since they're exactly the kind of "surprising, mechanically significant" figures (DCs, radii, damage-scales-with-level) this project's history has been burned by before.
- **Eladrin** (Mordenkainen's Tome of Foes), added as a new entry in Elf's existing `subraces` array (same shape as High Elf/Wood Elf/Drow) rather than a standalone species, since it genuinely is an Elf subrace: `{cha: 1}` incremental ASI (added to base Elf's `{dex: 2}` — the file sums base + subrace bonuses, and MTF's total "+2 Dex, +1 Cha" already includes the elf baseline), Fey Step + a new `season_options` array (mirrors Dragonborn's existing `ancestry_options` pattern) for the 4 seasonal 3rd-level enhancements.

**Consistency work, the bigger half of this entry**: added an `id` field to every trait on every species/subrace already in the file (Human had none to add — no `traits` array at all), not just the 3 new ones — 48 unique species-trait ids total. Reused a shared id (`pub_fey-ancestry`) for the 2 places Fey Ancestry's text is byte-identical (Elf, Half-Elf) rather than minting duplicates for the same concept — same reasoning the class-feature catalog already applies (identical mechanical variant = shared id, distinct variant = distinct id). Merged all 44 genuinely-new ids into `feature-catalog.json` (0 collisions with the 4 already-registered orphaned ids like `pub_darkvision`/`pub_fey-ancestry` that existed but were never actually linked from any character record until today).

**Schema wrinkle found and fixed**: Aasimar's Celestial Resistance grants TWO resistances (necrotic AND radiant) — the first trait in the whole file to need that. `species.test.js`'s `grants_resistance` validator only accepted a single string; extended it to also accept an array, checking each element the same way. Confirmed via a repo-wide grep that `grants_resistance` isn't actually consumed by any application code yet (schema-validation only, so far) — meaning this extension is risk-free today, but is now the schema going forward when it does get wired up.

**Three real bugs found and corrected before trusting the result — the character-record sweep was the hard part, not the species.json authoring:**

1. **Reserializing `feature-catalog.json` with plain `JSON.stringify` broke its ASCII-escaping convention** (the original Python generator uses `ensure_ascii=True`, so em-dashes etc. are stored as `—`; Node's default stringify emits literal UTF-8 instead) AND lost its `sort_keys` alphabetical ordering (new keys just got appended in insertion order). Neither is a correctness bug — the JSON is byte-different but semantically identical either way, verified by parsing old vs. new and diffing every key — but it's a real regression against this project's now-explicit consistency goal. Rewrote with matching `\uXXXX` escaping and a full alphabetical re-sort (verified zero value changes via a parsed-object diff: 1221 old keys unchanged, 44 new ones added, 0 collisions, 0 mismatches) rather than leave the drift in.
2. **The roster sweep completely missed that some characters store racial traits in a _separate_ `species_traits` array, not `character.features`.** `FeaturePillsPanel.vue` concatenates `[...features, ...species_traits]` with **no deduplication by name** — a real, pre-existing two-storage-location split (older hand-authored characters use `features`; characters built through the newer New Character tool use `species_traits`, per `NewCharacterTool.vue`'s `characterShell()`). The first sweep pass, which only checked `features`, wrongly concluded 8 characters (Kessara, Pirra, Tackett, Jaygar, Kerra, Torrin, Lexica, Sorra) were missing traits they already had via `species_traits`, and added real duplicate pills. Also exposed a second latent bug in the detection logic itself: naive genus-string matching classified "Half-Elf" as plain "Elf" (`.includes('Elf')` substring match), which would have wrongly flagged Lexica/Sorra as missing Trance/Keen Senses (Elf traits) instead of correctly recognizing they already had their full, correct Half-Elf trait set.
3. **The first attempted fix for bug 2 introduced a third bug**: it searched for the duplicate lines to remove using a plain whole-file `indexOf` with no per-character scoping. Several of the wrongly-added duplicate lines were byte-identical to a DIFFERENT character's legitimate entry (e.g. Kerra's duplicate "Relentless Endurance" and Rhuna's genuine one are the exact same string, both Half-Orcs, both processed by the same first-pass script) — the unscoped search found and deleted Rhuna's real entry instead of Kerra's duplicate, on 5 of 20 removals. Caught by re-verifying against the ORIGINAL detection query rather than trusting the fix script's own "success" log.

**The actual fix, once both root causes were understood**: reverted `characters.json` to its last commit (project owner approved both reverts explicitly — this session's git-safety rule held) and rebuilt the entire sweep as one script that (a) checks BOTH `features` and `species_traits` for existing coverage before deciding anything is missing, (b) resolves each character's real species+subrace by best-overlap match against whichever array they already use (not naive genus-string parsing), and (c) computes exact byte-offset boundaries for every character's block up front and hard-scopes every single insertion/backfill to `[start, end)` for that one character — a duplicate string existing elsewhere in the file is now structurally impossible to touch, by construction, not by care. New entries get added to whichever array (`features` vs `species_traits`) the character already uses for their other racial traits, matching their own established convention rather than forcing one universal shape.

**Final numbers**: 14 `features` id backfills, 28 `species_traits` id backfills, 18 genuinely-missing trait entries added (split across `features`/`species_traits` per each character's existing convention) — 60 operations, 0 failures, re-verified against the original detection query afterward (0 characters still missing an expected trait, 0 still without an id). Re-ran the full duplicate-pill check specifically (0 name overlaps between any character's `features` and `species_traits`) and specifically re-checked both bug-3 casualties (Rhuna has her 3 real traits back; Kerra has 0 duplicate feature entries, 3 correctly-id'd `species_traits` entries).

**Verification**: `node --test` 303/303, full-roster `validateCharacter` sweep clean, `npm run build` clean, diff of `characters.json` grepped line-by-line to confirm every changed line matches one of exactly 3 expected patterns (id backfill, a `type: "feature"` gaining a trailing comma because a new field now follows it, or a new single-line trait entry) — nothing else touched.

**Not done / open**: no NEW character on the roster currently uses High Elf, Dark Elf (Drow), Hill/Mountain Dwarf, Lightfoot/Stout Halfling, Forest/Rock Gnome-as-written (Jaygar's Rock Gnome traits came from his existing `species_traits`, already correct), or any Aasimar subrace (Iyani's is a full homebrew replacement, intentionally left untouched) — those entries exist in `species.json` now for completeness/Godot-portability but aren't exercised by any real character yet, so they're unverified against a live build-a-character-through-the-tool pass. Worth a quick smoke test the next time `NewCharacterTool.vue` is touched.

---

**2026-09-30 — Architecture correction: "engine/ vs frontend" reframed as a real 3-layer split (rules / game-aide engine / UI), and the missing half of `resolveStats()` moved in — catching a real, live double-counting bug in the process.**

Grew out of a frontend game-logic audit (same day, see the ability-modifier/proficiency-bonus/point-buy consolidation and the `encounterGenerator.js` extraction, both earlier same-day entries) that flagged AC as "too entangled to touch quickly" and deferred it. The project owner pushed back on that call, correctly: AC wasn't actually harder than attack bonus, damage bonus, or saving throws — all of them depend on the exact same `dnd_utils.js` `resolveStats()` aggregator, so singling AC out as uniquely risky was never right. The REAL distinguishing fact (found while re-checking): AC is the _only_ one of these with a breakdown/tooltip feature at all — everything else is a bare `return someNumber`. That's not a reason to avoid it; it's a reason it's the most valuable one to get right first, since the project owner wants that tooltip pattern to spread to every derived stat eventually.

That conversation surfaced the real architectural bug, not just an AC-specific one: `engine/rules/5e/abilityScores.js`'s `resolveEffectiveScores` (built 2026-09-25 for the Divine Sense equipment-bonus fix) mirrors `resolveStats()`'s ability-score-resolution passes exactly, but was deliberately scoped down to just the 6 scores, with a comment justifying the AC/attack/damage/saving-throw half as **"a display concern this engine-side function has no reason to duplicate."** That framing is wrong — those bonuses are the identical kind of rule (item/feature grants a flat number, aggregate it) as the ability-score passes, not a UI concern. The project owner's own reframe, verbatim: a **rules** layer (raw facts, small and pure, changes only when the actual rules change), a **game-aide engine** layer (rules + this campaign's actual data → real numbers AND structured explanations of those numbers), and a **UI** layer (renders what layer 2 produces, computes nothing). "Does this need a network call" and "does this belong in the UI" are different questions — only the second one determines the layer, and this project's docs had been conflating them. Full rewrite of CLAUDE.md's architecture section to state this 3-layer model explicitly, with the AC story as the concrete cautionary example so it doesn't get relitigated from scratch next time.

**Built** (the actual "missing half" of `resolveStats()`, moved to `engine/rules/5e/`, each traced from the real `dnd_utils.js` code before writing anything, each with real test coverage written and run _before_ touching the frontend at all):

- `characterStats.js` — `resolveEffectiveStats(character, equippedItems)`, the FULL 3-pass resolution (`{scores, bonuses, unarmoredBonuses}`), not just the ability-score slice. `abilityScores.js`'s `resolveEffectiveScores` is now a one-line call into this (`.scores`) instead of its own duplicate 3-pass loop — the two can't drift out of sync anymore because there's only one implementation.
- `armor.js` + `data/5e/armor.json` — base AC by armor type (light/medium/heavy categories, DEX-mod handling), extracted from `src/utils/dnd_constants.js`'s `ARMOR_BASE_AC`. Real 2014 PHB data, was hardcoded in a frontend constants file with zero reason to be there.
- `weaponSets.js` — `activeWeaponSet`/`isActiveEquipped`/`isDualWieldingMelee` (the weapon-set-aware "what's actually in this character's hands right now" logic Dual Wielder's conditional AC bonus needs).
- `armorClass.js` — `computeAC(character, equippedItems, {bladesongActive})`, the actual AC math ported from `dnd_utils.js`'s `_acCompute`. Returns `{ value, breakdown: [{label, amount}, ...] }` — a plain list of contributions, deliberately NOT a pre-joined display string, so any future UI (this app's Vue sheet today, a Godot sheet later) can build its own tooltip from the same breakdown without re-deriving the AC math. `dnd_utils.js`'s `acBreakdown()` is now the one place that turns that list into today's joined-string shape.
- New test files: `characterStats.test.js`, `armorClass.test.js`, `weaponSets.test.js` — 23 tests total, covering every armor category, the shield/dual-wielder/bladesong riders, and stat_override/stat_bonus routing. Caught 2 wrong hand-calculated expected values in my own test code while writing these (not bugs in the ported logic) — fixed by redoing the arithmetic, same "verify the test, not just the code" lesson as the `encounterGenerator.js` pass earlier the same day.

**Real bug found and fixed, not just relocated** — tracing `_acCompute`'s exact logic during the port (not skimming it) surfaced a genuine double-count: `resolveStats()`'s pass 3 already folds every feature's `stat_bonuses.ac` into `bonuses.ac`, but `_acCompute` ALSO kept a separate `featureAcBonus` running total from re-iterating `character.features` itself, and added BOTH into the final value. A 2026-09-09 comment on the original code justified the separate total by saying `resolveStats()`'s `bonuses.ac` only counted item bonuses, not feature ones — true when that comment was written, evidently, but `resolveStats()` gained its feature-bonus pass at some point after, and nobody re-checked this function's own assumption against it. Roster sweep: affects exactly one character, **Chuknora** (`Fighting Style: Defense`, `stat_bonuses.ac: 1`) — her live AC was 1 higher than it should have been. Confirmed the project owner wanted it fixed rather than preserved-and-flagged ("if it double counts but the tooltips don't show it I would have a hard time noticing") before changing it. Fix: the per-feature loop still pushes a breakdown line (so the tooltip still explains where the point comes from) but no longer accumulates a second total added to `value` — a real regression test (`armorClass.test.js`, "a feature-granted flat AC bonus is counted exactly once") locks this in.

**Wiring**: `src/utils/dnd_utils.js`'s `resolveStats`, `activeWeaponSet`, `isActiveEquipped`, `isDualWieldingMelee`, `_acCompute`/`ac`/`acBreakdown` are all now thin adapters — filter `party_items.json` down to this character's equipped items (the one piece of app-specific shape-knowledge that has to stay in `src/`, same reasoning as `server.js`'s own `party_items.json` filtering for `diffLevelUp`), call the engine, reshape the return value to match each function's existing external contract (`resolveStats()` still returns `{stats, bonuses, unarmoredBonuses}` — renamed from the engine's `scores` key — since every caller across the app, `AbilityScoreGrid.vue`/`SavingThrowsPanel.vue`/`SkillList.vue`/`VitalsChipRow.vue`/`PartyContext.vue`/`PartyEditModal.vue`/`CharacterSpellbook.vue`, destructures that exact shape). New browser wrappers (`src/utils/characterStats.js`, `armorClass.js`, `weaponSets.js`), same direct-`require()`-the-engine-leaf-file pattern as `combatTurn.js`/`abilities.js`/`progression.js`/`pointBuy.js`/`encounterGenerator.js`.

**Verification**: engine tests written and run standalone first (23 new, all passing) _before_ any frontend wiring — `node --test` 332/332 total. After wiring: `npm run build` clean, full-roster `validateCharacter` clean, and a direct roster-wide AC computation (`computeAC` against every real character + their real equipped items) confirming no `NaN`/no suspicious values across all 25 characters, Chuknora's new value 1 lower than before as expected. Grepped for every external consumer of `dnd.ac`/`dnd.acBreakdown`/`dnd.resolveStats`/`dnd.activeWeaponSet`/`dnd.isActiveEquipped`/`dnd._acCompute` before changing anything, to confirm no caller depended on an internal shape (like the old `.steps` key) that was about to change.

**Known, deliberate, minor side effect**: `acBreakdown()`'s tooltip text formatting changed slightly — every line is now uniformly `${label} (${signedAmount})`, where before some lines (armor base, unarmored formulas) were phrased as plain descriptive text with no explicit "+N" suffix. Same information, consistent format, not pixel-identical to before. Worth a glance next time the project owner is in a character sheet, since this wasn't (and per the standing Playwright-disabled rule, couldn't be) visually verified.

---

**2026-09-30 — Same migration, next chunk: saving throws, skills, initiative, passive perception, spell attack/DC, and weapon attack/damage all moved into `engine/`.** Direct continuation of the AC entry above, same "trace exact logic → write tests → verify standalone → wire thin adapters → verify build/tests/roster" method, same project-owner go-ahead ("yep, go ahead with the next one").

**Built** (all new, each traced from the real `dnd_utils.js` logic before writing anything):

- `proficiency.js` — `effectiveProficiencyBonus(character, bonuses)`, pulled out of `dnd_utils.js`'s private `_prof` helper (it wasn't private in any real sense — every one of the functions below needs it too).
- `checks.js` — `savingThrow`/`allSavingThrows`, `SKILL_MAP`/`skill`/`allSkills`, `passivePerception`, `initiative`/`hasInitiativeAdvantage`, `spellAttackBonus`/`spellSaveDC`. All ported faithfully from `dnd_utils.js`, no logic changes — this chunk was pure relocation, unlike AC's double-count fix.
- `data/5e/weapons.json` + `weapons.js` — the full 36-weapon PHB table (`weaponProps`, `isProficientWithWeapon`), ported from `src/utils/dnd_constants.js`'s `WEAPON_PROPS`. Verified the port was complete via a straight count match (36 weapons in, 36 out) and a spot-check that every thrown weapon kept its `thrown` flag.
- `weaponAttack.js` — `weaponStatMod`, `gripDie`, `attackBonus`, `damageBonus`, `rageDamageBonus`. Same faithful-port approach; `rageDamageBonus`'s PHB level breakpoints (levels 1-8 / 9-15 / 16-20 → +2/+3/+4) carried over unchanged.
- New test files: `checks.test.js` (12 tests), `weaponAttack.test.js` (8 tests) — 20 new, all passing standalone before any frontend wiring. Full suite 352/352.

**Wiring**: `src/utils/dnd_utils.js`'s `initiative`, `hasInitiativeAdvantage`, `savingThrow`, `allSavingThrows`, `SKILL_MAP`, `skill`, `allSkills`, `passivePerception`, `spellAttackBonus`, `spellSaveDC`, `_weaponProps`, `isProficientWithWeapon`, `_weaponStatMod`, `gripDie`, `attackBonus`, `damageBonus`, `rageDamageBonus`, and `_prof` are all now thin adapters, same pattern as the AC wiring — filter to this character's equipped items via a new shared `dnd._equippedOnly(character, partyItems)` helper (replacing several near-identical inline filters), call the engine, return its result directly since none of these functions' external contracts needed reshaping (unlike `resolveStats()`'s `scores`→`stats` rename). New browser wrappers: `src/utils/checks.js`, `src/utils/weaponAttack.js`, `src/utils/proficiency.js`, same direct-`require()`-the-engine-leaf-file pattern as the rest of this migration. `weaponSummary`/`weaponSummaries` deliberately left as-is — they format `dnd.signed(...)` display strings around calls to the now-engine-backed functions, which is correctly layer-3/UI work, not something to migrate.

**Bonus fix, not a new bug**: while converting `_weaponProps`, found it was referencing `WEAPON_PROPS` — a module-level constant that a _previous_ pass of this same migration had already removed from `dnd_utils.js`'s imports (when `data/5e/weapons.json` was created) without updating this one remaining caller. That left `_weaponProps` throwing `ReferenceError: WEAPON_PROPS is not defined` on every call — i.e. every weapon attack/damage/grip-die computation across the whole app was already broken going into this session. Converting the function to delegate to `engineWeaponProps(weapon, HOMEBREW_WEAPON_PROPS)` fixed it as a side effect of the planned migration, not a separate task.

**Verification**: `node --test` from `engine/` — 352/352 (20 new, 332 prior, all green). `npm run build` — clean, no new warnings. Full-roster `engine.validateCharacter()` sweep — 0 issues across all 25 characters. Direct roster-wide attack/damage computation (every equipped weapon on every character, via the engine functions directly) — no `NaN`/`undefined` across ~40 weapon entries, all values sane (e.g. Vaz's Blueflame Rapier +2: atk +12, dmg 1d8+7).

**Not done / open (as of this entry — see the breakdown-expansion entry directly below, same day, for the resolution)**: none of these functions had a breakdown/tooltip yet (bare numbers, like AC's `_acCompute` was before its own migration) — deferred, not forgotten, matching the project owner's stated direction that the tooltip pattern ("that is something that needs to stay... everything should eventually have it") should eventually spread to every derived stat.

---

**2026-09-30 — Breakdown/tooltip pattern extended to saving throws, skills, passive perception, spell attack/DC, proficiency bonus, and weapon attack/damage.** Direct follow-up to the entry immediately above, same day, prompted by the project owner's next instruction ("build out the tooltips; make something extensible if possible, otherwise just try to keep it efficient"). Investigating where tooltips for these stats already lived surfaced the actual motivating problem: several of them had a hand-rolled UI-side tooltip that **re-derived the math a second time** instead of reusing the now-engine-backed number — `SavingThrowsPanel.vue` and `SkillList.vue` each reimplemented the full formula from `resolveStats()`'s raw `stats`/`bonuses` just to build a tooltip string, and `VitalsChipRow.vue` did the same for passive perception and spell attack/DC. `SkillList.vue`'s copy was a confirmed real bug, not just duplication risk: it never implemented Jack of All Trades at all, so a Bard with that feature would show a silently wrong (too-low) skill total in that one component while every other skill display on the same character was correct. `VitalsChipRow.vue`'s prof-bonus tooltip had a matching gap — it described the level table from a hardcoded string and never showed an item-granted proficiency-bonus bonus (e.g. an Ioun Stone of Mastery) at all, even when one applied to the number right next to it.

**Design, extensible per the ask**: every engine breakdown function returns the exact same `{ value, breakdown: [{label, amount}] }` shape `computeAC` established — so `src/utils/dnd_utils.js` needed exactly ONE new shared formatter (`dnd._formatBreakdown`) to turn any of them into this UI's joined-string tooltip, rather than a bespoke string-joiner per stat (which is what the codebase had been accumulating instead, one per component). `acBreakdown()` itself was simplified to a 1-line call into this new shared formatter. Adding a tooltip to some future stat is now: write an `xBreakdown` engine function returning that same shape, export it, add a thin `dnd.xBreakdown(...)` delegate that calls `dnd._formatBreakdown(...)` — no new UI-side string logic required.

**Built** — each existing plain function (`savingThrow`, `skill`, `passivePerception`, `spellAttackBonus`, `spellSaveDC`, `attackBonus`, `damageBonus`, `effectiveProficiencyBonus`) got a `xBreakdown` sibling that does the real computation, with the plain function reduced to `xBreakdown(...).value` — same "single implementation, sliced two ways" shape `computeAC`/`ac()` established, so this was purely additive: every existing caller of the plain functions (including `allSavingThrows`/`allSkills`, which map over them) kept working unchanged, confirmed by the existing 362 engine tests passing with zero modifications needed to them.

- New `engine/rules/5e/breakdown.js` — `bonusLines(sources, key)`, a small shared helper generalizing the named-item/named-feature loop `armorClass.js` originated for AC: items and features both carry `.name` + `.stat_bonuses`, so one function finds every named source of a given bonus key across either list, for tooltip lines. The actual numeric total in every breakdown function still comes from `resolveEffectiveStats`' lump-sum `bonuses` object, never from summing these lines a second time — deliberately avoiding a repeat of the exact AC double-counting bug from the entry two above this one.
- `checks.js` — `savingThrowBreakdown`, `skillBreakdown`, `passivePerceptionBreakdown`, `spellAttackBonusBreakdown`, `spellSaveDCBreakdown`. `initiative` was deliberately left alone — nothing in the UI has ever shown an initiative tooltip, so there was no real duplication to fix and no established format to match; adding one would've been speculative, not requested.
- `weaponAttack.js` — `attackBonusBreakdown`, `damageBonusBreakdown`.
- `proficiency.js` — `effectiveProficiencyBonusBreakdown(character, bonuses, equippedItems)`. Takes `equippedItems` as a new third parameter (the plain `effectiveProficiencyBonus(character, bonuses)` keeps its original 2-arg signature) so the breakdown can name which item granted a bonus; if the caller doesn't have the item list handy, it falls back to a generic "Item/feature bonus" line rather than silently omitting it.
- New/extended tests: `proficiency.test.js` (new, 4 tests), plus breakdown-specific additions to `checks.test.js` and `weaponAttack.test.js` — each asserting the breakdown's `.value` matches the existing plain function exactly, and that a real named contributor (a feature's saving-throw bonus, an item's attack bonus, Raging's damage bonus) shows up as its own line. 10 new tests, full suite 362/362.

**Wiring** — `src/utils/dnd_utils.js` gained one shared `_formatBreakdown({value, breakdown})` helper and a `xBreakdown` delegate next to each existing plain delegate (`savingThrowBreakdown`, `skillBreakdown`, `passivePerceptionBreakdown`, `spellAttackBonusBreakdown`, `spellSaveDCBreakdown`, `attackBonusBreakdown`, `damageBonusBreakdown`, `profBonusBreakdown`). `acBreakdown()` now just calls the shared formatter instead of keeping its own copy of the join logic.

UI consumers moved onto the engine-backed breakdowns instead of hand-rolling their own:

- `SavingThrowsPanel.vue` — `savingThrows` computed now calls `dnd.savingThrow`/`dnd.savingThrowBreakdown` directly; its own second copy of the formula (mod/prof/flatBonus math, just to build a `·`-joined tooltip) is gone.
- `SkillList.vue` — same move for `dnd.skill`/`dnd.skillBreakdown`, which **fixes the real Jack of All Trades gap** described above as a side effect, not a separate task.
- `VitalsChipRow.vue` — `passivePerceptionTooltip`, `spellAttackTooltip`, and the spellcasting-ability branch of `spellDCTooltip` now call the engine breakdowns; `profBonusTooltip` now calls the new `dnd.profBonusBreakdown`, **fixing the missing item-bonus line** described above. The non-caster fallback branch of `spellSaveDC`/`spellDCTooltip` (8 + Prof + best of STR/DEX, shown for a martial character with no `spellcasting_ability`) was left exactly as hand-written code, since `spellSaveDCBreakdown` can't compute a number tied to a field the character doesn't have, and this fallback was never duplicated anywhere else to begin with. `itemBonusBreakdown`, a per-item-by-key grouping computed property this file only used to feed the two tooltips just replaced, is now dead and was removed.
- `dnd_utils.js`'s own `buildWeaponRows` (feeds `WeaponTable.vue`'s per-equipped-weapon `atkTooltip`/`dmgTooltip`) now calls `dnd.attackBonusBreakdown`/`dnd.damageBonusBreakdown` instead of hand-building `atkParts`/`dmgParts` arrays from raw `resolveStats()` output — the now-unused `_itemBonusBreakdown` helper that only ever fed those two arrays was removed along with them. The Martial Arts (monk unarmed strike) and Psychic Blades (Soulknife Rogue) sections of the same function were deliberately left as their own hand-written tooltip logic — neither is a real weapon item running through `weaponAttack.js`, so there's no engine breakdown function for either to call yet.

**Verification**: `node --test` 362/362. `npm run build` clean, no new warnings. Full-roster `engine.validateCharacter()` sweep — 0 issues across all 25 characters (unchanged, since no character data was touched). A direct roster-wide comparison script ran every new breakdown function against every real character (all 6 saves, all 18 skills, passive perception, spell attack/DC, prof bonus, and every equipped weapon's attack/damage) and asserted each breakdown's `.value` exactly matches its existing plain-number sibling — 0 mismatches, 0 `NaN`s, across the entire roster.

**Not done / open**: initiative still has no breakdown (see above — no existing UI duplication to fix, so none was added speculatively). Martial Arts/Psychic Blades weapon-adjacent tooltips in `buildWeaponRows` still hand-rolled, not engine-backed — a real future candidate if either ever needs the same treatment, but out of scope here since they aren't `weaponAttack.js` callers to begin with.

**2026-10-01 — d20 tests (check/save/attack roll + advantage/disadvantage) moved into `engine/`, and one leftover UI-side saving-throw formula removed.** Prompted by the project owner asking for the dice roller's inline math (`14+5 = 19`) to shrink to just the total, with the math in a dotted-underline tooltip like the rest of the app. `DiceRoller.vue` resolved advantage/disadvantage by hand in two separate methods (`roll()` and `rollPending()`) and built its math string inline — real rule logic in the UI, and duplicated.

- New `engine/rules/5e/d20Test.js` — pure `resolveD20Test(rolls, { mode, modifier })` returning the standard `{ value, breakdown: [{label, amount}] }` shape (plus `natural`/`rolls`/`mode`), `resolveMode({ advantage, disadvantage })` (both at once cancel to a single d20, PHB p. 173 — the UI's checkboxes already prevent both, but the rule lives here now), and a thin impure `rollD20Test`. Zero dependencies, browser-required directly via `src/utils/d20Test.js`, same pattern as `abilityScoreRoll.js`.
- `DiceRoller.vue` — both roll paths now call the engine; the result shows only the total, and `dnd._formatBreakdown(test)` provides the hover tooltip (`has-tip` dotted underline) whenever there's math (a modifier, or advantage's two dice).
- `AbilityScoreGrid.vue`'s `savingThrows` computed still hand-rolled mod + prof + flat bonus from `resolveStats()` — the 2026-09-30 migration fixed the identical copy in `SavingThrowsPanel.vue` but missed this one (and `SavingThrowsPanel`'s comment wrongly claimed AbilityScoreGrid already used the shared functions). Now calls `dnd.savingThrow`/`dnd.savingThrowBreakdown`, and the save modifier gained the matching tooltip.
- Also fixed the same session: `DiceRoller`'s `pendingRoll` watcher is now `immediate` — `Drawer.vue` v-if's its slot, so a roll clicked with the drawer closed mounted a fresh DiceRoller that never saw the already-pending roll.
- Tests: new `d20Test.test.js` (6 tests). `node --test` 368/368, `npm run build` clean.

---

**2026-10-01 — Engine migration, next sweep: HP, rests, limited-use tracking, unarmed/psychic attacks, house rules, weekly events, ability-score attribution, prepared-spell limit.** Prompted by the project owner's "continue the engine migration." Method as before: find game math living in `src/` (store mutations, component methods, `dnd_utils.js`), move it to a pure engine module with an injectable `rng` where dice are involved, test it standalone, then make the UI a thin adapter. Each new browser-facing module is a zero-fs/path leaf with a `src/utils/<name>.js` wrapper that requires the leaf directly (never the barrel).

**Built** (all in `engine/rules/5e/` unless noted; each has a matching `engine/test/*.test.js`):

- `dice.js` — `rollDie`/`rollDiceExpr`/`isDiceExpr` with injectable rng (was a private helper in `store/index.js`).
- `hitPoints.js` — damage with temp-HP absorption, healing capped at `hp_max + hp_max_modifier`, temp HP (no stacking), concentration DC, plus `applyTracked*` variants for the combat tracker's damage-taken enemy shape. `HpTracker.vue` and `Battle.vue` (enemy damage/heal/temp, concentration DC) now call it; both previously carried their own copy of the temp-HP rule.
- `rest.js` — `applyShortRest`/`applyLongRest` (return a patch), `rollShortRestHealing`, `shortRestHealEstimate`, `rechargeItems`, plus `shortRestPreview`/`longRestPreview` for the party overview. The store's `SHORT_REST`/`LONG_REST` mutations are now ~10 lines each; `ShortRestModal.vue` and `PartyContext.vue` (which had a third copy of "what recharges on a short rest") call it.
- `limitedUse.js` — `spendUse`/`restoreUse`/`spendCharge`/`restoreCharge`/`spendGrantUse`/`restoreGrantUse`. The "uses_current falls back to uses_max, clamp to [0, max]" rule had been copy-pasted into eight store mutations; they now map over these.
- `unarmedAttacks.js` — Martial Arts die, `unarmedStrike`, Soulknife `psychicBlades`, `sneakAttackDice`; die tables read from `monk.json`/`rogue.json` instead of hardcoded breakpoints. `buildWeaponRows` shrank accordingly. `weaponAttack.js` gained `thrownDie` (the "thrown uses the 1H die even when gripped 2H" rule).
- `abilityScoreBreakdown.js` — per-ability attribution (override, named item/feature bonuses, ASI/racial history, implied base) behind `statArray`'s tooltips; `quickBuild.js` — the PHB Quick Build priorities (was hardcoded in `dnd_utils.js`).
- `preparedSpells.js` — prepared-spell limit per class (see bug below).
- `engine/rules/houseRules.js` — Weave Dust yield (was in `dnd_utils.js`) and Crowd Strength/area damage (was inline in `Battle.vue`). `engine/rules/weeklyEvents.js` — income/expense ranges, refugee tier table, and the Crossing Profit two-week cycle as a pure state machine (`advanceCrossingProfit`), all previously inline in `WeeklyEvents.vue`.
- `CombatContext.vue`'s initiative-advantage roll now uses the d20Test engine instead of `Math.max(roll, roll)`.

**Real bugs found and fixed in the move (not just relocated):**

1. **Interrupted long rest never showed its Exhaustion.** `LONG_REST`'s skip path pushed a string `'Exhaustion'` into `conditions` (or, if one was already there, spliced a duplicate), but the sheet's Exhaustion chip reads `exhaustion_level`, so the penalty was invisible. It now increments `exhaustion_level` (cap 6).
2. **Prepared-spell limit was wrong for multiclass casters.** `CharacterSpellbook.vue` used the single `spellcasting_ability` field and total character level; the PHB works each class out separately with that class's ability and level. Chuknora (Barbarian 6 / Paladin 3) showed 4; correct is 1 (CHA mod + half Paladin 3, min 1).
3. **Martial Arts die scaled with total level**, not Monk level. No roster character is affected today (Torrin is the only unarmed/blade user and he's a Rogue), but a multiclass Monk would have gotten too large a die.

**Behavior changes worth the project owner's glance:**

- **Ranger no longer shows a "Prepared N / M" counter, and no longer gets the long-rest "re-prepare spells" reminder** (Elucyne, Ranger 5). The old UI listed Ranger as a preparing class; this engine's own `spells_known` table (and 2014 RAW) says Rangers know spells. If the table plays Rangers as preparers, `preparedSpells.js`'s `preparingClassData` is the one place to change.
- Tooltips for Unarmed Strike and Psychic Blades now use the shared `Label (+N)` format like every other breakdown, instead of their old one-line `A + B = C` strings (same information, matches the weapon tooltips).
- The short-rest results screen now also lists Ki Points and short-rest resources among "recharged" (before: only features and Pact Magic, though the rest refilled the others anyway).

**Noticed, deliberately NOT changed:**

- `house_rules.json`'s Weave Dust text says "base = floor(value_gp / 15)", but the code (carried over unchanged) floors only at the end. The two can differ by a point or so; picking which is intended is the project owner's call.
- A long rest clears every non-Exhaustion condition (not RAW, which ends only specific effects). Kept as found, documented in `rest.js`'s header.
- The pip-click helpers in `SpellSlotsTracker.vue`/`ClassResourcesPanel.vue` (`nextSlotValue`) are UI interaction mapping, not a rule, so they stay in Vue.

**Verification**: `node --test` 451/451 (83 new). `npm run build` clean. A smoke script ran every new function (long/short/interrupted rest, rolls and previews, ability breakdown, unarmed/blades, HP functions, item recharge) against all 25 real characters and the real `party_items.json` — 0 NaN/undefined. Not verified live (per CLAUDE.md, no browser): the HP tracker, both rest modals and the party-overview rest chips, the spellbook "Prepared" counter and its new hover tooltip, the weapon rows for a unarmed/blade user, and the Weekly Events roll (incl. Crossing Profit week 1 → week 2 → Apply).

**2026-10-02 — Same sweep, second half: calendar, travel events, initiative, character-spell aggregation, level-1 HP breakdown.** Same method and conventions as the 2026-10-01 entry above.

**Built:**

- `engine/rules/calendar.js` — Tellonde's 204-day calendar (day-of-year, year, season, week, Festival half-week, `formatGameDate`, calendar-note matching). This math had been hand-copied three times — `src/utils/calendar_utils.js`, `TellondeCalendar.vue`, `LongRestModal.vue` — each with its own SEASONS table and day-of-week function. All three now go through the one file (`calendar_utils.js` is a thin wrapper).
- `engine/rules/travel.js` — the Travel Event wizard's roll (Survival check with advantage/disadvantage from "do you know the way", tier bands, off-path wording, whether to offer an encounter). Content stays in `src/data/travel_events.js` and is passed in; the roll now goes through `d20Test.js` instead of a private hand-rolled d20.
- `engine/rules/5e/initiative.js` — bulk initiative roll (advantage honored per entry, ties on total AND modifier re-rolled among just the tied group) and the turn-order sort. `CombatContext.vue` and `ShipCombat.vue` (which had its own second copy of roll-with-advantage) use it. `d20Test.js` gained an optional `rng`.
- `engine/rules/5e/characterSpells.js` — "what spells does this character have" (`getCharacterSpells`, `characterHasSpells`, the subclass bonus-spell field table, `normalizeItemSpellGrant`, `usesFullClassList`), moved out of `src/utils/spellUtils.js`. That file keeps only the cached per-class spell LISTS (they live in `src/data/`, which engine/ doesn't read) and re-exports the rest, so no component import changed.
- `diffLevelUp` now also returns `hpBreakdown` (`[{label, amount}]`: hit die, CON modifier, species bonus); `NewCharacterTool.vue`'s HP tooltip uses it instead of re-deriving "max hit die + CON".

**Real bugs found and fixed in the move:**

1. **`listSubclasses()` only returned `expanded_spell_list`.** The frontend builds its bonus-spell lookup from `GET /api/engine/subclasses`, and `getBonusSpells` is written to read `domain_spells_by_level`, `oath_spells_by_level`, `circle_spells_by_level`, `psionic_/clockwork_spells_by_level` and `bonus_spells_by_level` too — but none of those ever reached the browser, so only Artificer subclasses got derived bonus spells. It now includes every `*_spells_by_level` table. **No roster character changes** (checked: their records already carry those spells by name, and the aggregation dedupes by name), so this matters for the next character built through New Character / Level Up. The server must be restarted (`npm run stop`, then `npm run serve`) to pick it up — it's an engine change.
2. **"Repeat seasonally" calendar notes behaved exactly like "annually".** Both old copies of `noteMatchesDay` required the note's season to equal the current season, which for a once-a-year cycle is the same as matching the day of year. Seasonal notes now recur at the same offset in every season (4×/year), as the UI option says. No existing note uses it (`user_prefs.json` only has `recurrence: "none"`).

**Noticed, deliberately NOT changed:**

- Ranger is still treated as a full-class-list preparer by `usesFullClassList` (spellbook's "available to prepare" pool), while `preparedSpells.js` and `spellcasting.js` treat it as a known-spell caster. Same open question as the 2026-10-01 entry; one-line fix in either direction once the table's intent is known.
- `encounter_utils.js` (2300 lines) still holds the synthetic enemy generator: `generateHumanoidEnemy`/`generateBestiaryEnemy`, stat/HP/AC rolling, `assignFeatures`, plus ~1500 lines of `FEATURE_POOLS`/`SPELL_POOLS`/`ROLE_PROFILES` data. It's game logic, but it's also what `npcBuilder.js` (real class-built enemies) is gradually replacing, so moving it wholesale risks porting something about to be retired. Left for a decision rather than done speculatively.
- Ship/vehicle combat components contain only display logic (HP-bar colors, percentages) — nothing rule-shaped to move.

**Verification**: `node --test` 489/489 (121 new across both sweep entries). `npm run build` clean after each batch. Not verified live (no browser, per CLAUDE.md): Travel Event wizard roll + the Encounter link, Combat Context "Roll Initiative" (incl. a tie), Ship Combat's initiative, the Tellonde calendar grid and a note's recurrence, the Long Rest modal's "today's notes", the spellbook/combat-panel spell lists for a Wizard with a shared spellbook, a Cleric/Paladin, and a character with an item-granted spell, and the New Character HP-number hover.

**2026-10-03 — Main hand / off hand for one-handed weapons; Ferghus's Channel Divinity normalized; Denna's dagger moved from Swift Strike to Press Momentum.**

- **`engine/rules/5e/weaponHands.js`** (+ `src/utils/weaponHands.js` wrapper). A weapon item now carries `hand: 'main' | 'off' | null`; only one-handed weapons (`melee1h`/`ranged1h`) have one. `setHand`/`cycleHand` return patches `[{id, hand}]` that keep a loadout consistent — one main, one off, and when exactly one other one-handed weapon shares the loadout it gets the opposite hand automatically. Loadouts follow `weapon_set` (a set-less weapon counts in both, as in `weaponSets.js`), so Set 1's main hand doesn't clash with Set 2's. `loadoutHands` reports main/off/shield/two-hander and whether the loadout is `ambiguous` (two or more one-handers in hand, hands not fully assigned). 15 new tests.
- **UI:** `WeaponTable.vue` shows a clickable Main / Off badge on each one-handed weapon row (both layouts; a dashed "Hand?" badge when the loadout is ambiguous), click cycles Main -> Off -> unset; rows sort main hand first. `CharacterInventory.vue` has the same control beside the loadout-set button. No existing character was auto-assigned — Denna's two daggers will show "Hand?" until set (neither is clearly the main hand).
- **Not done:** the off-hand damage rule (RAW two-weapon fighting: the bonus-action off-hand attack doesn't add the ability modifier to damage unless it's negative or you have the Two-Weapon Fighting style). Damage numbers on the sheet still add the full modifier to both hands. Now that hands are tracked it can be modeled, but it changes displayed numbers, so it's the project owner's call.
- **Ferghus's Channel Divinity:** his bare "Channel Divinity" pool + two bare options became `Channel Divinity: Sacred Weapon` (carries the shared 1/short-rest pool, like Enauweyn's Champion Challenge) and `Channel Divinity: Vow of the Open Road`. `pub_vow-of-the-open-road` renamed in `published_features.json` and `feature-catalog.json`; the oath file now points at the Oath of Devotion's `pub_channel-divinity-sacred-weapon` (which gained `action_type: "action"` and the more complete PHB wording) and the duplicate `pub_sacred-weapon` was deleted.
- **Denna's dagger:** `Dagger of Swift Strike +1` -> `Dagger of Pressing Momentum +1` with the same Press Momentum reaction as Vaz's dagger (the free extra strike was too strong; that is why Vaz's was reduced on 2026-09-29, not to make the two items match — the library note now says so). Weapon-effect pills in `WeaponTable.vue` now render their `action_type` badge (the data had it; only spell grants drew it). The orphaned `pub_dagger-of-swift-strike` library entry and its catalog ids were removed.
- **Open, proposed to the project owner:** Divine Smite has no `action_type` (reads as passive); the existing `action_type: "free"` is never drawn by the pill icon or filter row, which also hides Action Surge from every filter but "All". Proposed fix: tag Divine Smite `free` via `feature-mechanics.json`, add a free-cost icon and a Free filter, optionally a click-to-smite flow.

**Verification:** `node --test` 504/504, `npm run build` clean. Not verified live: the Main/Off badge on Denna's and Vaz's weapon rows and its click cycling, the inventory Hand button, main-first row order, and the Reaction badge on Press Momentum.

**2026-10-04 — Gem of Seeing added to Lexica; dice-expression item recharges no longer fire on a short rest.** Added the real DMG Gem of Seeing (rare, attunement, 3 charges, action + 1 charge for 120 ft truesight for 10 minutes, regains 1d3 at dawn — checked against dnd5e.wikidot.com) as `items_257`, carried by Lexica, unattuned. While adding it, found `rechargeItems` rolled any dice-expression recharge (`"1d3"`, `"2d8+4"`, ...) on EVERY rest including a short rest — a carry-over from the old store code (kept "as found" on 2026-10-01). All four dice-recharge items on the roster are "regains X at dawn", so dice recharges now fire only on a rest that passes through dawn (`dawn`/`daily`/`long_rest`). Test added; `node --test` 505/505.

**2026-10-04 — Item library: official items cached, our own items added, party items now reference the library instead of copying it.** Prompted by "we need to reference official data wherever possible and copy/paste data is always to be avoided" (the Gem of Seeing had been pasted in by hand).

- **Official cache:** `scripts/build-item-cache.js` reads every `wondrous-items:` page in dnd5e.wikidot.com's sitemap (robots.txt permits it; 4 at a time) into `engine/data/5e/magic-items.json` — **904 items** with source book(s), category/subtype, rarity, attunement (+ note), full text (tables flattened), tags. Chosen over Open5e because Open5e's 2014 data is the SRD only (~500) and lacks the non-SRD WotC items; the wikidot data covers DMG, XGE, TCE, Wildemount, Eberron, Ravnica, adventure books, etc. Cross-checked against Open5e's SRD names: the apparent gaps were SRD-renamed items (Apparatus of Kwalish, Heward's Handy Haversack, ...) and Open5e's per-variant entries, all present under their real names. Parser has tests (`itemCacheParser.test.js`) and handles unclosed `<p>`, "Source -" lines, non-italic type lines, multiple/vague rarities (varies/unknown/unique). Index pages in the namespace are dropped.
- **Three layers, no duplication** (`engine/rules/5e/itemHydration.js`, `itemCatalog.js`): library entry (official + `campaign-items.json`, 107 of ours) / mechanics (`item-mechanics.json`, keyed by library id — the features pattern) / instance (`party_items.json`: `catalog_id` + instance state + deliberate overrides). `hydrateItem`/`dehydrateItem` are inverses; `server.js` hydrates on `GET /api/party_items` and the level-up route, dehydrates `current` and `base` before the 3-way merge on save, and re-hydrates the echoed result — so no UI code changed. New `GET /api/engine/item-catalog`. Verified against a live server: GET hydrates, a no-change save leaves the file byte-identical, a charge spend/attune/edit stores only that change, full charges drop `charges_current`.
- **Migration** (one-shot, script removed after running; lossless — every field except effect/description/rarity/attunement round-trips): 258 party items -> 218 linked (60 exact official, 30 official variants/aliases incl. Potion of Greater/Superior Healing -> Potion of Healing, Scroll of X -> Spell Scroll, Ioun Stone of Mastery -> Ioun Stone, 18 plain "+N" weapons/armor/shields -> the generic +1/+2/+3 entries, 110 unique items -> campaign entries), 27 mounts, 9 mundane gear and 4 Gem Pouch ledgers left unlinked on purpose. Mechanics every copy of an entry agreed on moved to `item-mechanics.json` (broad families like the +N weapons keep none). `party_items.json` shrank by ~1,300 lines. Paraphrased item text was dropped in favor of the official text (90 items); anything that added numbers or said "house rule" was KEPT as an `effect` override and listed for review (below).
- **Name conflicts:** none between our entries and official names (the test suite enforces it — a campaign id/name that collides fails). Divergences found, left for the project owner (all still present as overrides, nothing lost): Oil of Sharpness x3 says "+3 ... crit on 19 or 20" (official has no crit clause); Bag of Holding x4 carries a house-rule capacity; Cloak of Arachnida omits the official poison resistance; Cloak of Protection +2 x2 and Amulet of the Devout +2 aren't official variants (official: +1 / +1-+3 respectively — homebrew upgrades?); Helm of Brilliance's gem counts are state not definition; Ring of Amity x2 are recorded "rare" but official is "very rare"; Tome of Clear Thought, Ring of Spell Storing (3rd level), Scroll of Sending add numbers worth a glance. Also: "Rope of Climbing and Entanglement" has no single official match (official has separate Rope of Climbing and Rope of Entanglement); `TEST Wand of Magic Missiles` is a test fixture. Two cleanups after the migration: Gem Pouch unlinked (its text/contents ARE per-party state), and "Attuned to: fire" moved from shared robe text to the copies' notes.
- **Guardrails:** `engine/test/itemCatalog.test.js` (13 tests, incl. no stored value may repeat the library, every catalog_id/mechanics key resolves, Gem of Seeing is the official DMG entry) and `scripts/audit-items.js` (unlinked items with text, copied data, dangling ids, overrides, campaign names close to an official one). Left unlinked with text: 2 Silvered Shortswords (the engine has no "silvered" property yet).
- **Known limits:** `dataService.js` statically imports `party_items.json` as its offline/prod fallback, which is now the stored (dehydrated) form — fine with the dev server up (always the case in practice), but a static build would show bare items; fix = hydrate against a bundled catalog if a static build ever matters. New items created through the UI/JSON intake/Item Generator are NOT linked automatically (no `catalog_id` picker yet) — the audit flags them. **The dev server must be restarted** (`npm run stop`, then `npm run serve`): a backend started before this change serves the dehydrated file as-is.
- **Verification:** `node --test` 527/527, `npm run build` clean. Not verified in the browser: inventory/battle-item/weapon displays with the now-longer official `effect` text (e.g. Helm of Brilliance), and that Gem of Seeing's charges/Use button still work in Lexica's battle items.

**2026-10-04 (later) — Item library follow-ups: divergent items made official, Silvered property, auto-link on save, static-build fallback.**

- **Made official** (project owner's call): Oil of Sharpness x3 and Cloak of Arachnida now use the official text (the 19-20 crit clause and the shortened Arachnida text are gone); Cloak of Protection x4 are the official flat +1 AC/saves (Kessara's and Kerra's "+2" cloaks dropped to +1, bonus now in `item-mechanics.json`); Kerra's Amulet of the Devout is the official item at its rare variant (`rarity: "rare"`, +2 spell attack/save DC kept on the item, since the bonus is set by rarity); Ring of Amity x2 take the official very-rare rarity; Sorra's Helm of Brilliance uses the official text (the old simplified 6/9/5 gem split and its spell assignments are gone — the counts are kept in the item's notes as state). **Bag of Holding keeps its house-rule capacity** as an `effect` override. Still overriding on purpose or unreviewed: Bag of Holding x4, Ring of Spell Storing (3rd level), Tome of Clear Thought, Scroll of Sending.
- **Silvered** is now a weapon property: `silvered: true` on the item -> `weaponProps().silvered` -> a "Silvered" badge on the weapon row (both layouts). The two Silvered Shortswords carry the flag instead of rules text. The engine tracks and shows it; it doesn't apply it (resistance lives on the target). No inventory toggle yet — set it in the data.
- **New items no longer start as copies:** `autoLinkItem` (`engine/rules/5e/itemCatalog.js`) links an item with no `catalog_id` when its name clearly matches the library (exact name, hand-confirmed aliases, Potion of Greater/Superior/Supreme Healing, "Scroll of X", plain "+N" gear, "<name> +N"/"(variant)"), applying the migration's text policy (paraphrase replaced by the official text; house-rule/extra-number text kept as an override). `server.js` runs it on save (so an item added through the UI, JSON intake or the Item Generator is linked and stored minimal — verified live) and on read. Items that don't match (genuinely new unique items) stay unlinked and show up in `scripts/audit-items.js` until a campaign entry is added. 5 tests.
- **Static builds:** `dataService.js`'s bundled-`party_items.json` fallback now hydrates through `src/utils/itemLibrary.js`, loaded with a dynamic `import()` — the item library is its own 1.2 MB lazy chunk (`840.js`) fetched only in that fallback, so the main bundle didn't grow.
- **Verification:** `node --test` 532/532, `npm run build` clean, audit shows 0 unlinked-with-text, 0 copied, 0 dangling. Not verified in the browser: the Silvered badge, and that Kessara/Kerra/Corwin's AC and saves now read +1 from the cloak.

**2026-10-04 (later still) — Item variants: Ring of Spell Storing in 3, 5 and 7 level versions.** Rather than paste the official ring's text a second and third time, the library gained a general **variant** mechanism (`engine/rules/5e/itemCatalog.js`): a `campaign-items.json` entry with `variant_of: "<library id>"` inherits the base's text, source, category, attunement and mechanics, and states only what differs — its own name/rarity and `desc_edits: [[find, replace], ...]` applied to the base text. Every `find` must occur in the base text, so if a rebuilt official cache changes the wording an edit relies on, loading fails loudly (and the test suite fails) instead of silently producing an unedited variant. A variant's mechanics start from the base's and override (`charges_max`). `scripts/audit-items.js` skips declared variants in its "close to an official name" list.

Added: `Ring of Spell Storing (3 levels)` (uncommon, "up to 3 levels worth", spells 1st-3rd) and `(7 levels)` (very rare, 7 / 1st-7th), variants of the official 5-level rare ring; the official entry's mechanics gained `charges_max: 5`. Pirra's ring (`items_142`) is now the 3-level variant with nothing copied onto the record (name changed from "(3rd level)"; its "holds one spell of up to 3rd level" text — which contradicted the official ring — is gone); Siv's stays the official 5-level ring. `autoLinkItem` matches `"... (7 levels)"` etc. by name. 4 new tests; `node --test` 536/536, `npm run build` clean. Noticed, not changed: Siv's ring has `charges_current: 0`, `description: "CURRENTLY EMPTY"` and a leftover `stored_spells` entry (Cone of Cold) — the stored-spell list and the charge count disagree. Not verified in the browser.

**2026-10-05 — Ferghus's Fighting Style resolved.** His sheet had the bare generic "Fighting Style" feature with no recorded choice (the New Character/Level Up pick was never made for him, and nothing in the data or history said which). Project owner chose **Great Weapon Fighting** (fits his two-handed Maul +2); recorded in the exact shape `diffLevelUp` produces for a resolved pick: `{name: "Fighting Style: Great Weapon Fighting", id: "fighting-style-great-weapon-fighting", type: "fightingStyle", level_gained: 2, _source: "Paladin"}`. `validateCharacter` clean; no other character has an unresolved bare Fighting Style. GWF's damage-die reroll isn't modeled anywhere (it's a per-roll table rule, not a flat bonus), so there is no stat change — it now just reads correctly and links to the official feature text.

**2026-10-05 — New Character tool: a Wizard now picks a starting spellbook and prepared spells.** Found when Elowenne was created: cantrips were offered, spells weren't.

- **Rule (PHB, Wizard — Spellcasting / Your Spellbook):** at 1st level a Wizard has 3 cantrips and a spellbook of **six** 1st-level wizard spells, and prepares **INT modifier + wizard level** of them (Elowenne, INT 17: 4). `diffLevelUp` only knew the flat "+2 spells per level" (and counted a brand-new character's first level as +2); the first Wizard level (`fromLevel === 0` — a new character or a multiclass pickup) is now +6. 5 new tests (six owed, prepared count, six resolves them as unprepared level-1 spells, extras ignored and level 2 back to +2, multiclass pickup).
- **The actual bug was in the UI:** `NewCharacterTool.vue` only had a picker for 'known'-style casters (Bard/Sorcerer/...), and Wizard is a 'prepared' caster, so even the engine's pending `spellbookAdditions` choice had nowhere to appear. Added the same pick `LevelUpTool.vue` uses ("Add to Spellbook", `spellbookChoices` sent with the preview) — six 1st-level wizard spells — plus a "prepare N of them" pick; Create requires both. The new character's spellbook gets all six; `prepared_spells` is the cantrips plus the chosen prepared spells (the leveled spellbook spells aren't auto-prepared, which is why the old flow ended up with only cantrips). Verified the routes against a live server (42 level-1 options offered, six picks resolve the choice, prepared count 4).
- **Not changed:** Cleric/Druid/Paladin/Artificer also show "Spells prepared: N" at creation with no picker (they prepare from the whole class list in the Spellbook tab afterward); left as is. **Elowenne herself** (created before this fix) still has only her 3 cantrips in her spellbook and no prepared spells — her six spells need to be chosen.
- **Verification:** `node --test` 541/541, `npm run build` clean (only the usual bundle-size warnings). Not verified in the browser: the new spellbook/prepared pickers and Create's gating.

**2026-10-05 (later) — Timeline Freeze (homebrew, Elowenne); a "manual" recharge; character notes.**

- **Homebrew feature `hb_timeline_freeze`** in `published_features.json` (+ catalog id/name, + `feature-mechanics.json` entry: 1 use, `recharge: "manual"`): 100-ft radius, 3 minutes, Elowenne and creatures she chooses act normally while everything else is frozen; touching/moving a frozen creature or any damage ends it. Elowenne's record has it with `uses_max: 1`. The **action cost wasn't specified**, so it carries none (reads as passive on the sheet) — set `action_type` on the library entry once decided. The library entry says only what the ability does; the secret behind it lives in her character notes, not in shared data.
- **`recharge: "manual"`** is new: a limited-use feature/spell that only the DM refills ("recharges after an act of evil of medium heinousness or above — DM call"). Before this, `applyLongRest` refilled ANY feature or spell that had a `recharge` value, so a custom recharge would have been silently refilled by an ordinary long rest. Manual uses are now left alone by every rest (test added; `node --test` 542/542), and the pill label reads "DM call". The pill's existing "+1" restore button is how the DM's call gets applied.
- **Notes:** Elowenne's `notes` records that the ability came from an artifact whose effect an enchanter conveyed into a bone in her left hand (secret — only she knows; the enchanter's memory was erased or he was killed). Brick's `notes` records his hidden noble birth, that he's too lowbrow to realize or convey it, and that he doesn't like weapons (punches, throws things). Brick's INT is currently 10 (the project owner mentioned wanting about 4).

**2026-10-05 (later still) — Timeline Freeze is an Action; Brick's anomaly; Barbarian/Monk Unarmored Defense now inferred.**

- **Timeline Freeze** now has `action_type: "action"` (library entry, `feature-mechanics.json`, and Elowenne's feature); supersedes the earlier "action cost not specified" note. Her notes also gained "the visible tell: she does evil things with her left hand."
- **Brick** (project owner's call — a genetic anomaly, still level 1, nothing above 19): INT 10 -> 6, CON 14 -> 18. STR was already at the 19 cap (rolled 18 + Human +1), so the whole +4 went to CON. Recorded as two `ability_score_history` entries ("Owner adjustment (genetic anomaly)", -4 INT / +4 CON; the implied rolled bases still read 9 INT / 13 CON); HP 14 -> 16 (d12 + CON +4); notes gained "a genetic anomaly: unusually strong and tough, and not at all bright". Fixed along the way: the ability-score tooltip printed a negative contribution as "+-4" (now signed).
- **Real bug found via Brick:** his AC read 12 (10 + DEX) instead of 16 (10 + DEX + CON) because Barbarian/Monk Unarmored Defense depended on a hand-set `unarmored_ac_formula` field (Rhuna had one; the New Character tool never sets it), so any newly built Barbarian or Monk silently ignored CON/WIS. `computeAC` now infers the formula from class + the Unarmored Defense feature when the field is absent; an explicit field (including "default") still wins. 4 tests. Checked against the whole roster before/after: Brick is the only AC that changed (12 -> 16). `node --test` 546/546.

**2026-10-06 — Level Up tool's character picker lists everyone and scrolls.** The character `<select>` was the browser's native dropdown, which caps its popup height and scrolls via little arrows (reported as "truncates the list ... arrow down to load more"). Replaced with a small reusable `src/components/ScrollSelect.vue` (button + panel listing every option, `max-height: min(60vh, 28rem)` with a normal scrollbar; keyboard: arrows/Home/End/Enter/Esc, type-ahead, click-outside closes) used for that one picker; the class/multiclass selects beside it are unchanged (short lists). UI-only; `npm run build` clean; not verified in the browser.

**2026-10-06 — Elowenne (Wizard 8 Chronurgy / Twilight Cleric 1) and Brick (Barbarian 8 Berserker / Fighter 1) rebuilt at level 9 from the project owner's sheet.** Built by driving `diffLevelUp` one level at a time with the sheet's choices (the same calls the Level Up tool makes), not by hand-writing records, then layering the custom pieces; `validateCharacter` is clean on both and on the whole roster. Numbers checked against the sheet: Elowenne prof +4, INT 20, CON 15, HP 57, slots 4/3/3/3/1, spell DC 17, attack +9, initiative +6 (DEX +1, INT +5 via Temporal Awareness), Mage Armor AC 14; Brick prof +4, effective STR 22 / CON 19, HP 103, AC 15 (Barbarian Defense), Rage 4/4, unarmed d4 +10 / +6.

**Built because it didn't exist or didn't work (all in engine/):**

- **Chronurgy Magic** (Explorer's Guide to Wildemount) — the subclass was missing entirely. `wizard-chronurgy-magic.json` + 5 published features (Chronal Shift, Temporal Awareness, Momentary Stasis, Arcane Abeyance, Convergent Future) with text taken verbatim from the dnd5e.wikidot.com page HTML (single source — no second source was reachable; nothing in it is a surprising number). Mechanics: Chronal Shift 2/long rest (reaction), Momentary Stasis = INT modifier uses (min 1), Arcane Abeyance short-rest.
- **`adds_ability_to_initiative`** (feature-mechanics field; `checks.initiative` adds that ability's modifier, once, on the effective score) — Temporal Awareness.
- **Rage use counts**: `rages_by_level` lived in the Barbarian class file but nothing read it, so a tool-built Barbarian had Rage with no uses. New `class_table` uses-formula type + a `rage` mechanics entry (bonus action, long rest, uses from the table; 20th = unlimited = no counter). Existing Barbarians pick it up on their next level-up.
- **`unarmed_strike_die`** (Tavern Brawler's d4, STR only, proficient) alongside Martial Arts in `unarmedStrike`; a Monk with both keeps the bigger die and best-of-STR/DEX.
- **Feature-name catalog: 261 ids were missing**, so any feature granted by those subclasses displayed as its raw id (e.g. Twilight Cleric's Vigilant Blessing showed as `pub_vigilant-blessing`; Spirit Shield, Wild Surge, Mantle of Majesty... same). All added from the published library; a new test fails if a class/subclass file grants an id with no catalog name.
- **Custom features (homebrew, unique to Brick):** Hulking Build (+2 STR/CON as feature stat bonuses; stored base scores stay 20/17), Hurler's Rage (the engine's rage-damage rule already applies to thrown melee-type weapons, so it records the intent), Fearless (`saving_throw_advantages: being_frightened`).

**Where the sheet and the rules/data disagreed (reported, not silently resolved):**

1. Brick has two Barbarian ASIs (4th and 8th); the sheet spends one (+2 STR). The 8th is left unspent.
2. The sheet gives Elowenne no Cleric cantrips (Cleric 1 knows 3) and no Cleric prepared spells (WIS mod + 1 = 2), and only 13 of the 14 wizard spellbook additions — three Cleric cantrips and one wizard spell are open picks. (Her spellbook is her 4 cantrips + the six she chose at creation + the 13 sheet spells = 19 leveled.)
3. "Chronal Shift: twice per rest" is twice per LONG rest (reaction); "five uses" of Momentary Stasis is INT modifier uses per long rest.
4. Twilight Domain's martial-weapon/heavy-armor grant isn't applied by the engine (it records the feature only) — set by hand on Elowenne; same gap exists for every domain/subclass with bonus proficiencies.
5. Brick's skills are only the sheet's two (Athletics, Intimidation); a Variant Human and a Noble background would normally add more. The earlier owner adjustment (INT 6 / CON 18) was replaced by the sheet's numbers (INT 8; CON 17, 19 with Hulking Build).
6. Two pre-existing name conflicts between records the new catalog test surfaced: `pub_thunderous-strike` (catalog and wikidot say "Thunderous Strike", the published entry's 2026-09-10 "correction" says "Thunderbolt Strike") and `pub_unyielding-spirit` (catalog says "Unyielding Spirit", published and wikidot say "Unyielding Saint"). Left alone; wikidot is the only source checked.

**2026-10-06 (later) — Unarmed Fighting, Elowenne's Elegant Ward, Brick's feat and skills.**

- **Brick's 8th-level ASI** is spent on **Fighting Initiate (Tasha's) -> Unarmed Fighting** (the project owner asked for something that improves his unarmed die; Tavern Brawler's d4 was already his Variant Human feat). Unarmed Fighting is 1d6 + STR, 1d8 while no weapon or shield is held, plus 1d4 to a creature he has grappled at the start of his turn. His strike is now a d8 (+10 to hit, +6 damage); a shield or weapon in hand drops it to d6.
- **`unarmedStrike`** now knows the style: the `fighting-style-unarmed-fighting` feature record is the single source, the biggest of the Monk/Tavern Brawler/Unarmed Fighting dice wins, and the grapple damage comes back as an `extras` entry. Hand occupancy comes from `weaponHands.loadoutHands` (weapon or shield in either hand, or unassigned one-handers).
- **`diffLevelUp`:** a Fighting Initiate resolution with `choices.style` also records the chosen style as a `fightingStyle` feature (`_source: 'Fighting Initiate'`), same shape as a class grant.
- **Library text was wrong:** `fighting-style-unarmed-fighting` in `published_features.json` described a bonus-action extra strike that isn't in the 2014 style. Replaced with the dnd5e.wikidot.com text (confirmed against the Fighter page; the Fighting Initiate page only lists the feat).
- **Elowenne:** heavy armor and martial weapon proficiencies removed (the feature record "Bonus Proficiencies and Eyes of Night" stays — it's also her 300 ft darkvision; her notes say the proficiencies are deliberately not taken). New homebrew feature **Elegant Ward** (`hb_elegant_ward`): while not wearing armor, AC = 10 + DEX + INT (16 now); a shield is still allowed. Engine side: a feature record with `unarmored_defense: { abilities: [...] }` defines the unarmored formula in `armorClass.js` (explicit `unarmored_ac_formula` wins; ranks above the Barbarian/Monk inference). Tuning the number is one line.
- **Brick's skills:** Athletics, Intimidation, plus Animal Handling and Survival; Noble background extras deliberately left out, with a note on his sheet.
- Tests: Unarmed Fighting (d8/d6/extras), feature-defined unarmored defense. Engine 558/558, `npm run build` clean.

**2026-10-07 — Elowenne rebuilt as Wizard 9 (Chronurgy), Cleric dip dropped.** The Twilight Cleric level was only there for heavy armor (the project owner never chose the domain; its shared-d4 bond didn't fit an evil wizard, and without heavy armor the dip had no purpose). Rebuilt with the same level-by-level `diffLevelUp` driver, no multiclass pickup, plus the 9th Wizard level: HP 56, scores unchanged (INT 20), slots 4/3/3/3/1, AC 16 (Elegant Ward), Timeline Freeze and the notes kept, the Twilight-specific note sentence removed. Her Cleric-only features, the duplicate Caster Prestidigitation entry and the Cleric pending picks are gone. Open: 3 spellbook additions (1 from level 4, 2 from level 9) and 1 prepared spell (14 allowed, 13 chosen). Engine 558/558, build clean. The Twilight/domain bonus-proficiency engine gap (TODO) still stands for other characters.

**2026-10-07 (later) — Elowenne's spellbook filled.** Project owner's picks: Magic Missile out; Blur, Haste, Cloudkill, Dominate Person in (book = 22 leveled spells, the Wizard 9 maximum: 6 + 2 x 8; both 5th-level picks are within her single 5th-level slot's reach). Prepared list had Magic Missile removed (12 of 14 leveled prepared; two open). Her notes record that she wants Far Step at Wizard 10. Data only.

**2026-10-07 (later still) — Rage damage now applies to unarmed strikes.** `unarmedStrike` ignored Rage entirely (only `rageDamageBonus`, which takes a weapon, applied it), so a raging Barbarian's unarmed row under-reported by the Rage bonus — found checking Brick (STR 22: d8 +6 shown; raging it's d8 +8). New `rageDamage(character)` in `weaponAttack.js` (the raw level-banded number; `rageDamageBonus` now calls it) and `unarmedStrike` adds it with a "Raging" breakdown line whenever the strike uses STR (a Monk whose Martial Arts takes a better DEX gets none). Two tests; engine 560/560, build clean.

**2026-10-07 (later still) — "Hurl Something" (homebrew, Brick first).** Project owner's design: throw a heavy object as an attack. Built as `engine/rules/5e/hurlSomething.js` (zero fs/path, browser-requirable via `src/utils/hurlSomething.js`): needs the `hb_hurl_something` feature AND effective STR 21+; weight limit 5 x STR lb; 1d4 per full 8 lb (min 1d4); ranged attack on STR + proficiency, 20/60 ft; counts as a thrown weapon attack, so Thrown Weapon Fighting's +2 and (with Hurler's Rage) Rage damage apply; a hit is a critical hit when the thrower is >20 ft above the target; over 40 lb splashes (DEX save, DC 8 + prof + STR mod, half on fail). **Action cost is the whole Attack action** (`HURL_ACTION_COST = 'attack_action'`, one constant; `'one_attack'` is the alternative) — chosen because a max throw (13d4 at STR 22) is ~3x a punch, and replacing only one attack would put his turn around 65 damage vs 37. The splash fraction, 5 lb/STR cap and 20/60 range are my defaults for the project owner to tune. Library entry `hb_hurl_something` + catalog id; Brick has the feature (13d4 +8, +10 raging, +10 to hit, splash DC 18); weapon table gets a "Hurl Something" row showing the max throw with the rules in its tooltip (no weight input yet — lighter objects aren't shown). The height crit and splash are described, not auto-rolled. 8 tests; engine 568/568, build clean.

**2026-10-07 (evening) — Hurl Yourself, Rhuna's Hurl Something, and the "Landing On Someone" house rule.**

- **Refactor:** `hurlSomething.js` now exposes `hurlStrike(character, items, {featureId, weight, clampToMax, thrownWeapon})`, the single copy of the throw math; `hurlSomething` is a thin caller. New `jump.js` (`longJumpFeet` = STR running / half standing, `highJumpFeet` = 3 + STR mod) — the engine had no jump distances at all.
- **Hurl Yourself** (`hurlYourself.js`, feature `hb_hurl_yourself`, unique to Brick): calls `hurlStrike` with the thrower as the object (`character.weight_lbs`, new field, 300 on Brick — no guessed default; no weight limit), range = long-jump distance (22 ft), `thrownWeapon: false` (no Thrown Weapon Fighting, no Hurler's Rage), and a `selfDamage` block (same dice, DEX save DC 18 for half). Library text only lists the differences from Hurl Something. Weapon table gets a "Hurl Yourself" row. **Numbers to watch:** 300 lb is 37d4 (avg 92.5 + 6) against the target AND against Brick on a failed save (103 HP); raging halves bludgeoning for him but the table doesn't apply that automatically. Self-damage on a miss isn't modelled (the feature says damage "as everyone else hit").
- **Rhuna** now has Hurl Something: with her Belt of Giant Strength she has STR 27 (needs equipped items counted — the weapon-table row does), so 16d4 +8, +12 to hit, 135 lb limit, splash DC 20.
- **House rule "Landing On Someone"** (`house_rules.json` + `houseRules.landingImpact`): a creature that takes fall damage and lands on a creature/object deals the same damage (the amount the faller actually took); bludgeoning immunity = none, resistance halves, vulnerability doubles; "from nonmagical attacks" resistances don't apply (a fall isn't an attack). Not wired into any UI (the app has no fall-damage tracker).
- 9 new tests; engine 577/577, build clean.

**2026-10-07 (night) — Hurl Yourself redesigned (supersedes the version above).** The thrown-object clone hit for ~100 (37d4 at his 300 lb) at will, to targets and himself. Now (project owner's call): he leaps off something high onto one creature within jump distance and up to one adjacent to it; the fall damage (new `fall.js`: 1d6 per 10 ft, max 20d6) is rolled once, he takes it as normal, each target takes it x2 (`HURL_YOURSELF_MULTIPLIER`, "he's massive and angles himself") through the "Landing On Someone" rule (`landingImpact`: immunity/resistance/vulnerability to bludgeoning apply). No attack roll, no save; same action cost and Strength 21+ requirement as Hurl Something (imported, not copied). Damage now scales with terrain: ~21 each from 30 ft, ~42 from 60 ft, ~70 from 100 ft, vs ~98 flat before. `weight_lbs` removed from Brick (no longer used); `hurlStrike`'s Hurl-Yourself-only options removed again. Weapon-table row shows the formula (height isn't an input). Tuning knobs if it feels off: the multiplier, or a DEX save for half on the targets. Engine tests + build clean.

**2026-10-07 (late) — Falling house rule, the Fall button, and Hurl Yourself on the new table (supersedes the Hurl Yourself x2 / 1d6-per-10-ft entry above).** Project owner's design, built through several rounds ("100 ft doesn't leave a humanoid alive enough to fight"; real survival is ~50% at ~48 ft and ~90% fatal by ~84 ft; the book's 1d6/10 ft max 20d6 barely scratches a level-9 hero):

- **`engine/rules/5e/fall.js` (new, house rule, lives under 5e/ because it replaces a 5e rule):** tier = full 10 ft; dice = the triangular number of the tier (Gygax: 1, 3, 6, 10, 15, 21); **d8 by default, d6 if the faller braces** — an Acrobatics check _or_ a CON saving throw (player's choice) against **DC 14 + tier**; **over 60 ft nothing is rolled — the faller dies**. `fallDamage` (min/avg/max/dc), `rollFall` (injectable rng), `fallCheckOptions` (real Acrobatics and CON-save bonuses for a character, better one named), `FALL_CAP_DAMAGE` (21d8 max = 168).
- **`houseRules.landingImpact(damage, target, {lethal})`:** the thing landed on takes the same damage (immunity/resistance/vulnerability to bludgeoning apply; "nonmagical" resistance clauses don't). Lethal case: Large-or-smaller (unspecified size = Medium) dies, Huge+ takes the 168 cap, bludgeoning-immune is untouched. The size-based handling of "anything you land on dies" is my default; the project owner hadn't ruled on Tarrasque-sized targets.
- **Hurl Yourself:** now uses `fall.js` and the "Landing On Someone" rule, multiplier **x1.5 rounded down** (`HURL_YOURSELF_MULTIPLIER`; my default when moving off x2 onto d8 dice — he never confirmed it). Over 60 ft Brick dies. Library text and the weapon-table row updated.
- **UI — Fall button in the dice roller** (`FallDamagePanel.vue`, a floating card above the roller so the roller stays usable): height, optional character (autofills their real Acrobatics/CON-save bonuses and preselects the better), a min/avg/max table for braced vs not, brace choice, "landing on" (nothing / someone / Hurl Yourself), and a result with the brace roll (honors the roller's Advantage/Disadvantage), each die, the total, and what the landed-on target takes. The roll also lands in the roller's history so it can be added to the running total. All numbers come from the engine; the panel only lays them out.
- **House rules text:** new "Falling" entry, "Landing On Someone" updated for the lethal case (`src/data/house_rules.json`).
- 15 tests in `hurlYourself.test.js` (fall table, DC, lethal, rollFall, check options, landing, Hurl Yourself). Engine 583/583; `npm run build` clean. **Not verified live:** the panel's placement over the drawer (`bottom: 22vh`, fixed) and the click flow.

**2026-10-07 (last) — Hurl Yourself multiplier back to x2.** The x1.5 in the entry above was my own default, never agreed — the project owner remembered it as always double. His reasoning: at 30 ft a leap that costs Brick ~15 and hits the target for ~22 is a poor use of a whole action, and he's taking damage too, so double is the fair price. `HURL_YOURSELF_MULTIPLIER = 2`; the library text, weapon-table row, Fall panel line and tests follow. The Fall panel's third brace option is now labelled "None (d8)". Engine 583/583, build clean.

**2026-10-08 — Enauweyn's Sentinel Shield and two scrolls; "advantage on a skill" is now a real item mechanic.** The Sentinel Shield (DMG, uncommon) was already in the official item library (`sentinel-shield`) — **with no attunement requirement** (the project owner remembered one; the library's text and wikidot say none), so the party item is a plain reference to it, nothing overridden. Its effect had no mechanic for the Perception half: only initiative advantage existed. New `grants_skill_advantage: [skill, ...]` (item or feature; attunement-gated like initiative advantage) read by `checks.skillAdvantage`, and passive Perception gets +5 from advantage (PHB), shown as its own breakdown line (Enauweyn 14 -> 19 with the shield held). `item-mechanics.json` entry `sentinel-shield` carries both grants plus `armor_type: shield` / `slot: shield`. UI: the Skills list shows an "adv" badge on a skill with advantage and its roll button hands the roller advantage (the roller ORs it with its own toggle). Scrolls of Revivify and Haste are `spell-scroll` library items like the existing scrolls. Not equipped yet — Enauweyn carries the shield. Note a Paladin can't read Haste without an Arcana check (not on the Paladin list). 2 tests; engine 585/585, build clean.

**2026-10-08 — Buglist batch from the code review (CODE_REVIEW.md on `origin/claude/compassionate-ritchie-8fqa4t`); tracked in `BUGLIST.md`.** All fixed on `main` with regression tests (engine 583 -> 611):

- **2.2** skill names matched on letters only (`checks.js` `skillTraining`, also feeding the sheet's skill dots) — "Animal Handling"/"Sleight of Hand" proficiency no longer silently lost (Therynv'l, Lexica, Brick, Torrin).
- **2.3** `gripDie`: a shield means a versatile weapon is one-handed (Enauweyn's longsword d8, not d10).
- **2.4** weapon proficiency only counts if proficient (permissive when no recorded proficiencies or no weapon category; a magic `staff` is a quarterstaff). **Real roster effect:** Lenn (Wizard) with a shortsword, Sorra with a scimitar and longbow, lose the proficiency bonus — per their recorded proficiencies.
- **2.6** Ranger removed from the "prepare from the whole class list" set (2014 Rangers know spells).
- **2.8 — NOT a bug, skipped:** the review said Artificer prepared spells round up; wikidot says "half your artificer level, rounded down". Rounding up applies only to multiclass slots.
- **2.9** short rest: hit die derived from the classes (biggest die for multiclass), CON from the effective score (items); the modal passes equipped items.
- **2.11** duplicate `pub_primal-companion` merged, unreferenced `pub_celestial-resistance` removed, Warlock feature renamed "Celestial Resilience"; new `publishedDataIntegrity.test.js` (unique ids/names, catalog/library name agreement).
- **2.12** `merge-utils.js`: a key field is used only if every element on every side has it with no repeats — id-less rows no longer collapse into one. New `mergeUtils.test.js`.
- **2.13** `dataService` static fallback gained `spellbooks` and `mounts`; `staticTablesCoverage.test.js` guards it.
- **2.14** stat overrides only raise a score.
- **2.15** Tavern Brawler's d4 comes from the feat itself.
- **2.16** Monk Unarmored Defense is lost with a shield.
- **2.1** unsaved level-ups / new characters are "drafts": `state.draftCharacters`, `engine/rules/draftSaves.js`. The ambient autosave (and the global Save dialog) hold drafts at their saved baseline; only the explicit pending-save bar writes them (`save` takes `{table, includeDrafts}`). Unverified in a browser.
- Same day, small cleanups from the review's file-by-file list: `npm test` runs the engine suite; `merge-utils.deepEqual` compares with sorted keys; `server.js` JSON writes are atomic and the dead `factions`/`quests` tables are gone from `ALLOWED_TABLES`; Rage damage reads the Barbarian class table (`rage_damage_by_level`); `DmExport.vue` uses a relative URL; deleted dead `src/utils/dnd_helpers.js` and `src/data/scripts.js`. Engine 613/613.
- **Attunement + item weapon proficiency (project owner's ruling).** Un-attuned items that need attunement keep their plain +N but grant no special effects: `engine/rules/5e/attunement.js` (`applyAttunement`, field list `EFFECT_FIELDS`), applied at `dnd._equippedOnly`. New item field `grants_weapon_proficiency` (Bracers of Archery: longbow + shortbow) read by `isProficientWithWeapon(character, weapon, homebrew, equippedItems)`. Sorra gets `scimitar` in `weapon_proficiencies` (owner: she's proficient with the Curved Blade). Real roster effect with the data as it stands: Iyani/Lyria AC 14 -> 12 and DC 19 -> 17, Ferghus STR 21 -> 18, Rith AC 12 -> 10 — those items are flagged `attuned: false`; mark them attuned if they are. 5 tests; engine 618/618, build clean.

**2026-10-08 — Item hand-off between characters (drag-and-drop) and inactive parties.** New `engine/rules/5e/itemTransfer.js` (`transferItemToCharacter(item, toName)`): the one place that says what a hand-off resets — carried_by becomes the new bearer, and equipped_by, stored_at, party_id, attuned (attunement is per-person), weapon_set and hand (the old owner's loadout) are cleared; charges, notes and the +N are untouched. Dropping an item on the character who already has it returns null (a stray drop on your own portrait must not unequip anything). 6 tests. UI: item rows in `CharacterInventory.vue` (equipped, carried, party pool, stored) are draggable onto a portrait in `CharacterContext.vue`; the character column auto-scrolls near its top/bottom edge while dragging, and a toast offers Undo. Inactive parties are a separate flag from the existing `active` (= the selected party): `inactive: true` on the party record in `user_prefs.json`, store getter `liveParties`, mutations `DEACTIVATE_PARTY` / `REACTIVATE_PARTY` (reactivation stamps the Year/Day the DM enters). Not verified in a browser.

**2026-10-08 (later) — One live party per character; inactive parties hand off their gear.** UI/store only, no engine rule change. Joining a party in play moves the character out of any other party in play (inactive parties keep their roster as history and may overlap); Manage Parties tiles show "in <party>" so the move isn't a surprise. Reactivating a party leaves out members who've since joined another live party and says so in the dialog. Marking a party inactive now asks where its pool gear goes, exactly like deleting one (`REASSIGN_PARTY_POOL`, same dialog). Characters in no live party are grouped as "Not in a Party". Existing overlaps in `user_prefs.json` are not rewritten; they clear as parties are edited or marked inactive. Not verified in a browser.

**2026-10-09 — One live party per character is now enforced (not just nudged), and a leaving party's gear has three destinations.** Project owner's design.
- **Rule (`engine/rules/partyMembership.js`, tested):** a character can be in only one party that's in play (not `inactive`); an inactive party keeps a free-form history roster. `joinCheck` (can they join?), `reactivationConflicts` / `reactivationBlockReason` (can this party come back?) return the reason, so the UI disables the action AND says why.
- **Party modal:** a character already in another live party shows "In <party> — remove them there first" on their tile and can't be added (the old behaviour silently moved them). **Reactivate…** is disabled with a visible reason naming who is where; "Mark Inactive" says why when it's the only party in play. The store's `REACTIVATE_PARTY` refuses too if anything gets past the UI (its old `members` filter is gone).
- **Gear of a party going out of play** (deactivate dialog): *hold it with the party* (default — the gear stays tied to that party id, which is the temporary pool), *give it all to one character* (new `GIVE_PARTY_POOL_TO_CHARACTER`, via `transferPoolToCharacter`), or *move it to a party in play*. Delete keeps character / party / unassigned. An inactive party's **Held gear** panel shows the item count with "Apply to party" and "Give to character"; reactivating the party brings its held gear back with it.
- **Also fixed:** `transferItemToCharacter` no longer turns an `equipped_by: 'disallowed'` item (scroll, bag, tool — 37 in the data) into an equippable one; `CharacterInventory.takeItem` ("click to carry") now uses the same rule.
- 12 new tests; engine 635/635, build clean. The store mutations and the modal aren't unit-testable; not verified in a browser.

**2026-10-09 — Carried items marked `equipped_by: 'disallowed'` were invisible on a character's inventory.** `CharacterInventory.carriedItems` was `carried_by === name && !equipped_by`, and `'disallowed'` (the mark for items that can't be equipped at all — scrolls, bags, tools, coins, sending stones) is truthy, so such items matched neither the Carried nor the Equipped list: 18 items on the roster (Jaygar's tools and bombs, Vaz's coins, Rhuna's horn, Lenn's flute, Revven's scroll, and Enauweyn's/Vaz's new scrolls, jug, sending stones and Bag of Tricks) couldn't be seen, dragged or moved. Now `'disallowed'` counts as carried, and `itemStatus` no longer says "Equipped by disallowed". Found because the new sending stones "weren't there"; the data was fine. Not verified in a browser.

**2026-10-09 — The DM handoff export gives the date the way the Calendar tab does, not a bare day count.** `DmExport.vue` put `party.day` (the absolute campaign day, e.g. 302) in the JSON and "Campaign Day 302" in the markdown, which reads as nothing on its own. New `calendar.describeGameDate(dayCount)` (engine, tested) returns `{ year (world year, internal + 466), season, day_of_year, days_in_year, week, day_of_week, festival, day_count, text }`; the JSON's `party.day` is now `party.date` with that object (the raw count is kept as `date.day_count`), and the markdown header uses `date.text`. East A (campaign day 302) exports as "Spring · Year 468 · Day 98 of 204 · Week 12, Day 6". Not changed: `formatGameDate` (used by the Party modal and the rest dialog) still prints the INTERNAL year ("Year 2"), which disagrees with the Calendar tab's "Year 468". Engine 637/637, build clean.

**2026-10-09 — No more "Year 2": every year a person reads or types is the world year.** `formatGameDate` printed the internal 1-based year ("Year 2") while the Calendar tab showed "Year 468". New engine helpers `FIRST_WORLD_YEAR` (467), `worldYearFromDayCount`, `dayCountFromWorldYearAndDay`; `formatGameDate` now prints the world year ("Winter · Year 467 · Week 1, Day 1"); the Party modal's Year fields (the date editor and the reactivate dialog) show and accept world years (min 467); `yearFromDayCount` remains internal arithmetic only. The top bar's small "Day N" next to the party name has a tooltip with the full date (`describeGameDate(...).text`: season, world year, day of 204, week). Updated the old `formatGameDate` test, which asserted the internal year. Engine 639/639, build clean. Existing saved dates are unaffected (they're day counts); only what's shown and typed changed — a date typed as the old "Year 2" would now clamp to year 467.

**2026-10-09 — Date ruling: a party's stored number is days since Year 467 day 1 (reading 1), and the displayed date was right all along.** Project owner's ruling after the history audit: most parties are at about Year 468 day 98 (counter ~302, spring). The one real error was East B at 98 (Year 467 day 98, before the campaign even began) — set to 302 to match East A. The stored number is only an internal count; people read the date. To give "how far into the campaign are we" without exposing that count, `calendar.campaignDay(dayCount)` (Campaign Day 1 = Year 467 day 137, the `world.json` `campaign_epoch`, which a test now keeps in step with `CAMPAIGN_EPOCH`) feeds `describeGameDate`: `campaign_day` in the export JSON and "Campaign day 166" at the end of the top bar tooltip (omitted before the epoch). **Still open:** Homefront (9 members) is at counter 1 (Year 467 day 1), which is before the campaign started and almost certainly an unset date. Engine 640/640, build clean.
