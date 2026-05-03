<script setup>
import { ref, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { getConfig, updateConfig, resetConfig } from '../utils/api'

const loading = ref(false)
const config = ref({})
const activeTab = ref('ratio')

const ratioRules = [
  { key: 'waiter_tables', label: '服务员管桌数', unit: '桌/人' },
  { key: 'wok_tables', label: '炒锅负责桌数', unit: '桌/人' },
  { key: 'prep_tables', label: '配菜负责桌数', unit: '桌/人' },
  { key: 'assistant_tables', label: '打荷负责桌数', unit: '桌/人' },
  { key: 'steamer_tables', label: '蒸菜负责桌数', unit: '桌/人' },
  { key: 'dessert_tables', label: '点心负责桌数', unit: '桌/人' },
  { key: 'cold_tables', label: '凉菜负责桌数', unit: '桌/人' },
  { key: 'xiangcai_tables', label: '湘菜负责桌数', unit: '桌/人' },
  { key: 'dishwasher_tables', label: '洗碗负责桌数', unit: '桌/人' },
  { key: 'delivery_per_person', label: '外卖每人处理单量', unit: '单/人' },
]

const otherRules = [
  { key: 'min_consecutive_days', label: '最少连续工作天数', unit: '天' },
  { key: 'max_consecutive_days', label: '最多连续工作天数', unit: '天' },
  { key: 'daily_wage', label: '日薪标准', unit: '元' },
]

function getRuleValue(key) {
  const rule = config.value[key]
  if (!rule) return 0
  return typeof rule.value === 'object' ? rule.value : Number(rule.value)
}

function setRuleValue(key, val) {
  if (config.value[key]) {
    config.value[key].value = val
  }
}

async function loadData() {
  loading.value = true
  try {
    config.value = await getConfig()
  } finally {
    loading.value = false
  }
}

async function handleSaveRatio(key) {
  await updateConfig(key, config.value[key].value)
  ElMessage.success('保存成功')
}

async function handleSaveBrackets(key) {
  await updateConfig(key, config.value[key].value)
  ElMessage.success('保存成功')
}

async function handleReset() {
  await resetConfig()
  loadData()
  ElMessage.success('已恢复默认配置')
}

const lunchBrackets = computed(() => config.value['revenue_lunch_brackets']?.value || [])
const dinnerBrackets = computed(() => config.value['revenue_dinner_brackets']?.value || [])

function addLunchBracket() {
  if (!config.value['revenue_lunch_brackets']) return
  config.value['revenue_lunch_brackets'].value.push({ min: 0, max: 0, factor: 1.0, label: '' })
}

function addDinnerBracket() {
  if (!config.value['revenue_dinner_brackets']) return
  config.value['revenue_dinner_brackets'].value.push({ min: 0, max: 0, factor: 1.0, label: '' })
}

function removeLunchBracket(index) {
  config.value['revenue_lunch_brackets'].value.splice(index, 1)
}

function removeDinnerBracket(index) {
  config.value['revenue_dinner_brackets'].value.splice(index, 1)
}

onMounted(loadData)
</script>

<template>
  <div v-loading="loading">
    <el-card shadow="hover">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: bold; font-size: 16px;">排班规则配置</span>
          <el-button type="warning" @click="handleReset">
            <el-icon><RefreshRight /></el-icon> 恢复默认
          </el-button>
        </div>
      </template>

      <el-tabs v-model="activeTab">
        <el-tab-pane label="岗位配比" name="ratio">
          <el-descriptions title="各岗位人员配比参数" :column="2" border>
            <el-descriptions-item v-for="rule in ratioRules" :key="rule.key" :label="rule.label">
              <div style="display: flex; align-items: center; gap: 8px;">
                <el-input-number
                  :model-value="getRuleValue(rule.key)"
                  @update:model-value="(val) => setRuleValue(rule.key, val)"
                  :min="1"
                  :max="100"
                  size="small"
                  style="width: 120px;"
                />
                <span style="color: #999;">{{ rule.unit }}</span>
                <el-button type="primary" link size="small" @click="handleSaveRatio(rule.key)">保存</el-button>
              </div>
            </el-descriptions-item>
          </el-descriptions>

          <el-descriptions title="其他参数" :column="2" border style="margin-top: 20px;">
            <el-descriptions-item v-for="rule in otherRules" :key="rule.key" :label="rule.label">
              <div style="display: flex; align-items: center; gap: 8px;">
                <el-input-number
                  :model-value="getRuleValue(rule.key)"
                  @update:model-value="(val) => setRuleValue(rule.key, val)"
                  :min="rule.key === 'daily_wage' ? 0 : 1"
                  size="small"
                  style="width: 120px;"
                />
                <span style="color: #999;">{{ rule.unit }}</span>
                <el-button type="primary" link size="small" @click="handleSaveRatio(rule.key)">保存</el-button>
              </div>
            </el-descriptions-item>
          </el-descriptions>
        </el-tab-pane>

        <el-tab-pane label="营业额系数" name="brackets">
          <el-row :gutter="20">
            <el-col :span="12">
              <el-card shadow="never">
                <template #header>
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span>午市营业额区间</span>
                    <el-button type="primary" size="small" @click="addLunchBracket">添加区间</el-button>
                  </div>
                </template>
                <el-table :data="lunchBrackets" border size="small">
                  <el-table-column label="区间" width="120">
                    <template #default="{ row }">
                      <el-input v-model="row.label" size="small" placeholder="如: 8000-15000" />
                    </template>
                  </el-table-column>
                  <el-table-column label="最低" width="100">
                    <template #default="{ row }">
                      <el-input-number v-model="row.min" size="small" :min="0" controls-position="right" />
                    </template>
                  </el-table-column>
                  <el-table-column label="最高" width="100">
                    <template #default="{ row }">
                      <el-input-number v-model="row.max" size="small" :min="0" controls-position="right" />
                    </template>
                  </el-table-column>
                  <el-table-column label="系数" width="100">
                    <template #default="{ row }">
                      <el-input-number v-model="row.factor" size="small" :min="0.1" :max="3" :step="0.1" :precision="1" controls-position="right" />
                    </template>
                  </el-table-column>
                  <el-table-column label="操作" width="60">
                    <template #default="{ $index }">
                      <el-button type="danger" link size="small" @click="removeLunchBracket($index)">删除</el-button>
                    </template>
                  </el-table-column>
                </el-table>
                <div style="margin-top: 10px; text-align: right;">
                  <el-button type="primary" size="small" @click="handleSaveBrackets('revenue_lunch_brackets')">保存午市配置</el-button>
                </div>
              </el-card>
            </el-col>
            <el-col :span="12">
              <el-card shadow="never">
                <template #header>
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span>晚市营业额区间</span>
                    <el-button type="primary" size="small" @click="addDinnerBracket">添加区间</el-button>
                  </div>
                </template>
                <el-table :data="dinnerBrackets" border size="small">
                  <el-table-column label="区间" width="120">
                    <template #default="{ row }">
                      <el-input v-model="row.label" size="small" placeholder="如: 10000-15000" />
                    </template>
                  </el-table-column>
                  <el-table-column label="最低" width="100">
                    <template #default="{ row }">
                      <el-input-number v-model="row.min" size="small" :min="0" controls-position="right" />
                    </template>
                  </el-table-column>
                  <el-table-column label="最高" width="100">
                    <template #default="{ row }">
                      <el-input-number v-model="row.max" size="small" :min="0" controls-position="right" />
                    </template>
                  </el-table-column>
                  <el-table-column label="系数" width="100">
                    <template #default="{ row }">
                      <el-input-number v-model="row.factor" size="small" :min="0.1" :max="3" :step="0.1" :precision="1" controls-position="right" />
                    </template>
                  </el-table-column>
                  <el-table-column label="操作" width="60">
                    <template #default="{ $index }">
                      <el-button type="danger" link size="small" @click="removeDinnerBracket($index)">删除</el-button>
                    </template>
                  </el-table-column>
                </el-table>
                <div style="margin-top: 10px; text-align: right;">
                  <el-button type="primary" size="small" @click="handleSaveBrackets('revenue_dinner_brackets')">保存晚市配置</el-button>
                </div>
              </el-card>
            </el-col>
          </el-row>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>
