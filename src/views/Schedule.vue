<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { getSchedule, batchSaveSchedule, getStaff } from '../utils/api'
import { useStore } from '../composables/useStore'

const { STORES, STORE_ABBREVS, STORE_ID_LIST, selectedStoreId, getStoreId } = useStore()

const loading = ref(false)
const activeTab = ref('前厅')  // 默认选中左侧tab
const weekOffset = ref(0)
const allStaffList = ref([])  // 从员工API获取的所有员工
const staffList = ref([])
const scheduleMap = ref({})

const dropdownVisible = ref(false)
const dropdownX = ref(0)
const dropdownY = ref(0)
const dropdownTarget = ref(null)
const dropdownMode = ref('status') // 'status' 或 'store'

const weekDays = ['一', '二', '三', '四', '五', '六', '日']

const STATUS_OPTIONS = [
  { value: 'check', label: '√', desc: '出勤' },
  { value: 'leave', label: 'O', desc: '请假/休息' },
  { value: 'absent', label: '旷', desc: '旷工' },
  { value: 'save', label: '存', desc: '存休' },
  { value: 'annual', label: '年', desc: '休年假' }
]

// 判断是否为小时工
function isHourlyWorker(empId) {
  const emp = allStaffList.value.find(e => e.employeeCode === empId || e.id === empId)
  return emp?.position === '小时工'
}

const backPositions = ['厨师长', '副厨', '第一炉灶', '第二炉灶', '第三炉灶', '第四炉灶', '第五炉灶', '第六炉灶', '冷菜主管', '冷菜', '蒸箱', '点心师傅', '切配主管', '切配', '海鲜师傅', '打荷', '洗碗洗菜', '寒暑假工', '小时工']
const frontPositions = ['店长', '前厅经理', '前厅主管', '金牌师傅', '收银', '迎宾', '服务员', '外卖', '保洁', '小时工']
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
  const list = staffList.value.filter(r => r.business_line === activeTab.value)
  list.sort((a, b) => (rank[a.position] ?? 999) - (rank[b.position] ?? 999))
  return list
})

// 非小时工列表
const nonHourlyStaff = computed(() => {
  return filteredStaff.value.filter(emp => emp.position !== '小时工')
})

// 小时工列表
const hourlyStaff = computed(() => {
  return filteredStaff.value.filter(emp => emp.position === '小时工')
})

// 借调门店列表（排除当前门店）
const secondmentStoreIds = computed(() => {
  const currentStoreId = getStoreId()
  return Object.keys(STORES)
    .map(Number)
    .filter(id => id !== currentStoreId)
    .sort((a, b) => a - b)
})

const backStaffCount = computed(() => staffList.value.filter(r => r.business_line === '后厨').length)
const frontStaffCount = computed(() => staffList.value.filter(r => r.business_line === '前厅').length)

// 14个时段列
// 非小时工：每天两列（上午/下午）
const dayColumns = computed(() => {
  const cols = []
  for (let i = 0; i < weekDates.value.length; i++) {
    cols.push({ date: weekDates.value[i], dayIndex: i, period: 'am' })
    cols.push({ date: weekDates.value[i], dayIndex: i, period: 'pm' })
  }
  return cols
})

// 小时工：每天一列（全天）
const hourlyDayColumns = computed(() => {
  return weekDates.value.map((d, i) => ({ date: d, dayIndex: i }))
})

// 7个日期表头
const dayHeaders = computed(() => {
  return weekDates.value.map((d, i) => ({ date: d, dayIndex: i }))
})

// Grid template: 非小时工 2固定列 + 14列
const gridTemplate = computed(() => {
  return '75px 75px repeat(14, 93px)'
})

// 小时工 Grid template: 2固定列 + 7列
const hourlyGridTemplate = computed(() => {
  return '75px 75px repeat(7, 186px)'
})

function getCellKey(empId, date, period) {
  return `${empId}_${date}_${period}`
}

function getCellStatus(empId, date, period) {
  const key = getCellKey(empId, date, period)
  return scheduleMap.value[key]?.status || ''
}

function getCellStore(empId, date, period) {
  const key = getCellKey(empId, date, period)
  return scheduleMap.value[key]?.secondment_store || ''
}

