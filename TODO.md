# Ideas / Nice-to-Haves

Backlog for "when we've got tokens to burn" — not urgent, not scheduled, just things
worth coming back to. Add freely; check off or delete when done or no longer wanted.

- [ ] **Finish Iyani's Weave Attunement reskin past level 9.** The homebrew
      subclass (`engine/data/subclasses/sorcerer-weave-attunement.json`) only
      covers up to level 9 in real detail — it's basically a reskin of a real
      subclass, and needs the rest of the levels filled in for completeness
      (the 14th/18th-level features Weave Empowerment/Unraveling already
      exist per `engine/CHECKLIST.md`, but the levels between 9 and 14 need
      a look too).

- [ ] **Cantrip audit** (known-cantrip counts vs. RAW caps, similar to the
      known-spell-cap work). User wants to hold off until there's a real UI
      spell browser to see things more clearly first — don't start this
      blind against raw JSON.

- [ ] **Icons/colors for schools of magic, and colors per class.** Visual
      polish for spell/character UI — no design direction picked yet.

- [ ] **Real racial/background mechanical data — partially done.** The New
      Character tool (2026-08-26) auto-applies ability score bonuses for the 9
      standard PHB species (`engine/data/species.json`) plus the 4 homebrew
      species, and now (2026-08-27) has real skill proficiencies for a
      curated 40 backgrounds (`engine/data/backgrounds.json`, verified against
      a real reference table, not guessed). Still not covered:
      `src/data/api_data_cache/species.json`'s other ~380 SRD entries (still
      pure flavor text) and the ~320 other unique backgrounds beyond the
      curated 40. Expand the curated background list over time as specific
      ones are needed — the picker already has an "Other (custom)" escape
      hatch for anything not yet curated.

- [ ] **Starting equipment automation.** New characters don't get equipment
      auto-assigned — `backgrounds.json` has a partial equipment/gold list per
      background, but no per-class starting-equipment tables exist anywhere.
      Add gear through the normal items UI for now.

- [ ] **"Plan all levels ahead" preview toggle**, per the Character Builder
      Blueprint's New Character Mode wireframe — preview levels 2-20 in one
      pass rather than one level at a time. `describeLevelUp` already supports
      arbitrary level ranges; this would just call it repeatedly and build a
      UI for the result.

- [ ] **Kerra needs at least a partial rebuild/verification.** She's STR 20,
      but the user's point-buy/weighted-cost stat method (a real official 5e
      option, comfortable max ~17 at level 1) means STR 20 requires ASIs to
      have actually been spent getting her there — needs checking that her
      real level-up path (Fighter 1-4, then Warlock) could actually produce
      this, not just trusting the end-state numbers. User's suggestion:
      "might be easier and safer to just reset her to level 1 fighter and
      level her up completely through the [level-up] tool" once it exists —
      i.e. this is also a good real-world test case for the Level Up tool,
      now that it exists (see `engine/CHECKLIST.md`). Also still
      open from the 2026-08-26 audit: her `started: true` class was corrected
      to Fighter, which surfaced a real saving-throw mismatch (wis/cha
      recorded, str/con expected), and her known-spell count is 13 against a
      cap of 6 once a real `isBonusSpell` classification bug was fixed — a
      rebuild would resolve all of this at once rather than patching pieces.

- [x] ~~Fill remaining spell-cache gaps.~~ Done 2026-08-24 — all 344 unique spells
      across all 8 class spell lists now have full local text between
      `srd_spells_full.json` and `published_spells.json`. Added the 23 missing
      Paladin/Ranger spells (all smite spells, auras, and conjure/hunter's-mark-style
      spells), verified against real rules text.

- [x] ~~Fill remaining feat/feature-cache gaps.~~ Done 2026-08-24/25 — of 192 unique
      feature names referenced across `characters.json` + `companions.json`, 54 had
      no local resolution (would render blank in the UI popup, e.g. Lyria's
      "Abjuration Savant"). Added 54 entries to `homebrew.json`'s `features` array
      (racial traits, feats, class features, subclass features, and a few
      already-self-described entries just needed copying into the shared catalog).
      "Daunting Strike" (Enauweyn, Paladin Oath of the Crown) turned out to be a 3.5e
      maneuver (Shaken for 1 minute) with no 5e/5.5e equivalent — removed from
      Enauweyn's feature list entirely, since his Paladin kit is already RAW-complete
      for a level 9 Oath of the Crown Paladin without it (Divine Sense, Lay on Hands,
      Fighting Style, Divine Smite, Divine Health, Extra Attack, both Channel
      Divinity options, Aura of Protection, Divine Allegiance).

- [ ] **Build a real level-up tool.** Huge lift, but crucial — the user has been
      using the BG3 character-builder tool as a stand-in and it isn't exact RAW.
      Wants a tool that shows all available options at each level (ASIs/feats,
      subclass features, spell choices, etc.) per class/race, each tagged with the
      book/source it's from, unlike BG3's builder. Not scheduled — revisit when
      there's a large block of tokens/time to dedicate to it, likely its own
      multi-session project. (In progress as of 2026-08-25 — see `engine/CHECKLIST.md`
      for the rules-engine groundwork already built.)

