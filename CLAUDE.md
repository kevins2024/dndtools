# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A D&D 5e campaign-management app (character sheets, combat tracker, world/location browser, spell/feature/monster bestiary, level-up tooling) — fully built by AI with guidance and prompting from the project owner. Vue 2 frontend, a small Express dev server, and a standalone rules engine. The app runs the **2024 (5.5e) rules**. They _replaced_ the 2014 rules; there is no edition switch, no `?ruleset=` query string and no second set of mechanics. Everything defaults to 2024, and where the 2024 books did not rewrite something (a 2014 subclass, feat, spell, species...) the engine falls back to the 2014 data and tags it **legacy**. The last commit with working 2014 mechanics is tagged `ruleset-2014-final`; see `2024_CONVERSION_PLAN.md` for the conversion's status.

## Commits

The project owner commits their own work frequently, so most sessions start with a mix of committed and uncommitted changes in the working tree — that's normal. When the project owner asks you to commit, just do it, no need to double-check first. Never commit unprompted.

## Commands

```bash
npm run serve          # frontend (webpack-dev-server, :8080) + backend (:3001) together — the normal way to run this locally
npm run front           # frontend only
npm run back             # backend only (node server.js)
npm run stop             # stop both dev servers
npm run build           # production build (vue-cli-service build) — use this to typecheck/verify, not just `serve`
```

```bash
cd engine && node --test                    # full engine test suite (seconds to run)
cd engine && node --test test/foo.test.js   # a single test file
cd engine && node --test test/e2e              # end to end: starts the real server on a free port and asks it over HTTP (read-only)
```

There is no frontend test suite. **Engine correctness is verified by `node --test`; there is no automated test runner for `src/`.**

Frontend and backend are separate processes on separate ports (`8080`/`3001`). The backend holds Node's `require()` cache, so it's the one that needs restarting after an `engine/` change — `npm run stop` catches both.

## Verification — Playwright is DISABLED, full stop

**Do not use Playwright or any live-browser/screenshot verification, for any change, for any reason** (data-only, interaction logic, new Vue component — all of it). It costs 3-4x the tokens of everything else, and the project owner checks the running app themselves. Only a future instruction from the project owner in the moment overrides this.

Verify instead with `npm run build` (compiles clean — real proof for a Vue app) and careful reading of the diff/logic. For data-only changes, also validate JSON (`python3 -c "import json; json.load(open(...))"`). For an interaction-logic change, say explicitly in your response which behavior wasn't verified live and is worth the project owner's own quick check.

`cd engine && node --test` is cheap — run it after any `engine/` change, always.

## Verifying D&D rules text (RAW) — 2024: dnd2024.wikidot.com; 2014 (legacy): dnd5e.wikidot.com

**2024 content:** fetch it with `node scripts/fetch-2024-wikidot.js <slug>` (e.g. `barbarian:main`, `wizard:evoker`, `feat:alert`, `species:elf`). Every page's first line is `Source: <book>`; that site also hosts Unearthed Arcana, third-party ("Arcana Unleashed") and homebrew pages, which are **not** rules — the ingest scripts (`scripts/ingest-2024-*.js`) refuse them. The rules glossary (rests, exhaustion, conditions) is not on the wiki; use the SRD 5.2 text (e.g. dndbeyond.com/sources/dnd/free-rules/rules-glossary) or `dnd5eapi.co/api/2024`. The rest of this section is about the **2014** wiki:

Applies any time a task checks a feature, feat, spell, or other rules text against the real game. Broad web search returns blended summaries that mix 2014 rules, the 2024 revision, Unearthed Arcana drafts and homebrew — wrong numbers slip through. 2024-rules and UA contamination are the two recurring failure modes.

**WebFetch a predicted `dnd5e.wikidot.com` URL first; fall back to WebSearch only if it 404s.** Pattern: `dnd5e.wikidot.com/<class>:<subclass-or-feature-slug>` (e.g. `wizard:evocation`, `monk:kensei`, `feat:metamagic-adept`). Slugs aren't perfectly predictable ("battlerager" not "path-of-the-battlerager", "the-land" not "land"). The site also hosts UA pages under names like `sorcerer:shadow-ua` — confirm the page is the canonical (non-UA) one.

When a result contains a surprising or mechanically significant number, cross-check a second independent source before editing anything.

## Dependencies — ask before installing anything new

