<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { getDailySummary, getDailySummaryAll } from '../utils/api'
import { useStore } from '../composables/useStore'

const { STORES, selectedStoreId, getStoreId } = useStore()

const loading = ref(false)
const currentYear = ref(new Date().getFullYear())
const currentMonth = ref(new Date().getMonth() + 1)
const tableData = ref([])
const currentPage = ref(1)
const pageSize = ref(10)

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

function prevMonth() {
  if (currentMonth.value === 1) { currentMonth.value = 12; currentYear.value-- }
  else currentMonth.value--
}

const isCurrentMonth = computed(() => {
  const now = new Date()
  return currentYear.value === now.getFullYear() && currentMonth.value === now.getMonth() + 1
})

function nextMonth() {
  if (isCurrentMonth.value) return
  if (currentMonth.value === 12) { currentMonth.value = 1; currentYear.value++ }
  else currentMonth.value++
}

function thisMonth() {
  currentYear.value = new Date().getFullYear()
  currentMonth.value = new Date().getMonth() + 1
}

function fmt(n) {
  return (n || 0).toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

const sortedData = computed(() => {
  return [...tableData.value].sort((a, b) => b.date.localeCompare(a.date))
})

const pagedData = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return sortedData.value.slice(start, start + pageSize.value)
})

const totalCount = computed(() => sortedData.value.length)

function handlePageChange(page) {
  currentPage.value = page
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

    if (storeId) {
      tableData.value = await getDailySummary({ ...params, store_id: storeId })
    } else {
      // 调用后端批量接口获取所有门店汇总数据
      tableData.value = await getDailySummaryAll(params)
    }
    currentPage.value = 1
  } finally {
    loading.value = false
  }
}

onMounted(() => { loadData() })

watch([currentYear, currentMonth, selectedStoreId], () => { loadData() })
</script>

<template>
  <div class="summary-page">
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
          <el-button text class="card-arrow" :disabled="isCurrentMonth" @click.stop="nextMonth"><el-icon :size="18"><ArrowRight /></el-icon></el-button>
        </div>
        <div class="time-card-sub">共 {{ monthInfo.days }} 天</div>
      </div>
    </div>

    <div class="page-card">
      <div class="page-card__header">
        <div>
          <div class="page-card__title">每日奖金汇总</div>
          <div class="page-card__desc">{{ monthInfo.label }} · 共 {{ totalCount }} 条记录</div>
        </div>
      </div>
      <div class="page-card__body--flush">
        <el-table :data="pagedData" v-loading="loading" stripe empty-text="暂无数据" style="width: 100%;">
          <el-table-column prop="date" label="日期" min-width="100" />
          <el-table-column prop="actual_revenue" label="实收营业额" min-width="110" align="right">
            <template #default="{ row }">¥{{ fmt(row.actual_revenue) }}</template>
          </el-table-column>
          <el-table-column prop="front_check_count" label="前厅出勤人数" min-width="110" align="center" />
          <el-table-column prop="front_bonus" label="前厅奖金数" min-width="100" align="right">
            <template #default="{ row }">
              <span v-if="row.front_bonus === null">-</span>
              <span v-else :style="{ color: row.front_bonus > 0 ? 'var(--success)' : row.front_bonus < 0 ? 'var(--destructive)' : 'var(--text-primary)' }">{{ fmt(row.front_bonus) }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="back_check_count" label="后厨出勤人数" min-width="110" align="center" />
          <el-table-column prop="back_bonus" label="后厨奖金数" min-width="100" align="right">
            <template #default="{ row }">
              <span v-if="row.back_bonus === null">-</span>
              <span v-else :style="{ color: row.back_bonus > 0 ? 'var(--success)' : row.back_bonus < 0 ? 'var(--destructive)' : 'var(--text-primary)' }">{{ fmt(row.back_bonus) }}</span>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <div v-if="totalCount > 0" class="page-card__footer">
        <el-pagination
          v-model:current-page="currentPage"
          :page-size="pageSize"
          :total="totalCount"
          layout="prev, pager, next"
          @current-change="handlePageChange"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.summary-page {
  min-height: calc(100vh - 60px - 32px);
}
</style>
