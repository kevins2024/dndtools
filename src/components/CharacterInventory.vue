<template>
  <div class="inventory-manager">
    <!-- Search bar -->
    <div class="search-section">
      <input
        v-model="itemSearch"
        class="search-input"
        placeholder="Search all items by name…"
      />
      <div v-if="itemSearch.trim()" class="search-results scrollable">
        <div v-if="searchResults.length === 0" class="search-empty">
          No items match "{{ itemSearch }}"
        </div>
        <div
          v-for="item in searchResults"
          :key="item.id"
          class="search-result-row"
        >
          <span class="sr-name">{{ item.name }}</span>
          <span class="sr-status">{{ itemStatus(item) }}</span>
          <button
            class="act-btn sr-take-btn"
            :disabled="
              item.carried_by === character.name ||
              item.equipped_by === character.name
            "
            @click="takeItem(item)"
          >
            {{
              item.carried_by === character.name ||
              item.equipped_by === character.name
                ? 'Yours'
                : 'Take'
            }}
          </button>
        </div>
      </div>
    </div>

    <!-- Columns -->
    <div class="inv-columns">
      <!-- Left: This character -->
      <div class="inv-column scrollable">
        <div class="col-title">{{ character.name }}</div>

        <div class="col-section">
          <div class="col-section-label">Equipped</div>
          <div v-if="hasWeaponSets" class="weapon-set-toggle">
            <span class="weapon-set-label">Active loadout:</span>
            <button
              class="act-btn weapon-set-btn"
              :class="{ active: activeWeaponSet === 1 }"
              @click="setActiveWeaponSet(1)"
            >
              Set 1
            </button>
            <button
              class="act-btn weapon-set-btn"
              :class="{ active: activeWeaponSet === 2 }"
              @click="setActiveWeaponSet(2)"
            >
              Set 2
            </button>
          </div>
          <div v-if="slotSummaries.length > 0" class="slot-summary">
            <span
              v-for="summary in slotSummaries"
              :key="summary.slot"
              class="slot-chip"
              :class="{ over: summary.over }"
            >
              {{ summary.slot }} {{ summary.count }}/{{ summary.cap }}
            </span>
            <span
              class="slot-chip"
              :class="{ over: attunedCount > 3 }"
              title="Attuned items equipped"
            >
              attunement {{ attunedCount }}/3
            </span>
          </div>
          <div v-if="equippedItems.length === 0" class="empty">
            Nothing equipped
          </div>
          <div
            v-for="item in equippedItems"
            :key="item.id"
            class="inv-item equipped"
            :class="{ overloaded: isSlotOverfilled(item) }"
            title="Click for item details"
            @click="inspectItem(item)"
          >
            <span class="item-name clickable">{{ item.name }}</span>
            <span class="item-slot">{{ item.slot || item.type }}</span>
            <span class="item-tag">{{ item.type }}</span>
            <span
              v-if="item.type === 'mount' && mountLabel(item)"
              class="item-badge mount-badge"
              title="Breed and quality tier, from the mounts homebrew catalog"
              >{{ mountLabel(item) }}</span
            >
            <span
              v-if="item.type === 'mount' && mountCatalogEntry(item)"
              class="item-badge mount-badge"
              title="Speed"
              >{{ mountCatalogEntry(item).speed }}</span
            >
            <span
              v-if="isVersatileWeapon(item)"
              class="item-badge versatile-badge"
              title="Versatile — can be wielded one- or two-handed"
              >Versatile</span
            >
            <span
              v-if="weaponProficiencyStatus(item) === 'not-proficient'"
              class="item-badge prof-badge prof-badge--warning"
              title="Not proficient with this weapon (per this character's recorded weapon_proficiencies)"
              >⚠ Not proficient</span
            >
            <span
              v-else-if="weaponProficiencyStatus(item) === 'unknown'"
              class="item-badge prof-badge prof-badge--unknown"
              title="This character has no weapon_proficiencies on record — proficiency can't be checked"
              >Proficiency?</span
            >
            <button
              v-if="item.type === 'weapon'"
              class="act-btn weapon-set-item-btn"
              :class="{
                'not-in-active-set':
                  item.weapon_set != null &&
                  item.weapon_set !== activeWeaponSet,
              }"
              :title="
                item.weapon_set == null
                  ? 'Not assigned to a loadout — click to assign Set 1'
                  : `Assigned to Set ${item.weapon_set} — click to change`
              "
              @click.stop="cycleItemWeaponSet(item)"
            >
              {{
                item.weapon_set == null ? 'Any set' : `Set ${item.weapon_set}`
              }}
            </button>
            <button
              v-if="isVersatileWeapon(item)"
              class="act-btn grip-toggle-btn"
              :title="
                item.slot === 'melee2h'
                  ? 'Wielded two-handed — click to switch to one-handed'
                  : 'Wielded one-handed — click to switch to two-handed'
              "
              @click.stop="toggleGrip(item)"
            >
              {{ item.slot === 'melee2h' ? '2H' : '1H' }}
            </button>
            <Zap
              v-if="item.needs_attunement"
              class="attunement-indicator clickable"
              :fill="item.attuned ? 'currentColor' : 'none'"
              :title="
                item.attuned
                  ? 'Attuned — click to unattune'
                  : 'Requires attunement — click to mark attuned'
              "
              @click.stop="toggleAttuned(item)"
            />
            <div v-if="item.charges_max != null" class="item-charges">
              <button
                class="charge-btn"
                :disabled="item.charges_current <= 0"
                @click.stop="spendCharge(item)"
                title="Spend charge"
              >
                −
              </button>
              <span
                class="charge-count"
                :class="{ depleted: item.charges_current === 0 }"
                >{{ item.charges_current }}/{{ item.charges_max }}</span
              >
              <button
                class="charge-btn"
                :disabled="item.charges_current >= item.charges_max"
                @click.stop="restoreCharge(item)"
                title="Restore charge"
              >
                +
              </button>
            </div>
            <div class="item-actions">
              <button
                class="act-btn"
                @click.stop="unequip(item)"
                title="Unequip"
              >
                ↓
              </button>
            </div>
          </div>
        </div>

        <div class="col-section">
          <div class="col-section-label">Carrying</div>
          <div v-if="carriedItems.length === 0" class="empty">
            Nothing carried
          </div>
          <div
            v-for="item in carriedItems"
            :key="item.id"
            class="inv-item carried"
            title="Click for item details"
            @click="inspectItem(item)"
          >
            <span class="item-name clickable">{{ item.name }}</span>
            <span class="item-tag">{{ item.type }}</span>
            <span
              v-if="item.type === 'mount' && mountLabel(item)"
              class="item-badge mount-badge"
              title="Breed and quality tier, from the mounts homebrew catalog"
              >{{ mountLabel(item) }}</span
            >
            <span
              v-if="item.type === 'mount' && mountCatalogEntry(item)"
              class="item-badge mount-badge"
              title="Speed"
              >{{ mountCatalogEntry(item).speed }}</span
            >
            <span
              v-if="isVersatileWeapon(item)"
              class="item-badge versatile-badge"
              title="Versatile — can be wielded one- or two-handed"
              >Versatile</span
            >
            <span
              v-if="weaponProficiencyStatus(item) === 'not-proficient'"
              class="item-badge prof-badge prof-badge--warning"
              title="Not proficient with this weapon (per this character's recorded weapon_proficiencies)"
              >⚠ Not proficient</span
            >
            <span
              v-else-if="weaponProficiencyStatus(item) === 'unknown'"
              class="item-badge prof-badge prof-badge--unknown"
              title="This character has no weapon_proficiencies on record — proficiency can't be checked"
              >Proficiency?</span
            >
            <Zap
              v-if="item.needs_attunement"
              class="attunement-indicator clickable"
              :fill="item.attuned ? 'currentColor' : 'none'"
              :title="
                item.attuned
                  ? 'Attuned — click to unattune'
                  : 'Requires attunement — click to mark attuned'
              "
              @click.stop="toggleAttuned(item)"
            />
            <div v-if="item.charges_max != null" class="item-charges">
              <button
                class="charge-btn"
                :disabled="item.charges_current <= 0"
                @click.stop="spendCharge(item)"
                title="Spend charge"
              >
                −
              </button>
              <span
                class="charge-count"
                :class="{ depleted: item.charges_current === 0 }"
                >{{ item.charges_current }}/{{ item.charges_max }}</span
              >
              <button
                class="charge-btn"
                :disabled="item.charges_current >= item.charges_max"
                @click.stop="restoreCharge(item)"
                title="Restore charge"
              >
                +
              </button>
            </div>
            <div class="item-actions">
              <button
                class="act-btn"
                @click.stop="equip(item)"
                :disabled="!canEquip(item)"
                :title="canEquip(item) ? 'Equip' : cannotEquipReason(item)"
              >
                ↑
              </button>
              <button
                class="act-btn dim"
                @click.stop="toPool(item)"
                title="Return to party pool"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Right: Pool navigator -->
      <div class="inv-column right-col">
        <!-- Left: pool list -->
        <div class="pool-nav">
          <div class="pnav-group">Parties</div>
          <button
            v-for="party in sortedParties"
            :key="party.id"
            class="pnav-btn"
            :class="{ active: effectivePool === 'party:' + party.id }"
            :title="party.name"
            @click="selectedPool = 'party:' + party.id"
          >
            <span class="pnav-name">{{ party.name }}</span>
            <span v-if="partyItemCount(party.id)" class="pnav-count">{{
              partyItemCount(party.id)
            }}</span>
          </button>
          <button
            v-if="unassignedItems.length"
            class="pnav-btn pnav-unassigned"
            :class="{ active: effectivePool === 'unassigned' }"
            @click="selectedPool = 'unassigned'"
          >
            <span class="pnav-name">Unassigned</span>
            <span class="pnav-count">{{ unassignedItems.length }}</span>
          </button>

          <template v-if="shipAssets.length">
            <div class="pnav-group">Ships</div>
            <button
              v-for="a in sortedShipAssets"
              :key="a.id"
              class="pnav-btn"
              :class="{ active: effectivePool === 'asset:' + a.name }"
              :title="a.name"
              @click="selectedPool = 'asset:' + a.name"
            >
              <span class="pnav-name">{{ a.name }}</span>
              <span v-if="assetItemCount(a.name)" class="pnav-count">{{
                assetItemCount(a.name)
              }}</span>
            </button>
          </template>

          <template v-if="propertyAssets.length">
            <div class="pnav-group">Properties</div>
            <button
              v-for="a in sortedPropertyAssets"
              :key="a.id"
              class="pnav-btn"
              :class="{ active: effectivePool === 'asset:' + a.name }"
              :title="a.name"
              @click="selectedPool = 'asset:' + a.name"
            >
              <span class="pnav-name">{{ a.name }}</span>
              <span v-if="assetItemCount(a.name)" class="pnav-count">{{
                assetItemCount(a.name)
              }}</span>
            </button>
          </template>
        </div>

        <!-- Right: items in selected pool -->
        <div class="pool-items scrollable">
          <!-- Unassigned header -->
          <div
            v-if="isUnassignedPool && characterParty"
            class="unassigned-banner"
          >
            These items don't belong to any party yet.
            <button class="claim-all-btn" @click="assignAllToParty">
              Claim all for {{ characterParty.name }}
            </button>
          </div>

          <div v-if="currentPoolItems.length === 0" class="empty">
            {{ isAssetPool ? 'Nothing stored here' : 'Pool is empty' }}
          </div>

          <div
            v-for="item in currentPoolItems"
            :key="item.id"
            class="inv-item"
            :class="isAssetPool ? 'stored' : 'pool'"
            @click="!isAssetPool && carry(item)"
            :title="!isAssetPool ? 'Click to carry' : ''"
          >
            <span
              class="item-name clickable"
              title="Click for item details"
              @click.stop="inspectItem(item)"
              >{{ item.name }}</span
            >
            <span class="item-tag">{{ item.type }}</span>
            <span
              v-if="item.type === 'mount' && mountLabel(item)"
              class="item-badge mount-badge"
              title="Breed and quality tier, from the mounts homebrew catalog"
              >{{ mountLabel(item) }}</span
            >
            <span
              v-if="item.type === 'mount' && mountCatalogEntry(item)"
              class="item-badge mount-badge"
              title="Speed"
              >{{ mountCatalogEntry(item).speed }}</span
            >
            <span
              v-if="isVersatileWeapon(item)"
              class="item-badge versatile-badge"
              title="Versatile — can be wielded one- or two-handed"
              >Versatile</span
            >
            <span
              v-if="weaponProficiencyStatus(item) === 'not-proficient'"
              class="item-badge prof-badge prof-badge--warning"
              title="Not proficient with this weapon (per this character's recorded weapon_proficiencies)"
              >⚠ Not proficient</span
            >
            <span
              v-else-if="weaponProficiencyStatus(item) === 'unknown'"
              class="item-badge prof-badge prof-badge--unknown"
              title="This character has no weapon_proficiencies on record — proficiency can't be checked"
              >Proficiency?</span
            >
            <Zap
              v-if="item.needs_attunement"
              class="attunement-indicator clickable"
              :fill="item.attuned ? 'currentColor' : 'none'"
              :title="
                item.attuned
                  ? 'Attuned — click to unattune'
                  : 'Requires attunement — click to mark attuned'
              "
              @click.stop="toggleAttuned(item)"
            />
            <div v-if="item.charges_max != null" class="item-charges">
              <button
                class="charge-btn"
                :disabled="item.charges_current <= 0"
                @click.stop="spendCharge(item)"
                title="Spend charge"
              >
                −
              </button>
              <span
                class="charge-count"
                :class="{ depleted: item.charges_current === 0 }"
                >{{ item.charges_current }}/{{ item.charges_max }}</span
              >
              <button
                class="charge-btn"
                :disabled="item.charges_current >= item.charges_max"
                @click.stop="restoreCharge(item)"
                title="Restore charge"
              >
                +
              </button>
            </div>

            <!-- Party pool actions -->
            <template v-if="!isAssetPool">
              <span v-if="!isUnassignedPool" class="item-action">←</span>
              <button
                v-if="isUnassignedPool && characterParty"
                class="act-btn"
                @click.stop="assignToParty(item)"
                :title="`Assign to ${characterParty.name}`"
              >
                <Check class="act-icon" />
              </button>
              <select
                class="store-select"
                title="Store at asset"
                @click.stop
                @change.stop="handleStoreSelect(item, $event)"
              >
                <option value="">Store…</option>
                <optgroup v-if="shipAssets.length" label="Ships">
                  <option v-for="a in shipAssets" :key="a.id" :value="a.name">
                    {{ a.name }}
                  </option>
                </optgroup>
                <optgroup v-if="propertyAssets.length" label="Properties">
                  <option
                    v-for="a in propertyAssets"
                    :key="a.id"
                    :value="a.name"
                  >
                    {{ a.name }}
                  </option>
                </optgroup>
              </select>
            </template>

            <!-- Asset storage actions -->
            <template v-if="isAssetPool">
              <button
                class="act-btn"
                @click.stop="retrieveFromStorage(item)"
                :title="`Retrieve to ${
                  characterParty ? characterParty.name : 'party'
                } pool`"
              >
                ↑
              </button>
              <select
                class="store-select"
                title="Move to different asset"
                @click.stop
                @change.stop="handleStoreSelect(item, $event)"
              >
                <option value="">⇄</option>
                <optgroup v-if="shipAssets.length" label="Ships">
                  <option
                    v-for="a in shipAssets"
                    :key="a.id"
                    :value="a.name"
                    :disabled="a.name === item.stored_at"
                  >
                    {{ a.name }}
                  </option>
                </optgroup>
                <optgroup v-if="propertyAssets.length" label="Properties">
                  <option
                    v-for="a in propertyAssets"
                    :key="a.id"
                    :value="a.name"
                    :disabled="a.name === item.stored_at"
                  >
                    {{ a.name }}
                  </option>
                </optgroup>
              </select>
            </template>

            <button
              class="act-btn dim delete-btn"
              @click.stop="confirmDelete(item)"
              title="Sell, destroy, or delete this item"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    </div>
    <!-- /inv-columns -->

    <div
      v-if="deleteDialogOpen"
      class="dialog-backdrop"
      @click.self="cancelDelete"
    >
      <div class="dialog-panel">
        <div class="dialog-title">
          {{
            deleteCurrencyType === 'dust'
              ? 'Destroy item'
              : deleteSaleValue > 0
              ? 'Sell item'
              : 'Delete item'
          }}
        </div>
        <p>
          {{
            deleteCurrencyType === 'dust'
              ? 'Destroy'
              : deleteSaleValue > 0
              ? 'Sell'
              : 'Delete'
          }}
          <strong>{{ deleteCandidate ? deleteCandidate.name : '' }}</strong
          >?
        </p>

        <!-- Currency toggle: show dust option only for magical items -->
        <div v-if="deleteIsMagical" class="delete-currency-toggle">
          <button
            class="curr-btn"
            :class="{ active: deleteCurrencyType === 'gold' }"
            @click="deleteCurrencyType = 'gold'"
          >
            Sell for Gold
          </button>
          <button
            class="curr-btn"
            :class="{ active: deleteCurrencyType === 'dust' }"
            @click="deleteCurrencyType = 'dust'"
          >
            Weave Dust
          </button>
        </div>

        <div
          v-if="deleteCurrencyType === 'dust' && deleteDustEstimate"
          class="dialog-note"
        >
          Weave Dust from Broken-Down Magic Items: typically
          {{ deleteDustEstimate.low }}–{{ deleteDustEstimate.high }} dust for
          this item. Already rolled below — override it if you'd rather set it
          by hand.
        </div>

        <label class="dialog-field">
          <span v-if="deleteCurrencyType === 'dust'">
            How much weave dust did this yield?
          </span>
          <span v-else>If you sold the item, how much did it sell for?</span>
          <input
            v-model="deleteSaleValue"
            type="number"
            min="0"
            placeholder="0"
          />
        </label>
        <div class="dialog-actions">
          <button class="act-btn dim" @click="cancelDelete">Cancel</button>
          <button class="act-btn" @click="deleteConfirmed">
            {{
              deleteCurrencyType === 'dust'
                ? 'Destroy'
                : deleteSaleValue > 0
                ? 'Sell'
                : 'Delete'
            }}{{
              deleteSaleValue > 0
                ? deleteCurrencyType === 'dust'
                  ? ' + add dust'
                  : ' + add gold'
                : ''
            }}
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="inspectionOpen && editDraft"
      class="dialog-backdrop"
      @click.self="closeInspection"
    >
      <div class="dialog-panel inspection-panel">
        <input
          class="edit-title-input"
          v-model="editDraft.name"
          placeholder="Item name"
        />

        <div class="inspection-content scrollable">
          <div class="inspection-meta">
            <!-- Editable fields -->
            <div class="meta-row">
              <span class="meta-label">Type</span>
              <input
                class="meta-input"
                v-model="editDraft.type"
                placeholder="e.g. weapon, armor…"
              />
            </div>
            <div class="meta-row">
              <span class="meta-label">Slot</span>
              <input
                class="meta-input"
                v-model="editDraft.slot"
                placeholder="e.g. hand, neck…"
              />
            </div>
            <div class="meta-row" v-if="editDraft.type === 'weapon'">
              <span class="meta-label">Weapon Type</span>
              <input
                class="meta-input"
                v-model="editDraft.weapon_category"
                placeholder="e.g. longsword, shortbow…"
              />
            </div>
            <div class="meta-row" v-if="editDraft.type === 'mount'">
              <span class="meta-label">Breed / Quality</span>
              <select class="meta-input" v-model="editDraft.mount_type">
                <option :value="null">Unset…</option>
                <optgroup
                  v-for="group in mountTypeGroups"
                  :key="group.mountType"
                  :label="group.mountType"
                >
                  <option
                    v-for="entry in group.entries"
                    :key="entry.id"
                    :value="entry.id"
                  >
                    {{ entry.quality }} ({{ entry.cost_gp }} gp)
                  </option>
                </optgroup>
              </select>
            </div>
            <div
              class="meta-row"
              v-if="editDraft.type === 'mount' && mountCatalogEntry(editDraft)"
            >
              <span class="meta-label">Speed</span>
              <span class="meta-value">{{
                mountCatalogEntry(editDraft).speed
              }}</span>
            </div>

            <!-- Attunement (live toggles) -->
            <div class="meta-row">
              <span class="meta-label">Requires Attunement</span>
              <span class="meta-value">
                <label class="check-label">
                  <input
                    type="checkbox"
                    v-model="editDraft.needs_attunement"
                    @change="
                      if (!editDraft.needs_attunement) editDraft.attuned = false
                    "
                  />
                </label>
              </span>
            </div>
            <div class="meta-row">
              <span class="meta-label">Attuned</span>
              <span class="meta-value">
                <label
                  class="check-label"
                  :class="{ 'check-disabled': !editDraft.needs_attunement }"
                >
                  <input
                    type="checkbox"
                    v-model="editDraft.attuned"
                    :disabled="!editDraft.needs_attunement"
                  />
                </label>
              </span>
            </div>

            <!-- Charges -->
            <div class="meta-row">
              <span class="meta-label">Max charges</span>
              <input
                class="meta-input meta-input--num"
                type="number"
                min="0"
                v-model.number="editDraft.charges_max"
                placeholder="—"
              />
            </div>
            <div class="meta-row" v-if="editDraft.charges_max">
              <span class="meta-label">Current charges</span>
              <input
                class="meta-input meta-input--num"
                type="number"
                min="0"
                :max="editDraft.charges_max"
                v-model.number="editDraft.charges_current"
              />
            </div>

            <!-- Read-only status fields -->
            <div v-if="editDraft.equipped_by" class="meta-row">
              <span class="meta-label">Equipped by</span>
              <span class="meta-value dim">{{ editDraft.equipped_by }}</span>
            </div>
            <div v-if="editDraft.carried_by" class="meta-row">
              <span class="meta-label">Carried by</span>
              <span class="meta-value dim">{{ editDraft.carried_by }}</span>
            </div>
            <div v-if="editDraft.stored_at" class="meta-row">
              <span class="meta-label">Stored at</span>
              <span class="meta-value dim">{{ editDraft.stored_at }}</span>
            </div>
            <div v-if="editDraft.stat_overrides" class="meta-row">
              <span class="meta-label">Sets</span>
              <span class="meta-value">
                <span
                  v-for="(val, key) in editDraft.stat_overrides"
                  :key="key"
                  class="bonus-tag"
                  >{{ key.toUpperCase() }} → {{ val }}</span
                >
              </span>
            </div>
            <div v-if="editDraft.stat_bonuses" class="meta-row">
              <span class="meta-label">Bonuses</span>
              <span class="meta-value">
                <span
                  v-for="(val, key) in editDraft.stat_bonuses"
                  :key="key"
                  class="bonus-tag"
                  >{{ key }}: +{{ val }}</span
                >
              </span>
            </div>
            <div
              v-if="editDraft.stored_spells && editDraft.stored_spells.length"
              class="meta-row"
            >
              <span class="meta-label">Stored</span>
              <span class="meta-value">
                <span
                  v-for="sp in editDraft.stored_spells"
                  :key="sp.name"
                  class="bonus-tag"
                  >{{ sp.name }} (L{{ sp.level }})</span
                >
              </span>
            </div>
          </div>

          <!-- Contents (gem pouches and similar bulk-material items) — a
               numbered list of {type, value_gp, quantity} rows, editable
               in-place instead of hand-editing party_items.json. See
               TODO.md's "Gems need a real system" resolution. -->
          <div v-if="editDraft.contents" class="inspection-section">
            <div class="section-label">
              Contents ({{ contentsTotalValue }} gp total)
            </div>
            <div class="contents-list">
              <div
                v-for="(row, i) in editDraft.contents"
                :key="i"
                class="contents-row"
              >
                <input
                  class="meta-input contents-type"
                  v-model="row.type"
                  placeholder="Gem type"
                />
                <input
                  class="meta-input meta-input--num contents-value"
                  type="number"
                  min="0"
                  v-model.number="row.value_gp"
                  placeholder="gp each"
                />
                <button
                  class="charge-btn"
                  :disabled="row.quantity <= 0"
                  @click="row.quantity--"
                >
                  −
                </button>
                <span class="charge-count">{{ row.quantity }}</span>
                <button class="charge-btn" @click="row.quantity++">+</button>
                <button
                  class="act-btn dim contents-remove"
                  title="Remove this gem type"
                  @click="editDraft.contents.splice(i, 1)"
                >
                  ✕
                </button>
              </div>
            </div>
            <button class="act-btn dim" @click="addContentsRow">
              + Add gem type
            </button>
          </div>

          <!-- Long text fields -->
          <div class="inspection-section">
            <div class="section-label">Description</div>
            <textarea
              class="edit-textarea"
              v-model="editDraft.description"
              placeholder="Add a description…"
              rows="3"
            />
          </div>
          <div class="inspection-section">
            <div class="section-label">Effect</div>
            <textarea
              class="edit-textarea"
              v-model="editDraft.effect"
              placeholder="Mechanical effect…"
              rows="3"
            />
          </div>
          <div class="inspection-section">
            <div class="section-label">Notes</div>
            <textarea
              class="edit-textarea"
              v-model="editDraft.notes"
              placeholder="Any notes…"
              rows="2"
            />
          </div>

          <div class="inspection-section id-section">
            <div class="section-label">Item ID</div>
            <div class="section-content id-content">{{ editDraft.id }}</div>
          </div>
        </div>

        <div class="dialog-actions">
          <button class="act-btn dim" @click="closeInspection">Cancel</button>
          <button class="act-btn" @click="saveEdit">Save</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { Zap, Check } from 'lucide-vue'
import { dnd } from '@/utils/dnd_utils.js'

export default {
  name: 'CharacterInventory',

  components: { Zap, Check },

  props: {
    character: { type: Object, required: true },
  },

  computed: {
    allItems() {
      return this.$store.state.party_items
    },
    mounts() {
      return this.$store.state.mounts ?? []
    },
    mountTypeGroups() {
      const order = ['poor', 'common', 'uncommon', 'rare']
      const byType = new Map()
      for (const entry of this.mounts) {
        if (!byType.has(entry.mount_type)) byType.set(entry.mount_type, [])
        byType.get(entry.mount_type).push(entry)
      }
      return Array.from(byType.entries()).map(([mountType, entries]) => ({
        mountType,
        entries: entries
          .slice()
          .sort((a, b) => order.indexOf(a.quality) - order.indexOf(b.quality)),
      }))
    },
    equippedItems() {
      return this.allItems.filter((i) => i.equipped_by === this.character.name)
    },
    carriedItems() {
      return this.allItems.filter(
        (i) => i.carried_by === this.character.name && !i.equipped_by
      )
    },
    // The party THIS character actually belongs to — not whichever party
    // happens to be globally flagged active elsewhere in the app (Combat,
    // the World calendar, etc.). Every pool-management action in this
    // component (toPool, retrieveFromStorage, assignToParty,
    // assignAllToParty) and every "which party's pool am I looking at"
    // display used to read the global active party instead, which meant
    // managing a character whose party wasn't the currently-active one
    // silently routed/displayed items into the wrong party's pool. See
    // TODO.md's "Removing an item from a character sends it to the
    // globally-active party's pool" entry.
    characterParty() {
      return (
        this.$store.state.parties.find((p) =>
          (p.members ?? []).includes(this.character.name)
        ) ?? null
      )
    },
    assets() {
      return this.$store.state.assets
    },
    shipAssets() {
      return this.assets.filter((a) => a.type === 'ship')
    },
    propertyAssets() {
      return this.assets.filter((a) => a.type !== 'ship')
    },
    partyPoolItems() {
      if (!this.characterParty) return []
      return this.allItems.filter(
        (i) => i.carried_by === 'party' && i.party_id === this.characterParty.id
      )
    },
    unassignedItems() {
      return this.allItems.filter(
        (i) => i.carried_by === 'party' && !i.party_id && !i.stored_at
      )
    },
    storedItems() {
      return this.allItems.filter((i) => i.stored_at)
    },
    storedByAsset() {
      const groups = {}
      for (const item of this.storedItems) {
        if (!groups[item.stored_at]) groups[item.stored_at] = []
        groups[item.stored_at].push(item)
      }
      return Object.entries(groups)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([assetName, items]) => ({ assetName, items }))
    },
    // melee1h/melee2h/ranged1h are the slots a weapon set actually swaps —
    // two two-handed weapons in different sets were false-flagging as
    // "overloaded" because capacity used to be counted globally across both
    // sets at once, even though only one set is ever in-hand simultaneously.
    // Real bug found 2026-09-11. Non-weapon slots (rings, armor, etc.)
    // aren't set-dependent and keep a single global count below.
    weaponSlotTypes() {
      return ['melee1h', 'melee2h', 'ranged1h']
    },
    slotCounts() {
      return this.equippedItems.reduce((counts, item) => {
        const slot = item.slot || item.type || 'unknown'
        if (this.weaponSlotTypes.includes(slot)) return counts
        counts[slot] = (counts[slot] || 0) + 1
        return counts
      }, {})
    },
    // { 1: {melee1h: n, ...}, 2: {...} } — a weapon_set: null ("Any") item
    // counts toward BOTH sets, matching cycleItemWeaponSet's own comment
    // that "Any" means always in-hand regardless of active loadout.
    weaponSlotCountsBySet() {
      const bySet = { 1: {}, 2: {} }
      for (const item of this.equippedItems) {
        const slot = item.slot || item.type || 'unknown'
        if (!this.weaponSlotTypes.includes(slot)) continue
        for (const setNum of [1, 2]) {
          if (item.weapon_set == null || item.weapon_set === setNum) {
            bySet[setNum][slot] = (bySet[setNum][slot] || 0) + 1
          }
        }
      }
      return bySet
    },
    multiSlotTypes() {
      return ['ring', 'melee1h', 'ranged1h']
    },
    slotSummaries() {
      const nonWeapon = Object.entries(this.slotCounts).map(([slot, count]) => {
        const cap = this.slotCapacity(slot)
        return { slot, count, cap, over: count > cap }
      })
      // Only split into per-set chips once sets are actually in use —
      // otherwise every weapon is "Any" and both sets' counts are identical,
      // so showing them twice would just be confusing duplication.
      const weapon = this.hasWeaponSets
        ? [1, 2].flatMap((setNum) =>
            Object.entries(this.weaponSlotCountsBySet[setNum]).map(
              ([slot, count]) => {
                const cap = this.slotCapacity(slot)
                return {
                  slot: `${slot} (Set ${setNum})`,
                  count,
                  cap,
                  over: count > cap,
                }
              }
            )
          )
        : Object.entries(this.weaponSlotCountsBySet[1]).map(([slot, count]) => {
            const cap = this.slotCapacity(slot)
            return { slot, count, cap, over: count > cap }
          })
      return [...nonWeapon, ...weapon]
    },
    attunedItems() {
      return this.equippedItems.filter((i) => i.attuned)
    },
    attunedCount() {
      return this.attunedItems.length
    },
    // Which of the character's two weapon loadouts is currently "in hand" —
    // see dnd_utils.js's isActiveEquipped/isDualWieldingMelee for why this
    // exists (Dual Wielder's conditional AC bonus needed a way to tell "2
    // melee weapons ready to swap to" apart from "2 melee weapons actually
    // in hand right now"). Defaults to 1, matching dnd.activeWeaponSet.
    activeWeaponSet() {
      return this.character.active_weapon_set ?? 1
    },
    // Only show the toggle at all once at least one equipped weapon has
    // actually been assigned a set — no point cluttering the UI for every
    // character who's never needed more than one loadout.
    hasWeaponSets() {
      return this.equippedItems.some(
        (i) => i.type === 'weapon' && i.weapon_set != null
      )
    },
    searchResults() {
      const q = this.itemSearch.trim().toLowerCase()
      if (!q) return []
      return this.allItems.filter((i) => i.name.toLowerCase().includes(q))
    },
    inspectedItem() {
      return this.allItems.find((i) => i.id === this.inspectedItemId) || null
    },
    contentsTotalValue() {
      return (this.editDraft?.contents ?? []).reduce(
        (sum, row) => sum + (row.value_gp || 0) * (row.quantity || 0),
        0
      )
    },
    deleteIsMagical() {
      const item = this.deleteCandidate
      return !!(item && (item.rarity || item.needs_attunement))
    },
    // Weave Dust from Broken-Down Magic Items (house_rules.json) — only
    // computable when the item carries a real recorded value_gp; null means
    // "not enough data, fall back to manual entry" rather than a silent 0.
    deleteDustEstimate() {
      return dnd.weaveDustEstimateRange(this.deleteCandidate)
    },
    sortedParties() {
      return [...this.$store.state.parties].sort((a, b) => {
        if (a.active && !b.active) return -1
        if (!a.active && b.active) return 1
        const countDiff = this.partyItemCount(b.id) - this.partyItemCount(a.id)
        if (countDiff !== 0) return countDiff
        return a.name.localeCompare(b.name)
      })
    },
    sortedShipAssets() {
      return [...this.shipAssets].sort(
        (a, b) => this.assetItemCount(b.name) - this.assetItemCount(a.name)
      )
    },
    sortedPropertyAssets() {
      return [...this.propertyAssets].sort(
        (a, b) => this.assetItemCount(b.name) - this.assetItemCount(a.name)
      )
    },
    effectivePool() {
      return (
        this.selectedPool ??
        (this.characterParty ? 'party:' + this.characterParty.id : 'unassigned')
      )
    },
    isAssetPool() {
      return this.effectivePool?.startsWith('asset:')
    },
    isUnassignedPool() {
      return this.effectivePool === 'unassigned'
    },
    currentPoolItems() {
      const pool = this.effectivePool
      if (!pool) return []
      if (pool === 'unassigned') return this.unassignedItems
      if (pool.startsWith('party:')) {
        const pid = pool.slice(6)
        return this.allItems.filter(
          (i) => i.carried_by === 'party' && i.party_id === pid
        )
      }
      if (pool.startsWith('asset:')) {
        const name = pool.slice(6)
        return this.allItems.filter((i) => i.stored_at === name)
      }
      return []
    },
    partyItemCount() {
      return (partyId) =>
        this.allItems.filter(
          (i) => i.carried_by === 'party' && i.party_id === partyId
        ).length
    },
    assetItemCount() {
      return (assetName) =>
        this.allItems.filter((i) => i.stored_at === assetName).length
    },
  },

  data() {
    return {
      itemSearch: '',
      selectedPool: null,
      editDraft: null,
      deleteDialogOpen: false,
      deleteCandidate: null,
      deleteSaleValue: '',
      deleteCurrencyType: 'gold',
      inspectionOpen: false,
      inspectedItemId: null,
    }
  },

  methods: {
    mountCatalogEntry(item) {
      return this.mounts.find((m) => m.id === item.mount_type) ?? null
    },
    mountLabel(item) {
      const entry = this.mountCatalogEntry(item)
      if (!entry) return null
      return `${entry.mount_type} (${entry.quality})`
    },
    toggleAttuned(item) {
      if (!item.needs_attunement) return
      this.$store.commit('UPDATE_ITEM', { ...item, attuned: !item.attuned })
    },
    spendCharge(item) {
      this.$store.commit('SPEND_CHARGE', item.id)
    },
    restoreCharge(item) {
      this.$store.commit('RESTORE_CHARGE', item.id)
    },
    itemStatus(item) {
      if (item.stored_at) return `Stored: ${item.stored_at}`
      if (item.equipped_by) return `Equipped by ${item.equipped_by}`
      if (item.carried_by && item.carried_by !== 'party')
        return `Carried by ${item.carried_by}`
      if (item.carried_by === 'party') {
        if (item.party_id) {
          const party = this.$store.state.parties.find(
            (p) => p.id === item.party_id
          )
          return `${party?.name ?? 'Party'} Pool`
        }
        return 'Unassigned Pool'
      }
      return 'Pool'
    },
    takeItem(item) {
      this.$store.commit('UPDATE_ITEM', {
        ...item,
        carried_by: this.character.name,
        equipped_by: null,
        stored_at: null,
        party_id: null,
      })
    },
    slotCapacity(slot) {
      return this.multiSlotTypes.includes(slot) ? 2 : 1
    },
    // Weapon slots check the item's OWN set bucket (an "Any"/null item is
    // checked against Set 1 as a stable proxy, since it's in-hand under
    // every set anyway — if set 1's bucket overflows the real conflict is
    // visible there). Non-weapon slots use the simple global count.
    isSlotOverfilled(item) {
      const slot = item.slot || item.type || 'unknown'
      if (this.weaponSlotTypes.includes(slot)) {
        const setNum = item.weapon_set ?? 1
        const count = this.weaponSlotCountsBySet[setNum][slot] || 0
        return count > this.slotCapacity(slot)
      }
      const count = this.slotCounts[slot] || 0
      return count > this.slotCapacity(slot)
    },
    isPoolItem(item) {
      return item.carried_by === 'party' && !item.stored_at
    },
    // Weapon slots never hard-block equipping: a weapon defaults to "Any"
    // set until deliberately assigned via cycleItemWeaponSet, so equipping a
    // second two-handed weapon meant for Set 2 would otherwise get blocked
    // here before the player ever gets a chance to assign it — the set
    // toggle is a two-step flow (equip, then assign), not one step. Rely on
    // isSlotOverfilled's visual warning instead of blocking outright. Only
    // non-weapon slots (rings, armor, etc.) still hard-block.
    canEquip(item) {
      if (item.equipped_by === 'disallowed') return false
      const slot = item.slot || item.type || 'unknown'
      if (this.weaponSlotTypes.includes(slot)) return true
      const count = this.slotCounts[slot] || 0
      if (count >= this.slotCapacity(slot)) return false
      return true
    },
    cannotEquipReason(item) {
      if (item.equipped_by === 'disallowed') return 'Item cannot be equipped'
      const slot = item.slot || item.type || 'unknown'
      if (this.weaponSlotTypes.includes(slot)) return null
      const count = this.slotCounts[slot] || 0
      if (count >= this.slotCapacity(slot)) return `${slot} slot full`
      return null
    },
    equip(item) {
      if (!this.canEquip(item)) return
      this.$store.commit('UPDATE_ITEM', {
        ...item,
        equipped_by: this.character.name,
        carried_by: this.character.name,
      })
    },
    unequip(item) {
      this.$store.commit('UPDATE_ITEM', {
        ...item,
        equipped_by: null,
        carried_by: this.character.name,
        attuned: false,
      })
    },
    setActiveWeaponSet(set) {
      this.$store.commit('UPDATE_TABLE_ITEM', {
        table: 'characters',
        updatedItem: { ...this.character, active_weapon_set: set },
      })
    },
    // Cycles a weapon through Set 1 → Set 2 → Any (null) → Set 1… "Any"
    // means the weapon counts as in-hand regardless of which loadout is
    // active — the right default for something that isn't really part of a
    // swap (e.g. a piece that's just always drawn), but most weapons should
    // end up tagged 1 or 2.
    cycleItemWeaponSet(item) {
      const next = item.weapon_set === 1 ? 2 : item.weapon_set === 2 ? null : 1
      this.$store.commit('UPDATE_ITEM', { ...item, weapon_set: next })
    },
    // Versatile weapons (longsword, etc.) were only ever equippable in the
    // one-handed slot — dnd_utils.js's gripDie() already infers two-handed
    // damage when nothing else occupies the other melee1h slot, but that
    // inference can't see a shield and gives no way to deliberately choose
    // two-handed when a second one-hander IS equipped. Real gap found
    // 2026-09-11. This toggle sets item.slot explicitly instead of relying
    // on the inference.
    isVersatileWeapon(item) {
      return (
        item.type === 'weapon' &&
        (item.slot === 'melee1h' || item.slot === 'melee2h') &&
        dnd._weaponProps(item).versatile
      )
    },
    // 'not-proficient' | 'unknown' | null (proficient, or not a weapon —
    // no badge shown either way). 'unknown' instead of a false
    // "not-proficient" alarm when the character has no weapon_proficiencies
    // recorded at all — that's a real, common data gap on this roster (most
    // characters predate this field), and showing every weapon as a
    // violation would just be noise, not signal.
    weaponProficiencyStatus(item) {
      if (item.type !== 'weapon') return null
      if (!this.character.weapon_proficiencies) return 'unknown'
      return dnd.isProficientWithWeapon(this.character, item)
        ? null
        : 'not-proficient'
    },
    toggleGrip(item) {
      this.$store.commit('UPDATE_ITEM', {
        ...item,
        slot: item.slot === 'melee2h' ? 'melee1h' : 'melee2h',
      })
    },
    carry(item) {
      this.$store.commit('UPDATE_ITEM', {
        ...item,
        carried_by: this.character.name,
        equipped_by: null,
        stored_at: null,
        party_id: null,
      })
    },
    toPool(item) {
      this.$store.commit('UPDATE_ITEM', {
        ...item,
        carried_by: 'party',
        equipped_by: null,
        stored_at: null,
        party_id: this.characterParty?.id ?? null,
      })
    },
    handleStoreSelect(item, event) {
      const assetName = event.target.value
      if (!assetName) return
      this.storeAt(item, assetName)
      event.target.value = ''
    },
    storeAt(item, assetName) {
      this.$store.commit('UPDATE_ITEM', {
        ...item,
        stored_at: assetName,
        carried_by: null,
        equipped_by: null,
        attuned: false,
        party_id: null,
      })
    },
    retrieveFromStorage(item) {
      this.$store.commit('UPDATE_ITEM', {
        ...item,
        stored_at: null,
        carried_by: 'party',
        party_id: this.characterParty?.id ?? null,
      })
    },
    assignToParty(item) {
      this.$store.commit('UPDATE_ITEM', {
        ...item,
        party_id: this.characterParty?.id ?? null,
      })
    },
    assignAllToParty() {
      if (!this.characterParty) return
      for (const item of this.unassignedItems) {
        this.$store.commit('UPDATE_ITEM', {
          ...item,
          party_id: this.characterParty.id,
        })
      }
    },
    confirmDelete(item) {
      this.deleteCandidate = item
      const estimate = dnd.weaveDustEstimateRange(item)
      if (estimate) {
        // Real value_gp on record — this is a "destroy for dust" candidate
        // by default, auto-rolled rather than making the DM do the house
        // rule's math by hand. Still a plain editable number afterward, so
        // it can be overridden or switched to a gold sale instead.
        this.deleteCurrencyType = 'dust'
        const roll = Math.floor(Math.random() * 18) + 2 // 2-19, no crits here
        this.deleteSaleValue = dnd.weaveDustForRoll(item, roll)
      } else {
        this.deleteCurrencyType = 'gold'
        this.deleteSaleValue = ''
      }
      this.deleteDialogOpen = true
    },
    cancelDelete() {
      this.deleteDialogOpen = false
      this.deleteCandidate = null
      this.deleteSaleValue = ''
      this.deleteCurrencyType = 'gold'
    },
    deleteConfirmed() {
      if (!this.deleteCandidate) return
      const value = parseFloat(this.deleteSaleValue)
      const amount = Number.isFinite(value) && value > 0 ? value : 0
      this.$store.commit('DELETE_PARTY_ITEM', this.deleteCandidate.id)
      if (amount) {
        if (this.deleteCurrencyType === 'dust') {
          this.$store.commit('ADJUST_CURRENCY', { key: 'weave_dust', amount })
        } else {
          this.$store.commit('ADJUST_PARTY_GOLD', amount)
        }
      }
      this.cancelDelete()
    },
    inspectItem(item) {
      this.inspectedItemId = item.id
      // contents is edited in-place (quantity +/-, splice) below, so it needs
      // its own copy — otherwise Cancel wouldn't actually discard changes,
      // since a shallow spread still shares the same nested array reference.
      this.editDraft = {
        ...item,
        contents: item.contents
          ? item.contents.map((row) => ({ ...row }))
          : item.contents,
      }
      this.inspectionOpen = true
    },
    closeInspection() {
      this.inspectionOpen = false
      this.inspectedItemId = null
      this.editDraft = null
    },
    saveEdit() {
      if (!this.editDraft) return
      this.$store.commit('UPDATE_ITEM', { ...this.editDraft })
      this.closeInspection()
    },
    addContentsRow() {
      this.editDraft.contents.push({ type: '', value_gp: 0, quantity: 0 })
    },
  },
}
</script>

<style scoped>
.inventory-manager {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 1vh 1vw;
  gap: 0.6vh;
  overflow: hidden;
}

/* ── Search ── */
.search-section {
  flex-shrink: 0;
}

.search-input {
  width: 100%;
  box-sizing: border-box;
  padding: 0.35rem 0.6rem;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-family: var(--font-body);
}

.search-input:focus {
  outline: none;
  border-color: var(--color-accent);
}

.search-results {
  margin-top: 0.4vh;
  max-height: 12rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.search-empty {
  font-size: var(--font-size-base);
  color: var(--color-text-low);
  font-style: italic;
  padding: 0.3rem 0.4rem;
}

.search-result-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-surface);
  font-size: var(--font-size-md);
}

.sr-name {
  flex: 1;
  color: var(--color-text);
}

.sr-status {
  font-size: var(--font-size-base);
  color: var(--color-text-muted);
}

.sr-take-btn {
  padding: 2px 8px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-size: var(--font-size-base);
  color: var(--color-text-muted);
  background: var(--color-bg-panel);
  cursor: pointer;
  transition: all 0.15s ease;
}

.sr-take-btn:not(:disabled):hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.sr-take-btn:disabled {
  opacity: 0.45;
  cursor: default;
}

/* ── Columns wrapper ── */
.inv-columns {
  display: flex;
  gap: 1vw;
  flex: 1;
  overflow: hidden;
}

/* ── Columns ── */
.inv-column {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.8vh;
  overflow-y: auto;
}

.col-title {
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  color: var(--color-accent-strong);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  padding-bottom: 0.4vh;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.col-section {
  display: flex;
  flex-direction: column;
  gap: 0.3vh;
}

.slot-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4vw;
  margin-bottom: 0.4vh;
}

.slot-chip {
  padding: 3px 8px;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-panel);
  color: var(--color-text);
  font-size: var(--font-size-sm);
}

.slot-chip.over {
  border-color: var(--color-text-danger);
  background: rgba(160, 60, 50, 0.15);
  color: var(--color-text-danger);
}

.col-section-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 0.2vh;
}

/* ── Items ── */
.inv-item {
  display: flex;
  align-items: center;
  gap: 0.5vw;
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-surface);
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
  font-size: var(--font-size-md);
}

.inv-item.overloaded {
  border-color: var(--color-text-danger);
  background: rgba(160, 60, 50, 0.12);
}

.inv-item.equipped {
  border-color: var(--color-accent);
}

.inv-item.equipped:hover {
  border-color: var(--color-text-danger);
}

.inv-item.carried:hover,
.inv-item.pool:hover {
  border-color: var(--color-accent);
}

.item-name {
  flex: 1;
  color: var(--color-text);
}

.clickable {
  cursor: pointer;
}

.item-name.clickable:hover {
  color: var(--color-accent);
  text-decoration: underline;
}

.item-badge {
  font-size: var(--font-size-sm);
  padding: 1px 6px;
  border-radius: 3px;
  white-space: nowrap;
  flex-shrink: 0;
}

.versatile-badge {
  color: var(--color-accent);
  border: 1px solid var(--color-accent);
}

.mount-badge {
  color: var(--color-text-low);
  border: 1px solid var(--color-border);
}

.prof-badge--warning {
  color: var(--color-text-danger);
  border: 1px solid var(--color-text-danger);
}

.prof-badge--unknown {
  color: var(--color-text-low);
  border: 1px dashed var(--color-text-low);
}

.item-slot {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  padding: 0 6px;
  border-left: 1px solid var(--color-border);
}

.item-tag {
  font-size: var(--font-size-sm);
  color: var(--color-text-low);
}

.attunement-indicator {
  width: 0.85rem;
  height: 0.85rem;
  color: var(--color-accent);
  margin-left: 2px;
  flex-shrink: 0;
  cursor: pointer;
}

.weapon-set-toggle {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.4rem;
  font-size: var(--font-size-sm);
}

.weapon-set-label {
  color: var(--color-text-muted);
}

.weapon-set-btn.active {
  background: var(--color-accent);
  color: var(--color-bg-surface);
  border-color: var(--color-accent);
}

.weapon-set-item-btn {
  font-size: var(--font-size-sm);
  padding: 0.1rem 0.4rem;
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.weapon-set-item-btn.not-in-active-set {
  color: var(--color-text-low);
  opacity: 0.6;
}

.item-charges {
  display: flex;
  align-items: center;
  gap: 3px;
  margin-left: auto;
}

.charge-count {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  min-width: 2.6em;
  text-align: center;
}

.charge-count.depleted {
  color: var(--color-danger, #c0392b);
}

.charge-btn {
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 3px;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  width: 1.4em;
  height: 1.4em;
  line-height: 1;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.charge-btn:hover:not(:disabled) {
  color: var(--color-text);
  border-color: var(--color-text-muted);
}

.charge-btn:disabled {
  opacity: 0.3;
  cursor: default;
}

.item-action {
  font-size: var(--font-size-base);
  color: var(--color-text-muted);
}

.item-actions {
  display: flex;
  gap: 4px;
}

.act-btn {
  background: none;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: var(--font-size-base);
  padding: 0 2px;
  line-height: 1;
  transition: color 0.15s ease;
}

.act-btn:disabled {
  color: var(--color-text-low);
  cursor: not-allowed;
}

.act-btn:hover {
  color: var(--color-accent);
}

.act-icon {
  width: 0.85rem;
  height: 0.85rem;
  vertical-align: middle;
}

.act-btn.dim:hover {
  color: var(--color-text-danger);
}

.empty {
  font-size: var(--font-size-base);
  color: var(--color-text-low);
  font-style: italic;
  padding: 2px 0;
}

.delete-btn {
  margin-left: auto;
  color: var(--color-text-danger);
}

.dialog-backdrop {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(10, 12, 18, 0.7);
  z-index: 20;
}

.dialog-panel {
  width: min(92vw, 420px);
  padding: 1.2rem;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  box-shadow: 0 22px 60px rgba(0, 0, 0, 0.2);
}

/* editable title input replaces dialog-title in inspection panel */
.edit-title-input {
  width: 100%;
  box-sizing: border-box;
  font-size: var(--font-size-md);
  font-weight: 700;
  font-family: var(--font-display);
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text);
  padding: 0 0 0.4rem;
  margin-bottom: 0.75rem;
  outline: none;
}
.edit-title-input:focus {
  border-bottom-color: var(--color-accent);
}

.meta-input {
  width: 100%;
  box-sizing: border-box;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text);
  font-size: var(--font-size-sm);
  font-family: var(--font-body);
  padding: 0.15rem 0.4rem;
  outline: none;
}
.meta-input:focus {
  border-color: var(--color-accent);
}
.meta-input--num {
  width: 80px;
}

.meta-value.dim {
  color: var(--color-text-low);
  font-style: italic;
}

.contents-list {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: 0.5rem;
}
.contents-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.contents-type {
  flex: 1;
}
.contents-value {
  width: 70px;
}
.contents-remove {
  margin-left: auto;
}

.edit-textarea {
  width: 100%;
  box-sizing: border-box;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text);
  font-size: var(--font-size-md);
  font-family: var(--font-body);
  padding: 0.35rem 0.4rem;
  resize: vertical;
  outline: none;
  line-height: 1.45;
}
.edit-textarea:focus {
  border-color: var(--color-accent);
}

.dialog-title {
  font-size: var(--font-size-md);
  font-weight: 700;
  margin-bottom: 0.75rem;
}

.delete-currency-toggle {
  display: flex;
  gap: 0.4rem;
  margin-bottom: 0.75rem;
}

.curr-btn {
  flex: 1;
  padding: 0.3rem 0.6rem;
  background: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: 5px;
  color: var(--color-text-muted);
  font-family: var(--font-display);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: all 0.12s;
}
.curr-btn:hover {
  border-color: var(--color-accent-muted);
  color: var(--color-text);
}
.curr-btn.active {
  background: var(--color-bg-surface);
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.dialog-note {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  margin-top: 0.5rem;
}

.dialog-field {
  display: grid;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.dialog-field input {
  width: 100%;
  padding: 0.8rem 0.9rem;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-panel);
  color: var(--color-text);
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1rem;
}

/* ── Item Inspection ── */
.inspection-panel {
  width: min(92vw, 540px);
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.inspection-content {
  overflow-y: auto;
  flex: 1;
  padding-right: 0.6rem;
}

.inspection-meta {
  display: grid;
  gap: 0.4rem;
  margin-bottom: 1.2rem;
  padding: 0.8rem;
  background: var(--color-bg-panel);
  border-radius: 8px;
  border: 1px solid var(--color-border);
}

.meta-row {
  display: grid;
  grid-template-columns: 140px 1fr;
  gap: 1rem;
  font-size: var(--font-size-md);
  align-items: start;
}

.meta-label {
  font-weight: 600;
  color: var(--color-text-muted);
}

.meta-value {
  color: var(--color-text);
}

.bonus-tag {
  display: inline-block;
  padding: 2px 8px;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-size: var(--font-size-sm);
  color: var(--color-accent);
  margin-right: 0.4rem;
  margin-bottom: 0.2rem;
}

.inspection-section {
  margin-bottom: 1rem;
  padding: 0.8rem;
  background: var(--color-bg-panel);
  border-radius: 8px;
  border: 1px solid var(--color-border);
}

.inspection-section.id-section {
  background: rgba(100, 100, 130, 0.08);
}

.section-label {
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 0.4rem;
}

.section-content {
  font-size: var(--font-size-md);
  color: var(--color-text);
  line-height: 1.4;
  word-wrap: break-word;
}

.id-content {
  font-family: monospace;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.check-label {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  cursor: pointer;
  user-select: none;
}

.check-disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ── Right column: pool navigator ── */
.right-col {
  display: flex;
  flex-direction: row;
  overflow: hidden;
  gap: 0;
}

.pool-nav {
  width: 130px;
  flex-shrink: 0;
  overflow-y: auto;
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  padding: 0.3rem 0;
}

.pnav-group {
  font-size: var(--font-size-xs);
  font-family: var(--font-display);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--color-text-low);
  padding: 0.45rem 0.5rem 0.15rem;
  margin-top: 0.5rem;
  border-top: 1px solid var(--color-border);
}

.pnav-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.25rem;
  padding: 0.22rem 0.5rem;
  background: none;
  border: none;
  border-left: 2px solid transparent;
  color: var(--color-text-muted);
  font-family: var(--font-display);
  font-size: var(--font-size-sm);
  text-align: left;
  cursor: pointer;
  transition: background 0.1s, color 0.1s, border-color 0.1s;
  min-width: 0;
}
.pnav-btn:hover {
  background: var(--color-bg-panel);
  color: var(--color-text);
}
.pnav-btn.active {
  border-left-color: var(--color-accent);
  color: var(--color-accent);
  background: var(--color-bg-panel);
}

.pnav-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.pnav-count {
  font-size: var(--font-size-xs);
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 99px;
  padding: 0 4px;
  color: var(--color-text-muted);
  font-family: var(--font-body);
  flex-shrink: 0;
}
.pnav-btn.active .pnav-count {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.pnav-unassigned {
  color: var(--color-text-low);
  font-style: italic;
}

.pool-items {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.8vh;
  padding: 0.3rem 0.4rem;
}

/* ── Unassigned section ── */
.unassigned-banner {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.3rem 0.4rem;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  background: var(--color-bg-panel);
  border-radius: 4px;
  flex-wrap: wrap;
}

.unassigned-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.claim-all-btn {
  margin-left: auto;
  padding: 1px 7px;
  font-size: var(--font-size-xs);
  font-family: var(--font-display);
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 3px;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.12s;
}
.claim-all-btn:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.inv-item.unassigned {
  opacity: 0.7;
  border-style: dashed;
}

/* ── Stored items ── */
.inv-item.stored {
  border-color: rgba(100, 120, 160, 0.4);
  background: rgba(80, 100, 140, 0.06);
}

.storage-group-label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

/* ── Store-at dropdown ── */
.store-select {
  appearance: none;
  -webkit-appearance: none;
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-size: var(--font-size-base);
  cursor: pointer;
  padding: 0 2px;
  line-height: 1;
  min-width: 0;
  transition: color 0.12s;
}
.store-select:hover {
  color: var(--color-accent);
}
.store-select:focus {
  outline: none;
}
</style>
