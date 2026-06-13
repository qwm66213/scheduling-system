<script setup>
import { computed } from 'vue'

const props = defineProps({
  label: { type: String, required: true },
  value: { type: [String, Number], required: true },
  unit: { type: String, default: '' },
  delta: { type: Number, default: undefined },
  icon: { type: String, default: '' },
  accent: { type: Boolean, default: false },
})

const positive = computed(() => (props.delta ?? 0) >= 0)
</script>

<template>
  <!-- 对齐 cuisine-ops: p-5 bg-card border-border relative overflow-hidden group hover:border-gold/40 -->
  <div class="kpi-card" :class="{ 'kpi-card--accent': accent }">
    <!-- 装饰性金色光圈: absolute -right-6 -top-6 w-24 h-24 rounded-full bg-gold/5 blur-2xl -->
    <div class="kpi-card__glow"></div>

    <div class="kpi-card__inner">
      <div>
        <!-- Label: text-xs tracking-wider text-muted-foreground uppercase -->
        <div class="kpi-card__label">{{ label }}</div>

        <!-- Value: font-display text-3xl font-bold -->
        <div class="kpi-card__value-row">
          <span class="kpi-card__value">{{ value }}</span>
          <span v-if="unit" class="kpi-card__unit">{{ unit }}</span>
        </div>

        <!-- Delta: mt-3 inline-flex, success/destructive bg -->
        <div
          v-if="delta !== undefined"
          class="kpi-card__delta"
          :class="positive ? 'kpi-card__delta--positive' : 'kpi-card__delta--negative'"
        >
          <el-icon :size="12">
            <component :is="positive ? 'Top' : 'Bottom'" />
          </el-icon>
          <span>{{ positive ? '+' : '' }}{{ delta.toFixed(1) }}% 较昨日</span>
        </div>
      </div>

      <!-- Icon: h-10 w-10 rounded-lg bg-gold-soft border-gold/30 -->
      <div v-if="icon" class="kpi-card__icon">
        <el-icon :size="20"><component :is="icon" /></el-icon>
      </div>
    </div>
  </div>
</template>

<style scoped>
.kpi-card {
  position: relative;
  overflow: hidden;
  padding: 20px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  transition: all var(--transition-fast);
}

.kpi-card:hover {
  border-color: rgba(201, 168, 76, 0.4);
}

.kpi-card--accent {
  border-color: rgba(201, 168, 76, 0.4);
  box-shadow: var(--gold-glow);
}

/* 装饰性金色光圈 */
.kpi-card__glow {
  position: absolute;
  right: -24px;
  top: -24px;
  width: 96px;
  height: 96px;
  border-radius: 50%;
  background: rgba(201, 168, 76, 0.05);
  filter: blur(40px);
  transition: background var(--transition-fast);
}

.kpi-card:hover .kpi-card__glow {
  background: rgba(201, 168, 76, 0.1);
}

.kpi-card__inner {
  position: relative;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.kpi-card__label {
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.kpi-card__value-row {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin-top: 12px;
}

.kpi-card__value {
  font-family: var(--font-display);
  font-size: 30px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1;
}

.kpi-card__unit {
  font-size: 14px;
  color: var(--text-muted);
}

/* Delta badge */
.kpi-card__delta {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 12px;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 6px;
}

.kpi-card__delta--positive {
  background: var(--success-bg);
  color: var(--success);
}

.kpi-card__delta--negative {
  background: var(--destructive-bg);
  color: var(--destructive);
}

/* Icon badge: h-10 w-10 rounded-lg bg-gold-soft border-gold/30 */
.kpi-card__icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: var(--gold-soft);
  border: 1px solid rgba(201, 168, 76, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--gold-bright);
  flex-shrink: 0;
}
</style>
