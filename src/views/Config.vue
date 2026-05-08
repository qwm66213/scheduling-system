<script setup>
import { ref, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { getConfig, updateConfig, resetConfig } from '../utils/api'

const loading = ref(false)
const config = ref({})
const activeTab = ref('standard')

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

// Business standards
const frontStandard = computed(() => config.value['front_standard']?.value || { staff: 12, salary: 69195, ratio: 8.0, efficiency: 2800 })
const backStandard = computed(() => config.value['back_standard']?.value || { staff: 15, salary: 108117, ratio: 12.5, efficiency: 2200 })
const totalStandard = computed(() => config.value['total_standard']?.value || { staff: 27, salary: 177312, ratio: 20.5, efficiency: 1200 })
const revenueTarget = computed(() => {
  const v = config.value['revenue_target']?.value
  return typeof v === 'object' ? 0 : Number(v) || 864936
})
const efficiencyStandard = computed(() => config.value['efficiency_standard']?.value || { revenue: 100, efficiency: 100 })
const frontExtra = computed(() => config.value['front_extra']?.value || { hourly_hours: 0, secondment: 0 })
const backExtra = computed(() => config.value['back_extra']?.value || { hourly_hours: 0, secondment: 0 })

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

async function handleSaveStandard(key) {
  await updateConfig(key, config.value[key].value)
  ElMessage.success('保存成功')
}

async function handleSaveRevenueTarget() {
  await updateConfig('revenue_target', revenueTarget.value)
  ElMessage.success('保存成功')
}

async function handleSaveEfficiencyStandard() {
  await updateConfig('efficiency_standard', efficiencyStandard.value)
  ElMessage.success('保存成功')
}

async function handleSaveFrontExtra() {
  await updateConfig('front_extra', frontExtra.value)
  ElMessage.success('保存成功')
}

async function handleSaveBackExtra() {
  await updateConfig('back_extra', backExtra.value)
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
          <span style="font-weight: bold; font-size: 16px;">规则配置</span>
          <el-button type="warning" @click="handleReset">
            <el-icon><RefreshRight /></el-icon> 恢复默认
          </el-button>
        </div>
      </template>

      <el-tabs v-model="activeTab">
        <el-tab-pane label="经营标准" name="standard">
          <el-row :gutter="20">
            <el-col :span="8">
              <el-card shadow="never">
                <template #header><span style="font-weight: 600;">前厅标准</span></template>
                <div class="std-item">
                  <span class="std-label">标准人效</span>
                  <el-input-number v-model="frontStandard.efficiency" :min="0" size="small" />
                  <span class="std-unit">元/人</span>
                </div>
                <div class="std-item">
                  <span class="std-label">小时工工时</span>
                  <el-input-number v-model="frontExtra.hourly_hours" :min="0" :precision="1" :step="0.5" size="small" />
                  <span class="std-unit">小时</span>
                </div>
                <div class="std-item">
                  <span class="std-label">借调人数</span>
                  <el-input-number v-model="frontExtra.secondment" :min="0" size="small" />
                  <span class="std-unit">人</span>
                </div>
                <el-button type="primary" size="small" style="margin-top:12px;width:100%;" @click="handleSaveStandard('front_standard'); handleSaveFrontExtra()">保存前厅标准</el-button>
              </el-card>
            </el-col>
            <el-col :span="8">
              <el-card shadow="never">
                <template #header><span style="font-weight: 600;">后厨标准</span></template>
                <div class="std-item">
                  <span class="std-label">人数标准</span>
                  <el-input-number v-model="backStandard.staff" :min="1" size="small" />
                  <span class="std-unit">人</span>
                </div>
                <div class="std-item">
                  <span class="std-label">净工资标准</span>
                  <el-input-number v-model="backStandard.salary" :min="0" size="small" />
                  <span class="std-unit">元</span>
                </div>
                <div class="std-item">
                  <span class="std-label">标准占比</span>
                  <el-input-number v-model="backStandard.ratio" :min="0" :max="100" :precision="1" :step="0.5" size="small" />
                  <span class="std-unit">%</span>
                </div>
                <div class="std-item">
                  <span class="std-label">标准人效</span>
                  <el-input-number v-model="backStandard.efficiency" :min="0" size="small" />
                  <span class="std-unit">元/人</span>
                </div>
                <div class="std-item">
                  <span class="std-label">小时工工时</span>
                  <el-input-number v-model="backExtra.hourly_hours" :min="0" :precision="1" :step="0.5" size="small" />
                  <span class="std-unit">小时</span>
                </div>
                <div class="std-item">
                  <span class="std-label">借调人数</span>
                  <el-input-number v-model="backExtra.secondment" :min="0" size="small" />
                  <span class="std-unit">人</span>
                </div>
                <el-button type="primary" size="small" style="margin-top:12px;width:100%;" @click="handleSaveStandard('back_standard'); handleSaveBackExtra()">保存后厨标准</el-button>
              </el-card>
            </el-col>
            <el-col :span="8">
              <el-card shadow="never">
                <template #header><span style="font-weight: 600;">总体标准</span></template>
                <div class="std-item">
                  <span class="std-label">人数标准</span>
                  <el-input-number v-model="totalStandard.staff" :min="1" size="small" />
                  <span class="std-unit">人</span>
                </div>
                <div class="std-item">
                  <span class="std-label">净工资标准</span>
                  <el-input-number v-model="totalStandard.salary" :min="0" size="small" />
                  <span class="std-unit">元</span>
                </div>
                <div class="std-item">
                  <span class="std-label">标准占比</span>
                  <el-input-number v-model="totalStandard.ratio" :min="0" :max="100" :precision="1" :step="0.5" size="small" />
                  <span class="std-unit">%</span>
                </div>
                <div class="std-item">
                  <span class="std-label">标准人效</span>
                  <el-input-number v-model="totalStandard.efficiency" :min="0" size="small" />
                  <span class="std-unit">元/人</span>
                </div>
                <el-button type="primary" size="small" style="margin-top:12px;width:100%;" @click="handleSaveStandard('total_standard')">保存总体标准</el-button>
              </el-card>
            </el-col>
          </el-row>
          <el-row :gutter="20" style="margin-top: 16px;">
            <el-col :span="12">
              <el-card shadow="never">
                <template #header><span style="font-weight: 600;">营业额目标</span></template>
                <div class="std-item">
                  <span class="std-label">月营业额目标</span>
                  <el-input-number v-model="revenueTarget" :min="0" :step="10000" size="small" style="width:180px;" />
                  <span class="std-unit">元</span>
                </div>
                <el-button type="primary" size="small" style="margin-top:12px;width:100%;" @click="handleSaveRevenueTarget">保存</el-button>
              </el-card>
            </el-col>
            <el-col :span="12">
              <el-card shadow="never">
                <template #header><span style="font-weight: 600;">达成率标准</span></template>
                <div class="std-item">
                  <span class="std-label">营业额达成率</span>
                  <el-input-number v-model="efficiencyStandard.revenue" :min="0" :max="200" size="small" />
                  <span class="std-unit">%</span>
                </div>
                <div class="std-item">
                  <span class="std-label">人效达成率</span>
                  <el-input-number v-model="efficiencyStandard.efficiency" :min="0" :max="200" size="small" />
                  <span class="std-unit">%</span>
                </div>
                <el-button type="primary" size="small" style="margin-top:12px;width:100%;" @click="handleSaveEfficiencyStandard">保存</el-button>
              </el-card>
            </el-col>
          </el-row>
        </el-tab-pane>

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

<style scoped>
.std-item {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}
.std-label {
  width: 100px;
  font-size: 13px;
  color: #606266;
  flex-shrink: 0;
}
.std-unit {
  margin-left: 6px;
  font-size: 12px;
  color: #999;
  flex-shrink: 0;
}
</style>
