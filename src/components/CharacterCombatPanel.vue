<template>
  <div class="combat-panel">

    <div class="chip-row">
      <div class="chip">
        <span class="chip-val">{{ character.hp_current }}/{{ character.hp_max }}</span>
        <span class="chip-label">HP</span>
      </div>
      <div class="chip" :title="acTooltip">
        <span class="chip-val">{{ ac }}</span>
        <span class="chip-label">AC</span>
      </div>
      <div class="chip" :title="speedTooltip">
        <span class="chip-val">{{ speed }}</span>
        <span class="chip-label">Speed</span>
      </div>
      <div class="chip">
        <span class="chip-val">+{{ character.proficiency_bonus }}</span>
        <span class="chip-label">Prof</span>
      </div>
      <div v-if="spellAttack !== null" class="chip" :title="spellAttackTooltip">
        <span class="chip-val">{{ dnd.signed(spellAttack) }}</span>
        <span class="chip-label">Spell Atk</span>
      </div>
      <div v-if="spellSaveDC !== null" class="chip" :title="spellDCTooltip">
        <span class="chip-val">{{ spellSaveDC }}</span>
        <span class="chip-label">Save DC</span>
      </div>
    </div>

    <template v-if="weaponSummaries.length">
      <div class="section-label">Weapons</div>
      <table class="weapon-table">
        <thead>
          <tr>
            <th>Name</th>
            <th class="col-num" title="Attack bonus">Atk</th>
            <th class="col-num" title="Damage dice + modifier">Dmg</th>
            <th class="col-tag">Type</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="w in weaponSummaries" :key="w.name">
            <td class="weapon-name">{{ w.name }}</td>
            <td class="col-num" :title="w.atkTooltip">{{ w.attack }}</td>
            <td class="col-num" :title="w.dmgTooltip">{{ w.damage }}</td>
            <td class="col-tag">{{ w.type }}</td>
          </tr>
        </tbody>
      </table>
    </template>
    <div v-else class="section-empty">No weapons equipped</div>

  </div>
</template>

<script>
import { dnd } from '@/utils/dnd_utils.js'
import { DEFAULT_SPEED_FT } from '@/utils/dnd_constants.js'

