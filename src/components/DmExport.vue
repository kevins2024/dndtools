<template>
  <div class="dm-export">
    <div class="dm-header">
      <h3 class="dm-title">DM Export</h3>
      <p class="dm-desc">
        Tick what a DM should see and copy it as JSON. Picking a party includes
        its members; a character picked twice is written once.
      </p>
    </div>

    <div class="dm-toggles">
      <label v-for="t in toggles" :key="t.key" class="dm-toggle">
        <input v-model="include[t.key]" type="checkbox" />
        {{ t.label }}
      </label>
    </div>

    <div class="dm-lists scrollable">
      <PickList
        v-for="list in lists"
        :key="list.key"
        v-model="selection[list.key]"
        :title="list.title"
        :items="list.items"
      />
    </div>

    <div class="dm-footer">
      <div class="dm-summary">
        <span v-for="s in summary" :key="s.label" class="dm-chip"
          >{{ s.count }} {{ s.label }}</span
        >
        <span v-if="!summary.length" class="dm-hint">Nothing selected.</span>
      </div>
      <div class="dm-actions">
        <span class="dm-size">{{ sizeLabel }}</span>
        <button
          class="action-btn action-btn--primary"
          :class="{ 'action-btn--done': copied }"
          :disabled="!summary.length"
          @click="copyJson"
        >
          {{ copied ? '✓ Copied' : 'Copy JSON' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import PickList from './PickList.vue'
import houseRules from '@/data/house_rules.json'
import religions from '@/data/religions.json'
import { buildExport } from '@/utils/dmExport.js'

const STORAGE_KEY = 'dmExport.v1'

const emptySelection = () => ({
  partiesAndCharacters: [],
  npcs: [],
  locations: [],
  religions: [],
  lore: [],
  assets: [],
  houseRules: [],
  features: [],
  spells: [],
  monsters: [],
  items: [],
})

const defaultInclude = () => ({
  date: true,
  purse: true,
  characterItems: true,
  partyItems: true,
  relationships: true,
})

export default {
  name: 'DmExport',

  components: { PickList },

  data() {
    return {
      selection: emptySelection(),
      include: defaultInclude(),
      copied: false,
      toggles: [
        { key: 'date', label: 'Date' },
        { key: 'purse', label: 'Party purse' },
        { key: 'characterItems', label: 'Character items' },
        { key: 'partyItems', label: 'Party items' },
        { key: 'relationships', label: 'Relationships' },
      ],
      // Loaded lazily: these are large files, only needed on this screen.
      homebrewFeatures: [],
      homebrewSpells: [],
      homebrewMonsters: [],
      homebrewItems: [],
    }
  },

  computed: {
    store() {
      return this.$store.state
    },

    lists() {
      const s = this.store
      const hint = (...parts) => parts.filter(Boolean).join(' · ')
      return [
        {
          key: 'partiesAndCharacters',
          title: 'Parties & characters',
          items: [
            ...(s.parties ?? []).map((p) => ({
              key: `party:${p.id}`,
              label: p.name,
              hint: hint(
                'party',
                `${(p.members ?? []).length} members`,
                p.inactive ? 'held' : ''
              ),
            })),
            ...(s.characters ?? []).map((c) => ({
              key: `character:${c.name}`,
              label: c.name,
              hint: 'character',
            })),
          ],
        },
        {
          key: 'npcs',
          title: 'NPCs',
          items: (s.npcs ?? []).map((n) => ({
            key: n.name,
            label: n.name,
            hint: n.role,
          })),
        },
        {
          key: 'locations',
          title: 'Locations',
          items: (s.places ?? []).map((p) => ({
            key: p.name,
            label: p.name,
            hint: p.type,
          })),
        },
        {
          key: 'religions',
          title: 'Religions',
          items: religions.map((r) => ({
            key: r.name,
            label: r.name,
            hint: r.domain,
          })),
        },
        {
          key: 'lore',
          title: 'Lore',
          items: (s.lore ?? []).map((l) => ({
            key: l.id,
            label: l.title || l.name || l.id,
            hint: l.type,
          })),
        },
        {
          key: 'assets',
          title: 'Assets',
          items: (s.assets ?? []).map((a) => ({
            key: a.name,
            label: a.name,
            hint: a.subtype,
          })),
        },
        {
          key: 'houseRules',
          title: 'House rules',
          items: houseRules.map((r) => ({ key: r.name, label: r.name })),
        },
        {
          key: 'features',
          title: 'Homebrew features',
          items: this.homebrewFeatures.map((f) => ({
            key: f.id,
            label: f.name,
            hint: f.category,
          })),
        },
        {
          key: 'spells',
          title: 'Homebrew spells',
          items: this.homebrewSpells.map((sp) => ({
            key: sp.name,
            label: sp.name,
          })),
        },
        {
          key: 'monsters',
          title: 'Homebrew monsters',
          items: this.homebrewMonsters.map((m) => ({
            key: m.name,
            label: m.name,
          })),
        },
        {
          key: 'items',
          title: 'Campaign items',
          items: this.homebrewItems.map((i) => ({
            key: i.id,
            label: i.name,
            hint: i.category,
          })),
        },
      ]
    },

    // The picks as the engine's buildExport wants them.
    engineSelection() {
      const keys = this.selection.partiesAndCharacters
      const after = (prefix) =>
        keys
          .filter((k) => k.startsWith(prefix))
          .map((k) => k.slice(prefix.length))
      return {
        partyIds: after('party:'),
        characterNames: after('character:'),
        npcNames: this.selection.npcs,
        locationNames: this.selection.locations,
        religionNames: this.selection.religions,
        loreIds: this.selection.lore,
        assetNames: this.selection.assets,
        houseRuleNames: this.selection.houseRules,
        featureIds: this.selection.features,
        spellNames: this.selection.spells,
        monsterNames: this.selection.monsters,
        itemIds: this.selection.items,
        include: this.include,
      }
    },

    payload() {
      const s = this.store
      return buildExport(
        this.engineSelection,
        {
          parties: s.parties,
          characters: s.characters,
          party_items: s.party_items,
          npcs: s.npcs,
          places: s.places,
          religions,
          lore: s.lore,
          assets: s.assets,
          house_rules: houseRules,
          features: this.homebrewFeatures,
          spells: this.homebrewSpells,
          monsters: this.homebrewMonsters,
          items: this.homebrewItems,
          relationships: s.relationships,
          finances: s.finances,
        },
        new Date().toISOString().slice(0, 10)
      )
    },

    // What actually ended up in the export, section by section.
    summary() {
      const p = this.payload
      const rows = [
        ['parties', p.parties],
        ['characters', p.characters],
        ['character items', p.character_items],
        ['party items', p.party_items],
        ['NPCs', p.npcs],
        ['locations', p.locations],
        ['religions', p.religions],
        ['lore', p.lore],
        ['assets', p.assets],
        ['house rules', p.house_rules],
        ['homebrew features', p.homebrew?.features],
        ['homebrew spells', p.homebrew?.spells],
        ['homebrew monsters', p.homebrew?.monsters],
        ['campaign items', p.homebrew?.items],
        ['relationships', p.relationships],
      ]
        .filter(([, list]) => list?.length)
        .map(([label, list]) => ({ label, count: list.length }))
      if (p.date) rows.push({ label: 'date', count: 1 })
      if (p.party_purse) rows.push({ label: 'purse', count: 1 })
      return rows
    },

    sizeLabel() {
      const kb = JSON.stringify(this.payload, null, 2).length / 1024
      return kb < 1 ? '< 1 KB' : `${kb.toFixed(kb < 10 ? 1 : 0)} KB`
    },
  },

  watch: {
    selection: { deep: true, handler: 'persist' },
    include: { deep: true, handler: 'persist' },
  },

  created() {
    this.restore()
    import('@/data/published_features.json').then((mod) => {
      this.homebrewFeatures = (mod.default ?? mod).filter((f) => f.homebrew)
    })
    import('@/data/published_spells.json').then((mod) => {
      this.homebrewSpells = (mod.default ?? mod).filter((s) => s.homebrew)
    })
    import('@/data/published_monsters.json').then((mod) => {
      this.homebrewMonsters = (mod.default ?? mod).filter((m) => m.homebrew)
    })
    fetch('/api/engine/item-catalog')
      .then((r) => (r.ok ? r.json() : []))
      .then((list) => {
        this.homebrewItems = list.filter((i) => i.library === 'campaign')
      })
      .catch(() => {})
  },

  methods: {
    // Remembered per browser only; a viewing convenience, not campaign data.
    persist() {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ selection: this.selection, include: this.include })
        )
      } catch {
        // Storage blocked — the screen works, it just forgets.
      }
    },

    restore() {
      try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
        if (!saved) return
        this.selection = { ...emptySelection(), ...saved.selection }
        this.include = { ...defaultInclude(), ...saved.include }
      } catch {
        // Nothing usable saved; start with the defaults.
      }
    },

    copyJson() {
      navigator.clipboard.writeText(JSON.stringify(this.payload, null, 2))
      this.copied = true
      setTimeout(() => {
        this.copied = false
      }, 1800)
    },
  },
}
</script>

