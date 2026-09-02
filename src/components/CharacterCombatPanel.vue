<template>
  <div class="combat-panel">
    <div class="vitals-cluster">
      <HpTracker :character="character" :table="table" />
      <VitalsChipRow :character="character" />
      <SavingThrowsPanel :character="character" />
    </div>
    <ConditionsRow
      :character="character"
      :table="table"
      @condition-changed="$emit('condition-changed', $event)"
    />

    <WeaponTable :character="character" @inspect="showPopup" />

    <ContentFilterRow v-if="hasFilterableContent" v-model="featureFilter" />
    <FeaturePillsPanel
      :character="character"
      :filter="featureFilter"
      @inspect="showPopup"
    />

    <div class="resource-cluster">
      <SpellSlotsTracker
        v-if="!hideSpells"
        :character="character"
        :table="table"
      />
      <ClassResourcesPanel :character="character" :table="table" />
      <WeavePhaseSelector :character="character" :table="table" />
    </div>
    <BattleItemsPanel :character="character" @inspect="showPopup" />
    <SpellPillsByLevel
      v-if="!hideSpells"
      :character="character"
      :filter="featureFilter"
      @inspect="showPopup"
    />

    <DetailPopup
      v-if="popupItem"
      :open="popupOpen"
      :readonly="true"
      :item="popupItem"
      @close="popupOpen = false"
    />
  </div>
</template>

<script>
import { getCharacterSpells } from '@/utils/spellUtils.js'
import DetailPopup from '@/components/DetailPopup.vue'
import HpTracker from '@/components/HpTracker.vue'
import VitalsChipRow from '@/components/VitalsChipRow.vue'
import SavingThrowsPanel from '@/components/SavingThrowsPanel.vue'
import ConditionsRow from '@/components/ConditionsRow.vue'
import WeaponTable from '@/components/WeaponTable.vue'
import ContentFilterRow from '@/components/ContentFilterRow.vue'
import FeaturePillsPanel from '@/components/FeaturePillsPanel.vue'
import SpellSlotsTracker from '@/components/SpellSlotsTracker.vue'
import ClassResourcesPanel from '@/components/ClassResourcesPanel.vue'
import WeavePhaseSelector from '@/components/WeavePhaseSelector.vue'
import BattleItemsPanel from '@/components/BattleItemsPanel.vue'
import SpellPillsByLevel from '@/components/SpellPillsByLevel.vue'

// This is now a thin composition of shared atoms (see the imports above) —
// the actual logic for each section lives in its own component so it can be
// reused across the full character sheet, this compact combat view, and a
// future Wild Shape view without copying anything.
export default {
  name: 'CharacterCombatPanel',

  components: {
    DetailPopup,
    HpTracker,
    VitalsChipRow,
    SavingThrowsPanel,
    ConditionsRow,
    WeaponTable,
    ContentFilterRow,
    FeaturePillsPanel,
    SpellSlotsTracker,
    ClassResourcesPanel,
    WeavePhaseSelector,
    BattleItemsPanel,
    SpellPillsByLevel,
  },

  props: {
    character: { type: Object, required: true },
    hideSpells: { type: Boolean, default: false },
    // Which store table `character` actually lives in — lets this panel be
    // reused for non-character combatants (e.g. companions) without their
    // condition/spell-slot/exhaustion edits leaking into state.characters.
    table: { type: String, default: 'characters' },
  },

  emits: ['condition-changed'],

  data() {
    return {
      featureFilter: 'all',
      popupOpen: false,
      popupItem: null,
    }
  },

  computed: {
    partyItems() {
      return this.$store.state.party_items ?? []
    },
    someFeatures() {
      return (this.character.features ?? []).some((f) => f.type !== 'feat')
    },
    hasFilterableContent() {
      return (
        this.someFeatures ||
        getCharacterSpells(
          this.character,
          this.partyItems,
          this.$store.state.subclasses
        ).length > 0
      )
    },
  },

  watch: {
    'character.id'() {
      this.featureFilter = 'all'
    },
  },

  methods: {
    showPopup(popupData) {
      this.popupItem = popupData
      this.popupOpen = true
    },
  },
}
</script>

<style scoped>
.combat-panel {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

/* Compact horizontal-strip atoms wrap onto shared rows instead of each
   claiming a full-width row of its own — that's the bulk of the dead
   space the old columnar layout had. */
.vitals-cluster,
.resource-cluster {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 0.8rem 1.5rem;
}
</style>
