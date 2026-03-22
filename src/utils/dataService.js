import characters from '@/data/characters.json'
import npcs from '@/data/npcs.json'
import locations from '@/data/locations.json'
import party_items from '@/data/party_items.json'
import world from '@/data/world.json'

const tables = {
  characters,
  locations,
  npcs,
  party_items,
  world,
}

const dataService = {
  get(table) {
    if (!tables[table]) {
      throw new Error(`Unknown table: ${table}`)
    }
    return Promise.resolve(tables[table])
  },
  tables: Object.keys(tables),
}

export default dataService