<style scoped>
.dm-export {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  padding: 1rem 1.25rem;
  gap: 0.8rem;
}

.dm-header {
  flex-shrink: 0;
}

.dm-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--font-size-xl);
  color: var(--color-accent-strong);
}

.dm-desc {
  margin: 0.2rem 0 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-low);
}

.dm-toggles {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 1.2rem;
  flex-shrink: 0;
}

.dm-toggle {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: var(--font-size-md);
  color: var(--color-text);
  cursor: pointer;
}
.dm-toggle input {
  accent-color: var(--color-accent);
}

.dm-lists {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 0.7rem;
  align-content: start;
}

.dm-footer {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding-top: 0.6rem;
  border-top: 1px solid var(--color-border);
}

.dm-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  min-width: 0;
}

.dm-chip {
  padding: 0.05rem 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.dm-hint {
  font-size: var(--font-size-sm);
  color: var(--color-text-low);
  font-style: italic;
}

.dm-actions {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  flex-shrink: 0;
}

.dm-size {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
}

.action-btn {
  padding: 0.45rem 1.2rem;
  background: none;
  border: 1px solid var(--color-accent);
  border-radius: 6px;
  color: var(--color-accent);
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  cursor: pointer;
  transition: all 0.15s ease;
}
.action-btn:hover:not(:disabled) {
  color: white;
  background: var(--color-accent);
}
.action-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.action-btn--done {
  color: white;
  background: var(--color-accent);
}
</style>
