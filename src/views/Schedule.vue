<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { getAttendance, batchSaveAttendance, getStaff } from '../utils/api'
import { useStore } from '../composables/useStore'

const { selectedStoreId, getStoreId } = useStore()

const loading = ref(false)
const activeTab = ref('后厨')
const weekOffset = ref(0)
const staffList = ref([])
const attendanceMap = ref({})

const dropdownVisible = ref(false)
const dropdownX = ref(0)
const dropdownY = ref(0)
const dropdownTarget = ref(null)

const weekDays = ['一', '二', '三', '四', '五', '六', '日']

const STATUS_OPTIONS = [
  { value: 'check', label: '√', desc: '出勤' },
  { value: 'leave', label: 'O', desc: '请假/休息' },
  { value: 'absent', label: '旷', desc: '旷工' },
  { value: 'save', label: '存', desc: '存休' },
  { value: 'annual', label: '年', desc: '休年假' }
]
const STORES = ['金', '凉', '国', '长', '阳', '殷', '宜', '中', '灵', '柳']

const backPositions = ['厨师长', '副厨', '第一炉灶', '第二炉灶', '第三炉灶', '第四炉灶', '第五炉灶', '第六炉灶', '冷菜主管', '冷菜', '蒸箱', '点心师傅', '切配主管', '切配', '海鲜师傅', '打荷', '洗碗洗菜', '寒暑假工', '小时工']
const frontPositions = ['店长', '前厅经理', '前厅主管', '收银', '金牌师傅', '迎宾', '服务员', '外卖', '保洁', '小时工']
const backRank = Object.fromEntries(backPositions.map((p, i) => [p, i]))
const frontRank = Object.fromEntries(frontPositions.map((p, i) => [p, i]))

const weekDates = computed(() => {
  const today = new Date()
  const monday = new Date(today)
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) + weekOffset.value * 7)
  const dates = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    dates.push(d.toISOString().slice(0, 10))
  }
  return dates
})

const weekLabel = computed(() => {
  const dates = weekDates.value
  return `${dates[0].slice(5)} ~ ${dates[6].slice(5)}`
})

const todayInfo = computed(() => {
  const today = new Date()
  const weekNames = ['日', '一', '二', '三', '四', '五', '六']
  return {
    date: today.toISOString().slice(0, 10),
    weekday: '星期' + weekNames[today.getDay()]
  }
})

const weekInfo = computed(() => {
  const today = new Date()
  const jan1 = new Date(today.getFullYear(), 0, 1)
  const weekNum = Math.ceil(((today - jan1) / 86400000 + jan1.getDay() + 1) / 7)
  return {
    range: weekLabel.value,
    weekNum
  }
})

const monthInfo = computed(() => {
  const today = new Date()
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  return {
    label: `${today.getFullYear()}年${String(today.getMonth() + 1).padStart(2, '0')}月`,
    days: daysInMonth
  }
})

const yearInfo = computed(() => {
  const y = new Date().getFullYear()
  const isLeap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
  return {
    year: y,
    days: isLeap ? 366 : 365
  }
})

const filteredStaff = computed(() => {
  const rank = activeTab.value === '后厨' ? backRank : frontRank
  const list = staffList.value.filter(r => r.business_line === activeTab.value && r.employment_status === '在职')
  list.sort((a, b) => (rank[a.position] ?? 999) - (rank[b.position] ?? 999))
  return list
})

const backStaffCount = computed(() => staffList.value.filter(r => r.business_line === '后厨' && r.employment_status === '在职').length)
const frontStaffCount = computed(() => staffList.value.filter(r => r.business_line === '前厅' && r.employment_status === '在职').length)

// 14个时段列
const dayColumns = computed(() => {
  const cols = []
  for (let i = 0; i < weekDates.value.length; i++) {
    cols.push({ date: weekDates.value[i], dayIndex: i, period: 'am' })
    cols.push({ date: weekDates.value[i], dayIndex: i, period: 'pm' })
  }
  return cols
})

