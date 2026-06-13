<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useStore } from './composables/useStore'
import AppSidebar from './layouts/AppSidebar.vue'
import AppHeader from './layouts/AppHeader.vue'

const route = useRoute()
const router = useRouter()
const isCollapse = ref(false)

const user = computed(() => JSON.parse(localStorage.getItem('user') || '{}'))
const { STORES, ALL_STORES, STORE_ID_LIST, selectedStoreId, isSuperAdmin, allowAllStores, initStore, setStoreId, getStoreName } = useStore()

const allMenuItems = [
  { path: '/revenue', icon: 'Money', title: '营业额管理' },
  { path: '/schedule', icon: 'Calendar', title: '预排班' },
  { path: '/attendance', icon: 'Calendar', title: '考勤记录' },
  { path: '/daily-summary', icon: 'DataLine', title: '每日奖金汇总' },
  { path: '/personal-summary', icon: 'UserFilled', title: '个人奖金明细' },
  { path: '/staff', icon: 'User', title: '员工管理' },
  { path: '/accounts', icon: 'UserFilled', title: '账号管理', adminOnly: true },
  { path: '/settings', icon: 'Setting', title: '设置' },
]

const menuItems = computed(() => {
  if (isSuperAdmin.value) return allMenuItems
  return allMenuItems.filter(item => !item.adminOnly)
})

const storeOptions = computed(() => {
  return STORE_ID_LIST
    .filter(id => id !== 'all')
    .map(id => ({ value: id, label: STORES[id] }))
})

function handleLogout() {
  localStorage.removeItem('user')
  localStorage.removeItem('token')
  localStorage.removeItem('refreshToken')
  localStorage.removeItem('selectedStoreId')
  window.location.href = '/login.html'
}

function handleStoreChange(val) {
  setStoreId(val)
}

onMounted(() => {
  initStore()
})
</script>

<template>
  <!-- 对齐 cuisine-ops: min-h-screen flex w-full bg-background -->
  <div class="app-layout">
    <AppSidebar
      :is-collapse="isCollapse"
      :user="user"
      @logout="handleLogout"
    />

    <!-- 对齐 cuisine-ops: flex-1 flex flex-col min-w-0 -->
    <div class="app-main-wrapper">
      <AppHeader
        :is-super-admin="isSuperAdmin"
        :selected-store-id="selectedStoreId"
        :page-title="route.meta.title"
        :allow-all-stores="allowAllStores"
        :store-options="storeOptions"
        @toggle-collapse="isCollapse = !isCollapse"
        @store-change="handleStoreChange"
        @logout="handleLogout"
      />

      <!-- 对齐 cuisine-ops: flex-1 p-6 lg:p-8 overflow-x-hidden -->
      <main class="app-content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<style>
/* ========== 全局重置 ========== */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  height: 100%;
}

body {
  font-family: var(--font-sans);
  background-color: var(--bg-primary);
  color: var(--text-primary);
  -webkit-font-smoothing: antialiased;
}

h1, h2, h3 {
  font-family: var(--font-display);
  letter-spacing: -0.01em;
}

/* ========== 布局 ========== */
.app-layout {
  display: flex;
  min-height: 100vh;
  width: 100%;
  background: var(--bg-primary);
}

.app-main-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.app-content {
  flex: 1;
  padding: 24px;
  overflow-x: hidden;
}

@media (min-width: 1024px) {
  .app-content {
    padding: 32px;
  }
}

/* ========== 滚动条 ========== */
.app-content::-webkit-scrollbar {
  width: 6px;
}

.app-content::-webkit-scrollbar-track {
  background: transparent;
}

.app-content::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.12);
  border-radius: 3px;
}

.app-content::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.2);
}
</style>
