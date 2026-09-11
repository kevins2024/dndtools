<template>
  <div class="familiar-summon">
    <template v-if="!picking">
      <button class="familiar-summon-btn" @click="picking = true">
        Summon a Familiar (Find Familiar)
      </button>
    </template>
    <template v-else>
      <select v-model="formName" class="familiar-select">
        <option :value="null" disabled>Choose a form…</option>
        <option v-for="f in FORMS" :key="f" :value="f">{{ f }}</option>
      </select>
      <button
        class="familiar-summon-btn"
        :disabled="!formName || loading"
        @click="summon"
      >
        {{ loading ? 'Summoning…' : 'Confirm' }}
      </button>
      <button class="familiar-cancel-btn" @click="picking = false">
        Cancel
      </button>
      <span v-if="error" class="familiar-error">{{ error }}</span>
    </template>
  </div>
</template>

<script>
import { lookupMonster } from '@/utils/lookupService.js'

// The 15 real PHB Find Familiar options, using the exact SRD monster names
// lookupMonster/dnd5eapi.co resolve by — "Frog" and "Quipper" are the real
// SRD names behind the spell's "frog (toad)" / "fish (quipper)" wording.
const FORMS = [
  'Bat',
  'Cat',
  'Crab',
  'Frog',
  'Hawk',
  'Lizard',
  'Octopus',
  'Owl',
  'Poisonous Snake',
  'Quipper',
  'Rat',
  'Raven',
  'Sea Horse',
  'Spider',
  'Weasel',
]

// dnd5eapi action shape varies (some have structured `damage[]`, some are
// text-only, e.g. Cat's "Claws" or Crab's "Claw" both have real damage dice;
// a handful of familiar forms have no attacks at all). Best-effort mapping —
// falls back to the raw description as the effect text when there's no
// structured damage, rather than inventing numbers.
function actionsToAttacks(actions) {
  return actions.map((a) => {
    const dmg = a.damage?.[0]
    return {
      name: a.name,
      type: 'melee',
      attack_bonus: a.attack_bonus ?? null,
      damage_dice: dmg?.damage_dice ?? null,
      damage_bonus: 0,
      damage_type: dmg?.damage_type?.name ?? null,
      effect: a.desc ?? '',
    }
  })
}

function formatSpeed(speed) {
  if (!speed) return null
  return Object.entries(speed)
    .map(([k, v]) => (k === 'walk' ? v : `${k} ${v}`))
    .join(', ')
}

export default {
  name: 'FamiliarSummon',

  props: {
    character: { type: Object, required: true },
  },

  data() {
    return {
      FORMS,
      picking: false,
      formName: null,
      loading: false,
      error: null,
    }
  },

  methods: {
    async summon() {
      if (!this.formName) return
      this.loading = true
      this.error = null
      try {
        const stats = await lookupMonster(this.formName)
        if (!stats) {
          this.error = `Couldn't find "${this.formName}" — check your connection and try again.`
          return
        }
        const nextId = `companions_${Date.now()}`
        this.$store.commit('UPDATE_TABLE_ITEM', {
          table: 'companions',
          updatedItem: {
            id: nextId,
            name: this.formName,
            type: 'companion',
            companion_type: 'familiar',
            owner: this.character.name,
            species: this.formName,
            image: null,
            summoned: true,
            ac: stats.ac,
            hp_max: stats.hp,
            hp_current: stats.hp,
            speed: formatSpeed(stats.speed),
            proficiency_bonus: this.character.proficiency_bonus ?? 2,
            stat_str: stats.str,
            stat_dex: stats.dex,
            stat_con: stats.con,
            stat_int: stats.int,
            stat_wis: stats.wis,
            stat_cha: stats.cha,
            conditions: [],
            attacks: actionsToAttacks(stats.actions ?? []),
            features: (stats.special_abilities ?? []).map((sa) => ({
              name: sa.name,
              type: 'feature',
              action_type: null,
              recharge: null,
              uses_max: null,
              uses_current: null,
              description: sa.desc ?? '',
            })),
            notes:
              "Familiar (Find Familiar via Book of Ancient Secrets). Real RAW: it CAN'T attack (that needs Pact of the Chain, which this isn't) — the attacks listed below are its natural stat-block attacks, kept for reference only, not something it can actually use in combat. It CAN take other actions (Help, Hide, etc.), share your senses for 1 action while within 100ft, and deliver touch spells for you. It has your proficiency bonus in whatever it's proficient in. Vanishes at 0 HP or on dismissal; a fresh casting of Find Familiar can restore it or summon a different form.",
          },
        })
        this.picking = false
        this.formName = null
      } catch (err) {
        this.error = err.message || 'Something went wrong summoning it.'
      } finally {
        this.loading = false
      }
    },
  },
}
</script>

<style scoped>
.familiar-summon {
  display: flex;
  align-items: center;
  gap: 0.5vw;
  padding: 0.3vh 0.5vw;
  border: 1px dashed var(--color-border);
  border-radius: 4px;
  background: var(--color-bg-panel);
  font-size: var(--font-size-sm);
}

.familiar-summon-btn {
  padding: 0.2rem 0.6rem;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-accent);
  border-radius: 4px;
  color: var(--color-accent-strong);
  cursor: pointer;
  font-size: var(--font-size-sm);
}

.familiar-summon-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.familiar-cancel-btn {
  padding: 0.2rem 0.5rem;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: var(--font-size-sm);
}

.familiar-select {
  padding: 0.2rem 0.4rem;
  background: var(--color-bg-input);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text);
  font-size: var(--font-size-sm);
}

.familiar-error {
  color: var(--color-text-danger);
  font-size: var(--font-size-xs);
}
</style>
