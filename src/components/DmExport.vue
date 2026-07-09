<template>
  <div class="dm-export">
    <div class="dm-header">
      <h3 class="dm-title">DM Context Export</h3>
      <p class="dm-desc">
        Generates a Markdown context file for an AI Dungeon Master. Write to
        <code>public/dm-context/</code>, push to GitHub, then curl the raw URL
        at the start of each session.
      </p>
    </div>

    <!-- Location picker -->
    <div class="dm-row">
      <label class="dm-label">Current location</label>
      <select class="dm-select" v-model="selectedLocation">
        <option value="">— none / skip location —</option>
        <option
          v-for="loc in topLevelLocations"
          :key="loc.name"
          :value="loc.name"
        >
          {{ loc.name }}
        </option>
      </select>
    </div>

    <!-- Summary -->
    <div class="dm-summary" v-if="activeParty">
      <div class="summary-row">
        <span class="summary-label">Party</span>
        <span class="summary-val">{{ activeParty.name }}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Characters</span>
        <span class="summary-val">{{ activeMembers.length }}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Items</span>
        <span class="summary-val">{{ partyItemBundle.length }}</span>
      </div>
      <div class="summary-row" v-if="selectedLocation">
        <span class="summary-label">Location</span>
        <span class="summary-val">{{ selectedLocation }}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">NPCs included</span>
        <span class="summary-val">{{ allRelevantNpcs.length }}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Relationships</span>
        <span class="summary-val">{{ relevantRelationships.length }}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Party gold</span>
        <span class="summary-val">{{ partyGold.toLocaleString() }} gp</span>
      </div>
    </div>

    <!-- Actions -->
    <div class="dm-actions">
      <button
        class="action-btn action-btn--primary"
        :class="{ 'action-btn--done': generated }"
        :disabled="!activeParty || generating"
        @click="generateFile"
      >
        {{
          generating
            ? 'Writing…'
            : generated
            ? '✓ File Written'
            : 'Generate MD File'
        }}
      </button>
      <button
        class="action-btn"
        :class="{ 'action-btn--done': copied }"
        :disabled="!activeParty"
        @click="copyJson"
      >
        {{ copied ? '✓ Copied' : 'Copy JSON' }}
      </button>
      <span v-if="!activeParty" class="dm-hint">No active party selected.</span>
    </div>

    <!-- Generated file result -->
    <div v-if="generatedPath" class="dm-result">
      <div class="result-label">File written — push to GitHub, then curl:</div>
      <code class="result-url">{{ rawGithubUrl }}</code>
      <button class="ghost-btn" @click="copyUrl">
        {{ urlCopied ? '✓ Copied' : 'Copy URL' }}
      </button>
    </div>

    <div v-if="writeError" class="dm-error">{{ writeError }}</div>
  </div>
</template>

<script>
const GITHUB_RAW_BASE =
  'https://raw.githubusercontent.com/kevins2024/dndtools/main/public'

