import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/', name: 'Dashboard', component: () => import('../views/Dashboard.vue'), meta: { title: '仪表盘' } },
  { path: '/revenue', name: 'Revenue', component: () => import('../views/Revenue.vue'), meta: { title: '营业额管理' } },
  { path: '/schedule', name: 'Schedule', component: () => import('../views/Schedule.vue'), meta: { title: '排班表' } },
  { path: '/attendance', name: 'Attendance', component: () => import('../views/Attendance.vue'), meta: { title: '考勤记录' } },
  { path: '/staff', name: 'Staff', component: () => import('../views/Staff.vue'), meta: { title: '员工管理' } },
  { path: '/config', name: 'Config', component: () => import('../views/Config.vue'), meta: { title: '规则配置' } },
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
