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
  3: '殷高店',
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

  return new Promise((resolve, reject) => {
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
}

// GET - 获取员工列表
router.get('/', async (req, res) => {
  try {
    const storeId = req.query.store_id || req.storeId;
    if (!storeId) {
      // 兜底：没有storeId时返回空数组
      return res.json(response(1, '获取成功', []));
    }
    console.log('[Staff] Fetching from OpenAPI, storeId:', storeId);

    const data = await fetchStaffData(storeId);
    const results = (data.results || []).map(item => ({
      id: item.id,
      store: item.fields?.所属门店 || '',
      name: item.fields?.姓名 || '',
      position: item.fields?.岗位 || '',
      workName: item.fields?.工作名 || ''
    }));

    console.log('[Staff] Fetched:', results.length, 'items');
    // 兜底：确保返回数组
    res.json(response(1, '获取成功', results || []));
  } catch (err) {
    console.error('[Staff] Error:', err.message);
    // 兜底：出错时返回空数组，不返回错误状态
    res.json(response(1, '获取成功', []));
  }
});

module.exports = router;