<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useStore } from './composables/useStore'

const route = useRoute()
const router = useRouter()
const isCollapse = ref(false)

const user = computed(() => JSON.parse(localStorage.getItem('user') || '{}'))
const { STORES, STORE_ID_LIST, selectedStoreId, isSuperAdmin, initStore, setStoreId, getStoreName } = useStore()

const allMenuItems = [
  { path: '/', icon: 'DataAnalysis', title: '数据看板' },
  { path: '/revenue', icon: 'Money', title: '营业额管理' },
  { path: '/schedule', icon: 'Calendar', title: '预排班' },
  { path: '/attendance', icon: 'Calendar', title: '考勤记录' },
  { path: '/staff', icon: 'User', title: '员工管理' },
  { path: '/accounts', icon: 'UserFilled', title: '账号管理', adminOnly: true },
  { path: '/settings', icon: 'Setting', title: '设置' },
  { path: '/daily-summary', icon: 'DataLine', title: '总数据表' },
  { path: '/personal-summary', icon: 'UserFilled', title: '个人数据表' },
]

const menuItems = computed(() => {
  if (isSuperAdmin.value) return allMenuItems
  return allMenuItems.filter(item => !item.adminOnly)
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
  <el-container style="height: 100vh">
    <el-aside :width="isCollapse ? '64px' : '200px'" style="transition: width 0.3s; background: #001529;">
      <div style="height: 60px; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 18px; font-weight: bold; white-space: nowrap; overflow: hidden;">
        <span v-if="!isCollapse">930管理系统</span>
        <span v-else>9</span>
      </div>
      <el-menu
        :default-active="route.path"
        router
        :collapse="isCollapse"
        background-color="#001529"
        text-color="#ffffffb3"
        active-text-color="#fff"
        style="border-right: none;"
      >
        <el-menu-item v-for="item in menuItems" :key="item.path" :index="item.path">
          <el-icon><component :is="item.icon" /></el-icon>
          <template #title>{{ item.title }}</template>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container style="height: 100%; flex-direction: column;">
      <el-header style="background: #fff; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 1px 4px rgba(0,0,0,0.08); padding: 0 20px; height: 60px; flex-shrink: 0;">
        <div style="display: flex; align-items: center; gap: 16px;">
          <el-icon :size="20" style="cursor: pointer;" @click="isCollapse = !isCollapse">
            <component :is="isCollapse ? 'Expand' : 'Fold'" />
          </el-icon>
          <span style="font-size: 14px; color: #666;">{{ route.meta.title || '930管理系统' }}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 20px;">
          <template v-if="isSuperAdmin">
            <div style="display: flex; align-items: center; gap: 10px; background: #ecf5ff; padding: 10px 20px; border-radius: 8px; border: 1px solid #b3d8ff;">
              <span style="font-size: 16px; color: #409eff;">当前门店：</span>
              <b style="font-size: 18px; color: #409eff;">{{ getStoreName(selectedStoreId) }}</b>
              <el-select v-model="selectedStoreId" placeholder="选择门店" style="width: 120px;" @change="handleStoreChange">
                <el-option v-for="id in STORE_ID_LIST" :key="id" :label="STORES[id]" :value="id" />
              </el-select>
            </div>
          </template>
          <el-button type="primary" @click="handleLogout" style="font-weight: 500;">退出</el-button>
        </div>
      </el-header>

      <el-main class="main-area">
        <router-view class="main-view" />
      </el-main>
    </el-container>
  </el-container>
</template>

<style>
body { margin: 0; padding: 0; }
html, body, #app { height: 100%; }
#app { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
.el-aside { overflow: hidden; }
.main-area {
  background: #f0f2f5 !important;
  padding: 16px !important;
  overflow-y: auto !important;
  flex: 1 !important;
  height: 0 !important;
}
.main-view {
  min-height: 100%;
}
</style>
