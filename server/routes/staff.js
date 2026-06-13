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

// 员工表配置
const EXTERNAL_API = {
  tableKey: 'tb_b6d4799a5697f'
};

// 门店ID到门店名称的映射
const STORE_ID_TO_NAME = config.stores.STORE_ID_TO_NAME;

// 岗位排序规则
const backPositions = ['厨师长', '副厨', '第一炉灶', '第二炉灶', '第三炉灶', '第四炉灶', '第五炉灶', '第六炉灶', '冷菜主管', '冷菜', '蒸箱', '点心师傅', '切配主管', '切配', '海鲜师傅', '打荷', '洗碗洗菜', '寒暑假工', '小时工'];
const frontPositions = ['店长', '前厅经理', '前厅主管', '金牌师傅', '收银', '迎宾', '服务员', '外卖', '保洁', '小时工'];
const backRank = Object.fromEntries(backPositions.map((p, i) => [p, i]));
const frontRank = Object.fromEntries(frontPositions.map((p, i) => [p, i]));

// 排序函数：先按前厅/后厨分组，再按岗位排序
function sortStaff(list) {
  return list.sort((a, b) => {
    const aWorkName = a.workName || '';
    const bWorkName = b.workName || '';

    // 前厅排在前面，后厨排在后面
    if (aWorkName === '前厅' && bWorkName !== '前厅') return -1;
    if (aWorkName !== '前厅' && bWorkName === '前厅') return 1;

    // 同一组内按岗位排序
    const rank = aWorkName === '前厅' ? frontRank : backRank;
    const aRank = rank[a.position] ?? 999;
    const bRank = rank[b.position] ?? 999;
    return aRank - bRank;
  });
}

// 调用 OpenAPI 获取员工数据
async function fetchStaffData(storeId) {
  const storeName = STORE_ID_TO_NAME[storeId];
  if (!storeName) {
    return { results: [] };
  }

  // 先按门店名称查询
  const postData = {
    table_key: EXTERNAL_API.tableKey,
    page_size: 100,
    current_page: 1,
    filters: [`所属门店:eq:${storeName}`],
    sort: 'created_at:DESC'
  };

  let data = await callOpenAPI('/open-api/v1/data/records/list', postData);

  // 如果没有数据，再按门店ID字段过滤
  if (!data || !data.results || data.results.length === 0) {
    console.log('[Staff] No data by name, trying storeId:', storeId);
    const postDataById = {
      table_key: EXTERNAL_API.tableKey,
      page_size: 100,
      current_page: 1,
      filters: [`门店ID:eq:${storeId}`],
      sort: 'created_at:DESC'
    };
    data = await callOpenAPI('/open-api/v1/data/records/list', postDataById);
  }

  return data || { results: [] };
}

// GET - 获取员工列表
router.get('/', async (req, res) => {
  try {
    const storeId = req.query.store_id || req.storeId;
    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || 15;

    // 频率限制检查
    const rateLimitKey = `staff_${storeId}_${page}_${pageSize}`;
    if (!rateLimit(rateLimitKey)) {
      console.log('[Staff] Rate limited, returning cached or empty');
      const cachedData = getFromCache(getCacheKey('staff', { store_id: storeId, page, pageSize }));
      return res.json(response(1, '获取成功', cachedData || { data: [], total: 0, page, pageSize }));
    }

    // 检查缓存
    const cacheKey = getCacheKey('staff', { store_id: storeId, page, pageSize });
    const cachedData = getFromCache(cacheKey);
    if (cachedData) {
      console.log('[Staff] Returning cached data');
      return res.json(response(1, '获取成功', cachedData));
    }

    console.log('[Staff] Fetching from OpenAPI, storeId:', storeId, 'page:', page, 'pageSize:', pageSize);

    let allStaff = [];

    if (!storeId) {
      // 全部门店：遍历所有门店获取数据
      const storeIds = Object.keys(STORE_ID_TO_NAME).map(Number);
      const fetchPromises = storeIds.map(id => fetchStaffData(id));
      const results = await Promise.all(fetchPromises);

      for (let i = 0; i < results.length; i++) {
        const data = results[i];
        const storeIdVal = storeIds[i];
        if (data.results) {
          allStaff.push(...data.results.map(item => ({
            id: item.id,
            employeeCode: item.fields?.员工编码 || '',
            store_id: storeIdVal,
            store: item.fields?.所属门店 || STORE_ID_TO_NAME[storeIdVal] || '',
            name: item.fields?.姓名 || '',
            position: item.fields?.岗位 || '',
            workName: item.fields?.工作名 || '',
            hireDate: item.fields?.入职日期 || null,
            lastWorkDate: item.fields?.最后工作日 || null
          })));
        }
      }
    } else {
      // 单个门店
      const data = await fetchStaffData(storeId);
      if (data.results) {
        allStaff = data.results.map(item => ({
          id: item.id,
          employeeCode: item.fields?.员工编码 || '',
          store_id: storeId,
          store: item.fields?.所属门店 || '',
          name: item.fields?.姓名 || '',
          position: item.fields?.岗位 || '',
          workName: item.fields?.工作名 || '',
          hireDate: item.fields?.入职日期 || null,
          lastWorkDate: item.fields?.最后工作日 || null
        }));
      }
    }

    // 排序：先按前厅/后厨分组，再按岗位排序
    sortStaff(allStaff);

    // 分页处理
    const total = allStaff.length;
    const start = (page - 1) * pageSize;
    const pagedData = allStaff.slice(start, start + pageSize);

    console.log('[Staff] Fetched:', allStaff.length, 'items, returning page', page, 'with', pagedData.length, 'items');

    // 返回分页数据
    const result = {
      data: pagedData,
      total,
      page,
      pageSize
    };
    setCache(cacheKey, result);
    res.json(response(1, '获取成功', result));
  } catch (err) {
    console.error('[Staff] Error:', err.message);
    res.json(response(1, '获取成功', { data: [], total: 0, page: 1, pageSize: 15 }));
  }
});

module.exports = router;