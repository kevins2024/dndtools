# Character schema (as consumed by `engine/`)

This is a reference for the shape of a `characters.json` entry — written because
that shape has never been documented in one place; it's only ever existed as
tribal knowledge scattered across `validateCharacter.js`, `diffLevelUp.js`, and
whichever Vue component last needed a new field. Anyone building a new consumer
of this data (a rewrite, a Godot port, a fresh backend) needs this doc as a
starting point — it is not exhaustive of every field the Vue app renders, only
the shape `engine/` itself reads or writes.

**This file describes what exists today, warts included.** It is not a proposal
for a cleaner v2 schema — see "Known inconsistencies" below for the messy parts,
called out rather than smoothed over, so a future migration can address them
deliberately instead of rediscovering them by breaking on a real character.

## Top-level fields `engine/` reads or writes

| Field                                                      | Type             | Notes                                                                                                                                                                     |
| ---------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`                                                     | string           | Display name.                                                                                                                                                             |
| `level`                                                    | number           | **Total** character level (sum of all classes). Kept in sync with `classes[].level` by callers — engine doesn't derive it.                                                |
| `classes`                                                  | array            | See below. `classes[0]` is treated as "primary" by `validateCharacter.js` only when no entry has `started: true`; that fallback is a guess, not a rule (see below).       |
| `proficiency_bonus`                                        | number           | Expected to equal `progression.proficiencyBonus(level)` — `validateCharacter` warns (not errors) on mismatch.                                                             |
| `saving_throws`                                            | array of strings | Proficiency names (e.g. `"strength"`). RAW: comes only from whichever class was taken **first**, never every class the character has levels in.                           |
| `skill_proficiencies`                                      | array of strings | Skill ids.                                                                                                                                                                |
| `skill_expertise`                                          | array of strings | Skill ids with double proficiency (Rogue/Bard Expertise etc).                                                                                                             |
| `spellcasting_ability`                                     | string or null   | `"intelligence" \| "wisdom" \| "charisma" \| null`. For multiclass spellcasters this is the primary/first-declared caster's ability — engine doesn't track one-per-class. |
| `spells`                                                   | array            | See below.                                                                                                                                                                |
| `features`                                                 | array            | See below.                                                                                                                                                                |
| `hp_max`, `hp_current`                                     | number           |                                                                                                                                                                           |
| `hit_dice_current`                                         | varies           | Per-class remaining hit dice; shape not standardized (see below).                                                                                                         |
| `ability_score_history`                                    | array            | ASI/feat picks over levels; consumed by `diffLevelUp.js` to avoid re-offering an already-spent ASI.                                                                       |
| `active_effects`                                           | array            | Not validated by engine; read by UI only.                                                                                                                                 |
| `armor_proficiencies`, `weapon_proficiencies`, `languages` | array of strings |                                                                                                                                                                           |
| `darkvision`, `hit_die`, `unarmored_ac_formula`            | misc             | Per-character derived/override values.                                                                                                                                    |

Fields the Vue app also stores (`full_name`, `campaign_start`, `race`, `appearance`,
`image`, `stat_str`/`stat_dex`/etc, `notes`, `persona_notes`, `id`) are pure display/
flavor data `engine/` never reads — not documented further here.

## `classes[]`

```json
{ "name": "Fighter", "subclass": "Champion", "level": 4, "started": true }
```

- `started: true` marks the class taken **first** (determines saving-throw
  proficiencies under RAW). **Array order is not reliable** — a real roster
  character (Kerra) lists Fighter first positionally but took Warlock first, so
  `started` is the actual source of truth and array position is not. A
  multiclass character with no `started` entry is a real gap:
  `validateCharacter.js` skips the saving-throw check entirely rather than
  guessing.
- `diffLevelUp.js` only levels up a class the character **already has** —
  picking up a brand-new class via multiclassing is a separate, not-yet-built
  flow (tracked in `TODO.md`).

## `spells[]`

```json
{
  "name": "Invisibility",
  "level": 2,
  "prepared": true,
  "featureGranted": true,
  "_source": "Shadow Touched"
}
```

- `level: 0` (or `type: "cantrip"`) marks a cantrip.
- **Three different, overlapping conventions mark "this spell is a free bonus
  and shouldn't count against the known-spell cap"**, accumulated character by
  character rather than designed up front: `type: "oath"` (Paladin), `domain:
