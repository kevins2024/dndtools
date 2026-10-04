// Browser-side hydration of party items, for the one case the dev server
// isn't doing it: dataService's static (no-server) fallback. server.js
// hydrates party_items on every normal read (see engine/rules/5e/
// itemHydration.js), so this only runs when the app falls back to the
// bundled party_items.json, whose rows are stored by reference.
//
// Loaded with a dynamic import() from dataService.js so the ~1.7 MB item
// library lands in its own chunk that is only fetched in that fallback case,
// not in the main bundle.
//
// Requires the leaf engine files directly — NOT the engine/index.js barrel
// (see combatTurn.js's header comment): itemCatalog.js and itemHydration.js
// only `require` JSON and each other, no fs/path.
const { lookup, autoLinkItem } = require('../../engine/rules/5e/itemCatalog')
const { hydrateItems } = require('../../engine/rules/5e/itemHydration')

export function hydratePartyItems(rows) {
  return hydrateItems(rows.map(autoLinkItem), lookup)
}
