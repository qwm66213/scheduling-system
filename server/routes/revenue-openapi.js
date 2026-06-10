const express = require('express');
const router = express.Router();
const http = require('http');
const iconv = require('iconv-lite');
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
const REVENUE_API = {
  token: 'emoo_W7ExdLzLIff1VI8WEFHV8y3a_nb1mOGD6_ZrRroA',
  userId: '{{Emoo-User-Id}}',
  tableKey: 'tb_b9c58872b103f'  // 预估营业额表
};

// 外部实际营业额 API 配置
const EXTERNAL_API = {
  url: 'http://localhost/open-api/v1/data',
  token: 'emoo_W7ExdLzLIff1VI8WEFHV8y3a_nb1mOGD6_ZrRroA',
  userId: '{{Emoo-User-Id}}',
  wsAppKey: 'b0d285504bb043329b6a4fb95da8ce59'
};

// 所有门店ID列表
const STORE_IDS = [3, 4, 5, 7, 8, 9, 13, 15, 16, 18, 19];

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

// 调用 OpenAPI 的通用方法
function callOpenAPI(path, postData, method = 'POST') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Bearer ${REVENUE_API.token}`,
        'Emoo-User-Id': REVENUE_API.userId
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
            console.error('[Revenue] API error:', json.code, json.message);
            resolve(null);
          }
        } catch (e) {
          console.error('[Revenue] Parse error:', e.message);
          resolve(null);
        }
      });
    });
    req.on('error', e => reject(e));
    req.write(JSON.stringify(postData));
    req.end();
  });
}

// 查询 OpenAPI 是否存在指定记录（按标题查询）
async function findExistingRecord(title) {
  const postData = {
    table_key: REVENUE_API.tableKey,
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

// 分页查询所有预估营业额记录
async function fetchAllForecastRecords(storeId, startDate, endDate) {
  const allResults = [];
  let currentPage = 1;
  const pageSize = 100;

  const storeName = STORE_ID_TO_NAME[storeId];
  const filters = [`营业日期:gte:${startDate}`, `营业日期:lte:${endDate}`];
  if (storeName) {
    filters.push(`门店ID:eq:${storeId}`);
  }

  while (true) {
    const postData = {
      table_key: REVENUE_API.tableKey,
      page_size: pageSize,
      current_page: currentPage,
      filters: filters,
      sort: '营业日期:ASC'
    };

    const data = await callOpenAPI('/open-api/v1/data/records/list', postData);

    if (!data || !data.results || data.results.length === 0) {
      break;
    }

    allResults.push(...data.results);

    if (data.results.length < pageSize) {
      break;
    }

    currentPage++;
  }

  return allResults;
}

// 调用外部API获取实际营业额数据
async function fetchAllExternalData(storeId, startDate, endDate) {
  let allResults = [];
  let cursor = '';
  let hasMore = true;
  let pageCount = 0;

  while (hasMore) {
    pageCount++;
    const filterConditions = [[
      {
        field: 'ws_app.ws_app_key',
        operator: 'eq',
        value: EXTERNAL_API.wsAppKey
      },
      {
        field: 'doc_group.app_group_id',
        operator: 'eq',
        value: 'business_summary'
      },
      {
        field: '统计日期',
        operator: 'gte',
        value: startDate
      },
      {
        field: '统计日期',
        operator: 'lte',
        value: endDate
      }
    ]];

    if (storeId) {
      filterConditions[0].push({
        field: '门店ID',
        operator: 'eq',
        value: String(storeId)
      });
    }

    const postData = JSON.stringify({
      page_size: 200,
      cursor: cursor,
      text_format: 'markdown',
      filter_conditions: filterConditions
    });

    const options = {
      hostname: 'localhost',
      path: '/open-api/v1/data',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Bearer ${EXTERNAL_API.token}`,
        'Emoo-User-Id': EXTERNAL_API.userId
      }
    };

    try {
      const result = await new Promise((resolve, reject) => {
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
                console.error('[Revenue] External API error:', json.code, json.message);
                resolve({ results: [], has_more: false, next_cursor: null });
              }
            } catch (e) {
              console.error('[Revenue] Parse error:', e.message);
              resolve({ results: [], has_more: false, next_cursor: null });
            }
          });
        });
        req.on('error', e => reject(e));
        req.write(postData);
        req.end();
      });

      if (result.results) {
        allResults = allResults.concat(result.results);
        console.log(`[Revenue] Page ${pageCount}: fetched ${result.results.length}, total: ${allResults.length}`);
      }
      hasMore = result.has_more || false;
      cursor = result.next_cursor || '';
    } catch (e) {
      console.error('[Revenue] Fetch error:', e.message);
      hasMore = false;
    }
  }

  console.log(`[Revenue] Total fetched: ${allResults.length} items in ${pageCount} pages`);
  return allResults;
}

