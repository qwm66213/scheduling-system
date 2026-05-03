<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { getStaff, addStaff, updateStaff, deleteStaff } from '../utils/api'

const tableData = ref([])
const loading = ref(false)
const dialogVisible = ref(false)
const dialogTitle = ref('新增员工')
const editingId = ref(null)
const activeTab = ref('后厨')
const searchName = ref('')
const filterPosition = ref('')
const tableHeight = ref(400)
const tableWrapRef = ref(null)

const backPositions = ['厨师长', '副厨', '第一炉灶', '第二炉灶', '第三炉灶', '第四炉灶', '第五炉灶', '第六炉灶', '冷菜主管', '冷菜', '蒸箱', '点心师傅', '切配主管', '切配', '海鲜师傅', '打荷', '洗碗洗菜', '寒暑假工', '小时工']
const frontPositions = ['店长', '前厅经理', '前厅主管', '收银', '金牌师傅', '迎宾', '服务员', '外卖', '保洁', '小时工']

const backRank = Object.fromEntries(backPositions.map((p, i) => [p, i]))
const frontRank = Object.fromEntries(frontPositions.map((p, i) => [p, i]))

const form = ref(getEmptyForm())
const formRef = ref(null)

const formRules = {
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  business_line: [{ required: true, message: '请选择业务线', trigger: 'change' }],
  position: [{ required: true, message: '请选择岗位', trigger: 'change' }],
  employment_type: [{ required: true, message: '请选择用工类型', trigger: 'change' }],
  monthly_salary: [{ required: true, message: '请输入月薪', trigger: 'blur' }]
}

function getEmptyForm() {
  return {
    name: '',
    employment_status: '在职',
    business_line: activeTab.value,
    position: '',
    monthly_salary: 0,
    daily_salary: 0,
    employment_type: '全职',
    secondment_status: 0
  }
}

function currentPositions() {
  const rank = activeTab.value === '后厨' ? backRank : frontRank
  const positions = [...new Set(tableData.value.filter(r => r.business_line === activeTab.value).map(r => r.position))]
  positions.sort((a, b) => (rank[a] ?? 999) - (rank[b] ?? 999))
  return positions
}

const filteredData = computed(() => {
  const rank = activeTab.value === '后厨' ? backRank : frontRank
  const list = tableData.value.filter(r => {
    if (r.business_line !== activeTab.value) return false
    if (searchName.value && !r.name.includes(searchName.value)) return false
    if (filterPosition.value && r.position !== filterPosition.value) return false
    return true
  })
  list.sort((a, b) => (rank[a.position] ?? 999) - (rank[b.position] ?? 999))
  return list
})

function onSalaryChange() {
  if (form.value.monthly_salary > 0) {
    form.value.daily_salary = Math.round(form.value.monthly_salary / 26 * 100) / 100
  }
}

function calcTableHeight() {
  nextTick(() => {
    const wrap = tableWrapRef.value
    if (!wrap) return
    const rect = wrap.getBoundingClientRect()
    tableHeight.value = Math.max(200, window.innerHeight - rect.top - 20)
  })
}

async function loadData() {
  loading.value = true
  try {
    tableData.value = await getStaff({})
  } finally {
    loading.value = false
    calcTableHeight()
  }
}

function onTabChange() {
  searchName.value = ''
  filterPosition.value = ''
  calcTableHeight()
}

function openAdd() {
  editingId.value = null
  dialogTitle.value = '新增员工'
  form.value = getEmptyForm()
  form.value.business_line = activeTab.value
  dialogVisible.value = true
}

function openEdit(row) {
  editingId.value = row.id
  dialogTitle.value = '编辑员工'
  form.value = {
    name: row.name,
    employment_status: row.employment_status,
    business_line: row.business_line || '',
    position: row.position || '',
    monthly_salary: Number(row.monthly_salary) || 0,
    daily_salary: Number(row.daily_salary) || 0,
    employment_type: row.employment_type || '全职',
    secondment_status: row.secondment_status || 0
  }
  dialogVisible.value = true
}

async function handleSave() {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
  } catch {
    return
  }
  if (editingId.value) {
    await updateStaff(editingId.value, form.value)
  } else {
    await addStaff(form.value)
  }
  dialogVisible.value = false
  loadData()
}

async function handleDelete(row) {
  await deleteStaff(row.id)
  loadData()
}

