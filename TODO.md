# Ideas / Nice-to-Haves

Backlog for "when we've got tokens to burn" — not urgent, not scheduled, just things
worth coming back to. Add freely; check off or delete when done or no longer wanted.

See `TODO_ARCHIVE.md` for completed items (kept for the record, out of this file so it stays short to read).

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
      dropped as "extra."

- [ ] **Full spell/cantrip audit across the roster (2026-09-08) — partially
      resolved, several items still open, see below.** Wrote a one-off audit
      script (engine's own `cantripsKnownForClass`/`spellsKnownForClass`/
      `isSpellOnClassList`) across every caster. Real findings, confirmed by
      digging into git history and each character's actual feats/features
      before touching anything (several first-glance "bugs" turned out to be
      legitimate RAW mechanics the audit script just didn't know about —
      worth remembering next audit: don't trust a flat script's output,
      verify against feats/subclass data before reporting or fixing): - **Wizards (Lenn/Kessara/Lyria) — NOT a bug, no changes made.** All
      three show 10 cantrip entries against a cap of 4. Traced via
      `git log -S` to the commit that gave the party "Iyani's goddess
      mother's gift" (synced wizard spellbooks) — confirmed each wizard's
      real 4 pre-gift cantrips are exactly the ones tagged `prepared:
true` today; the other 6 (`prepared: false`) represent spells
      visible in the shared spellbook but not actually known, which is
      the right call since cantrips genuinely can't be learned from a
      spellbook/scroll under RAW. Data was already modeling this
      correctly; the audit script just didn't account for the flag. - **Rith (Sorcerer, Divine Soul) — NOT a bug, confirmed accurate, no
      changes made.** Project owner was right to be confident. Verified:
      his Divine Magic affinity bonus spell (Bless, Law affinity) is
      correctly tagged `featureGranted`; Fey Touched's free Misty
      Step/Silvery Barbs are correctly tagged and don't need a normal
      known-spell slot; his 5 "off Sorcerer list" spells are legal
      Divine Magic Cleric-list substitutions (still count against the
      cap, which they do); his cantrip count (5) and known-spell count
      (10) both hit their real level-9 caps exactly. - **Enauweyn (Paladin, Oath of the Crown) — DONE.** Her "Fey Step"
      feature is the real Eladrin racial trait (a non-spell teleport, no
      spells[] entry needed) — NOT the Fey Touched feat, and doesn't
      explain her recorded "Misty Step" spell. No other source found;
      removed it. Bigger gap: **Oath of the Crown's subclass file had no
      oath-spell table at all** (checked `engine/CHECKLIST.md` — its
      `features_by_level` was verified against her real feature list in
      an earlier session, but the oath-spell table was simply never
      added, unlike sibling subclasses built the same pass). Added the
      real PHB/SCAG table (3rd: Command/Compelled Duel, 5th: Warding
      Bond/Zone of Truth, 9th: Aura of Vitality/Spirit Guardians, 13th:
      Banishment/Guardian of Faith, 17th: Circle of Power/Geas) — her
      existing tagged oath spells (Aura of Vitality, Spirit Guardians,
      Warding Bond) already matched this table exactly, confirming it's
      right; added her 2 missing legitimate picks (Command, Compelled
      Duel, Zone of Truth). - **Revven (Cleric, Tempest Domain) — DONE.** Charm Person had no
      supporting feat/domain/background (project owner: "I don't know").
      Removed. - **Ferghus (Paladin, homebrew Oath of the Open Road) — DONE, this
      note was stale.** Fixed a real bug: the subclass file's oath-spell
      table was keyed `"1"` instead of `"3"` (every other built-out oath
      in this project keys by real character level). The 5th-level pick
      was later changed to Enlarge/Reduce + Silence (2026-09-08, project
      owner's choice, replacing the earlier unconfident Misty Step/
      Shatter), and 9th/13th/17th were filled in 2026-09-09 (Incite Greed/
      Galder's Tower, Banishment/Summon Greater Demon, Temporal Shunt/
      Steel Wind Strike) — confirmed present and correct on Ferghus's own
      sheet through his current level during the 2026-09-10 subclass
      audit. Nothing left open here. - **Elucyne (Ranger, Gloom Stalker) — DONE, but bigger than expected.**
      Confirmed level-5 Ranger really does cap at 4 known spells (checked
      `engine/data/spellcasting-tables.json`, not memory). Real gap found
      beyond just "1 spell short": her Rope Trick and Fear were tagged as
      normal known picks, but both are actually **Gloom Stalker Magic**
      free bonus spells (checked the subclass's own feature text) — Rope
      Trick (5th level) is legitimate but was mistagged; Fear (9th level)
      was outright premature at Ranger 5 and has been removed; Disguise
      Self (3rd level), the one she was missing entirely, has been added.
      Net effect: she now has only 1 real counted known spell (Fog Cloud)
      against a cap of 4 — **still open**: needs 3 more real known-spell
      picks, a flavor choice for the project owner, not something to
      invent unprompted. - **Sorra (Bard, College of Spirits) — DONE, 1 item still open.**
      Confirmed via her features list: no early-Magical-Secrets-granting
      feature exists for this subclass (unlike Lexica below), so her
      Counterspell/Revivify (tagged `magical_secret`) had no legitimate
      source at level 9 — removed, along with an off-list cantrip
      (Green-Flame Blade, also unexplained). Cantrip count now correct
      (3/3). Her remaining 13 leveled known spells are all legitimately
      on Bard's list individually, but that's still 1 over the real cap
      of 12 — **moot now**: project owner is rebuilding her from scratch
      instead of picking which one to cut. - **Lexica (Bard, College of Lore) — DONE, turned out to need less
      than expected.** Her "Magical Secrets (level 6 — used)" feature,
      with its own note naming Counterspell/Scrying, is College of Lore's
      real **Additional Magical Secrets** — a different, RAW-legal, and
      explicitly free ability (unlike base Bard's 10th-level Magical
      Secrets, Lore's 6th-level version doesn't count against spells
      known). Re-tagged both as `featureGranted` instead of removing them
      — the project owner's instinct to reset her was reasonable caution,
      but the data turned out to already be correct, just mistagged.
      Phantasmal Killer remains a real, still-unexplained off-list spell
      — **still open**, needs a decision (keep with a story reason, or
      remove) to close out her 1-over-cap overage — project owner is
      rebuilding Lexica and Sorra from scratch instead, so this is now
      moot for both. - **Jaygar (Artificer, Infused Arbalist) — DONE.** Re-checked
      2026-09-10: he now has exactly 2 cantrips (Guidance, Resistance),
      matching Artificer's real cap of 2 at level 9 (verified via
      `engine.cantripsKnownForClass` directly, not memory — the cap only
      rises to 3 at 10th level). Both are legitimate Artificer-list
      cantrips. This must have been picked in a later session than the
      one that originally flagged it empty. - **Tackett (Druid, Circle of Stars) — DONE.** Project owner's call:
      he's a "legendary" character, RAW-accuracy isn't the goal, just a
      clean in-fiction reason for his 6 recorded cantrips (cap 3). Added
      a new homebrew feature, "Legendary Repertoire" (`published_features.
json`, id `hb_tackett_legendary_cantrips`), granting a flat +3
      cantrips, and added it to his `features[]`. - **Kerra — explicitly skipped**, already slated for a full rebuild;
      fixing her spell list piecemeal now would be wasted work. - **Minor, not yet acted on**: all 3 wizards' spellbooks reference
      "Negative Energy Flood (homebrew spell from necromancer's
      spellbook)," which doesn't exist anywhere in the local spell
      catalog — fine to leave as flavor text, but if it's ever actually
      cast at the table it'll need a real homebrew spell entry.
      Verification: `npm run build` clean; `cd engine && node --test`
      218/218. The audit script itself lives at
      `scratchpad/spell_audit.js` in this session's scratchpad, not
      committed to the repo — one-off, not a permanent tool.

