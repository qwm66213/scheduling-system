import { ref, computed, watch } from 'vue'

const STORES = ['金', '凉', '国', '长', '阳', '殷', '宜', '中', '灵', '柳']

const selectedStoreId = ref(null)

export function useStore() {
  const user = computed(() => {
    const userStr = localStorage.getItem('user')
    return userStr ? JSON.parse(userStr) : {}
  })

  const isSuperAdmin = computed(() => user.value.role === 'admin')

  // 初始化：默认选择金门店（store_id=1）
  function initStore() {
    if (!isSuperAdmin.value) {
      // 系统管理员绑定自己的门店
      selectedStoreId.value = user.value.store_id
    } else {
      // 超级管理员默认选择金门店
      const saved = localStorage.getItem('selectedStoreId')
      if (saved) {
        selectedStoreId.value = Number(saved)
      } else {
        selectedStoreId.value = 1 // 默认金门店
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
    return STORES[id - 1] || '-'
  }

  return {
    STORES,
    selectedStoreId,
    isSuperAdmin,
    initStore,
    setStoreId,
    getStoreId,
    getStoreName
  }
}
