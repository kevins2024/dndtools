<template>
  <div class="networks">
    <!-- ── Sending Stone Networks ─────────────────── -->
    <section class="net-section">
      <div class="net-section-header">
        <span class="net-section-title">Sending Stone Networks</span>
        <button class="net-add-btn" @click="addNetwork">+ Add Network</button>
      </div>

      <div v-if="!stoneNetworks.length" class="empty-state">
        No networks recorded.
      </div>

      <div
        v-for="(net, ni) in stoneNetworks"
        :key="net.id"
        class="network-card"
      >
        <div class="network-header">
          <div class="network-title-row">
            <input
              class="network-name-input"
              :value="net.label"
              placeholder="Network name…"
              @input="updateNetwork(ni, 'label', $event.target.value)"
            />
            <button
              class="net-delete-btn"
              title="Remove network"
              @click="removeNetwork(ni)"
            >
              ✕
            </button>
          </div>
          <div class="network-hub-row">
            <span class="hub-label">Hub</span>
            <input
              class="hub-input"
              :value="net.hub"
              placeholder="Hub holder…"
              @input="updateNetwork(ni, 'hub', $event.target.value)"
            />
          </div>
        </div>

        <div class="member-list">
          <div
            v-for="(member, mi) in net.members"
            :key="mi"
            class="member-row"
            :class="{ 'member-row--hub': member.holder === net.hub }"
          >
            <button
              class="status-dot"
              :class="'status-dot--' + member.status"
              :title="stoneStatusLabel(member.status)"
              @click="cycleMemberStatus(ni, mi)"
            >
              ●
            </button>
            <span v-if="member.holder === net.hub" class="hub-badge">HUB</span>
            <input
              class="member-holder-input"
              :value="member.holder"
              placeholder="Holder…"
              @input="updateMember(ni, mi, 'holder', $event.target.value)"
            />
            <input
              class="member-notes-input"
              :value="member.notes"
              placeholder="notes…"
              @input="updateMember(ni, mi, 'notes', $event.target.value)"
            />
            <button class="member-delete-btn" @click="removeMember(ni, mi)">
              ✕
            </button>
          </div>
        </div>

        <div class="network-footer">
          <button class="add-member-btn" @click="addMember(ni)">
            + Add member
          </button>
          <textarea
            class="network-notes"
            :value="net.notes"
            placeholder="Network notes…"
            rows="1"
            @input="updateNetwork(ni, 'notes', $event.target.value)"
          ></textarea>
        </div>
      </div>
    </section>

    <!-- ── Sending Stone Pairs ────────────────────── -->
    <section class="net-section">
      <div class="net-section-header">
        <span class="net-section-title">Sending Stone Pairs</span>
        <button class="net-add-btn" @click="addPair">+ Add Pair</button>
      </div>

      <div v-if="!pairs.length" class="empty-state">
        No sending stone pairs recorded.
      </div>

      <div v-for="(pair, pi) in pairs" :key="pair.id" class="pair-card">
        <div class="pair-header">
          <input
            class="pair-name-input"
            :value="pair.label"
            placeholder="Pair name…"
            @input="updatePair(pi, 'label', $event.target.value)"
          />
          <button
            class="net-delete-btn"
            title="Remove pair"
            @click="removePair(pi)"
          >
            ✕
          </button>
        </div>

        <div class="stones-row">
          <div
            v-for="side in ['stone_a', 'stone_b']"
            :key="side"
            class="stone-card"
          >
            <input
              class="stone-label-input"
              :value="pair[side].label"
              placeholder="Stone label…"
              @input="updateStone(pi, side, 'label', $event.target.value)"
            />
            <div class="stone-field">
              <span class="stone-field-label">Holder</span>
              <input
                class="stone-input"
                :value="pair[side].holder"
                placeholder="—"
                @input="updateStone(pi, side, 'holder', $event.target.value)"
              />
            </div>
            <div class="stone-field">
              <span class="stone-field-label">Location</span>
              <input
                class="stone-input"
                :value="pair[side].location"
                placeholder="—"
                @input="updateStone(pi, side, 'location', $event.target.value)"
              />
            </div>
            <div class="stone-field">
              <span class="stone-field-label">Status</span>
              <button
                class="status-chip"
                :class="'status-chip--' + pair[side].status"
                @click="cycleStoneStatus(pi, side)"
              >
                {{ stoneStatusLabel(pair[side].status) }}
              </button>
            </div>
          </div>
          <div class="pair-link">↔</div>
        </div>

        <textarea
          v-if="pair.notes !== undefined"
          class="pair-notes"
          :value="pair.notes"
          placeholder="Pair notes…"
          rows="1"
          @input="updatePair(pi, 'notes', $event.target.value)"
        ></textarea>
      </div>
    </section>

    <!-- ── Teleportation ────────────────────────────── -->
    <section class="net-section">
      <div class="net-section-header">
        <span class="net-section-title">Teleportation</span>
        <button class="net-add-btn" @click="addCircle">+ Add Entry</button>
      </div>

      <div v-if="!circles.length" class="empty-state">
        No teleportation points recorded.
      </div>

      <div v-for="(circle, ci) in circles" :key="circle.id" class="circle-card">
        <div class="circle-header">
          <input
            class="circle-location-input"
            :value="circle.location"
            placeholder="Location name…"
            @input="updateCircle(ci, 'location', $event.target.value)"
          />
          <button
            class="net-delete-btn"
            title="Remove circle"
            @click="removeCircle(ci)"
          >
            ✕
          </button>
        </div>

        <div class="circle-meta">
          <button
            class="toggle-chip"
            :class="{ 'toggle-chip--on': circle.sigil_known }"
            @click="updateCircle(ci, 'sigil_known', !circle.sigil_known)"
          >
            {{ circle.sigil_known ? '✓ Sigil Known' : '✗ Sigil Unknown' }}
          </button>
          <button
            class="toggle-chip"
            :class="{ 'toggle-chip--on': circle.permanent }"
            @click="updateCircle(ci, 'permanent', !circle.permanent)"
          >
            {{ circle.permanent ? 'Permanent' : 'Temporary' }}
          </button>
          <button
            class="status-chip"
            :class="'status-chip--access-' + circle.access"
            @click="cycleCircleAccess(ci)"
          >
            {{ circleAccessLabel(circle.access) }}
          </button>
        </div>

        <textarea
          class="circle-notes"
          :value="circle.notes"
          placeholder="Notes — sigil sequence, conditions, history…"
          rows="2"
          @input="updateCircle(ci, 'notes', $event.target.value)"
        ></textarea>
      </div>
    </section>

    <!-- ── Wizard Spellbooks ──────────────────────── -->
    <section class="net-section">
      <div class="net-section-header">
        <span class="net-section-title">Wizard Spellbooks</span>
      </div>

      <div v-if="!spellbooks.length" class="empty-state">
        No spellbooks recorded.
      </div>

      <div v-for="sb in spellbooks" :key="sb.id" class="network-card">
        <div class="network-header">
          <div class="network-title-row">
            <input
              class="network-name-input"
              :value="sb.name"
              placeholder="Spellbook name…"
              @input="updateSpellbook(sb.id, 'name', $event.target.value)"
            />
            <button
              class="net-delete-btn"
              title="Remove spellbook"
              @click="removeSpellbook(sb.id)"
            >
              ✕
            </button>
          </div>
          <div class="network-hub-row">
            <span class="hub-label">{{ (sb.spells || []).length }} spells</span>
          </div>
        </div>

        <div class="member-list">
          <div v-if="!spellbookOwners(sb.id).length" class="empty-state">
            No one currently uses this spellbook.
          </div>
          <div
            v-for="name in spellbookOwners(sb.id)"
            :key="name"
            class="member-row"
          >
            <span class="hub-badge">{{ name }}</span>
          </div>
        </div>

        <div class="network-footer">
          <select
            class="hub-input"
            title="Merges their known spells into this book — their own prepared spells stay theirs."
            @change="onLinkPick(sb.id, $event)"
          >
            <option value="" selected disabled>Link a Wizard in…</option>
            <option
              v-for="name in linkableWizards(sb.id)"
              :key="name"
              :value="name"
            >
              {{ name }}
            </option>
          </select>
          <textarea
            class="network-notes"
            :value="sb.notes"
            placeholder="Spellbook notes…"
            rows="1"
            @input="updateSpellbook(sb.id, 'notes', $event.target.value)"
          ></textarea>
        </div>
      </div>
    </section>
  </div>
