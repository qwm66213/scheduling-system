<script setup>
import { ref, onMounted } from 'vue'
import { getRevenue, getAttendance } from '../utils/api'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart, BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent, TitleComponent } from 'echarts/components'

use([CanvasRenderer, LineChart, BarChart, GridComponent, TooltipComponent, LegendComponent, TitleComponent])

const loading = ref(true)
const revenueTrend = ref({})
const todaySchedule = ref([])
const costSummary = ref({})
const summaryCards = ref({ totalRevenue: 0, avgRevenue: 0, peakDay: '', totalStaff: 0 })

onMounted(async () => {
  try {
    const today = new Date()
    const weekStart = new Date(today)
    weekStart.setDate(today.getDate() - today.getDay() + 1)
    const dates = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart)
      d.setDate(weekStart.getDate() + i)
      dates.push(d.toISOString().split('T')[0])
    }

    const [revenue, attendance] = await Promise.all([
      getRevenue({ start_date: dates[0], end_date: dates[dates.length - 1] }),
      getAttendance({ start_date: dates[0], end_date: dates[dates.length - 1] })
    ])

    // Revenue trend chart
    const dateLabels = [...new Set(revenue.map(r => r.date))].sort()
    const lunchData = dateLabels.map(d => (revenue.find(r => r.date === d && r.period === 'lunch') || {}).total_revenue || 0)
    const dinnerData = dateLabels.map(d => (revenue.find(r => r.date === d && r.period === 'dinner') || {}).total_revenue || 0)
    const totalData = dateLabels.map((d, i) => lunchData[i] + dinnerData[i])

    revenueTrend.value = {
      tooltip: { trigger: 'axis' },
      legend: { data: ['午市', '晚市', '全天总计'] },
      xAxis: { type: 'category', data: dateLabels.map(d => d.slice(5)) },
      yAxis: { type: 'value', name: '营业额(元)' },
      series: [
        { name: '午市', type: 'bar', data: lunchData, itemStyle: { color: '#409eff' } },
        { name: '晚市', type: 'bar', data: dinnerData, itemStyle: { color: '#67c23a' } },
        { name: '全天总计', type: 'line', data: totalData, lineStyle: { width: 2 }, itemStyle: { color: '#e6a23c' } }
      ]
    }

    // Summary cards
    summaryCards.value.totalRevenue = totalData.reduce((a, b) => a + b, 0)
    summaryCards.value.avgRevenue = totalData.length ? Math.round(summaryCards.value.totalRevenue / totalData.length) : 0
    const peakIdx = totalData.indexOf(Math.max(...totalData))
    summaryCards.value.peakDay = dateLabels[peakIdx] || '-'

    // Attendance summary
    const uniqueStaff = new Set(attendance.filter(a => a.status === 'check').map(a => a.employee_id))
    summaryCards.value.totalStaff = uniqueStaff.size

    // Today's attendance
    const todayStr = today.toISOString().split('T')[0]
    todaySchedule.value = attendance.filter(a => a.date === todayStr)

    // Cost summary
    costSummary.value = { dates: dateLabels, daily: totalData.map(t => Math.round(t * 0.15)) }

    loading.value = false
  } catch (e) {
    console.error(e)
    loading.value = false
  }
})
</script>

<template>
  <div v-loading="loading">
    <el-row :gutter="20" style="margin-bottom: 20px;">
      <el-col :span="6">
        <el-card shadow="hover">
          <el-statistic title="本周总营业额" :value="summaryCards.totalRevenue" prefix="¥" />
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <el-statistic title="日均营业额" :value="summaryCards.avgRevenue" prefix="¥" />
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <el-statistic title="营业高峰日" :value="summaryCards.peakDay.slice(5)" />
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <el-statistic title="在岗人数" :value="summaryCards.totalStaff" suffix="人" />
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20">
      <el-col :span="16">
        <el-card shadow="hover">
          <template #header><span style="font-weight: bold;">营业额趋势</span></template>
          <v-chart :option="revenueTrend" style="height: 350px;" autoresize />
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="hover">
          <template #header><span style="font-weight: bold;">今日排班</span></template>
          <div v-if="todaySchedule.length === 0" style="color: #999; text-align: center; padding: 40px 0;">
            暂无今日排班数据
          </div>
          <el-table v-else :data="todaySchedule" size="small" stripe max-height="350">
            <el-table-column prop="role" label="岗位" width="80" />
            <el-table-column prop="staff_name" label="姓名" width="80" />
            <el-table-column prop="period" label="班次" width="70">
              <template #default="{ row }">
                <el-tag :type="row.period === 'lunch' ? 'warning' : row.period === 'dinner' ? 'success' : 'primary'" size="small">
                  {{ row.period === 'lunch' ? '午市' : row.period === 'dinner' ? '晚市' : '全天' }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>
