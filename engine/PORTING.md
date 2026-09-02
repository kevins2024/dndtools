# Porting `engine/` to Godot (GDScript)

Strategy doc, not a working log — written 2026-09-02 when the project owner
raised the eventual Godot port and asked whether it should change how
current data gets organized. Read this before making a structural decision
about `engine/` or `src/data/` that might make a future port harder.

## The short answer

**The current architecture is already close to ideal for this.** `engine/`
has been kept dependency-free and Vue/Vuex-free from the start specifically
for this reason (see `engine/package.json` and the top of
`engine/CHECKLIST.md`). Nothing needs to change urgently — the discipline
already being followed (pure functions, JSON data, id-based references) is
exactly the discipline a clean port needs. This doc is about _keeping_ that
discipline as content keeps getting added, not about a rewrite.

## Why the current shape ports well

1. **Data is plain JSON.** Godot's `JSON.parse_string()` reads it natively
   — no conversion step, no format war. Every `engine/data/*.json` and
   `src/data/*.json` file is already exactly what a Godot script would load
   directly, or convert to a Resource at import time.
2. **Logic is pure functions on plain data.** `describeLevelUp`,
   `diffLevelUp`, `spellSlotsForClassAtLevel`, `casterLevelContribution`,
   `multiclassSpellSlots` etc. all take plain values/objects in and return
   plain objects out — no `this`, no framework lifecycle, no closures over
   mutable app state. That's precisely the style GDScript static functions
   want. Porting one of these is a line-by-line translation of _algorithm_,
   not a redesign — `if`/`for`/array-map logic reads almost the same in
   both languages.
3. **The `engine/index.js` flat export surface is already shaped like a
   Godot Autoload.** One module, one flat API (`loadClass`, `loadSubclass`,
   `describeLevelUp`, `diffLevelUp`, `validateCharacter`, ...) — this maps
   directly onto a single GDScript Autoload singleton exposing the same
   function names, callable from anywhere in the game the same way
   `engine.diffLevelUp(...)` is called from `server.js` today.
4. **IDs are stable strings, not JS-native values.** The 2026-09-01
   name→id migration for `features_by_level` (see `engine/CHECKLIST.md`,
   "Feature lookup switched from name-based to ID-based") wasn't done with
   Godot in mind, but it's exactly what a port needs — Dictionary-keyed
   lookups by a stable string id are the natural GDScript pattern too.
   Same for subclass file slugs (`slugify(class, name)`) — already a pure,
   deterministic string key.
5. **No JS-only values leak into the data.** Spot-checked today: no
   embedded comments, no `NaN`/`undefined`/`Infinity` anywhere in
   `engine/data/`. (Found and fixed one unrelated case in `src/data/
lore.json` — a stray comment line left over from an earlier session had
   made it invalid JSON entirely; not `engine/` data, but the same
   principle — worth keeping an eye on across all JSON, not just
   `engine/`.)

## What doesn't port 1:1, and the decision each one needs

- **File I/O.** `fs.readFileSync`/`path.join` (used in `classFeatures.js`,
  `subclasses.js`, `featureCatalog.js`, `spellLists.js` for lazy-loading
  and caching JSON) becomes Godot's `FileAccess.open()` +
  `JSON.parse_string()`. Conceptually the same lazy-cache-on-first-load
  pattern already used (`featureCatalog.js`'s `let catalog = null` +
  `loadCatalog()`) — just a different API to call it with.
- **Where the data actually lives at runtime.** This is the one real open
  question, not just a syntax swap: does the Godot build bundle its own
  copy of the JSON (`res://data/...`, read-only, refreshed at build/export
  time), or does it read live from wherever this Vue/Node app keeps its
  data? Recommend **the former** — treat this repo's `src/data/` and
  `engine/data/` as the authoring source of truth (where the project owner
  actually edits characters, lore, subclasses, etc., same as today), and
  have the Godot side import a snapshot/export rather than trying to share
  mutable state live across two completely different runtimes. Trying to
  sync live state between a Node dev server and a running Godot game is a
  lot of complexity for no real benefit — nothing here needs real-time
  sync, it needs the Godot build to pick up the latest content each time
  it's built.
- **Testing.** `node --test` doesn't run in Godot. Godot's GUT (Godot Unit
  Test) addon fills the same role. The _tests themselves_ port cleanly in
  spirit (they're "given this input, assert this output" against pure
  functions and fixed JSON fixtures, not framework behavior) — same
  translation effort as the logic itself, not a new testing strategy to
  invent.

## What to keep doing (no change needed, just don't regress)

- Keep `engine/` free of Vue/Vuex/Node-framework-specific code. Already
  true; the discipline just needs to hold as more classes/subclasses get
  added in the Phase 7 push.
- Keep new content as plain, boring JSON — no comments, no functions, no
  values a strict JSON parser would choke on. (This audit's one finding —
  the `lore.json` comment line — is exactly the failure mode to watch for;
  it happened by accident once already this session.)
- Keep referencing things by stable string id, not display name, wherever
  more than one thing could share a name (already the convention for
  features; extend the same instinct to anything new).
- Keep mechanical data (`action_type`, `recharge`, `uses_max`, spell
  tables, proficiency lists) free of Vue-component-specific concerns (CSS
  classes, a specific icon-font glyph name, etc.) — mechanical data should
  be equally meaningful to a Vue component and a Godot script reading the
  same JSON. Spot-checked today, this is already being followed; flagging
  it as a principle worth enforcing deliberately as Phase 7 content grows,
  not a fix needed now.

## Open question that actually changes the plan

Everything above holds regardless of the answer, but this one matters for
sequencing: **is the Godot build a rules/character-sheet companion tool
(needs `engine/` + character data), or an actual playable adventure using
this world's content (also needs monsters, places, NPCs, items — the
`src/data/` campaign layer, not just `engine/`)?** A companion-tool port is
a much smaller, self-contained effort (port `engine/`, done). A playable
game pulls in the whole campaign content layer and is a genuinely bigger
project. Worth deciding before sequencing real porting work, not
architecturally blocking either way.

## Suggested first step, whenever this actually starts

Don't port all ~15 rule files at once. Spike one simple, already-tested
pure function first (`abilityModifier` or `proficiencyBonus` are good
candidates — small, no dependencies, existing test coverage to port
alongside it) to validate the whole toolchain end to end: JSON loading in
Godot, GUT running, an Autoload calling into it. Then port in dependency
order — data-loading layer first (`loadClass`/`loadSubclass`/feature
catalog), since everything else depends on it; `spellcasting.js` and
`multiclass.js` next (leaves); `levelUp.js` and `diffLevelUp.js` last
(depend on everything else).