</template>

<script>
let nextId = Date.now()

const STONE_STATUSES = ['active', 'lost', 'destroyed', 'unknown']
const CIRCLE_ACCESS = ['open', 'guarded', 'restricted', 'one_way', 'unknown']

function blankMember() {
  return { holder: '', notes: '', status: 'active' }
}

function blankNetwork() {
  return {
    id: `ssn_${nextId++}`,
    label: '',
    hub: '',
    notes: '',
    members: [blankMember()],
  }
}

function blankStone(label) {
  return { label, holder: '', location: '', status: 'unknown', notes: '' }
}

function blankPair() {
  return {
    id: `ss_${nextId++}`,
    label: '',
    notes: '',
    stone_a: blankStone('Stone A'),
    stone_b: blankStone('Stone B'),
  }
}

function blankCircle() {
  return {
    id: `tc_${nextId++}`,
    location: '',
    sigil_known: false,
    access: 'unknown',
    permanent: true,
    notes: '',
  }
}

export default {
  name: 'NetworksContext',

  computed: {
    networks() {
      return (
        this.$store.state.networks ?? {
          sending_stone_networks: [],
          sending_stones: [],
          teleportation_circles: [],
        }
      )
    },
    stoneNetworks() {
      return this.networks.sending_stone_networks ?? []
    },
    pairs() {
      return this.networks.sending_stones ?? []
    },
    circles() {
      return this.networks.teleportation_circles ?? []
    },
    spellbooks() {
      return this.$store.state.spellbooks ?? []
    },
    allCharacters() {
      return this.$store.state.characters ?? []
    },
  },

  methods: {
    save(updated) {
      this.$store.commit('UPDATE_TABLE_ITEM', {
        table: 'networks',
        updatedItem: updated,
      })
    },
    saved(patch) {
      this.save({
        sending_stone_networks: this.stoneNetworks,
        sending_stones: this.pairs,
        teleportation_circles: this.circles,
        ...patch,
      })
    },

    // ── Stone Networks ──
    addNetwork() {
      this.saved({
        sending_stone_networks: [...this.stoneNetworks, blankNetwork()],
      })
    },
    removeNetwork(i) {
      this.saved({
        sending_stone_networks: this.stoneNetworks.filter(
          (_, idx) => idx !== i
        ),
      })
    },
    updateNetwork(i, field, value) {
      this.saved({
        sending_stone_networks: this.stoneNetworks.map((n, idx) =>
          idx === i ? { ...n, [field]: value } : n
        ),
      })
    },
    addMember(ni) {
      const nets = this.stoneNetworks.map((n, idx) =>
        idx === ni ? { ...n, members: [...n.members, blankMember()] } : n
      )
      this.saved({ sending_stone_networks: nets })
    },
    removeMember(ni, mi) {
      const nets = this.stoneNetworks.map((n, idx) =>
        idx === ni ? { ...n, members: n.members.filter((_, i) => i !== mi) } : n
      )
      this.saved({ sending_stone_networks: nets })
    },
    updateMember(ni, mi, field, value) {
      const nets = this.stoneNetworks.map((n, idx) => {
        if (idx !== ni) return n
        return {
          ...n,
          members: n.members.map((m, i) =>
            i === mi ? { ...m, [field]: value } : m
          ),
        }
      })
      this.saved({ sending_stone_networks: nets })
    },
    cycleMemberStatus(ni, mi) {
      const current = this.stoneNetworks[ni].members[mi].status
      const next =
        STONE_STATUSES[
          (STONE_STATUSES.indexOf(current) + 1) % STONE_STATUSES.length
        ]
      this.updateMember(ni, mi, 'status', next)
    },

    // ── Sending Stone Pairs ──
    addPair() {
      this.saved({ sending_stones: [...this.pairs, blankPair()] })
    },
    removePair(i) {
      this.saved({ sending_stones: this.pairs.filter((_, idx) => idx !== i) })
    },
    updatePair(i, field, value) {
      this.saved({
        sending_stones: this.pairs.map((p, idx) =>
          idx === i ? { ...p, [field]: value } : p
        ),
      })
    },
    updateStone(pi, side, field, value) {
      this.saved({
        sending_stones: this.pairs.map((p, idx) =>
          idx === pi ? { ...p, [side]: { ...p[side], [field]: value } } : p
        ),
      })
    },
    cycleStoneStatus(pi, side) {
      const current = this.pairs[pi][side].status
      const next =
        STONE_STATUSES[
          (STONE_STATUSES.indexOf(current) + 1) % STONE_STATUSES.length
        ]
      this.updateStone(pi, side, 'status', next)
    },
    stoneStatusLabel(status) {
      return (
        {
          active: '● Active',
          lost: '◌ Lost',
          destroyed: '✕ Destroyed',
          unknown: '? Unknown',
        }[status] ?? status
      )
    },

    // ── Teleportation Circles ──
    addCircle() {
      this.saved({ teleportation_circles: [...this.circles, blankCircle()] })
    },
    removeCircle(i) {
      this.saved({
        teleportation_circles: this.circles.filter((_, idx) => idx !== i),
      })
    },
    updateCircle(i, field, value) {
      this.saved({
        teleportation_circles: this.circles.map((c, idx) =>
          idx === i ? { ...c, [field]: value } : c
        ),
      })
    },
    cycleCircleAccess(i) {
      const current = this.circles[i].access
      const next =
        CIRCLE_ACCESS[
          (CIRCLE_ACCESS.indexOf(current) + 1) % CIRCLE_ACCESS.length
        ]
      this.updateCircle(i, 'access', next)
    },
    circleAccessLabel(access) {
      return (
        {
          open: '● Open',
          guarded: '◑ Guarded',
          restricted: '✕ Restricted',
          one_way: '→ One-Way',
          unknown: '? Unknown',
        }[access] ?? access
      )
    },

    // ── Wizard Spellbooks ── (own table, not the networks blob — see
    // spellUtils.js's header comment for the model: sharing is just two
    // characters' spellbook_id pointing at the same entry, so there's no
    // "members" list on the spellbook itself the way sending-stone networks
    // have — who's using a book is derived by scanning characters instead.)
    spellbookOwners(spellbookId) {
      return this.allCharacters
        .filter((c) => c.spellbook_id === spellbookId)
        .map((c) => c.name)
    },
    linkableWizards(spellbookId) {
      return this.allCharacters
        .filter(
          (c) =>
            c.spellbook_id &&
            c.spellbook_id !== spellbookId &&
            (c.classes ?? []).some((cc) => cc.name?.toLowerCase() === 'wizard')
        )
        .map((c) => c.name)
    },
    updateSpellbook(id, field, value) {
      const sb = this.spellbooks.find((s) => s.id === id)
      if (!sb) return
      this.$store.commit('UPDATE_TABLE_ITEM', {
        table: 'spellbooks',
        updatedItem: { ...sb, [field]: value },
      })
    },
    removeSpellbook(id) {
      this.$store.commit('SET_TABLE', {
        table: 'spellbooks',
        data: this.spellbooks.filter((s) => s.id !== id),
      })
    },
    // "Someone learns the feat" — union the character's current spellbook
    // into the target, repoint their spellbook_id, done. One-time, manual,
    // not an ongoing sync. Their own prepared_spells is untouched — what
    // they already have prepared today stays prepared.
    linkCharacterToSpellbook(characterName, targetId) {
      const char = this.allCharacters.find((c) => c.name === characterName)
      const target = this.spellbooks.find((s) => s.id === targetId)
      if (!char || !target) return
      const current = this.spellbooks.find((s) => s.id === char.spellbook_id)
      const known = new Set((target.spells ?? []).map((s) => s.name))
      const merged = [
        ...(target.spells ?? []),
        ...(current?.spells ?? []).filter((s) => !known.has(s.name)),
      ]
      this.$store.commit('UPDATE_TABLE_ITEM', {
        table: 'spellbooks',
        updatedItem: { ...target, spells: merged },
      })
      this.$store.commit('UPDATE_TABLE_ITEM', {
        table: 'characters',
        updatedItem: { ...char, spellbook_id: targetId },
      })
    },
    // Fires the link immediately on pick rather than a separate "+Link"
    // button + tracked dropdown state — avoids a real Vue 2 reactivity trap
    // (v-model on a dynamically-keyed object, linkPicks[sb.id], doesn't
    // reactively update template reads of that same key unless the key
    // already existed at init or $set was used) and is one click instead of
    // two anyway. Resets the select back to the placeholder afterward.
    onLinkPick(spellbookId, event) {
      const name = event.target.value
      if (!name) return
      this.linkCharacterToSpellbook(name, spellbookId)
      event.target.value = ''
    },
  },
}
</script>

