<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const props = defineProps({
  isCollapse: Boolean,
  user: Object,
})

const emit = defineEmits(['logout'])
const route = useRoute()

// 对齐 cuisine-ops 的4组菜单
const groups = [
  {
    label: '经营数据',
    items: [
      { title: '营业额管理', url: '/revenue', icon: 'TrendCharts' },
      { title: '每日奖金汇总', url: '/daily-summary', icon: 'Coin' },
    ],
  },
  {
    label: '排班考勤',
    items: [
      { title: '预排班', url: '/schedule', icon: 'Calendar' },
      { title: '考勤记录', url: '/attendance', icon: 'DocumentChecked' },
    ],
  },
  {
    label: '员工奖金',
    items: [
      { title: '个人奖金明细', url: '/personal-summary', icon: 'Wallet' },
      { title: '员工管理', url: '/staff', icon: 'User' },
    ],
  },
  {
    label: '系统',
    items: [
      { title: '账号管理', url: '/accounts', icon: 'Shield', adminOnly: true },
      { title: '设置', url: '/settings', icon: 'Setting' },
    ],
  },
]

// 根据权限过滤
const filteredGroups = computed(() => {
  const isAdmin = props.user?.role === 'admin'
  return groups
    .map(g => ({
      ...g,
      items: g.items.filter(item => !item.adminOnly || isAdmin),
    }))
    .filter(g => g.items.length > 0)
})

const isActive = (url) => route.path === url

const roleLabel = computed(() =>
  props.user?.role === 'admin' ? '超级管理员' : '系统管理员'
)

const avatarChar = computed(() => props.user?.username?.[0] || '管')
</script>

<template>
  <aside class="sidebar" :class="{ 'sidebar--collapsed': isCollapse }">
    <!-- SidebarHeader: h-16, border-b -->
    <div class="sidebar__header">
      <template v-if="isCollapse">
        <span class="gold-gradient-text sidebar__logo-collapsed">9</span>
      </template>
      <template v-else>
        <div class="sidebar__brand">
          <div class="sidebar__brand-row">
            <span class="gold-gradient-text sidebar__logo-num">930</span>
            <span class="sidebar__logo-text">私房菜</span>
          </div>
          <span class="sidebar__brand-sub">Operation Platform</span>
        </div>
      </template>
    </div>

    <!-- SidebarContent: px-2 py-3 -->
    <div class="sidebar__content">
      <template v-for="group in filteredGroups" :key="group.label">
        <!-- GroupLabel -->
        <div v-if="!isCollapse" class="sidebar__group-label">{{ group.label }}</div>

        <!-- MenuItems -->
        <div
          v-for="item in group.items"
          :key="item.url"
          class="sidebar__menu-item"
          :class="{ 'sidebar__menu-item--active': isActive(item.url) }"
          :title="isCollapse ? item.title : undefined"
          @click="$router.push(item.url)"
        >
          <el-icon class="sidebar__menu-icon"><component :is="item.icon" /></el-icon>
          <span v-if="!isCollapse" class="sidebar__menu-text">{{ item.title }}</span>
        </div>
      </template>
    </div>

    <!-- SidebarFooter: border-t, p-3 -->
    <div class="sidebar__footer">
      <template v-if="isCollapse">
        <div class="sidebar__logout-icon" @click="emit('logout')">
          <el-icon><SwitchButton /></el-icon>
        </div>
      </template>
      <template v-else>
        <div class="sidebar__user">
          <div class="sidebar__avatar">{{ avatarChar }}</div>
          <div class="sidebar__user-info">
            <div class="sidebar__user-name">{{ user?.username || '管理员' }}</div>
            <div class="sidebar__user-role">{{ roleLabel }}</div>
          </div>
          <div class="sidebar__logout-btn" @click="emit('logout')">
            <el-icon><SwitchButton /></el-icon>
          </div>
        </div>
      </template>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  width: var(--sidebar-width);
  height: 100vh;
  background: var(--sidebar-bg);
  border-right: 1px solid var(--sidebar-border);
  transition: width var(--transition-normal);
  overflow: hidden;
  flex-shrink: 0;
}