Do not install new npm packages, system utilities, or any other dependency (`npm install`, `pip install`, ad-hoc `npx` tools, etc.) without asking the project owner first, even if it's normally low-risk. If a task seems to need something not already available, say so and ask.

## Architecture

### 2024 rules, 2014 data as the fallback

The engine's answer to every rules question is "use 2024; if there is no 2024 version, use 2014". `engine/data/5e2024/` holds what the 2024 books rewrote; `engine/data/5e/` is the older tree, kept only as the fallback (and for content the 2024 books never rewrote). `engine/rules/5e/ruleset.js` resolves a data file and falls back to the 2014 one; the loader tags such results `legacy: true`. Loaders (`loadClass`, `loadSubclass`, `loadSpecies`, `loadFeat`, `loadBackground`, spellcasting, multiclass, `weaponProps`...) take an optional trailing `ruleset` that **defaults to `'2024'`** (`DEFAULT_RULESET` in `rulesetId.js`). Callers do not pass one; the only reason to pass `'2014'` is to read the old tree directly (the migration of old sheets, tests of legacy data). 2014 _mechanics_ are retired: when a rule changed, only the 2024 rule exists. A legacy subclass that began before 3rd level starts at 3rd (`shiftEarlyLevels`). 2024 feature ids are prefixed `pub24_` (subclasses `pub24_sub_`), 2024 subclass names are the official ones with a 2014→2024 alias map in `data/5e2024/subclass-aliases.json` (old roster names still resolve). **Browser-bundled modules import `rules/5e/rulesetId.js` (pure), never `ruleset.js` (uses `fs`)** — `engine/test/browserSafe.test.js` walks the require graph from `src/` and fails if `fs`/`path` becomes reachable. Old 2014 sheets were moved over with `engine/rules/5e/migrate2024.js`; **Level-up choices have one description and one way to answer them:** `engine/rules/5e/choiceProtocol.js` (`previewLevelUp`) turns `diffLevelUp`'s ~26 pending-choice shapes into uniform descriptors (`id`, `kind`, `min`/`max`, `options`) and takes one `answers` map back; the UI renders descriptors generically, and the NPC builder and rules-conformance sweeps answer them with `autoLevelUp`. A new pending-choice type needs one entry in `SPECS` there (the sweeps fail on a choice with no description).

### Three-layer split: rules → game-aide engine → UI

1. **Rules** — raw D&D facts as small, pure functions/tables: ability modifier formula, point-buy cost table, proficiency bonus by level, base AC by armor type. Lives in `engine/data/5e/` + `engine/rules/5e/`'s smallest, most self-contained files (`abilities.js`, `progression.js`, `armor.js`, `pointBuy.js`).
2. **Game-aide engine** — takes layer 1 plus _this campaign's_ data (a specific character, their equipped items, this party) and produces real numbers **and structured explanations of those numbers**. AC, attack/damage bonus, saving throws, encounter balancing, level-up diffing, combat-turn state — all computed as plain data, never as a pre-built display string. Most of the rest of `engine/rules/` and `engine/rules/5e/` (`characterStats.js`, `armorClass.js`, `weaponSets.js`, `diffLevelUp.js`, `combatTurn.js`, `npcBuilder.js`, `validateCharacter.js`, `encounterGenerator.js`, ...).
3. **UI** — takes what layer 2 produces and decides how _this screen_ renders it: colors, layout, which fields go where, how a breakdown array becomes a tooltip string. **No game math ever happens here** — not "just this one small calculation," not "it's only for a tooltip." If a Vue file computes a number with a D&D-mechanical right answer, that's an architecture bug.

Layers 1+2 are `engine/` (portable: no Vue/Vuex/DOM, no HTTP); layer 3 is `src/` (Vue-specific, rewritten for the Godot port regardless). The test for "does this belong in the engine?" is not "does it need a network call" but "would a Godot version of this game need the same logic?" If yes, it's a pure, framework-free `engine/` function that Vue calls into and renders — even when the request is phrased as a UI ask (e.g. "add turn tracking to the combat screen"). **The Godot port is an active near-term plan**, so retrofitting mechanics out of components later is avoidable work.

