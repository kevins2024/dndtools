<template>
  <div class="tn-block">
    <div
      v-if="hasChildren"
      class="tn-row tn-clickable"
      :class="'tn-type-' + node.type"
      @click="open = !open"
    >
      <span class="tn-chevron" :class="{ open }">▸</span>
      <span class="tn-label">{{ node.label }}</span>
      <span v-for="tag in node.tags || []" :key="tag" class="tn-tag">{{
        tag
      }}</span>
    </div>
    <div v-else-if="node.type === 'image'" class="tn-image-wrap">
      <img :src="node.src" :alt="node.label || ''" class="tn-image" />
    </div>
    <div v-else class="tn-row" :class="'tn-type-' + node.type">
      <span class="tn-spacer" />
      <span class="tn-label">{{ node.label }}</span>
      <span v-for="tag in node.tags || []" :key="tag" class="tn-tag">{{
        tag
      }}</span>
    </div>
    <div v-if="open && hasChildren" class="tn-children">
      <TreeNode v-for="(child, i) in node.children" :key="i" :node="child" />
    </div>
  </div>
</template>

<script>
export default {
  name: 'TreeNode',
  props: {
    node: { type: Object, required: true },
  },
  data() {
    return { open: false }
  },
  computed: {
    hasChildren() {
      return Array.isArray(this.node.children) && this.node.children.length > 0
    },
  },
}
</script>

<style scoped>
.tn-block {
  display: flex;
  flex-direction: column;
}

.tn-row {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  padding: 0.2rem 0.4rem;
  border-radius: 3px;
  line-height: 1.4;
  flex-wrap: wrap;
}

.tn-clickable {
  cursor: pointer;
  user-select: none;
}

.tn-clickable:hover {
  background: var(--color-bg-panel);
}

.tn-chevron {
  flex-shrink: 0;
  width: 14px;
  font-size: 0.65rem;
  color: var(--color-text-low);
  transition: transform 0.12s;
  display: inline-block;
  transform: rotate(0deg);
}

.tn-chevron.open {
  transform: rotate(90deg);
}

.tn-spacer {
  flex-shrink: 0;
  width: 14px;
}

.tn-label {
  flex: 1;
  min-width: 0;
}

.tn-tag {
  font-size: var(--font-size-xs);
  background: var(--color-bg-deep);
  border: 1px solid var(--color-border);
  border-radius: 3px;
  padding: 0px 5px;
  color: var(--color-text-low);
  white-space: nowrap;
  align-self: center;
}

.tn-children {
  margin-left: 14px;
  padding-left: 7px;
  border-left: 1px solid var(--color-border);
}

/* Type styles — size stays consistent, only color/weight/style varies */
.tn-type-section > .tn-label {
  font-family: var(--font-display);
  font-size: var(--font-size-lg);
  color: var(--color-accent);
  letter-spacing: 0.04em;
  font-weight: 600;
}

.tn-type-item > .tn-label {
  font-size: var(--font-size-base);
  color: var(--color-text);
  font-weight: 500;
}

.tn-type-group > .tn-label {
  font-size: var(--font-size-base);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.tn-type-leaf > .tn-label {
  font-size: var(--font-size-base);
  color: var(--color-text);
}

.tn-type-text > .tn-label {
  font-size: var(--font-size-base);
  color: var(--color-text);
  line-height: 1.5;
  white-space: normal;
}

.tn-type-note > .tn-label {
  font-size: var(--font-size-base);
  color: var(--color-text-muted);
  font-style: italic;
  line-height: 1.45;
  white-space: normal;
}

.tn-image-wrap {
  padding: 0.4rem 0.4rem 0.4rem 21px;
}

.tn-image {
  max-width: 100%;
  max-height: 260px;
  object-fit: contain;
  border-radius: 4px;
  border: 1px solid var(--color-border);
  display: block;
}
</style>
