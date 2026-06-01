import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/', redirect: '/revenue' },
  { path: '/revenue', name: 'Revenue', component: () => import('../views/Revenue.vue'), meta: { title: '营业额管理' } },
  { path: '/schedule', name: 'Schedule', component: () => import('../views/Schedule.vue'), meta: { title: '预排班', allowAllStores: false } },
  { path: '/attendance', name: 'Attendance', component: () => import('../views/Attendance.vue'), meta: { title: '考勤记录', allowAllStores: false } },
  { path: '/staff', name: 'Staff', component: () => import('../views/Staff.vue'), meta: { title: '员工管理' } },
  { path: '/accounts', name: 'Accounts', component: () => import('../views/Accounts.vue'), meta: { title: '账号管理' } },
  { path: '/settings', name: 'Settings', component: () => import('../views/Settings.vue'), meta: { title: '设置' } },
  { path: '/daily-summary', name: 'DailySummary', component: () => import('../views/DailySummary.vue'), meta: { title: '每日奖金汇总' } },
  { path: '/personal-summary', name: 'PersonalSummary', component: () => import('../views/PersonalSummary.vue'), meta: { title: '个人奖金明细', allowAllStores: false } },
  { path: '/:pathMatch(.*)*', redirect: '/revenue' },
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