function getCellDisplay(empId, date, period) {
  const status = getCellStatus(empId, date, period)
  if (!status) return ''
  if (status === 'second') {
    const storeName = getCellStore(empId, date, period)
    // 根据门店名称查找对应的门店ID，再获取缩写
    const storeId = Object.keys(STORES).find(id => STORES[id] === storeName)
    return storeId ? STORE_ABBREVS[storeId] || '借' : '借'
  }
  const opt = STATUS_OPTIONS.find(o => o.value === status)
  return opt ? opt.label : ''
}

function updateCell(empId, date, period, status, store = '') {
  const key = getCellKey(empId, date, period)
  const map = { ...scheduleMap.value }
  map[key] = { employee_id: empId, date, period, status, secondment_store: store }
  scheduleMap.value = map
}

// 获取小时工工时显示值（全天）
function getHourlyHours(empId, date) {
  const key = `${empId}_${date}_day`
  const record = scheduleMap.value[key]
  return record?.hours || ''
}

// 小时工输入工时（全天）
async function onHourlyChange(emp, date, event) {
  const oldValue = getHourlyHours(emp.id, date)  // 保存原值
  let value = parseFloat(event.target.value)

  // 空值或NaN：恢复原值，不保存
  if (isNaN(value)) {
    event.target.value = oldValue
    return
  }

  // 验证是否为0.5的倍数
  if (value !== 0 && (value * 2) % 1 !== 0) {
    alert('请输入0.5倍的工时')
    event.target.value = oldValue
    return
  }

  // 验证范围
  if (value > 8) {
    alert('工时最大为8')
    event.target.value = oldValue
    return
  }

  if (value < 0) {
    alert('工时不能为负数')
    event.target.value = oldValue
    return
  }

  // 验证通过，保存数据
  await batchSaveSchedule([{
    employee_id: emp.employeeCode || emp.id,
    date: date,
    period: 'day',  // 全天标识
    status: 'hours',
    hours: value,
    name: emp.name || '',
    position: emp.position || '',
    business_line: emp.business_line || '',
    store_id: getStoreId()
  }])
  await loadAttendance()
}

function onCellClick(empId, date, period, event) {
  // 小时工不显示下拉菜单
  if (isHourlyWorker(empId)) return

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
  dropdownMode.value = 'status'
  dropdownVisible.value = true
}

async function selectStatus(status) {
  const t = dropdownTarget.value
  // 从 staffList 中获取员工信息
  const emp = staffList.value.find(e => e.id === t.empId)
  updateCell(t.empId, t.date, t.period, status)
  dropdownVisible.value = false
  await batchSaveSchedule([{
    employee_id: t.empId,
    date: t.date,
    period: t.period,
    status,
    secondment_store: '',
    name: emp?.name || '',
    position: emp?.position || '',
    business_line: emp?.business_line || '',
    store_id: getStoreId()  // 传递门店ID
  }])
  await loadAttendance()
}

async function selectStore(storeId) {
  const t = dropdownTarget.value
  // 从 staffList 中获取员工信息
  const emp = staffList.value.find(e => e.id === t.empId)
  const storeName = STORES[storeId] || ''  // 转换为门店名称
  updateCell(t.empId, t.date, t.period, 'second', storeName)
  dropdownVisible.value = false
  await batchSaveSchedule([{
    employee_id: t.empId,
    date: t.date,
    period: t.period,
    status: 'second',
    secondment_store: storeName,
    name: emp?.name || '',
    position: emp?.position || '',
    business_line: emp?.business_line || '',
    store_id: getStoreId()  // 传递门店ID
  }])
  await loadAttendance()
}

function showStoreDropdown() {
  dropdownMode.value = 'store'
}

function closeDropdown() {
  dropdownVisible.value = false
}

// 周选择边界判断
const isMinWeek = computed(() => weekOffset.value <= -6)
const isMaxWeek = computed(() => weekOffset.value >= 1)

// 可选周列表（下周到6周前）
const availableWeeks = computed(() => {
  const weeks = []
  const today = new Date()
  for (let offset = 1; offset >= -6; offset--) {
    const monday = new Date(today)
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) + offset * 7)
    const weekStart = monday.toISOString().slice(0, 10)
    const weekEnd = new Date(monday)
    weekEnd.setDate(monday.getDate() + 6)
    weeks.push({
      offset,
      label: `${weekStart.slice(5)} ~ ${weekEnd.toISOString().slice(5, 10)}`,
      isCurrent: offset === 0
    })
  }
  return weeks
})