// 7个日期表头
const dayHeaders = computed(() => {
  return weekDates.value.map((d, i) => ({ date: d, dayIndex: i }))
})

// Grid template: 2固定列 + 14等分列
const gridTemplate = computed(() => {
  return '76px 68px ' + 'repeat(14, 1fr)'
})

function getCellKey(empId, date, period) {
  return `${empId}_${date}_${period}`
}

function getCellStatus(empId, date, period) {
  const key = getCellKey(empId, date, period)
  return attendanceMap.value[key]?.status || ''
}

function getCellStore(empId, date, period) {
  const key = getCellKey(empId, date, period)
  return attendanceMap.value[key]?.secondment_store || ''
}

function getCellDisplay(empId, date, period) {
  const status = getCellStatus(empId, date, period)
  if (!status) return ''
  if (status === 'second') {
    return getCellStore(empId, date, period) || '借'
  }
  const opt = STATUS_OPTIONS.find(o => o.value === status)
  return opt ? opt.label : ''
}

function updateCell(empId, date, period, status, store = '') {
  const key = getCellKey(empId, date, period)
  const map = { ...attendanceMap.value }
  map[key] = { employee_id: empId, date, period, status, secondment_store: store }
  attendanceMap.value = map
}

function onCellClick(empId, date, period, event) {
  event.stopPropagation()
  const cell = event.currentTarget
  const rect = cell.getBoundingClientRect()
  const dropdownHeight = 280
  const dropdownWidth = 160
  // 下方空间不够则向上弹出
  if (rect.bottom + dropdownHeight > window.innerHeight) {
    dropdownY.value = rect.top - dropdownHeight - 2
  } else {
    dropdownY.value = rect.bottom + 2
  }
  // 右侧空间不够则向左偏移
  if (rect.left + dropdownWidth > window.innerWidth) {
    dropdownX.value = rect.right - dropdownWidth
  } else {
    dropdownX.value = rect.left
  }
  dropdownTarget.value = { empId, date, period }
  dropdownVisible.value = true
}

async function selectStatus(status) {
  const t = dropdownTarget.value
  updateCell(t.empId, t.date, t.period, status)
  dropdownVisible.value = false
  await batchSaveAttendance([{
    employee_id: t.empId,
    date: t.date,
    period: t.period,
    status,
    secondment_store: ''
  }])
}

async function selectStore(store) {
  const t = dropdownTarget.value
  updateCell(t.empId, t.date, t.period, 'second', store)
  dropdownVisible.value = false
  await batchSaveAttendance([{
    employee_id: t.empId,
    date: t.date,
    period: t.period,
    status: 'second',
    secondment_store: store
  }])
}

function closeDropdown() {
  dropdownVisible.value = false
}

const isNextWeek = computed(() => weekOffset.value === 1)
const isBeyondNextWeek = computed(() => weekOffset.value > 1)

function prevWeek() { weekOffset.value-- }
function nextWeek() { if (weekOffset.value < 1) weekOffset.value++ }
function thisWeek() { weekOffset.value = 0 }

async function loadStaff() {
  const params = {}
  const storeId = getStoreId()
  if (storeId) params.store_id = storeId
  const data = await getStaff(params)
  staffList.value = data
}

async function loadAttendance() {
  const dates = weekDates.value
  const params = { start_date: dates[0], end_date: dates[6] }
  const storeId = getStoreId()
  if (storeId) params.store_id = storeId
  const data = await getAttendance(params)
  const map = {}
  for (const r of data) {
    const key = getCellKey(r.employee_id, r.date, r.period)
    map[key] = { employee_id: r.employee_id, date: r.date, period: r.period, status: r.status, secondment_store: r.secondment_store || '' }
  }

  // 下一周：自动将所有在职员工出勤状态设为√
  if (isNextWeek.value && Object.keys(map).length === 0) {
    for (const emp of staffList.value) {
      if (emp.employment_status !== '在职') continue
      for (let i = 0; i < weekDates.value.length; i++) {
        for (const period of ['am', 'pm']) {
          const key = getCellKey(emp.id, weekDates.value[i], period)
          if (!map[key]) {
            map[key] = { employee_id: emp.id, date: weekDates.value[i], period, status: 'check', secondment_store: '' }
          }
        }
      }
    }
  }

  attendanceMap.value = map
}