<style scoped>
.networks {
  display: flex;
  flex-direction: column;
  gap: 0;
  height: 100%;
  overflow-y: auto;
  padding: 1.5rem 2rem;
  scrollbar-width: thin;
  scrollbar-color: var(--color-scrollbar) transparent;
}

/* ── Sections ── */
.net-section {
  margin-bottom: 2.5rem;
}

.net-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
  padding-bottom: 0.4rem;
  border-bottom: 1px solid var(--color-border);
}

.net-section-title {
  font-family: var(--font-display);
  font-size: var(--font-size-lg);
  color: var(--color-accent-strong);
  letter-spacing: 0.05em;
}

.net-add-btn {
  padding: 0.2rem 0.75rem;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text-low);
  font-family: var(--font-display);
  font-size: var(--font-size-base);
  cursor: pointer;
  transition: all 0.12s;
}
.net-add-btn:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.net-delete-btn {
  background: none;
  border: none;
  color: var(--color-text-low);
  cursor: pointer;
  font-size: var(--font-size-md);
  padding: 0.1rem 0.35rem;
  border-radius: 3px;
  flex-shrink: 0;
}
.net-delete-btn:hover {
  color: var(--color-danger);
}

.empty-state {
  color: var(--color-text-low);
  font-style: italic;
  font-size: var(--font-size-base);
  padding: 0.5rem 0;
}

