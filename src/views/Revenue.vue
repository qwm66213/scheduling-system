<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { getRevenue, saveRevenue, updateRevenue } from '../utils/api'
import { useStore } from '../composables/useStore'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, TitleComponent, LegendComponent } from 'echarts/components'

use([CanvasRenderer, BarChart, GridComponent, TooltipComponent, TitleComponent, LegendComponent])

const { selectedStoreId, getStoreId, isSuperAdmin } = useStore()

const activeTab = ref('actual')
const forecastData = ref([])
const actualData = ref([])
const loading = ref(false)
const currentYear = ref(new Date().getFullYear())
const currentMonth = ref(new Date().getMonth() + 1)

// === 预估模块 ===
const forecastDialogVisible = ref(false)
const editingDate = ref('')

function createEmptyPeriod() {
  return { id: null, hall_tables: 0, hall_avg: 0, banquet_tables: 0, banquet_avg: 0, room_tables: 0, room_avg: 0, delivery_orders: 0, delivery_price: 0 }
}

const formLunch = reactive(createEmptyPeriod())
const formDinner = reactive(createEmptyPeriod())

function calcPeriodRevenue(p) {
  const hall_revenue = (p.hall_tables || 0) * (p.hall_avg || 0)
  const banquet_revenue = (p.banquet_tables || 0) * (p.banquet_avg || 0)
  const room_revenue = (p.room_tables || 0) * (p.room_avg || 0)
  const delivery_revenue = (p.delivery_orders || 0) * (p.delivery_price || 0)
  return { hall_revenue, banquet_revenue, room_revenue, delivery_revenue, total: hall_revenue + banquet_revenue + room_revenue + delivery_revenue }
}

const formLunchRev = computed(() => calcPeriodRevenue(formLunch))
const formDinnerRev = computed(() => calcPeriodRevenue(formDinner))
const formDayTotal = computed(() => formLunchRev.value.total + formDinnerRev.value.total)

// === 共用计算 ===

function buildDataMap(dataList, isActual = false) {
  const map = {}
  if (isActual) {
    // 实际营业额新格式：每日期一条记录，包含 lunch_revenue, dinner_revenue, total_revenue
    for (const row of dataList) {
      map[row.date] = {
        lunch: { total_revenue: row.lunch_revenue || 0 },
        dinner: { total_revenue: row.dinner_revenue || 0 }
      }
    }
  } else {
    // 预估营业额格式：每日期两条记录，用 period 区分
    for (const row of dataList) {
      if (!map[row.date]) map[row.date] = {}
      map[row.date][row.period] = row
    }
  }
  return map
}

const forecastMap = computed(() => buildDataMap(forecastData.value, false))
const actualMap = computed(() => buildDataMap(actualData.value, true))

const weekDays = ['日', '一', '二', '三', '四', '五', '六']

function buildCalendarDays(dataMap) {
  const y = currentYear.value
  const m = currentMonth.value
  const firstDay = new Date(y, m - 1, 1)
  const lastDay = new Date(y, m, 0)
  const daysInMonth = lastDay.getDate()
  const startWeekday = firstDay.getDay()
  const prefixEmpty = startWeekday
  const days = []
  for (let i = 0; i < prefixEmpty; i++) days.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(m).padStart(2, '0')
    const dd = String(d).padStart(2, '0')
    const dateStr = `${y}-${mm}-${dd}`
    const data = dataMap[dateStr]
    const lunchRev = data?.lunch?.total_revenue || 0
    const dinnerRev = data?.dinner?.total_revenue || 0
    days.push({ day: d, date: dateStr, lunch: data?.lunch || null, dinner: data?.dinner || null, total: lunchRev + dinnerRev })
  }
  return days
}

const forecastCalendarDays = computed(() => buildCalendarDays(forecastMap.value))
const actualCalendarDays = computed(() => buildCalendarDays(actualMap.value))

const forecastMonthTotal = computed(() => forecastData.value.reduce((s, r) => s + (r.total_revenue || 0), 0))
const actualMonthTotal = computed(() => actualData.value.reduce((s, r) => s + (r.total_revenue || 0), 0))

function cellBg(total) {
  if (!total) return ''
  return 'background: rgba(230,162,60,0.15)'
}