**Tooltips/breakdowns:** a layer-2 function that explains a number returns `{ value, breakdown: [{ label, amount }, ...] }` — never a pre-joined string. Covers AC, saving throws, skills, passive perception, spell attack/DC, proficiency bonus, weapon attack/damage (`engine/rules/5e/checks.js`, `weaponAttack.js`, `proficiency.js`; plain functions like `savingThrow(...)` are just `savingThrowBreakdown(...).value`, so there is one implementation either way). `engine/rules/5e/breakdown.js`'s `bonusLines(sources, key)` is the shared helper for named item/feature lines. `dnd_utils.js` has one shared formatter, `_formatBreakdown()`, that joins any breakdown into this UI's tooltip string; `acBreakdown()` and every `xBreakdown()` delegate to it. To add a tooltip to a new stat: write an engine `xBreakdown`, add a thin delegate. **Hand-duplicated math for a tooltip is as bug-prone as hand-duplicated math for the real number** — there should only ever be one implementation, and the UI calls it.

**Browser use of `engine/`:** most consumption goes through `/api/engine/*` server routes (`server.js` calls `require('./engine/index')`; `preview-level-up` wrapping `engine.diffLevelUp` is the important one). Browser code MAY `require()` an `engine/rules/*.js` file directly for hot-path, session-local state that touches no JSON data table (the combat-turn tracker, `src/utils/combatTurn.js`, is the example). **Import the specific leaf file (`engine/rules/combatTurn.js`), never the `engine/index.js` barrel** — several modules in the barrel (`classFeatures.js`, `subclasses.js`, ...) call `fs`/`path` at require-time, which webpack can't bundle (`npm run build` fails with "Can't resolve 'fs'"). A module meant for direct browser use must have zero dependencies on `fs`/`path` or any rule file that does.

**`engine/CHECKLIST.md` is a dated history log of finished engine work — do NOT read it whole.** (Entries before 2026-09-24 are in `engine/CHECKLIST_ARCHIVE.md`.) `grep` it for the specific feature, file or term you're working on, then read only the matching entry. Add a dated entry for each session's engine changes (what was found/built/fixed and why). `TODO.md` (repo root) is the open-work backlog.

**5e-ruleset files live under `engine/rules/5e/` and `engine/data/5e/`**, separate from generic plumbing, so a future ruleset can tell 5e-specific content apart at a glance. `combatTurn.js`, `npcBuilder.js`, `validateCharacter.js` and `pointBuy.js` stay directly under `rules/`. Some files build their data path from `__dirname` instead of a plain `require()` (`classFeatures.js`, `subclasses.js`, `featureCatalog.js`, `spellLists.js`) — if any ever move, update those lines by hand; an IDE's import-rewrite won't catch them.

Inside `engine/`:

- `rules/5e/classFeatures.js` / `rules/5e/subclasses.js` — load `data/5e/classes/*.json` / `data/5e/subclasses/*.json`. **Features are referenced by ID, not name** (`features_by_level: {"3": ["some-feature-id"]}`), resolved to display names at load time via `rules/5e/featureCatalog.js` (id→name index in `data/5e/feature-catalog.json`, merged from the SRD feature cache + `published_features.json`). Needed because real features share names across classes (e.g. "Spellcasting"). When adding a class/subclass feature, give it a real id — reuse an SRD index or `published_features.json` id if that exact feature exists, otherwise add a `published_features.json` entry and reference its id.
- `rules/5e/spellcasting.js` — slot/cantrip/known-spell tables per class, via `resolveSpellcasting(className, subclassName)` so a subclass can grant spellcasting the base class lacks (Eldritch Knight, Arcane Trickster — third casters).
- `rules/5e/levelUp.js` (`describeLevelUp`) computes what a single class's level-up _should_ look like in isolation (no character-shape knowledge). `rules/5e/diffLevelUp.js` (`diffLevelUp`) is the adapter — with `validateCharacter.js`, the only place that knows the `characters.json` shape; it diffs `describeLevelUp` against a real character and returns `{ patch, pendingChoices, warnings }`.
- Feature-grant deduplication in `diffLevelUp` is keyed on **name + level_gained**, not name alone — several classes legitimately grant the same-named feature at different levels (Expertise, Magical Secrets, Favored Enemy improvements).

### `src/data/*.json` — what's committed vs. regenerated

Most of `src/data/` is hand-authored campaign data (`characters.json`, `places.json`, `npcs.json`, `party_items.json`, `world.json`, etc.) and is the source of truth — edit it directly.

