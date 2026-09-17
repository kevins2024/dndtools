<template>
  <div class="character-sheet" v-if="character">
    <div class="top-row">
      <VitalsSection :character="character" />
      <div class="chips-box">
        <VitalsChipRow :character="character" />
      </div>
      <div class="conditions-box">
        <ConditionsRow :character="character" />
      </div>
    </div>

    <AbilityScoreGrid :character="character" show-saving-throws />

    <template v-if="companion">
      <CompanionSummonStrip :character="character" />
      <CompanionPanel v-if="companion.summoned" :companion="companion" />
    </template>
    <FamiliarSummon v-else-if="knowsFindFamiliar" :character="character" />

    <div class="skills-box">
      <SkillList :character="character" />
    </div>

    <WeaponTable :character="character" @inspect="showPopup" />
    <BattleItemsPanel :character="character" @inspect="showPopup" />

    <ContentFilterRow v-if="someFeatures" v-model="featureFilter" />
    <FeaturePillsPanel
      :character="character"
      :filter="featureFilter"
      @inspect="showPopup"
    />

    <div class="resource-cluster">
      <ClassResourcesPanel :character="character" />
      <WeavePhaseSelector :character="character" />
    </div>

    <div class="flavor-grid">
      <LanguagesPanel :character="character" />
      <PersonalityPanel :character="character" />
      <ActiveEffectsPanel :character="character" />
      <NotesPanel :character="character" />
    </div>

    <AppearancePanel :character="character" />

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
import DetailPopup from '@/components/DetailPopup.vue'
import VitalsSection from '@/components/VitalsSection.vue'
import VitalsChipRow from '@/components/VitalsChipRow.vue'
import ConditionsRow from '@/components/ConditionsRow.vue'
import CompanionSummonStrip from '@/components/CompanionSummonStrip.vue'
import CompanionPanel from '@/components/CompanionPanel.vue'
import FamiliarSummon from '@/components/FamiliarSummon.vue'
import AbilityScoreGrid from '@/components/AbilityScoreGrid.vue'
import SkillList from '@/components/SkillList.vue'
import WeaponTable from '@/components/WeaponTable.vue'
import ContentFilterRow from '@/components/ContentFilterRow.vue'
import FeaturePillsPanel from '@/components/FeaturePillsPanel.vue'
import ClassResourcesPanel from '@/components/ClassResourcesPanel.vue'
import WeavePhaseSelector from '@/components/WeavePhaseSelector.vue'
import BattleItemsPanel from '@/components/BattleItemsPanel.vue'
import LanguagesPanel from '@/components/LanguagesPanel.vue'
import PersonalityPanel from '@/components/PersonalityPanel.vue'
import ActiveEffectsPanel from '@/components/ActiveEffectsPanel.vue'
import NotesPanel from '@/components/NotesPanel.vue'
import AppearancePanel from '@/components/AppearancePanel.vue'

// Thin composition of shared atoms — see CharacterCombatPanel.vue, which
// shares most of the same pieces for the compact combat view. No spell
// slots/spell-by-level pills here (same as before the split): the full spell
// list has its own home in the Spellbook tab.
//
// No portrait here — it lives in the character-select sidebar (CharacterContext.vue),
// viewable full-size via a magnify button on hover, so the sheet isn't stuck
// with a fixed-size image column when everyone's other details vary in length.
// Top row is three boxes: name/class/HP, AC/Speed/etc chips, conditions —
// the things referenced constantly. Full name moves down to sit with
// appearance (read occasionally, not during play) rather than crowding the
// name line, and ability scores get their own full-width section below.
export default {
  name: 'CharacterSheet',

  components: {
    DetailPopup,
    VitalsSection,
    VitalsChipRow,
    ConditionsRow,
    CompanionSummonStrip,
    CompanionPanel,
    FamiliarSummon,
    AbilityScoreGrid,
    SkillList,
    WeaponTable,
    ContentFilterRow,
    FeaturePillsPanel,
    ClassResourcesPanel,
    WeavePhaseSelector,
    BattleItemsPanel,
    LanguagesPanel,
    PersonalityPanel,
    ActiveEffectsPanel,
    NotesPanel,
    AppearancePanel,
  },

  props: {
    character: { type: Object, required: true },
  },

  data() {
    return {
      featureFilter: 'all',
      popupOpen: false,
      popupItem: null,
    }
  },

  computed: {
    companion() {
      return (
        (this.$store.state.companions ?? []).find(
          (c) => c.owner === this.character.name
        ) ?? null
      )
    },
    someFeatures() {
      return (this.character.features ?? []).some((f) => f.type !== 'feat')
    },
    // Find Familiar is the one spell that needs its own summon UI — everything
    // else granted by a spell is either instantaneous or already covered by
    // the existing companion/effects panels. Named exactly (not "familiar" in
    // general) since other spells could mention the word without granting one.
    knowsFindFamiliar() {
      // A Wizard's known spells live on their spellbook entry, not
      // character.spells directly, once they have spellbook_id — see
      // spellUtils.js's header comment.
      if (this.character.spellbook_id) {
        const spellbook = (this.$store.state.spellbooks ?? []).find(
          (sb) => sb.id === this.character.spellbook_id
        )
        return (spellbook?.spells ?? []).some(
          (s) => s.name.toLowerCase() === 'find familiar'
        )
      }
      return (this.character.spells ?? []).some(
        (s) => s.name.toLowerCase() === 'find familiar'
      )
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
.character-sheet {
  display: flex;
  flex-direction: column;
  gap: 1.2vh;
  padding: 1.5vh 1.5vw;
  color: var(--color-text);
  font-family: var(--font-body);
}

.top-row {
  display: flex;
  gap: 1.5vw;
  align-items: stretch;
}

.chips-box {
  flex: 0 0 430px;
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 0.8rem 1rem;
}

.conditions-box {
  flex: 0 0 265px;
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 0.8rem 1rem;
}

.skills-box {
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 0.6rem 0.8rem;
}

/* These sections used to each claim a full-width row regardless of how
   little content they held — the main source of the dead space in the old
   layout. Letting them share a row when there's room fixes that without
   forcing a rigid grid on content that varies a lot in length. */
.resource-cluster {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 0.8rem 1.5rem;
}

.flavor-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 0.8rem 1.5rem;
}
</style>
