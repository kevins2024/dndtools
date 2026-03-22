<template>
  <div class="player-select">
    <!-- <img
      class="player-img"
      src="https://iili.io/q8iJoiv.jpg"
      alt="q8iJoiv.jpg"
      border="0"
    /> -->
    <div v-for="player in players" :key="player.name" class="player-card">
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
      selected: [],
    }
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

.player-card h3 {
  margin: 8px;
  text-align: center;
}

.player-img {
  width: 100%;
  aspect-ratio: 13 / 16;
  background-position: 50% 0%;
  background-repeat: no-repeat;
  border: solid gray 1px;
  border-radius: 6px;
}
</style>
