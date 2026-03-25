<template>
  <div class="stub-panel">
    <button
      class="toggle-combat"
      :class="{ active: inCombat }"
      @click="toggleCombat"
    >
      {{ inCombat ? 'Exit Combat' : 'Enter Combat' }}
    </button>
    <div v-if="inCombat">
      <button @click="rollInitiative">Roll Initiative</button>
      <div v-if="initiativeOrder.length">
        <h4>Initiative Order:</h4>
        <ol>
          <li v-for="entry in initiativeOrder" :key="entry.name">
            {{ entry.name }} - Initiative: {{ entry.initiative }}
          </li>
        </ol>
      </div>
    </div>
    <div v-else>
      <button @click="runMigration">Run Data Migration</button>
      <div v-for="player in this.selectedPlayers" :key="player.name">
        <h3>{{ player.name }}</h3>
        <p>Level: {{ player.level }}</p>
        <p>Class: {{ player.class }}</p>
      </div>
    </div>
  </div>
</template>
<script>
import { dnd } from '../utils/dnd_utils'

import dataService from '@/services/dataService'

export default {
  name: 'PartyDetails',
  data() {
    return {
      initiativeOrder: [],
      inCombat: false,
    }
  },
  computed: {
    selectedPlayers() {
      return this.$store.state.selectedPlayers
    },
  },
  methods: {
    async runMigration() {
      console.log('=== Migration started ===')

      // ── Load ──────────────────────────────────────────────
      const characters = await dataService.get('characters')
      const partyItems = await dataService.get('party_items')

      // ── Step 1: Move character items into party_items ─────
      console.log('Step 1: Moving character items into party_items...')
      for (const character of characters) {
        if (!character.items || character.items.length === 0) continue
        console.log(
          `  Processing ${character.name} (${character.items.length} items)`
        )

        for (const item of character.items) {
          const duplicate = partyItems.find(
            (i) => i.name.toLowerCase() === item.name.toLowerCase()
          )

          if (duplicate) {
            // Already exists in party_items — just make sure equipped_by is set
            if (!duplicate.equipped_by) {
              duplicate.equipped_by = character.name
              console.log(`    ~ Updated equipped_by on existing: ${item.name}`)
            } else {
              console.log(`    - Skipped duplicate: ${item.name}`)
            }
            continue
          }

          // Build the new party_items entry
          const newItem = {
            name: item.name,
            type: item.type ?? 'misc',
            equipped_by: character.name,
            carried_by: null,
            attuned: item.attuned ?? false,
          }

          // Carry over all mechanical and descriptive fields
          const fields = [
            'weapon_type',
            'finesse',
            'damage_dice',
            'magic_bonus',
            'stat_bonuses',
            'stat_overrides',
            'charges',
            'quantity',
            'effect',
            'flavor',
            'description',
            'notes',
          ]
          for (const field of fields) {
            if (item[field] !== undefined) newItem[field] = item[field]
          }

          partyItems.push(newItem)
          console.log(`    + Added: ${item.name}`)
        }
      }

      // ── Step 2: Remove items array from characters ────────
      console.log('Step 2: Removing items arrays from characters...')
      for (const character of characters) {
        if (character.items) {
          delete character.items
          console.log(`  Removed items from ${character.name}`)
        }
      }

      // ── Step 3: Convert NPC status strings to arrays ──────
      console.log('Step 3: Converting NPC status to arrays...')
      const npcs = await dataService.get('npcs')
      let statusCount = 0
      for (const npc of npcs) {
        if (typeof npc.status === 'string') {
          npc.status = [npc.status]
          statusCount++
        } else if (!Array.isArray(npc.status)) {
          npc.status = []
          console.log(`  ! ${npc.name} had no status — set to []`)
        }
      }
      console.log(`  Converted ${statusCount} status fields`)

      // ── Step 4: Add active_effects to characters ──────────
      console.log('Step 4: Adding active_effects to characters...')
      let effectsCount = 0
      for (const character of characters) {
        if (!character.active_effects) {
          character.active_effects = []
          effectsCount++
        }
      }
      console.log(`  Added active_effects to ${effectsCount} characters`)

      // ── Step 5: Clean ac_base.notes from characters ───────
      console.log('Step 5: Cleaning ac_base.notes...')
      let notesCount = 0
      for (const character of characters) {
        if (character.ac_base?.notes) {
          delete character.ac_base.notes
          notesCount++
        }
      }
      console.log(`  Cleaned ${notesCount} ac_base.notes fields`)

      // ── Save ──────────────────────────────────────────────
      console.log('Saving...')
      await dataService.save('characters', characters)
      await dataService.save('party_items', partyItems)
      await dataService.save('npcs', npcs)

      console.log('=== Migration complete ===')
    },
    rollInitiative() {
      this.initiativeOrder = this.selectedPlayers
        .map((player) => {
          return {
            name: player.name,
            initiative: dnd.initiative(player) + dnd.roll(),
          }
        })
        .sort((a, b) => b.initiative - a.initiative)
    },
    toggleCombat() {
      this.inCombat = !this.inCombat
    },
  },
}
</script>
<style scoped>
.toggle-combat {
  background: white;
  border: 1px solid #ccc;
  cursor: pointer;
}
.toggle-combat.active {
  background: #4a90d9;
  border-color: #4a90d9;
  color: white;
}
</style>
