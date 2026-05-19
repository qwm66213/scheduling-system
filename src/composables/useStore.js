import { ref, computed, watch } from 'vue'

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

// 门店ID列表（用于下拉选择）
const STORE_ID_LIST = Object.keys(STORES).map(Number).sort((a, b) => a - b)

const selectedStoreId = ref(null)

export function useStore() {
  const user = computed(() => {
    const userStr = localStorage.getItem('user')
    return userStr ? JSON.parse(userStr) : {}
  })

  const isSuperAdmin = computed(() => user.value.role === 'admin')

  // 初始化：默认选择金沙江店（store_id=13）
  function initStore() {
    if (!isSuperAdmin.value) {
      // 系统管理员绑定自己的门店
      selectedStoreId.value = user.value.store_id
    } else {
      // 超级管理员默认选择金沙江店
      const saved = localStorage.getItem('selectedStoreId')
      if (saved) {
        selectedStoreId.value = Number(saved)
      } else {
        selectedStoreId.value = 13 // 默认金沙江店
      }
    }
  }

  // 设置门店
  function setStoreId(id) {
    selectedStoreId.value = id
    localStorage.setItem('selectedStoreId', id === null ? '' : String(id))
  }

  // 获取当前门店 ID（用于 API 请求）
  function getStoreId() {
    if (isSuperAdmin.value) {
      return selectedStoreId.value // 超级管理员返回选中的门店
    }
    return user.value.store_id // 系统管理员返回自己的门店
  }

  // 获取门店名称
  function getStoreName(id) {
    if (!id) return '全部'
    return STORES[id] || '-'
  }

  return {
    STORES,
    STORE_ID_LIST,
    selectedStoreId,
    isSuperAdmin,
    initStore,
    setStoreId,
    getStoreId,
    getStoreName
  }
}
