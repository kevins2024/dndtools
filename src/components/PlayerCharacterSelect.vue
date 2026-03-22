<template>
  <div class="player-select">
    <div
      v-for="player in players"
      :key="player.name"
      class="player-card"
      :class="{ selected: isSelected(player) }"
      @click="toggleSelect(player)"
    >
      <div
        class="player-img"
        :style="{ backgroundImage: `url(${player.image})` }"
      ></div>
      <h3>{{ player.name }}</h3>
    </div>
  </div>
</template>

<script>
import players from '@/data/characters.json'

export default {
  name: 'PlayerCharacterSelect',

  data() {
    return {
      players,
    }
  },
  computed: {
    selected() {
      return this.$store.state.selectedPlayers
    },
  },
  methods: {
    toggleSelect(player) {
      const updated = this.isSelected(player)
        ? this.selected.filter((p) => p !== player)
        : [...this.selected, player]
      this.$store.commit('SET_SELECTED_PLAYERS', updated)
    },
    isSelected(player) {
      return this.selected.includes(player)
    },
  },
}
</script>

<style>
.player-select {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.player-card {
  width: 84%;
  border: solid gray 1px;
  border-radius: 6px;
}
.player-card.selected {
  border: solid gold 1px;
}

.player-card h3 {
  margin: 8px;
  text-align: center;
}

.player-img {
  width: 100%;
  aspect-ratio: 13 / 16;
  background-position: 50% 0%;
  background-repeat: no-repeat;
  border-bottom: solid gray 1px;
}
</style>
