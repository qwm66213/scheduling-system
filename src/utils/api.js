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

// Dashboard
export const getDashboardSummary = (params) => api.get('/dashboard/summary', { params }).then(r => r.data)

// Settings
export const getSettings = () => api.get('/settings').then(r => r.data)
export const saveSettings = (data) => api.put('/settings', data).then(r => r.data)

// Daily Summary
export const getDailySummary = (params) => api.get('/daily-summary', { params }).then(r => r.data)
export const generateDailySummary = (date) => api.post('/daily-summary/generate', { date }).then(r => r.data)

// Personal Summary
export const getPersonalSummary = (params) => api.get('/personal-summary', { params }).then(r => r.data)
export const generatePersonalSummary = (date) => api.post('/personal-summary/generate', { date }).then(r => r.data)

export default api
