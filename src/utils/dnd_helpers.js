import { dnd } from './dnd_utils.js'
import { characters } from './characters.json'
import { npcs } from './npcs.json'
import partyItems from './party_items.json'

const getCharacter = (name) => dnd.findCharacter(characters, name)
const getNPC = (name) => dnd.findNPC(npcs, name)

const summary = (character) => dnd.summary(character, partyItems)
const ac = (character) =>
  dnd.ac(character, dnd.mergeItems(character, partyItems))
const weaponSummaries = (character) =>
  dnd.weaponSummaries(character, dnd.mergeItems(character, partyItems))

export const help = {
  getCharacter,
  getNPC,
  summary,
  ac,
  weaponSummaries,
}
