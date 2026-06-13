const express = require('express');
const router = express.Router();
const http = require('http');
const authMiddleware = require('../middleware/auth');
const config = require('../config');
const { callOpenAPI } = require('../utils/openapi');

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

// 简单的内存缓存
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存

function getCacheKey(prefix, params) {
  return `${prefix}_${JSON.stringify(params)}`;
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

// 排班表配置
const SCHEDULE_API = {
  tableKey: 'tb_58c08b4f443af'
};

// 门店ID到门店名称的映射
const STORE_ID_TO_NAME = config.stores.STORE_ID_TO_NAME;

// 门店名称到缩写的映射
const STORE_NAME_TO_ABBREV = {
  '930殷高店': '殷',
  '930长江西路店': '长',
  '930国和店': '国',
  '930宜川店': '宜',
  '930小馆拾光里店': '江',
  '930浦锦路店': '浦',
  '930金沙江店': '金',
  '930车站南路店': '凉',
  '930中华路店': '中',
  '930柳营路店': '柳',
  '930长阳店': '阳'
};

// 查询 OpenAPI 是否存在指定记录（按标题查询）
async function findExistingRecord(title) {
  const postData = {
    table_key: SCHEDULE_API.tableKey,
    page_size: 1,
    current_page: 1,
    filters: [`标题:eq:${title}`]
  };
  const data = await callOpenAPI('/open-api/v1/data/records/list', postData);
  if (data && data.results && data.results.length > 0) {
    return data.results[0];
  }
  return null;
}

// GET 预排班记录
router.get('/', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    console.log('[Schedule] Query params:', { start_date, end_date, store_id: req.query.store_id, reqStoreId: req.storeId });

    if (!start_date || !end_date) {
      return res.status(400).json(response(0, 'start_date and end_date required'));
    }

    // 频率限制检查
    const rateLimitKey = `schedule_${req.query.store_id}_${start_date}_${end_date}`;
    if (!rateLimit(rateLimitKey)) {
      console.log('[Schedule] Rate limited, returning cached or empty');
      const cachedData = getFromCache(getCacheKey('schedule', { store_id: req.query.store_id, start_date, end_date }));
      return res.json(response(1, '获取成功', cachedData || []));
    }

    // 检查缓存
    const cacheKey = getCacheKey('schedule', { store_id: req.query.store_id, start_date, end_date });
    const cachedData = getFromCache(cacheKey);
    if (cachedData) {
      console.log('[Schedule] Returning cached data');
      return res.json(response(1, '获取成功', cachedData));
    }

    const storeId = req.query.store_id || req.storeId;
    const storeName = STORE_ID_TO_NAME[storeId];
    console.log('[Schedule] storeId:', storeId, 'storeName:', storeName);

    if (!storeName) {
      return res.json(response(1, '获取成功', []));
    }

    // 调用 OpenAPI 查询预排班数据
    // 分页查询所有排班数据
    const allResults = [];
    let currentPage = 1;
    const pageSize = 100;

    while (true) {
      const postData = {
        table_key: SCHEDULE_API.tableKey,
        page_size: pageSize,
        current_page: currentPage,
        filters: [`所属门店:eq:${storeName}`],
        sort: 'created_at:DESC'
      };

      const data = await callOpenAPI('/open-api/v1/data/records/list', postData);
      console.log('[Schedule] OpenAPI response page', currentPage, ':', data ? `${data.results?.length || 0} records` : 'null');

      if (!data || !data.results || data.results.length === 0) {
        break;
      }

      allResults.push(...data.results);

      // 如果返回数量少于 pageSize，说明已经获取全部数据
      if (data.results.length < pageSize) {
        break;
      }

      currentPage++;
    }

    console.log('[Schedule] Total records:', allResults.length);

    if (allResults.length === 0) {
      return res.json(response(1, '获取成功', []));
    }

    // 过滤日期范围并转换字段
    const result = [];
    for (const item of allResults) {
      const f = item.fields || {};
      const date = f.日期 || '';
      if (date < start_date || date > end_date) continue;

      // 一条记录包含上午和下午，拆分为两条以兼容前端
      const baseRecord = {
        employee_id: f.员工编码 || '',
        date: date,
        name: f.姓名 || '',
        position: f.岗位 || '',
        business_line: f.工作名 || ''
      };

      // 判断是否为小时工
      const isHourly = f.岗位 === '小时工';

      if (isHourly) {
        // 小时工：返回工时数据
        if (f.小时工工时) {
          result.push({
            ...baseRecord,
            period: 'day',
            status: 'hours',
            hours: f.小时工工时
          });
        }
      } else {
        // 非小时工：返回出勤状态
        // 上午记录
        if (f.上午出勤状态) {
          result.push({
            ...baseRecord,
            period: 'am',
            status: convertStatus(f.上午出勤状态),
            secondment_store: f.上午借调门店 || ''
          });
        }

        // 下午记录
        if (f.下午出勤状态) {
          result.push({
            ...baseRecord,
            period: 'pm',
            status: convertStatus(f.下午出勤状态),
            secondment_store: f.下午借调门店 || ''
          });
        }
      }
    }

    setCache(cacheKey, result);
    res.json(response(1, '获取成功', result));
  } catch (err) {
    console.error('[Schedule] Error:', err.message);
    res.status(500).json(response(0, err.message));
  }
});

