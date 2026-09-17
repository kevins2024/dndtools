<template>
  <div class="character-details">
    <!-- Tabs -->
    <div class="tab-bar">
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'sheet' }"
        @click="activeTab = 'sheet'"
      >
        Character Sheet
      </button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'equipment' }"
        @click="activeTab = 'equipment'"
      >
        Equipment
      </button>
      <button
        v-if="hasSpells"
        class="tab-btn"
        :class="{ active: activeTab === 'spellbook' }"
        @click="activeTab = 'spellbook'"
      >
        Spellbook
      </button>
      <button
        v-if="hasRelationships"
        class="tab-btn"
        :class="{ active: activeTab === 'relationships' }"
        @click="activeTab = 'relationships'"
      >
        Relationships
      </button>
      <button
        v-if="canLevelUp"
        class="tab-btn tab-btn--jump"
        title="Jump to the Level Up tool with this character selected"
        @click="goToLevelUp"
      >
        Level Up ↗
      </button>
      <button
        v-if="selected && selected.is_practice"
        class="tab-btn tab-btn--delete"
        title="Practice character — delete it permanently"
        @click="deletePracticeCharacter"
      >
        🗑 Delete
      </button>
    </div>

    <!-- Content -->
    <div class="tab-content">
      <template v-if="selected">
        <CharacterSheet v-if="activeTab === 'sheet'" :character="selected" />
        <CharacterInventory
          v-else-if="activeTab === 'equipment'"
          :character="selected"
        />
        <CharacterSpellbook
          v-else-if="activeTab === 'spellbook'"
          :character="selected"
        />
        <CharacterRelationships
          v-else-if="activeTab === 'relationships'"
          :character="selected"
        />
      </template>
      <div v-else class="empty-state">No character selected.</div>
    </div>
  </div>
</template>

<script>
import CharacterInventory from './CharacterInventory.vue'
import CharacterRelationships from './CharacterRelationships.vue'
import CharacterSheet from './CharacterSheet.vue'
import CharacterSpellbook from './CharacterSpellbook.vue'
import Editor from './Editor.vue'
import { characterHasSpells } from '@/utils/spellUtils.js'

export default {
  name: 'CharacterDetails',
  components: {
    CharacterInventory,
    CharacterRelationships,
    CharacterSheet,
    CharacterSpellbook,
    Editor,
  },

  props: {
    character: { type: Object, default: null },
    requestedTab: { type: String, default: null },
  },

  data() {
    return {
      activeTab: 'sheet',
    }
  },

  watch: {
    requestedTab: {
      immediate: true,
      handler(val) {
        if (val) this.activeTab = val
      },
    },
  },

  computed: {
    selected() {
      if (this.character) return this.character
      if (this.$store.state.selectedPlayers.length === 1) {
        const name = this.$store.state.selectedPlayers[0]
        return this.$store.state.characters.find((c) => c.name === name)
      }
      return null
    },
    partyItems() {
      return this.$store.state.party_items ?? []
    },
    hasSpells() {
      return characterHasSpells(
        this.selected,
        this.partyItems,
        this.$store.state.subclasses
      )
    },
    hasRelationships() {
      if (!this.selected) return false
      const key = this.selected.name.toLowerCase()
      return (this.$store.state.relationships ?? []).some((r) =>
        r.people.includes(key)
      )
    },
    // Mirrors LevelUpTool's own effectiveLevelCap check (level_cap_override
    // wins over the campaign-wide DM Settings cap) so this shortcut only
    // appears when there's actually a level to give.
    canLevelUp() {
      if (!this.selected) return false
      const cap =
        this.selected.level_cap_override ?? this.$store.state.level_cap
      return cap == null || this.selected.level < cap
    },
  },

  methods: {
    goToLevelUp() {
      this.$store.commit('NAV_TO_LEVEL_UP', this.selected.name)
    },
    // Practice characters (see NewCharacterTool's toggle) are the one case
    // where deleting a character outright is the point — a scratch build
    // meant to be leveled up a few times and thrown away, never a real
    // roster member. Gated on is_practice so this can never touch a real
    // character.
    deletePracticeCharacter() {
      if (!this.selected?.is_practice) return
      if (
        !window.confirm(
          `Delete practice character "${this.selected.name}" permanently? This can't be undone.`
        )
      )
        return
      const name = this.selected.name
      this.$store.commit('SET_TABLE', {
        table: 'characters',
        data: this.$store.state.characters.filter(
          (c) => c.id !== this.selected.id
        ),
      })
      // Whatever starting gear it picked up has no value once the
      // character's gone — leaving it behind would just be dead weight
      // sitting in party_items with an equipped_by/carried_by pointing at
      // nobody.
      this.$store.commit('SET_TABLE', {
        table: 'party_items',
        data: this.partyItems.filter(
          (i) => i.equipped_by !== name && i.carried_by !== name
        ),
      })
    },
  },
}
</script>

<style scoped>
.character-details {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* ── Tabs ── */
.tab-bar {
  display: flex;
  border-bottom: 1px solid var(--color-border);
  background-color: var(--color-bg-panel-dark);
  flex-shrink: 0;
}

.tab-btn {
  padding: 0.6vh 1.2vw;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  font-family: var(--font-body);
  font-size: var(--font-size-lg);
  transition: all 0.15s ease;
}

.tab-btn:hover {
  color: var(--color-accent);
}

.tab-btn.active {
  color: var(--color-accent-strong);
  border-bottom-color: var(--color-accent);
}

/* Jumps to a different context entirely rather than swapping content in
   place — pushed to the far side and given its own color so it doesn't read
   as just another view of this same character. */
.tab-btn--jump {
  margin-left: auto;
  color: var(--color-accent);
}
.tab-btn--jump:hover {
  color: var(--color-accent-strong);
}

.tab-btn--delete {
  color: var(--color-text-danger, #c0392b);
}
.tab-btn--delete:hover {
  color: #e05a4a;
}

/* ── Content ── */
.tab-content {
  flex: 1;
  overflow-y: auto;
  padding: 1vh 1vw;
}
</style>
