<script setup>
import { ref, onMounted, computed } from 'vue'
import { getSettings, saveSettings } from '../utils/api'
import { ElMessage } from 'element-plus'

const loading = ref(false)
const saving = ref(false)
const frontEfficiency = ref(2800)
const backEfficiency = ref(2200)

async function loadData() {
  loading.value = true
  try {
    const data = await getSettings()
    frontEfficiency.value = data.front_efficiency
    backEfficiency.value = data.back_efficiency
  } finally {
    loading.value = false
  }
}

async function handleSave() {
  saving.value = true
  try {
    await saveSettings({
      front_efficiency: frontEfficiency.value,
      back_efficiency: backEfficiency.value
    })
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
    <div class="settings-card">
      <div class="settings-title">人效标准设置</div>
      <div class="settings-body">
        <div class="setting-row">
          <div class="setting-label">前厅人效标准</div>
          <el-input-number v-model="frontEfficiency" :min="0" :step="100" :controls="false" size="large" style="width: 200px;" />
        </div>
        <div class="setting-row">
          <div class="setting-label">后厨人效标准</div>
          <el-input-number v-model="backEfficiency" :min="0" :step="100" :controls="false" size="large" style="width: 200px;" />
        </div>
      </div>
      <div class="settings-footer">
        <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-page {
  background: #fff;
  border-radius: 4px;
  min-height: calc(100vh - 60px - 32px);
  padding: 20px;
}
.settings-card {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  overflow: hidden;
  max-width: 500px;
}
.settings-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  padding: 14px 20px;
  border-bottom: 1px solid #ebeef5;
}
.settings-body {
  padding: 24px 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.setting-label {
  font-size: 14px;
  color: #303133;
  font-weight: 500;
}
.settings-footer {
  padding: 14px 20px;
  border-top: 1px solid #ebeef5;
  text-align: right;
}
</style>