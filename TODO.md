# Ideas / Nice-to-Haves

Backlog for "when we've got tokens to burn" — not urgent, not scheduled, just things
worth coming back to. Add freely; check off or delete when done or no longer wanted.

See `TODO_ARCHIVE.md` for completed items (kept for the record, out of this file so it stays short to read).

- [x] **"Torrin (Claude)" — a hand-built, fully optimized level 9 Rogue
      Soulknife added 2026-09-11** as a comparison exercise against the
      project owner's own build attempt, per their request. Same species
      (Dwarf) as the real Torrin; Hill Dwarf picked over Mountain Dwarf
      (Dwarven Toughness beats a dump-stat STR bonus and armor training a
      DEX-based Soulknife doesn't want). Full reasoning in that session's
      chat, not duplicated here — the character record and its 3 equipment
      items are real, playable data (`characters.json`/`party_items.json`),
      not just a writeup. `engine.validateCharacter` clean, `npm run build`
      clean.

      **Bonus finding while verifying**: running the full engine test suite
      for the first time since the Kerra rebuild and the Torrin archival
      rename (both earlier this same session) surfaced 2 stale test
      fixtures — `validateCharacter.test.js` had a test asserting Kerra's
      *old* wis/cha saving-throw bug still existed (fixed for real during
      her rebuild, which is exactly what broke the test); `recoveredData.
      test.js` looked up a character named plain `"Torrin"`, which no
      longer resolves post-rename. Both fixed (the Kerra one switched to a
      synthetic fixture instead of depending on a real character staying
      broken forever; the Torrin one just needed the updated name). Worth
      remembering: this project's test suite uses real `characters.json`
      rows as fixtures in several places, so a character rename or a fixed
      bug can silently break a test until `node --test` actually runs —
      run it after character data changes too, not just `engine/` changes.

- [x] **Duplicate-named items sweep, prompted by the Halberd of Warning +2
      rename (2026-09-11) — one real bug found and fixed, rest confirmed
      already safe.** `WeaponTable.vue` built its per-weapon rows keyed by
      `w.name` and looked equipped weapons back up by name too
      (`weaponItem(row.name)`, plus `weaponEffectsFor`/`weaponSpellsFor`) —
      two equipped weapons sharing a name (a matched pair, twin daggers,
      etc.) would collapse onto whichever came first: duplicate Vue `:key`,
      wrong item's inspect popup, and casting a weapon-granted spell (Staff
      of Power, etc.) could spend charges off the wrong physical item.
      Fixed by adding `id` to `dnd.buildWeaponRows`'s returned summary
      objects and re-keying everything in `WeaponTable.vue` off `id`
      instead of `name`. Checked everywhere else items get looked up:
      `CharacterInventory.vue`, `BattleItemsPanel.vue`, and the
      `UPDATE_ITEM`/`DELETE_PARTY_ITEM`/`SPEND_CHARGE` store mutations were
      all already id-based (the generic `UPDATE_TABLE_ITEM` mutation only
      falls back to name-matching when an item has no `id`, and every
      `party_items.json` entry has one, so that path is safe too). Found
      two components doing name-based item lookups the old, unsafe way —
      `Items.vue` and `ItemDetails.vue` — but both are dead code, not
      imported or reachable from anywhere in the app; left alone rather
      than fixing unreachable code, worth deleting outright next time
      someone's in that area. `npm run build` clean.

