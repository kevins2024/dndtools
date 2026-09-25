# Ideas / Nice-to-Haves

Backlog for "when we've got tokens to burn" — not urgent, not scheduled, just things
worth coming back to. Add freely; check off or delete when done or no longer wanted.

See `TODO_ARCHIVE.md` for completed items (kept for the record, out of this file so it stays short to read).

- [ ] **`npm run build` is much slower on the project owner's Windows PC (the more powerful machine) than on their Mac mini, 2026-09-24.** Same codebase, same command — worth investigating why, since a slow build is pure friction on every verification pass. No investigation done yet; candidates worth checking first: antivirus/Windows Defender scanning `node_modules`/`dist` on every write (a very common cause of this exact asymmetry), a stale/bloated `node_modules` on the Windows box, or a webpack cache that isn't persisting between runs there. Not urgent, just annoying — flagged for whenever there's a natural moment to dig into it.

- [ ] **Suspected real bug: Additional Magical Secrets (Bard College of Lore, 6th) may silently drop one of its 2 spell picks — found 2026-09-22 while rebuilding Lexica, still not reproduced.** Lexica's finished sheet (level 9, built live through the Level Up tool by the project owner) had a feature named "Additional Magical Secrets: Pulse Wave, Haste" — proving both names were captured at pick time — but only **Haste** actually existed in her `spells[]` array; Pulse Wave was missing entirely (confirmed it's a real, valid 3rd-level Wizard-list spell, not a bad name). Read through `diffLevelUp.js`'s resolution block for this feature (`extraGrantedSpells.push(...)` runs once per pick, inside a single `picks.forEach`) and the merge step that writes `extraGrantedSpells` into `patch.spells` — both look correct in isolation, so whatever dropped the second pick likely happened client-side (LevelUpTool.vue) or across multiple separate level-up sessions, not in one clean call. **Still not reproduced as of 2026-09-23**: project owner rebuilt Lexica end-to-end again as a throwaway test character ("LexicaBugTest," since deleted) specifically to try to catch this and the 13-spell issue below live — that build's own Additional Magical Secrets pick correctly captured BOTH Pulse Wave and Haste in one continuous session. This is a real data point (not proof either way): it's consistent with the project owner's own working theory that the original miss came from saving mid-build and resuming later with code changes in between, not from a bug in one clean, uninterrupted level-up call. Project owner is watching for a chance to reproduce it under those specific conditions (save, code change, resume) rather than a fresh single-session build.

- [ ] **[LOW PRIORITY] No general engine mechanism for a class/subclass feature that grants a specific always-prepared bonus spell outside the domain/oath/circle-table pattern — found 2026-09-22 fixing Tackett's Circle of the Stars.** Star Map's RAW text ("you have the Guiding Bolt spell prepared at all times — it doesn't count against your number of spells known") doesn't fit `BONUS_SPELL_FIELDS`' table-keyed-by-level shape (`domain_spells_by_level` etc. — those are per-level tables, Star Map is a single fixed grant at one level) and `druid-circle-of-stars.json` has no `grants_spells` field at all, unlike `feats.json`/`species.json`. Fixed Tackett's own `characters.json` entry directly (`spells_granted` added straight to his Star Map feature) since he's the only Circle of the Stars character on the roster today, but **any future Circle of the Stars character built through New Character/Level Up will have the same gap** until a real `grants_spells`-on-class/subclass-feature mechanism exists in `classFeatures.js`/`subclasses.js` + `diffLevelUp.js`. Worth checking whether any other subclass has this same "single fixed always-prepared spell" shape (not a per-level table) before building anything — if it's just this one case, a character-level workaround may keep being cheaper than new engine plumbing.

- [ ] **Extract a reusable spell-picker component for LevelUpTool.vue — project owner's idea, 2026-09-22, explicitly for later.** Grew out of fixing Magical Secrets' picker (it had fallen behind the rest — clicking a spell name toggled the checkbox instead of showing the description, because it predated the `inspectSpell()` convention every other picker uses). The same checkbox + name-click-for-description + `togglePick(list, name, limit)` shape is now duplicated across at least 6 spots in this one file: bonus cantrips, generic new cantrips, new known spells, spellbook adds, spell swap, and Magical Secrets (spells + cantrips tabs) — plus the new `spell_choice`-type feat pickers (Fey Touched/Shadow Touched/Magic Initiate/etc., built 2026-09-22) are a close cousin (single-select dropdown instead of a checkbox list, but same "options come from a fetched list, exclude already-known" shape). A shared component would take something like `{options, draft/limit (or v-model), onInspect}` and render the list + wire `inspectSpell`/`togglePick` once, instead of each new spell-related pendingChoice type copy-pasting the same ~15-20 lines of template. Project owner's own framing: "probably a good todo to have and build later" — not blocking anything today, no urgency.

