<template>
  <div class="battle">

    <!-- Initiative sidebar -->
    <aside class="initiative-sidebar">
      <div class="col-label">Initiative</div>
      <div class="initiative-list">
        <div
          v-for="(entry, i) in order"
          :key="entry.key"
          class="initiative-card"
          :class="[entry.type, { 'is-active': activeTurn === i }]"
          @click="activeTurn = i"
        >
          <div class="card-portrait">
            <img v-if="entry.type === 'player'" :src="entry.image" class="portrait-img" />
            <div v-else class="enemy-circle"></div>
          </div>

          <div class="card-info">
            <div class="card-name">{{ entry.name }}</div>
            <div class="card-meta">
              <span class="card-turn">{{ i + 1 }}</span>
              <span v-if="entry.type === 'player'" class="card-hp">
                {{ playerHp(entry.name) }}
              </span>
              <span v-else class="card-dmg">
                {{ enemyDmgLabel(entry.key) }}
              </span>
            </div>
          </div>

          <!-- Player: static score -->
          <div v-if="entry.type === 'player'" class="card-score">
            {{ entry.total }}
          </div>

          <!-- Enemy: click-to-edit score -->
          <div v-else class="card-score-wrap" @click.stop>
            <input
              v-if="editingKey === entry.key"
              :ref="`scoreInput-${entry.key}`"
              v-model.number="overrideValue"
              class="score-input"
              type="number"
              @blur="commitEdit(entry.key)"
              @keyup.enter="commitEdit(entry.key)"
              @keyup.escape="cancelEdit"
            />
            <span
              v-else
              class="card-score editable"
              title="Click to override"
              @click="startEdit(entry.key, entry.total)"
            >
              {{ entry.total }}
            </span>
          </div>
        </div>
      </div>
    </aside>

    <!-- Turn panel -->
    <main class="turn-panel">

      <!-- Player turn -->
      <template v-if="activeEntry && activeEntry.type === 'player' && activeChar">
        <div class="panel-header">
          <span class="panel-name">{{ activeChar.name }}</span>
          <span class="panel-subtitle">{{ activeChar.class }} {{ activeChar.level }}</span>
          <span class="panel-hp">{{ playerHp(activeChar.name) }} HP</span>
        </div>

        <div class="stat-chips">
          <div class="stat-chip" :title="speedTooltip">
            <span class="chip-val">{{ speed }}</span>
            <span class="chip-label">Speed</span>
          </div>
          <div class="stat-chip" :title="acTooltip">
            <span class="chip-val">{{ ac }}</span>
            <span class="chip-label">AC</span>
          </div>
          <div class="stat-chip" :title="`Proficiency bonus at level ${activeChar.level}`">
            <span class="chip-val">+{{ activeChar.proficiency_bonus }}</span>
            <span class="chip-label">Prof</span>
          </div>
          <div v-if="spellAttack !== null" class="stat-chip" :title="spellAttackTooltip">
            <span class="chip-val">{{ signed(spellAttack) }}</span>
            <span class="chip-label">Spell Atk</span>
          </div>
          <div v-if="spellSaveDC !== null" class="stat-chip" :title="spellDCTooltip">
            <span class="chip-val">{{ spellSaveDC }}</span>
            <span class="chip-label">Save DC</span>
          </div>
        </div>

        <div class="section-label">Weapons</div>
        <div v-if="equippedWeapons.length === 0" class="section-empty">No weapons equipped</div>
        <table v-else class="weapon-table">
          <thead>
            <tr>
              <th>Name</th>
              <th class="col-num" title="Attack bonus">Atk</th>
              <th class="col-num" title="Damage dice + modifier">Dmg</th>
              <th class="col-tag">Type</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="w in equippedWeapons" :key="w.id">
              <td class="weapon-name">{{ w.name }}</td>
              <td class="col-num" :title="weaponAtkTooltip(w)">{{ signed(weaponAtk(w)) }}</td>
              <td class="col-num" :title="weaponDmgTooltip(w)">{{ weaponDmg(w) }}</td>
              <td class="col-tag">{{ w.weapon_type }}</td>
            </tr>
          </tbody>
        </table>
      </template>

      <!-- Enemy turn -->
      <template v-else-if="activeEntry && activeEntry.type === 'enemy'">
        <div class="panel-header">
          <span class="panel-name">{{ activeEntry.name }}</span>
          <span class="panel-subtitle">Enemy</span>
        </div>

        <div class="section-label">Damage Tracker</div>
        <div class="damage-tracker">
          <div class="damage-summary">
            <span class="damage-taken">{{ activeEnemyHp.damage }}</span>
            <span class="damage-taken-label">damage taken</span>
            <template v-if="activeEnemyHp.maxHp !== null">
              <span class="damage-sep">/</span>
              <span class="damage-max">{{ activeEnemyHp.maxHp }} HP</span>
            </template>
          </div>

          <div class="damage-row">
            <input
              v-model.number="damageInput"
              class="field dmg-field"
              type="number"
              placeholder="Damage amount"
              min="0"
              @keyup.enter="applyDamage"
            />
            <button class="add-btn" :disabled="!damageInput" @click="applyDamage">Apply</button>
            <button
              class="reset-btn"
              title="Reset damage to 0"
              :disabled="activeEnemyHp.damage === 0"
              @click="resetDamage"
            >
              Reset
            </button>
          </div>

          <div class="max-hp-row">
            <input
              v-model.number="maxHpInput"
              class="field dmg-field"
              type="number"
              placeholder="Max HP (optional)"
              min="1"
              @blur="saveMaxHp"
              @keyup.enter="saveMaxHp"
            />
          </div>
        </div>
      </template>

      <div v-else class="panel-empty">Select a combatant to view their turn</div>

    </main>
  </div>
