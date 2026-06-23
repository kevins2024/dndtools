<template>
  <component :is="icon" v-if="icon" class="class-icon" />
</template>

<script>
import {
  Swords,
  Axe,
  Crosshair,
  Wrench,
  Wand,
  Cross,
  Eye,
  Music,
  Zap,
  ShieldHalf,
  Leaf,
  BowArrow,
  Sparkles,
} from 'lucide-vue'

const CLASS_MAP = {
  fighter: Swords,
  barbarian: Axe,
  rogue: Crosshair,
  artificer: Wrench,
  wizard: Wand,
  cleric: Cross,
  warlock: Eye,
  bard: Music,
  monk: Zap,
  paladin: ShieldHalf,
  druid: Leaf,
  ranger: BowArrow,
  sorcerer: Sparkles,
}

export default {
  name: 'ClassIcon',
  props: {
    character: { type: Object, required: true },
  },
  computed: {
    icon() {
      const primary = (this.character.classes?.[0]?.name ?? '').toLowerCase()
      return CLASS_MAP[primary] ?? null
    },
  },
}
</script>