function prevWeek() { if (weekOffset.value > -6) weekOffset.value-- }
function nextWeek() { if (weekOffset.value < 1) weekOffset.value++ }
function thisWeek() { weekOffset.value = 0 }
function selectWeek(offset) { weekOffset.value = offset }

// 加载员工数据（根据周日期筛选在职员工）
async function loadStaffData() {
  const dates = weekDates.value
  const weekStart = dates[0]
  const weekEnd = dates[6]

  const params = { pageSize: 100 }  // 最大值100
  const storeId = getStoreId()
  if (storeId) params.store_id = storeId

  const result = await getStaff(params)
  let staffData = []

  // 兼容旧格式（数组）和新格式（分页对象）
  if (Array.isArray(result)) {
    staffData = result
  } else {
    staffData = result.data || []
  }

  // 筛选员工：
  // 1. 入职日期 <= 周结束日期（已入职）
  // 2. 最后工作日为空 OR 最后工作日 >= 周开始日期（未离职或本周/之后离职）
  allStaffList.value = staffData.filter(emp => {
    const hireDate = emp.hireDate
    const lastWorkDate = emp.lastWorkDate

    // 入职判断：入职日期 <= 周结束日期
    if (hireDate && hireDate > weekEnd) {
      return false
    }

    // 离职判断：最后工作日 < 周开始日期
    if (lastWorkDate && lastWorkDate < weekStart) {
      return false
    }

    return true
  })
}

async function loadAttendance() {
  const dates = weekDates.value
  const params = { start_date: dates[0], end_date: dates[6] }
  const storeId = getStoreId()
  if (storeId) params.store_id = storeId
  const data = await getSchedule(params)

  // 构建排班映射
  const map = {}
  for (const r of data) {
    const key = getCellKey(r.employee_id, r.date, r.period)
    map[key] = {
      employee_id: r.employee_id,
      date: r.date,
      period: r.period,
      status: r.status,
      secondment_store: r.secondment_store || '',
      hours: r.hours || 0  // 小时工工时
    }
  }

  // 使用 allStaffList 作为员工列表
  staffList.value = allStaffList.value.map(emp => ({
    id: emp.employeeCode || emp.id,
    name: emp.name,
    position: emp.position,
    business_line: emp.workName
  }))

  scheduleMap.value = map
}

onMounted(async () => {
  loading.value = true
  try {
    await loadStaffData()
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
    await loadStaffData()
    await loadAttendance()
  } finally {
    loading.value = false
  }
})

