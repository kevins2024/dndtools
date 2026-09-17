const fightingStyles = require('../../data/5e/fighting-styles.json')

function normalizeName(name) {
  return (name || '').trim().toLowerCase()
}

// Case-insensitive class-name match — mirrors how loadClass/normalizeName
// are used everywhere else in this engine, since callers pass a real
// character's class.name through untouched.
function stylesForClass(className) {
  const key = Object.keys(fightingStyles).find(
    (k) => !k.startsWith('_') && normalizeName(k) === normalizeName(className)
  )
  return key ? fightingStyles[key] : null
}

function listFightingStyles(className) {
  const styles = stylesForClass(className)
  if (!styles) return []
  return Object.entries(styles).map(([name, data]) => ({ name, ...data }))
}

// Case-insensitive lookup — the UI passes back whatever exact string it was
// given, but a hand-typed "Other" fallback (same escape hatch the feat and
// pact-boon pickers have) could differ in case.
function loadFightingStyle(className, styleName) {
  const styles = stylesForClass(className)
  if (!styles) return null
  if (styles[styleName]) return { name: styleName, ...styles[styleName] }
  const key = Object.keys(styles).find(
    (k) => normalizeName(k) === normalizeName(styleName)
  )
  return key ? { name: key, ...styles[key] } : null
}

module.exports = {
  listFightingStyles,
  loadFightingStyle,
}
