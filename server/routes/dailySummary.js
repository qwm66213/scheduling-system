const express = require('express');
const router = express.Router();
const http = require('http');
const authMiddleware = require('../middleware/auth');
const config = require('../config');

router.use(authMiddleware);

/**
 * 统一响应格式
 */
function response(status, errmsg, data = null) {
  const result = { status, errmsg };
  if (data !== null) {
    result.data = data;
  }
  return result;
}

// 请求频率限制（防抖）
const requestTimestamps = new Map();
const RATE_LIMIT_WINDOW = 2000; // 2秒内不允许重复请求

function rateLimit(key) {
  const now = Date.now();
  const lastRequest = requestTimestamps.get(key);
  if (lastRequest && now - lastRequest < RATE_LIMIT_WINDOW) {
    return false; // 被限制
  }
  requestTimestamps.set(key, now);
  return true; // 允许请求
}

// OpenAPI 配置
const OPEN_API = {
  token: config.openapi.token,
  userId: config.openapi.userId
};

// 人效标准表
const SETTINGS_TABLE_KEY = 'tb_f78e9d4db7476';
// 考勤记录表
const ATTENDANCE_TABLE_KEY = 'tb_fa58d498f9bcb';
// 营业额 ws_app_key
const REVENUE_WS_APP_KEY = config.revenue.wsAppKey;

// 门店ID到门店名称的映射
const STORE_ID_TO_NAME = config.stores.STORE_ID_TO_NAME;

// 默认值
const DEFAULT_SETTINGS = {
  front_efficiency: 2800,
  back_efficiency: 2200,
  front_bonus_ratio: 0.1,
  back_bonus_ratio: 0.12
};

// 有效出勤状态（√ + 借调 + 存休 + 年假）
const VALID_ATTENDANCE_STATUS = ['√', '存', '年'];
// 无效状态（不计入出勤）
const INVALID_ATTENDANCE_STATUS = ['O', '旷'];

// 判断是否为借调状态（单字且不是预定义状态）
function isSecondment(status) {
  if (!status) return false;
  if (VALID_ATTENDANCE_STATUS.includes(status)) return false;
  if (INVALID_ATTENDANCE_STATUS.includes(status)) return false;
  return status.length === 1;
}

