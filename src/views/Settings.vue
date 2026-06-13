<script setup>
import { ref, onMounted } from 'vue'
import { getSettings, saveSettings } from '../utils/api'
import { ElMessage } from 'element-plus'
import { useStore } from '../composables/useStore'

const { selectedStoreId, getStoreId } = useStore()

const loading = ref(false)
const saving = ref(false)
const frontEfficiency = ref(2800)
const backEfficiency = ref(2200)
const frontBonusRatio = ref(10)
const backBonusRatio = ref(12)

async function loadData() {
  loading.value = true
  try {
    const params = {}
    const storeId = getStoreId()
    if (storeId) params.store_id = storeId
    const data = await getSettings(params)
    frontEfficiency.value = data.front_efficiency
    backEfficiency.value = data.back_efficiency
    frontBonusRatio.value = parseInt(data.front_bonus_ratio) || 10
    backBonusRatio.value = parseInt(data.back_bonus_ratio) || 12
  } finally {
    loading.value = false
  }
}

async function handleSave() {
  saving.value = true
  try {
    const storeId = getStoreId()
    const params = {}
    if (storeId) params.store_id = storeId
    const result = await saveSettings({
      front_efficiency: frontEfficiency.value,
      back_efficiency: backEfficiency.value,
      front_bonus_ratio: frontBonusRatio.value + '%',
      back_bonus_ratio: backBonusRatio.value + '%'
    }, params)
    console.log('saveSettings result:', result)
    // 后端返回 status: 0 表示校验失败
    if (result && result.status === 0) {
      ElMessage.warning(result.errmsg || '保存失败')
      return
    }
    ElMessage.success('保存成功')
  } catch {
    ElMessage.error('保存失败')
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="settings-page" v-loading="loading">
    <div class="page-card" style="max-width: 520px;">
      <div class="page-card__header">
        <div>
          <div class="page-card__title">人效标准设置</div>
          <div class="page-card__desc">设置各门店前厅/后厨的人效标准和奖金比例</div>
        </div>
      </div>
      <div class="page-card__body">
        <div class="setting-row">
          <div class="setting-label">前厅人效标准</div>
          <el-input-number v-model="frontEfficiency" :min="0" :step="100" :controls="false" size="large" style="width: 200px;" />
        </div>
        <div class="setting-row">
          <div class="setting-label">后厨人效标准</div>
          <el-input-number v-model="backEfficiency" :min="0" :step="100" :controls="false" size="large" style="width: 200px;" />
        </div>
        <div class="setting-row">
          <div class="setting-label">前厅奖金比例(%)</div>
          <el-input-number v-model="frontBonusRatio" :precision="0" :controls="false" size="large" style="width: 200px;" />
        </div>
        <div class="setting-row">
          <div class="setting-label">后厨奖金比例(%)</div>
          <el-input-number v-model="backBonusRatio" :precision="0" :controls="false" size="large" style="width: 200px;" />
        </div>
      </div>
      <div class="page-card__footer">
        <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-page {
  min-height: calc(100vh - 60px - 32px);
}
.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.setting-row + .setting-row {
  margin-top: 20px;
}
.setting-label {
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 500;
}
</style>