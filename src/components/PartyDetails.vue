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
      <button @click="saveParty">Save as Party</button>
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
import dataService from '../utils/dataService'

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
      return this.$store.state.characters.filter((char) =>
        this.$store.state.selectedPlayers.includes(char.name)
      )
    },
  },
  methods: {
    saveParty() {
      dataService.saveSelectedPlayers(this.selectedPlayers.map((p) => p.name))
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
  background: var(--color-white);
  border: 1px solid var(--color-neutral);
  cursor: pointer;
}
.toggle-combat.active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: var(--color-white);
}
</style>
