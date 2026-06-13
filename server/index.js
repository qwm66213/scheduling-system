const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const config = require('./config');
const { callOpenAPI } = require('./utils/openapi');

const revenueRoutes = require('./routes/revenue-openapi');
const staffRoutes = require('./routes/staff');
const scheduleRoutes = require('./routes/schedule');
const attendanceRoutes = require('./routes/attendance-openapi');
const settingsRoutes = require('./routes/settings');
const dailySummaryRoutes = require('./routes/dailySummary');
const personalSummaryRoutes = require('./routes/personalSummary');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = config.server.port;

app.use(cors());
app.use(express.json());

app.use('/api/revenue', revenueRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/daily-summary', dailySummaryRoutes);
app.use('/api/personal-summary', personalSummaryRoutes);
app.use('/api/auth', authRoutes);

// Serve frontend static files
const distPath = path.join(__dirname, '..', 'dist');
const publicPath = path.join(__dirname, '..', 'public');
app.use(express.static(publicPath));
// Only serve static files from dist if it exists
if (require('fs').existsSync(distPath)) {
  app.use(express.static(distPath));
}
// Catch-all for SPA - must come after all API routes
// Using a regex pattern that doesn't match /api/* paths
app.get(/^\/(?!api\/).*/, (req, res) => {
  const indexPath = path.join(distPath, 'index.html');
  if (require('fs').existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ error: 'Frontend not built. Run npm run build first.' });
  }
});

async function start() {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    scheduleDailySummary();
  });
}

function scheduleDailySummary() {
  // 启动时补生成昨天的数据
  generateYesterday();

  // 每分钟检查是否到了9点，触发前一天数据生成
  setInterval(() => {
    const now = new Date();
    if (now.getHours() === 9 && now.getMinutes() === 0) {
      generateYesterday();
    }
    // 9:30 发送企业微信通知
    if (now.getHours() === 9 && now.getMinutes() === 30) {
      sendDailyNotification();
    }
  }, 60000);
}

async function generateYesterday() {
  // 数据改为实时计算，不再存储，仅记录日志
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().slice(0, 10);
  console.log(`[Summary] Daily data for ${dateStr} will be calculated on-demand (real-time)`);
}

// =====================
// OpenAPI 配置（每日通知用）
// =====================
const OPEN_API = {
  token: config.openapi.token,
  userId: config.openapi.userId
};

const SETTINGS_TABLE_KEY = 'tb_f78e9d4db7476';
const ATTENDANCE_TABLE_KEY = 'tb_fa58d498f9bcb';
const STAFF_TABLE_KEY = 'tb_b6d4799a5697f';
const REVENUE_WS_APP_KEY = config.revenue.wsAppKey;

const STORE_ID_TO_NAME = config.stores.STORE_ID_TO_NAME;
const STORE_IDS = config.stores.STORE_IDS;

const DEFAULT_SETTINGS = {
  front_efficiency: 2800,
  back_efficiency: 2200,
  front_bonus_ratio: 0.1,
  back_bonus_ratio: 0.12
};

const VALID_ATTENDANCE_STATUS = ['√', '存', '年'];
const INVALID_ATTENDANCE_STATUS = ['O', '旷'];

function isSecondment(status) {
  if (!status) return false;
  if (VALID_ATTENDANCE_STATUS.includes(status)) return false;
  if (INVALID_ATTENDANCE_STATUS.includes(status)) return false;
  return status.length === 1;
}

// 获取人效标准和奖金比例
async function getSettings(storeName) {
  const title = `人效标准_${storeName}`;
  const postData = {
    table_key: SETTINGS_TABLE_KEY,
    page_size: 1,
    current_page: 1,
    filters: [`标题:eq:${title}`]
  };
  const data = await callOpenAPI('/open-api/v1/data/records/list', postData);
  if (data && data.results && data.results.length > 0) {
    const fields = data.results[0].fields || {};
    const parseRatio = (val) => {
      if (!val) return null;
      const str = String(val).replace('%', '');
      const num = parseFloat(str);
      return isNaN(num) ? null : num / 100;
    };
    return {
      front_efficiency: fields['前厅人效标准'] || DEFAULT_SETTINGS.front_efficiency,
      back_efficiency: fields['后厨人效标准'] || DEFAULT_SETTINGS.back_efficiency,
      front_bonus_ratio: parseRatio(fields['前厅奖金比例']) || DEFAULT_SETTINGS.front_bonus_ratio,
      back_bonus_ratio: parseRatio(fields['后厨奖金比例']) || DEFAULT_SETTINGS.back_bonus_ratio
    };
  }
  return DEFAULT_SETTINGS;
}