// 解析实际营业额数据
function parseBusinessSummary(results, storeId, startDate, endDate) {
  const dateMap = new Map();
  console.log('[Revenue] parseBusinessSummary: results count:', results.length);

  for (const item of results) {
    if (item.doc_group?.app_group_id !== 'business_summary') continue;
    if (!item.content) continue;

    if (storeId) {
      const itemStoreId = item.content.门店ID;
      if (String(itemStoreId) !== String(storeId)) continue;
    }

    const date = item.content.统计日期;
    if (!date) continue;
    if (startDate && date < startDate) continue;
    if (endDate && date > endDate) continue;

    if (!dateMap.has(date)) {
      dateMap.set(date, { date, lunch_revenue: 0, dinner_revenue: 0 });
    }
    const dateData = dateMap.get(date);

    const marketDetails = item.content.市别明细 || [];
    for (const market of marketDetails) {
      const revenue = market.营业额 || 0;
      const marketName = market.市别 || '';

      if (marketName.includes('午')) {
        dateData.lunch_revenue += Number(revenue);
      } else if (marketName.includes('晚')) {
        dateData.dinner_revenue += Number(revenue);
      } else {
        dateData.lunch_revenue += Number(revenue);
      }
    }
  }

  const data = [];
  for (const dateData of dateMap.values()) {
    data.push({
      date: dateData.date,
      lunch_revenue: Number(dateData.lunch_revenue.toFixed(2)),
      dinner_revenue: Number(dateData.dinner_revenue.toFixed(2)),
      total_revenue: Number((dateData.lunch_revenue + dateData.dinner_revenue).toFixed(2))
    });
  }

  return data;
}

// 计算各项营业额
function calcRevenues(r) {
  const hall_revenue = (r.hall_tables || 0) * (r.hall_avg || 0);
  const banquet_revenue = (r.banquet_tables || 0) * (r.banquet_avg || 0);
  const room_revenue = (r.room_tables || 0) * (r.room_avg || 0);
  const delivery_revenue = (r.delivery_orders || 0) * (r.delivery_price || 0);
  const total_revenue = hall_revenue + banquet_revenue + room_revenue + delivery_revenue;
  return { hall_revenue, banquet_revenue, room_revenue, delivery_revenue, total_revenue };
}

// GET 查询营业额
router.get('/', async (req, res) => {
  try {
    const { start_date, end_date, version, store_id } = req.query;
    console.log('[Revenue GET] Request received:', { start_date, end_date, version, store_id });

    // 实际营业额从外部API获取
    if (version === 'actual') {
      const storeId = req.query.store_id || req.storeId;

      try {
        let results = [];

        if (!storeId) {
          // 全部门店：并行获取
          console.log('[Revenue] Fetching all stores in parallel...');
          const startTime = Date.now();

          const fetchPromises = STORE_IDS.map(id => fetchAllExternalData(id, start_date, end_date));
          const allResults = await Promise.all(fetchPromises);
          results = allResults.flat();

          const elapsed = Date.now() - startTime;
          console.log(`[Revenue] Fetched all stores in ${elapsed}ms, total items: ${results.length}`);
        } else {
          results = await fetchAllExternalData(storeId, start_date, end_date);
        }

        const data = parseBusinessSummary(results, null, start_date, end_date);
        return res.json(response(1, '获取成功', data || []));
      } catch (apiError) {
        console.error('[Revenue] External API error:', apiError.message);
        return res.json(response(1, '获取成功', []));
      }
    }

    // 预估营业额从 OpenAPI 表获取
    const storeId = req.query.store_id || req.storeId;
    const allResults = await fetchAllForecastRecords(storeId, start_date, end_date);

    const result = allResults.map(item => {
      const f = item.fields || {};
      return {
        id: item.record_key,
        date: f.营业日期 || '',
        period: f.餐段 || '',
        store_id: f.门店ID || '',
        hall_tables: f.大厅桌数 || 0,
        hall_avg: Number(f.大厅桌均 || 0),
        hall_revenue: Number(f.大厅营业额 || 0),
        banquet_tables: f.宴会厅桌数 || 0,
        banquet_avg: Number(f.宴会厅桌均 || 0),
        banquet_revenue: Number(f.宴会厅营业额 || 0),
        room_tables: f.包房桌数 || 0,
        room_avg: Number(f.包房桌均 || 0),
        room_revenue: Number(f.包房营业额 || 0),
        delivery_orders: f.外卖单数 || 0,
        delivery_price: Number(f.外卖单价 || 0),
        delivery_revenue: Number(f.外卖营业额 || 0),
        total_revenue: Number(f.总营业额 || 0),
        revenue_amount: Number(f.总营业额 || 0)
      };
    });

    res.json(response(1, '获取成功', result));
  } catch (err) {
    console.error('[Revenue] Error:', err.message);
    res.status(500).json(response(0, err.message));
  }
});

