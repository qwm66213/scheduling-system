<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { getPersonalSummary } from '../utils/api'
import { useStore } from '../composables/useStore'

const { selectedStoreId, getStoreId } = useStore()

const loading = ref(false)
const currentYear = ref(new Date().getFullYear())
const currentMonth = ref(new Date().getMonth() + 1)
const selectedDate = ref('')
const allData = ref([])

const backPositions = ['厨师长', '副厨', '第一炉灶', '第二炉灶', '第三炉灶', '第四炉灶', '第五炉灶', '第六炉灶', '冷菜主管', '冷菜', '蒸箱', '点心师傅', '切配主管', '切配', '海鲜师傅', '打荷', '洗碗洗菜', '寒暑假工', '小时工']
const frontPositions = ['店长', '前厅经理', '前厅主管', '收银', '金牌师傅', '迎宾', '服务员', '外卖', '保洁', '小时工']
const backRank = Object.fromEntries(backPositions.map((p, i) => [p, i]))
const frontRank = Object.fromEntries(frontPositions.map((p, i) => [p, i]))

const todayInfo = computed(() => {
  const today = new Date()
  const weekNames = ['日', '一', '二', '三', '四', '五', '六']
  const y = today.getFullYear()
  const m = String(today.getMonth() + 1).padStart(2, '0')
  const d = String(today.getDate()).padStart(2, '0')
  return {
    date: `${y}-${m}-${d}`,
    weekday: '星期' + weekNames[today.getDay()]
  }
})

const monthInfo = computed(() => {
  const daysInMonth = new Date(currentYear.value, currentMonth.value, 0).getDate()
  return {
    label: `${currentYear.value}年${String(currentMonth.value).padStart(2, '0')}月`,
    days: daysInMonth
  }
})

const isCurrentMonth = computed(() => {
  const now = new Date()
  return currentYear.value === now.getFullYear() && currentMonth.value === now.getMonth() + 1
})

function prevMonth() {
  if (currentMonth.value === 1) { currentMonth.value = 12; currentYear.value-- }
  else currentMonth.value--
}

function nextMonth() {
  if (isCurrentMonth.value) return
  if (currentMonth.value === 12) { currentMonth.value = 1; currentYear.value++ }
  else currentMonth.value++
}

function thisMonth() {
  currentYear.value = new Date().getFullYear()
  currentMonth.value = new Date().getMonth() + 1
}

const dateOptions = computed(() => {
  return [...new Set(allData.value.map(r => r.date))].sort().reverse()
})

const dayData = computed(() => {
  if (!selectedDate.value) return []
  return allData.value.filter(r => r.date === selectedDate.value)
})

const frontData = computed(() => {
  const rank = frontRank
  const list = dayData.value.filter(r => r.business_line === '前厅')
  list.sort((a, b) => (rank[a.position] ?? 999) - (rank[b.position] ?? 999))
  return list
})

const backData = computed(() => {
  const rank = backRank
  const list = dayData.value.filter(r => r.business_line !== '前厅')
  list.sort((a, b) => (rank[a.position] ?? 999) - (rank[b.position] ?? 999))
  return list
})