export default {
  name: 'DmExport',

  data() {
    return {
      selectedLocation: '',
      copied: false,
      generating: false,
      generated: false,
      generatedPath: '',
      writeError: '',
      urlCopied: false,
    }
  },

  computed: {
    activeParty() {
      return this.$store.getters.activeParty
    },
    activePartyDay() {
      return this.$store.getters.activePartyDay
    },
    allCharacters() {
      return this.$store.state.characters ?? []
    },
    activeMembers() {
      if (!this.activeParty) return []
      const names = new Set(this.activeParty.members)
      return this.allCharacters.filter((c) => names.has(c.name))
    },
    allItems() {
      return this.$store.state.party_items ?? []
    },
    partyItemBundle() {
      if (!this.activeParty) return []
      const names = new Set(this.activeParty.members)
      return this.allItems.filter(
        (item) =>
          names.has(item.carried_by) ||
          names.has(item.equipped_by) ||
          (item.carried_by === 'party' &&
            (item.party_id === this.activeParty.id || !item.party_id))
      )
    },
    topLevelLocations() {
      return this.$store.state.locations ?? []
    },
    selectedLocationData() {
      if (!this.selectedLocation) return null
      return (
        this.topLevelLocations.find((l) => l.name === this.selectedLocation) ??
        null
      )
    },
    allNpcs() {
      return this.$store.state.npcs ?? []
    },
    localNpcs() {
      if (!this.selectedLocation) return []
      const prefix = this.selectedLocation.toLowerCase()
      return this.allNpcs.filter((npc) =>
        (npc.location ?? '').toLowerCase().startsWith(prefix)
      )
    },
    knownNpcsFromRels() {
      const rels = this.$store.state.relationships ?? []
      const partyNames = new Set(
        (this.activeParty?.members ?? []).map((n) => n.toLowerCase())
      )
      const localNpcNames = new Set(
        this.localNpcs.map((n) => n.name.toLowerCase())
      )
      const knownNames = new Set()
      for (const rel of rels) {
        const people = (rel.people ?? []).map((p) => p.toLowerCase())
        if (people.some((p) => partyNames.has(p))) {
          people
            .filter((p) => !partyNames.has(p) && !localNpcNames.has(p))
            .forEach((p) => knownNames.add(p))
        }
      }
      return this.allNpcs.filter((npc) =>
        knownNames.has(npc.name.toLowerCase())
      )
    },
    allRelevantNpcs() {
      const seen = new Set()
      return [...this.localNpcs, ...this.knownNpcsFromRels].filter((npc) => {
        if (seen.has(npc.name)) return false
        seen.add(npc.name)
        return true
      })
    },
    relevantRelationships() {
      const rels = this.$store.state.relationships ?? []
      const partyNames = new Set(
        (this.activeParty?.members ?? []).map((n) => n.toLowerCase())
      )
      const npcNames = new Set(
        this.allRelevantNpcs.map((n) => n.name.toLowerCase())
      )
      const known = new Set([...partyNames, ...npcNames])
      return rels.filter((r) =>
        (r.people ?? []).some((p) => known.has(p.toLowerCase()))
      )
    },
    partyGold() {
      return this.$store.state.finances?.party_purse?.gold ?? 0
    },
    rawGithubUrl() {
      return `${GITHUB_RAW_BASE}${this.generatedPath}`
    },
  },

  methods: {
    equippedItems(character) {
      return this.partyItemBundle.filter(
        (i) => i.equipped_by === character.name
      )
    },

    classLine(char) {
      return (char.classes ?? [])
        .map(
          (c) => `${c.name}${c.subclass ? ` (${c.subclass})` : ''} ${c.level}`
        )
        .join(' / ')
    },

    buildMarkdown() {
      const party = this.activeParty
      const date = new Date().toISOString().split('T')[0]
      const lines = []

      lines.push(`# ${party.name} — Campaign Context`)
      lines.push(
        `*Generated ${date} · Campaign Day ${
          this.activePartyDay ?? '?'
        } · ${this.partyGold.toLocaleString()} gp*`
      )
      lines.push('')
      lines.push('---')
      lines.push('')

      // ── Characters ──────────────────────────────────────────
      lines.push('## The Party')
      lines.push('')
      for (const char of this.activeMembers) {
        lines.push(`### ${char.name}`)
        const classLabel = this.classLine(char)
        lines.push(`**${char.race} · ${classLabel}**`)
        lines.push('')
        if (char.appearance) lines.push(char.appearance)
        if (char.notes) lines.push('')
        if (char.notes) lines.push(char.notes)
        lines.push('')
        const gear = this.equippedItems(char)
        if (gear.length) {
          lines.push(
            `**Equipped:** ${gear
              .map(
                (i) =>
                  i.name +
                  (i.enhancement_bonus ? ` (+${i.enhancement_bonus})` : '')
              )
              .join(', ')}`
          )
          lines.push('')
        }
        const spellAbility = char.spellcasting_ability
        if (spellAbility) {
          lines.push(
            `**Spellcasting:** ${spellAbility.toUpperCase()} · HP ${
              char.hp_current
            }/${char.hp_max}`
          )
          lines.push('')
        } else {
          lines.push(`**HP:** ${char.hp_current}/${char.hp_max}`)
          lines.push('')
        }
      }

      // Party pool items (carried_by === 'party')
      const poolItems = this.partyItemBundle.filter(
        (i) => i.carried_by === 'party'
      )
      if (poolItems.length) {
        lines.push('### Party Pool')
        lines.push('')
        lines.push(poolItems.map((i) => `- ${i.name}`).join('\n'))
        lines.push('')
      }

      lines.push('---')
      lines.push('')

      // ── Current location ────────────────────────────────────
      if (this.selectedLocationData) {
        const loc = this.selectedLocationData
        lines.push(`## Current Location: ${loc.name}`)
        lines.push('')
        if (loc.description) lines.push(loc.description)
        if (loc.notes) {
          lines.push('')
          lines.push(loc.notes)
        }
        if (loc.faction_presence?.length) {
          lines.push('')
          lines.push(`**Faction presence:** ${loc.faction_presence.join(', ')}`)
        }

        // Districts
        if (loc.districts?.length) {
          lines.push('')
          lines.push('### Districts')
          for (const d of loc.districts) {
            lines.push('')
            lines.push(`**${d.name}**`)
            if (d.description) lines.push(d.description)
            if (d.faction_presence?.length)
              lines.push(`Factions: ${d.faction_presence.join(', ')}`)
          }
        }

        // Named sub-locations
        if (loc.locations?.length) {
          lines.push('')
          lines.push('### Notable Places')
          for (const sub of loc.locations) {
            const npcHere = this.localNpcs
              .filter(
                (n) =>
                  (n.location ?? '').toLowerCase() ===
                  `${this.selectedLocation.toLowerCase()}, ${sub.name.toLowerCase()}`
              )
              .map((n) => n.name)
            lines.push('')
            lines.push(
              `**${sub.name}**${
                npcHere.length ? ` — ${npcHere.join(', ')}` : ''
              }`
            )
            if (sub.description) lines.push(sub.description)
            if (sub.notes) lines.push(sub.notes)
          }
        }

        lines.push('')
        lines.push('---')
        lines.push('')
      }

      // ── NPCs ────────────────────────────────────────────────
      if (this.allRelevantNpcs.length) {
        lines.push('## Known NPCs')
        lines.push('')

        for (const npc of this.allRelevantNpcs) {
          lines.push(`### ${npc.name}`)
          const tags = [npc.role, npc.location].filter(Boolean)
          if (tags.length) lines.push(`*${tags.join(' · ')}*`)
          lines.push('')
          if (npc.appearance) lines.push(npc.appearance)
          if (npc.personality_traits) {
            lines.push('')
            lines.push(npc.personality_traits)
          }
          if (npc.personality_quirks) lines.push(npc.personality_quirks)
          if (npc.notes) {
            lines.push('')
            lines.push(npc.notes)
          }
          if (npc.status?.length) {
            lines.push('')
            lines.push(`**Status:** ${npc.status.join(', ')}`)
          }

          // Relationship to party
          const partyNames = new Set(
            (this.activeParty?.members ?? []).map((n) => n.toLowerCase())
          )
          const npcRels = this.relevantRelationships.filter(
            (r) =>
              (r.people ?? []).some(
                (p) => p.toLowerCase() === npc.name.toLowerCase()
              ) && (r.people ?? []).some((p) => partyNames.has(p.toLowerCase()))
          )
          for (const rel of npcRels) {
            const partyPerson = (rel.people ?? []).find((p) =>
              partyNames.has(p.toLowerCase())
            )
            lines.push(
              `**Relationship with ${partyPerson}:** ${rel.type}${
                rel.notes ? ' — ' + rel.notes : ''
              }`
            )
          }

          lines.push('')
        }

        lines.push('---')
        lines.push('')
      }

      // ── PC–PC relationships ──────────────────────────────────
      const partyNames = new Set(
        (this.activeParty?.members ?? []).map((n) => n.toLowerCase())
      )
      const pcRels = this.relevantRelationships.filter((r) =>
        (r.people ?? []).every((p) => partyNames.has(p.toLowerCase()))
      )
      if (pcRels.length) {
        lines.push('## Party Dynamics')
        lines.push('')
        for (const rel of pcRels) {
          const [a, b] = rel.people
          lines.push(
            `**${a} & ${b}** — ${rel.type}${rel.notes ? ': ' + rel.notes : ''}`
          )
        }
        lines.push('')
      }

      return lines.join('\n')
    },

    async generateFile() {
      if (!this.activeParty || this.generating) return
      this.generating = true
      this.writeError = ''
      this.generatedPath = ''
      this.generated = false

      try {
        const content = this.buildMarkdown()
        const filename = this.activeParty.name
        const res = await fetch('http://localhost:3001/api/dm-context', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename, content }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || res.statusText)
        this.generatedPath = data.path
        this.generated = true
        setTimeout(() => {
          this.generated = false
        }, 3000)
      } catch (err) {
        this.writeError = err.message
      } finally {
        this.generating = false
      }
    },

    copyJson() {
      const payload = {
        party: {
          name: this.activeParty.name,
          day: this.activePartyDay,
          gold: this.partyGold,
        },
        characters: this.activeMembers,
        items: this.partyItemBundle,
        ...(this.selectedLocationData
          ? { current_location: this.selectedLocationData }
          : {}),
        ...(this.allRelevantNpcs.length ? { npcs: this.allRelevantNpcs } : {}),
        ...(this.relevantRelationships.length
          ? { relationships: this.relevantRelationships }
          : {}),
      }
      navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
      this.copied = true
      setTimeout(() => {
        this.copied = false
      }, 1800)
    },

    copyUrl() {
      navigator.clipboard.writeText(this.rawGithubUrl)
      this.urlCopied = true
      setTimeout(() => {
        this.urlCopied = false
      }, 1800)
    },
  },
}
</script>

