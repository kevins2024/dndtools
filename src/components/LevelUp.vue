<template>
  <div class="lu-root">
    <div class="lu-select-row">
      <ScrollSelect
        v-model="selectedCharacterName"
        :options="characterOptions"
        placeholder="Choose a character…"
      />
      <select
        v-if="selectedCharacter"
        v-model="selectedClassName"
        class="lu-select"
      >
        <option
          v-for="c in selectedCharacter.classes"
          :key="c.name"
          :value="c.name"
        >
          {{ c.name }} {{ c.level }}
        </option>
        <option
          v-for="c in addableClasses"
          :key="'new-' + c.name"
          :value="c.name"
        >
          + Multiclass into {{ c.name }}
        </option>
      </select>
      <div v-if="selectedClassName" class="lu-badge">
        {{ currentLevel === 0 ? 'New class' : 'Level ' + currentLevel }} →
        {{ toLevel }}
      </div>
    </div>

    <PendingCharacterSaveBar
      :pending-names="pendingCharacterNames"
      :saving-name="savingName"
      :save-error="saveError"
      :just-saved="justSaved"
      @save-only="saveOnlyCharacter"
      @revert="revertCharacter"
      @save-all="saveChanges"
    />

    <div v-if="!selectedClassName" class="lu-empty">
      Choose a character to level up.
    </div>
    <div v-else-if="error" class="lu-error">{{ error }}</div>
    <div v-else-if="!preview" class="lu-empty">Computing…</div>
    <template v-else>
      <section class="lu-section">
        <h3>Hit points</h3>
        <div class="lu-hp">
          <button
            class="lu-btn"
            :class="{ active: hpMethod === 'average' }"
            :disabled="preview.hp.forcedMax"
            @click="setAverage"
          >
            Take average ({{ preview.hp.average }})
          </button>
          <button
            class="lu-btn"
            :class="{ active: hpMethod === 'roll' }"
            :disabled="preview.hp.forcedMax"
            @click="roll"
          >
            🎲 Roll d{{ preview.hp.die }}
          </button>
          <label>
            or enter a roll
            <input
              type="number"
              min="1"
              :max="preview.hp.die"
              :value="hpRoll || ''"
              :disabled="preview.hp.forcedMax"
              @change="setRoll($event.target.value)"
            />
          </label>
        </div>
        <p v-if="preview.hp.forcedMax" class="lu-note">
          The first level ever takes the maximum hit die.
        </p>
        <p class="lu-hp-result" :title="preview.hp.tooltip">
          +{{ preview.hp.gain }} HP
          <span
            v-for="l in preview.hp.breakdown"
            :key="l.label"
            class="lu-note"
          >
            · {{ l.label }} {{ l.amount >= 0 ? '+' : '' }}{{ l.amount }}</span
          >
        </p>
      </section>

      <div v-if="preview.blocked" class="lu-cap">{{ preview.blocked }}</div>
      <div v-if="preview.levelCap && preview.levelCap.exceeded" class="lu-cap">
        Party level cap is {{ preview.levelCap.cap }} — level {{ toLevel }} is
        above it.
        <label
          ><input v-model="ignoreLevelCap" type="checkbox" /> Level up
          anyway</label
        >
      </div>

      <section
        v-if="preview.newFeatures && preview.newFeatures.length"
        class="lu-section"
      >
        <h3>Gained this level</h3>
        <ul class="lu-features">
          <li v-for="f in preview.newFeatures" :key="f.id || f.name">
            {{ f.name }}
          </li>
        </ul>
      </section>

      <section v-if="preview.choices.length" class="lu-section">
        <h3>Choices</h3>
        <LevelUpChoices
          v-model="answers"
          :choices="preview.choices"
          @inspect-spell="inspectSpell"
        />
      </section>

      <ul
        v-if="preview.warnings && preview.warnings.length"
        class="lu-warnings"
      >
        <li v-for="w in preview.warnings" :key="w">{{ w }}</li>
      </ul>

      <div class="lu-confirm">
        <button
          class="lu-btn lu-btn--confirm"
          :disabled="
            !preview.complete ||
            loading ||
            blockedByCap ||
            Boolean(preview.blocked)
          "
          @click="confirm"
        >
          Confirm level {{ toLevel }}
        </button>
        <span v-if="!preview.complete" class="lu-note">
          {{ preview.choices.filter((c) => !c.answered).length }} choice(s)
          still open
        </span>
      </div>
    </template>
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
// The level-up tool that only displays what the engine says: POST /api/engine/level-up returns the
// questions (rendered by LevelUpChoices.vue), the hit-point explanation and the resulting patch;
// this component holds the character, the class, the HP method and the answers, and applies the
// engine's patch on confirm. No class, feature or spell rule lives here.
import PendingCharacterSaveBar from './PendingCharacterSaveBar.vue'
import ScrollSelect from './ScrollSelect.vue'
import LevelUpChoices from './LevelUpChoices.vue'
import DetailPopup from './DetailPopup.vue'
import pendingCharacterSaves from '@/mixins/pendingCharacterSaves'
import { buildSpellPopupData } from '@/utils/detailPopupBuilders.js'

