// The audit names a 2014 species trait that sits beside its 2024 replacement, and leaves a lineage
// the 2024 books never rewrote (Eladrin) alone. Simulated character; no real sheet is read.
const test = require('node:test')
const assert = require('node:assert/strict')
const { buildCharacter } = require('./helpers/autoLevel')
const { auditCharacter } = require('../rules/5e/auditCharacter')

const base = () =>
  buildCharacter({ className: 'Fighter', subclass: 'Champion', toLevel: 3 })
    .character

test('a species the 2024 books rewrote may not keep a 2014 trait beside its 2024 one', () => {
  const character = base()
  const doubled = {
    ...character,
    genus: 'Aasimar',
    features: [
      { name: 'Darkvision', id: 'pub_darkvision', type: 'feature' },
      {
        name: 'Darkvision',
        id: 'pub24_species_aasimar-darkvision',
        type: 'speciesTrait',
        level_gained: 1,
        _source: 'Aasimar',
      },
      ...character.features,
    ],
  }
  assert.ok(auditCharacter(doubled).some((i) => i.code === 'species-2014-leak'))
})

test('a lineage 2024 did not rewrite (Eladrin) keeps its 2014 traits without a leak report', () => {
  const character = base()
  const eladrin = {
    ...character,
    genus: 'Eladrin Elf',
    features: [
      { name: 'Fey Step', id: 'pub_eladrin-fey-step', type: 'feature' },
      { name: 'Trance', id: 'pub_elf-trance', type: 'feature' },
      ...character.features,
    ],
  }
  assert.ok(
    !auditCharacter(eladrin).some((i) => i.code === 'species-2014-leak')
  )
})
