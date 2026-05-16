<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { getDashboardSummary } from '../utils/api'

const STORES = ['金', '凉', '国', '长', '阳', '殷', '宜', '中', '灵', '柳']

const user = computed(() => JSON.parse(localStorage.getItem('user') || '{}'))
const isSuperAdmin = computed(() => user.value.role === 'admin')
const selectedStore = ref(isSuperAdmin.value ? '' : user.value.store_id)

const loading = ref(true)
const currentMonth = ref('')
const data = ref(null)
const activeTab = ref('front')

function initMonth() {
  const now = new Date()
  currentMonth.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function prevMonth() {
  const [y, m] = currentMonth.value.split('-').map(Number)
  const d = new Date(y, m - 2, 1)
  currentMonth.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function nextMonth() {
  const [y, m] = currentMonth.value.split('-').map(Number)
  const d = new Date(y, m, 1)
  currentMonth.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const monthLabel = computed(() => {
  if (!currentMonth.value) return ''
  const [y, m] = currentMonth.value.split('-')
  return `${y}年${parseInt(m)}月`
})

const todayInfo = computed(() => {
  const today = new Date()
  const weekNames = ['日', '一', '二', '三', '四', '五', '六']
  return {
    date: today.toISOString().slice(0, 10),
    weekday: '星期' + weekNames[today.getDay()]
  }
})

const monthInfo = computed(() => {
  if (!currentMonth.value) return { label: '', days: 0 }
  const [y, m] = currentMonth.value.split('-').map(Number)
  const daysInMonth = new Date(y, m, 0).getDate()
  return {
    label: `${y}年${String(m).padStart(2, '0')}月`,
    days: daysInMonth
  }
})

const yearInfo = computed(() => {
  const y = new Date().getFullYear()
  const isLeap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
  return { year: y, days: isLeap ? 366 : 365 }
})

function thisMonth() {
  const now = new Date()
  currentMonth.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

async function loadData() {
  loading.value = true
  try {
    const params = { month: currentMonth.value }
    if (selectedStore.value) params.store_id = selectedStore.value
    data.value = await getDashboardSummary(params)
  } finally {
    loading.value = false
  }
}

function fmt(n) {
  return n != null ? n.toLocaleString() : '0'
}

function achieveClass(actual) {
  if (actual >= 100) return 'achieve-pass'
  if (actual >= 80) return 'achieve-warn'
  return 'achieve-fail'
}

onMounted(() => {
  initMonth()
  loadData()
})

watch([currentMonth, selectedStore], loadData)
</script>

<template>
  <div v-loading="loading" class="dashboard-page">
    <div class="filter-row" v-if="isSuperAdmin">
      <el-select v-model="selectedStore" placeholder="选择门店" clearable style="width: 120px;">
        <el-option v-for="(store, index) in STORES" :key="index" :label="store" :value="index + 1" />
      </el-select>
    </div>
    <div class="time-cards">
      <div class="time-card">
        <div class="time-card-label">今天是</div>
        <div class="time-card-value">{{ todayInfo.date }}</div>
        <div class="time-card-sub">{{ todayInfo.weekday }}</div>
      </div>
      <div class="time-card active" @click="thisMonth">
        <div class="time-card-label">本月</div>
        <div class="time-card-value">
          <el-button text class="card-arrow" @click.stop="prevMonth"><el-icon :size="18"><ArrowLeft /></el-icon></el-button>
          {{ monthInfo.label }}
          <el-button text class="card-arrow" @click.stop="nextMonth"><el-icon :size="18"><ArrowRight /></el-icon></el-button>
        </div>
        <div class="time-card-sub">共 {{ monthInfo.days }} 天</div>
      </div>
      <div class="time-card">
        <div class="time-card-label">本年</div>
        <div class="time-card-value">{{ yearInfo.year }}年</div>
        <div class="time-card-sub">共 {{ yearInfo.days }} 天</div>
      </div>
    </div>

    <template v-if="data">
      <div class="achieve-row">
        <div class="achieve-card">
          <div class="achieve-title">营业额达成率</div>
          <div class="achieve-body">
            <div class="achieve-item">
              <span class="achieve-label">标准</span>
              <span class="achieve-num">100%</span>
            </div>
            <div class="achieve-divider"></div>
            <div class="achieve-item">
              <span class="achieve-label">实际</span>
              <span class="achieve-num" :class="achieveClass(data.revenueAchieve)">{{ data.revenueAchieve }}%</span>
            </div>
            <div class="achieve-bar-wrap">
              <div class="achieve-bar" :style="{ width: Math.min(data.revenueAchieve, 150) / 1.5 + '%' }" :class="achieveClass(data.revenueAchieve)"></div>
            </div>
          </div>
          <div class="daily-section">
            <div class="daily-grid">
              <div class="daily-row">
                <div class="daily-label-cell">日期</div>
                <div v-for="d in data.total.dailyStaff" :key="'rad-'+d.date" class="daily-cell daily-date">{{ d.date.slice(8) }}</div>
              </div>
              <div class="daily-row">
                <div class="daily-label-cell">达成率</div>
                <div v-for="d in data.total.dailyStaff" :key="'rav-'+d.date" class="daily-cell daily-val" :class="achieveClass(d.revenueAchieve)">{{ d.revenueAchieve ? d.revenueAchieve+'%' : '-' }}</div>
              </div>
            </div>
          </div>
        </div>
        <div class="achieve-card">
          <div class="achieve-title">人效达成率</div>
          <div class="achieve-body">
            <div class="achieve-item">
              <span class="achieve-label">标准</span>
              <span class="achieve-num">100%</span>
            </div>
            <div class="achieve-divider"></div>
            <div class="achieve-item">
              <span class="achieve-label">实际</span>
              <span class="achieve-num" :class="achieveClass(data.effAchieve)">{{ data.effAchieve }}%</span>
            </div>
            <div class="achieve-bar-wrap">
              <div class="achieve-bar" :style="{ width: Math.min(data.effAchieve, 150) / 1.5 + '%' }" :class="achieveClass(data.effAchieve)"></div>
            </div>
          </div>
          <div class="daily-section">
            <div class="daily-grid">
              <div class="daily-row">
                <div class="daily-label-cell">日期</div>
                <div v-for="d in data.total.dailyStaff" :key="'ead-'+d.date" class="daily-cell daily-date">{{ d.date.slice(8) }}</div>
              </div>
              <div class="daily-row">
                <div class="daily-label-cell">达成率</div>
                <div v-for="d in data.total.dailyStaff" :key="'eav-'+d.date" class="daily-cell daily-val" :class="achieveClass(d.effAchieve)">{{ d.effAchieve ? d.effAchieve+'%' : '-' }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="seg-group">
        <div class="seg-btn" :class="{ active: activeTab === 'front' }" @click="activeTab = 'front'">前厅</div>
        <div class="seg-btn" :class="{ active: activeTab === 'back' }" @click="activeTab = 'back'">后厨</div>
        <div class="seg-btn" :class="{ active: activeTab === 'total' }" @click="activeTab = 'total'">总数</div>
      </div>

      <!-- 前厅 -->
      <div v-if="activeTab === 'front'" class="module-card">
        <div class="module-title">前厅经营数据</div>
        <div class="pair-row">
          <div class="pair-cell pair-left">
            <div class="pair-label">前厅人数标准</div>
            <div class="pair-value">{{ data.front.staffStd }}</div>
          </div>
          <div class="pair-cell pair-right">
            <div class="pair-label">前厅人数（月均）</div>
            <div class="pair-value">{{ data.front.staff }}</div>
          </div>
        </div>
        <div class="pair-row">
          <div class="pair-cell pair-left">
            <div class="pair-label">前厅净工资标准</div>
            <div class="pair-value">¥{{ fmt(data.front.salaryStd) }}</div>
          </div>
          <div class="pair-cell pair-right">
            <div class="pair-label">前厅净工资</div>
            <div class="pair-value">¥{{ fmt(data.front.salary) }}</div>
          </div>
        </div>
        <div class="pair-row">
          <div class="pair-cell pair-left">
            <div class="pair-label">前厅标准占比</div>
            <div class="pair-value">{{ data.front.ratioStd }}%</div>
          </div>
          <div class="pair-cell pair-right">
            <div class="pair-label">前厅净工资占比</div>
            <div class="pair-value">{{ data.front.ratio }}%</div>
          </div>
        </div>
        <div class="pair-row">
          <div class="pair-cell pair-left">
            <div class="pair-label">前厅标准人效</div>
            <div class="pair-value">{{ fmt(data.front.standard.efficiency) }}</div>
          </div>
          <div class="pair-cell pair-right">
            <div class="pair-label">前厅人效</div>
            <div class="pair-value">{{ fmt(data.front.efficiency) }}</div>
          </div>
        </div>

        <!-- 每日前厅数据明细 -->
        <div class="daily-section">
          <div class="daily-title">每日前厅数据明细</div>
          <div class="daily-grid">
            <div class="daily-row">
              <div class="daily-label-cell">日期</div>
              <div v-for="d in data.front.dailyStaff" :key="d.date" class="daily-cell daily-date">{{ d.date.slice(8) }}</div>
            </div>
            <div class="daily-row">
              <div class="daily-label-cell">前厅人数</div>
              <div v-for="d in data.front.dailyStaff" :key="'staff-'+d.date" class="daily-cell daily-val">{{ d.staff || '-' }}</div>
            </div>
            <div class="daily-row">
              <div class="daily-label-cell">前厅净工资</div>
              <div v-for="d in data.front.dailyStaff" :key="'sal-'+d.date" class="daily-cell daily-val">{{ d.salary ? '¥'+d.salary : '-' }}</div>
            </div>
            <div class="daily-row">
              <div class="daily-label-cell">净工资占比</div>
              <div v-for="d in data.front.dailyStaff" :key="'rat-'+d.date" class="daily-cell daily-val">{{ d.ratio ? d.ratio+'%' : '-' }}</div>
            </div>
            <div class="daily-row">
              <div class="daily-label-cell">前厅人效</div>
              <div v-for="d in data.front.dailyStaff" :key="'eff-'+d.date" class="daily-cell daily-val">{{ d.efficiency || '-' }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 后厨 -->
      <div v-if="activeTab === 'back'" class="module-card">
        <div class="module-title">后厨经营数据</div>
        <div class="pair-row">
          <div class="pair-cell pair-left">
            <div class="pair-label">后厨人数标准</div>
            <div class="pair-value">{{ data.back.staffStd }}</div>
          </div>
          <div class="pair-cell pair-right">
            <div class="pair-label">后厨人数（月均）</div>
            <div class="pair-value">{{ data.back.staff }}</div>
          </div>
        </div>
        <div class="pair-row">
          <div class="pair-cell pair-left">
            <div class="pair-label">后厨净工资标准</div>
            <div class="pair-value">¥{{ fmt(data.back.salaryStd) }}</div>
          </div>
          <div class="pair-cell pair-right">
            <div class="pair-label">后厨净工资</div>
            <div class="pair-value">¥{{ fmt(data.back.salary) }}</div>
          </div>
        </div>
        <div class="pair-row">
          <div class="pair-cell pair-left">
            <div class="pair-label">后厨标准占比</div>
            <div class="pair-value">{{ data.back.ratioStd }}%</div>
          </div>
          <div class="pair-cell pair-right">
            <div class="pair-label">后厨净工资占比</div>
            <div class="pair-value">{{ data.back.ratio }}%</div>
          </div>
        </div>
        <div class="pair-row">
          <div class="pair-cell pair-left">
            <div class="pair-label">后厨标准人效</div>
            <div class="pair-value">{{ fmt(data.back.standard.efficiency) }}</div>
          </div>
          <div class="pair-cell pair-right">
            <div class="pair-label">后厨人效</div>
            <div class="pair-value">{{ fmt(data.back.efficiency) }}</div>
          </div>
        </div>

        <!-- 每日后厨数据明细 -->
        <div class="daily-section">
          <div class="daily-title">每日后厨数据明细</div>
          <div class="daily-grid">
            <div class="daily-row">
              <div class="daily-label-cell">日期</div>
              <div v-for="d in data.back.dailyStaff" :key="d.date" class="daily-cell daily-date">{{ d.date.slice(8) }}</div>
            </div>
            <div class="daily-row">
              <div class="daily-label-cell">后厨人数</div>
              <div v-for="d in data.back.dailyStaff" :key="'bstaff-'+d.date" class="daily-cell daily-val">{{ d.staff || '-' }}</div>
            </div>
            <div class="daily-row">
              <div class="daily-label-cell">后厨净工资</div>
              <div v-for="d in data.back.dailyStaff" :key="'bsal-'+d.date" class="daily-cell daily-val">{{ d.salary ? '¥'+d.salary : '-' }}</div>
            </div>
            <div class="daily-row">
              <div class="daily-label-cell">净工资占比</div>
              <div v-for="d in data.back.dailyStaff" :key="'brat-'+d.date" class="daily-cell daily-val">{{ d.ratio ? d.ratio+'%' : '-' }}</div>
            </div>
            <div class="daily-row">
              <div class="daily-label-cell">后厨人效</div>
              <div v-for="d in data.back.dailyStaff" :key="'beff-'+d.date" class="daily-cell daily-val">{{ d.efficiency || '-' }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 总数 -->
      <div v-if="activeTab === 'total'" class="module-card">
        <div class="module-title">总体经营数据</div>
        <div class="pair-row">
          <div class="pair-cell pair-left">
            <div class="pair-label">总人数标准</div>
            <div class="pair-value">{{ data.total.staffStd }}</div>
          </div>
          <div class="pair-cell pair-right">
            <div class="pair-label">总人数</div>
            <div class="pair-value">{{ data.total.staff }}</div>
          </div>
        </div>
        <div class="pair-row">
          <div class="pair-cell pair-left">
            <div class="pair-label">总净工资标准</div>
            <div class="pair-value">¥{{ fmt(data.total.salaryStd) }}</div>
          </div>
          <div class="pair-cell pair-right">
            <div class="pair-label">总净工资</div>
            <div class="pair-value">¥{{ fmt(data.total.salary) }}</div>
          </div>
        </div>
        <div class="pair-row">
          <div class="pair-cell pair-left">
            <div class="pair-label">总标准占比</div>
            <div class="pair-value">{{ data.total.ratioStd }}%</div>
          </div>
          <div class="pair-cell pair-right">
            <div class="pair-label">总占比</div>
            <div class="pair-value">{{ data.total.ratio }}%</div>
          </div>
        </div>
        <div class="pair-row">
          <div class="pair-cell pair-left">
            <div class="pair-label">总标准人效</div>
            <div class="pair-value">{{ fmt(data.total.standard.efficiency) }}</div>
          </div>
          <div class="pair-cell pair-right">
            <div class="pair-label">总人效</div>
            <div class="pair-value">{{ fmt(data.total.efficiency) }}</div>
          </div>
        </div>
        <!-- 每日总数数据明细 -->
        <div class="daily-section">
          <div class="daily-title">每日总数数据明细</div>
          <div class="daily-grid">
            <div class="daily-row">
              <div class="daily-label-cell">日期</div>
              <div v-for="d in data.total.dailyStaff" :key="d.date" class="daily-cell daily-date">{{ d.date.slice(8) }}</div>
            </div>
            <div class="daily-row">
              <div class="daily-label-cell">总人数</div>
              <div v-for="d in data.total.dailyStaff" :key="'tstaff-'+d.date" class="daily-cell daily-val">{{ d.staff || '-' }}</div>
            </div>
            <div class="daily-row">
              <div class="daily-label-cell">总净工资</div>
              <div v-for="d in data.total.dailyStaff" :key="'tsal-'+d.date" class="daily-cell daily-val">{{ d.salary ? '¥'+d.salary : '-' }}</div>
            </div>
            <div class="daily-row">
              <div class="daily-label-cell">净工资占比</div>
              <div v-for="d in data.total.dailyStaff" :key="'trat-'+d.date" class="daily-cell daily-val">{{ d.ratio ? d.ratio+'%' : '-' }}</div>
            </div>
            <div class="daily-row">
              <div class="daily-label-cell">总人效</div>
              <div v-for="d in data.total.dailyStaff" :key="'teff-'+d.date" class="daily-cell daily-val">{{ d.efficiency || '-' }}</div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.dashboard-page {
  padding: 0;
}
.filter-row {
  margin-bottom: 12px;
}
.time-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 16px;
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
.time-card.active .time-card-label {
  color: #409eff;
}
.time-card.active .time-card-value {
  color: #409eff;
}
.card-arrow {
  padding: 4px 8px;
  color: #409eff !important;
}
.achieve-row {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}
.achieve-card {
  flex: 1;
  background: #fff;
  border-radius: 8px;
  border: 1px solid #ebeef5;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
  overflow: hidden;
}
.achieve-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  padding: 12px 20px;
  border-bottom: 1px solid #ebeef5;
}
.achieve-body {
  padding: 16px 20px;
  display: flex;
  align-items: center;
  gap: 16px;
}
.achieve-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 72px;
}
.achieve-label {
  font-size: 12px;
  color: #909399;
  margin-bottom: 4px;
}
.achieve-num {
  font-size: 22px;
  font-weight: 700;
  color: #303133;
}
.achieve-num.achieve-pass { color: #67c23a; }
.achieve-num.achieve-warn { color: #e6a23c; }
.achieve-num.achieve-fail { color: #f56c6c; }
.achieve-divider {
  width: 1px;
  height: 36px;
  background: #ebeef5;
}
.achieve-bar-wrap {
  flex: 1;
  height: 8px;
  background: #f5f7fa;
  border-radius: 4px;
  overflow: hidden;
}
.achieve-bar {
  height: 100%;
  border-radius: 4px;
  transition: width 0.4s ease;
}
.achieve-bar.achieve-pass { background: #67c23a; }
.achieve-bar.achieve-warn { background: #e6a23c; }
.achieve-bar.achieve-fail { background: #f56c6c; }
.seg-group {
  display: flex;
  background: #f5f7fa;
  border-radius: 6px;
  padding: 2px;
  gap: 2px;
  margin-bottom: 16px;
  width: fit-content;
}
.seg-btn {
  padding: 5px 24px;
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
.module-card {
  background: #fff;
  border-radius: 8px;
  border: 1px solid #ebeef5;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
}
.module-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  padding: 14px 20px;
  border-bottom: 1px solid #ebeef5;
}
.pair-row {
  display: flex;
  border-bottom: 1px solid #f2f3f5;
}
.pair-row:last-child {
  border-bottom: none;
}
.pair-cell {
  flex: 1;
  padding: 14px 20px;
}
.pair-left {
  border-right: 1px solid #f2f3f5;
  background: #fafbfc;
}
.pair-label {
  font-size: 13px;
  color: #909399;
  margin-bottom: 6px;
}
.pair-value {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}
.daily-section {
  padding: 16px 20px;
  border-top: 1px solid #ebeef5;
}
.daily-title {
  font-size: 13px;
  font-weight: 600;
  color: #606266;
  margin-bottom: 10px;
}
.daily-grid {
  overflow-x: auto;
}
.daily-row {
  display: flex;
  min-width: max-content;
}
.daily-label-cell {
  width: 80px;
  min-width: 80px;
  padding: 8px 6px;
  font-size: 12px;
  color: #909399;
  text-align: center;
  border: 1px solid #f2f3f5;
  background: #fafbfc;
  flex-shrink: 0;
  position: sticky;
  left: 0;
  z-index: 1;
}
.daily-cell {
  flex: 1;
  min-width: 48px;
  padding: 8px 4px;
  font-size: 12px;
  text-align: center;
  border: 1px solid #f2f3f5;
  color: #303133;
  flex-shrink: 0;
  white-space: nowrap;
}
.daily-date {
  color: #909399;
  font-size: 11px;
}
.daily-val {
  font-weight: 600;
}
</style>
