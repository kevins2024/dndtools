# Ideas / Nice-to-Haves

Backlog for "when we've got tokens to burn" — not urgent, not scheduled, just things
worth coming back to. Add freely; check off or delete when done or no longer wanted.

See `TODO_ARCHIVE.md` for completed items (kept for the record, out of this file so it stays short to read).

- [ ] **Extract a reusable spell-picker component for LevelUpTool.vue — project owner's idea, 2026-09-22, explicitly for later.** Grew out of fixing Magical Secrets' picker (it had fallen behind the rest — clicking a spell name toggled the checkbox instead of showing the description, because it predated the `inspectSpell()` convention every other picker uses). The same checkbox + name-click-for-description + `togglePick(list, name, limit)` shape is now duplicated across at least 6 spots in this one file: bonus cantrips, generic new cantrips, new known spells, spellbook adds, spell swap, and Magical Secrets (spells + cantrips tabs) — plus the new `spell_choice`-type feat pickers (Fey Touched/Shadow Touched/Magic Initiate/etc., built 2026-09-22) are a close cousin (single-select dropdown instead of a checkbox list, but same "options come from a fetched list, exclude already-known" shape). A shared component would take something like `{options, draft/limit (or v-model), onInspect}` and render the list + wire `inspectSpell`/`togglePick` once, instead of each new spell-related pendingChoice type copy-pasting the same ~15-20 lines of template. Project owner's own framing: "probably a good todo to have and build later" — not blocking anything today, no urgency.

