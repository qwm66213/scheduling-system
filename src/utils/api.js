import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000
})

// 请求拦截器：添加 Token
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`
  }
  return config
})

// 响应拦截器：处理未登录和 Token 过期
api.interceptors.response.use(
  response => {
    // 统一提取后端返回的 data 字段
    if (response.data && response.data.status === 1) {
      return response.data
    }
    return response.data
  },
  async error => {
    const originalRequest = error.config

    // 如果是 401 且有 refreshToken，尝试刷新 Token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      const refreshToken = localStorage.getItem('refreshToken')
      if (refreshToken) {
        try {
          const res = await fetch('/api/auth/refresh-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken })
          })

          const data = await res.json()
          if (data.status === 1) {
            localStorage.setItem('token', data.data.token)
            localStorage.setItem('refreshToken', data.data.refreshToken)

            // 重试原请求
            originalRequest.headers['Authorization'] = `Bearer ${data.data.token}`
            return api(originalRequest)
          }
        } catch (err) {
          console.error('Token refresh failed:', err)
        }
      }
    }

    // 刷新失败或没有 refreshToken，跳转登录页
    if (error.response?.status === 401) {
      localStorage.removeItem('user')
      localStorage.removeItem('token')
      localStorage.removeItem('refreshToken')
      window.location.href = '/login.html'
    }

    return Promise.reject(error)
  }
)

// Revenue
export const getRevenue = (params) => api.get('/revenue', { params }).then(r => r.data)
export const saveRevenue = (data) => api.post('/revenue', data).then(r => r.data)
export const updateRevenue = (id, data) => api.put(`/revenue/${id}`, data).then(r => r.data)

// Staff
export const getStaff = (params) => api.get('/staff', { params }).then(r => r.data)

// Schedule / 预排班
export const getSchedule = (params) => api.get('/schedule', { params }).then(r => r.data)
export const batchSaveSchedule = (records) => api.post('/schedule/batch', { records }).then(r => r.data)
export const getScheduleSummary = (params) => api.get('/schedule/summary', { params }).then(r => r.data)

// Attendance / 考勤记录
export const getAttendance = (params) => api.get('/attendance', { params }).then(r => r.data)
export const batchSaveAttendance = (records) => api.post('/attendance/batch', { records }).then(r => r.data)
export const getAttendanceSummary = (params) => api.get('/attendance/summary', { params }).then(r => r.data)

// Settings
export const getSettings = (params) => api.get('/settings', { params }).then(r => r.data)
export const saveSettings = (data, params) => api.put('/settings', data, { params })

// Daily Summary
export const getDailySummary = (params) => api.get('/daily-summary', { params }).then(r => r.data)
export const getDailySummaryAll = (params) => api.get('/daily-summary/all', { params }).then(r => r.data)
export const generateDailySummary = (date) => api.post('/daily-summary/generate', { date }).then(r => r.data)

// Personal Summary
export const getPersonalSummary = (params) => api.get('/personal-summary', { params }).then(r => r.data)
export const generatePersonalSummary = (date) => api.post('/personal-summary/generate', { date }).then(r => r.data)

// Auth
export const changePassword = (data) => api.post('/auth/change-password', data).then(r => r.data)

export default api
