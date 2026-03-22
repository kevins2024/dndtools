<template>
  <div class="player-select">
    <div v-for="player in players" :key="player.name" class="player-card"></div>
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
  gap: 16px;
}

.player-card {
}
</style>