- [ ] **New D&D sourcebook check, 2026-09-20 — initial research done, real decision needed before any data gets added.** Project owner recalled "Arcana Unleashed" and "something about Ravenloft" as recent releases and asked what's missing from our data sets. Researched both via WebSearch (not wikidot — this was a "what books exist" question, not a rules-text lookup):

  - **Arcana Unleashed** (WotC, released 2026-09-15, $49.99) — a 160-page magic-themed sourcebook: 8 new subclasses, high-magic character-creation options (new feats/spells, a magic-item system that scales with character level), 9 arcane factions, and a level-1 adventure. Companion product **Arcana Unleashed: Deadfall** is a separate levels-11-20 adventure (Thay "Wizard War").
  - **Ravenloft: The Horrors Within** (WotC, released 2026-06-16) — a new Ravenloft campaign book: 7 new subclasses (Reanimator Artificer, Hollow Warder Ranger, Grave Domain Cleric, College of Spirits Bard [already in our data under Tasha's, so likely a refresh not a new option], Phantom Rogue, Shadow Sorcery Sorcerer, Undead Patron Warlock), 4 new species (Dhampir, Hexblood, Lupin, Reborn), 4 backgrounds, 2 Origin Feats, 9 Dark Gifts (adapted from Van Richten's Guide's Dark Gifts — 6 refreshed, 1 new, "1" unaccounted for in the source I read, worth double-checking directly if this book is ever actually adopted).

  **The decision-relevant finding, bigger than either book individually**: both are confirmed, explicitly, **2024-rules-only** (cross-checked 2 independent sources each on this specific point, not just the announcement copy) — not something a straight import into this project's data can absorb, since `CLAUDE.md`'s standing rule is this campaign runs 2014 rules exclusively. Broader check: **Wizards of the Coast has published no new 2014-compatible content since the 2024 core rulebook revision** — every 2025/2026-dated release I found (Forgotten Realms Player's Guide, Eberron: Forge of the Artificer, the 2025 Monster Manual refresh, Dragon Delves Anthology, and both books above) targets the 2024 ruleset. "Backward compatible" in WotC's own marketing means a 2024-rules book can still reference/use older 2014 material at the table, not that new books ship in 2014 form. **Practically: there is currently no new _official_ 2014-native content to add — going forward, "new WotC book" and "usable without conversion work" are mutually exclusive for this campaign**, unless that changes.

  **What this project already has**, for reference (checked live via each data file's own `source` field, not assumed): PHB (2014), DMG, Monster Manual, Xanathar's Guide to Everything, Tasha's Cauldron of Everything, Sword Coast Adventurer's Guide, Volo's Guide to Monsters, Mordenkainen's Tome of Foes, Explorer's Guide to Wildemount, Fizban's Treasury of Dragons, Strixhaven: A Curriculum of Chaos, Bigby Presents: Glory of the Giants, Acquisitions Incorporated, and **Van Richten's Guide to Ravenloft is already in `published_spells.json`/`published_features.json`** (Dark Gifts etc.) — so Horrors Within's content is a refresh/expansion of ground we already partly cover in 2014 form, not a from-scratch gap.

  **Real open decision for the project owner, not something to resolve unilaterally**: (1) skip both entirely — reasonable if 2014 rules stay the standing choice indefinitely; (2) hand-pick specific pieces (a subclass, a feat, a species) from either book and adapt them back to 2014 rules as homebrew, the same way this project already homebrews things (Infused Arbalist, Weave Attunement, etc.) — real conversion work per item, not a data-entry task; (3) treat this as a data point toward the standing "if we migrate to 2024 rules" question mentioned elsewhere in this project's history. **Not done**: no data was added to any catalog this pass — this was explicitly scoped as research-and-report, per the project owner's own framing ("go ahead and do the initial checking... mark down what needs to be added").

  **Not yet researched** (project owner flagged "beyond that I'd need more research" — this is the fast-recall pair, not a full sweep): whether any _third-party_ publishers (Kobold Press, MCDM, etc.) have released notable 2014-compatible content recently — a different question from WotC's own catalog, only worth chasing if 2014-native official content really is a dead end and third-party is an acceptable substitute.

- [ ] **[LOW PRIORITY] Mine our own already-owned 2014-era sourcebooks for unused inspiration, periodically.** Grew out of the sourcebook-check item above — project owner's own reaction to that research (2026-09-20): "we have enough content in the books we've got that I haven't even read or explored yet; I had forgotten there was already a Ravenloft book." Not urgent, no decision pending — just an idea to revisit "from time to time": pick a book already reflected in this project's data (Van Richten's Guide to Ravenloft is the obvious first candidate given the above, but Fizban's, Strixhaven, Mordenkainen's Tome of Foes, Acquisitions Incorporated are all in the catalog too and likely just as under-mined) and read/skim it for setting hooks, unused subclass/monster flavor, or homebrew-adaptation material worth folding into the campaign — this is a browsing/inspiration pass, not a data-completeness audit like the item above.

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
