<template>
  <div class="player-select">
    <div v-for="player in players" :key="player.name" class="player-card">
      <!-- <img :src="player.image" class="player-img" /> -->
      <div class="player-img"></div>
      <p class="player-name">{{ player.name }}</p>
      <input
        type="checkbox"
        :id="player.name"
        :value="player.name"
        v-model="selected"
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
      selected: [],
    }
  },
}
</script>

<style>
.player-select {
  display: flex;
  flex-direction: column;
  gap: 1vh;
  width: 100%;
}

.player-card {
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-rows: auto auto;
  align-items: center;
  gap: 0.4vh 0.4vw;
}

.player-img {
  grid-column: 1;
  grid-row: 1;
  width: 80%;
  max-height: 240px;
  border: 1px solid black;
  aspect-ratio: 1 / 1;
  object-fit: cover;
}

.player-name {
  grid-column: 1;
  grid-row: 2;
  margin: 0;
  text-align: center;
  font-size: 0.85vw;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

input[type='checkbox'] {
  grid-column: 2;
  grid-row: 1 / 3;
  align-self: center;
  width: 1vw;
  height: 1vw;
  min-width: 14px;
  min-height: 14px;
  cursor: pointer;
}
</style>
