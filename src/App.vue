<template>
  <div>Empty template</div>
</template>

<script>
import dataService from './dataService';

export default {
  name: 'App',
  data() {
    return {
      characters: [],
      npcs: [],
      locations: []
    };
  },
  async created() {
    this.characters = await dataService.get('characters');
    this.npcs = await dataService.get('npcs');
    this.locations = await dataService.get('locations');
  }
};
</script>

<style>
/* Blank white page */
body, html, #app, div {
  background: #fff;
  min-height: 100vh;
  margin: 0;
}
</style>