/* ── Network cards ── */
.network-card {
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 0.75rem 1rem;
  margin-bottom: 1rem;
}

.network-header {
  margin-bottom: 0.6rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.network-title-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.network-name-input {
  flex: 1;
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-accent);
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  letter-spacing: 0.04em;
  outline: none;
  padding: 0.15rem 0;
}
.network-name-input:focus {
  border-bottom-color: var(--color-accent);
}
.network-name-input::placeholder {
  color: var(--color-text-low);
}

.network-hub-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding-left: 0.1rem;
}

.hub-label {
  font-size: var(--font-size-base);
  color: var(--color-text-low);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-family: var(--font-display);
  width: 2.5rem;
  flex-shrink: 0;
}

.hub-input {
  background: transparent;
  border: none;
  border-bottom: 1px solid transparent;
  color: var(--color-accent-strong);
  font-family: var(--font-body);
  font-size: var(--font-size-base);
  font-weight: 600;
  outline: none;
  padding: 0.1rem 0;
}
.hub-input:focus {
  border-bottom-color: var(--color-border);
}

/* ── Member list ── */
.member-list {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  margin-bottom: 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  overflow: hidden;
}

.member-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.3rem 0.6rem;
  background: var(--color-bg-surface);
  border-bottom: 1px solid var(--color-border);
}
.member-row:last-child {
  border-bottom: none;
}
.member-row--hub {
  background: color-mix(
    in srgb,
    var(--color-bg-surface) 80%,
    var(--color-accent) 20%
  );
}

