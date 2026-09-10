// jsonIntakeSchemas.js
// Field reference + id/dedupe rules for JsonIntakeTool.vue, one entry per
// data type the tool supports. Field lists here are DERIVED from what's
// actually present across the real files today (see the 2026-09-10 audit
// that produced this tool) — they describe the campaign's own established
// shape, not an invented ideal schema. Update this file if the real data's
// shape meaningfully changes (a new item type, a new NPC statblock field).
//
// Each field entry: { key, level, type, description, example }
//   level: 'required' | 'common' | 'occasional'
//     required  — the tool blocks saving an entry missing this field
//     common    — present on most real entries; flagged as a warning if
//                 missing, never blocks a save
//     occasional — legitimate but only relevant sometimes (e.g. full NPC
//                 statblocks, or armor-only / weapon-only item fields);
//                 never flagged as missing
//   `when`: for occasional fields that only apply to certain values of the
//     type's own `typeField` (e.g. party_items' `type` field) — an array of
//     values this field is associated with, shown as a hint in the UI.

export const SCHEMAS = {
  places: {
    label: 'Places',
    table: 'places',
    idPrefix: null, // not used at all in places.json — linked by `name`
    uniqueKey: 'name',
    typeField: null,
    fields: [
      {
        key: 'name',
        level: 'required',
        type: 'string',
        description: 'Place name — this is how everything else links to it.',
        example: 'Ravenquay',
      },
      {
        key: 'type',
        level: 'required',
        type: 'string',
        description: 'e.g. city, village, region, landmark.',
        example: 'city',
      },
      {
        key: 'description',
        level: 'required',
        type: 'string',
        description: 'Short one-or-two-sentence summary.',
        example: 'River delta city. Dawn Blades home base.',
      },
      {
        key: 'region',
        level: 'common',
        type: 'string',
        description: 'The larger region/continent this place sits in.',
        example: 'Fynesmarch',
      },
      {
        key: 'flair',
        level: 'common',
        type: 'string',
        description: 'A longer, atmospheric paragraph — read-aloud flavor.',
        example: 'A river delta city where commerce and underworld…',
      },
      {
        key: 'notes',
        level: 'common',
        type: 'string',
        description: 'DM working notes — plot hooks, current state, etc.',
        example: 'Harvest festival approximately 12 days out.',
      },
      {
        key: 'climate',
        level: 'common',
        type: 'string',
        description: 'Weather/climate flavor.',
        example: 'Temperate maritime. Fog burns off by midmorning.',
      },
      {
        key: 'faction_presence',
        level: 'common',
        type: 'array of strings',
        description: 'Which factions operate here.',
        example: '["Dawn Blades", "Smoke Vipers"]',
      },
      {
        key: 'districts',
        level: 'common',
        type: 'array of objects',
        description:
          'For settlements: { name, description, faction_presence, controller? }',
        example:
          '[{"name": "Docks Ward", "description": "…", "faction_presence": []}]',
      },
      {
        key: 'locations',
        level: 'common',
        type: 'array of objects',
        description:
          'Named sub-locations: { name, district?, type?, description?, notes? }',
        example: '[{"name": "Revivify", "district": "Merchant Quarter"}]',
      },
      {
        key: 'population',
        level: 'occasional',
        type: 'string',
        description: 'Free-text population estimate.',
      },
      {
        key: 'history',
        level: 'occasional',
        type: 'object',
        description: 'Free-shape historical notes.',
      },
      {
        key: 'government',
        level: 'occasional',
        type: 'string or object',
        description: 'Who rules / how power is distributed.',
      },
      {
        key: 'demographics',
        level: 'occasional',
        type: 'string',
        description: 'Who lives here.',
      },
      {
        key: 'features',
        level: 'occasional',
        type: 'array of objects',
        description: 'Notable landmarks: { name, description }.',
      },
      {
        key: 'layout',
        level: 'occasional',
        type: 'string',
        description: 'Physical layout flavor.',
      },
      {
        key: 'continent',
        level: 'occasional',
        type: 'string',
        description: 'For region-scale entries.',
      },
      {
        key: 'economy',
        level: 'occasional',
        type: 'object',
        description: 'Free-shape trade/economy notes.',
      },
      {
        key: 'harbour',
        level: 'occasional',
        type: 'object',
        description: 'For port settlements.',
      },
    ],
  },

  npcs: {
    label: 'NPCs',
    table: 'npcs',
    idPrefix: 'npcs',
    uniqueKey: 'name',
    typeField: null,
    fields: [
      {
        key: 'name',
        level: 'required',
        type: 'string',
        description: 'NPC name.',
        example: 'Helena Sable',
      },
      {
        key: 'location',
        level: 'common',
        type: 'string',
        description: 'Where to find them — "Place, Sub-location" convention.',
        example: 'Ravenquay, Gilt Rose',
      },
      {
        key: 'role',
        level: 'common',
        type: 'string',
        description: 'What they do / why the party knows them.',
        example: 'Info broker, runs the Gilt Rose',
      },
      {
        key: 'faction',
        level: 'common',
        type: 'string',
        description: 'Faction affiliation, if any.',
        example: 'Independent / Long Arm Trading',
      },
      {
        key: 'appearance',
        level: 'common',
        type: 'string',
        description: 'Physical description.',
      },
      {
        key: 'personality_traits',
        level: 'common',
        type: 'string',
        description: 'How they behave.',
      },
      {
        key: 'personality_quirks',
        level: 'common',
        type: 'string',
        description: 'Specific, memorable quirks/history with the party.',
      },
      {
        key: 'notes',
        level: 'common',
        type: 'string',
        description: 'DM working notes.',
      },
      {
        key: 'status',
        level: 'common',
        type: 'array of strings',
        description: 'e.g. ["ally"], ["hostile"], ["deceased"].',
      },
      {
        key: 'description',
        level: 'occasional',
        type: 'string',
        description: 'Extra flavor beyond role/appearance.',
      },
      {
        key: 'items',
        level: 'occasional',
        type: 'array of objects',
        description: "Notable gear worth recording on the NPC's own entry.",
      },
      {
        key: 'combat_class',
        level: 'occasional',
        type: 'string',
        description: 'Only for NPCs who might fight — "NPC-lite" stat hint.',
      },
      {
        key: 'combat_level',
        level: 'occasional',
        type: 'int',
      },
      {
        key: 'combat_notes',
        level: 'occasional',
        type: 'string',
      },
      {
        key: 'race',
        level: 'occasional',
        type: 'string',
        description: 'Only used on NPCs with a full statblock.',
      },
      { key: 'class', level: 'occasional', type: 'string' },
      { key: 'subclass', level: 'occasional', type: 'string' },
      { key: 'level', level: 'occasional', type: 'int' },
      { key: 'image', level: 'occasional', type: 'string (path)' },
      {
        key: 'stat_str / stat_dex / stat_con / stat_int / stat_wis / stat_cha',
        level: 'occasional',
        type: 'int',
        description: 'Full statblock only.',
      },
      { key: 'proficiency_bonus', level: 'occasional', type: 'int' },
      { key: 'spellcasting_ability', level: 'occasional', type: 'string' },
      { key: 'spell_save_dc', level: 'occasional', type: 'int' },
      { key: 'spell_attack_bonus', level: 'occasional', type: 'int' },
      { key: 'spell_recovery', level: 'occasional', type: 'string' },
      { key: 'hp_max / hp_current', level: 'occasional', type: 'int' },
      {
        key: 'unarmored_ac_formula',
        level: 'occasional',
        type: 'string',
        description: '"default" | "barbarian" | "monk"',
      },
      { key: 'saving_throws', level: 'occasional', type: 'array of strings' },
      {
        key: 'skill_proficiencies',
        level: 'occasional',
        type: 'array of strings',
      },
      { key: 'expertise', level: 'occasional', type: 'array of strings' },
      { key: 'languages', level: 'occasional', type: 'array of strings' },
      { key: 'features', level: 'occasional', type: 'array of objects' },
      { key: 'spells', level: 'occasional', type: 'array of objects' },
      { key: 'totem_spirits', level: 'occasional', type: 'array of objects' },
      { key: 'spell_slots', level: 'occasional', type: 'object' },
      { key: 'active_effects', level: 'occasional', type: 'array' },
    ],
  },

  lore: {
    label: 'Lore',
    table: 'lore',
    idPrefix: null, // hand-authored slug, not sequential — see slugify()
    uniqueKey: 'id',
    typeField: 'type',
    fields: [
      {
        key: 'id',
        level: 'required',
        type: 'string (slug)',
        description:
          'Meaningful slug, not a sequential number — auto-suggested from name/summary if you leave it out, but check it reads sensibly.',
        example: 'greyhollow-fall-001',
      },
      {
        key: 'type',
        level: 'required',
        type: 'string',
        description: 'e.g. event, species, faction, item, location.',
        example: 'event',
      },
      {
        key: 'status',
        level: 'required',
        type: 'string',
        description: 'e.g. known_to_party, dm_only, rumored.',
        example: 'known_to_party',
      },
      {
        key: 'summary',
        level: 'common',
        type: 'string',
        description: 'One-line headline.',
        example: 'The Fall of Greyhollow',
      },
      {
        key: 'detail',
        level: 'common',
        type: 'string',
        description: 'The full write-up.',
      },
      {
        key: 'date',
        level: 'common',
        type: 'string',
        description: 'In-world date.',
        example: 'Year 467, Day 139-140',
      },
      {
        key: 'source_session',
        level: 'common',
        type: 'string',
        description: 'Which real session this came from.',
      },
      {
        key: 'location_tags',
        level: 'common',
        type: 'array of strings',
        description: 'Lowercase slug tags linking to places.',
      },
      {
        key: 'entity_tags',
        level: 'common',
        type: 'array of strings',
        description: 'Lowercase slug tags linking to factions/NPCs/etc.',
      },
      {
        key: 'name',
        level: 'occasional',
        type: 'string',
        description: 'type: "species" entries — the species name.',
        when: ['species'],
      },
      {
        key: 'location',
        level: 'occasional',
        type: 'string',
        when: ['species'],
      },
      {
        key: 'appearance',
        level: 'occasional',
        type: 'string',
        when: ['species'],
      },
      {
        key: 'personality_traits',
        level: 'occasional',
        type: 'string',
        when: ['species'],
      },
      { key: 'notes', level: 'occasional', type: 'string' },
    ],
  },

  party_items: {
    label: 'Items',
    table: 'party_items',
    idPrefix: 'items',
    uniqueKey: null, // item names legitimately repeat (multiple "+2 Leather Armor") — no dedupe block
    typeField: 'type',
    typeValues: [
      'weapon',
      'armor',
      'wondrous',
      'ring',
      'consumable',
      'tool',
      'focus',
      'misc',
      'material',
      'teleport_disc',
    ],
    fields: [
      {
        key: 'name',
        level: 'required',
        type: 'string',
        example: 'Bracers of Defense',
      },
      {
        key: 'type',
        level: 'required',
        type: 'string',
        description:
          'weapon | armor | wondrous | ring | consumable | tool | focus | misc | material | teleport_disc',
      },
      {
        key: 'effect',
        level: 'required',
        type: 'string',
        description: 'Plain-English mechanical text — what the item does.',
      },
      {
        key: 'needs_attunement',
        level: 'common',
        type: 'bool',
        description:
          'Real 5e rule of thumb: a plain +N weapon/armor needs none; an item with an extra active property usually does.',
      },
      {
        key: 'attuned',
        level: 'common',
        type: 'bool',
        description: 'Whether it is CURRENTLY attuned, not just eligible.',
      },
      {
        key: 'equipped_by',
        level: 'common',
        type: 'string or null',
        description: 'Character name, or null.',
      },
      {
        key: 'carried_by',
        level: 'common',
        type: 'string or null',
        description: 'Character name, "party", or null.',
      },
      { key: 'slot', level: 'common', type: 'string' },
      { key: 'notes', level: 'common', type: 'string' },
      {
        key: 'battle_effect',
        level: 'common',
        type: 'bool',
        description: 'Flags it as combat-relevant for quick lookup.',
      },
      {
        key: 'rarity',
        level: 'common',
        type: 'string',
        description:
          'common | uncommon | rare | very rare | legendary | artifact',
      },
      {
        key: 'enhancement_bonus',
        level: 'occasional',
        type: 'int',
        when: ['weapon', 'armor'],
      },
      {
        key: 'weapon_category',
        level: 'occasional',
        type: 'string',
        when: ['weapon'],
        example: 'rapier',
      },
      {
        key: 'damage_dice',
        level: 'occasional',
        type: 'string',
        when: ['weapon'],
      },
      { key: 'finesse', level: 'occasional', type: 'bool', when: ['weapon'] },
      {
        key: 'weapon_effects',
        level: 'occasional',
        type: 'array of objects',
        when: ['weapon'],
      },
      {
        key: 'weapon_set',
        level: 'occasional',
        type: 'int (1 or 2)',
        when: ['weapon'],
        description: "Which of a character's two loadouts this belongs to.",
      },
      {
        key: 'armor_type',
        level: 'occasional',
        type: 'string',
        when: ['armor'],
        example: 'studded leather',
      },
      {
        key: 'armor_base_ac',
        level: 'occasional',
        type: 'int',
        when: ['armor'],
      },
      {
        key: 'unarmored_armor_base_ac',
        level: 'occasional',
        type: 'int',
        when: ['armor'],
        description: 'e.g. Robe of the Archmagi — overrides the AC formula.',
      },
      {
        key: 'unarmored_stat_bonuses',
        level: 'occasional',
        type: 'object',
        when: ['armor', 'wondrous'],
        description: 'Only applies while NOT wearing body armor.',
      },
      {
        key: 'stat_bonuses',
        level: 'occasional',
        type: 'object',
        when: ['wondrous', 'ring', 'focus', 'armor'],
        description:
          'Always-on bonuses — can target derived stats (ac, spell_save_dc, skill_X) or raw ability scores (str/dex/con/int/wis/cha).',
      },
      {
        key: 'charges_current / charges_max / charges_recharge',
        level: 'occasional',
        type: 'int / int / string',
        when: ['wondrous', 'ring', 'weapon', 'focus'],
      },
      {
        key: 'spells_granted',
        level: 'occasional',
        type: 'array of objects',
        when: ['wondrous', 'ring'],
      },
      {
        key: 'features_granted',
        level: 'occasional',
        type: 'array of strings',
        when: ['wondrous'],
      },
      {
        key: 'contents',
        level: 'occasional',
        type: 'array of objects',
        when: ['material'],
      },
      { key: 'quantity', level: 'occasional', type: 'int' },
      {
        key: 'party_id',
        level: 'occasional',
        type: 'string or null',
        description: 'Auto-filled when carried_by is "party".',
      },
      { key: 'stored_at', level: 'occasional', type: 'string or null' },
      { key: 'description', level: 'occasional', type: 'string' },
      { key: 'appearance', level: 'occasional', type: 'string' },
    ],
  },

  assets: {
    label: 'Assets',
    table: 'assets',
    idPrefix: 'assets',
    uniqueKey: 'name',
    typeField: 'type',
    fields: [
      { key: 'name', level: 'required', type: 'string', example: 'Dawn Rose' },
      {
        key: 'type',
        level: 'required',
        type: 'string',
        example: 'ship',
      },
      {
        key: 'subtype',
        level: 'required',
        type: 'string',
        example: 'converted fishing vessel',
      },
      { key: 'notes', level: 'required', type: 'string' },
      {
        key: 'location',
        level: 'common',
        type: 'string',
        description: 'Home base / current port.',
      },
      { key: 'district', level: 'common', type: 'string or null' },
      {
        key: 'status',
        level: 'common',
        type: 'string',
        example: 'operational',
      },
      {
        key: 'ownership',
        level: 'common',
        type: 'string',
        description: 'Legal/practical ownership situation.',
      },
      {
        key: 'captain',
        level: 'occasional',
        type: 'string or null',
        when: ['ship'],
      },
      {
        key: 'crew_full / crew_current',
        level: 'occasional',
        type: 'int or null',
        when: ['ship'],
      },
      {
        key: 'crew',
        level: 'occasional',
        type: 'array of objects',
        when: ['ship'],
        description: '{ name, role, initMod? }',
      },
      {
        key: 'crew_notes',
        level: 'occasional',
        type: 'string',
        when: ['ship'],
      },
      { key: 'passengers', level: 'occasional', type: 'array/int/string/null' },
      { key: 'home_port', level: 'occasional', type: 'string or null' },
      { key: 'current_location', level: 'occasional', type: 'string or null' },
      {
        key: 'armament',
        level: 'occasional',
        type: 'string or null',
        when: ['ship'],
      },
      { key: 'cargo', level: 'occasional', type: 'string or null' },
      { key: 'condition', level: 'occasional', type: 'string or null' },
      { key: 'acquisition_cost', level: 'occasional', type: 'int or null' },
      {
        key: 'estimated_value_min / estimated_value_max',
        level: 'occasional',
        type: 'int',
      },
      { key: 'propulsion', level: 'occasional', type: 'string' },
      { key: 'hidden_compartment', level: 'occasional', type: 'string' },
      { key: 'furnishings_notes', level: 'occasional', type: 'string' },
      { key: 'hull', level: 'occasional', type: 'string' },
      { key: 'owned_by', level: 'occasional', type: 'string' },
    ],
  },
}

export const SCHEMA_ORDER = ['places', 'npcs', 'lore', 'party_items', 'assets']

// Flattened set of every known field key for a type, for the "unrecognized
// field" typo check — splits "a / b / c"-style combined keys into
// individual names since those are documentation shorthand, not real keys.
export function knownFieldKeys(schemaKey) {
  const schema = SCHEMAS[schemaKey]
  const keys = new Set()
  for (const f of schema.fields) {
    for (const part of f.key.split('/')) {
      keys.add(part.trim())
    }
  }
  return keys
}
