// Centralized data loader for D&D tools
// Usage: import dataService from './dataService';
// dataService.get('characters').then(data => ...)

import characters from '@/data/characters.json';
import npcs from '@/data/npcs.json';
import locations from '@/data/locations.json';

const tables = {
  characters,
  npcs,
  locations
};

const dataService = {
  get(table) {
    if (!tables[table]) {
      throw new Error(`Unknown table: ${table}`);
    }
    return Promise.resolve(tables[table]);
  },
  tables: Object.keys(tables)
};

export default dataService;
