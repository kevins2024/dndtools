# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A D&D 5e campaign-management app (character sheets, combat tracker, world/location browser, spell/feature/monster bestiary, level-up tooling) — fully built by AI with guidance and prompting from the project owner. Vue 2 frontend, a small Express dev server, and a standalone rules engine.

## Commits

The project owner commits their own work frequently, so most sessions will start with a mix of committed and uncommitted changes already in the working tree — that's normal, not a sign of abandoned work. When the project owner asks you to make a commit, just make it — no need to pause and double-check first (2026-09-11: "don't worry about commits... I do commits quite often but I want you to be able to if asked"). This doesn't relax the general rule against committing unprompted.

## Commands

```bash
npm run serve          # frontend (webpack-dev-server, :8080) + backend (:3001) together — the normal way to run this locally
npm run front           # frontend only
npm run back             # backend only (node server.js)
npm run build           # production build (vue-cli-service build) — use this to typecheck/verify, not just `serve`
```

```bash
cd engine && node --test                    # full engine test suite (~125 tests, seconds to run)
cd engine && node --test test/foo.test.js   # a single test file
```

There is no frontend test suite (`npm test` is an unconfigured placeholder). **Engine correctness is verified by `node --test`; there is no automated test runner for `src/`.**

## Verification — run lean by default, Playwright is DISABLED, full stop

**Live browser verification (Playwright, screenshot-checked) is disabled entirely for this project. Do not spin one up, for any change, for any reason — not for data-only changes, not for real interaction-logic changes (level-up/character-creation flow, a new Vue component), not even ones that feel like they'd benefit from it.** Decided 2026-09-03. Project owner's exact words: "that's not what i said to do. i said disable playwright entirely." — a prior version of this rule carved out an exception ("unless the project owner explicitly asks for it in that specific instance"); that exception was wrong and has been removed. Treat this as unconditional unless a future instruction from the project owner says otherwise in the moment.

Why: a session where four background tasks that each paired code changes with a Playwright verification pass cost roughly 3-4x what a same-sized research-only task cost (285k-380k tokens/176-212 tool calls vs. ~97k tokens/40 calls) — the iterative "write script → run → screenshot → adjust → rerun" loop is the single biggest token multiplier available, because every tool round-trip re-sends the whole accumulated context. Project owner's own words: "if we verify DATA and get the rules and functions and methods correct, i will be able to find UI hiccups much more cheaply than reading a screenshot for you" — they are a capable, present collaborator who checks the actual app themselves; don't spend their tokens re-deriving what one glance from them settles instantly.

What this means in practice: verify via `npm run build` (compiles clean — this is real proof for a Vue app, it catches template/type errors) and careful reading of the diff/logic itself. For a data-only change (new JSON entries, a new subclass/monster/feature) or a small UI tweak: validate JSON with `python3 -c "import json; json.load(open(...))"`, run `npm run build`, and stop there. For an actual interaction-logic change: same (build + logic review), and explicitly say in your response which specific behavior wasn't verified live and is worth the project owner's own quick check (e.g. "I changed X — worth clicking through Y once to confirm, since I'm not running the browser for this").

`cd engine && node --test` is fast and cheap — run it after any `engine/` change, always. This is unaffected by the Playwright change; engine tests are the real, cheap, automated correctness check for `engine/` and should stay thorough.

## Verifying D&D rules text against a real source — go straight to dnd5e.wikidot.com

This applies any time a task involves checking a feature, feat, spell, or other rules text against the real published game (RAW) — not just the subclass audit that discovered it. Decided 2026-09-09, after a session-long subclass audit repeatedly got contaminated results from broad web search: a single open-ended WebSearch query routinely returns a blended AI summary of many pages at once, and nothing distinguishes 2014 rules from the 2024 revision from an Unearthed Arcana playtest draft from a homebrew "fix" — a wrong or scrambled number slips through unless it happens to look suspicious enough to trigger a second check. This campaign runs 2014 rules only (see the intro above); 2024-rules and UA contamination are the two recurring failure modes to watch for.

**Default to WebFetch on a predicted `dnd5e.wikidot.com` URL first, before reaching for WebSearch.** The site's URL pattern is predictable: `dnd5e.wikidot.com/<class>:<subclass-or-feature-slug>` (e.g. `wizard:evocation`, `barbarian:beast`, `monk:kensei`, `feat:metamagic-adept`) — guess it and fetch directly; only fall back to a WebSearch query if that 404s (slugs aren't perfectly predictable — e.g. "battlerager" not "path-of-the-battlerager", "the-land" not "land" for some class/subclass pairs). This is more reliable than search _and_ cheaper, since it skips the search round-trip entirely in the common case. One caveat even on this domain: it hosts UA playtest pages separately under names like `sorcerer:shadow-ua` — make sure the fetched page is the canonical (non-UA-suffixed) one before trusting it as RAW.