// 获取当日实收营业额
async function getActualRevenue(storeId, date) {
  const postData = {
    page_size: 200,
    cursor: '',
    text_format: 'markdown',
    filter_conditions: [[
      { field: 'ws_app.ws_app_key', operator: 'eq', value: REVENUE_WS_APP_KEY },
      { field: 'doc_group.app_group_id', operator: 'eq', value: 'business_summary' },
      { field: '统计日期', operator: 'eq', value: date },
      { field: '门店ID', operator: 'eq', value: String(storeId) }
    ]]
  };

  const result = await callOpenAPI('/open-api/v1/data', postData);
  if (!result || !result.results) return 0;

  let totalRevenue = 0;
  for (const item of result.results) {
    if (item.doc_group?.app_group_id !== 'business_summary') continue;
    const marketDetails = item.content?.市别明细 || [];
    for (const market of marketDetails) {
      totalRevenue += Number(market.营业额 || 0);
    }
  }
  return totalRevenue;
}

// 获取当日考勤记录
async function getAttendanceRecords(storeName, date) {
  const allResults = [];
  let currentPage = 1;
  const pageSize = 100;

  while (true) {
    const postData = {
      table_key: ATTENDANCE_TABLE_KEY,
      page_size: pageSize,
      current_page: currentPage,
      filters: [`所属门店:eq:${storeName}`, `日期:eq:${date}`],
      sort: 'created_at:DESC'
    };

    const data = await callOpenAPI('/open-api/v1/data/records/list', postData);
    if (!data || !data.results || data.results.length === 0) break;

    allResults.push(...data.results);
    if (data.results.length < pageSize) break;
    currentPage++;
  }

  return allResults;
}

// 获取员工列表
async function getEmployees(storeName) {
  const allResults = [];
  let currentPage = 1;
  const pageSize = 100;

  while (true) {
    const postData = {
      table_key: STAFF_TABLE_KEY,
      page_size: pageSize,
      current_page: currentPage,
      filters: [`所属门店:eq:${storeName}`],
      sort: 'created_at:DESC'
    };

    const data = await callOpenAPI('/open-api/v1/data/records/list', postData);
    if (!data || !data.results || data.results.length === 0) break;

    allResults.push(...data.results);
    if (data.results.length < pageSize) break;
    currentPage++;
  }

  return allResults.map(item => ({
    employee_id: item.fields?.['员工编码'] || '',
    name: item.fields?.['姓名'] || '',
    business_line: item.fields?.['工作名'] || '',
    position: item.fields?.['岗位'] || ''
  }));
}

// 计算有效出勤人次（按业务线）
function countValidAttendance(records, businessLine) {
  let count = 0;
  for (const item of records) {
    const fields = item.fields || {};
    const workName = fields['工作名'] || '';

    const isFront = workName === '前厅';
    if (businessLine === 'front' && !isFront) continue;
    if (businessLine === 'back' && isFront) continue;

    const amStatus = fields['上午出勤状态'] || '';
    const pmStatus = fields['下午出勤状态'] || '';

    if (VALID_ATTENDANCE_STATUS.includes(amStatus) || isSecondment(amStatus)) {
      count++;
    }
    if (VALID_ATTENDANCE_STATUS.includes(pmStatus) || isSecondment(pmStatus)) {
      count++;
    }
  }
  return count;
}

// 计算员工有效出勤人次
function getEmployeeAttendanceCount(record) {
  const fields = record.fields || {};
  let count = 0;

  const amStatus = fields['上午出勤状态'] || '';
  const pmStatus = fields['下午出勤状态'] || '';

  if (VALID_ATTENDANCE_STATUS.includes(amStatus) || isSecondment(amStatus)) {
    count++;
  }
  if (VALID_ATTENDANCE_STATUS.includes(pmStatus) || isSecondment(pmStatus)) {
    count++;
  }

  return count;
}

// 计算奖金
function calculateBonus(revenue, attendanceCount, efficiency, bonusRatio) {
  if (!revenue || revenue <= 0) return null;
  if (!attendanceCount || attendanceCount === 0) return null;
  if (!efficiency || efficiency <= 0) return null;
  if (!bonusRatio || bonusRatio <= 0) return null;

  const attendancePeople = attendanceCount / 2;
  const bonus = (revenue - attendancePeople * efficiency) * bonusRatio;
  return Math.round(bonus * 100) / 100;
}

