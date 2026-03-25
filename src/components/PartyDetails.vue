<template>
  <div class="stub-panel">
    <!-- <div v-for="player in this.selectedPlayers" :key="player.name">
      <h3>{{ player.name }}</h3>
      <p>Level: {{ player.level }}</p>
      <p>Class: {{ player.class }}</p>
    </div> -->
    <button @click="rollInitiative">Roll Initiative</button>
    <button @click="temp">run the script</button>
    <div v-if="initiativeOrder.length">
      <h4>Initiative Order:</h4>
      <ol>
        <li v-for="entry in initiativeOrder" :key="entry.name">
          {{ entry.name }} - Initiative: {{ entry.initiative }}
        </li>
      </ol>
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
  },
}
</script>
