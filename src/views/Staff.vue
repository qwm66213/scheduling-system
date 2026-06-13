<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { getStaff } from '../utils/api'
import { useStore } from '../composables/useStore'

const { selectedStoreId, getStoreId } = useStore()

const tableData = ref([])
const loading = ref(false)
const currentPage = ref(1)
const pageSize = ref(15)
const total = ref(0)

// 今日信息
const todayInfo = computed(() => {
  const today = new Date()
  const weekNames = ['日', '一', '二', '三', '四', '五', '六']
  return {
    date: today.toISOString().slice(0, 10),
    weekday: '星期' + weekNames[today.getDay()]
  }
})

async function loadData() {
  loading.value = true
  try {
    const params = { page: currentPage.value, pageSize: pageSize.value }
    const storeId = getStoreId()
    if (storeId) params.store_id = storeId
    const result = await getStaff(params)
    // 兼容旧格式（数组）和新格式（分页对象）
    if (Array.isArray(result)) {
      tableData.value = result
      total.value = result.length
    } else {
      tableData.value = result.data || []
      total.value = result.total || 0
    }
  } finally {
    loading.value = false
  }
}

function handlePageChange(page) {
  currentPage.value = page
  loadData()
}

onMounted(() => {
  loadData()
})

// 监听门店变化时重置分页
watch(selectedStoreId, () => {
  currentPage.value = 1
  loadData()
})
</script>

<template>
  <div class="staff-page">
    <div class="time-cards">
      <div class="time-card">
        <div class="time-card-label">今天是</div>
        <div class="time-card-value">{{ todayInfo.date }}</div>
        <div class="time-card-sub">{{ todayInfo.weekday }}</div>
      </div>
    </div>

    <div class="page-card">
      <div class="page-card__header">
        <div>
          <div class="page-card__title">员工列表</div>
          <div class="page-card__desc">共 {{ total }} 名员工</div>
        </div>
      </div>
      <div class="page-card__body--flush">
        <el-table
          v-if="tableData.length > 0"
          :data="tableData"
          v-loading="loading"
          stripe
          style="width: 100%;"
        >
          <el-table-column prop="store" label="所属门店" min-width="120" />
          <el-table-column prop="name" label="姓名" min-width="100" />
          <el-table-column prop="position" label="岗位" min-width="100" />
          <el-table-column prop="workName" label="工作名" min-width="100" />
        </el-table>
        <div v-else-if="loading" v-loading="loading" style="min-height: 200px;"></div>
        <div v-else class="page-card__empty">暂无员工数据</div>
      </div>
      <div v-if="total > 0" class="page-card__footer">
        <el-pagination
          v-model:current-page="currentPage"
          :page-size="pageSize"
          :total="total"
          layout="total, prev, pager, next"
          @current-change="handlePageChange"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.staff-page {
  min-height: calc(100vh - 60px - 32px);
}
</style>