// Gives a component `sheet`: the engine's calculated sheet for `this.character` (see utils/engineSheet.js),
// null until it arrives or when there is no server. It follows the character: any change to the character
// or to the items it has equipped asks again. The component reads numbers and their `breakdown` lines
// from it instead of working them out.
import { sheetRequest, fetchSheet } from '@/utils/engineSheet'

export default {
  data() {
    return { sheet: null }
  },
  computed: {
    engineSheetRequest() {
      return sheetRequest(this.character, this.$store.state.party_items ?? [])
    },
  },
  watch: {
    engineSheetRequest: {
      immediate: true,
      handler(body) {
        fetchSheet(body).then((sheet) => {
          // an answer for an older character state is dropped
          if (body === this.engineSheetRequest) this.sheet = sheet
        })
      },
    },
  },
}
