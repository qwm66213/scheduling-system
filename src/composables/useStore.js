import { ref, computed, watch } from 'vue'

// 全部门店的标识
const ALL_STORES = 'all'

// 门店配置：ID -> 名称（使用外部API的门店ID）
const STORES = {
  3: '殷高店',
  4: '930长江西路店',
  5: '930国和店',
  7: '930宜川店',
  8: '930小馆拾光里店',
  9: '930浦锦路店',
  13: '930金沙江店',
  15: '930车站南路店',
  16: '930中华路店',
  18: '930柳营路店',
  19: '930长阳店'
}

// 门店ID列表（用于下拉选择，开头添加"全部"选项）
const STORE_ID_LIST = [ALL_STORES, ...Object.keys(STORES).map(Number).sort((a, b) => a - b)]

const selectedStoreId = ref(null)

export function useStore() {
  const user = computed(() => {
    const userStr = localStorage.getItem('user')
    return userStr ? JSON.parse(userStr) : {}
  })

  const isSuperAdmin = computed(() => user.value.role === 'admin')

  // 初始化：首次登录默认选择"全部"
  function initStore() {
    if (!isSuperAdmin.value) {
      // 系统管理员绑定自己的门店
      selectedStoreId.value = user.value.store_id
    } else {
      // 超级管理员：从 localStorage 读取上次选择，首次登录默认"全部"
      const saved = localStorage.getItem('selectedStoreId')
      if (saved) {
        selectedStoreId.value = saved === 'all' ? 'all' : Number(saved)
      } else {
        selectedStoreId.value = 'all' // 首次登录默认"全部"
      }
    }
  }

  // 设置门店
  function setStoreId(id) {
    selectedStoreId.value = id
    localStorage.setItem('selectedStoreId', String(id))
  }

  // 获取当前门店 ID（用于 API 请求，null 表示全部门店）
  function getStoreId() {
    if (isSuperAdmin.value) {
      return selectedStoreId.value === 'all' ? null : selectedStoreId.value
    }
    return user.value.store_id // 系统管理员返回自己的门店
  }

  // 获取门店名称
  function getStoreName(id) {
    if (id === 'all' || !id) return '全部'
    return STORES[id] || '-'
  }

  return {
    STORES,
    ALL_STORES,
    STORE_ID_LIST,
    selectedStoreId,
    isSuperAdmin,
    initStore,
    setStoreId,
    getStoreId,
    getStoreName
  }
}