- [ ] **[LOW PRIORITY] Mine our own already-owned 2014-era sourcebooks for unused inspiration, periodically.** Grew out of the sourcebook-check item (now in `TODO_ARCHIVE.md`) — project owner's own reaction to that research (2026-09-20): "we have enough content in the books we've got that I haven't even read or explored yet; I had forgotten there was already a Ravenloft book." Not urgent, no decision pending — just an idea to revisit "from time to time": pick a book already reflected in this project's data (Van Richten's Guide to Ravenloft is the obvious first candidate given the above, but Fizban's, Strixhaven, Mordenkainen's Tome of Foes, Acquisitions Incorporated are all in the catalog too and likely just as under-mined) and read/skim it for setting hooks, unused subclass/monster flavor, or homebrew-adaptation material worth folding into the campaign — this is a browsing/inspiration pass, not a data-completeness audit like the item above.

- [ ] **[LOW PRIORITY] Item library leftovers (2026-10-04).** Most of the follow-ups from the item-library work are done (see engine/CHECKLIST.md). What's left: (1) two items still override the official text and haven't been reviewed — Tome of Clear Thought and Scroll of Sending; run `node scripts/audit-items.js` for the current list. (2) The Bag of Holding house-rule capacity is repeated as text on four bags; it could reference the house rule in `house_rules.json` instead. (3) A genuinely new unique item (no official match) is left unlinked on save; it works, but a "new campaign item" shortcut in the add-item UI would write its `campaign-items.json` entry for you.

- [ ] **Decide the fate of the synthetic enemy generator in `src/utils/encounter_utils.js` (2026-10-02).** The engine migration sweep (see `engine/CHECKLIST.md`, 2026-10-01/02 entries) moved everything rule-shaped it found in `src/` except this: `generateHumanoidEnemy`/`generateBestiaryEnemy`, stat/HP/AC rolling, `assignFeatures`, and ~1500 lines of `FEATURE_POOLS`/`SPELL_POOLS`/`ROLE_PROFILES` tables. It's game logic a Godot port would need, but `engine/rules/npcBuilder.js` (real class-built enemies, "Use real enemies" toggle) is gradually replacing it, so porting it wholesale may be porting something about to be retired. Decision needed: finish moving npcBuilder to cover every role/difficulty and delete the synthetic path, or lift the synthetic generator into `engine/` as-is (tables to JSON under `data/`, functions with injectable rng).

- [ ] **Ranger: known-spell caster or preparer? (2026-10-02)** `engine/rules/5e/spellcasting.js` (and 2014 RAW) say Ranger knows spells; `characterSpells.js`'s `usesFullClassList` still offers the whole Ranger list as an "available to prepare" pool in the spellbook. The prepared-spell counter and long-rest reminder now follow the engine (no Ranger counter). Pick one and make both agree — `FULL_CLASS_LIST_CLASSES` in `engine/rules/5e/characterSpells.js` is the one list to edit if Rangers should stop being offered the full list.

- [ ] **Combat screen layout pass — project owner's first-glance feedback
      after using turn/round tracking, 2026-09-11.** Nothing broken, just
      real space/ergonomics notes from actually using it, to talk through
      when the project owner is back (they'll be remoting in over the
      weekend to discuss next steps — this needs a conversation, not a
      unilateral redesign):

  - **`DiceRoller.vue` (mounted globally in `AppLayout.vue`, not
    combat-specific) is a full-width bottom drawer that eats a lot of
    vertical space during combat.** Project owner's suggestion: the new
    `.turn-controls` row (round counter, Next Turn, `ActionEconomyRow`)
    added to `Battle.vue` this session could sit _beside_ the dice
    roller instead of taking its own separate row, reclaiming real
    space. Nontrivial because these are two unrelated components in
    different parts of the tree today (`DiceRoller` at the `AppLayout`
    level, `.turn-controls` inside `Battle.vue` inside `CombatContext.
vue`) — needs a real layout decision, not a CSS tweak, on how/
    whether to coordinate them.
  - **The "Add enemy mid-fight" sidebar section in `Battle.vue`** (manual
    name/mod inputs + a Manual/Bestiary mode toggle + bestiary search,
    `sidebar-add-enemy` block) **takes up a lot of permanent sidebar
    space for something used occasionally.** Project owner's
    suggestion: collapse it to a single button that opens a wizard
    instead. `VehicleCombatWizard.vue` already has a real reusable
    step-wizard shape in this codebase (`step` data property, `v-if=
"step === N"` panels, back/next buttons) worth pattern-matching
    rather than inventing a new wizard shell from scratch — the actual
    step content would obviously differ (add-enemy needs name/mod or
    bestiary search, not ship selection), but the wizard _shell_
    (modal, step indicator, back/next) could plausibly be extracted
    and shared.
  - **Action economy resources are tracked as a single boolean today**
    (available/spent) — the project owner floated, as a hedge rather
    than a firm request ("or two if the player for some reason has
    two"), that some feature could plausibly grant a second action/
    bonus action/reaction in a turn. Not built — `engine/rules/
combatTurn.js`'s resources are booleans, not counts, and changing
    that is a real engine-level model change (plus a UI change to show
    N pips instead of 1), not a quick add. Worth a real example coming
    up at the table before building speculatively.
  - Not started — flagged for discussion first per the project owner's own
    request, then implementation.

- [ ] **Battle Map and Vehicle Combat both flagged as "good but basic,"
      2026-09-11.** Direct project owner quote: "make the battle map more
      robust and user friendly. It's already very good but very basic."
      and "The vehicle combat is also really cool but perhaps needs to
      support more variety." No specifics yet on what "more robust" or
      "more variety" means concretely — worth a real conversation before
      guessing at scope, this is a discovery task, not a defined feature.

- [ ] **Full character rebuild pass, once the level-up tool and all
      subclasses are at high confidence (project owner's target: 4.9/5).**
      Rebuild every roster character from level 1 through their current
      level using the (by-then-verified) level-up tool, and diff against
      what's currently on their sheet. Flagged as the natural follow-up to
      the 2026-09-09 discovery that a systematic character-wide ability
      score / feat-granted-feature audit turned up real gaps (see the
      2026-09-09 CHECKLIST.md entry). Project owner's own words: "Wizards
      who have learned additional spells from scrolls and books being the
      most difficult to manage" — expect that to be the hardest category to
      reconcile, since those spells aren't derivable from level-up math
      alone and need to be preserved through the rebuild rather than
      dropped as "extra." **Worth revisiting whether the blocking condition is now met**: the full class/subclass feature audit (all confirmed gaps) closed out 2026-09-18 — that's a real confidence signal, though "4.9/5" itself is the project owner's own call, not something to declare met unilaterally.

- [ ] **[LOW PRIORITY] "Plan all levels ahead" preview toggle**, per the
      Character Builder Blueprint's New Character Mode wireframe — preview
      levels 2-20 in one pass rather than one level at a time. `describeLevelUp`
      already supports arbitrary level ranges; this would just call it
      repeatedly and build a UI for the result. Marked low priority 2026-09-03
      per project owner.

- [ ] **Level-up UI: add a 4th "preview the future" section at the bottom.**
      Once the wizard/tabs and stats/spells panels exist (see the Character
      Builder Blueprint artifact from this project), add a section previewing
      what the next 3 levels of the currently-selected class would offer —
      lets a player quickly compare "stay in this class" vs. "multiclass here
      instead" without leaving the screen. `engine/rules/levelUp.js`'s
      `describeLevelUp` already returns exactly this shape (features gained,
      ASI levels, spell slot/known changes) for any level range, so this is
      mostly a UI consumer of what already exists, not new engine work.