When a WebFetch/WebSearch result contains a suspicious, surprising, or mechanically significant number, cross-check it against a second independent source before editing anything — this campaign's history has multiple confirmed cases of a first search result being wrong (2024-rules bleed-through on Fighter Champion and Oath of Devotion; a UA draft's numbers on College of Creation's Dancing Item and Shadow Magic's Hound of Ill Omen; a fan homebrew "fix" blended into an official-sounding summary on Purple Dragon Knight's Rallying Cry) — a second, cleaner fetch corrected all of them.

## Dependencies — ask before installing anything new

Do not install new npm packages, system utilities, or any other new dependency (`npm install`, `pip install`, `brew install`, downloading a tool via `npx` to use ad hoc, etc.) without asking the project owner first, even if it would make a task easier or is normally a low-risk action. Decided 2026-09-03, same conversation as the Playwright decision above. If a task seems to need something not already available, say so and ask, rather than installing it and mentioning it after the fact.

When `npm run serve` was already running from earlier in the session and you need to restart it after an `engine/`-affecting change: the frontend and backend are **separate processes on separate ports** (`8080`/`3001`), and killing one does not kill the other — the backend is the one holding Node's `require()` cache, so it's the one that actually needs restarting for engine changes to take effect. `lsof -ti:8080,8081,3001 -sTCP:LISTEN | xargs -r kill` catches both.

## Architecture

### Two-tier split: `engine/` vs everything else

`engine/` is a standalone, dependency-free rules module (see `engine/package.json`) — no Vue/Vuex imports anywhere in it, deliberately portable to a non-Vue future (a Godot port has been discussed). It knows D&D mechanics; it knows nothing about HTTP, JSON files on disk outside its own `engine/data/`, or the UI. `server.js` is the only thing that calls into it from the app side (`require('./engine/index')`), via a handful of `/api/engine/*` routes — `preview-level-up` is the important one, wrapping `engine.diffLevelUp`.

**Standing rule, not just a description of what already exists (2026-09-11): the Godot port is an active near-term plan, not a hypothetical** — expected to start within weeks. Any new logic that's a real D&D rule (turn/round structure, action economy, resource pools, anything with a mechanical right answer independent of how it's displayed) belongs in `engine/` as a pure, framework-free function, not written inline inside a Vue component — even when the feature request is phrased as a UI ask (e.g. "add turn tracking to the combat screen"). The test each time: would a Godot version of this game need the same logic? If yes, it's an `engine/` function that Vue calls into and renders, not Vue-only state. Retrofitting mechanics out of components later is real, avoidable work — the cost of asking "does this belong in engine/?" up front is much lower than paying it back after the port has already started.

Most `engine/` consumption goes through `/api/engine/*` server routes (rules-catalog lookups, level-up diffing) — but browser code MAY `require()` an `engine/rules/*.js` file directly for hot-path, session-local state that doesn't touch a JSON data table (the combat-turn tracker in `src/utils/combatTurn.js` is the first example: rapid-click UI state, same category as this app's existing HP/death-save tracking, which is already synchronous local Vue state with no network round-trip). **This must import the specific leaf rule file directly (`engine/rules/combatTurn.js`), never the `engine/index.js` barrel** — the barrel re-exports every rule module, and several (`classFeatures.js`, `subclasses.js`, etc.) call Node's `fs`/`path` at require-time to read `engine/data/*.json` off disk; webpack can't bundle those for a browser build (confirmed: pulling in the barrel breaks `npm run build` with "Can't resolve 'fs'"/"'path'"). A new `engine/` module meant for direct browser use must have zero dependencies on `fs`/`path` or any other rule file that does, and must be required by its own path, not via `index.js`.

**`engine/CHECKLIST.md` is the engine's own working log** — every session's engine changes get a dated entry with what was found/built/fixed and why. Read it before starting engine work; it's the fastest way to learn the current state and established conventions without re-deriving them. `TODO.md` (repo root) is the broader, non-engine backlog.

Inside `engine/`:

