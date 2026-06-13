<script setup>
defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
})
</script>

<template>
  <!-- 对齐 cuisine-ops: flex items-end justify-between gap-4 mb-8 pb-5 border-b -->
  <div class="page-heading">
    <div>
      <div class="page-heading__label">930 Operation</div>
      <h2 class="page-heading__title">{{ title }}</h2>
      <p v-if="subtitle" class="page-heading__subtitle">{{ subtitle }}</p>
    </div>
    <div v-if="$slots.actions" class="page-heading__actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped>
.page-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 32px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--border);
}

/* 对齐 cuisine-ops: text-[11px] tracking-[0.3em] text-gold uppercase mb-2 */
.page-heading__label {
  font-size: 11px;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--gold);
  margin-bottom: 8px;
}

/* 对齐 cuisine-ops: font-display text-3xl */
.page-heading__title {
  font-family: var(--font-display);
  font-size: 30px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.3;
  margin: 0;
  letter-spacing: -0.01em;
}

/* 对齐 cuisine-ops: text-sm text-muted-foreground mt-1.5 */
.page-heading__subtitle {
  font-size: 14px;
  color: var(--text-muted);
  margin: 6px 0 0;
}

.page-heading__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
</style>