- [ ] **Item-granted spells with per-spell charge costs aren't modeled at all.**
      Lyria's Staff of Power (`items_109`) grants 8 spells from a shared 20-charge
      pool, each spell costing a different number of charges per RAW (Magic
      Missile/Ray of Enfeeblement: 2, Fireball/Lightning Bolt: 3, Cone of
      Cold/Hold Monster/Wall of Force: 4-5, Globe of Invulnerability: 6) — right
      now it's 100% prose in `effect`, doesn't even use the existing
      `spells_granted` array other items use. Needs: (1) a structured way to
      list per-spell charge cost on an item, not just "spells_granted: [names]",
      (2) actual charge-tracking on cast (the item already has
      `charges_current`/`charges_max`/`charges_recharge`, but nothing decrements
      it per spell cast today), (3) the future spellbook UI reading this as one
      more spell source alongside class/feat grants. Bigger than a single-item
      fix — worth its own pass once a few more multi-spell charged items turn up
      so the schema is designed from real examples, not just this one.

- [ ] **Rebuild CharacterSheet.vue / CharacterCombatPanel.vue — hard to find
      things, lots of wasted space.** User's words: "these should really be
      the same component with some v-ifs probably, or break down their
      components into reusable chunks." Not top priority right now — revisit
      once there's a real block of time for a UI pass, separate from the
      engine/level-up-tool work.

- [ ] **Level-up UI: add a 4th "preview the future" section at the bottom.**
      Once the wizard/tabs and stats/spells panels exist (see the Character
      Builder Blueprint artifact from this project), add a section previewing
      what the next 3 levels of the currently-selected class would offer —
      lets a player quickly compare "stay in this class" vs. "multiclass here
      instead" without leaving the screen. `engine/rules/levelUp.js`'s
      `describeLevelUp` already returns exactly this shape (features gained,
      ASI levels, spell slot/known changes) for any level range, so this is
      mostly a UI consumer of what already exists, not new engine work.

- [ ] **Spellbook/spell-list color coding is inconsistent and needs a real
      pass.** Currently cantrips and unprepared spells look the same on some
      characters, all one color on others. Not urgent — the little circle
      icon is fine for now — but flagged for a future spellbook UI overhaul.
      See `engine/CHECKLIST.md`'s "spell readiness states" note for the full
      breakdown of states worth designing around.

- [ ] **Revven needs a flavor-appropriate signature spell.** He's a Cleric of
      a custom deity/calling, and had a spell called "Fast Friends" in his
      list that didn't resolve to anything real (not in any spell catalog —
      removed 2026-08-25, was likely never actually written). He was supposed
      to have something thematic here; needs the same treatment as Sixty
      Leagues Before Dusk (Therynv'l) or the Rootbound Ward/Broken Vein
      stones — a real homebrew spell tied to his deity, verified to slot in
      at whatever level/school makes sense, then written into `homebrew.json`
      properly (not left as a dangling name with no definition).

- [ ] **Jaygar needs a proper from-scratch Artificer rebuild.** Built before
      the user knew Artificer existed as a class — reasonably close, but not
      exact. His Artillerist subclass bonus spells (`artillerist_spells`) are
      already correct and complete for level 9. What's missing: his actual
      chosen/prepared Artificer spell list (the normal INT-mod-plus-half-level
      picks from the Artificer list) never got written down at all — only his
      Fey Touched grant (Misty Step + Command) exists in `spells[]`. User
      wants to do this as a real scratch-build/audit pass, both to get it
      RAW-correct and to separate the original homebrew concept from what
      Artificer actually offers — same collaborative process as Therynv'l's
      build-out.

- [ ] **Siv needs a rebuild — her subclass doesn't exist.** She's currently
      `Fighter` / `subclass: "Scout"`, but Scout is a real Rogue subclass, not
      a Fighter one. Concept (user's own words): "highly mobile, highly
      accurate, long range capable, but sometimes stealthy archer" — no
      sneak attack, so Rogue's out. Decided 2026-08-25: **Battle Master**
      fits best — fully mundane (no unwanted arcane-magic flavor, unlike
      Arcane Archer, the other real archer-flavored Fighter subclass), and
      its maneuvers map directly onto the concept (Precision Attack for
      accuracy, Evasive Footwork for mobility), same as any weapon including
      a bow. Needs: change her `subclass` field to Battle Master, then pick
      her actual maneuvers/superiority-die build and verify the rest of her
      sheet against it — same process as Jaygar's rebuild above.

- [x] ~~Ferghus's Oath of the Open Road and Torrin's Soulknife/Mastermind
      rebuild.~~ Done 2026-08-26 — see `engine/CHECKLIST.md` for the full data-
      recovery story (git history recovered the "Vow of the Open Road"
      mechanic that had been silently stripped in April; Torrin was actually
      already fully intact and just needed the 4 real Soulknife/Mastermind
      features he was missing added).

- [x] ~~Combat: need to rename an enemy mid-combat, especially duplicated
      ones.~~ Done 2026-08-25 — added a click-to-rename control both in the
      setup-phase enemy list (`CombatContext.vue`, plain input bound directly
      to the enemy) and in the battle-phase active-enemy header
      (`Battle.vue`, click-to-edit text mirroring the existing initiative-
      score-override pattern, emits `rename-enemy` up to `CombatContext.vue`).
      Verified via `vue-cli-service build` (compiles clean) and by matching
      an already-working pattern exactly — **not yet click-tested live in a
      browser**, flagging that explicitly rather than claiming full UI
      verification.
