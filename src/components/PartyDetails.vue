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
    temp() {},
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
