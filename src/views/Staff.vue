<script setup>
import { ref, onMounted, watch } from 'vue'
import { getStaff } from '../utils/api'
import { useStore } from '../composables/useStore'

const { selectedStoreId, getStoreId } = useStore()

const tableData = ref([])
const loading = ref(false)

async function loadData() {
  loading.value = true
  try {
    const params = {}
    const storeId = getStoreId()
    if (storeId) params.store_id = storeId
    tableData.value = await getStaff(params)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadData()
})

watch(selectedStoreId, () => {
  loadData()
})
</script>

<template>
  <div class="staff-page">
    <el-table :data="tableData" v-loading="loading" stripe border style="width: 100%;">
      <el-table-column prop="store" label="所属门店" min-width="120" />
      <el-table-column prop="name" label="姓名" min-width="100" />
      <el-table-column prop="position" label="岗位" min-width="100" />
      <el-table-column prop="workName" label="工作名" min-width="100" />
    </el-table>
  </div>
</template>

<style scoped>
.staff-page {
  background: #fff;
  border-radius: 4px;
  padding: 16px;
}
</style>