- `rules/classFeatures.js` / `rules/subclasses.js` — load `data/classes/*.json` / `data/subclasses/*.json`. **Features are referenced by ID, not name** (`features_by_level: {"3": ["some-feature-id"]}`) — resolved back to display names transparently at load time via `rules/featureCatalog.js` (a local id→name index, `data/feature-catalog.json`, merged from the SRD feature cache + `published_features.json`). This exists because multiple real 5e features share a name across different classes/subclasses (e.g. "Spellcasting"), and a name-only lookup can silently resolve to the wrong one. When adding a new class/subclass feature, give it a real id — reuse an SRD index or a `published_features.json` id if one already exists for that exact feature, otherwise write a new `published_features.json` entry and reference its id.
- `rules/spellcasting.js` — slot/cantrip/known-spell tables per class, resolved via `resolveSpellcasting(className, subclassName)` so a subclass can grant spellcasting a base class doesn't have (Eldritch Knight, Arcane Trickster — "third caster," PHB's level÷3 multiclass rate) without every caller needing to know which case it's in.
- `rules/levelUp.js` (`describeLevelUp`) computes what a single class's level-up _should_ look like in isolation (pure, no character shape knowledge). `rules/diffLevelUp.js` (`diffLevelUp`) is the adapter — the one other place besides `validateCharacter.js` that knows the `characters.json` shape, diffs `describeLevelUp`'s output against a real character, and returns `{ patch, pendingChoices, warnings }` for a caller to apply. `diffLevelUp` only levels up a class the character already has — picking up a brand-new class via multiclassing isn't supported yet (see TODO.md).
- Feature-grant deduplication (in `diffLevelUp`) is keyed on **name + level_gained**, not name alone — several classes legitimately grant the identically-named feature more than once at different levels (Rogue/Bard's Expertise, Bard's Magical Secrets, Ranger's Favored Enemy/Natural Explorer improvements). A name-only key silently drops every grant after the first.

### `src/data/*.json` — what's committed vs. regenerated

Most of `src/data/` is hand-authored campaign data (`characters.json`, `places.json`, `npcs.json`, `party_items.json`, `world.json`, etc.) and is the real source of truth — edit it directly, it's just JSON.

`src/data/api_data_cache/` holds bulk SRD reference data (all spells, all features, species/race flavor) — **committed**, not gitignored, rebuilt via `scripts/build-srd-cache.js` when it needs refreshing. It was gitignored once; that caused real data loss (a homebrew migration wrote into it and the content was never committed). Don't re-gitignore it.

`published_spells.json` / `published_features.json` / `published_monsters.json` hold **real non-SRD content and homebrew side by side** — each entry's own `homebrew: true/false` flag (and a real book `source` citation when it's not homebrew) distinguishes them, rather than splitting homebrew into a separate file. `monsters_index.json` is different: a lightweight index-only cache (name/CR/type/size/publisher, no stat block) bulk-imported from external sources — homebrew monsters get a matching lightweight entry here (`publisher: "Homebrew"`) _and_ their full stat block in `published_monsters.json`, since `MonsterBrowser.vue` only reads the index file for its browsable list.

`lore/` (Obsidian-vault-compatible markdown) is the narrative-depth layer for things no UI widget queries — see `lore/README.md`. Don't duplicate mechanical facts there; link out to the `src/data/` name instead.

### Data flow: server ↔ store ↔ components

`server.js` (dev-only, never deployed) serves generic CRUD over a whitelisted table list (`GET`/`POST /api/:table`) with **3-way merge on save** (`current` vs. `base` vs. what's actually on disk right now) so a stale browser tab can't clobber concurrent changes — see the comment above that route for the exact mechanism. `src/utils/dataService.js` is the client-side counterpart. Vuex (`src/store/index.js`) holds the live state; several tools (`LevelUpTool.vue`, `NewCharacterTool.vue`) use a **pending-save / dirty-tracking pattern** (`src/mixins/pendingCharacterSaves.js` + `PendingCharacterSaveBar.vue`) — edits apply to the store immediately for live preview but don't autosave, so a "Save" action is always explicit and revertable.

### `lookupService.js` — the shared external-data cache

`src/utils/lookupService.js`'s `lookupSpell`/`lookupFeature`/`lookupMonster` all follow the same three-tier resolution: local SRD cache → local `published_*.json` → live `dnd5eapi.co` API, each tier cached (in-memory `Map`, then `localStorage`). `lookupFeature(name, id)` and `lookupMonster` both prefer an id/exact match when available before falling back to fuzzy name matching. This is the one place that talks to the outside network; most UI components should go through it rather than fetching the API directly.

### Two "browser" component patterns worth knowing before adding a third

- **Tree browsers** (`LocationBrowser.vue`, `HomebrewBrowser.vue`) share `TreeNode.vue`. A node can carry a `copyActions: [{label, title, data}]` array to get a generic "copy as JSON" button — used for hierarchical hand-off (copy a whole region including its settlements, or just one settlement).
- **Filterable list + detail browsers** (`SpellBrowser.vue`, `MonsterBrowser.vue`) merge a local SRD cache array with a `published_*.json` array client-side, dedupe by name, and render a filter sidebar + paginated list + detail panel. `MonsterBrowser.vue`'s `formatSpeed`/`formatSenses` helpers assume speed/sense values already carry their own unit string (`"40 ft."`) — don't re-append one.