function fmt(n) {
  return (n || 0).toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

async function loadData() {
  loading.value = true
  try {
    const m = String(currentMonth.value).padStart(2, '0')
    const params = {
      start_date: `${currentYear.value}-${m}-01`,
      end_date: `${currentYear.value}-${m}-31`
    }
    const storeId = getStoreId()
    if (storeId) params.store_id = storeId
    allData.value = await getPersonalSummary(params)
    const dates = dateOptions.value
    if (dates.length > 0) {
      selectedDate.value = dates[0]
    } else {
      selectedDate.value = ''
    }
  } finally {
    loading.value = false
  }
}

onMounted(() => { loadData() })

watch([currentYear, currentMonth, selectedStoreId], () => { loadData() })
</script>

<template>
  <div class="personal-page">
    <div class="time-cards">
      <div class="time-card">
        <div class="time-card-label">今天是</div>
        <div class="time-card-value">{{ todayInfo.date }}</div>
        <div class="time-card-sub">{{ todayInfo.weekday }}</div>
      </div>
      <div class="time-card active">
        <div class="time-card-label">选择日期</div>
        <div class="time-card-value">
          <el-select v-model="selectedDate" placeholder="选择日期" size="small" style="width: 140px;">
            <el-option v-for="d in dateOptions" :key="d" :label="d" :value="d" />
          </el-select>
        </div>
      </div>
      <div class="time-card active" @click="thisMonth">
        <div class="time-card-label">本月</div>
        <div class="time-card-value">
          <el-button text class="card-arrow" @click.stop="prevMonth"><el-icon :size="18"><ArrowLeft /></el-icon></el-button>
          {{ monthInfo.label }}
          <el-button text class="card-arrow" :disabled="isCurrentMonth" @click.stop="nextMonth"><el-icon :size="18"><ArrowRight /></el-icon></el-button>
        </div>
        <div class="time-card-sub">共 {{ monthInfo.days }} 天</div>
      </div>
    </div>

    <div class="dual-table" v-loading="loading">
      <div class="table-half">
        <div class="half-title">前厅（{{ frontData.length }}人）</div>
        <el-table :data="frontData" border empty-text="暂无数据" style="width: 100%;" :show-header="true">
          <el-table-column prop="employee_name" label="员工姓名" min-width="80" />
          <el-table-column prop="position" label="岗位" min-width="70" align="center" />
          <el-table-column label="出勤人天" min-width="70" align="center">
            <template #default="{ row }">{{ row.front_check_count || 0 }}</template>
          </el-table-column>
          <el-table-column label="奖金" min-width="80" align="right">
            <template #default="{ row }">
              <span :style="{ color: row.bonus > 0 ? '#67c23a' : row.bonus < 0 ? '#f56c6c' : '#303133' }">{{ fmt(row.bonus) }}</span>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <div class="table-half">
        <div class="half-title">后厨（{{ backData.length }}人）</div>
        <el-table :data="backData" border empty-text="暂无数据" style="width: 100%;" :show-header="true">
          <el-table-column prop="employee_name" label="员工姓名" min-width="80" />
          <el-table-column prop="position" label="岗位" min-width="70" align="center" />
          <el-table-column label="出勤人天" min-width="70" align="center">
            <template #default="{ row }">{{ row.back_check_count || 0 }}</template>
          </el-table-column>
          <el-table-column label="奖金" min-width="80" align="right">
            <template #default="{ row }">
              <span :style="{ color: row.bonus > 0 ? '#67c23a' : row.bonus < 0 ? '#f56c6c' : '#303133' }">{{ fmt(row.bonus) }}</span>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.personal-page {
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 4px;
}
.time-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  padding: 14px 16px;
  flex-shrink: 0;
}
.time-card {
  background: #f5f7fa;
  border-radius: 8px;
  padding: 10px 14px;
  text-align: center;
  transition: all 0.2s;
}
.time-card.active {
  background: #ecf5ff;
  border: 1px solid #b3d8ff;
  cursor: pointer;
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
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-height: 24px;
}
.time-card-sub {
  font-size: 11px;
  color: #909399;
  margin-top: 2px;
}
.time-card.active .time-card-label { color: #409eff; }
.time-card.active .time-card-value { color: #409eff; }
.card-arrow {
  padding: 4px 8px;
  color: #409eff !important;
}
.dual-table {
  display: flex;
  gap: 16px;
  padding: 0 16px 16px;
  flex: 1;
}
.table-half {
  flex: 1;
  min-width: 0;
}
.half-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  padding: 10px 0;
  text-align: center;
  border-bottom: 2px solid #409eff;
  margin-bottom: 0;
}
</style>
