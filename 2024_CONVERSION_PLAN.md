# 2024 (5.5e) conversion plan

Working branch: `claude/dnd-2024-ruleset-conversion`. The polished 2014 state is the commit
before this branch's first commit (tagged locally as `ruleset-2014-final`).

Started 2026-10-27 after the audit in the session that created this file. Decisions the
project owner made: keep one repo (no fork); keep legacy 2014 content wherever the 2024 rules
did not rewrite it (WotC treats unrewritten subclasses/species/spells/feats as usable);
migrate existing characters mostly by script/LLM, asking when a build choice is ambiguous.

## Design

- **`ruleset`** is `"2014"` or `"2024"`. Default `"2014"` everywhere, so nothing existing changes
  until something opts in. A character carries `ruleset`; it stays `"2014"` until migrated.
- **Data layout.** `engine/data/5e/` is the 2014 tree and is never edited for this project.
  `engine/data/5e2024/` mirrors it and holds only content the 2024 rules rewrote. A 2024
  lookup with no file of its own is served the 2014 file — that is how legacy content works
  (`engine/rules/5e/ruleset.js`, `isLegacyFallback`). Anything served that way should be
  shown as "Legacy (2014)" in the UI.
- **Feature ids.** 2024 features get ids prefixed `pub24_` (e.g. `pub24_barbarian-rage`) so a
  same-named 2014 feature (`rage`) is never overwritten. Names stay the real ones. Text goes in
  `src/data/published_features.json` with `ruleset: "2024"` and a `Player's Handbook (2024)`
  source; the id->name entry goes in `engine/data/5e/feature-catalog.json` (shared catalog).
- **Official 2024 books beyond the PHB exist and are on the wikidot site** — Eberron: Forge of the
  Artificer (a 2024 Artificer + 4 subclasses), Forgotten Realms: Heroes of Faerun, Ravenloft: The
  Horrors Within, Lorwyn: First Light. The same site also hosts **Arcana Unleashed** (not WotC),
  Unearthed Arcana (`ua:all`) and homebrew (`hb:all`). Every page's first line is `Source: <book>`;
  the ingest scripts read it and refuse unofficial sources (`--allow-source` overrides). This corrects
  the first audit, which said Artificer had no 2024 version and counted 44 PHB-matching subclasses:
  **54 of the repo's 114 subclasses have an official 2024 page; 6 exist only in Arcana Unleashed
  (kept as legacy); 54 have none (legacy).** 18 of the roster's 30 class/subclass entries have a 2024
  version; 12 do not (Inquisitive, Path of the Giant, Oath of the Crown, Tempest, Oath of the Open
  Road, Echo Knight, Swashbuckler, Divine Soul, Weave Attunement, Scout, Infused Arbalist, Chronurgy).
- **Sources for 2024 rules text** (CLAUDE.md's RAW rule, updated): fetch
  `dnd2024.wikidot.com/<class>:main`, `<class>:<subclass>`, `species:<name>`, `feat:<name>`,
  `spell:<name>`; SRD 5.2 structured data is at `dnd5eapi.co/api/2024/`. Use
  `scripts/fetch-2024-wikidot.js <slug>` for readable text with tables kept as rows.
  The 2014 wikidot (`dnd5e.wikidot.com`) is the source for legacy content only.
- **Testing.** TDD where the rule is a number or table (write the 2024 test from the fetched
  rules text, then the data/code). The existing 2014 suite stays and is the regression suite
  proving legacy still works.

## Phases

Status: `[ ]` open, `[~]` in progress, `[x]` done.

- [x] **0. Plumbing** — `ruleset.js`, branch, plan. `ruleset` threaded through `loadClass`/`loadSubclass`/
      spellcasting/multiclass/`describeLevelUp`/`diffLevelUp`. (CLAUDE.md update still to do, phase 7.)
- [~] **1. Core rules** — exhaustion (2024: -2 per level to D20 Tests, -5 ft Speed per level) and the 2024 Long/Short
  Rest rules are in the engine with tests. Still to do: conditions text/data for the UI (`src/data/conditions.js` is
  2014), actions list, unarmed strike/grapple, wiring `exhaustionEffects` into the roller and conditions row.
- [x] **2. Origins** — 2024 species, backgrounds (+ `applyBackgroundBonus`), origin feats; loaders ruleset-aware.
      The New Character _UI_ flow is not changed yet.
- [~] **3. Classes** — all 13 chassis, spellcasting/multiclass, feature mechanics (225 drafted + reviewed overrides) and
  the level-up choices (`choices2024.js`: Weapon Mastery, Fighting Style feats, Orders, Expertise, Metamagic, Primal
  Knowledge) are done and tested. The Level Up _UI_ has no screens for the new pick types yet.
- [~] **4. Subclasses** — 68 official 2024 subclasses + aliases; legacy subclasses start at 3rd level under 2024
  (`shiftEarlyLevels`). Sorrow Knight deliberately not ingested (source "D&D Beyond Drops", status unclear).
- [~] **5. Feats and spells** — 75 PHB feats and 391 PHB spells (`src/data/spells_2024.json`) with 2024 class lists;
  lookups are ruleset-aware. Spells from other official 2024 books can be added with
  `scripts/ingest-2024-spells.js --source "<book>"`.
- [~] **6. Roster migration** — `migrate2024.js` + `scripts/migrate-roster-2024.js` done; the review is in
  `2024_MIGRATION_REPORT.md`, proposed backgrounds in `2024_MIGRATION_ANSWERS.json`. **Not applied** to
  `characters.json` until the project owner signs off.
- [~] **7. Server/UI + docs** — `server.js` engine routes take `?ruleset=` and there is `POST /api/engine/migrate-2024`.
  CLAUDE.md and the engine checklist are updated. Vue screens (ruleset badge, legacy badge, 2024 pick UIs, New
  Character flow, conditions) are still to do. `npm run build` passes.

## Open questions for the project owner

- Which 2024 background each of the 19 characters without one should take (proposals in `2024_MIGRATION_ANSWERS.json`).
- Iyani's homebrew background "Daughter of the Weave": keep as legacy with a chosen origin feat, or map to a 2024 one?
- Weapon Mastery picks (about 20 of them) — suggestions come from equipped weapons; the rest need an answer.