</template>

<script>
import characters from '@/data/characters.json'
import { dnd } from '@/utils/dnd_utils.js'
import { DEFAULT_SPEED_FT, ARMOR_BASE_AC, ARMOR_DEX_CAP } from '@/utils/dnd_constants.js'

export default {
  name: 'Battle',

  props: {
    order: { type: Array, required: true },
  },

  emits: ['override-roll'],

  data() {
    return {
      activeTurn:   0,
      editingKey:   null,
      overrideValue: null,
      enemyHp:      {},  // { [key]: { damage: 0, maxHp: null } }
      damageInput:  null,
      maxHpInput:   null,
    }
  },

  computed: {
    activeEntry() {
      return this.order[this.activeTurn] ?? null
    },
    activeChar() {
      if (!this.activeEntry || this.activeEntry.type !== 'player') return null
      return characters.find((c) => c.name === this.activeEntry.name) ?? null
    },
    activeEnemyHp() {
      if (!this.activeEntry || this.activeEntry.type !== 'enemy') return null
      return this.enemyHp[this.activeEntry.key] ?? { damage: 0, maxHp: null }
    },
    equippedWeapons() {
      if (!this.activeChar) return []
      return this.$store.state.party_items.filter(
        (i) => i.type === 'weapon' && i.equipped_by === this.activeChar.name
      )
    },
    speed() {
      const s = this.activeChar?.speed
      if (!s) return `${DEFAULT_SPEED_FT} ft`
      return typeof s === 'number' ? `${s} ft` : s
    },
    speedTooltip() {
      return this.activeChar?.speed
        ? 'From character data'
        : `Default ${DEFAULT_SPEED_FT} ft — add "speed" to character data to override`
    },
    ac() { return this._acCalc().total },
    acTooltip() { return this._acCalc().tooltip },
    spellAttack() {
      return this.activeChar ? dnd.spellAttackBonus(this.activeChar) : null
    },
    spellAttackTooltip() {
      if (!this.activeChar?.spellcasting_ability) return ''
      const ability = this.activeChar.spellcasting_ability
      const mod = dnd.mod(this.activeChar[`stat_${ability}`])
      const prof = this.activeChar.proficiency_bonus
      return `${ability.toUpperCase()} mod ${dnd.signed(mod)} + Prof ${dnd.signed(prof)} = ${dnd.signed(mod + prof)}`
    },
    spellSaveDC() {
      return this.activeChar ? dnd.spellSaveDC(this.activeChar) : null
    },
    spellDCTooltip() {
      if (!this.activeChar || this.spellAttack === null) return ''
      return `8 + Spell Atk ${dnd.signed(this.spellAttack)} = ${8 + this.spellAttack}`
    },
  },

  watch: {
    // Sync maxHpInput with stored value when active entry changes
    activeEntry(entry) {
      if (entry?.type === 'enemy') {
        this.maxHpInput = this.enemyHp[entry.key]?.maxHp ?? null
        this.damageInput = null
      }
    },
  },

  methods: {
    signed: dnd.signed,

    // ── Player HP display ──
    playerHp(name) {
      const char = characters.find((c) => c.name === name)
      if (!char) return '—'
      return `${char.hp_current}/${char.hp_max}`
    },

    // ── Enemy damage display (sidebar) ──
    enemyDmgLabel(key) {
      const hp = this.enemyHp[key]
      if (!hp || hp.damage === 0) return ''
      if (hp.maxHp !== null) return `${hp.maxHp - hp.damage}/${hp.maxHp}`
      return `DMG ${hp.damage}`
    },

    // ── Enemy HP helpers ──
    _ensureEnemyHp(key) {
      if (!this.enemyHp[key]) {
        this.$set(this.enemyHp, key, { damage: 0, maxHp: null })
      }
    },
    applyDamage() {
      const amount = Number(this.damageInput)
      if (!amount || amount <= 0 || !this.activeEntry) return
      const key = this.activeEntry.key
      this._ensureEnemyHp(key)
      this.$set(this.enemyHp, key, {
        ...this.enemyHp[key],
        damage: this.enemyHp[key].damage + amount,
      })
      this.damageInput = null
    },
    resetDamage() {
      const key = this.activeEntry.key
      this._ensureEnemyHp(key)
      this.$set(this.enemyHp, key, { ...this.enemyHp[key], damage: 0 })
    },
    saveMaxHp() {
      if (!this.activeEntry) return
      const key = this.activeEntry.key
      const val = this.maxHpInput > 0 ? this.maxHpInput : null
      this._ensureEnemyHp(key)
      this.$set(this.enemyHp, key, { ...this.enemyHp[key], maxHp: val })
    },

    // ── Initiative override ──
    startEdit(key, currentTotal) {
      this.editingKey = key
      this.overrideValue = currentTotal
      this.$nextTick(() => {
        const ref = this.$refs[`scoreInput-${key}`]
        const el = Array.isArray(ref) ? ref[0] : ref
        el?.focus()
        el?.select()
      })
    },
    commitEdit(key) {
      const total = Number(this.overrideValue)
      if (!isNaN(total)) this.$emit('override-roll', { key, total })
      this.editingKey = null
      this.overrideValue = null
    },
    cancelEdit() {
      this.editingKey = null
      this.overrideValue = null
    },

    // ── AC ──
    _acCalc() {
      if (!this.activeChar) return { total: '—', tooltip: '' }
      const char = this.activeChar
      const dexMod = dnd.mod(char.stat_dex)
      const equipped = this.$store.state.party_items.filter((i) => i.equipped_by === char.name)
      const armorItem = equipped.find((i) => i.type === 'armor' && i.slot === 'body')

      let base, category, armorDesc
      if (armorItem) {
        const def = ARMOR_BASE_AC[armorItem.armor_type]
        if (def) {
          base = def.base + (armorItem.magic_bonus ?? 0)
          category = def.category
          armorDesc = armorItem.name
        } else if (armorItem.base_ac != null) {
          base = armorItem.base_ac + (armorItem.magic_bonus ?? 0)
          category = armorItem.armor_category ?? 'light'
          armorDesc = armorItem.name
        } else {
          base = 10; category = 'unarmored'
          armorDesc = `Unarmored (add armor_type to ${armorItem.name})`
        }
      } else {
        base = 10; category = 'unarmored'; armorDesc = 'Unarmored'
      }

      const dexCap = ARMOR_DEX_CAP[category] ?? Infinity
      const dexContrib = Math.min(dexMod, dexCap)
      const shield = equipped.find((i) => i.armor_type === 'shield')
      const shieldBonus = shield ? 2 + (shield.magic_bonus ?? 0) : 0
      const acBonus = equipped.reduce((sum, i) => sum + (i.stat_bonuses?.ac ?? 0), 0)
      const total = base + dexContrib + shieldBonus + acBonus

      const parts = [`${armorDesc}: ${base}`]
      if (dexContrib !== 0 || category === 'unarmored') {
        const capNote = dexCap === Infinity ? '' : ` (cap +${dexCap})`
        parts.push(`DEX ${dnd.signed(dexContrib)}${capNote}`)
      }
      if (shieldBonus) parts.push(`${shield.name} +${shieldBonus}`)
      if (acBonus) parts.push(`items ${dnd.signed(acBonus)}`)
      parts.push(`= ${total}`)
      return { total, tooltip: parts.join(' + ').replace(' + =', ' =') }
    },

    // ── Weapons ──
    weaponAtk(weapon) { return dnd.attackBonus(this.activeChar, weapon) },
    weaponAtkTooltip(weapon) {
      const char = this.activeChar
      const strMod = dnd.mod(char.stat_str)
      const dexMod = dnd.mod(char.stat_dex)
      const prof = char.proficiency_bonus
      const magic = weapon.magic_bonus ?? 0
      let statMod, statDesc
      if (weapon.finesse) {
        statMod = Math.max(strMod, dexMod)
        statDesc = `Finesse — best of STR ${dnd.signed(strMod)}, DEX ${dnd.signed(dexMod)} = ${dnd.signed(statMod)}`
      } else if (weapon.weapon_type === 'ranged') {
        statMod = dexMod; statDesc = `DEX ${dnd.signed(dexMod)}`
      } else {
        statMod = strMod; statDesc = `STR ${dnd.signed(strMod)}`
      }
      const total = statMod + prof + magic
      const parts = [statDesc, `Prof ${dnd.signed(prof)}`]
      if (magic) parts.push(`Magic ${dnd.signed(magic)}`)
      parts.push(`= ${dnd.signed(total)}`)
      return parts.join(' + ').replace(' + =', ' =')
    },
    weaponDmg(weapon) {
      return `${weapon.damage_dice ?? '?'}${dnd.signed(dnd.damageBonus(this.activeChar, weapon))}`
    },
    weaponDmgTooltip(weapon) {
      const char = this.activeChar
      const strMod = dnd.mod(char.stat_str)
      const dexMod = dnd.mod(char.stat_dex)
      const magic = weapon.magic_bonus ?? 0
      let statMod, statDesc
      if (weapon.finesse) {
        statMod = Math.max(strMod, dexMod); statDesc = `Finesse ${dnd.signed(statMod)}`
      } else if (weapon.weapon_type === 'ranged') {
        statMod = dexMod; statDesc = `DEX ${dnd.signed(dexMod)}`
      } else {
        statMod = strMod; statDesc = `STR ${dnd.signed(strMod)}`
      }
      const parts = [`${weapon.damage_dice ?? '?'}`, statDesc]
      if (magic) parts.push(`Magic ${dnd.signed(magic)}`)
      return parts.join(' + ')
    },
  },
}
</script>