.status-dot {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  font-size: 0.65rem;
  flex-shrink: 0;
  line-height: 1;
}
.status-dot--active {
  color: var(--color-success);
}
.status-dot--lost {
  color: var(--color-neutral-amber);
}
.status-dot--destroyed {
  color: var(--color-danger);
}
.status-dot--unknown {
  color: var(--color-text-low);
}

.hub-badge {
  font-family: var(--font-display);
  font-size: 0.6rem;
  letter-spacing: 0.08em;
  color: var(--color-accent);
  border: 1px solid var(--color-accent);
  border-radius: 3px;
  padding: 0 0.3rem;
  flex-shrink: 0;
  line-height: 1.5;
}

.member-holder-input {
  background: transparent;
  border: none;
  color: var(--color-text);
  font-family: var(--font-body);
  font-size: var(--font-size-base);
  outline: none;
  width: 10rem;
  flex-shrink: 0;
  padding: 0;
}
.member-holder-input:focus {
  border-bottom: 1px solid var(--color-border);
}

.member-notes-input {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--color-text-low);
  font-family: var(--font-body);
  font-size: var(--font-size-base);
  outline: none;
  padding: 0;
  min-width: 0;
  font-style: italic;
}
.member-notes-input:focus {
  border-bottom: 1px solid var(--color-border);
  font-style: normal;
  color: var(--color-text);
}

.member-delete-btn {
  background: none;
  border: none;
  color: transparent;
  cursor: pointer;
  font-size: 0.65rem;
  padding: 0 0.2rem;
  flex-shrink: 0;
}
.member-row:hover .member-delete-btn {
  color: var(--color-text-low);
}
.member-delete-btn:hover {
  color: var(--color-danger) !important;
}