// 计算单个门店的日数据
async function calculateStoreDailyData(storeId, date) {
  const storeName = STORE_ID_TO_NAME[storeId];
  if (!storeName) return null;

  const [settings, revenue, records] = await Promise.all([
    getSettings(storeName),
    getActualRevenue(storeId, date),
    getAttendanceRecords(storeName, date)
  ]);

  const frontCount = countValidAttendance(records, 'front');
  const backCount = countValidAttendance(records, 'back');

  const frontBonus = calculateBonus(revenue, frontCount, settings.front_efficiency, settings.front_bonus_ratio);
  const backBonus = calculateBonus(revenue, backCount, settings.back_efficiency, settings.back_bonus_ratio);

  // 按员工统计
  const employeeAttendanceMap = {};
  for (const record of records) {
    const fields = record.fields || {};
    const employeeId = fields['员工编码'] || '';
    const workName = fields['工作名'] || '';
    const isFront = workName === '前厅';

    const count = getEmployeeAttendanceCount(record);
    if (count > 0) {
      if (!employeeAttendanceMap[employeeId]) {
        employeeAttendanceMap[employeeId] = {
          name: fields['姓名'] || '',
          business_line: workName,
          count: 0
        };
      }
      employeeAttendanceMap[employeeId].count += count;
    }
  }

  const frontPeople = frontCount / 2;
  const backPeople = backCount / 2;
  const frontPersonalBonus = frontBonus !== null && frontPeople > 0 ? Math.round(frontBonus / frontPeople * 100) / 100 : null;
  const backPersonalBonus = backBonus !== null && backPeople > 0 ? Math.round(backBonus / backPeople * 100) / 100 : null;

  const personalData = [];
  for (const [employeeId, info] of Object.entries(employeeAttendanceMap)) {
    const isFront = info.business_line === '前厅';
    const personalBonus = isFront ? frontPersonalBonus : backPersonalBonus;
    personalData.push({
      employee_name: info.name,
      front_check_count: isFront ? info.count / 2 : 0,
      back_check_count: isFront ? 0 : info.count / 2,
      bonus: personalBonus
    });
  }

  return {
    storeId,
    storeName,
    revenue,
    front_check_count: frontCount / 2,
    front_bonus: frontBonus,
    back_check_count: backCount / 2,
    back_bonus: backBonus,
    personalData
  };
}

const WEBHOOK_URL = config.webhook.url;

async function sendDailyNotification() {
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().slice(0, 10);

    // 并行计算所有门店数据
    const storeDataPromises = STORE_IDS.map(storeId => calculateStoreDailyData(storeId, dateStr));
    const allStoreData = await Promise.all(storeDataPromises);

    // 过滤掉无效数据
    const validStoreData = allStoreData.filter(d => d !== null);

    if (validStoreData.length === 0) {
      console.log(`[Webhook] No data for ${dateStr}, skip notification`);
      return;
    }

    // 计算全部门店汇总
    const totalRevenue = validStoreData.reduce((sum, d) => sum + d.revenue, 0);
    const totalFrontCheck = validStoreData.reduce((sum, d) => sum + d.front_check_count, 0);
    const totalBackCheck = validStoreData.reduce((sum, d) => sum + d.back_check_count, 0);
    const totalFrontBonus = validStoreData.reduce((sum, d) => sum + (d.front_bonus || 0), 0);
    const totalBackBonus = validStoreData.reduce((sum, d) => sum + (d.back_bonus || 0), 0);

    // 聚合所有门店的个人数据
    const allPersonalData = [];
    for (const store of validStoreData) {
      for (const p of store.personalData) {
        allPersonalData.push({
          ...p,
          storeName: store.storeName
        });
      }
    }

    // 构建消息
    let md = `## 📊 每日经营数据报表（${dateStr}）\n\n`;

    // 全部门店汇总
    md += `### 全部门店汇总\n`;
    md += `> 实收营业额：**¥${Number(totalRevenue).toLocaleString()}**\n`;
    md += `> 前厅出勤：**${totalFrontCheck}人**  奖金：**¥${Number(totalFrontBonus).toLocaleString()}**\n`;
    md += `> 后厨出勤：**${totalBackCheck}人**  奖金：**¥${Number(totalBackBonus).toLocaleString()}**\n`;

    // 各门店明细
    md += `\n### 各门店明细\n`;
    for (const store of validStoreData) {
      md += `\n**${store.storeName}**\n`;
      md += `> 实收：¥${Number(store.revenue).toLocaleString()}  前厅：${store.front_check_count}人  后厨：${store.back_check_count}人\n`;
      md += `> 前厅奖金：¥${Number(store.front_bonus || 0).toLocaleString()}  后厨奖金：¥${Number(store.back_bonus || 0).toLocaleString()}\n`;
    }

    // 个人数据（按前厅/后厨分组）
    const frontStaff = allPersonalData.filter(p => p.front_check_count > 0);
    const backStaff = allPersonalData.filter(p => p.back_check_count > 0);

    if (frontStaff.length > 0) {
      md += `\n### 前厅出勤人员（${frontStaff.length}人）\n`;
      for (const p of frontStaff) {
        const bonusStr = p.bonus !== null ? `¥${Number(p.bonus).toLocaleString()}` : '-';
        md += `> ${p.employee_name}（${p.storeName}）：出勤${p.front_check_count}人天  奖金：**${bonusStr}**\n`;
      }
    }

    if (backStaff.length > 0) {
      md += `\n### 后厨出勤人员（${backStaff.length}人）\n`;
      for (const p of backStaff) {
        const bonusStr = p.bonus !== null ? `¥${Number(p.bonus).toLocaleString()}` : '-';
        md += `> ${p.employee_name}（${p.storeName}）：出勤${p.back_check_count}人天  奖金：**${bonusStr}**\n`;
      }
    }

    // 发送企业微信 webhook
    const axios = require('axios');
    await axios.post(WEBHOOK_URL, {
      msgtype: 'markdown',
      markdown: { content: md }
    });

    console.log(`[Webhook] Sent daily notification for ${dateStr}`);
  } catch (err) {
    console.error('[Webhook] Send failed:', err.message);
  }
}

start();