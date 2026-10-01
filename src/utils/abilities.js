// Thin wrapper around engine/rules/5e/abilities.js, same pattern and same
// reasoning as src/utils/combatTurn.js: ability modifier is a hot, pure
// calculation needed on nearly every character/enemy render, not a
// rules-catalog lookup, so this skips the /api/engine/* routes entirely and
// requires the engine file directly.
//
// Found 2026-09-30: `Math.floor((score - 10) / 2)` had been independently
// hand-typed in 11+ separate files across src/ (encounter_utils.js six
// times over, dnd_utils.js, Battle.vue, CharacterSpellbook.vue,
// CombatContext.vue, EncounterGenerator.vue, EnemyAbilityScoreGrid.vue,
// MonsterBrowser.vue, NpcGenerator.vue, ShortRestModal.vue) instead of
// calling this already-existing engine function once — the single most
// duplicated fact in the whole frontend. See engine/CHECKLIST.md's
// 2026-09-30 entry for the full consolidation writeup.
//
// Imports rules/5e/abilities.js directly — NOT the engine/index.js barrel,
// which several rule modules break webpack for via fs/path at require-time
// (see combatTurn.js's own header comment for the full story).
// abilities.js has zero dependencies — no fs, no path, no other rule file —
// so this is safe the same way combatTurn.js is.
const abilitiesEngine = require('../../engine/rules/5e/abilities')

export const abilityModifier = abilitiesEngine.abilityModifier