export default {
  name: 'LevelUp',
  components: {
    PendingCharacterSaveBar,
    ScrollSelect,
    LevelUpChoices,
    DetailPopup,
  },
  mixins: [pendingCharacterSaves],
  data() {
    return {
      selectedCharacterName: null,
      selectedClassName: null,
      allClasses: [],
      draft: null,
      hpMethod: 'average',
      hpRoll: null,
      answers: {},
      preview: null,
      loading: false,
      error: null,
      requestId: 0,
      popupOpen: false,
      popupItem: null,
      ignoreLevelCap: false,
    }
  },
  computed: {
    characters() {
      return this.$store.state.characters.filter((c) => c.classes?.length)
    },
    characterOptions() {
      return this.characters.map((c) => ({ value: c.name, label: c.name }))
    },
    selectedCharacter() {
      return this.characters.find((c) => c.name === this.selectedCharacterName)
    },
    addableClasses() {
      const have = new Set(
        (this.selectedCharacter?.classes ?? []).map((c) => c.name)
      )
      return this.allClasses.filter((c) => !have.has(c.name))
    },
    currentLevel() {
      return (
        this.selectedCharacter?.classes.find(
          (c) => c.name === this.selectedClassName
        )?.level ?? 0
      )
    },
    toLevel() {
      return this.currentLevel + 1
    },
    // The party level cap (a campaign setting); a character may carry its own override.
    levelCap() {
      return (
        this.selectedCharacter?.level_cap_override ??
        this.$store.state.level_cap ??
        null
      )
    },
    blockedByCap() {
      return Boolean(this.preview?.levelCap?.exceeded) && !this.ignoreLevelCap
    },
  },
  watch: {
    selectedCharacterName() {
      this.selectedClassName = this.selectedCharacter?.classes[0]?.name ?? null
      this.restart()
    },
    selectedClassName() {
      this.restart()
    },
    hpMethod() {
      this.run()
    },
    hpRoll() {
      this.run()
    },
    answers: {
      deep: true,
      handler() {
        this.run()
      },
    },
  },
  async created() {
    try {
      const res = await fetch('/api/engine/classes')
      if (res.ok) this.allClasses = await res.json()
    } catch {
      // Multiclassing just is not offered if the class list cannot be fetched.
    }
  },
  methods: {
    async inspectSpell(spell) {
      this.popupItem = await buildSpellPopupData(spell)
      this.popupOpen = true
    },
    restart() {
      this.ignoreLevelCap = false
      this.answers = {}
      this.hpMethod = 'average'
      this.hpRoll = null
      this.preview = null
      this.error = null
      this.initDraft()
      this.run()
    },
    initDraft() {
      const c = this.selectedCharacter
      if (!c || !this.selectedClassName) {
        this.draft = null
        return
      }
      const draft = JSON.parse(JSON.stringify(c))
      // A class the character does not have yet starts as a level-0 placeholder.
      if (!draft.classes.some((k) => k.name === this.selectedClassName))
        draft.classes.push({
          name: this.selectedClassName,
          subclass: null,
          level: 0,
        })
      // A Wizard's known spells live on the shared spellbook, not on the character; the engine
      // needs them to avoid offering spells already known, so show them on the draft only.
      if (draft.spellbook_id) {
        const book = (this.$store.state.spellbooks ?? []).find(
          (b) => b.id === draft.spellbook_id
        )
        const prepared = new Set(draft.prepared_spells ?? [])
        draft.spells = (book?.spells ?? []).map((s) => ({
          name: s.name,
          level: s.level,
          prepared: prepared.has(s.name),
        }))
      }
      this.draft = draft
    },
    async run() {
      if (!this.draft || !this.selectedClassName) return
      const id = ++this.requestId
      this.loading = true
      try {
        const res = await fetch('/api/engine/level-up', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            character: this.draft,
            className: this.selectedClassName,
            toLevel: this.toLevel,
            hpMethod: this.hpMethod,
            hpRolls:
              this.hpMethod === 'roll' && this.hpRoll ? [this.hpRoll] : [],
            levelCap: this.levelCap,
            answers: this.answers,
          }),
        })
        const body = await res.json()
        if (id !== this.requestId) return
        if (!res.ok) throw new Error(body.error || res.statusText)
        this.preview = body
        this.error = null
      } catch (e) {
        if (id === this.requestId) this.error = e.message
      } finally {
        if (id === this.requestId) this.loading = false
      }
    },
    setAverage() {
      this.hpMethod = 'average'
      this.hpRoll = null
    },
    roll() {
      this.hpRoll = 1 + Math.floor(Math.random() * this.preview.hp.die)
      this.hpMethod = 'roll'
    },
    setRoll(v) {
      const n = Math.max(1, Math.min(this.preview.hp.die, parseInt(v, 10) || 0))
      this.hpRoll = n || null
      this.hpMethod = n ? 'roll' : 'average'
    },
    confirm() {
      if (!this.preview?.complete) return
      let patch = this.preview.patch
      // A Wizard with a shared spellbook: new spells go onto the spellbook, not the character.
      if (this.selectedCharacter?.spellbook_id && patch.spells) {
        const book = (this.$store.state.spellbooks ?? []).find(
          (b) => b.id === this.selectedCharacter.spellbook_id
        )
        if (book) {
          const known = new Set((book.spells ?? []).map((s) => s.name))
          const added = patch.spells.filter((s) => !known.has(s.name))
          if (added.length)
            this.$store.commit('UPDATE_TABLE_ITEM', {
              table: 'spellbooks',
              updatedItem: {
                ...book,
                spells: [
                  ...book.spells,
                  ...added.map((s) => ({ name: s.name, level: s.level })),
                ],
              },
            })
        }
        const { spells, ...rest } = patch
        patch = rest
      }
      this.$store.commit('APPLY_LEVEL_UP', {
        characterName: this.selectedCharacterName,
        patch,
      })
      this.justSaved = false
      this.saveError = null
      this.restart()
    },
    // Called by the pendingCharacterSaves mixin after a revert.
    onCharacterReverted(name) {
      if (name === this.selectedCharacterName) this.restart()
    },
  },
}
</script>

<style scoped>
.lu-select-row {
  display: flex;
  gap: 0.6rem;
  align-items: center;
  margin-bottom: 0.8rem;
  flex-wrap: wrap;
}
.lu-section {
  margin-bottom: 1rem;
}
.lu-section h3 {
  font-family: var(--font-display);
  color: var(--color-accent-strong);
  margin: 0 0 0.4rem;
}
.lu-hp {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
}
.lu-hp input {
  width: 3.5rem;
}
.lu-btn {
  background: var(--color-bg-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 0.3rem 0.7rem;
  font-family: var(--font-body);
  font-size: var(--font-size-sm);
  cursor: pointer;
}
.lu-btn.active,
.lu-btn--confirm {
  color: var(--color-accent-strong);
  border-color: var(--color-accent);
}
.lu-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.lu-note,
.lu-empty,
.lu-badge {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}
.lu-cap {
  color: #c0392b;
  margin-bottom: 0.8rem;
}
.lu-error {
  color: #c0392b;
}
.lu-warnings {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}
.lu-confirm {
  display: flex;
  gap: 0.8rem;
  align-items: center;
}
</style>
