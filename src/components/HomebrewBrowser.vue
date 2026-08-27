<template>
  <div class="homebrew-browser">
    <TreeNode v-for="(node, i) in tree" :key="i" :node="node" />
  </div>
</template>

<script>
import TreeNode from './TreeNode.vue'
import houseRules from '@/data/house_rules.json'
import weaponTypesAndLanguages from '@/data/weapon_types_and_languages.json'

export default {
  name: 'HomebrewBrowser',
  components: { TreeNode },

  data() {
    return {
      // species.json is the full SRD species cache (~1.7MB) — this browser
      // only ever shows the project's own 4 custom races, so it's loaded via
      // a dynamic import (its own lazy webpack chunk) instead of a static
      // import, which would otherwise bundle the whole SRD cache into the
      // main app.js just to filter it down to a handful of entries.
      homebrewRaces: [],
    }
  },

  created() {
    import('@/data/api_data_cache/species.json').then((mod) => {
      const allSpecies = mod.default ?? mod
      this.homebrewRaces = allSpecies.filter((s) => s.homebrew)
    })
  },

  computed: {
    tree() {
      return [
        this.buildRules(),
        this.buildRaces(),
        this.buildWeaponTypes(),
        this.buildLanguages(),
      ]
    },
  },

  methods: {
    imageNode(src, label) {
      return { type: 'image', src, label: label ?? '' }
    },

    buildRules() {
      return {
        label: 'Rules',
        type: 'section',
        children: (houseRules ?? []).map((r) => ({
          label: r.name,
          type: 'item',
          children: [
            ...(r.image ? [this.imageNode(r.image, r.name)] : []),
            { label: r.description, type: 'text' },
            ...(r.notes ? [{ label: r.notes, type: 'note' }] : []),
          ],
        })),
      }
    },

    buildRaces() {
      return {
        label: 'Races',
        type: 'section',
        children: (this.homebrewRaces ?? []).map((r) => ({
          label: r.name,
          type: 'item',
          tags: [r.size, r.speed + 'ft', r.origin].filter(Boolean),
          children: [
            ...(r.image ? [this.imageNode(r.image, r.name)] : []),
            ...(r.appearance ? [{ label: r.appearance, type: 'text' }] : []),
            { label: 'Languages: ' + r.languages.join(', '), type: 'leaf' },
            { label: 'Ability Scores: ' + r.ability_score_bonus, type: 'leaf' },
            ...(r.traits?.length
              ? [
                  {
                    label: 'Traits',
                    type: 'group',
                    children: r.traits.map((t) => ({
                      label: t.name,
                      type: 'item',
                      tags: [
                        t.type === 'active' ? 'Active' : 'Passive',
                        ...(t.recharge
                          ? [this.formatRecharge(t.recharge)]
                          : []),
                      ],
                      children: [{ label: t.description, type: 'text' }],
                    })),
                  },
                ]
              : []),
            ...(r.notes ? [{ label: r.notes, type: 'note' }] : []),
          ],
        })),
      }
    },

    buildWeaponTypes() {
      return {
        label: 'Weapon Types',
        type: 'section',
        children: (weaponTypesAndLanguages.weapon_types ?? []).map((w) => ({
          label: w.name,
          type: 'item',
          tags: [w.damage_dice + ' ' + w.damage_type, w.weapon_type],
          children: [
            ...(w.image ? [this.imageNode(w.image, w.name)] : []),
            {
              label: [
                w.finesse ? 'Finesse' : null,
                w.thrown && w.range
                  ? `Thrown ${w.range.normal}/${w.range.long}ft`
                  : w.thrown
                  ? 'Thrown'
                  : null,
                w.versatile ? 'Versatile' : null,
              ]
                .filter(Boolean)
                .join(' · '),
              type: 'leaf',
            },
            ...(w.notes ? [{ label: w.notes, type: 'text' }] : []),
          ].filter((c) => c.label || c.type === 'image'),
        })),
      }
    },

    buildLanguages() {
      return {
        label: 'Languages',
        type: 'section',
        children: (weaponTypesAndLanguages.languages ?? []).map((l) => ({
          label: l.name,
          type: 'item',
          tags: l.type ? [l.type] : [],
          children: [
            ...(l.image ? [this.imageNode(l.image, l.name)] : []),
            ...(l.description ? [{ label: l.description, type: 'text' }] : []),
            ...(l.speakers?.length
              ? [{ label: 'Speakers: ' + l.speakers.join(', '), type: 'leaf' }]
              : []),
          ],
        })),
      }
    },

    formatRecharge(val) {
      return val === 'long_rest'
        ? 'Long Rest'
        : val === 'short_rest'
        ? 'Short Rest'
        : val
    },
  },
}
</script>

<style scoped>
.homebrew-browser {
  height: 100%;
  overflow-y: auto;
  padding: 0.6rem 0.8rem;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}
</style>