function formatMoney(v) {
  return (v || 0).toLocaleString()
}

const monthLabel = computed(() => `${currentYear.value}年${currentMonth.value}月`)

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

// 计算可选月份范围（最近半年，不含下个月），降序排列
const availableMonths = computed(() => {
  const now = new Date()
  const currentY = now.getFullYear()
  const currentM = now.getMonth() + 1
  const months = []
  for (let i = 0; i <= 5; i++) {  // 从当前月开始，往前推5个月
    const date = new Date(currentY, currentM - 1 - i, 1)
    months.push({
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      label: `${date.getFullYear()}年${date.getMonth() + 1}月`
    })
  }
  return months
})

function thisMonth() {
  currentYear.value = new Date().getFullYear()
  currentMonth.value = new Date().getMonth() + 1
}

function prevMonth() {
  const minDate = new Date()
  minDate.setMonth(minDate.getMonth() - 5)
  const minY = minDate.getFullYear()
  const minM = minDate.getMonth() + 1

  if (currentYear.value < minY ||
      (currentYear.value === minY && currentMonth.value <= minM)) {
    return // 已到达最早可查看月份
  }

  if (currentMonth.value === 1) {
    currentYear.value--
    currentMonth.value = 12
  } else {
    currentMonth.value--
  }
}

function nextMonth() {
  const now = new Date()
  const maxY = now.getFullYear()
  const maxM = now.getMonth() + 1

  if (currentYear.value > maxY ||
      (currentYear.value === maxY && currentMonth.value >= maxM)) {
    return // 已到达最晚可查看月份（当前月）
  }

  if (currentMonth.value === 12) {
    currentYear.value++
    currentMonth.value = 1
  } else {
    currentMonth.value++
  }
}

function selectMonth({ year, month }) {
  currentYear.value = year
  currentMonth.value = month
}

// 禁用状态计算
const isCurrentMonth = computed(() => {
  const now = new Date()
  return currentYear.value === now.getFullYear() && currentMonth.value === now.getMonth() + 1
})

const isMinMonth = computed(() => {
  const minDate = new Date()
  minDate.setMonth(minDate.getMonth() - 5)
  return currentYear.value === minDate.getFullYear() && currentMonth.value === minDate.getMonth() + 1
})

// === 数据加载 ===

async function loadForecastData() {
  loading.value = true
  try {
    const m = String(currentMonth.value).padStart(2, '0')
    const lastDay = new Date(currentYear.value, currentMonth.value, 0).getDate()
    const end_date = `${currentYear.value}-${m}-${String(lastDay).padStart(2, '0')}`
    const params = { start_date: `${currentYear.value}-${m}-01`, end_date, version: 'forecast' }
    const storeId = getStoreId()
    if (storeId) params.store_id = storeId
    forecastData.value = await getRevenue(params)
  } finally {
    loading.value = false
  }
}

async function loadActualData() {
  try {
    const m = String(currentMonth.value).padStart(2, '0')
    const lastDay = new Date(currentYear.value, currentMonth.value, 0).getDate()
    const end_date = `${currentYear.value}-${m}-${String(lastDay).padStart(2, '0')}`
    const params = { start_date: `${currentYear.value}-${m}-01`, end_date, version: 'actual' }
    const storeId = getStoreId()
    if (storeId) params.store_id = storeId
    actualData.value = await getRevenue(params)
  } catch { actualData.value = [] }
}

// === 月度图表（每日实收vs预估对比）===