`src/data/api_data_cache/` holds bulk SRD reference data (spells, features, species flavor) — **committed**, not gitignored (gitignoring it once caused real data loss; don't re-gitignore). Rebuilt via `scripts/build-srd-cache.js`.

`published_spells.json` / `published_features.json` / `published_monsters.json` hold **real non-SRD content and homebrew side by side** — each entry's `homebrew: true/false` flag (and a book `source` citation when not homebrew) distinguishes them. `monsters_index.json` is a lightweight index-only cache (name/CR/type/size/publisher, no stat block) bulk-imported from external sources; homebrew monsters get a matching lightweight entry here (`publisher: "Homebrew"`) _and_ a full stat block in `published_monsters.json`, since `MonsterBrowser.vue` only reads the index for its list.

**Items work like features: by reference, never copied.** `party_items.json` holds item _instances_ — `catalog_id` plus only what's true of that copy (carrier, attuned, charges, notes, its +N, any deliberate override). Text, rarity, attunement and source live in the item library: `engine/data/5e/magic-items.json` (904 official items, built by `scripts/build-item-cache.js` — don't hand-edit) and `engine/data/5e/campaign-items.json` (our unique/homebrew items); structured game effects live in `engine/data/5e/item-mechanics.json`, keyed by library id (same job `feature-mechanics.json` does for features). `server.js` hydrates items on `GET /api/party_items` and dehydrates on save (`engine/rules/5e/itemHydration.js`), so the UI sees full objects and the file on disk never holds library data. Adding an item: the server links by name when it clearly matches (`autoLinkItem`), so name it correctly; a genuinely new unique item needs an entry in `campaign-items.json` and a `catalog_id` — don't paste its text into the record. A variation on an official item (a 3- or 7-level Ring of Spell Storing) uses `variant_of` + `desc_edits`. `node scripts/audit-items.js` lists unlinked items, copied data and overrides; engine tests fail if a linked item repeats library data. Mounts, plain mundane weapons/armor and per-party ledgers like Gem Pouch stay unlinked on purpose.

**There is no separate lore folder — lore lives in `src/data/`, one home per kind of fact.** Legends, history and world "nuggets" → `lore.json` (each has a `type` such as `place_history`, `legend`, `faction_history`, `material`, `species`, plus tags, summary, detail); continents and regions → `world.json` (a draft continent is `status: "draft"`); cities, towns and their history → `places.json`; a creature with a stat block → `published_monsters.json` plus `monsters_index.json`, with campaign lore in the record's `description`. Put a fact in the one place it belongs; where another record needs it, use a short note naming the entry (e.g. `see the lore entry "duskglass-001"`) rather than copying the text.

### Data flow: server ↔ store ↔ components

`server.js` (dev-only, never deployed) serves generic CRUD over a whitelisted table list (`GET`/`POST /api/:table`) with **3-way merge on save** (`current` vs. `base` vs. what's on disk) so a stale browser tab can't clobber concurrent changes — see the comment above that route. `src/utils/dataService.js` is the client counterpart. Vuex (`src/store/index.js`) holds live state; `LevelUpTool.vue` and `NewCharacterTool.vue` use a **pending-save / dirty-tracking pattern** (`src/mixins/pendingCharacterSaves.js` + `PendingCharacterSaveBar.vue`) — edits apply to the store immediately for live preview but don't autosave; saving is explicit and revertable.

### `lookupService.js` — the shared external-data cache

`src/utils/lookupService.js`'s `lookupSpell`/`lookupFeature`/`lookupMonster` resolve local SRD cache → local `published_*.json` → live `dnd5eapi.co`, each tier cached (in-memory `Map`, then `localStorage`). `lookupFeature(name, id)` and `lookupMonster` prefer an id/exact match before fuzzy name matching. It's the one place that talks to the outside network; UI components should go through it.

### Two "browser" component patterns worth knowing before adding a third

- **Tree browsers** (`LocationBrowser.vue`, `HomebrewBrowser.vue`) share `TreeNode.vue`. A node can carry `copyActions: [{label, title, data}]` for a generic "copy as JSON" button (hand off a whole region or one settlement).
- **Filterable list + detail browsers** (`SpellBrowser.vue`, `MonsterBrowser.vue`) merge a local SRD cache array with a `published_*.json` array client-side, dedupe by name, and render a filter sidebar + paginated list + detail panel. `MonsterBrowser.vue`'s `formatSpeed`/`formatSenses` assume values already carry their unit (`"40 ft."`) — don't re-append one.