export default {
  name: 'CharacterCombatPanel',

  props: {
    character: { type: Object, required: true },
  },

  computed: {
    partyItems() {
      return this.$store.state.party_items
    },
    equippedItems() {
      return this.partyItems.filter((i) => i.equipped_by === this.character.name)
    },

    ac() {
      return dnd.ac(this.character, { carriedPartyItems: this.partyItems })
    },
    acTooltip() {
      const armor = this.equippedItems.find((i) => i.type === 'armor' && i.slot === 'body')
      const shield = this.equippedItems.find((i) => i.armor_type === 'shield')
      const acBonus = this.equippedItems.reduce((s, i) => s + (i.stat_bonuses?.ac ?? 0), 0)
      const parts = []
      if (armor) parts.push(armor.name)
      else parts.push('Unarmored')
      if (shield) parts.push(`${shield.name} (+${2 + (shield.magic_bonus ?? 0)})`)
      if (acBonus) parts.push(`Items (${dnd.signed(acBonus)})`)
      parts.push(`= ${this.ac}`)
      return parts.join(' + ').replace(' + =', ' =')
    },

    speed() {
      const s = this.character.speed
      if (!s) return `${DEFAULT_SPEED_FT} ft`
      const base = typeof s === 'number' ? `${s} ft` : s
      const bonus = this.equippedItems.reduce((sum, i) => sum + (i.stat_bonuses?.speed ?? 0), 0)
      return bonus ? `${(typeof s === 'number' ? s : DEFAULT_SPEED_FT) + bonus} ft` : base
    },
    speedTooltip() {
      return this.character.speed ? '' : `Default ${DEFAULT_SPEED_FT} ft`
    },

    spellAttack() {
      return dnd.spellAttackBonus(this.character, this.partyItems)
    },
    spellAttackTooltip() {
      if (!this.character.spellcasting_ability) return ''
      const ab = this.character.spellcasting_ability
      const mod = dnd.mod(this.character[`stat_${ab}`])
      const prof = this.character.proficiency_bonus
      return `${ab.toUpperCase()} ${dnd.signed(mod)} + Prof ${dnd.signed(prof)} = ${dnd.signed(mod + prof)}`
    },
    spellSaveDC() {
      return dnd.spellSaveDC(this.character, this.partyItems)
    },
    spellDCTooltip() {
      if (this.spellAttack === null) return ''
      return `8 + Spell Atk ${dnd.signed(this.spellAttack)} = ${8 + this.spellAttack}`
    },

    weaponSummaries() {
      const { stats } = dnd.resolveStats(this.character, this.partyItems)
      const strMod = dnd.mod(stats.str)
      const dexMod = dnd.mod(stats.dex)
      const prof = this.character.proficiency_bonus

      const weapons = this.equippedItems.filter((i) => i.type === 'weapon')
      const summaries = weapons.map((w) => {
        const props = dnd._weaponProps(w)
        const magic = w.magic_bonus ?? 0
        let statMod, statDesc
        if (props.finesse) {
          statMod = Math.max(strMod, dexMod)
          statDesc = `Finesse — best of STR ${dnd.signed(strMod)}, DEX ${dnd.signed(dexMod)} = ${dnd.signed(statMod)}`
        } else if (props.weapon_type === 'ranged') {
          statMod = dexMod
          statDesc = `DEX ${dnd.signed(dexMod)}`
        } else {
          statMod = strMod
          statDesc = `STR ${dnd.signed(strMod)}`
        }
        const atkTotal = statMod + prof + magic
        const atkParts = [statDesc, `Prof ${dnd.signed(prof)}`]
        if (magic) atkParts.push(`Magic ${dnd.signed(magic)}`)
        atkParts.push(`= ${dnd.signed(atkTotal)}`)

        const dmgBonus = dnd.damageBonus(this.character, w)
        const die = dnd.gripDie(this.character, w, this.partyItems)
        const dmgParts = [die, statDesc.split('—')[0].trim()]
        if (magic) dmgParts.push(`Magic ${dnd.signed(magic)}`)

        return {
          name: w.name,
          attack: dnd.signed(dnd.attackBonus(this.character, w)),
          damage: `${die}${dnd.signed(dmgBonus)}`,
          type: props.weapon_type,
          atkTooltip: atkParts.join(' + ').replace(' + =', ' ='),
          dmgTooltip: dmgParts.join(' + '),
        }
      })

      if (this.character.martial_arts_die) {
        const die = this.character.martial_arts_die
        const statMod = Math.max(strMod, dexMod)
        const atkTotal = statMod + prof
        summaries.unshift({
          name: 'Unarmed Strike',
          attack: dnd.signed(atkTotal),
          damage: `${die}${dnd.signed(statMod)}`,
          type: 'melee',
          atkTooltip: `Martial Arts — best of STR ${dnd.signed(strMod)}, DEX ${dnd.signed(dexMod)} = ${dnd.signed(statMod)} + Prof ${dnd.signed(prof)} = ${dnd.signed(atkTotal)}`,
          dmgTooltip: `${die} + best of STR ${dnd.signed(strMod)}, DEX ${dnd.signed(dexMod)} = ${dnd.signed(statMod)}`,
        })
      }

      return summaries
    },
  },

  created() {
    this.dnd = dnd
  },
}
</script>

<style scoped>
.combat-panel {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.chip-row {
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.4rem 0.9rem;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  cursor: default;
  min-width: 4rem;
}

.chip-val {
  font-family: var(--font-display);
  font-size: var(--font-size-base);
  color: var(--color-accent-strong);
  line-height: 1;
}

.chip-label {
  font-size: var(--font-size-tiny);
  color: var(--color-text-low);
  margin-top: 0.15rem;
}

.section-label {
  font-family: var(--font-display);
  font-size: var(--font-size-tiny);
  color: var(--color-text-low);
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.section-empty {
  font-size: var(--font-size-small);
  color: var(--color-text-low);
}

.weapon-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-small);
}

.weapon-table th {
  text-align: left;
  font-family: var(--font-display);
  font-size: var(--font-size-tiny);
  font-weight: normal;
  color: var(--color-text-low);
  letter-spacing: 0.04em;
  padding: 0.2rem 0.5rem 0.4rem 0;
  border-bottom: 1px solid var(--color-border);
}

.weapon-table td {
  padding: 0.4rem 0.5rem 0.4rem 0;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text);
  vertical-align: middle;
}

.weapon-table tr:last-child td { border-bottom: none; }

.weapon-table th.col-num,
.weapon-table td.col-num {
  text-align: right;
  min-width: 3rem;
  font-family: var(--font-display);
  color: var(--color-accent-strong);
}

.weapon-table th.col-tag,
.weapon-table td.col-tag {
  color: var(--color-text-muted);
  font-size: var(--font-size-tiny);
  padding-left: 0.5rem;
}

.weapon-name { color: var(--color-text); }
</style>
