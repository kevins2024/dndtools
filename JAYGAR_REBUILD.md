# Jaygar rebuild — Artillerist vs. Battle Smith

Working notes from the 2026-09-02 audit session, so we don't have to re-derive
this when we pick the rebuild back up. Not a permanent project doc — delete
once the rebuild is done and folded into `engine/CHECKLIST.md`.

## Background

Concept arc: Pathfinder-style Alchemist (self-made bombs) → converted to
Artificer, bombs became different ammo types for a self-made crossbow →
picked Artillerist to house "the crossbow as his creation." He's since
picked up real Artificer spellcasting and drifted well off RAW. Goal: make
him legal while keeping as much of the established flavor as possible,
adding real homebrew only where it's needed.

All 4 real Artificer subclasses (Tasha's Cauldron of Everything) are now
built in `engine/data/subclasses/` — Alchemist, Armorer, Battle Smith were
missing entirely before this session; only Artillerist existed, and it had
two real bugs (below). Verified against 2 independent sources each,
`engine/test/artificerSubclasses.test.js` covers all 4.

## Bugs fixed in existing data (independent of which subclass wins)

- `hb_artillerist_eldritch_cannon` falsely claimed "two cannons at level 6"
  — real RAW is one cannon until 15th-level Fortified Position.
- `hb_artillerist_fortified_position` had `level_gained: 9` in the catalog
  (contradicting the subclass file's own placement at 15) — this is the
  likely root cause of Jaygar's persona_notes claiming "two cannons active
  at level 9," which isn't legal at his current level either way.
- `pub_experimental-elixir` (Alchemist) said elixir count "= INT modifier";
  real RAW is a flat schedule (1 at 3rd, 2 at 6th, 3 at 15th).
- 6 base-Artificer feature stubs (Spellcasting, The Right Tool for the Job,
  Spell-Storing Item, Magic Item Savant, Magic Item Master, Soul of
  Artifice) had `needs_description: true` / `description: null` — filled
  in with real text.

## Jaygar's current sheet vs. real Artillerist — legality gaps found

- Missing **The Right Tool for the Job** (level 3 base feature) entirely.
- Infuse Item shows **7 infusions known**; RAW at level 8-9 is **6** (next
  breakpoint is level 10 → 8).
- Enhanced Arcane Focus infusion gives **+2** to spell attacks; RAW that's
  a level-10 bonus — at level 9 it should still be **+1**.
- Armor of Magical Strength is modeled as an **always-on passive**; RAW
  it's a 6-charge resource (1 charge/use, regain 1d6/dawn) — currently
  strictly better than the real feature.
- Eldritch Cannon's 4 "modes" (Flamethrower/Force Ballista/Protector/
  Detonate) are all simultaneously available; RAW you choose **one** mode
  when you create the cannon — swapping means destroying and recreating it
  (action + spell slot).
- **Zero normal prepared Artificer spells recorded** — he should have 9
  (INT mod 5 + half level 4) freely-chosen spells from the Artificer list
  at level 9; only his 2 feat-granted spells (Misty Step, Command) and his
  6 always-prepared Artillerist Bonus Spells exist. Biggest content gap,
  independent of which subclass wins.
- Missing Rock Gnome's **Tinker** trait (distinct from Artificer's own
  Magical Tinkering).
- Everything else checks out clean: Gnome Cunning, Artificer's Lore, spell
  save DC (17) / attack bonus (+9), Flash of Genius uses (5), Tool
  Expertise, feat count (2, consistent with both his ASI levels spent on
  feats).

## Head-to-head: Artillerist (fixed) vs. Battle Smith

Both share the same base Artificer chassis (Magical Tinkering, Infuse Item,
The Right Tool for the Job, Tool Expertise, Flash of Genius, same spell
slots: 4/3/2 at level 9, same 2 cantrips, same empty 9-spell prepared list
to fill in).

