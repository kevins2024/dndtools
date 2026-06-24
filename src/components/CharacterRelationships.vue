<template>
  <div class="char-rels">
    <div v-if="relationships.length" class="rel-list">
      <RelationshipCard
        v-for="rel in relationships"
        :key="rel.id"
        :relationship="rel"
        :display-names="[otherPerson(rel)]"
      />
    </div>
    <div v-else class="rel-empty">No relationships recorded.</div>
  </div>
</template>

<script>
import RelationshipCard from './RelationshipCard.vue'

export default {
  name: 'CharacterRelationships',
  components: { RelationshipCard },

  props: {
    character: { type: Object, required: true },
  },

  computed: {
    allPeople() {
      const map = {}
      ;[...this.$store.state.characters, ...this.$store.state.npcs].forEach(
        (e) => {
          if (e.name) map[e.name.toLowerCase()] = e.name
        }
      )
      return map
    },

    relationships() {
      const key = this.character.name.toLowerCase()
      return (this.$store.state.relationships ?? []).filter((r) =>
        r.people.includes(key)
      )
    },
  },

  methods: {
    otherPerson(rel) {
      const key = this.character.name.toLowerCase()
      const other = rel.people.find((p) => p !== key) ?? rel.people[0]
      return (
        this.allPeople[other.toLowerCase()] ??
        other.replace(/\b\w/g, (c) => c.toUpperCase())
      )
    },
  },
}
</script>

<style scoped>
.char-rels {
  display: flex;
  flex-direction: column;
  gap: 0.8vh;
}

.rel-list {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.8vh 1vw;
  align-content: start;
}

.rel-empty {
  color: var(--color-text-low);
  font-size: var(--font-size-base);
  padding: 2vh 0;
  text-align: center;
}
</style>