<style scoped>
.battle {
  display: flex;
  height: 100%;
  overflow: hidden;
}

/* ── Initiative Sidebar ── */
.initiative-sidebar {
  width: 210px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--color-border);
  background: var(--color-bg-panel);
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--color-scrollbar) transparent;
}

.col-label {
  padding: 0.4rem 0.75rem;
  font-family: var(--font-display);
  font-size: var(--font-size-tiny);
  color: var(--color-text-low);
  border-bottom: 1px solid var(--color-border);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  flex-shrink: 0;
}

.initiative-list { display: flex; flex-direction: column; }

.initiative-card {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.6rem;
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;
  transition: background 0.1s ease;
}

.initiative-card:hover       { background: var(--color-bg-surface); }
.initiative-card.is-active   { background: var(--color-bg-surface-alt); }
.initiative-card.player.is-active { border-left: 3px solid var(--color-accent); }
.initiative-card.enemy.is-active  { border-left: 3px solid var(--color-text-danger); }

.card-portrait {
  flex-shrink: 0;
  width: 34px;
  height: 34px;
  border-radius: 4px;
  overflow: hidden;
}

.portrait-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top center;
}

.enemy-circle {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: #6b2020;
  border: 2px solid var(--color-text-danger);
}

.card-info   { flex: 1; min-width: 0; }

