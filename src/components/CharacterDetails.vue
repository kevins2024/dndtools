<template>
  <div class="stub-panel">
    <h3>Character Details</h3>
    <p>
      Component coming soon {{ this.$store.state.selectedPlayers[0]?.name }}
    </p>
  </div>
</template>
<script>
export default { name: 'CharacterDetails' }
</script>
