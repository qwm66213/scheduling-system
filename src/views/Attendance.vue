<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { getAttendanceSummary } from '../utils/api'

const loading = ref(false)
const activeTab = ref('后厨')
const currentYear = ref(new Date().getFullYear())
const currentMonth = ref(new Date().getMonth() + 1)
const allData = ref([])

const backPositions = ['厨师长', '副厨', '第一炉灶', '第二炉灶', '第三炉灶', '第四炉灶', '第五炉灶', '第六炉灶', '冷菜主管', '冷菜', '蒸箱', '点心师傅', '切配主管', '切配', '海鲜师傅', '打荷', '洗碗洗菜', '寒暑假工', '小时工']
const frontPositions = ['店长', '前厅经理', '前厅主管', '收银', '金牌师傅', '迎宾', '服务员', '外卖', '保洁', '小时工']
const backRank = Object.fromEntries(backPositions.map((p, i) => [p, i]))
const frontRank = Object.fromEntries(frontPositions.map((p, i) => [p, i]))

const monthLabel = computed(() => `${currentYear.value}年${currentMonth.value}月`)
const monthParam = computed(() => `${currentYear.value}-${String(currentMonth.value).padStart(2, '0')}`)

const todayInfo = computed(() => {
  const today = new Date()
  const weekNames = ['日', '一', '二', '三', '四', '五', '六']
  return {
    date: today.toISOString().slice(0, 10),
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

const filteredData = computed(() => {
  const rank = activeTab.value === '后厨' ? backRank : frontRank
  const list = allData.value.filter(r => r.business_line === activeTab.value)
  list.sort((a, b) => (rank[a.position] ?? 999) - (rank[b.position] ?? 999))
  return list
})

const backStaffCount = computed(() => allData.value.filter(r => r.business_line === '后厨').length)
const frontStaffCount = computed(() => allData.value.filter(r => r.business_line === '前厅').length)

function prevMonth() {
  if (currentMonth.value === 1) {
    currentMonth.value = 12
    currentYear.value--
  } else {
    currentMonth.value--
  }
}

function nextMonth() {
  if (currentMonth.value === 12) {
    currentMonth.value = 1
    currentYear.value++
  } else {
    currentMonth.value++
  }
}

function thisMonth() {
  currentYear.value = new Date().getFullYear()
  currentMonth.value = new Date().getMonth() + 1
}

function fmt(n) {
  return Number(n).toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

async function loadData() {
  loading.value = true
  try {
    allData.value = await getAttendanceSummary({ month: monthParam.value })
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadData()
})

watch(monthParam, () => {
  loadData()
})
</script>

<template>
  <div class="attendance-page">
    <div class="time-cards">
      <div class="time-card">
        <div class="time-card-label">今天是</div>
        <div class="time-card-value">{{ todayInfo.date }}</div>
        <div class="time-card-sub">{{ todayInfo.weekday }}</div>
      </div>
      <div class="time-card active" @click="thisMonth">
        <div class="time-card-label">本月</div>
        <div class="time-card-value">
          <el-button text size="small" class="card-arrow" @click.stop="prevMonth"><el-icon><ArrowLeft /></el-icon></el-button>
          {{ monthInfo.label }}
          <el-button text size="small" class="card-arrow" @click.stop="nextMonth"><el-icon><ArrowRight /></el-icon></el-button>
        </div>
        <div class="time-card-sub">共 {{ monthInfo.days }} 天</div>
      </div>
    </div>

    <div class="big-tabs">
      <div class="big-tab" :class="{ active: activeTab === '后厨' }" @click="activeTab = '后厨'">
        后厨 <span class="tab-count">{{ backStaffCount }}</span>
      </div>
      <div class="big-tab" :class="{ active: activeTab === '前厅' }" @click="activeTab = '前厅'">
        前厅 <span class="tab-count">{{ frontStaffCount }}</span>
      </div>
    </div>

    <!-- 表格 -->
    <div class="table-wrap">
      <el-table :data="filteredData" v-loading="loading" stripe border style="width: 100%;">
        <el-table-column prop="name" label="姓名" min-width="80" fixed />
        <el-table-column prop="position" label="岗位" min-width="80" />
        <el-table-column prop="check" label="出勤(√)" min-width="75" align="center">
          <template #default="{ row }">{{ row.check }}</template>
        </el-table-column>
        <el-table-column prop="leave" label="本休(O)" min-width="75" align="center">
          <template #default="{ row }">{{ row.leave }}</template>
        </el-table-column>
        <el-table-column prop="absent" label="旷工(旷)" min-width="75" align="center">
          <template #default="{ row }">
            <span :style="{ color: row.absent > 0 ? '#f56c6c' : '' }">{{ row.absent }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="save" label="存休(存)" min-width="75" align="center">
          <template #default="{ row }">{{ row.save }}</template>
        </el-table-column>
        <el-table-column prop="annual" label="年假(年)" min-width="75" align="center">
          <template #default="{ row }">{{ row.annual }}</template>
        </el-table-column>
        <el-table-column prop="second" label="借调(借)" min-width="75" align="center">
          <template #default="{ row }">{{ row.second }}</template>
        </el-table-column>
        <el-table-column prop="salary_days" label="计薪天数" min-width="80" align="center">
          <template #default="{ row }">
            <span style="font-weight: 600;">{{ row.salary_days }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="monthly_salary" label="月薪" min-width="80" align="right">
          <template #default="{ row }">¥{{ fmt(row.monthly_salary) }}</template>
        </el-table-column>
        <el-table-column prop="daily_salary" label="日薪" min-width="70" align="right">
          <template #default="{ row }">¥{{ fmt(row.daily_salary) }}</template>
        </el-table-column>
        <el-table-column prop="salary_pay" label="应发工资" min-width="90" align="right">
          <template #default="{ row }">
            <span style="font-weight: 600; color: #409eff;">¥{{ fmt(row.salary_pay) }}</span>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<style scoped>
.attendance-page {
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 4px;
}
.time-cards {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
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
  padding: 2px;
  color: #409eff !important;
}
.big-tabs {
  display: flex;
  border-bottom: 2px solid #e4e7ed;
  flex-shrink: 0;
}
.big-tab {
  flex: 1;
  text-align: center;
  padding: 12px 0;
  font-size: 15px;
  font-weight: 500;
  color: #909399;
  background: #fafafa;
  cursor: pointer;
  border-bottom: 3px solid transparent;
  transition: all 0.2s;
  user-select: none;
}
.big-tab:hover { color: #606266; }
.big-tab.active {
  color: #409eff;
  background: #fff;
  border-bottom-color: #409eff;
  font-weight: 600;
}
.tab-count {
  font-size: 12px;
  color: #c0c4cc;
  margin-left: 2px;
}
.big-tab.active .tab-count {
  color: #a0cfff;
}
.table-wrap {
  display: flex;
  flex-direction: column;
}
.table-wrap :deep(.el-table) {
  flex: 1;
}
</style>