.network-footer {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.add-member-btn {
  background: none;
  border: 1px dashed var(--color-border);
  border-radius: 4px;
  color: var(--color-text-low);
  cursor: pointer;
  font-family: var(--font-display);
  font-size: var(--font-size-base);
  padding: 0.2rem 0.65rem;
  white-space: nowrap;
  flex-shrink: 0;
}
.add-member-btn:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.network-notes {
  flex: 1;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 3px;
  color: var(--color-text-muted);
  font-family: var(--font-body);
  font-size: var(--font-size-base);
  resize: none;
  outline: none;
  padding: 0.2rem 0;
  box-sizing: border-box;
}
.network-notes:focus {
  border-color: var(--color-border);
}
.network-notes::placeholder {
  color: var(--color-text-low);
  font-style: italic;
}

/* ── Sending Stone Pairs ── */
.pair-card {
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 0.75rem 1rem;
  margin-bottom: 1rem;
}

.pair-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.pair-name-input {
  flex: 1;
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-accent);
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  letter-spacing: 0.04em;
  outline: none;
  padding: 0.15rem 0;
}
.pair-name-input:focus {
  border-bottom-color: var(--color-accent);
}
.pair-name-input::placeholder {
  color: var(--color-text-low);
}

.stones-row {
  display: flex;
  gap: 0;
  align-items: stretch;
  position: relative;
}

.stone-card {
  flex: 1;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 0.6rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.stone-card:first-child {
  border-radius: 6px 0 0 6px;
  border-right: none;
}
.stone-card:last-child {
  border-radius: 0 6px 6px 0;
  border-left: none;
}

.pair-link {
  display: flex;
  align-items: center;
  padding: 0 0.5rem;
  color: var(--color-text-low);
  font-size: var(--font-size-lg);
  flex-shrink: 0;
  align-self: center;
}

.stone-label-input {
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  font-family: var(--font-display);
  font-size: var(--font-size-base);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  outline: none;
  padding: 0;
  width: 100%;
}
.stone-label-input::placeholder {
  color: var(--color-text-low);
}

.stone-field {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.stone-field-label {
  font-size: var(--font-size-base);
  color: var(--color-text-low);
  width: 4rem;
  flex-shrink: 0;
}

.stone-input {
  flex: 1;
  background: transparent;
  border: none;
  border-bottom: 1px solid transparent;
  color: var(--color-text);
  font-family: var(--font-body);
  font-size: var(--font-size-base);
  outline: none;
  padding: 0.1rem 0;
  min-width: 0;
}
.stone-input:focus {
  border-bottom-color: var(--color-border);
}
.stone-input::placeholder {
  color: var(--color-text-low);
}

.pair-notes,
.circle-notes {
  width: 100%;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 3px;
  color: var(--color-text-muted);
  font-family: var(--font-body);
  font-size: var(--font-size-base);
  resize: none;
  outline: none;
  padding: 0.2rem 0;
  box-sizing: border-box;
}
.pair-notes:focus,
.circle-notes:focus {
  border-color: var(--color-border);
}
.pair-notes::placeholder,
.circle-notes::placeholder {
  color: var(--color-text-low);
  font-style: italic;
}

.pair-notes {
  margin-top: 0.5rem;
}

/* ── Status chips ── */
.status-chip {
  font-size: var(--font-size-base);
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: none;
  cursor: pointer;
  transition: all 0.12s;
  white-space: nowrap;
}
.status-chip--active {
  color: var(--color-success);
  border-color: var(--color-success);
}
.status-chip--lost {
  color: var(--color-neutral-amber);
  border-color: var(--color-neutral-amber);
}
.status-chip--destroyed {
  color: var(--color-danger);
  border-color: var(--color-danger);
}
.status-chip--unknown {
  color: var(--color-text-low);
}

.status-chip--access-open {
  color: var(--color-success);
  border-color: var(--color-success);
}
.status-chip--access-guarded {
  color: var(--color-neutral-amber);
  border-color: var(--color-neutral-amber);
}
.status-chip--access-restricted {
  color: var(--color-danger);
  border-color: var(--color-danger);
}
.status-chip--access-one_way {
  color: var(--color-info);
  border-color: var(--color-info);
}
.status-chip--access-unknown {
  color: var(--color-text-low);
}

/* ── Toggle chips ── */
.toggle-chip {
  font-size: var(--font-size-base);
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: none;
  color: var(--color-text-low);
  cursor: pointer;
  transition: all 0.12s;
}
.toggle-chip--on {
  color: var(--color-accent);
  border-color: var(--color-accent);
}

/* ── Teleportation circles ── */
.circle-card {
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 0.75rem 1rem;
  margin-bottom: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.circle-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.circle-location-input {
  flex: 1;
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text);
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  outline: none;
  padding: 0.15rem 0;
}
.circle-location-input:focus {
  border-bottom-color: var(--color-accent);
}
.circle-location-input::placeholder {
  color: var(--color-text-low);
}

.circle-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  align-items: center;
}

.circle-notes {
  margin-top: 0.15rem;
}
</style>
