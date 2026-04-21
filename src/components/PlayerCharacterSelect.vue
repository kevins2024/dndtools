<template>
  <div class="player-select">
    <div
      v-for="player in availablePlayers"
      :key="player.name"
      class="player-card"
      title="Add to combat"
      @click="addToCombat(player)"
    >
      <div
        class="player-img"
        :style="{ backgroundImage: `url(${player.image})` }"
      ></div>
      <div class="player-name">{{ player.name }}</div>
    </div>
    <div v-if="availablePlayers.length === 0" class="bench-empty">
      All players on-deck
    </div>
  </div>
</template>

<script>
import players from '@/data/characters.json'

export default {
  name: 'PlayerCharacterSelect',

  data() {
    return { players }
  },

  computed: {
    inCombat() {
      return this.$store.state.selectedPlayers
    },
    availablePlayers() {
      return this.players.filter((p) => !this.inCombat.includes(p.name))
    },
  },

  methods: {
    addToCombat(player) {
      this.$store.commit('SET_SELECTED_PLAYERS', [...this.inCombat, player.name])
    },
  },
}
</script>

<style scoped>
.player-select {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
}

.player-card {
  width: 88%;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.15s ease;
}

.player-card:hover {
  border-color: var(--color-accent);
}

.player-img {
  width: 100%;
  aspect-ratio: 13 / 16;
  background-position: 50% 0%;
  background-repeat: no-repeat;
  background-size: cover;
}

.player-name {
  padding: 4px 6px;
  text-align: center;
  font-size: var(--font-size-tiny);
  color: var(--color-text-muted);
  background: var(--color-bg-panel);
  border-top: 1px solid var(--color-border);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.player-card:hover .player-name {
  color: var(--color-accent);
}

.bench-empty {
  color: var(--color-text-low);
  font-size: var(--font-size-tiny);
  text-align: center;
  padding: 1rem 0.5rem;
}
</style>
