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

const filteredData = computed(() => {
  const rank = activeTab.value === '后厨' ? backRank : frontRank
  const list = allData.value.filter(r => r.business_line === activeTab.value)
  list.sort((a, b) => (rank[a.position] ?? 999) - (rank[b.position] ?? 999))
  return list
})

const summaryRow = computed(() => {
  const data = filteredData.value
  if (data.length === 0) return null
  const sum = { check: 0, leave: 0, absent: 0, save: 0, annual: 0, second: 0, salary_days: 0, salary_pay: 0 }
  for (const r of data) {
    sum.check += r.check
    sum.leave += r.leave
    sum.absent += r.absent
    sum.save += r.save
    sum.annual += r.annual
    sum.second += r.second
    sum.salary_days += r.salary_days
    sum.salary_pay += r.salary_pay
  }
  return sum
})

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
    <!-- 顶部栏 -->
    <div class="top-bar">
      <div class="top-left">
        <div class="month-nav">
          <el-button text size="small" @click="prevMonth"><el-icon><ArrowLeft /></el-icon></el-button>
          <span class="month-label">{{ monthLabel }}</span>
          <el-button text size="small" @click="nextMonth"><el-icon><ArrowRight /></el-icon></el-button>
        </div>
        <el-button text size="small" class="today-btn" @click="thisMonth">本月</el-button>
      </div>
      <div class="seg-group">
        <div class="seg-btn" :class="{ active: activeTab === '后厨' }" @click="activeTab = '后厨'">后厨</div>
        <div class="seg-btn" :class="{ active: activeTab === '前厅' }" @click="activeTab = '前厅'">前厅</div>
      </div>
    </div>

    <!-- 表格 -->
    <div class="table-wrap">
      <el-table :data="filteredData" v-loading="loading" stripe border style="width: 100%;" height="100%">
        <el-table-column prop="name" label="姓名" width="90" fixed />
        <el-table-column prop="position" label="岗位" width="90" />
        <el-table-column prop="check" label="出勤(√)" width="85" align="center">
          <template #default="{ row }">{{ row.check }}</template>
        </el-table-column>
        <el-table-column prop="leave" label="本休(O)" width="85" align="center">
          <template #default="{ row }">{{ row.leave }}</template>
        </el-table-column>
        <el-table-column prop="absent" label="旷工(旷)" width="85" align="center">
          <template #default="{ row }">
            <span :style="{ color: row.absent > 0 ? '#f56c6c' : '' }">{{ row.absent }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="save" label="存休(存)" width="85" align="center">
          <template #default="{ row }">{{ row.save }}</template>
        </el-table-column>
        <el-table-column prop="annual" label="年假(年)" width="85" align="center">
          <template #default="{ row }">{{ row.annual }}</template>
        </el-table-column>
        <el-table-column prop="second" label="借调(借)" width="85" align="center">
          <template #default="{ row }">{{ row.second }}</template>
        </el-table-column>
        <el-table-column prop="salary_days" label="计薪天数" width="90" align="center">
          <template #default="{ row }">
            <span style="font-weight: 600;">{{ row.salary_days }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="monthly_salary" label="月薪" width="90" align="right">
          <template #default="{ row }">¥{{ fmt(row.monthly_salary) }}</template>
        </el-table-column>
        <el-table-column prop="daily_salary" label="日薪" width="80" align="right">
          <template #default="{ row }">¥{{ fmt(row.daily_salary) }}</template>
        </el-table-column>
        <el-table-column prop="salary_pay" label="应发工资" width="100" align="right">
          <template #default="{ row }">
            <span style="font-weight: 600; color: #409eff;">¥{{ fmt(row.salary_pay) }}</span>
          </template>
        </el-table-column>
      </el-table>

      <!-- 汇总行 -->
      <div v-if="summaryRow" class="summary-bar">
        <span class="summary-item">合计：<b>{{ filteredData.length }}</b> 人</span>
        <span class="summary-item">出勤 <b>{{ summaryRow.check }}</b></span>
        <span class="summary-item">本休 <b>{{ summaryRow.leave }}</b></span>
        <span class="summary-item">旷工 <b :style="{ color: summaryRow.absent > 0 ? '#f56c6c' : '' }">{{ summaryRow.absent }}</b></span>
        <span class="summary-item">存休 <b>{{ summaryRow.save }}</b></span>
        <span class="summary-item">年假 <b>{{ summaryRow.annual }}</b></span>
        <span class="summary-item">借调 <b>{{ summaryRow.second }}</b></span>
        <span class="summary-item">计薪 <b>{{ summaryRow.salary_days }}</b></span>
        <span class="summary-item">应发 <b style="color:#409eff;">¥{{ fmt(summaryRow.salary_pay) }}</b></span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.attendance-page {
  height: calc(100vh - 60px - 32px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #fff;
  border-radius: 4px;
}
.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  border-bottom: 1px solid #ebeef5;
  flex-shrink: 0;
}
.top-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.month-nav {
  display: flex;
  align-items: center;
  gap: 2px;
}
.month-label {
  font-size: 15px;
  color: #303133;
  font-weight: 600;
  min-width: 90px;
  text-align: center;
}
.today-btn {
  color: #409eff;
  font-size: 12px;
}
.seg-group {
  display: flex;
  background: #f5f7fa;
  border-radius: 6px;
  padding: 2px;
  gap: 2px;
}
.seg-btn {
  padding: 5px 20px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  color: #606266;
  transition: all 0.2s;
  user-select: none;
}
.seg-btn:hover { color: #303133; }
.seg-btn.active {
  background: #fff;
  color: #409eff;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}
.table-wrap {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.table-wrap :deep(.el-table) {
  flex: 1;
}
.summary-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 16px;
  border-top: 1px solid #ebeef5;
  background: #fafafa;
  flex-shrink: 0;
  font-size: 13px;
  color: #606266;
}
.summary-item b {
  color: #303133;
}
</style>
