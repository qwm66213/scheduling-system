<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const props = defineProps({
  isSuperAdmin: Boolean,
  selectedStoreId: [String, Number],
  pageTitle: String,
  allowAllStores: Boolean,
  storeOptions: Array,
})

const emit = defineEmits(['toggle-collapse', 'store-change', 'logout'])
const route = useRoute()

const titleMap = {
  '/revenue': '营业额管理',
  '/schedule': '预排班',
  '/attendance': '考勤记录',
  '/daily-summary': '每日奖金汇总',
  '/personal-summary': '个人奖金明细',
  '/staff': '员工管理',
  '/accounts': '账号管理',
  '/settings': '设置',
}

const currentTitle = computed(() => props.pageTitle || titleMap[route.path] || '运营平台')
const roleLabel = computed(() => props.isSuperAdmin ? '超级管理员' : '系统管理员')
</script>

<template>
  <header class="app-header">
    <!-- SidebarTrigger -->
    <div class="app-header__trigger" @click="emit('toggle-collapse')">
      <el-icon :size="18"><Fold /></el-icon>
    </div>

    <!-- Separator -->
    <div class="app-header__separator"></div>

    <!-- Title block -->
    <div class="app-header__title-block">
      <h1 class="app-header__title">{{ currentTitle }}</h1>
      <span class="app-header__subtitle">930 PRIVATE KITCHEN · 运营管理</span>
    </div>

    <!-- Right side -->
    <div class="app-header__right">
      <!-- Search (hidden on mobile) -->
      <div class="app-header__search">
        <el-icon class="app-header__search-icon"><Search /></el-icon>
        <input
          type="text"
          class="app-header__search-input"
          placeholder="搜索员工、门店、订单..."
        />
      </div>

      <!-- Store selector -->
      <el-select
        :model-value="selectedStoreId"
        placeholder="选择门店"
        size="default"
        :disabled="!isSuperAdmin"
        class="app-header__store-select"
        @change="emit('store-change', $event)"
      >
        <el-option v-if="allowAllStores" label="全部门店" value="all" />
        <el-option
          v-for="opt in storeOptions"
          :key="opt.value"
          :label="opt.label"
          :value="opt.value"
        />
      </el-select>

      <!-- Notification bell -->
      <div class="app-header__bell">
        <el-icon :size="18"><Bell /></el-icon>
        <span class="app-header__bell-dot"></span>
      </div>

      <!-- User info pill -->
      <div class="app-header__user-pill">
        <span class="app-header__role-badge">{{ roleLabel }}</span>
        <span class="app-header__user-name">{{ pageTitle || '管理员' }}</span>
        <el-icon :size="12" class="app-header__chevron"><ArrowDown /></el-icon>
      </div>
    </div>
  </header>
</template>

<style scoped>
/* 对齐 cuisine-ops: h-16, border-b, bg-card/40, backdrop-blur-sm, sticky, z-30 */
.app-header {
  height: var(--header-height);
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 16px;
  background: rgba(253, 252, 249, 0.4);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  z-index: 30;
  flex-shrink: 0;
}

/* SidebarTrigger - 对齐: text-muted-foreground hover:text-gold-bright */
.app-header__trigger {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.app-header__trigger:hover {
  color: var(--gold-bright);
  background: var(--gold-soft);
}

/* Separator - h-6 vertical */
.app-header__separator {
  width: 1px;
  height: 24px;
  background: var(--border);
}

/* Title block */
.app-header__title-block {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.app-header__title {
  font-size: 18px;
  font-family: var(--font-display);
  color: var(--text-primary);
  line-height: 1.3;
  margin: 0;
  font-weight: 600;
}

.app-header__subtitle {
  font-size: 11px;
  color: var(--text-muted);
  letter-spacing: 0.05em;
}

/* Right side - ml-auto flex items-center gap-3 */
.app-header__right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 12px;
}

/* Search - hidden md:block, pl-9 w-72 */
.app-header__search {
  position: relative;
  display: none;
  width: 288px;
}

@media (min-width: 768px) {
  .app-header__search {
    display: block;
  }
}

.app-header__search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
  font-size: 16px;
  pointer-events: none;
}

.app-header__search-input {
  width: 100%;
  height: 36px;
  padding: 0 12px 0 36px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-secondary);
  font-size: 13px;
  color: var(--text-primary);
  outline: none;
  transition: all var(--transition-fast);
  font-family: var(--font-sans);
}

.app-header__search-input::placeholder {
  color: var(--text-muted);
}

.app-header__search-input:focus {
  border-color: var(--gold);
  box-shadow: 0 0 0 2px var(--gold-soft);
}

/* Store selector - w-56, bg-secondary/60, border-gold/20 */
.app-header__store-select {
  width: 224px;
}

.app-header__store-select :deep(.el-input__wrapper) {
  background: var(--bg-secondary);
  border: 1px solid rgba(201, 168, 76, 0.2);
  border-radius: 8px;
  box-shadow: none;
}

.app-header__store-select :deep(.el-input__wrapper:hover) {
  border-color: var(--gold);
}

.app-header__store-select :deep(.el-input__wrapper.is-focus) {
  border-color: var(--gold);
  box-shadow: 0 0 0 2px var(--gold-soft);
}

/* Notification bell - relative, text-muted-foreground, hover:text-gold-bright */
.app-header__bell {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.app-header__bell:hover {
  color: var(--gold-bright);
}

/* Gold dot - absolute top-2 right-2, h-1.5 w-1.5 */
.app-header__bell-dot {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--gold);
}

/* User pill - bg-secondary/60, border, rounded-lg */
.app-header__user-pill {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 10px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
}

/* Role badge - border-gold/40, text-gold-bright, bg-gold-soft */
.app-header__role-badge {
  font-size: 10px;
  font-weight: 500;
  color: var(--gold-bright);
  background: var(--gold-soft);
  border: 1px solid rgba(201, 168, 76, 0.4);
  padding: 1px 6px;
  border-radius: 4px;
  white-space: nowrap;
}

.app-header__user-name {
  font-size: 13px;
  color: var(--text-primary);
  white-space: nowrap;
}

.app-header__chevron {
  color: var(--text-muted);
}
</style>
