const express = require('express');
const router = express.Router();
const https = require('https');
const authMiddleware = require('../middleware/auth');

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

// OpenAPI 配置
const EXTERNAL_API = {
  token: 'emoo_1qTLvYd7MO6IUN0KUxrIPYJSDPUCZqS8ItVi3Abh',
  userId: '{{Emoo-User-Id}}',
  tableKey: 'bd_fa9be88a72f53'
};

// 门店ID到门店名称的映射
const STORE_ID_TO_NAME = {
  3: '930殷高店',
  4: '930长江西路店',
  5: '930国和店',
  7: '930宜川店',
  8: '930小馆拾光里店',
  9: '930浦锦路店',
  13: '930金沙江店',
  15: '930车站南路店',
  16: '930中华路店',
  18: '930柳营路店',
  19: '930长阳店'
};

// 调用 OpenAPI 获取员工数据
async function fetchStaffData(storeId) {
  const storeName = STORE_ID_TO_NAME[storeId];
  if (!storeName) {
    return { results: [] };
  }

  // 先按门店名称过滤
  const postData = JSON.stringify({
    table_key: EXTERNAL_API.tableKey,
    page_size: 100,
    current_page: 1,
    filters: [`所属门店:eq:${storeName}`],
    sort: 'created_at:DESC'
  });

  const options = {
    hostname: 'app.emoosearch.com',
    path: '/open-api/v1/data/records/list',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Authorization': `Bearer ${EXTERNAL_API.token}`,
      'Emoo-User-Id': EXTERNAL_API.userId
    }
  };

  const fetchData = (postData) => new Promise((resolve, reject) => {
    const req = https.request(options, res => {
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
            console.error('[Staff] API error:', json.code, json.message);
            resolve({ results: [] });
          }
        } catch (e) {
          console.error('[Staff] Parse error:', e.message);
          resolve({ results: [] });
        }
      });
    });
    req.on('error', e => reject(e));
    req.write(postData);
    req.end();
  });

  // 先按门店名称查询
  let data = await fetchData(postData);

  // 如果没有数据，再按门店ID字段过滤
  if (!data.results || data.results.length === 0) {
    console.log('[Staff] No data by name, trying storeId:', storeId);
    const postDataById = JSON.stringify({
      table_key: EXTERNAL_API.tableKey,
      page_size: 100,
      current_page: 1,
      filters: [`门店ID:eq:${storeId}`],
      sort: 'created_at:DESC'
    });
    data = await fetchData(postDataById);
  }

  return data;
}

// GET - 获取员工列表
router.get('/', async (req, res) => {
  try {
    const storeId = req.query.store_id || req.storeId;
    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || 20;

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
            store_id: storeIdVal,
            store: item.fields?.所属门店 || STORE_ID_TO_NAME[storeIdVal] || '',
            name: item.fields?.姓名 || '',
            position: item.fields?.岗位 || '',
            workName: item.fields?.工作名 || ''
          })));
        }
      }
    } else {
      // 单个门店
      const data = await fetchStaffData(storeId);
      if (data.results) {
        allStaff = data.results.map(item => ({
          id: item.id,
          store_id: storeId,
          store: item.fields?.所属门店 || '',
          name: item.fields?.姓名 || '',
          position: item.fields?.岗位 || '',
          workName: item.fields?.工作名 || ''
        }));
      }
    }

    // 分页处理
    const total = allStaff.length;
    const start = (page - 1) * pageSize;
    const pagedData = allStaff.slice(start, start + pageSize);

    console.log('[Staff] Fetched:', allStaff.length, 'items, returning page', page, 'with', pagedData.length, 'items');

    // 返回分页数据
    res.json(response(1, '获取成功', {
      data: pagedData,
      total,
      page,
      pageSize
    }));
  } catch (err) {
    console.error('[Staff] Error:', err.message);
    res.json(response(1, '获取成功', { data: [], total: 0, page: 1, pageSize: 20 }));
  }
});

module.exports = router;