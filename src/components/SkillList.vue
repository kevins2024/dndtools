<template>
  <div class="skills-col">
    <div class="section-title">Skills</div>
    <div class="skill-grid">
      <div
        v-for="skill in skills"
        :key="skill.name"
        class="skill-row"
        :class="{
          'skill-prof': skill.isProficient,
          'skill-expert': skill.hasExpertise,
        }"
        :title="skill.tooltip"
      >
        <span class="skill-dots">
          <span
            class="skill-dot"
            :class="{ filled: skill.isProficient || skill.hasExpertise }"
          ></span>
          <span
            class="skill-dot"
            :class="{ filled: skill.hasExpertise }"
          ></span>
        </span>
        <span class="skill-name">{{ skill.displayName }}</span>
        <span class="skill-stat">{{ skill.statLabel }}</span>
        <span class="skill-mod" :class="skill.value >= 0 ? 'pos' : 'neg'">{{
          skill.valueStr
        }}</span>
        <button
          class="roll-btn"
          :title="`Roll ${skill.displayName} check`"
          @click="rollSkill(skill)"
        >
          <img :src="d20Icon" class="roll-btn-icon" />
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { dnd } from '@/utils/dnd_utils.js'
import d20Icon from '@/assets/dice/d20.svg'

export default {
  name: 'SkillList',

  props: {
    character: { type: Object, required: true },
  },

  data() {
    return { d20Icon }
  },

  computed: {
    partyItems() {
      return this.$store.state.party_items ?? []
    },
    skills() {
      const proficiencies = this.character.skill_proficiencies ?? []
      const expertises = this.character.skill_expertise ?? []
      const characterName = this.character.name
      const itemGrantedProficiencies = new Set(
        this.partyItems
          .filter((i) => i.equipped_by === characterName)
          .flatMap((i) => i.grants_skill_proficiency ?? [])
      )

      return Object.entries(dnd.SKILL_MAP).map(([skillName, statKey]) => {
        const isProficient =
          proficiencies.includes(skillName) ||
          itemGrantedProficiencies.has(skillName)
        const hasExpertise = expertises.includes(skillName)
        const total = dnd.skill(this.character, skillName, this.partyItems)
        const displayName = skillName.replace(/([A-Z])/g, ' $1').trim()

        return {
          name: skillName,
          displayName,
          statKey,
          statLabel: statKey.toUpperCase(),
          value: total,
          valueStr: dnd.signed(total),
          isProficient,
          hasExpertise,
          tooltip: `${displayName} (${statKey.toUpperCase()})\n${dnd.skillBreakdown(
            this.character,
            skillName,
            this.partyItems
          )}`,
        }
      })
    },
  },

  methods: {
    rollSkill(skill) {
      this.$store.commit('SET_PENDING_ROLL', {
        label: `${this.character.name} — ${skill.displayName} check`,
        mod: skill.value,
      })
    },
  },
}
</script>

<style scoped>
.skills-col {
  flex: 1;
  min-width: 0;
}

.section-title {
  font-family: var(--font-display);
  font-size: var(--font-size-base);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 0.6vh;
}

.skill-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 0 1.2vw;
}

.skill-row {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 1px 0;
  cursor: default;
}

.skill-dots {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}

.skill-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  border: 1px solid var(--color-border);
  background: transparent;
  transition: background 0.1s, border-color 0.1s;
}

.skill-dot.filled {
  background: var(--color-accent);
  border-color: var(--color-accent);
}

.skill-row.skill-expert .skill-dot.filled {
  background: var(--color-accent-strong);
  border-color: var(--color-accent-strong);
}

.skill-name {
  flex: 1;
  min-width: 0;
  font-size: var(--font-size-base);
  color: var(--color-text-low);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.skill-row.skill-prof .skill-name {
  color: var(--color-accent);
}

.skill-row.skill-expert .skill-name {
  color: var(--color-accent-strong);
}

.skill-stat {
  font-size: var(--font-size-xs);
  color: var(--color-text-low);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  flex-shrink: 0;
  min-width: 2rem;
  text-align: right;
}

.skill-mod {
  font-size: var(--font-size-base);
  font-weight: 600;
  min-width: 2.5rem;
  text-align: right;
  flex-shrink: 0;
  border-bottom: 1px dotted currentColor;
  cursor: default;
}

.skill-mod.pos {
  color: var(--color-text-muted);
}
.skill-mod.neg {
  color: var(--color-text-danger);
}

.skill-row.skill-prof .skill-mod {
  color: var(--color-accent);
  border-bottom-color: var(--color-accent);
}
.skill-row.skill-expert .skill-mod {
  color: var(--color-accent-strong);
  border-bottom-color: var(--color-accent-strong);
}

.roll-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  padding: 1px;
  background: none;
  border: none;
  cursor: pointer;
  opacity: 0.55;
  transition: opacity 0.12s ease;
}
.roll-btn:hover {
  opacity: 1;
}

.roll-btn-icon {
  width: 12px;
  height: 12px;
}
</style>