<style scoped>
.dm-export {
  padding: 2vh 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-width: 640px;
}

.dm-title {
  font-family: var(--font-display);
  font-size: var(--font-size-lg);
  color: var(--color-text);
  margin: 0 0 0.4rem;
}

.dm-desc {
  font-size: var(--font-size-sm);
  color: var(--color-text-low);
  margin: 0;
  line-height: 1.5;
}

.dm-desc code {
  font-size: 0.95em;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 3px;
  padding: 0.05em 0.3em;
}

.dm-row {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.dm-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-low);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.dm-select {
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text);
  padding: 0.4em 0.6em;
  font-size: var(--font-size-md);
  max-width: 320px;
}

.dm-summary {
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 0.75rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: var(--font-size-sm);
}

.summary-label {
  color: var(--color-text-low);
}

.summary-val {
  color: var(--color-text);
  font-weight: 500;
}

.summary-sub {
  font-weight: 400;
  color: var(--color-text-low);
  margin-left: 0.3em;
}

.dm-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.action-btn {
  background: var(--color-bg-panel);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 0.5em 1.2em;
  font-size: var(--font-size-md);
  cursor: pointer;
  transition: border-color 0.15s;
}

.action-btn:hover:not(:disabled) {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.action-btn--primary {
  background: var(--color-accent);
  color: var(--color-bg);
  border-color: var(--color-accent);
  font-weight: 600;
}

.action-btn--primary:hover:not(:disabled) {
  color: var(--color-bg);
  background: var(--color-accent-strong);
  border-color: var(--color-accent-strong);
}

.action-btn--done {
  background: var(--color-accent-strong) !important;
  border-color: var(--color-accent-strong) !important;
}

.action-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.dm-hint {
  font-size: var(--font-size-sm);
  color: var(--color-text-low);
}

.dm-result {
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 0.75rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.result-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-low);
}

.result-url {
  font-size: var(--font-size-sm);
  color: var(--color-accent);
  word-break: break-all;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 3px;
  padding: 0.4em 0.6em;
  display: block;
}

.ghost-btn {
  align-self: flex-start;
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text-low);
  padding: 0.2em 0.7em;
  font-size: var(--font-size-sm);
  cursor: pointer;
}

.ghost-btn:hover {
  color: var(--color-text);
  border-color: var(--color-text-low);
}

.dm-error {
  background: #3a1a1a;
  border: 1px solid #7a2a2a;
  border-radius: 4px;
  color: #f28b82;
  padding: 0.6em 1em;
  font-size: var(--font-size-sm);
}
</style>
