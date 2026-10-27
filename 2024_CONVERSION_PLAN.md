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

- [~] **0. Plumbing** — `ruleset.js`, branch, plan, CLAUDE.md. Thread `ruleset` through
  `loadClass`/`loadSubclass`/spellcasting/`describeLevelUp`/`diffLevelUp`.
- [ ] **1. Core rules** — exhaustion, conditions, actions, ASI-as-feat, unarmed strike/grapple.
- [ ] **2. Origins** — 2024 species, backgrounds (ASI + origin feat), origin feats, New Character flow.
- [ ] **3. Classes** — 12 PHB classes (Artificer stays legacy: no 2024 version exists). Barbarian first
      (vertical slice), then the rest. Weapon Mastery, fighting styles as feats, prepared-spell tables.
- [ ] **4. Subclasses** — the 2024 PHB subclasses; unrewritten ones stay legacy with a subclass-level
      shim (2014 Cleric/Sorcerer/Warlock pick at 1, Wizard/Druid at 2; 2024 is 3 for everyone).
- [ ] **5. Feats and spells** — 2024 feat catalog; 2024 spell text + class lists (reworked spells get a 2024 entry).
- [ ] **6. Roster migration** — script/LLM-assisted, one character at a time, preserving final ability totals and level.
- [ ] **7. Docs and cleanup** — CLAUDE.md, CHARACTER_SCHEMA.md, engine/CHECKLIST.md entries.

## Open questions for the project owner

(none yet — add here, ask in chat)