true` (Cleric), `featureGranted: true` + `_source: "..."` (general-purpose —
  any feat/feature/item grant, the one to use going forward). `validateCharacter.js`'s
  `isBonusSpell()` is the single place that reconciles all of them; a new
  consumer must replicate that reconciliation, not just check one flag.
- `type: "patron"` (Warlock expanded list) looks the same shape as the above
  but is deliberately **not** exempt from the known-spell cap — it only
  expands the pool a known pick can come from, RAW still spends a normal slot
  on it.
- Spells are **not tagged with which class granted them**. A character with
  two known-spell-cap classes at once (e.g. a real Bard/Sorcerer multiclass)
  genuinely has two separate spell pools under RAW, but there's no field to
  split `spells[]` by source class — `validateCharacter.js` explicitly skips
  the cap check in this case rather than guessing.

## `features[]`

```json
{ "name": "Extra Attack", "type": "feature" }
```

Loosely-typed list, mostly a display feed for the UI. Not deduplicated or
cross-checked against `engine/data/classes/*.json`'s `features_by_level` by
anything at write time — `diffLevelUp.js`'s own grant logic is keyed on
**name + level_gained**, specifically because several classes legitimately
grant an identically-named feature more than once at different levels
(Rogue/Bard Expertise, Bard Magical Secrets, Ranger Favored Enemy/Natural
Explorer improvements) — a name-only key would silently drop every grant
after the first. A schema that wants real feature tracking should carry a
`level_gained` (or the id from `featureCatalog.js`) alongside the name, not
name alone.

## Known inconsistencies (real, not yet worth a forced migration)

These are documented rather than fixed here — normalizing them means touching
every character in `characters.json` by hand or scripting a migration, which
is a bigger, riskier change than this pass's "small to medium" scope. Listed
so a real migration (when the "real game" transition actually starts) has a
checklist instead of rediscovering these live:

1. **Bonus-spell marking** has 3 shapes (`type: "oath"`, `domain: true`,
   `featureGranted: true`) — should converge on one (`featureGranted` +
   `_source` is the most general and already used for non-subclass grants).
2. **No `tool_proficiencies` field exists anywhere** on the schema — not for
   multiclassing (PHB's multiclass tool grants), not even for a starting
   class's own tool grants (e.g. Rogue's thieves' tools). Any real game
   needs this tracked; right now it simply isn't, anywhere.
3. **Spells aren't tagged by granting class** — blocks correct known-spell-cap
   validation for genuine multi-caster multiclass characters.
4. **`classes[].started` is optional but load-bearing** — a multiclass
   character without it has undefined saving-throw behavior (currently: the
   check is silently skipped). Should probably be required once a real
   migration touches this file.
5. **`hit_dice_current`'s shape isn't standardized** across the roster — some
   entries are per-class, some aren't; no single consumer in `engine/`
   currently depends on a specific shape, but a real game's HP/rest system
   will need one.

## Where the boundary actually is today

`engine/` never reads or writes `characters.json` directly — `validateCharacter.js`
and `diffLevelUp.js` are the only two files in `engine/` that know this shape
at all (per `CLAUDE.md`'s architecture note); every other engine module only
deals in plain `(className, level, abilityScores, ...)` inputs. A future
non-Vue consumer that wants engine's rules but not this exact character shape
can use everything else in `engine/` untouched and only needs to re-implement
the adapter layer these two files represent — which is also exactly why this
doc scopes itself to what those two files touch, not the full display schema.
