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
      </div>
    </div>
  </div>
</template>

<script>
import { dnd } from '@/utils/dnd_utils.js'

export default {
  name: 'SkillList',

  props: {
    character: { type: Object, required: true },
  },

  computed: {
    partyItems() {
      return this.$store.state.party_items ?? []
    },
    skills() {
      const { stats, bonuses } = dnd.resolveStats(
        this.character,
        this.partyItems
      )
      const prof = dnd._prof(this.character, bonuses)
      const proficiencies = this.character.skill_proficiencies ?? []
      const expertises = this.character.skill_expertise ?? []

      return Object.entries(dnd.SKILL_MAP).map(([skillName, statKey]) => {
        const base = dnd.mod(stats[statKey])
        const isProficient = proficiencies.includes(skillName)
        const hasExpertise = expertises.includes(skillName)
        const itemBonus = bonuses[`skill_${skillName}`] ?? 0
        const profBonus = hasExpertise ? prof * 2 : isProficient ? prof : 0
        const total = base + profBonus + itemBonus

        const displayName = skillName.replace(/([A-Z])/g, ' $1').trim()
        const statLabel = statKey.toUpperCase()

        const lines = [
          `${displayName} (${statLabel})`,
          `${statLabel} ${dnd.signed(base)}`,
        ]
        if (hasExpertise)
          lines.push(`Expertise ${dnd.signed(prof * 2)} (Prof ×2)`)
        else if (isProficient) lines.push(`Prof ${dnd.signed(prof)}`)
        if (itemBonus) lines.push(`Items ${dnd.signed(itemBonus)}`)
        lines.push(`= ${dnd.signed(total)}`)

        return {
          name: skillName,
          displayName,
          statKey,
          statLabel,
          value: total,
          valueStr: dnd.signed(total),
          isProficient,
          hasExpertise,
          tooltip: lines.join('\n'),
        }
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
</style>