const monthChartOption = computed(() => {
  // 获取当月所有日期
  const daysInMonth = new Date(currentYear.value, currentMonth.value, 0).getDate()
  const dates = []
  for (let d = 1; d <= daysInMonth; d++) {
    dates.push(`${currentYear.value}-${String(currentMonth.value).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  }

  // 每日预估和实收汇总
  const forecastTotals = dates.map(date => {
    const lunch = forecastData.value.find(r => r.date === date && r.period === 'lunch')
    const dinner = forecastData.value.find(r => r.date === date && r.period === 'dinner')
    return (lunch?.total_revenue || 0) + (dinner?.total_revenue || 0)
  })

  const actualTotals = dates.map(date => {
    const row = actualData.value.find(r => r.date === date)
    return row?.total_revenue || 0
  })

  // X轴显示日期（只显示日）
  const dayLabels = dates.map(d => d.slice(8))

  return {
    title: { text: `${currentYear.value}年${currentMonth.value}月每日营业额对比`, left: 'center', textStyle: { fontSize: 14, fontWeight: 600 } },
    tooltip: {
      trigger: 'axis',
      formatter: params => {
        const day = params[0].name
        let s = `${currentMonth.value}月${day}日`
        for (const p of params) s += `<br/>${p.seriesName}：¥${p.value.toLocaleString()}`
        return s
      }
    },
    legend: { top: 28 },
    grid: { left: 50, right: 20, top: 56, bottom: 40 },
    xAxis: { type: 'category', data: dayLabels, axisLabel: { fontSize: 10, interval: 0, rotate: 45 } },
    yAxis: { type: 'value', axisLabel: { formatter: v => v >= 10000 ? (v / 10000) + '万' : v } },
    series: [
      {
        name: '实收', type: 'bar', data: actualTotals, barWidth: '30%',
        itemStyle: { borderRadius: [3, 3, 0, 0], color: '#409eff' }
      },
      {
        name: '预估', type: 'bar', data: forecastTotals, barWidth: '30%',
        itemStyle: { borderRadius: [3, 3, 0, 0], color: '#e6a23c' }
      }
    ]
  }
})

// === 预估弹窗 ===

function openForecastDialog(dateStr) {
  editingDate.value = dateStr
  Object.assign(formLunch, createEmptyPeriod())
  Object.assign(formDinner, createEmptyPeriod())
  const data = forecastMap.value[dateStr]
  if (data?.lunch) {
    formLunch.id = data.lunch.id
    formLunch.hall_tables = data.lunch.hall_tables || 0
    formLunch.hall_avg = data.lunch.hall_avg || 0
    formLunch.banquet_tables = data.lunch.banquet_tables || 0
    formLunch.banquet_avg = data.lunch.banquet_avg || 0
    formLunch.room_tables = data.lunch.room_tables || 0
    formLunch.room_avg = data.lunch.room_avg || 0
    formLunch.delivery_orders = data.lunch.delivery_orders || 0
    formLunch.delivery_price = data.lunch.delivery_price || 0
  }
  if (data?.dinner) {
    formDinner.id = data.dinner.id
    formDinner.hall_tables = data.dinner.hall_tables || 0
    formDinner.hall_avg = data.dinner.hall_avg || 0
    formDinner.banquet_tables = data.dinner.banquet_tables || 0
    formDinner.banquet_avg = data.dinner.banquet_avg || 0
    formDinner.room_tables = data.dinner.room_tables || 0
    formDinner.room_avg = data.dinner.room_avg || 0
    formDinner.delivery_orders = data.dinner.delivery_orders || 0
    formDinner.delivery_price = data.dinner.delivery_price || 0
  }
  forecastDialogVisible.value = true
}

async function handleForecastSave() {
  if (!editingDate.value) return
  for (const [period, data] of [['lunch', formLunch], ['dinner', formDinner]]) {
    const revs = calcPeriodRevenue(data)
    const payload = { date: editingDate.value, period, version: 'forecast',
      hall_tables: data.hall_tables, hall_avg: data.hall_avg,
      banquet_tables: data.banquet_tables, banquet_avg: data.banquet_avg,
      room_tables: data.room_tables, room_avg: data.room_avg,
      delivery_orders: data.delivery_orders, delivery_price: data.delivery_price }
    if (data.id) await updateRevenue(data.id, payload)
    else await saveRevenue(payload)
  }
  forecastDialogVisible.value = false
  await loadForecastData()
}

// === 生命周期 ===

watch([currentYear, currentMonth, selectedStoreId], () => {
  loadActualData()
  loadForecastData()
})

onMounted(() => {
  loadActualData()
  loadForecastData()
})
</script>

<template>
  <div class="revenue-page">
    <div class="time-cards">
      <div class="time-card">
        <div class="time-card-label">今天是</div>
        <div class="time-card-value">{{ todayInfo.date }}</div>
        <div class="time-card-sub">{{ todayInfo.weekday }}</div>
      </div>
      <div class="time-card active" @click="thisMonth">
        <div class="time-card-label">本月</div>
        <div class="time-card-value">
          <el-button text class="card-arrow" :disabled="isMinMonth" @click.stop="prevMonth"><el-icon :size="18"><ArrowLeft /></el-icon></el-button>
          <el-dropdown trigger="click" @command="selectMonth" @click.stop>
            <span class="month-dropdown-text">{{ monthInfo.label }}</span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item
                  v-for="m in availableMonths"
                  :key="`${m.year}-${m.month}`"
                  :command="{ year: m.year, month: m.month }"
                >
                  {{ m.label }}
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <el-button text class="card-arrow" :disabled="isCurrentMonth" @click.stop="nextMonth"><el-icon :size="18"><ArrowRight /></el-icon></el-button>
        </div>
        <div class="time-card-sub">共 {{ monthInfo.days }} 天</div>
      </div>
    </div>

    <div class="big-tabs">
      <div class="big-tab" :class="{ active: activeTab === 'actual' }" @click="activeTab = 'actual'">
        实际午晚市
      </div>
      <div class="big-tab" :class="{ active: activeTab === 'forecast' }" @click="activeTab = 'forecast'">
        预估午晚市
      </div>
    </div>

    <!-- 预估月历 -->
    <template v-if="activeTab === 'forecast'">
      <div class="calendar" v-loading="loading">
        <div class="cal-header">
          <div class="cal-weekday" v-for="w in weekDays" :key="w">{{ w }}</div>
        </div>
        <div class="cal-body">
          <div class="cal-cell" v-for="(item, idx) in forecastCalendarDays" :key="idx"
            :class="{ empty: !item }"
            :style="item ? cellBg(item.total) : ''"
            @click="item && openForecastDialog(item.date)">
            <template v-if="item">
              <div class="cell-day" :class="{ today: item.date === new Date().toISOString().slice(0,10) }">{{ item.day }}</div>
              <div class="cell-content">
                <div class="cell-row lunch-color">午 ¥{{ formatMoney(item.lunch?.total_revenue || 0) }}</div>
                <div class="cell-row dinner-color">晚 ¥{{ formatMoney(item.dinner?.total_revenue || 0) }}</div>
                <div class="cell-row total-row">合 ¥{{ formatMoney(item.total) }}</div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </template>

    <!-- 实际月历 -->
    <template v-if="activeTab === 'actual'">
      <div class="calendar" v-loading="loading">
        <div class="cal-header">
          <div class="cal-weekday" v-for="w in weekDays" :key="w">{{ w }}</div>
        </div>
        <div class="cal-body">
          <div class="cal-cell" v-for="(item, idx) in actualCalendarDays" :key="idx"
            :class="{ empty: !item }"
            :style="item ? cellBg(item.total) : ''">
            <template v-if="item">
              <div class="cell-day" :class="{ today: item.date === new Date().toISOString().slice(0,10) }">{{ item.day }}</div>
              <div class="cell-content">
                <div class="cell-row lunch-color">午 ¥{{ formatMoney(item.lunch?.total_revenue || 0) }}</div>
                <div class="cell-row dinner-color">晚 ¥{{ formatMoney(item.dinner?.total_revenue || 0) }}</div>
                <div class="cell-row total-row">合 ¥{{ formatMoney(item.total) }}</div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </template>

    <!-- 月度柱状图 - 两个Tab共享 -->
    <el-card shadow="hover" class="chart-card">
      <v-chart :option="monthChartOption" autoresize style="height: 240px;" />
    </el-card>

    <!-- 预估录入弹窗 -->
    <el-dialog v-model="forecastDialogVisible" :title="editingDate + ' 预估营业额录入'" width="720px" destroy-on-close>
      <div class="dialog-body">
        <div class="period-cards">
          <div class="period-section lunch-section">
            <div class="period-section-title lunch-color">☀ 午市</div>
            <table class="rev-table">
              <thead><tr><th>区域</th><th>数量</th><th>桌均/单价</th><th>营业额</th></tr></thead>
              <tbody>
                <tr>
                  <td><span class="area-tag hall">大厅</span></td>
                  <td><el-input-number v-model="formLunch.hall_tables" :min="0" :controls="false" size="small" /></td>
                  <td><el-input-number v-model="formLunch.hall_avg" :min="0" :step="10" :controls="false" size="small" /></td>
                  <td class="rev-cell">¥{{ formatMoney(formLunchRev.hall_revenue) }}</td>
                </tr>
                <tr>
                  <td><span class="area-tag banquet">宴会厅</span></td>
                  <td><el-input-number v-model="formLunch.banquet_tables" :min="0" :controls="false" size="small" /></td>
                  <td><el-input-number v-model="formLunch.banquet_avg" :min="0" :step="10" :controls="false" size="small" /></td>
                  <td class="rev-cell">¥{{ formatMoney(formLunchRev.banquet_revenue) }}</td>
                </tr>
                <tr>
                  <td><span class="area-tag room">包房</span></td>
                  <td><el-input-number v-model="formLunch.room_tables" :min="0" :controls="false" size="small" /></td>
                  <td><el-input-number v-model="formLunch.room_avg" :min="0" :step="10" :controls="false" size="small" /></td>
                  <td class="rev-cell">¥{{ formatMoney(formLunchRev.room_revenue) }}</td>
                </tr>
                <tr>
                  <td><span class="area-tag delivery">外卖</span></td>
                  <td><el-input-number v-model="formLunch.delivery_orders" :min="0" :controls="false" size="small" /></td>
                  <td><el-input-number v-model="formLunch.delivery_price" :min="0" :step="5" :controls="false" size="small" /></td>
                  <td class="rev-cell">¥{{ formatMoney(formLunchRev.delivery_revenue) }}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr class="subtotal-row"><td colspan="3">午市小计</td><td class="rev-cell total-cell lunch-color">¥{{ formatMoney(formLunchRev.total) }}</td></tr>
              </tfoot>
            </table>
          </div>
          <div class="period-section dinner-section">
            <div class="period-section-title dinner-color">🌙 晚市</div>
            <table class="rev-table">
              <thead><tr><th>区域</th><th>数量</th><th>桌均/单价</th><th>营业额</th></tr></thead>
              <tbody>
                <tr>
                  <td><span class="area-tag hall">大厅</span></td>
                  <td><el-input-number v-model="formDinner.hall_tables" :min="0" :controls="false" size="small" /></td>
                  <td><el-input-number v-model="formDinner.hall_avg" :min="0" :step="10" :controls="false" size="small" /></td>
                  <td class="rev-cell">¥{{ formatMoney(formDinnerRev.hall_revenue) }}</td>
                </tr>
                <tr>
                  <td><span class="area-tag banquet">宴会厅</span></td>
                  <td><el-input-number v-model="formDinner.banquet_tables" :min="0" :controls="false" size="small" /></td>
                  <td><el-input-number v-model="formDinner.banquet_avg" :min="0" :step="10" :controls="false" size="small" /></td>
                  <td class="rev-cell">¥{{ formatMoney(formDinnerRev.banquet_revenue) }}</td>
                </tr>
                <tr>
                  <td><span class="area-tag room">包房</span></td>
                  <td><el-input-number v-model="formDinner.room_tables" :min="0" :controls="false" size="small" /></td>
                  <td><el-input-number v-model="formDinner.room_avg" :min="0" :step="10" :controls="false" size="small" /></td>
                  <td class="rev-cell">¥{{ formatMoney(formDinnerRev.room_revenue) }}</td>
                </tr>
                <tr>
                  <td><span class="area-tag delivery">外卖</span></td>
                  <td><el-input-number v-model="formDinner.delivery_orders" :min="0" :controls="false" size="small" /></td>
                  <td><el-input-number v-model="formDinner.delivery_price" :min="0" :step="5" :controls="false" size="small" /></td>
                  <td class="rev-cell">¥{{ formatMoney(formDinnerRev.delivery_revenue) }}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr class="subtotal-row"><td colspan="3">晚市小计</td><td class="rev-cell total-cell dinner-color">¥{{ formatMoney(formDinnerRev.total) }}</td></tr>
              </tfoot>
            </table>
          </div>
        </div>
        <div class="dialog-day-total">
          <span>日总预估营业额</span>
          <span class="day-total-num">¥{{ formatMoney(formDayTotal) }}</span>
        </div>
      </div>
      <template #footer>
        <el-button @click="forecastDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleForecastSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.revenue-page { width: 100%; }

.time-cards {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  padding: 14px 16px;
  background: #fff;
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
.month-dropdown-text {
  cursor: pointer;
  padding: 0 4px;
}
.month-dropdown-text:hover {
  color: var(--el-color-primary);
}

.big-tabs {
  display: flex;
  border-bottom: 2px solid #e4e7ed;
  flex-shrink: 0;
  background: #fff;
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

.month-total-value { font-size: 18px; font-weight: 700; }

.lunch-color { color: #e6a23c; }
.dinner-color { color: #409eff; }

/* Calendar */
.calendar {
  margin-top: 10px;
  background: #fff;
  border-radius: 6px;
  box-shadow: 0 1px 6px rgba(0,0,0,0.05);
  overflow: hidden;
}

.cal-header {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  background: #f5f7fa;
  border-bottom: 1px solid #ebeef5;
}

.cal-weekday { text-align: center; padding: 8px 0; font-weight: 600; font-size: 13px; color: #606266; }

.cal-body { display: grid; grid-template-columns: repeat(7, 1fr); }

.cal-cell {
  min-height: 72px;
  padding: 6px 4px;
  border-right: 1px solid #f0f0f0;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
  transition: all 0.15s;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.cal-cell:nth-child(7n) { border-right: none; }

.cal-cell:hover { box-shadow: inset 0 0 0 2px #409eff; z-index: 1; }

.cal-cell.empty { background: #fafafa; cursor: default; }
.cal-cell.empty:hover { box-shadow: none; }

.cell-day { font-size: 13px; font-weight: 600; color: #606266; margin-bottom: 4px; text-align: center; }

.cell-day.today {
  display: inline-block;
  background: #409eff;
  color: #fff;
  border-radius: 50%;
  width: 22px; height: 22px; line-height: 22px; text-align: center;
}

.cell-content { font-size: 12px; line-height: 1.6; text-align: center; width: 100%; }
.cell-row { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.total-row { font-weight: 600; color: #303133; border-top: 1px solid #ebeef5; margin-top: 2px; padding-top: 2px; }

/* Chart */
.chart-card { margin-top: 10px; }
.chart-card :deep(.el-card__body) { padding: 10px; }

/* Dialog - forecast */
.dialog-body { padding: 0 4px; }
.period-cards { display: flex; gap: 20px; }
.period-section { flex: 1; min-width: 0; }

.period-section-title {
  font-size: 15px; font-weight: 700; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 2px solid;
}

.lunch-section .period-section-title { border-color: #e6a23c; }
.dinner-section .period-section-title { border-color: #409eff; }

.rev-table { width: 100%; border-collapse: collapse; font-size: 13px; }

.rev-table th { background: #f5f7fa; padding: 8px 4px; text-align: center; font-weight: 600; color: #606266; border-bottom: 1px solid #ebeef5; }
.rev-table th:first-child { text-align: left; }
.rev-table td { padding: 6px 4px; text-align: center; border-bottom: 1px solid #f0f0f0; }
.rev-table td:first-child { text-align: left; }
.rev-table :deep(.el-input-number) { width: 80px; }
.rev-table :deep(.el-input-number .el-input__inner) { text-align: center; }

.area-tag { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 500; }
.area-tag.hall { background: #fdf6ec; color: #e6a23c; }
.area-tag.banquet { background: #ecf5ff; color: #409eff; }
.area-tag.room { background: #f0f9eb; color: #67c23a; }
.area-tag.delivery { background: #fef0f0; color: #f56c6c; }

.rev-cell { font-weight: 600; color: #909399; white-space: nowrap; }
.subtotal-row td { border-bottom: none; font-weight: 700; color: #303133; padding-top: 10px; }
.total-cell { font-size: 14px !important; }

.dialog-day-total {
  display: flex; justify-content: center; align-items: center; gap: 12px;
  margin-top: 16px; padding: 12px;
  background: linear-gradient(135deg, #fff7e6, #fff1d6);
  border-radius: 6px; border: 1px solid #f5d7a0;
  font-weight: 600; color: #606266;
}

.day-total-num { font-size: 20px; font-weight: 700; color: #e6a23c; }

@media (max-width: 700px) {
  .period-cards { flex-direction: column; }
}
</style>