watch(selectedStoreId, async () => {
  loading.value = true
  try {
    await loadStaffData()
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
      <div class="time-card active">
        <div class="time-card-label">本周</div>
        <div class="time-card-value">
          <el-button text class="card-arrow" :disabled="isMinWeek" @click.stop="prevWeek"><el-icon :size="18"><ArrowLeft /></el-icon></el-button>
          <el-dropdown trigger="click" @command="selectWeek" @click.stop>
            <span class="week-dropdown-text">{{ weekInfo.range }}</span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item
                  v-for="w in availableWeeks"
                  :key="w.offset"
                  :command="w.offset"
                  :class="{ 'is-active': w.offset === weekOffset }"
                >
                  {{ w.label }}{{ w.isCurrent ? ' (本周)' : '' }}
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <el-button text class="card-arrow" :disabled="isMaxWeek" @click.stop="nextWeek"><el-icon :size="18"><ArrowRight /></el-icon></el-button>
        </div>
        <div class="time-card-sub">第 {{ weekInfo.weekNum }} 周</div>
      </div>
    </div>

    <div class="page-card">
      <div class="big-tabs">
        <div class="big-tab" :class="{ active: activeTab === '前厅' }" @click="activeTab = '前厅'">
          前厅 <span class="tab-count">{{ frontStaffCount }}</span>
        </div>
        <div class="big-tab" :class="{ active: activeTab === '后厨' }" @click="activeTab = '后厨'">
          后厨 <span class="tab-count">{{ backStaffCount }}</span>
        </div>
      </div>

      <div class="page-card__body--flush grid-wrap">
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
            {{ emp.name }}
          </div>
          <div class="g-cell g-pos" :style="{ gridRow: 3 + empIdx, gridColumn: 2 }">{{ emp.position }}</div>

          <!-- 小时工：每天一个合并单元格 -->
          <template v-if="emp.position === '小时工'">
            <div v-for="(h, idx) in dayHeaders" :key="emp.id+'-'+h.date"
              class="g-cell g-data"
              :style="{ gridRow: 3 + empIdx, gridColumn: (3 + idx * 2) + ' / span 2' }">
              <input
                type="number"
                class="hours-cell-input"
                :value="getHourlyHours(emp.id, h.date)"
                min="0"
                max="8"
                step="0.5"
                @click.stop
                @change="onHourlyChange(emp, h.date, $event)"
              />
            </div>
          </template>

          <!-- 非小时工：每天两个单元格（上午/下午） -->
          <template v-else>
            <div v-for="(c, idx) in dayColumns" :key="emp.id+'-'+c.date+'-'+c.period"
              class="g-cell g-data"
              :style="{ gridRow: 3 + empIdx, gridColumn: 3 + idx }"
              @click="onCellClick(emp.id, c.date, c.period, $event)">
              <span class="cell-text">{{ getCellDisplay(emp.id, c.date, c.period) }}</span>
            </div>
          </template>
        </template>

        <!-- 空数据 -->
        <div v-if="filteredStaff.length === 0" class="g-cell g-empty" :style="{ gridRow: 3, gridColumn: '1 / -1' }">
          暂无员工数据
        </div>
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
        <!-- 状态选择 -->
        <template v-if="dropdownMode === 'status'">
          <div class="dropdown-section">
            <div class="dropdown-item" v-for="opt in STATUS_OPTIONS" :key="opt.value" @click="selectStatus(opt.value)">
              <span class="dropdown-symbol">{{ opt.label }}</span>
              <span class="dropdown-desc">{{ opt.desc }}</span>
            </div>
          </div>
          <div class="dropdown-divider"></div>
          <div class="dropdown-section">
            <div class="dropdown-item" @click="showStoreDropdown">
              <span class="dropdown-symbol">借</span>
              <span class="dropdown-desc">借调</span>
            </div>
          </div>
        </template>
        <!-- 门店选择 -->
        <template v-else-if="dropdownMode === 'store'">
          <div class="dropdown-section">
            <div class="dropdown-title">选择借调门店</div>
            <div class="store-list">
              <div class="store-item" v-for="id in secondmentStoreIds" :key="id" @click="selectStore(id)">{{ STORE_ABBREVS[id] }}</div>
            </div>
          </div>
        </template>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.schedule-page {
  min-height: calc(100vh - 60px - 32px);
  display: flex;
  flex-direction: column;
  background: var(--bg-card);
  border-radius: var(--radius);
}
.week-dropdown-text {
  cursor: pointer;
  padding: 0 4px;
}
.week-dropdown-text:hover {
  color: var(--gold);
}
.grid-wrap {
  flex: 1;
  overflow: auto;
}
.grid-container {
  display: grid;
  min-width: fit-content;
  grid-auto-rows: minmax(40px, auto);
}
.g-cell {
  border: 1px solid var(--border);
  padding: 0;
  text-align: center;
  color: var(--text-primary);
  min-height: 0;
  box-sizing: border-box;
}
.g-header {
  background: var(--bg-secondary);
  font-weight: 700;
  color: var(--text-primary);
  position: sticky;
  top: 0;
  z-index: 2;
  min-height: 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.g-name {
  text-align: left;
  padding-left: 10px;
  font-size: 14px;
  min-height: 40px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  align-items: center;
}
.g-pos {
  font-size: 14px;
  min-height: 40px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  align-items: center;
  justify-content: center;
}
.g-day {
  font-size: 14px;
}
.g-sub {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}
.g-period {
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 700;
}
.day-header { font-size: 14px; font-weight: 700; line-height: 1.4; }
.day-date { font-size: 14px; color: var(--text-muted); line-height: 1.3; }
.g-data {
  cursor: pointer;
  user-select: none;
  padding: 5px 4px;
  min-height: 40px;
  transition: background var(--transition-fast);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
}
.g-data:hover { background: var(--bg-secondary); }
.cell-text {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}
.g-empty {
  text-align: center;
  color: var(--text-muted);
  padding: 40px 0;
  grid-column: 1 / -1;
}
.hours-cell-input {
  width: 100%;
  height: 100%;
  border: none;
  background: transparent;
  text-align: center;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  outline: none;
  cursor: pointer;
}
.hours-cell-input:focus {
  background: var(--gold-soft);
}
.hours-cell-input::-webkit-inner-spin-button,
.hours-cell-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.hours-cell-input[type=number] {
  -moz-appearance: textfield;
}
</style>
