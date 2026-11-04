// Thin wrapper around engine/rules/5e/featureUse.js (using a feature: Healing Hands, Breath Weapon,
// Celestial Revelation, Large Form...), same pattern as src/utils/featureGrants.js: plain data, no
// fs/path, so the browser requires the leaf file directly.
const useEngine = require('../../engine/rules/5e/featureUse')

export const useFeature = useEngine.useFeature
export const featureAction = useEngine.featureAction
export const endActiveEffect = useEngine.endActiveEffect