// 将 OpenAPI 的状态转换为前端状态
function convertStatus(status) {
  const statusMap = {
    '√': 'check',
    'O': 'leave',
    '旷': 'absent',
    '存': 'save',
    '年': 'annual',
    '借': 'second'
  };
  // 如果是已知状态，直接返回
  if (statusMap[status]) {
    return statusMap[status];
  }
  // 如果是门店缩写（单个汉字），表示借调
  if (status && status.length === 1 && !statusMap[status]) {
    return 'second';
  }
  return status;
}

// 将前端状态转换为 OpenAPI 的状态
// 当状态是借调时，需要传入门店名称，返回门店缩写
function toApiStatus(status, secondmentStore = '') {
  const statusMap = {
    'check': '√',
    'leave': 'O',
    'absent': '旷',
    'save': '存',
    'annual': '年'
  };
  if (status === 'second') {
    return STORE_NAME_TO_ABBREV[secondmentStore] || '借';
  }
  return statusMap[status] || '';
}

// POST 批量保存预排班
router.post('/batch', async (req, res) => {
  try {
    const { records } = req.body;
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json(response(0, 'records array required'));
    }

    // 从第一条记录中获取 store_id，或使用 req.storeId
    const storeId = records[0]?.store_id || req.storeId;
    const storeName = STORE_ID_TO_NAME[storeId] || '';
    console.log('[Schedule] Batch save, storeId:', storeId, 'storeName:', storeName);
    let successCount = 0;

    // 先按 日期+员工编码 分组，合并上午和下午状态
    const grouped = {};
    for (const r of records) {
      if (!r.employee_id || !r.date || !r.period) continue;
      const key = `${r.date}_${r.employee_id}`;
      if (!grouped[key]) {
        grouped[key] = {
          employee_id: r.employee_id,
          date: r.date,
          name: r.name || '',
          position: r.position || '',
          business_line: r.business_line || '',
          secondment_store: r.secondment_store || '',
          am_status: '',
          pm_status: '',
          hours: 0,  // 小时工工时
          isHourly: r.status === 'hours'  // 是否为小时工
        };
      }
      if (r.status === 'hours') {
        // 小时工：记录工时
        grouped[key].hours = r.hours || 0;
        grouped[key].isHourly = true;
      } else {
        // 非小时工：记录出勤状态
        if (r.period === 'am') {
          grouped[key].am_status = r.status;
          grouped[key].am_secondment_store = r.secondment_store || '';
        } else if (r.period === 'pm') {
          grouped[key].pm_status = r.status;
          grouped[key].pm_secondment_store = r.secondment_store || '';
        }
      }
    }

    // 逐条处理分组后的数据
    for (const key of Object.keys(grouped)) {
      const r = grouped[key];
      const title = `${r.date}${r.employee_id}`;
      const month = r.date ? parseInt(r.date.slice(5, 7), 10) : 1;

      // 先查询已有记录
      const existing = await findExistingRecord(title);

      // 构建记录数据
      const recordData = {
        标题: title,
        日期: r.date,
        所属门店: storeName,
        月份: month,
        员工编码: r.employee_id,
        姓名: r.name,
        岗位: r.position,
        工作名: r.business_line,
        小时工工时: 0
      };

      if (existing) {
        // 存在：只更新传入的字段，使用正确的 PUT 入参格式
        const updateFields = {};

        if (r.isHourly) {
          // 小时工：只更新小时工工时
          updateFields.小时工工时 = r.hours;
        } else {
          // 非小时工：更新出勤状态和借调门店
          if (r.am_status) {
            updateFields.上午出勤状态 = toApiStatus(r.am_status, r.am_secondment_store);
            updateFields.上午借调门店 = r.am_secondment_store || '';
          }

          if (r.pm_status) {
            updateFields.下午出勤状态 = toApiStatus(r.pm_status, r.pm_secondment_store);
            updateFields.下午借调门店 = r.pm_secondment_store || '';
          }
        }

        // 更新记录
        const result = await callOpenAPI('/open-api/v1/data/records', {
          table_key: SCHEDULE_API.tableKey,
          record_key: existing.record_key,
          fields: updateFields
        }, 'PUT');
        if (result) successCount++;
      } else {
        // 不存在：新增
        if (r.isHourly) {
          // 小时工：只设置小时工工时
          recordData.小时工工时 = r.hours;
          recordData.上午出勤状态 = '';
          recordData.下午出勤状态 = '';
          recordData.上午借调门店 = '';
          recordData.下午借调门店 = '';
        } else {
          // 非小时工：设置出勤状态和借调门店
          recordData.小时工工时 = 0;
          recordData.上午出勤状态 = r.am_status ? toApiStatus(r.am_status, r.am_secondment_store) : '';
          recordData.下午出勤状态 = r.pm_status ? toApiStatus(r.pm_status, r.pm_secondment_store) : '';
          recordData.上午借调门店 = r.am_secondment_store || '';
          recordData.下午借调门店 = r.pm_secondment_store || '';
        }

        const result = await callOpenAPI('/open-api/v1/data/records', {
          table_key: SCHEDULE_API.tableKey,
          records: [recordData]
        }, 'POST');
        if (result) successCount++;
      }
    }

    if (successCount > 0) {
      res.json(response(1, '成功'));
    } else {
      res.status(500).json(response(0, '失败'));
    }
  } catch (err) {
    console.error('[Schedule] Error:', err.message);
    res.status(500).json(response(0, '失败'));
  }
});

// GET 月度汇总（暂时返回空数据）
router.get('/summary', async (req, res) => {
  try {
    res.json(response(1, '获取成功', []));
  } catch (err) {
    console.error('[Schedule] Error:', err.message);
    res.status(500).json(response(0, err.message));
  }
});

module.exports = router;