// POST 新增预估营业额（存在则更新）
router.post('/', async (req, res) => {
  try {
    const { date, period, hall_tables, hall_avg, banquet_tables, banquet_avg, room_tables, room_avg, delivery_orders, delivery_price, store_id } = req.body;
    const storeId = store_id || req.storeId;
    const revs = calcRevenues({ hall_tables, hall_avg, banquet_tables, banquet_avg, room_tables, room_avg, delivery_orders, delivery_price });

    // 构建标题：日期_餐段_门店ID
    const title = `${date}_${period}_${storeId}`;

    const existing = await findExistingRecord(title);

    const recordData = {
      标题: title,
      营业日期: date,
      餐段: period,
      门店ID: storeId,
      大厅桌数: hall_tables || 0,
      大厅桌均: hall_avg || 0,
      大厅营业额: revs.hall_revenue,
      宴会厅桌数: banquet_tables || 0,
      宴会厅桌均: banquet_avg || 0,
      宴会厅营业额: revs.banquet_revenue,
      包房桌数: room_tables || 0,
      包房桌均: room_avg || 0,
      包房营业额: revs.room_revenue,
      外卖单数: delivery_orders || 0,
      外卖单价: delivery_price || 0,
      外卖营业额: revs.delivery_revenue,
      总营业额: revs.total_revenue
    };

    if (existing) {
      // 更新现有记录
      const result = await callOpenAPI('/open-api/v1/data/records', {
        table_key: REVENUE_API.tableKey,
        record_key: existing.record_key,
        fields: recordData
      }, 'PUT');
      res.json(response(1, '保存成功', { id: existing.record_key }));
    } else {
      // 新增记录
      const result = await callOpenAPI('/open-api/v1/data/records', {
        table_key: REVENUE_API.tableKey,
        records: [recordData]
      }, 'POST');
      res.json(response(1, '保存成功', { id: result?.results?.[0]?.record_key }));
    }
  } catch (err) {
    console.error('[Revenue] Error:', err.message);
    res.status(500).json(response(0, err.message));
  }
});

// PUT 更新预估营业额
router.put('/:id', async (req, res) => {
  try {
    const { hall_tables, hall_avg, banquet_tables, banquet_avg, room_tables, room_avg, delivery_orders, delivery_price } = req.body;
    const revs = calcRevenues({ hall_tables, hall_avg, banquet_tables, banquet_avg, room_tables, room_avg, delivery_orders, delivery_price });

    const updateFields = {
      大厅桌数: hall_tables || 0,
      大厅桌均: hall_avg || 0,
      大厅营业额: revs.hall_revenue,
      宴会厅桌数: banquet_tables || 0,
      宴会厅桌均: banquet_avg || 0,
      宴会厅营业额: revs.banquet_revenue,
      包房桌数: room_tables || 0,
      包房桌均: room_avg || 0,
      包房营业额: revs.room_revenue,
      外卖单数: delivery_orders || 0,
      外卖单价: delivery_price || 0,
      外卖营业额: revs.delivery_revenue,
      总营业额: revs.total_revenue
    };

    const result = await callOpenAPI('/open-api/v1/data/records', {
      table_key: REVENUE_API.tableKey,
      record_key: req.params.id,
      fields: updateFields
    }, 'PUT');

    res.json(response(1, '更新成功'));
  } catch (err) {
    console.error('[Revenue] Error:', err.message);
    res.status(500).json(response(0, err.message));
  }
});

module.exports = router;