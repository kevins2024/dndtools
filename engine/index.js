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
const { meetsFeatPrerequisites } = require('./rules/featPrerequisites')
const { findSpellRecord, isSpellOnClassList } = require('./rules/spellLists')
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
} = require('./rules/species')
const { listBackgrounds, loadBackground } = require('./rules/backgrounds')
const { listSkills, loadSkill } = require('./rules/skills')

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
  findSpellRecord,
  isSpellOnClassList,
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
  listBackgrounds,
  loadBackground,
  listSkills,
  loadSkill,
}