// 调用 OpenAPI
function callOpenAPI(path, postData, method = 'POST') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Bearer ${OPEN_API.token}`,
        'Emoo-User-Id': OPEN_API.userId
      }
    };

    const req = http.request(options, res => {
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => {
        try {
          const buffer = Buffer.concat(chunks);
          const body = buffer.toString('utf8');
          const json = JSON.parse(body);
          if (json.code === 200 && json.data) {
            resolve(json.data);
          } else {
            console.error('[DailySummary] API error:', json.code, json.message);
            resolve(null);
          }
        } catch (e) {
          console.error('[DailySummary] Parse error:', e.message);
          resolve(null);
        }
      });
    });
    req.on('error', e => reject(e));
    req.write(JSON.stringify(postData));
    req.end();
  });
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
    // 解析奖金比例，格式如 "10%" -> 0.1
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

// 获取营业额数据（支持日期范围查询）
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

// 批量获取营业额数据（按日期范围）
async function getActualRevenueByRange(storeId, startDate, endDate) {
  const postData = {
    page_size: 200,
    cursor: '',
    text_format: 'markdown',
    filter_conditions: [[
      { field: 'ws_app.ws_app_key', operator: 'eq', value: REVENUE_WS_APP_KEY },
      { field: 'doc_group.app_group_id', operator: 'eq', value: 'business_summary' },
      { field: '统计日期', operator: 'gte', value: startDate },
      { field: '统计日期', operator: 'lte', value: endDate },
      { field: '门店ID', operator: 'eq', value: String(storeId) }
    ]]
  };

  const result = await callOpenAPI('/open-api/v1/data', postData);
  if (!result || !result.results) return {};

  // 按日期分组
  const dateMap = {};
  for (const item of result.results) {
    if (item.doc_group?.app_group_id !== 'business_summary') continue;
    const date = item.content?.统计日期;
    if (!date) continue;

    if (!dateMap[date]) dateMap[date] = 0;
    const marketDetails = item.content?.市别明细 || [];
    for (const market of marketDetails) {
      dateMap[date] += Number(market.营业额 || 0);
    }
  }
  return dateMap;
}

// 获取当日考勤记录（从考勤 OpenAPI）
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

// 批量获取考勤记录（按日期范围）
async function getAttendanceRecordsByRange(storeName, startDate, endDate) {
  const allResults = [];
  let currentPage = 1;
  const pageSize = 100;

  while (true) {
    const postData = {
      table_key: ATTENDANCE_TABLE_KEY,
      page_size: pageSize,
      current_page: currentPage,
      filters: [`所属门店:eq:${storeName}`, `日期:gte:${startDate}`, `日期:lte:${endDate}`],
      sort: 'created_at:DESC'
    };

    const data = await callOpenAPI('/open-api/v1/data/records/list', postData);
    if (!data || !data.results || data.results.length === 0) break;

    allResults.push(...data.results);
    if (data.results.length < pageSize) break;
    currentPage++;
  }

  // 按日期分组
  const dateMap = {};
  for (const item of allResults) {
    const fields = item.fields || {};
    const date = fields['日期'];
    if (!date) continue;

    if (!dateMap[date]) dateMap[date] = [];
    dateMap[date].push(item);
  }
  return dateMap;
}

// 计算有效出勤人次
function countValidAttendance(records, businessLine) {
  let count = 0;
  for (const item of records) {
    const fields = item.fields || {};
    const workName = fields['工作名'] || '';

    // 筛选业务线：前厅 或 非前厅（后厨）
    const isFront = workName === '前厅';
    if (businessLine === 'front' && !isFront) continue;
    if (businessLine === 'back' && isFront) continue;

    // 统计上午和下午的有效出勤
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

// 计算奖金（增加条件判断，条件不满足返回 null）
function calculateBonus(revenue, attendanceCount, efficiency, bonusRatio) {
  // 营业额必须 > 0
  if (!revenue || revenue <= 0) return null;
  // 出勤人次必须 > 0
  if (!attendanceCount || attendanceCount === 0) return null;
  // 人效标准必须 > 0
  if (!efficiency || efficiency <= 0) return null;
  // 奖金比例必须 > 0
  if (!bonusRatio || bonusRatio <= 0) return null;

  const attendancePeople = attendanceCount / 2;
  const bonus = (revenue - attendancePeople * efficiency) * bonusRatio;
  return Math.round(bonus * 100) / 100;
}

// 获取单个门店的日数据（批量查询优化）
async function getStoreDailyData(storeId, storeName, start_date, end_date) {
  // 检查缓存
  const cacheKey = getCacheKey(storeId, start_date, end_date);
  const cachedData = getFromCache(cacheKey);
  if (cachedData) {
    console.log(`[DailySummary] Returning cached data for store ${storeId}`);
    return cachedData;
  }

  // 获取人效标准和奖金比例
  const settings = await getSettings(storeName);

  // 生成日期列表
  const dates = [];
  const start = new Date(start_date);
  const end = new Date(end_date);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10));
  }

  // 批量查询营业额和考勤数据（只需2次API调用，而不是 30×2=60次）
  const [revenueMap, attendanceMap] = await Promise.all([
    getActualRevenueByRange(storeId, start_date, end_date),
    getAttendanceRecordsByRange(storeName, start_date, end_date)
  ]);

  // 组装结果
  const result = [];
  for (const dateStr of dates) {
    const revenue = revenueMap[dateStr] || 0;
    const records = attendanceMap[dateStr] || [];

    const frontCount = countValidAttendance(records, 'front');
    const backCount = countValidAttendance(records, 'back');
    const frontBonus = calculateBonus(revenue, frontCount, settings.front_efficiency, settings.front_bonus_ratio);
    const backBonus = calculateBonus(revenue, backCount, settings.back_efficiency, settings.back_bonus_ratio);

    result.push({
      date: dateStr,
      actual_revenue: revenue,
      front_check_count: frontCount / 2,
      front_bonus: frontBonus,
      back_check_count: backCount / 2,
      back_bonus: backBonus
    });
  }

  // 设置缓存
  setCache(cacheKey, result);
  return result;
}

// 简单的内存缓存
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存

function getCacheKey(storeId, startDate, endDate) {
  return `${storeId}_${startDate}_${endDate}`;
}

function getFromCache(key) {
  const item = cache.get(key);
  if (item && Date.now() - item.timestamp < CACHE_TTL) {
    return item.data;
  }
  cache.delete(key);
  return null;
}

function setCache(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
}

// GET /api/daily-summary/all?start_date=&end_date= (批量获取所有门店汇总)
router.get('/all', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    if (!start_date || !end_date) {
      return res.status(400).json(response(0, 'start_date and end_date required'));
    }

    // 频率限制检查
    const rateLimitKey = `all_${start_date}_${end_date}`;
    if (!rateLimit(rateLimitKey)) {
      console.log('[DailySummary] Rate limited, returning cached or empty');
      const cachedData = getFromCache(getCacheKey('all', start_date, end_date));
      return res.json(response(1, '获取成功', cachedData || []));
    }

    // 检查缓存
    const cacheKey = getCacheKey('all', start_date, end_date);
    const cachedData = getFromCache(cacheKey);
    if (cachedData) {
      console.log('[DailySummary] Returning cached data');
      return res.json(response(1, '获取成功', cachedData));
    }

    // 控制门店并发数量：每次只并行获取 3 个门店
    const storeIds = Object.keys(STORE_ID_TO_NAME).map(Number);
    const results = [];
    const STORE_CONCURRENCY = 3;

    for (let i = 0; i < storeIds.length; i += STORE_CONCURRENCY) {
      const batchIds = storeIds.slice(i, i + STORE_CONCURRENCY);
      const batchResults = await Promise.all(batchIds.map(storeId => {
        const storeName = STORE_ID_TO_NAME[storeId];
        return getStoreDailyData(storeId, storeName, start_date, end_date).catch(() => []);
      }));
      results.push(...batchResults);
    }

    // 按日期汇总
    const merged = {};
    for (const data of results) {
      for (const row of data) {
        if (!merged[row.date]) {
          merged[row.date] = { date: row.date, actual_revenue: 0, front_check_count: 0, front_bonus: 0, back_check_count: 0, back_bonus: 0 };
        }
        merged[row.date].actual_revenue += row.actual_revenue || 0;
        merged[row.date].front_check_count += row.front_check_count || 0;
        merged[row.date].front_bonus += row.front_bonus || 0;
        merged[row.date].back_check_count += row.back_check_count || 0;
        merged[row.date].back_bonus += row.back_bonus || 0;
      }
    }

    const result = Object.values(merged);
    setCache(cacheKey, result);
    res.json(response(1, '获取成功', result));
  } catch (err) {
    console.error('[DailySummary] /all Error:', err.message);
    res.status(500).json(response(0, err.message));
  }
});

// GET /api/daily-summary?start_date=&end_date=
router.get('/', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    if (!start_date || !end_date) {
      return res.status(400).json(response(0, 'start_date and end_date required'));
    }

    const storeId = req.storeId;
    if (!storeId) {
      return res.json(response(1, '获取成功', []));
    }

    const storeName = STORE_ID_TO_NAME[storeId];
    if (!storeName) {
      return res.json(response(1, '获取成功', []));
    }

    const result = await getStoreDailyData(storeId, storeName, start_date, end_date);
    res.json(response(1, '获取成功', result));
  } catch (err) {
    console.error('[DailySummary] Error:', err.message);
    res.status(500).json(response(0, err.message));
  }
});

// POST /api/daily-summary/generate  { date: '2026-05-13' }
router.post('/generate', async (req, res) => {
  try {
    const { date } = req.body;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json(response(0, 'date format required: YYYY-MM-DD'));
    }

    const storeId = req.storeId;
    if (!storeId) {
      return res.status(400).json(response(0, '缺少门店ID'));
    }

    const storeName = STORE_ID_TO_NAME[storeId];
    if (!storeName) {
      return res.status(400).json(response(0, '无效的门店ID'));
    }

    // 获取人效标准和奖金比例
    const settings = await getSettings(storeName);

    // 并行获取当日营业额和考勤记录
    const [revenue, records] = await Promise.all([
      getActualRevenue(storeId, date),
      getAttendanceRecords(storeName, date)
    ]);

    // 计算有效出勤人次
    const frontCount = countValidAttendance(records, 'front');
    const backCount = countValidAttendance(records, 'back');

    // 计算奖金
    const frontBonus = calculateBonus(revenue, frontCount, settings.front_efficiency, settings.front_bonus_ratio);
    const backBonus = calculateBonus(revenue, backCount, settings.back_efficiency, settings.back_bonus_ratio);

    res.json(response(1, '生成成功', {
      date,
      actual_revenue: revenue,
      front_check_count: frontCount / 2,
      front_bonus: frontBonus,
      back_check_count: backCount / 2,
      back_bonus: backBonus
    }));
  } catch (err) {
    console.error('[DailySummary] Error:', err.message);
    res.status(500).json(response(0, err.message));
  }
});

module.exports = router;