- [x] **Enemy combat sheet was missing damage type and a magical/nonmagical
      indicator — added 2026-09-11**, follow-on to the weapon detail popup
      work above. Found a real latent bug while at it: `Battle.vue`'s
      `exportEnemyAbilities` and `EncounterGenerator.vue`'s own export text
      both already _referenced_ `enc.weapon.damageType`, but nothing ever
      actually set that field when a real monster was added mid-fight via
      `addFromBestiary` — it was always `undefined`. Procedurally-generated
      humanoid enemies (`encounter_utils.js`'s `generateWeapon`) already had
      it right; only the real-monster bestiary-add path was missing it.
      Fixed: `addFromBestiary` now pulls `damage_type` off the real monster
      action data, detects a **magical** attack from a `"Magic Weapons"`
      special ability (common on higher-CR fiends/celestials) or a nonzero
      weapon enhancement, and also now actually sets `attackBonus` from the
      real monster data (previously hardcoded `null`, a separate small gap
      found along the way — the DM had to type it in by hand every time
      even though the real number was already fetched and sitting unused).
      `Battle.vue`'s `activeEnemyMeta` now folds damage type into the
      existing free-text Damage chip and exposes a new toggle-able
      **Magical** chip in `EnemyStatsChipRow.vue`, both overridable by hand
      like every other enemy stat in this system. `npm run build` clean.

- [x] **Weapon detail popup had zero combat stats — fixed 2026-09-11.**
      `buildItemPopupData` (shared by `WeaponTable.vue` and
      `BattleItemsPanel.vue`'s inspect button) only ever showed flavor text
      (effect/description/notes/enhancement) — no attack bonus, no damage
      die, nothing, for any weapon. Added Attack + Damage fields, computed
      the same way `WeaponTable.vue`'s own row already does
      (`dnd.attackBonus`/`dnd.damageBonus`/`dnd._weaponProps`), now that the
      builder optionally takes `character`/`partyItems`. Versatile and
      thrown each get their own line rather than one blended number — a
      versatile weapon shows One-Handed and Two-Handed separately, a thrown
      weapon shows its range; a weapon that's both (Spear, Trident) combines
      "One-Handed / Thrown" into one line since those numbers are identical
      (same ability mod, same base die per real RAW — see the thrown/grip
      TODO entry above) rather than repeating them. Also added real
      `damage_type` (bludgeoning/piercing/slashing) to all 36 weapon
      categories in `dnd_constants.js`'s `WEAPON_PROPS` table — it never
      existed as tracked data before this, so damage type couldn't have
      been shown anywhere even if something had asked for it. `npm run
build` clean.

- [x] **Weapon slot capacity ignored weapon sets — fixed 2026-09-11.**
      Follow-on bug from the 1H/2H grip toggle added earlier this session:
      two two-handed weapons equipped, one in each weapon set (a normal,
      legal loadout — only one set is ever in-hand at once), falsely showed
      as "overloaded" because `CharacterInventory.vue`'s slot-capacity
      counting was global across both sets. Fixed: `melee1h`/`melee2h`/
      `ranged1h` capacity is now counted per weapon set (an unassigned/"Any"
      weapon counts toward both, matching how "Any" already behaved
      elsewhere), while non-weapon slots (rings, armor, etc.) keep the old
      global count. Also relaxed `canEquip`/`cannotEquipReason` to never
      hard-block on a weapon slot specifically — equip-then-assign-a-set is
      a two-step flow, and a weapon defaults to "Any" until deliberately
      assigned, so the old hard block could've prevented equipping a second
      two-hander at all before you got the chance to put it in Set 2.
      `npm run build` clean.

- [ ] **Thrown attacks with a versatile+thrown weapon (Spear, Trident) show
      the wrong damage die when the weapon's grip is set to two-handed —
      found 2026-09-11, not fixed.** Real RAW: versatile's bigger die only
      applies to a melee attack made while gripping with two hands; a thrown
      attack is inherently one-handed and should always use the base die
      regardless of how the weapon's `slot` is currently set. Confirmed
      `WeaponTable.vue` doesn't model this distinction — it shows one
      `damage` value per weapon (from `dnd_utils.js`'s `gripDie()`) plus a
      thrown-range badge, so a Spear set to `melee2h` would incorrectly show
      1d8 for a thrown attack instead of the real 1d6. Narrow edge case
      (versatile-and-thrown is just Spear and Trident in core rules) — needs
      a design decision (two damage lines? a conditional based on which
      attack mode is being made?) before fixing, not a quick tweak.

- [x] **"Selling an item" appeared to have disappeared — actually a labeling
      bug, not a missing feature, fixed 2026-09-11.** Project owner reported
      losing the ability to sell items after the Weave Dust destroy feature
      was added (2026-09-08, see `TODO_ARCHIVE.md`). Traced it: selling
      never actually broke — `CharacterInventory.vue`'s delete dialog always
      had a gold-vs-dust toggle and calling `ADJUST_PARTY_GOLD` on confirm
      worked the whole time — but every label in that flow said "Delete"
      regardless of whether gold changed hands, and the entry-point ✕
      button's tooltip just said "Delete item," giving no hint that selling
      was even possible from there. Fixed the labeling only, no logic
      changed: the ✕ tooltip, dialog title, body text, and confirm button
      now all say "Sell" whenever a sale value is entered (gold path) or
      "Destroy" (dust path), falling back to "Delete" only for a genuine
      zero-value discard; the gold toggle button itself now reads "Sell for
      Gold" instead of bare "Gold". `npm run build` clean.

- [x] **Familiar support (Find Familiar) — built 2026-09-11**, for Kerra's
      rebuild (Book of Ancient Secrets ritual pick). No familiar tracking
      existed anywhere before this. Turned out the app already had a full
      "owned secondary combatant" system built for a different purpose —
      `companions.json` + `CompanionSummonStrip.vue`/`CompanionPanel.vue`,
      already wired into `CharacterSheet.vue` and the Combat Tracker
      (`CombatContext.vue` auto-adds a summoned companion to the initiative
      order under `type: 'companion'`). Reused it wholesale rather than
      building a parallel system: new `FamiliarSummon.vue` shows a "Summon a
      Familiar" picker on the sheet whenever a character knows Find Familiar
      and has no companion record yet, offering the real 15 PHB forms (Bat,
      Cat, Crab, Frog, Hawk, Lizard, Octopus, Owl, Poisonous Snake, Quipper,
      Rat, Raven, Sea Horse, Spider, Weasel). On pick, calls the existing
      `lookupMonster()` (dnd5eapi.co, same 3-tier cache every other lookup
      uses) for the real stat block and writes a `companions.json` row
      (`companion_type: 'familiar'`) — no hand-authored stat blocks, so
      accuracy rides on the same API the Monster Browser already trusts.
      Added a `notes` panel to `CompanionPanel.vue` (it previously showed
      attacks but never notes) specifically so a real RAW caveat is visible,
      not just buried in JSON: **a familiar summoned this way can't attack**
      (needs Pact of the Chain, which this isn't) — the natural stat-block
      attacks are stored for reference only. `npm run build` clean. Not
      tested against every one of the 15 forms' live API response shape —
      worth a live try with a couple of different forms before trusting it
      fully; malformed/missing fields from the API would currently just
      show up blank rather than erroring.

- [x] **Versatile weapons had no way to be equipped two-handed — fixed
      2026-09-11.** `dnd_utils.js`'s damage-die calc already had a
      `gripDie()` heuristic inferring two-handed grip whenever a versatile
      weapon was the only one-handed weapon equipped, but (a) that
      inference doesn't check for a shield in the other hand, and (b) there
      was no way to deliberately choose two-handed when it WOULDN'T be
      inferred (e.g. a second one-hander or shield also equipped). Added a
      1H/2H toggle button on equipped weapons in `CharacterInventory.vue`
      (shown only for weapons that actually resolve as versatile) that sets
      `item.slot` explicitly to `melee1h`/`melee2h`. The shield-blind-spot
      in the inference itself wasn't touched — still worth fixing
      separately if a shield-plus-versatile-weapon case actually comes up.

- [x] **Warlock spell catalog had real gaps — found and fixed 2026-09-11**,
      while the project owner was rebuilding Kerra and the known-spell
      picker looked suspiciously short. Diffed the local catalog
      (`classes` field on SRD/published spell entries) against a verified
      real list (`dnd5e.wikidot.com/spells:warlock`): 5 spells existed
      locally but weren't tagged Warlock-eligible (Mislead, Planar Binding,
      Teleportation Circle, Gate, Weird — tagged now), and 11 real Warlock
      spells were missing from the catalog entirely — Witch Bolt, Distort
      Value, Arms of Hadar (1st); Cloud of Daggers, Crown of Madness, Flock
      of Familiars (2nd); Incite Greed (3rd); Galder's Speedy Courier, Gate
      Seal, Raulothim's Psychic Lance (4th); Arcane Gate (6th). Added full
      entries for all 11 to `published_spells.json` (`homebrew: false`,
      real source citations — Acquisitions Incorporated, SCAG, Xanathar's,
      Fizban's, Strixhaven — none are 2024-ruleset content). `npm run
build` clean. Same class of bug as the Artificer spell-list gap found
      earlier this session — worth checking other classes' `classes`-field
      coverage the next time a known-spell picker looks thin for no
      obvious reason.

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

- [ ] **Character rebuild queue: Sorra, Lexica, Torrin still open; Kerra DONE
      2026-09-11 (see below).** All four were renamed to `"<Name> (Old)"`
      2026-09-11 to free up the real name for a fresh build. Project owner is
      building the replacements themselves;
      once each new character exists, delete the corresponding `(Old)`
      record and manually transfer over any notes worth keeping first.
      Lexica wasn't previously flagged for a rebuild in this file (her spell
      audit came back clean) — included per the project owner's explicit
      2026-09-11 call, for reasons outside the spell audit's scope.
      Renaming updated every functional reference to the old name, not just
      the character record, so the archived sheets keep working correctly
      until deleted: `party_items.json`'s `equipped_by`/`carried_by` on
      their gear (27 fields), and `user_prefs.json`'s `parties[].members`,
      `parties[].marching_order`, and `savedParties[].members` (9 entries).
      `npm run build` clean after. Consolidated here 2026-09-11 so this
      stops getting re-asked about piecemeal; each character has its own
      distinct reason it was queued:

  - **Sorra (Bard, College of Spirits, level 9).** 13 known leveled spells
    against a real cap of 12 (confirmed via `engine.spellsKnownForClass`).
    Project owner (2026-09-11): her stats are also illegal on top of the
    spell overage — full rebuild, not a 1-spell trim.
  - **Kerra — DONE, 2026-09-11.** Rebuilt from level 1 Fighter through the
    Level Up tool as originally suggested, real-world-tested the tool along
    the way and found/fixed several real bugs surfaced by the process
    (Eldritch Invocations letting duplicate picks through, no spell-granting
    invocation ever prompting a picker — Book of Ancient Secrets specifically
    — and the level-up preview view losing scroll position on every spell
    pick). Full audit of the finished sheet came back clean (ability scores,
    HP, saves, spell/cantrip counts, invocation count all check out against
    real caps); Deception in her skill list and her eventual Dueling fighting
    style were both deliberate project-owner choices, not bugs. Image,
    persona_notes, notes, and all 6 inventory items transferred from the old
    sheet; `Kerra (Old)` deleted once the project owner confirmed they were
    happy with the result. Also gave her a real Find Familiar familiar via a
    new feature — see the Familiar support entry below.
  - **Lexica (Bard, College of Lore).** Spell audit came back clean (see
    below) — this rebuild is for a different reason the project owner
    has, not spell-related.
  - **Torrin (Rogue, `subclass: "Soulknife / Mastermind"`).** Project owner
    (2026-09-02): "I don't even use him, it was a bad concept." His
    subclass field is literally two real Rogue subclass names mashed into
    one string that doesn't resolve via `loadSubclass` — a deliberate
    homebrew dual-subclass hack from an earlier session. He has 0
    recorded spells, which is fine/expected for this subclass
    combination — the subclass string itself is the only real problem.

    No priority order set between the remaining three yet — ask before
    starting one.

- [ ] **Full spell/cantrip audit across the roster (2026-09-08, re-verified
      2026-09-11) — mostly resolved now, see below for what's still open.**
      Wrote a one-off audit script (engine's own `cantripsKnownForClass`/
      `spellsKnownForClass`/`isSpellOnClassList`) across every caster. Real
      findings, confirmed by digging into git history and each character's
      actual feats/features before touching anything (several first-glance
      "bugs" turned out to be legitimate RAW mechanics the audit script just
      didn't know about — worth remembering next audit: don't trust a flat
      script's output, verify against feats/subclass data before reporting
      or fixing, and re-check the CURRENT character sheet before trusting an
      old note in this file, which can go stale once someone else fixes the
      thing it describes):

  - **Wizards (Lenn/Kessara/Lyria) — NOT a bug, no changes made.** All
    three show 10 cantrip entries against a cap of 4. Traced via
    `git log -S` to the commit that gave the party "Iyani's goddess
    mother's gift" (synced wizard spellbooks) — confirmed each wizard's
    real 4 pre-gift cantrips are exactly the ones tagged `prepared: true`
    today; the other 6 (`prepared: false`) represent spells visible in
    the shared spellbook but not actually known, which is the right call
    since cantrips genuinely can't be learned from a spellbook/scroll
    under RAW. Data was already modeling this correctly; the audit
    script just didn't account for the flag. Kessara's High Elf racial
    cantrip (Minor Illusion, tagged `featureGranted`) also correctly
    doesn't count against her 4.
  - **Rith (Sorcerer, Divine Soul) — NOT a bug, confirmed accurate, no
    changes made.** Project owner was right to be confident. Verified:
    his Divine Magic affinity bonus spell (Bless, Law affinity) is
    correctly tagged `featureGranted`; Fey Touched's free Misty
    Step/Silvery Barbs are correctly tagged and don't need a normal
    known-spell slot; his 5 "off Sorcerer list" spells are legal Divine
    Magic Cleric-list substitutions (still count against the cap, which
    they do); his cantrip count (5) and known-spell count (10) both hit
    their real level-9 caps exactly.
  - **Enauweyn (Paladin, Oath of the Crown) — DONE.** Her "Fey Step"
    feature is the real Eladrin racial trait (a non-spell teleport, no
    spells[] entry needed) — NOT the Fey Touched feat, and doesn't
    explain her recorded "Misty Step" spell. No other source found;
    removed it. Bigger gap: **Oath of the Crown's subclass file had no
    oath-spell table at all** (checked `engine/CHECKLIST.md` — its
    `features_by_level` was verified against her real feature list in an
    earlier session, but the oath-spell table was simply never added,
    unlike sibling subclasses built the same pass). Added the real
    PHB/SCAG table (3rd: Command/Compelled Duel, 5th: Warding
    Bond/Zone of Truth, 9th: Aura of Vitality/Spirit Guardians, 13th:
    Banishment/Guardian of Faith, 17th: Circle of Power/Geas) — her
    existing tagged oath spells (Aura of Vitality, Spirit Guardians,
    Warding Bond) already matched this table exactly, confirming it's
    right; added her 2 missing legitimate picks (Command, Compelled
    Duel, Zone of Truth).
  - **Revven (Cleric, Tempest Domain) — DONE.** Charm Person had no
    supporting feat/domain/background (project owner: "I don't know").
    Removed.
  - **Ferghus (Paladin, homebrew Oath of the Open Road) — DONE, this note
    was stale.** Fixed a real bug: the subclass file's oath-spell table
    was keyed `"1"` instead of `"3"` (every other built-out oath in this
    project keys by real character level). The 5th-level pick was later
    changed to Enlarge/Reduce + Silence (2026-09-08, project owner's
    choice, replacing the earlier unconfident Misty Step/Shatter), and
    9th/13th/17th were filled in 2026-09-09 (Incite Greed/Galder's
    Tower, Banishment/Summon Greater Demon, Temporal Shunt/Steel Wind
    Strike) — confirmed present and correct on Ferghus's own sheet
    through his current level during the 2026-09-10 subclass audit.
    Nothing left open here.
  - **Elucyne (Ranger, Gloom Stalker) — DONE (confirmed again 2026-09-11).**
    Confirmed level-5 Ranger really does cap at 4 known spells (checked
    `engine/data/spellcasting-tables.json`, not memory). Real gap found
    beyond just "1 spell short": her Rope Trick and Fear were tagged as
    normal known picks, but both are actually **Gloom Stalker Magic**
    free bonus spells (checked the subclass's own feature text) — Rope
    Trick (5th level) is legitimate but was mistagged; Fear (9th level)
    was outright premature at Ranger 5 and has been removed; Disguise
    Self (3rd level), the one she was missing entirely, has been added.
    Re-checked 2026-09-11 against the live sheet: she now has exactly
    4/4 known spells (Fog Cloud, Longstrider, Pass without Trace,
    Hunter's Mark), with Disguise Self/Rope Trick still correctly
    tagged `featureGranted`. Nothing left to do here.
  - **Sorra (Bard, College of Spirits) — superseded, see the rebuild queue
    above.** Confirmed via her features list: no early-Magical-Secrets-
    granting feature exists for this subclass (unlike Lexica below), so
    her Counterspell/Revivify (tagged `magical_secret`) had no
    legitimate source at level 9 — removed, along with an off-list
    cantrip (Green-Flame Blade, also unexplained). Cantrip count now
    correct (3/3). Her remaining 13 leveled known spells are all
    legitimately on Bard's list individually, but that's still 1 over
    the real cap of 12 — moot as a standalone fix now that she's queued
    for a full rebuild (illegal stats too, per the project owner).
  - **Lexica (Bard, College of Lore) — DONE (confirmed again 2026-09-11).**
    Her "Magical Secrets (level 6 — used)" feature, with its own note
    naming Counterspell/Scrying, is College of Lore's real **Additional
    Magical Secrets** — a different, RAW-legal, and explicitly free
    ability (unlike base Bard's 10th-level Magical Secrets, Lore's
    6th-level version doesn't count against spells known). Re-tagged
    both as `featureGranted` instead of removing them — the project
    owner's instinct to reset her was reasonable caution, but the data
    turned out to already be correct, just mistagged. Re-checked
    2026-09-11: Phantasmal Killer (the previously-flagged unexplained
    off-list spell) is gone from her sheet — she now has exactly 12/12
    known spells + 3/3 cantrips, magical secrets still correctly
    tagged. Nothing left to do here.
  - **Jaygar (Artificer, Infused Arbalist) — cantrips DONE; leveled spells
    were a real gap, partially fixed 2026-09-11, one part still open.**
    He has exactly 2 cantrips (Guidance, Resistance), matching
    Artificer's real cap of 2 at level 9 (verified via
    `engine.cantripsKnownForClass`, not memory — the cap only rises to 3
    at 10th level). Both are legitimate Artificer-list cantrips.
    **New finding 2026-09-11**: he had zero leveled spells recorded at
    all despite being a 9th-level half-caster — the original cantrip-
    only note missed this entirely. Added his 6 always-prepared Infused
    Arbalist bonus spells (Shield, Thunderwave, Scorching Ray, Shatter,
    Fireball, Wind Wall — his subclass's own `expanded_spell_list`,
    don't count against his normal prepared total). **Still open**: his
    INT-based prepared count (`engine.preparedSpellCount('Artificer', 9,
5, 'Infused Arbalist')` = 9, from INT 20) worth of real picks from
    the Artificer list — project owner is choosing these via the Spell
    Browser and will report back.

                                                        Also surfaced a **data gap worth fixing separately, not urgent**:
                                                        the local Artificer spell-list tagging (the `classes` field on SRD/
                                                        published spell entries) is badly incomplete — only 29 spells total
                                                        carry an `Artificer` class tag across every level, versus the real
                                                        Tasha's list's 60+ entries through 5th level (confirmed against
                                                        `dnd5e.wikidot.com/spells:artificer`). This means the Spell
                                                        Browser's "Class: Artificer" filter under-reports for now — anyone
                                                        filtering by Artificer there should know the shortlist is a cache
                                                        gap, not the real set of legal options. Not fixed this session;
                                                        would mean re-tagging dozens of existing SRD entries.

  - **Tackett (Druid, Circle of Stars) — DONE.** Project owner's call: he's
    a "legendary" character, RAW-accuracy isn't the goal, just a clean
    in-fiction reason for his 6 recorded cantrips (cap 3). Added a new
    homebrew feature, "Legendary Repertoire" (`published_features.json`,
    id `hb_tackett_legendary_cantrips`), granting a flat +3 cantrips,
    and added it to his `features[]`.
  - **Chuknora (Barbarian/Paladin) — DONE, cosmetic tagging fix only,
    2026-09-11.** A fresh cross-roster cantrip/known-spell cap sweep
    this session flagged her Giant's Power cantrip (Thaumaturgy) as
    uncapped — false alarm, she's fully RAW-legal (Path of the Giant's
    Giant's Power grants Thaumaturgy or Druidcraft for free, confirmed
    against `published_features.json`). The entry just used an informal
    `note` field instead of the project's normal `featureGranted: true` + `_source` tagging convention that every other free/bonus spell
    uses, which is what made the script flag it. Fixed the tag so
    future audits don't re-flag her; no rules content changed.
  - **Minor, not yet acted on**: all 3 wizards' spellbooks reference
    "Negative Energy Flood (homebrew spell from necromancer's
    spellbook)," which doesn't exist anywhere in the local spell
    catalog — fine to leave as flavor text, but if it's ever actually
    cast at the table it'll need a real homebrew spell entry.

    Verification: `npm run build` clean; `cd engine && node --test`
    218/218. The audit script itself lives at `scratchpad/spell_audit.js`
    in this session's scratchpad, not committed to the repo — one-off,
    not a permanent tool.

- [ ] **[USER ACTION] Mine other chats for lore.** User has a lot of world
      lore (history, locations, factions, etc.) scattered across other chat
      conversations, not in this repo. Action item is on the user: go
      through those chats, pull out the lore/location/history content, and
      get it into `lore/` (see `lore/README.md` for the convention —
      `places/`, `history/`, `beasts/`, `factions/`, `people/`). Not
      something Claude can do — the source material only exists in those
      other conversations.

- [ ] **Background expansion + species.json SRD-scope reconciliation — both intentionally on hold, not forgotten.** Two separate, unrelated gaps left over after the racial-mechanics work below was completed (now archived, see TODO_ARCHIVE.md): (1) only 40 of ~360 backgrounds have real curated skill data (`engine/data/backgrounds.json`) — explicitly deprioritized 2026-09-07 (project owner: "I don't think we need that many more backgrounds. skip them for now"); the picker's "Other (custom)" escape hatch covers the gap for now. (2) `src/data/api_data_cache/species.json`'s SRD flavor-entry scope is unresolved — the cache went missing and was rebuilt from dnd5eapi.co with only the 13 real races/subraces the API has, not the ~380 previously noted here; project owner wants to reconcile against another hard drive before trusting either number, not something Claude can resolve alone.
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
