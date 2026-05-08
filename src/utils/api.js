import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000
})

// Revenue
export const getRevenue = (params) => api.get('/revenue', { params }).then(r => r.data)
export const saveRevenue = (data) => api.post('/revenue', data).then(r => r.data)
export const updateRevenue = (id, data) => api.put(`/revenue/${id}`, data).then(r => r.data)
export const deleteRevenue = (id) => api.delete(`/revenue/${id}`).then(r => r.data)
export const batchImportRevenue = (records) => api.post('/revenue/batch', { records }).then(r => r.data)

// Staff
export const getStaff = (params) => api.get('/staff', { params }).then(r => r.data)
export const addStaff = (data) => api.post('/staff', data).then(r => r.data)
export const updateStaff = (id, data) => api.put(`/staff/${id}`, data).then(r => r.data)
export const deleteStaff = (id) => api.delete(`/staff/${id}`).then(r => r.data)

// Schedule / Attendance
export const getAttendance = (params) => api.get('/schedule', { params }).then(r => r.data)
export const initAttendance = (data) => api.post('/schedule/init', data).then(r => r.data)
export const batchSaveAttendance = (records) => api.post('/schedule/batch', { records }).then(r => r.data)
export const getAttendanceSummary = (params) => api.get('/schedule/summary', { params }).then(r => r.data)

// Config
export const getConfig = () => api.get('/config').then(r => r.data)
export const updateConfig = (key, value) => api.put(`/config/${key}`, { value }).then(r => r.data)
export const resetConfig = () => api.post('/config/reset').then(r => r.data)

// Dashboard
export const getDashboardSummary = (params) => api.get('/dashboard/summary', { params }).then(r => r.data)

export default api
