const leveling = require('./data/leveling.json')
const { abilityModifier } = require('./rules/abilities')
const {
  proficiencyBonus,
  asiLevelsForClass,
  isAsiLevel,
  hitDieForClass,
  hpGainForLevel,
} = require('./rules/progression')
const {
  loadClass,
  listClasses,
  featuresGainedAtLevel,
  allFeaturesUpToLevel,
} = require('./rules/classFeatures')
const {
  spellSlotsForClassAtLevel,
  pactMagicForLevel,
  mysticArcanumLevelsKnownAt,
  cantripsKnownForClass,
  spellsKnownForClass,
  preparedSpellCount,
} = require('./rules/spellcasting')
const {
  loadSubclass,
  listSubclasses,
  subclassFeaturesGainedAtLevel,
} = require('./rules/subclasses')
const { validateCharacter } = require('./rules/validateCharacter')
const { describeLevelUp } = require('./rules/levelUp')
const { diffLevelUp } = require('./rules/diffLevelUp')
const { loadFeat, isFeatGrantedSpell } = require('./rules/grants')
const {
  meetsFeatPrerequisites,
  evaluatePrerequisite,
} = require('./rules/featPrerequisites')
const {
  findSpellRecord,
  isSpellOnClassList,
  listSpellsForClass,
  effectiveMaxSpellLevel,
} = require('./rules/spellLists')
const {
  listInvocations,
  loadInvocation,
  meetsInvocationPrerequisite,
  invocationsKnownForLevel,
  listPactBoons,
  loadPactBoon,
} = require('./rules/invocations')
const {
  casterLevelContribution,
  multiclassCasterLevel,
  multiclassSpellSlots,
  multiclassPactSlots,
  expectedProficienciesForCharacter,
} = require('./rules/multiclass')
const {
  applyIncrease,
  applyFeatChoice,
  resolveAsiOrFeat,
  SCORE_CAP,
} = require('./rules/asiFeat')
const {
  scoreCost,
  pointBuyCost,
  validatePointBuy,
  BUDGET: POINT_BUY_BUDGET,
} = require('./rules/pointBuy')
const {
  loadSpecies,
  listSpecies,
  applySpeciesBonus,
  traitsFor,
} = require('./rules/species')
const { listBackgrounds, loadBackground } = require('./rules/backgrounds')
const { listSkills, loadSkill } = require('./rules/skills')
const { listLanguages, loadLanguage } = require('./rules/languages')
const {
  createCombatTurnState,
  advanceTurn,
  setActiveTurnIndex,
  setResource,
  spendResource,
  resetResourcesFor,
  syncOrder,
  hasActedThisRound,
} = require('./rules/combatTurn')
const {
  buildCombatant,
  toEncounterData,
  listRoles,
} = require('./rules/npcBuilder')

module.exports = {
  data: { leveling },
  abilityModifier,
  proficiencyBonus,
  asiLevelsForClass,
  isAsiLevel,
  hitDieForClass,
  hpGainForLevel,
  loadClass,
  listClasses,
  featuresGainedAtLevel,
  allFeaturesUpToLevel,
  spellSlotsForClassAtLevel,
  pactMagicForLevel,
  mysticArcanumLevelsKnownAt,
  cantripsKnownForClass,
  spellsKnownForClass,
  preparedSpellCount,
  loadSubclass,
  listSubclasses,
  subclassFeaturesGainedAtLevel,
  validateCharacter,
  describeLevelUp,
  diffLevelUp,
  loadFeat,
  isFeatGrantedSpell,
  meetsFeatPrerequisites,
  evaluatePrerequisite,
  findSpellRecord,
  isSpellOnClassList,
  listSpellsForClass,
  effectiveMaxSpellLevel,
  listInvocations,
  loadInvocation,
  meetsInvocationPrerequisite,
  invocationsKnownForLevel,
  listPactBoons,
  loadPactBoon,
  casterLevelContribution,
  multiclassCasterLevel,
  multiclassSpellSlots,
  multiclassPactSlots,
  expectedProficienciesForCharacter,
  applyIncrease,
  applyFeatChoice,
  resolveAsiOrFeat,
  SCORE_CAP,
  scoreCost,
  pointBuyCost,
  validatePointBuy,
  POINT_BUY_BUDGET,
  loadSpecies,
  listSpecies,
  applySpeciesBonus,
  traitsFor,
  listBackgrounds,
  loadBackground,
  listSkills,
  loadSkill,
  listLanguages,
  loadLanguage,
  createCombatTurnState,
  advanceTurn,
  setActiveTurnIndex,
  setResource,
  spendResource,
  resetResourcesFor,
  syncOrder,
  hasActedThisRound,
  buildCombatant,
  toEncounterData,
  listRoles,
}
