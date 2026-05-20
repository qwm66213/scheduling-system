<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { getStaff } from '../utils/api'
import { useStore } from '../composables/useStore'

const { selectedStoreId, getStoreId } = useStore()

const tableData = ref([])
const loading = ref(false)

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
    const params = {}
    const storeId = getStoreId()
    if (storeId) params.store_id = storeId
    tableData.value = await getStaff(params)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadData()
})

watch(selectedStoreId, () => {
  loadData()
})
</script>

<template>
  <div class="staff-page">
    <!-- 时间卡片 -->
    <div class="time-cards">
      <div class="time-card">
        <div class="time-card-label">今天是</div>
        <div class="time-card-value">{{ todayInfo.date }}</div>
        <div class="time-card-sub">{{ todayInfo.weekday }}</div>
      </div>
    </div>

    <!-- 空数据时不显示表格 -->
    <el-table
      v-if="tableData.length > 0"
      :data="tableData"
      v-loading="loading"
      stripe
      border
      style="width: 100%;"
    >
      <el-table-column prop="store" label="所属门店" min-width="120" />
      <el-table-column prop="name" label="姓名" min-width="100" />
      <el-table-column prop="position" label="岗位" min-width="100" />
      <el-table-column prop="workName" label="工作名" min-width="100" />
    </el-table>
    <!-- 加载中状态 -->
    <div v-else-if="loading" v-loading="loading" style="min-height: 200px;"></div>
  </div>
</template>

<style scoped>
.staff-page {
  background: #fff;
  border-radius: 4px;
  padding: 16px;
}

.time-cards {
  display: grid;
  grid-template-columns: repeat(1, 1fr);
  gap: 12px;
  padding: 14px 16px;
  background: #fff;
  margin-bottom: 12px;
}

.time-card {
  background: #f5f7fa;
  border-radius: 8px;
  padding: 10px 14px;
  text-align: center;
}

.time-card-label {
  font-size: 11px;
  color: #909399;
  margin-bottom: 4px;
}

.time-card-value {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.time-card-sub {
  font-size: 11px;
  color: #909399;
  margin-top: 2px;
}
</style>