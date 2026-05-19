<script setup>
import { ref, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import api from '../utils/api'
import { useStore } from '../composables/useStore'

const user = computed(() => JSON.parse(localStorage.getItem('user') || '{}'))
const isSuperAdmin = computed(() => user.value.role === 'admin')

const { STORES, STORE_ID_LIST } = useStore()

const users = ref([])
const dialogVisible = ref(false)
const editId = ref(null)
const form = ref({ username: '', password: '', role: 'manager', store_id: '' })

async function loadUsers() {
  try {
    const res = await api.get('/auth/users')
    users.value = res.data || []
  } catch (e) {
    console.error('加载用户列表失败:', e)
    ElMessage.error('加载用户列表失败')
  }
}

function openAdd() {
  editId.value = null
  form.value = { username: '', password: '', role: 'manager', store_id: null }
  dialogVisible.value = true
}

function openEdit(row) {
  editId.value = row.id
  form.value = { username: row.username, password: '', role: row.role, store_id: row.store_id || '' }
  dialogVisible.value = true
}

async function handleSaveUser() {
  if (!form.value.username || (!editId.value && !form.value.password) || !form.value.store_id) {
    ElMessage.warning('请填写必填项')
    return
  }
  try {
    if (editId.value) {
      await api.put(`/auth/users/${editId.value}`, form.value)
    } else {
      await api.post('/auth/users', form.value)
    }
    ElMessage.success('保存成功')
    dialogVisible.value = false
    loadUsers()
  } catch (e) {
    ElMessage.error(e.response?.data?.error || '保存失败')
  }
}

async function toggleStatus(row) {
  try {
    await api.put(`/auth/users/${row.id}`, { ...row, is_active: row.is_active ? 0 : 1 })
    ElMessage.success('操作成功')
    loadUsers()
  } catch {
    ElMessage.error('操作失败')
  }
}

async function deleteUser(row) {
  try {
    await api.delete(`/auth/users/${row.id}`)
    ElMessage.success('删除成功')
    loadUsers()
  } catch {
    ElMessage.error('删除失败')
  }
}

function getStoreName(storeId) {
  return STORES[storeId] || '-'
}

onMounted(() => {
  if (isSuperAdmin.value) loadUsers()
})
</script>

<template>
  <div class="accounts-page">
    <div class="accounts-card" v-if="isSuperAdmin">
      <div class="accounts-title">
        <span>账号管理</span>
        <el-button type="primary" @click="openAdd">新增账号</el-button>
      </div>
      <el-table :data="users" style="width: 100%">
        <el-table-column prop="username" label="账号" />
        <el-table-column label="门店">
          <template #default="{ row }">
            {{ row.role === 'admin' ? '全部' : getStoreName(row.store_id) }}
          </template>
        </el-table-column>
        <el-table-column prop="role" label="角色">
          <template #default="{ row }">
            {{ row.role === 'admin' ? '超级管理员' : '系统管理员' }}
          </template>
        </el-table-column>
        <el-table-column prop="is_active" label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.is_active ? 'success' : 'info'" size="small">{{ row.is_active ? '启用' : '禁用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180">
          <template #default="{ row }">
            <template v-if="row.role === 'admin'">
              <el-tag type="info" size="small">系统账号</el-tag>
            </template>
            <template v-else>
              <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
              <el-button link :type="row.is_active ? 'warning' : 'success'" size="small" @click="toggleStatus(row)">
                {{ row.is_active ? '禁用' : '启用' }}
              </el-button>
              <el-button link type="danger" size="small" @click="deleteUser(row)">删除</el-button>
            </template>
          </template>
        </el-table-column>
        <template #empty>
          <div class="empty-tip">
            <p>暂无其他账号</p>
          </div>
        </template>
      </el-table>
    </div>
    <div v-else class="no-permission">
      <p>无权限访问此页面</p>
    </div>
  </div>

  <el-dialog v-model="dialogVisible" title="账号" width="400px">
    <el-form label-width="80px">
      <el-form-item label="账号" required>
        <el-input v-model="form.username" :disabled="!!editId" />
      </el-form-item>
      <el-form-item label="密码" :required="!editId">
        <el-input v-model="form.password" type="password" :placeholder="editId ? '留空则不修改' : ''" />
      </el-form-item>
      <el-form-item label="门店" required>
        <el-select v-model="form.store_id" placeholder="请选择门店" style="width: 100%">
          <el-option v-for="id in STORE_ID_LIST" :key="id" :label="STORES[id]" :value="id" />
        </el-select>
      </el-form-item>
      <el-form-item label="角色">
        <el-select v-model="form.role" style="width: 100%">
          <el-option label="系统管理员" value="manager" />
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" @click="handleSaveUser">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.accounts-page {
  background: #fff;
  border-radius: 4px;
  min-height: calc(100vh - 60px - 32px);
  padding: 16px;
}
.accounts-card {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  overflow: hidden;
}
.accounts-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  padding: 12px 16px;
  border-bottom: 1px solid #ebeef5;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.no-permission {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 300px;
  color: #909399;
}
</style>