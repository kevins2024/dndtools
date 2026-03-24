<template>
  <div class="player-select">
    <div v-for="player in players" :key="player.name" class="player-card">
      <div
        class="player-img"
        :style="{ backgroundImage: `url(${player.image})` }"
      ></div>
      <h3>{{ player.name }}</h3>
      <input
        type="checkbox"
        class="player-checkbox"
        :checked="isSelected(player)"
        @click.stop
        @change="toggleSelect(player)"
      />
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
        ? this.selected.filter((name) => name !== player.name)
        : [...this.selected, player.name]
      this.$store.commit('SET_SELECTED_PLAYERS', updated)
    },
    isSelected(player) {
      return this.selected.includes(player.name)
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
  position: relative;
}

.player-checkbox {
  position: absolute;
  bottom: 8px;
  left: 8px;
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: gold; /* matches your selected border color */
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