.card-name {
  font-size: var(--font-size-small);
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-meta {
  display: flex;
  gap: 0.4rem;
  align-items: baseline;
  margin-top: 0.1rem;
}

.card-turn { font-size: var(--font-size-tiny); color: var(--color-text-low); }

.card-hp {
  font-size: var(--font-size-tiny);
  color: var(--color-text-muted);
}

.card-dmg {
  font-size: var(--font-size-tiny);
  color: var(--color-text-danger);
}

.card-score {
  font-family: var(--font-display);
  font-size: var(--font-size-base);
  color: var(--color-accent-strong);
  min-width: 1.75rem;
  text-align: right;
  flex-shrink: 0;
}

.card-score-wrap {
  flex-shrink: 0;
  min-width: 1.75rem;
  text-align: right;
}

.card-score.editable {
  cursor: pointer;
  border-bottom: 1px dashed var(--color-border);
}

.card-score.editable:hover {
  color: var(--color-accent);
  border-bottom-color: var(--color-accent);
}

.score-input {
  width: 2.5rem;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-accent);
  border-radius: 3px;
  color: var(--color-accent-strong);
  font-family: var(--font-display);
  font-size: var(--font-size-small);
  text-align: right;
  padding: 0.1rem 0.2rem;
}

/* ── Turn Panel ── */
.turn-panel {
  flex: 1;
  padding: 1rem 1.25rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.panel-header {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 0.6rem;
}

.panel-name {
  font-family: var(--font-display);
  font-size: var(--font-size-large);
  color: var(--color-text);
}

.panel-subtitle {
  font-size: var(--font-size-small);
  color: var(--color-text-muted);
}

.panel-hp {
  margin-left: auto;
  font-size: var(--font-size-small);
  color: var(--color-text-muted);
}

/* ── Stat Chips ── */
.stat-chips { display: flex; gap: 0.75rem; flex-wrap: wrap; }

.stat-chip {
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
}

.chip-label {
  font-size: var(--font-size-tiny);
  color: var(--color-text-low);
  margin-top: 0.1rem;
}

/* ── Section Label ── */
.section-label {
  font-family: var(--font-display);
  font-size: var(--font-size-tiny);
  color: var(--color-text-low);
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.section-empty { font-size: var(--font-size-small); color: var(--color-text-low); }

/* ── Weapon Table ── */
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

/* ── Damage Tracker ── */
.damage-tracker {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.damage-summary {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
}

.damage-taken {
  font-family: var(--font-display);
  font-size: var(--font-size-display);
  color: var(--color-text-danger);
}

.damage-taken-label {
  font-size: var(--font-size-small);
  color: var(--color-text-muted);
}

.damage-sep { color: var(--color-text-low); }

.damage-max {
  font-size: var(--font-size-small);
  color: var(--color-text-muted);
}

.damage-row,
.max-hp-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.field {
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text);
  font-size: var(--font-size-small);
  font-family: var(--font-body);
  padding: 0.35rem 0.5rem;
}

.field:focus { outline: none; border-color: var(--color-accent); }

.dmg-field { width: 8rem; }

.add-btn {
  padding: 0.35rem 0.75rem;
  background: var(--color-bg-surface-alt);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text-muted);
  font-size: var(--font-size-small);
  font-family: var(--font-body);
  cursor: pointer;
  transition: all 0.15s ease;
}

.add-btn:hover:not(:disabled) { border-color: var(--color-accent); color: var(--color-accent); }
.add-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.reset-btn {
  padding: 0.35rem 0.6rem;
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text-low);
  font-size: var(--font-size-small);
  font-family: var(--font-body);
  cursor: pointer;
  transition: all 0.15s ease;
}

.reset-btn:hover:not(:disabled) { border-color: var(--color-text-danger); color: var(--color-text-danger); }
.reset-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* ── Panel Empty ── */
.panel-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-text-low);
  font-family: var(--font-display);
  font-size: var(--font-size-small);
}
</style>
