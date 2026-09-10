# Subclass RAW-accuracy audit checklist

**All 113 subclasses now have a genuine full audit (✅) — see
`SUBCLASS_AUDIT_ARCHIVE.md` for every row.** This file is kept as the
permanent home for the audit's status legend and conventions; re-populate it
with a table if a subclass is ever changed enough (a real rules update, a
homebrew rewrite) to need re-verification.

The last 17 (previously 🔤 spell-list-only or 📎 character-cross-referenced)
were brought to a full audit 2026-09-10. That pass found real bugs in 13 of
the 17 — two subclasses (Circle of Stars and Tempest Domain) had gotten
essentially no real verification before and turned up the session's biggest
findings: Circle of Stars had an error on every single one of its 5 features,
including Star Map's entire mechanical payload (a free cantrip + an
always-prepared, slot-free-castable spell) being completely absent from the
catalog text. See `SUBCLASS_AUDIT_ARCHIVE.md`'s Druid/Cleric/Paladin/Ranger/
Sorcerer/Warlock sections for the full per-subclass writeups.

**Do not mark a row ✅ Full unless every feature's mechanical text was actually
compared against a real source (a live fetch/search this session, not
trained-knowledge recall).** Being lenient here defeats the whole purpose —
see the 2026-09-08/09 session notes in `TODO.md` and `CHECKLIST.md` for why
this distinction matters (a "looks right" pass on Lexica/Sorra missed a
genuinely corrupted character; a structural-only pass on Warlock patrons
missed 7 of 8 having no expanded spell list at all; the 2026-09-10 pass on
Circle of Stars would have missed 5 real bugs the same way).

**Character-data errors found along the way are noted directly in that
subclass's row** (in the archive), not tracked separately — whenever a
subclass being audited has a real roster user, their sheet gets checked
against the (now-verified) subclass data too, since that's often where an
error actually surfaces.

## Status legend

| Symbol | Meaning                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ⬜     | **Unchecked.** Only ever passed the one-time structural sweep (2026-09-09): does `features_by_level` (or the documented `option_catalog_level_gained`/`known_count_by_level` alternates) cover the class's real subclass-feature levels. That check is cheap and catches _missing/wrong breakpoints_, nothing else — it does NOT verify any feature's actual mechanical text, nor whether a spell-list-bearing subclass's list is present or accurate. |
| 🔤     | **Spell-list-only fix.** The subclass's defining spell-list mechanic (`expanded_spell_list` / `oath_spells_by_level` / `domain_spells_by_level`) was added or fixed and verified against a real source this session — but the subclass's _other_ named features were NOT independently re-checked. Treat the rest of the file as still unverified.                                                                                                     |
| 📎     | **Cross-referenced via a real character.** Came up while auditing an actual character using this subclass; some claims were validated against that character's data and/or trained-knowledge recall, but this was not a dedicated, source-fetched, feature-by-feature audit the way ✅ requires.                                                                                                                                                       |
| ✅     | **Full audit.** Every feature's mechanical text was checked against a live-fetched or searched real source. All 113 subclasses now qualify — see `SUBCLASS_AUDIT_ARCHIVE.md`.                                                                                                                                                                                                                                                                          |

## Running total

**0 subclasses left to audit. 113 of 113 have a real, source-verified ✅.**
Nothing currently tracked here — this file becomes active again only if a
subclass's real-world rules text changes, or a homebrew subclass gets
significantly rewritten.