.sidebar--collapsed {
  width: var(--sidebar-width-collapsed);
}

/* ========== SidebarHeader ========== */
.sidebar__header {
  height: var(--header-height);
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid var(--sidebar-border);
  flex-shrink: 0;
  padding: 0 16px;
}

.sidebar__brand {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}

.sidebar__brand-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.sidebar__logo-num {
  font-family: var(--font-display);
  font-size: 28px;
  font-weight: 900;
  letter-spacing: -0.02em;
  line-height: 1;
}

.sidebar__logo-text {
  font-size: 15px;
  font-weight: 600;
  color: var(--gold-bright);
  letter-spacing: 0.15em;
}

.sidebar__logo-collapsed {
  font-family: var(--font-display);
  font-size: 24px;
  font-weight: 900;
  line-height: 1;
}

.sidebar__brand-sub {
  font-size: 10px;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  color: var(--text-muted);
  padding-left: 2px;
}

/* ========== SidebarContent ========== */
.sidebar__content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 12px 8px;
}

.sidebar__content::-webkit-scrollbar {
  width: 4px;
}

.sidebar__content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}

/* GroupLabel - 对齐 cuisine-ops: text-[11px] tracking-widest text-muted-foreground/70 uppercase */
.sidebar__group-label {
  padding: 16px 12px 6px;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: rgba(181, 179, 174, 0.5);
  white-space: nowrap;
}

/* MenuItem - 对齐 cuisine-ops: h-9, rounded-lg */
.sidebar__menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 36px;
  padding: 0 12px;
  margin-bottom: 2px;
  border-radius: 8px;
  color: var(--sidebar-text);
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
  border: 1px solid transparent;
}

.sidebar__menu-item:hover {
  background: var(--sidebar-accent);
  color: var(--gold-bright);
}

/* Active - 对齐 cuisine-ops: bg-gold-soft text-gold-bright border border-gold/30 */
.sidebar__menu-item--active {
  background: var(--gold-soft);
  color: var(--gold-bright);
  border-color: rgba(201, 168, 76, 0.3);
}

.sidebar__menu-item--active:hover {
  background: var(--gold-soft);
}

.sidebar__menu-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.sidebar__menu-text {
  font-size: 14px;
  font-weight: 400;
}

/* 折叠状态：居中 */
.sidebar--collapsed .sidebar__menu-item {
  justify-content: center;
  padding: 0;
}

.sidebar--collapsed .sidebar__content {
  padding: 12px 6px;
}

.sidebar--collapsed .sidebar__menu-item {
  height: 36px;
  margin-bottom: 2px;
}

/* ========== SidebarFooter ========== */
.sidebar__footer {
  border-top: 1px solid var(--sidebar-border);
  padding: 12px;
  flex-shrink: 0;
}

.sidebar__user {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* Avatar - 对齐 cuisine-ops: h-9 w-9, border-gold/40 */
.sidebar__avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--gold-soft);
  color: var(--gold-bright);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  border: 1px solid rgba(201, 168, 76, 0.4);
  flex-shrink: 0;
}

.sidebar__user-info {
  flex: 1;
  min-width: 0;
}

.sidebar__user-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--sidebar-text-active);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar__user-role {
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
}

.sidebar__logout-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
  flex-shrink: 0;
}

.sidebar__logout-btn:hover {
  color: var(--gold-bright);
  background: rgba(255, 255, 255, 0.06);
}

.sidebar__logout-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  margin: 0 auto;
  border-radius: 6px;
  color: var(--text-muted);
  cursor: pointer;
  transition: color var(--transition-fast);
}

.sidebar__logout-icon:hover {
  color: var(--gold-bright);
}
</style>