|                    | Artillerist                                                                                                                                                                                                        | Battle Smith                                                                                                                                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 3rd                | Artillerist Bonus Spells (Shield, Thunderwave, Scorching Ray, Shatter, Fireball, Wind Wall — all 6 unlocked by level 9); Eldritch Cannon (**one** cannon, choose **one** mode at creation, AC 18, HP 45, 2d8 base) | Battle Ready (martial weapon prof + **INT for attack/damage with a magic weapon**); Steel Defender (Medium construct, AC 15, HP 52, Force-Empowered Rend 1d8+4, Repair 2d8+4 ×2/rest, Deflect Attack reaction)           |
| 5th                | Arcane Firearm (crossbow reskin: +1d8 to one damage roll when casting through it)                                                                                                                                  | Extra Attack — **two crossbow attacks per turn**, which Jaygar doesn't have at all today                                                                                                                                 |
| 9th                | Explosive Cannon (cannon damage 2d8→3d8; action to detonate for 3d8 force in 20ft, DC 17 save)                                                                                                                     | Arcane Jolt (2d6 extra force damage OR 2d6 healing to a nearby ally on a weapon hit, 5×/rest via INT mod, once/turn)                                                                                                     |
| Bonus spells       | Zero party support                                                                                                                                                                                                 | Heroism, **Warding Bond** (ally: +1 AC/saves, resistance to all damage, shares their damage with you), **Aura of Vitality** (bonus action each turn: 2d6 heal in a 30ft aura, up to 1 min) — real party support baked in |
| Attack profile     | **Two** separate systems: mundane crossbow (DEX) + cannon/firearm (INT) — the "crossbow is the cannon" reskin means the cannon has its own AC/HP and can be destroyed independently of Jaygar                      | **One** weapon, one attack profile, genuinely INT-based via a real feature — no invented mechanic needed                                                                                                                 |
| Crowd control      | Thunderwave (push), Wind Wall (area denial) — some soft control                                                                                                                                                    | None granted at all                                                                                                                                                                                                      |
| Party support edge | Protector cannon mode: 1d8+5 temp HP to self+allies within 10ft, repeatable at-will while cannon exists — but trades off against the cannon doing anything offensive that turn                                     | **Wins clearly** — Warding Bond + Aura of Vitality + Heroism are always-prepared, don't cost prep slots, and outperform Protector's one-time burst                                                                       |

## The actual trade-off

**Artillerist** keeps the "cannon" through-line but requires two magic
systems bolted onto one object, and "attack rolls are INT-based" (in his
persona notes) doesn't come from anything Artillerist actually grants — it'd
stay homebrew regardless of what else gets fixed.

**Battle Smith** gives a single coherent magic weapon that's genuinely
INT-based, a real damage jump (Extra Attack), and clearly better party
support — at the cost of Steel Defender needing a fictional home. That cost
may already be solved: Jaygar's shield, **Hlifar'dhe'gar**, already
transforms into a "construct guardian" that intercepts attacks for him
(command word `viel'bi-ra'`) — a _found_ magic item, not something he built,
which fits "not too high-tech for my world" and gives Steel Defender a
ready-made reflavor (a lesser echo of what the shield already does) without
importing the shield's own separate, much bigger numbers (AC 17/HP 142)
into the class feature.

## Crowd control / Web — resolved, not a legality problem either way

His "Web Bomb" item (`party_items.json`, `items_50`) is a standalone
consumable, independent of class/subclass — legal regardless of which way
this goes. Confirmed via web search: **no official 5e item called "Web
Bomb" exists** — it's unflagged homebrew (like the sibling Smoke
Bomb/Flash Bomb, almost certainly the same story, not individually
verified yet). Not urgent, but worth tagging properly or swapping for the
real **Wand of Web** (uncommon, charges-based) at some point.

Separately: **Web is a real, base Artificer spell** (2nd level, confirmed
against the actual class list) — legal for either subclass as one of his
own prepared picks, once we fill in that empty 9-spell list.

## Recommendation

Leaning Battle Smith: single coherent weapon mechanic that's actually
RAW-INT-based (not invented), better party support, and the one real cost
(Steel Defender) already has a narrative answer via the shield. Still your
call — both are legal, verified, and fully built now.
