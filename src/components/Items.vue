<template>
  <div class="stub-panel">
    <h3>Items</h3>
    <button @click="migration">Run Migration</button>
    <button @click="toggleAddItem">
      {{ addItemOpen ? 'Close Adder' : 'Add Items' }}
    </button>
    <div class="item-add-container" v-if="addItemOpen">
      <textarea
        class="item-add-textbox"
        placeholder="Item JSON Here"
        v-model="newItemJSON"
      />
      <button @click="addItems">Add Items</button>
    </div>
    <div v-for="item in items" :key="item.id">
      <div
        @click="selectItem(item)"
        class="item-label"
        :class="{ selected: selectedItem === item.name }"
      >
        {{ item.name }}
      </div>
    </div>
  </div>
</template>
<script>
import dataService from '@/utils/dataService'

export default {
  name: 'Items',
  data() {
    return {
      addItemOpen: false,
      newItemJSON: '[]',
    }
  },
  methods: {
    toggleAddItem() {
      this.addItemOpen = !this.addItemOpen
    },
    selectItem(item) {
      this.$store.commit('SET_SELECTED_ITEM', item.name)
    },
    addItems() {
      try {
        const itemsToAdd = JSON.parse(this.newItemJSON)
        if (Array.isArray(itemsToAdd)) {
          itemsToAdd.forEach((item) =>
            this.$store.commit('ADD_PARTY_ITEM', item)
          )
        } else {
          this.$store.commit('ADD_PARTY_ITEM', itemsToAdd)
        }
        this.newItemJSON = ''
      } catch (error) {
        console.error('Invalid JSON:', error)
      }
    },
    save() {
      this.$store.dispatch('save', 'party_items')
      console.log('Saving items!')
    },
    async migration() {
      // migration2.js
      // Second migration pass — flattens and restructures all data files
      // Run as a method in a Vue component, wired to a button
      // Requires: dataService imported in the component
      //
      // What this does:
      // 1. Characters — flatten stats, hp, personality, ac_base removal,
      //                 restructure features/maneuvers into flat feature objects
      // 2. Party items — no structural changes needed, already flat enough
      // 3. NPCs — flatten stats where present, personality if present
      //
      // Does NOT touch: relationships, active_effects, spells (already handled or correct shape)

      console.log('=== Migration 2 started ===')

      // ── Load ──────────────────────────────────────────────
      const characters = await dataService.get('characters')
      const npcs = await dataService.get('npcs')
      const partyItems = await dataService.get('party_items')

      // ─────────────────────────────────────────────────────
      // HELPERS
      // ─────────────────────────────────────────────────────

      // Converts a features array of strings into flat feature objects
      function structureFeatures(features = [], type = 'feature') {
        return features.map((f) => {
          if (typeof f === 'string') {
            return {
              name: f,
              type,
              action_type: null,
              recharge: null,
              uses_max: null,
              uses_current: null,
            }
          }
          // Already an object — ensure all fields present
          return {
            name: f.name ?? f,
            type: f.type ?? type,
            action_type: f.action_type ?? null,
            recharge: f.recharge ?? null,
            uses_max: f.uses_max ?? null,
            uses_current: f.uses_current ?? null,
          }
        })
      }

      // Converts a spells object or array into flat spell objects
      function structureSpells(spells) {
        if (!spells) return []
        // Already an array of flat objects — ensure shape
        if (Array.isArray(spells)) {
          return spells.map((s) => {
            if (typeof s === 'string') {
              return { name: s, level: null, prepared: true, type: 'prepared' }
            }
            return {
              name: s.name ?? s,
              level: s.level ?? null,
              prepared: s.prepared ?? true,
              type: s.type ?? 'prepared',
            }
          })
        }
        // Object keyed by level (e.g. { cantrips: [], 1: [], prepared: [] })
        const result = []
        for (const [key, val] of Object.entries(spells)) {
          if (!Array.isArray(val)) continue
          const level =
            key === 'cantrips'
              ? 0
              : key === 'prepared'
              ? null
              : key === 'patron'
              ? null
              : key === 'chosen'
              ? null
              : key === 'magical_secrets'
              ? null
              : parseInt(key) || null
          const type =
            key === 'cantrips'
              ? 'cantrip'
              : key === 'patron'
              ? 'patron'
              : key === 'chosen'
              ? 'chosen'
              : key === 'magical_secrets'
              ? 'magical_secret'
              : 'prepared'
          for (const spell of val) {
            if (typeof spell === 'string') {
              result.push({ name: spell, level, prepared: true, type })
            } else if (spell?.name) {
              result.push({
                name: spell.name,
                level: spell.level ?? level,
                prepared: spell.prepared ?? true,
                type: spell.type ?? type,
              })
            }
          }
        }
        return result
      }

      // Flatten stats object to stat_str, stat_dex etc
      function flattenStats(stats) {
        if (!stats) return {}
        const result = {}
        const keys = ['str', 'dex', 'con', 'int', 'wis', 'cha']
        for (const key of keys) {
          if (stats[key] !== undefined && stats[key] !== null) {
            result[`stat_${key}`] = stats[key]
          }
        }
        return result
      }

      // Flatten hp object
      function flattenHP(hp) {
        if (!hp) return {}
        return {
          hp_max: hp.max ?? null,
          hp_current: hp.current ?? null,
        }
      }

      // Flatten personality object
      function flattenPersonality(personality) {
        if (!personality) return {}
        if (typeof personality === 'string') {
          return { personality_traits: personality, personality_quirks: null }
        }
        return {
          personality_traits: personality.traits ?? null,
          personality_quirks: personality.quirks ?? null,
        }
      }

      // ─────────────────────────────────────────────────────
      // STEP 1 — Restructure characters
      // ─────────────────────────────────────────────────────
      console.log('\nStep 1: Restructuring characters...')

      const migratedCharacters = characters.map((character) => {
        console.log(`  Processing ${character.name}`)

        // Start with a clean object, preserve all scalar fields
        const c = {}

        // Scalars — pass through directly
        const scalarFields = [
          'name',
          'full_name',
          'race',
          'class',
          'subclass',
          'level',
          'alignment',
          'appearance',
          'image',
          'proficiency_bonus',
          'spellcasting_ability',
          'unarmored_ac_formula',
          'notes',
          'spell_save_dc',
          'spell_attack_bonus',
          'spell_recovery',
        ]
        for (const field of scalarFields) {
          if (character[field] !== undefined) c[field] = character[field]
        }

        // Flatten stats
        Object.assign(c, flattenStats(character.stats))

        // Flatten hp
        Object.assign(c, flattenHP(character.hp))

        // Flatten personality
        Object.assign(c, flattenPersonality(character.personality))

        // unarmored_ac_formula — default if not present
        if (!c.unarmored_ac_formula) {
          c.unarmored_ac_formula = 'default'
        }

        // Remove ac_base entirely — armor now lives in party_items
        // ac_base.armor_type was the only useful field — we no longer need it
        // on the character since party_items has armor_type on the armor item

        // Saving throws — keep as array of strings, already correct
        c.saving_throws = character.saving_throws ?? []

        // Skill proficiencies — keep as array of strings
        c.skill_proficiencies = character.skill_proficiencies ?? []

        // Expertise — keep as array of strings
        c.expertise = character.expertise ?? []

        // Languages — keep as array of strings
        c.languages = character.languages ?? []

        // Features — merge features and maneuvers into structured array
        const features = structureFeatures(character.features ?? [], 'feature')
        const maneuvers = structureFeatures(
          character.maneuvers ?? [],
          'maneuver'
        )
        c.features = [...features, ...maneuvers]

        // Spells — restructure into flat array
        c.spells = structureSpells(character.spells ?? null)

        // Totem spirits — keep as array of flat objects if present
        if (character.totem_spirits) c.totem_spirits = character.totem_spirits

        // Spell slots — keep if present
        if (character.spell_slots) c.spell_slots = character.spell_slots

        // Relationships — keep as-is, already flat objects
        c.relationships = character.relationships ?? []

        // Active effects — keep as-is
        c.active_effects = character.active_effects ?? []

        // Combat block for NPCs-as-characters — keep if present
        if (character.combat) c.combat = character.combat

        return c
      })

      // ─────────────────────────────────────────────────────
      // STEP 2 — Restructure NPCs
      // ─────────────────────────────────────────────────────
      console.log('\nStep 2: Restructuring NPCs...')

      const migratedNPCs = npcs.map((npc) => {
        console.log(`  Processing ${npc.name}`)

        const n = {}

        // Scalars
        const scalarFields = [
          'name',
          'location',
          'faction',
          'role',
          'appearance',
          'notes',
        ]
        for (const field of scalarFields) {
          if (npc[field] !== undefined) n[field] = npc[field]
        }

        // Status — should already be array from migration 1
        n.status = Array.isArray(npc.status)
          ? npc.status
          : [npc.status].filter(Boolean)

        // Flatten stats where present — omit nulls
        Object.assign(n, flattenStats(npc.stats))

        // Flatten personality if present
        Object.assign(n, flattenPersonality(npc.personality))

        // Combat block — keep as flat as possible
        if (npc.combat) {
          n.combat_class = npc.combat.class ?? null
          n.combat_level = npc.combat.level ?? null
          n.combat_notes = npc.combat.notes ?? null
          if (npc.combat.features) {
            n.combat_features = npc.combat.features
          }
        }

        // Relationships — keep as-is
        n.relationships = npc.relationships ?? []

        // Items — NPCs keep their own items array
        if (npc.items && npc.items.length > 0) n.items = npc.items

        return n
      })

      // ─────────────────────────────────────────────────────
      // STEP 3 — Party items — verify shape, no structural changes
      // ─────────────────────────────────────────────────────
      console.log('\nStep 3: Verifying party items...')

      const migratedPartyItems = partyItems
        .map((item) => {
          // Flatten charges if still nested
          if (item.charges && typeof item.charges === 'object') {
            return {
              ...item,
              charges_current: item.charges.current ?? null,
              charges_max: item.charges.max ?? null,
              charges_recharge: item.charges.recharge ?? null,
              charges_label: item.charges.label ?? null,
              charges_unit: item.charges.unit ?? null,
              charges: undefined, // remove nested object
            }
          }
          return item
        })
        .map((item) => {
          // Clean up undefined values
          const cleaned = {}
          for (const [k, v] of Object.entries(item)) {
            if (v !== undefined) cleaned[k] = v
          }
          return cleaned
        })

      console.log(`  Processed ${migratedPartyItems.length} items`)

      // ─────────────────────────────────────────────────────
      // SAVE
      // ─────────────────────────────────────────────────────
      console.log('\nSaving...')
      await dataService.save('characters', migratedCharacters)
      await dataService.save('npcs', migratedNPCs)
      await dataService.save('party_items', migratedPartyItems)

      console.log('=== Migration 2 complete ===')
      console.log('Check .backups/ folder for pre-migration copies.')
    },
  },
  computed: {
    items() {
      return this.$store.state.party_items || []
    },
    selectedItem() {
      return this.$store.state.selectedItem
    },
  },
}
</script>
<style scoped>
.item-add-container {
  margin: 8px 0;
}
.item-add-textbox {
  width: 98%;
  height: 80px;
  margin-bottom: 4px;
}
.item-label {
  cursor: pointer;
  padding: 4px;
}
.selected {
  font-weight: bold;
}
</style>