- [ ] **Torrin needs a full rebuild — not a priority.** Project owner
      (2026-09-02): "I don't even use him, it was a bad concept." His
      `subclass` field is literally the string `"Soulknife / Mastermind"`
      (both real Rogue subclasses, combined into one string that doesn't
      resolve via `loadSubclass`) — a deliberate homebrew dual-subclass
      hack from an earlier session, not worth preserving or cleaning up
      since he's getting rebuilt from scratch eventually. No action needed
      until the project owner actually wants to rebuild him.

- [ ] **[USER ACTION] Mine other chats for lore.** User has a lot of world
      lore (history, locations, factions, etc.) scattered across other chat
      conversations, not in this repo. Action item is on the user: go
      through those chats, pull out the lore/location/history content, and
      get it into `lore/` (see `lore/README.md` for the convention —
      `places/`, `history/`, `beasts/`, `factions/`, `people/`). Not
      something Claude can do — the source material only exists in those
      other conversations.

- [ ] **Cantrip audit** (known-cantrip counts vs. RAW caps, similar to the
      known-spell-cap work). User wants to hold off until there's a real UI
      spell browser to see things more clearly first — don't start this
      blind against raw JSON.

- [ ] **Background expansion + species.json SRD-scope reconciliation — both intentionally on hold, not forgotten.** Two separate, unrelated gaps left over after the racial-mechanics work below was completed (now archived, see TODO_ARCHIVE.md): (1) only 40 of ~360 backgrounds have real curated skill data (`engine/data/backgrounds.json`) — explicitly deprioritized 2026-09-07 (project owner: "I don't think we need that many more backgrounds. skip them for now"); the picker's "Other (custom)" escape hatch covers the gap for now. (2) `src/data/api_data_cache/species.json`'s SRD flavor-entry scope is unresolved — the cache went missing and was rebuilt from dnd5eapi.co with only the 13 real races/subraces the API has, not the ~380 previously noted here; project owner wants to reconcile against another hard drive before trusting either number, not something Claude can resolve alone.
- [ ] **[LOW PRIORITY] "Plan all levels ahead" preview toggle**, per the
      Character Builder Blueprint's New Character Mode wireframe — preview
      levels 2-20 in one pass rather than one level at a time. `describeLevelUp`
      already supports arbitrary level ranges; this would just call it
      repeatedly and build a UI for the result. Marked low priority 2026-09-03
      per project owner.

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

- [ ] **Level-up UI: add a 4th "preview the future" section at the bottom.**
      Once the wizard/tabs and stats/spells panels exist (see the Character
      Builder Blueprint artifact from this project), add a section previewing
      what the next 3 levels of the currently-selected class would offer —
      lets a player quickly compare "stay in this class" vs. "multiclass here
      instead" without leaving the screen. `engine/rules/levelUp.js`'s
      `describeLevelUp` already returns exactly this shape (features gained,
      ASI levels, spell slot/known changes) for any level range, so this is
      mostly a UI consumer of what already exists, not new engine work.
