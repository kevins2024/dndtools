const leveling = require('./data/5e/leveling.json')
const { abilityModifier } = require('./rules/5e/abilities')
const {
  proficiencyBonus,
  asiLevelsForClass,
  isAsiLevel,
  hitDieForClass,
  hpGainForLevel,
} = require('./rules/5e/progression')
const {
  loadClass,
  listClasses,
  featuresGainedAtLevel,
  allFeaturesUpToLevel,
} = require('./rules/5e/classFeatures')
const {
  spellSlotsForClassAtLevel,
  pactMagicForLevel,
  mysticArcanumLevelsKnownAt,
  cantripsKnownForClass,
  spellsKnownForClass,
  preparedSpellCount,
} = require('./rules/5e/spellcasting')
const {
  loadSubclass,
  listSubclasses,
  subclassFeaturesGainedAtLevel,
} = require('./rules/5e/subclasses')
const { validateCharacter } = require('./rules/validateCharacter')
const { describeLevelUp } = require('./rules/5e/levelUp')
const { diffLevelUp, applyFeatureMechanics } = require('./rules/5e/diffLevelUp')
const { resolveEffectiveScores } = require('./rules/5e/abilityScores')
const { loadFeat, isFeatGrantedSpell } = require('./rules/5e/grants')
const { featureMechanics } = require('./rules/5e/featureMechanics')
const {
  meetsFeatPrerequisites,
  evaluatePrerequisite,
} = require('./rules/5e/featPrerequisites')
const {
  findSpellRecord,
  isSpellOnClassList,
  listSpellsForClass,
  listFeatSpellChoices,
  effectiveMaxSpellLevel,
} = require('./rules/5e/spellLists')
const {
  listInvocations,
  loadInvocation,
  meetsInvocationPrerequisite,
  invocationsKnownForLevel,
  listPactBoons,
  loadPactBoon,
} = require('./rules/5e/invocations')
const {
  casterLevelContribution,
  multiclassCasterLevel,
  multiclassSpellSlots,
  multiclassPactSlots,
  expectedProficienciesForCharacter,
} = require('./rules/5e/multiclass')
const {
  applyIncrease,
  applyFeatChoice,
  resolveAsiOrFeat,
  SCORE_CAP,
} = require('./rules/5e/asiFeat')
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
} = require('./rules/5e/species')
const { listBackgrounds, loadBackground } = require('./rules/5e/backgrounds')
const { listSkills, loadSkill } = require('./rules/5e/skills')
const { listLanguages, loadLanguage } = require('./rules/5e/languages')
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
  applyFeatureMechanics,
  featureMechanics,
  resolveEffectiveScores,
  loadFeat,
  isFeatGrantedSpell,
  meetsFeatPrerequisites,
  evaluatePrerequisite,
  findSpellRecord,
  isSpellOnClassList,
  listSpellsForClass,
  listFeatSpellChoices,
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
