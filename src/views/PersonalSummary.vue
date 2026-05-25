<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { getPersonalSummary } from '../utils/api'
import { useStore } from '../composables/useStore'

const { selectedStoreId, getStoreId } = useStore()

const loading = ref(false)
const currentYear = ref(new Date().getFullYear())
const currentMonth = ref(new Date().getMonth() + 1)
const selectedDate = ref('')
const dayData = ref([]) // 改为存储当天数据

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

// 获取昨天的日期字符串 (T-1)
function getYesterday() {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  return yesterday.toISOString().slice(0, 10)
}

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
  // 生成当月所有日期，但只显示今天及之前的日期
  const days = monthInfo.value.days
  const m = String(currentMonth.value).padStart(2, '0')
  const dates = []
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)

  for (let d = 1; d <= days; d++) {
    const dateStr = `${currentYear.value}-${m}-${String(d).padStart(2, '0')}`
    // 只显示今天及之前的日期
    if (dateStr <= todayStr) {
      dates.push(dateStr)
    }
  }
  return dates.reverse() // 最新的日期在前
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

// 按需加载单天数据
async function loadDayData(date) {
  if (!date) {
    dayData.value = []
    return
  }

  loading.value = true
  try {
    const params = {
      start_date: date,
      end_date: date
    }
    const storeId = getStoreId()
    if (storeId) params.store_id = storeId
    dayData.value = await getPersonalSummary(params)
  } finally {
    loading.value = false
  }
}

// 初始化：默认加载昨天(T-1)的数据
function initDate() {
  const yesterday = getYesterday()
  selectedDate.value = yesterday
  // 更新年月为昨天所在月份
  const d = new Date(yesterday)
  currentYear.value = d.getFullYear()
  currentMonth.value = d.getMonth() + 1
}

onMounted(() => {
  initDate()
  loadDayData(selectedDate.value)
})

// 监听日期变化，按需加载
watch(selectedDate, (newDate) => {
  if (newDate) {
    loadDayData(newDate)
  }
})

// 监听门店变化，重新加载
watch(selectedStoreId, () => {
  if (selectedDate.value) {
    loadDayData(selectedDate.value)
  }
})
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
          <el-select v-model="selectedDate" placeholder="选择日期" size="small" style="width: 140px;" :disabled="!getStoreId()">
            <el-option v-for="d in dateOptions" :key="d" :label="d" :value="d" />
            <template #empty>
              <div style="padding: 10px; text-align: center; color: #909399;">
                {{ loading ? '加载中...' : '暂无数据' }}
              </div>
            </template>
          </el-select>
        </div>
        <div class="time-card-sub" v-if="!getStoreId()" style="color: #f56c6c;">请先选择门店</div>
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
              <span v-if="row.bonus === null">-</span>
              <span v-else :style="{ color: row.bonus > 0 ? '#67c23a' : row.bonus < 0 ? '#f56c6c' : '#303133' }">{{ fmt(row.bonus) }}</span>
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
              <span v-if="row.bonus === null">-</span>
              <span v-else :style="{ color: row.bonus > 0 ? '#67c23a' : row.bonus < 0 ? '#f56c6c' : '#303133' }">{{ fmt(row.bonus) }}</span>
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
