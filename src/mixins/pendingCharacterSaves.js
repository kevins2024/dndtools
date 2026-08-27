import dataService from '@/utils/dataService'

// Shared by LevelUpTool.vue and NewCharacterTool.vue: both apply character
// edits straight to the store (so the rest of the app reflects them live)
// without marking 'characters' dirty, so neither gets swept up by the app's
// ambient autosave — persistence only happens through this explicit
// save/revert flow (rendered via PendingCharacterSaveBar.vue).
//
// pendingCharacterNames is computed by diffing the live store against
// `originals` (the app's own last-saved-snapshot tracking), so it reflects
// ANY unsaved character changes, not just ones made by whichever tool is
// currently mounted.
//
// Host components may define `onCharacterReverted(name)` to run their own
// follow-up (e.g. refreshing an in-progress preview for whichever character
// happens to be currently selected there).
export default {
  data() {
    return {
      savingName: null,
      saveError: null,
      justSaved: false,
    }
  },

  computed: {
    pendingCharacterNames() {
      const originals = this.$store.state.originals.characters || []
      return this.$store.state.characters
        .filter((c) => {
          const orig = originals.find((o) => o.name === c.name)
          return !orig || JSON.stringify(orig) !== JSON.stringify(c)
        })
        .map((c) => c.name)
    },
  },

  methods: {
    // Discards ALL unsaved changes to one character — whatever's been done
    // to them since the last save, by any tool — restoring them to the
    // last-saved baseline. A character with no baseline at all (never saved)
    // is removed entirely rather than "reverted" to nothing.
    revertCharacter(name) {
      const originals = this.$store.state.originals.characters || []
      const orig = originals.find((c) => c.name === name)
      if (!orig) {
        this.$store.commit('REMOVE_CHARACTER', { characterName: name })
      } else {
        this.$store.commit('SET_TABLE_ROW', {
          table: 'characters',
          name,
          data: JSON.parse(JSON.stringify(orig)),
        })
      }
      this.onCharacterReverted?.(name)
    },

    // Saves ONE character's current in-memory state to disk while leaving
    // every other character exactly as they currently are — both on disk AND
    // in this session's memory. Fetches disk fresh and splices just this
    // character's row into it (works whether the character already exists on
    // disk or is brand new), rather than writing the WHOLE table as
    // currently held in memory, which would also persist anyone else's
    // still-undecided experiment.
    async saveOnlyCharacter(name) {
      this.savingName = name
      this.saveError = null
      try {
        const diskCharacters = await dataService.get('characters')
        const mine = this.$store.state.characters.find((c) => c.name === name)
        const alreadyOnDisk = diskCharacters.some((c) => c.name === name)
        const current = alreadyOnDisk
          ? diskCharacters.map((c) => (c.name === name ? mine : c))
          : [...diskCharacters, mine]
        const result = await dataService.save(
          'characters',
          current,
          diskCharacters
        )
        if (result?.conflicts?.length) {
          this.saveError = `Saved with conflicts resolved in favor of disk: ${result.conflicts.join(
            ', '
          )}`
        }
        const merged = result?.data?.find((c) => c.name === name) ?? mine
        this.$store.commit('SET_TABLE_ROW', {
          table: 'characters',
          name,
          data: merged,
        })
        this.$store.commit('SET_ORIGINAL_ROW', {
          table: 'characters',
          name,
          data: JSON.parse(JSON.stringify(merged)),
        })
        this.justSaved = true
      } catch (err) {
        this.saveError = err.message
      } finally {
        this.savingName = null
      }
    },

    // Saves everything currently pending across the whole table at once —
    // for when you're done experimenting and just want it all written.
    async saveChanges() {
      this.savingName = 'all'
      this.saveError = null
      try {
        const result = await this.$store.dispatch('save', 'characters')
        if (result?.conflicts?.length) {
          this.saveError = `Saved with conflicts resolved in favor of disk: ${result.conflicts.join(
            ', '
          )}`
        }
        // Uses SET_ORIGINAL_TABLE, not SET_ORIGINALS — the latter clears
        // dirtyTables for EVERY table, which would wrongly wipe out some
        // other unrelated pending change elsewhere in the app.
        this.$store.commit('SET_ORIGINAL_TABLE', {
          table: 'characters',
          data: JSON.parse(JSON.stringify(this.$store.state.characters)),
        })
        this.justSaved = true
      } catch (err) {
        this.saveError = err.message
      } finally {
        this.savingName = null
      }
    },
  },
}
