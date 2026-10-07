# Feature mechanics — open questions and oddities

Kept by the feature-mechanics job. Answer inline or tell Claude; `needs-owner` rows in `FEATURE_MECHANICS_CHECKLIST.md` are the source list.

## Owner decisions (needs-owner rows)

- **Celestial Resistance** (`pub_aasimar-celestial-resistance`, used by Iyani): No text on record; Iyani's species is a homebrew variant. Standard necrotic/radiant resistance?
- **Elf Weapon Training** (`pub_elf-weapon-training`, used by Therynv'l): Therynv'l has BOTH "Elf Weapon Training" (this, empty record) and "Elven Weapon Training" - duplicate tile? Which to keep?
- **Fey Step** (`pub_eladrin-fey-step`, used by Enauweyn): Tile uses bonus action/short rest/1 use (DMG/MToF eladrin). wikidot lineage:eladrin shows the newer version: proficiency-bonus uses per long rest. Which version do you want?
- **Healing Hands** (`pub_aasimar-healing-hands`, used by Iyani): Iyani's aasimar is a homebrew variant and this record has no text; wikidot lineage:aasimar Healing Hands is action, PB d4s, once per long rest. Is hers standard?
- **Light Bearer** (`pub_aasimar-light-bearer`, used by Iyani): No text on record; Iyani's species is a homebrew variant. Standard Light cantrip?
- **Stone's Endurance** (`pub_goliath-stones-endurance`, used by Chuknora): Tile uses reaction/short rest/1 use (older Volo's/EGtW). wikidot lineage:goliath shows the newer version: proficiency-bonus uses per long rest. Which version do you want?
- **Sixty Leagues Before Dusk** (`pub_sixty-leagues-before-dusk`, used by Therynv'l): Homebrew; text untouched. Homebrew text gives no recharge/uses; tile has action, 1/long rest. Confirm.
- **Healing Touch** (`pub_healing-touch`, used by Iyani): Homebrew; text untouched. Homebrew text gives no usage limit; tile has action, 1 use/long rest. Confirm.
- **Aasimar Transformation** (`pub_aasimar-transformation`, used by Iyani): Homebrew; text untouched. Homebrew; need to confirm recharge in text vs tile (action, 1/long rest).
- **Steel Will** (`pub_steel-will`, used by Elucyne): Text verified vs wikidot (bard). Steel Will is a Ranger Hunter Defensive Tactics option, not a Gloom Stalker feature; where does Elucyne get it? (advantage vs frightened)
- **Homing Strikes** (`pub_soulknife-homing-strikes`, used by Torrin): Text is a consistent paraphrase of wikidot (rogue:soulknife). Tile says reaction; RAW has no action (add die to a missed psychic-blade attack roll).
- **Bountiful Luck** (`pub_bountiful-luck`, used by Tackett): Text is a consistent paraphrase of wikidot (lineage:halfling). RAW (xge feat): no recharge, but using it blocks Lucky until end of your next turn. Record note says it "does not cost Lucky" - house ruling?
- **Favored by the Gods** (`pub_favored-by-the-gods`, used by Rith): Text is a consistent paraphrase of wikidot (sorcerer:divine-soul). Mechanics entered (short rest, 1 use) with NO action type: RAW has no action (add 2d4 after seeing a failed save/missed attack). Rith's tile says reaction.

## Oddities noticed (not blocking)

- **Caster Prestidigitation tile id:** `engine/rules/5e/diffLevelUp.js` still adds the tile with `id: null` for newly leveled casters, so new characters will not get `hb_caster_prestidigitation`. One-line engine fix pending owner go-ahead.
- **Shadow Touched / Fey Touched (Denna, Sorra, Revven, Rith, Lexica):** RAW gives two free casts (one per spell, each once per long rest); tiles carry a single shared use (`uses_max: 1`). The catalog cannot yet express per-spell uses.
- **Wild Shape tile name (Tackett, Therynv'l):** tiles are named "Wild Shape (CR 1 or below)" but the record text describes the 2nd-level tier (CR 1/4, no fly/swim). Tiered ids exist (`gen_druid_base_wild-shape-improvement-*`).
- **Giant's Power record text** contains an editorial remark ("real RAW limits it to these two — not any wizard cantrip"). Should be removed from the rules text.
- **Thunderous Strike:** RAW name is "Thunderbolt Strike" (record `pub_thunderous-strike`); the roster tile calls it "Tempest Cleric — Thunderous Strike".
- **Shared Channel Divinity pool:** paladin/cleric Channel Divinity options each track their own 1 use on the tile; RAW is one shared pool. Needs an engine design (a base Channel Divinity tile owns the pool). Ferghus has no base paladin Channel Divinity tile at all.
- **Divine Smite SRD text:** fixed in `api_data_cache/features.json` (added "to a maximum of 6d8"); `scripts/build-srd-cache.js` will undo it if re-run.
- **wikidot lineage pages show the newer (MPMM-style) species rules** (e.g. Fey Step, Stone's Endurance, Healing Hands use proficiency-bonus uses). The tiles use the older versions. Species rows are flagged needs-owner rather than overwritten.
- **Tackett missing features:** reported by owner as not showing at all; separate bug, not investigated yet.