onMounted(async () => {
  loading.value = true
  try {
    await loadStaff()
    await loadAttendance()
  } finally {
    loading.value = false
  }
  document.addEventListener('click', closeDropdown)
})

onUnmounted(() => {
  document.removeEventListener('click', closeDropdown)
})

watch(weekOffset, async () => {
  loading.value = true
  try {
    await loadAttendance()
  } finally {
    loading.value = false
  }
})

watch(selectedStoreId, async () => {
  loading.value = true
  try {
    await loadStaff()
    await loadAttendance()
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="schedule-page">
    <div class="time-cards">
      <div class="time-card">
        <div class="time-card-label">今天是</div>
        <div class="time-card-value">{{ todayInfo.date }}</div>
        <div class="time-card-sub">{{ todayInfo.weekday }}</div>
      </div>
      <div class="time-card active" @click="thisWeek">
        <div class="time-card-label">本周</div>
        <div class="time-card-value">
          <el-button text class="card-arrow" @click.stop="prevWeek"><el-icon :size="18"><ArrowLeft /></el-icon></el-button>
          {{ weekInfo.range }}
          <el-button text class="card-arrow" :disabled="isNextWeek" @click.stop="nextWeek"><el-icon :size="18"><ArrowRight /></el-icon></el-button>
        </div>
        <div class="time-card-sub">第 {{ weekInfo.weekNum }} 周</div>
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

    <div class="grid-wrap">
      <div class="grid-container" :style="{ gridTemplateColumns: gridTemplate }">
        <!-- 表头第一行 -->
        <div class="g-cell g-header g-name" style="grid-row:1;grid-column:1;">姓名</div>
        <div class="g-cell g-header g-pos" style="grid-row:1;grid-column:2;">岗位</div>
        <!-- 姓名和岗位下方合并为一个单元格填写出勤 -->
        <div class="g-cell g-header g-sub" style="grid-row:2;grid-column:1 / span 2;">出勤</div>
        <div v-for="(h, idx) in dayHeaders" :key="h.date"
          class="g-cell g-header g-day"
          :style="{ gridRow: 1, gridColumn: (3 + idx * 2) + ' / span 2' }">
          <div class="day-header">周{{ weekDays[h.dayIndex] }}</div>
          <div class="day-date">{{ h.date.slice(5) }}</div>
        </div>

        <!-- 表头第二行 -->
        <div v-for="(c, idx) in dayColumns" :key="'p-'+c.date+'-'+c.period"
          class="g-cell g-header g-period"
          :style="{ gridRow: 2, gridColumn: 3 + idx }">
          {{ c.period === 'am' ? '上午' : '下午' }}
        </div>

        <!-- 数据行 -->
        <template v-for="(emp, empIdx) in filteredStaff" :key="emp.id">
          <div class="g-cell g-name" :style="{ gridRow: 3 + empIdx, gridColumn: 1 }">
            {{ emp.name }}<el-tag v-if="emp.secondment_status" type="danger" size="small" style="margin-left:2px;vertical-align:middle;">借</el-tag>
          </div>
          <div class="g-cell g-pos" :style="{ gridRow: 3 + empIdx, gridColumn: 2 }">{{ emp.position }}</div>
          <div v-for="(c, idx) in dayColumns" :key="emp.id+'-'+c.date+'-'+c.period"
            class="g-cell g-data"
            :style="{ gridRow: 3 + empIdx, gridColumn: 3 + idx }"
            @click="onCellClick(emp.id, c.date, c.period, $event)">
            <span class="cell-text">{{ getCellDisplay(emp.id, c.date, c.period) }}</span>
          </div>
        </template>

        <!-- 空数据 -->
        <div v-if="filteredStaff.length === 0" class="g-cell g-empty" :style="{ gridRow: 3, gridColumn: '1 / -1' }">
          暂无在职员工
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="dropdownVisible"
        class="cell-dropdown"
        :style="{ left: dropdownX + 'px', top: dropdownY + 'px' }"
        @click.stop
      >
        <div class="dropdown-section">
          <div class="dropdown-item" v-for="opt in STATUS_OPTIONS" :key="opt.value" @click="selectStatus(opt.value)">
            <span class="dropdown-symbol">{{ opt.label }}</span>
            <span class="dropdown-desc">{{ opt.desc }}</span>
          </div>
        </div>
        <div class="dropdown-divider"></div>
        <div class="dropdown-section">
          <div class="dropdown-title">借调门店</div>
          <div class="store-list">
            <div class="store-item" v-for="store in STORES" :key="store" @click="selectStore(store)">{{ store }}</div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.schedule-page {
  min-height: calc(100vh - 60px - 32px);
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
.grid-wrap {
  flex: 1;
  overflow: auto;
}
.grid-container {
  display: grid;
  min-width: fit-content;
  grid-auto-rows: minmax(34px, auto);
}
.g-cell {
  border: 1px solid #ebeef5;
  padding: 0;
  text-align: center;
  color: #303133;
  min-height: 0;
  box-sizing: border-box;
}
.g-header {
  background: #fafafa;
  font-weight: 700;
  color: #303133;
  position: sticky;
  top: 0;
  z-index: 2;
  min-height: 34px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.g-name {
  text-align: left;
  padding-left: 10px;
  font-size: 13px;
  min-height: 34px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  align-items: center;
}
.g-pos {
  font-size: 13px;
  min-height: 34px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  align-items: center;
  justify-content: center;
}
.g-day {
  font-size: 13px;
}
.g-sub {
  font-size: 11px;
  font-weight: 700;
  color: #303133;
}
.g-period {
  font-size: 11px;
  color: #303133;
  font-weight: 700;
}
.day-header { font-size: 13px; font-weight: 700; line-height: 1.4; }
.day-date { font-size: 11px; color: #909399; line-height: 1.3; }
.g-data {
  cursor: pointer;
  user-select: none;
  padding: 5px 0;
  min-height: 34px;
  transition: background 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
}
.g-data:hover { background: #f5f7fa; }
.cell-text {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}
.g-empty {
  text-align: center;
  color: #999;
  padding: 40px 0;
  grid-column: 1 / -1;
}
</style>

<style>
.cell-dropdown {
  position: fixed;
  z-index: 3000;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 6px 20px rgba(0,0,0,0.12);
  border: 1px solid #e4e7ed;
  min-width: 140px;
  padding: 6px 0;
}
.dropdown-section { padding: 2px 0; }
.dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 16px;
  cursor: pointer;
  font-size: 13px;
  color: #303133;
  transition: background 0.15s;
}
.dropdown-item:hover { background: #f5f7fa; }
.dropdown-symbol {
  font-weight: 700;
  font-size: 16px;
  width: 20px;
  text-align: center;
}
.dropdown-desc { color: #606266; }
.dropdown-divider {
  height: 1px;
  background: #ebeef5;
  margin: 4px 12px;
}
.dropdown-title {
  font-size: 11px;
  color: #909399;
  padding: 2px 16px 6px;
}
.store-list {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 4px;
  padding: 0 10px 8px;
}
.store-item {
  text-align: center;
  padding: 5px 0;
  cursor: pointer;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  color: #303133;
  transition: all 0.15s;
}
.store-item:hover { background: #ecf5ff; color: #409eff; }
</style>
