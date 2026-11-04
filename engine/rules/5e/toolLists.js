// The tool categories of the 2024 rules and what is in each, for every place a tool is picked: a
// background's tool, a class's tool proficiencies, a feat (Musician, Crafter), a multiclass grant, and
// the starting equipment that names one.
//
// No fs/path (plain data), so browser code may use it.

const ARTISAN_TOOLS = [
  "Alchemist's Supplies",
  "Brewer's Supplies",
  "Calligrapher's Supplies",
  "Carpenter's Tools",
  "Cartographer's Tools",
  "Cobbler's Tools",
  "Cook's Utensils",
  "Glassblower's Tools",
  "Jeweler's Tools",
  "Leatherworker's Tools",
  "Mason's Tools",
  "Painter's Supplies",
  "Potter's Tools",
  "Smith's Tools",
  "Tinker's Tools",
  "Weaver's Tools",
  "Woodcarver's Tools",
]
const INSTRUMENTS = [
  'Bagpipes',
  'Drum',
  'Dulcimer',
  'Flute',
  'Horn',
  'Lute',
  'Lyre',
  'Pan Flute',
  'Shawm',
  'Viol',
]
const GAMING_SETS = [
  'Dice Set',
  'Dragonchess Set',
  'Playing Card Set',
  'Three-Dragon Ante Set',
]

// By the name the class and background data use for the category.
const TOOL_CATEGORIES = {
  "Artisan's Tools": ARTISAN_TOOLS,
  'Musical Instrument': INSTRUMENTS,
  'Gaming Set': GAMING_SETS,
}

// "thieves' tools" -> "Thieves' Tools" (data files keep some tool names lower case).
const toolName = (s) =>
  String(s).replace(/(^|\s)(\w)/g, (m, a, b) => a + b.toUpperCase())

module.exports = {
  ARTISAN_TOOLS,
  INSTRUMENTS,
  GAMING_SETS,
  TOOL_CATEGORIES,
  toolName,
}
