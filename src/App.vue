<template>
  <AppLayout />
</template>

<script>
import AppLayout from '@/AppLayout.vue'
import dataService from './utils/dataService'

export default {
  name: 'App',
  components: { AppLayout },
  data() {
    return {}
  },
  async created() {
    await this.$store.dispatch('loadAll')
  },
}
</script>

<style>
@import './theme.css';

html {
  font-size: 16px;
}

body {
  font-size: var(--font-size-lg);
  line-height: var(--line-height-base);
}

html,
body,
#app {
  margin: 0;
  padding: 0;
  min-height: 100%;
  background-color: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-body);
}

p,
div {
  font-size: var(--font-size-lg);
  line-height: var(--line-height-base);
}

h1,
h2,
h3,
h4,
h5,
h6 {
  margin: 0 0 1rem;
  font-family: var(--font-display);
  color: var(--color-text-strong);
  line-height: 1.2;
}

h1 {
  font-size: var(--font-size-3xl);
}

h2 {
  font-size: var(--font-size-3xl);
}

h3 {
  font-size: var(--font-size-2xl);
}

h4 {
  font-size: var(--font-size-xl);
}

h5 {
  font-size: var(--font-size-lg);
}

h6 {
  font-size: var(--font-size-md);
}

button,
input,
textarea {
  font-family: inherit;
}

/* ── Global utilities ── */

/* Sidebar / panel column header (used in CombatContext, CharacterContext, Battle, etc.) */
.col-label {
  padding: 0.4rem 0.6rem;
  font-family: var(--font-display);
  font-size: var(--font-size-base);
  color: var(--color-text-low);
  border-bottom: 1px solid var(--color-border);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  flex-shrink: 0;
}

/* In-panel section divider (used in CharacterCombatPanel, Battle, CharacterInventory, etc.) */
.section-label {
  font-family: var(--font-display);
  font-size: var(--font-size-base);
  color: var(--color-text-low);
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

/* Thin scrollbar styling — add alongside overflow-y: auto */
.scrollable {
  scrollbar-width: thin;
  scrollbar-color: var(--color-scrollbar) transparent;
}

/* Centered placeholder when a panel has nothing to show */
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-text-low);
  font-style: italic;
  text-align: center;
  padding: 1rem;
}
</style>