async function toggleStatus(row) {
  await updateStaff(row.id, {
    ...row,
    employment_status: row.employment_status === '在职' ? '离职' : '在职',
    monthly_salary: Number(row.monthly_salary) || 0,
    daily_salary: Number(row.daily_salary) || 0,
    secondment_status: row.secondment_status || 0
  })
  loadData()
}

function fmt(n) {
  return Number(n).toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function onResize() {
  calcTableHeight()
}

onMounted(() => {
  loadData()
  window.addEventListener('resize', onResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', onResize)
})
</script>

<template>
  <div class="staff-page">
    <el-card shadow="hover">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: bold; font-size: 16px;">员工管理</span>
          <el-button type="primary" @click="openAdd">
            <el-icon><Plus /></el-icon> 新增员工
          </el-button>
        </div>
      </template>

      <!-- Tab 切换 -->
      <el-tabs v-model="activeTab" @tab-change="onTabChange">
        <el-tab-pane label="后厨" name="后厨" />
        <el-tab-pane label="前厅" name="前厅" />
      </el-tabs>

      <!-- 筛选栏 -->
      <div style="display: flex; gap: 10px; margin-bottom: 12px;">
        <el-input v-model="searchName" placeholder="搜索姓名" clearable style="width: 160px;" :prefix-icon="'Search'" />
        <el-select v-model="filterPosition" placeholder="筛选岗位" clearable style="width: 140px;">
          <el-option v-for="p in currentPositions()" :key="p" :label="p" :value="p" />
        </el-select>
      </div>

      <!-- 表格 -->
      <div ref="tableWrapRef">
        <el-table :data="filteredData" v-loading="loading" stripe border :height="tableHeight" style="width: 100%;">
          <el-table-column prop="name" label="姓名" width="120">
            <template #default="{ row }">
              {{ row.name }}
              <el-tag v-if="row.secondment_status" type="danger" size="small" style="margin-left: 4px;">借调</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="position" label="岗位" width="120" />
          <el-table-column prop="employment_type" label="用工" width="70" align="center">
            <template #default="{ row }">
              <span :style="{ color: row.employment_type === '临时' ? '#e6a23c' : '#606266' }">{{ row.employment_type }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="monthly_salary" label="月薪" width="100" align="right">
            <template #default="{ row }">¥{{ fmt(row.monthly_salary) }}</template>
          </el-table-column>
          <el-table-column prop="employment_status" label="状态" width="80" align="center">
            <template #default="{ row }">
              <el-tag :type="row.employment_status === '在职' ? 'success' : 'info'" size="small">{{ row.employment_status }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="200" fixed="right">
            <template #default="{ row }">
              <el-button type="primary" link size="small" @click="openEdit(row)">编辑</el-button>
              <el-button :type="row.employment_status === '在职' ? 'warning' : 'success'" link size="small" @click="toggleStatus(row)">
                {{ row.employment_status === '在职' ? '离职' : '在职' }}
              </el-button>
              <el-popconfirm :title="'确定删除 ' + row.name + ' 的全部信息？'" @confirm="handleDelete(row)">
                <template #reference>
                  <el-button type="danger" link size="small">删除</el-button>
                </template>
              </el-popconfirm>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-card>

    <!-- 新增/编辑弹窗 -->
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="500px">
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="80px">
        <el-form-item label="姓名" prop="name">
          <el-input v-model="form.name" placeholder="请输入姓名" />
        </el-form-item>
        <el-form-item label="业务线" prop="business_line">
          <el-select v-model="form.business_line" style="width: 100%;" @change="form.position = ''">
            <el-option label="后厨" value="后厨" />
            <el-option label="前厅" value="前厅" />
          </el-select>
        </el-form-item>
        <el-form-item label="岗位" prop="position">
          <el-select v-model="form.position" placeholder="选择岗位" style="width: 100%;" filterable allow-create>
            <el-option v-for="p in (form.business_line === '后厨' ? backPositions : frontPositions)" :key="p" :label="p" :value="p" />
          </el-select>
        </el-form-item>
        <el-form-item label="用工类型" prop="employment_type">
          <el-radio-group v-model="form.employment_type">
            <el-radio value="全职">全职</el-radio>
            <el-radio value="兼职">兼职</el-radio>
            <el-radio value="临时">临时</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="月薪" prop="monthly_salary">
          <el-input v-model="form.monthly_salary" placeholder="请输入月薪" style="width: 100%;">
            <template #prepend>¥</template>
          </el-input>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.staff-page {
  height: calc(100vh - 60px - 32px);
  overflow: hidden;
}
</style>
