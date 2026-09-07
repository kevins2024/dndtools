<template>
  <component :is="icon" v-if="icon" class="school-icon" />
</template>

<script>
import {
  Shield,
  Sparkles,
  Eye,
  Repeat2,
  Heart,
  Skull,
  Ghost,
  Flame,
} from 'lucide-vue'

const SCHOOL_MAP = {
  abjuration: Shield,
  conjuration: Sparkles,
  divination: Eye,
  transmutation: Repeat2,
  enchantment: Heart,
  necromancy: Skull,
  illusion: Ghost,
  evocation: Flame,
}

export default {
  name: 'SchoolIcon',
  props: {
    school: { type: String, default: '' },
  },
  computed: {
    icon() {
      return SCHOOL_MAP[this.school.toLowerCase()] ?? null
    },
  },
}
</script>
