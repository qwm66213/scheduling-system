const express = require('express');
const router = express.Router();
const https = require('https');
const iconv = require('iconv-lite');
const pool = require('../db-mysql');
const authMiddleware = require('../middleware/auth');

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

// 外部API配置
const EXTERNAL_API = {
  url: 'https://app.emoosearch.com/open-api/v1/data',
  token: 'emoo_1qTLvYd7MO6IUN0KUxrIPYJSDPUCZqS8ItVi3Abh',
  userId: '{{Emoo-User-Id}}',
  wsAppKey: 'b0d285504bb043329b6a4fb95da8ce59'  // 写在后端，不暴露
};

// 所有门店ID列表
const STORE_IDS = [3, 4, 5, 7, 8, 9, 13, 15, 16, 18, 19];

// 修复API返回的乱码字符串（GBK编码被当作UTF-8读取的问题）
function fixGarbledText(str) {
  if (!str || typeof str !== 'string') return str;
  // 检查是否包含可能的乱码字符（Latin-1扩展字符范围）
  // 如果字符串主要由ASCII字符组成，直接返回
  let hasGarbled = false;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code >= 128 && code <= 255) {
      hasGarbled = true;
      break;
    }
  }
  if (!hasGarbled) return str;

  try {
    // 将字符串转换为Buffer（使用latin1编码）
    const buf = Buffer.from(str, 'latin1');
    // 使用GBK解码
    return iconv.decode(buf, 'gbk');
  } catch (e) {
    return str;
  }
}

router.use(authMiddleware);

// 调用新API获取所有数据（游标分页）
async function fetchAllExternalData(storeId) {
  let allResults = [];
  let cursor = '';
  let hasMore = true;
  let pageCount = 0;

  while (hasMore) {
    pageCount++;
    const filterConditions = [[{
      field: 'ws_app.ws_app_key',
      operator: 'eq',
      value: EXTERNAL_API.wsAppKey
    }]];

    // 如果指定了门店ID（非 null），添加筛选条件；null 表示全部门店
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
      hostname: 'app.emoosearch.com',
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
                console.error('[Revenue] API error:', json.code, json.message);
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

// 解析营业汇总数据，提取午晚市营业额
function parseBusinessSummary(results, storeId, startDate, endDate) {
  // 使用Map按日期聚合数据
  const dateMap = new Map();
  console.log('[Revenue] parseBusinessSummary: results count:', results.length, 'storeId:', storeId, 'startDate:', startDate, 'endDate:', endDate);

  // 记录跳过原因统计
  let skippedNoGroup = 0;
  let skippedNoContent = 0;
  let skippedNoDate = 0;
  let skippedDateRange = 0;

  for (const item of results) {
    // 只处理营业汇总类型的数据
    if (item.doc_group?.app_group_id !== 'business_summary') {
      skippedNoGroup++;
      continue;
    }
    if (!item.content) {
      skippedNoContent++;
      continue;
    }

    // 如果指定了门店ID，进行筛选；null 表示全部门店，不筛选
    if (storeId) {
      const itemStoreId = item.content.门店ID;
      if (String(itemStoreId) !== String(storeId)) {
        continue;
      }
    }

    const date = item.content.统计日期;
    if (!date) {
      skippedNoDate++;
      continue;
    }

    // 日期过滤
    if (startDate && date < startDate) {
      skippedDateRange++;
      continue;
    }
    if (endDate && date > endDate) {
      skippedDateRange++;
      continue;
    }

    // 初始化该日期的数据
    if (!dateMap.has(date)) {
      dateMap.set(date, { date, lunch_revenue: 0, dinner_revenue: 0 });
    }
    const dateData = dateMap.get(date);

    // 从市别明细数组获取午市和晚市营业额
    const marketDetails = item.content.市别明细 || [];
    for (const market of marketDetails) {
      const revenue = market.营业额 || 0;
      const marketName = market.市别 || '';

      // 根据市别名称判断：午市或晚市
      if (marketName.includes('午')) {
        dateData.lunch_revenue += Number(revenue);
      } else if (marketName.includes('晚')) {
        dateData.dinner_revenue += Number(revenue);
      } else {
        // 默认归入午市
        dateData.lunch_revenue += Number(revenue);
      }
    }
  }

  // 转换为数组并计算total_revenue
  const data = [];
  for (const dateData of dateMap.values()) {
    data.push({
      date: dateData.date,
      lunch_revenue: Number(dateData.lunch_revenue.toFixed(2)),
      dinner_revenue: Number(dateData.dinner_revenue.toFixed(2)),
      total_revenue: Number((dateData.lunch_revenue + dateData.dinner_revenue).toFixed(2))
    });
  }

  console.log(`[Revenue] parseBusinessSummary done: ${data.length} items. Skipped: noGroup=${skippedNoGroup}, noContent=${skippedNoContent}, noDate=${skippedNoDate}, dateRange=${skippedDateRange}`);
  return data;
}

function formatDate(d) {
  if (!d) return d
  if (d instanceof Date) {
    const offset = d.getTimezoneOffset()
    const local = new Date(d.getTime() - offset * 60000)
    return local.toISOString().slice(0, 10)
  }
  const s = String(d)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  return s
}

function calcRevenues(r) {
  const hall_revenue = (r.hall_tables || 0) * (r.hall_avg || 0)
  const banquet_revenue = (r.banquet_tables || 0) * (r.banquet_avg || 0)
  const room_revenue = (r.room_tables || 0) * (r.room_avg || 0)
  const delivery_revenue = (r.delivery_orders || 0) * (r.delivery_price || 0)
  const total_revenue = hall_revenue + banquet_revenue + room_revenue + delivery_revenue
  return { hall_revenue, banquet_revenue, room_revenue, delivery_revenue, total_revenue }
}

const SELECT_FIELDS = 'id, revenue_date, meal_period, version, hall_tables, hall_avg, hall_revenue, banquet_tables, banquet_avg, banquet_revenue, room_tables, room_avg, room_revenue, delivery_orders, delivery_price, delivery_revenue, total_revenue, created_at, updated_at'

// GET
router.get('/', async (req, res) => {
  try {
    const { start_date, end_date, version, store_id } = req.query;
    console.log('[Revenue GET] Request received:', { start_date, end_date, version, store_id, req_storeId: req.storeId });

    // 实际营业额从外部API获取
    if (version === 'actual') {
      const storeId = req.query.store_id || req.storeId;
      // storeId 为 null 表示全部门店，允许继续查询
      console.log('[Revenue] Fetching from new external API, storeId:', storeId, 'req.query.store_id:', req.query.store_id, 'req.storeId:', req.storeId);

      try {
        let results = [];

        if (!storeId) {
          // 全部门店：并行获取每个门店的数据
          console.log('[Revenue] Fetching all stores in parallel...');
          const startTime = Date.now();

          const fetchPromises = STORE_IDS.map(id => fetchAllExternalData(id));
          const allResults = await Promise.all(fetchPromises);

          // 合并所有门店的数据
          results = allResults.flat();

          const elapsed = Date.now() - startTime;
          console.log(`[Revenue] Fetched all stores in ${elapsed}ms, total items: ${results.length}`);
        } else {
          // 单个门店
          results = await fetchAllExternalData(storeId);
        }

        const data = parseBusinessSummary(results, null, start_date, end_date);
        console.log('[Revenue] External data count:', data.length);
        // 兜底：确保返回数组，空数据返回空数组而不是报错
        return res.json(response(1, '获取成功', data || []));
      } catch (apiError) {
        console.error('[Revenue] External API error:', apiError.message);
        // 兜底：API调用失败时返回空数组，不抛出错误
        return res.json(response(1, '获取成功', []));
      }
    }

    // 预估营业额从数据库获取
    let sql = `SELECT ${SELECT_FIELDS} FROM revenue_detail WHERE 1=1`;
    const params = [];
    if (req.storeId) { sql += ' AND store_id = ?'; params.push(req.storeId); }
    if (start_date) { sql += ' AND revenue_date >= ?'; params.push(start_date); }
    if (end_date) { sql += ' AND revenue_date <= ?'; params.push(end_date); }
    if (version) { sql += ' AND version = ?'; params.push(version); }
    sql += ' ORDER BY revenue_date, meal_period';
    const [rows] = await pool.execute(sql, params);
    const result = rows.map(r => ({
      id: r.id,
      date: formatDate(r.revenue_date),
      period: r.meal_period,
      version: r.version,
      hall_tables: r.hall_tables,
      hall_avg: Number(r.hall_avg),
      hall_revenue: Number(r.hall_revenue),
      banquet_tables: r.banquet_tables,
      banquet_avg: Number(r.banquet_avg),
      banquet_revenue: Number(r.banquet_revenue),
      room_tables: r.room_tables,
      room_avg: Number(r.room_avg),
      room_revenue: Number(r.room_revenue),
      delivery_orders: r.delivery_orders,
      delivery_price: Number(r.delivery_price),
      delivery_revenue: Number(r.delivery_revenue),
      total_revenue: Number(r.total_revenue),
      revenue_amount: Number(r.total_revenue)
    }));
    res.json(response(1, '获取成功', result));
  } catch (err) {
    console.error('[Revenue] Error:', err.message);
    res.status(500).json(response(0, err.message));
  }
});

// POST - 只处理预估营业额
router.post('/', async (req, res) => {
  try {
    const { date, period, hall_tables, hall_avg, banquet_tables, banquet_avg, room_tables, room_avg, delivery_orders, delivery_price, store_id } = req.body;
    const revs = calcRevenues({ hall_tables, hall_avg, banquet_tables, banquet_avg, room_tables, room_avg, delivery_orders, delivery_price });

    const [existing] = await pool.execute(
      'SELECT id FROM revenue_detail WHERE revenue_date = ? AND meal_period = ? AND version = ? AND store_id = ?',
      [date, period, 'forecast', store_id || req.storeId]
    );

    if (existing.length > 0) {
      await pool.execute(
        `UPDATE revenue_detail SET hall_tables=?, hall_avg=?, hall_revenue=?, banquet_tables=?, banquet_avg=?, banquet_revenue=?, room_tables=?, room_avg=?, room_revenue=?, delivery_orders=?, delivery_price=?, delivery_revenue=?, total_revenue=? WHERE id=?`,
        [hall_tables||0, hall_avg||0, revs.hall_revenue, banquet_tables||0, banquet_avg||0, revs.banquet_revenue, room_tables||0, room_avg||0, revs.room_revenue, delivery_orders||0, delivery_price||0, revs.delivery_revenue, revs.total_revenue, existing[0].id]
      );
      res.json(response(1, '保存成功', { id: existing[0].id }));
    } else {
      const [result] = await pool.execute(
        `INSERT INTO revenue_detail (revenue_date, meal_period, version, hall_tables, hall_avg, hall_revenue, banquet_tables, banquet_avg, banquet_revenue, room_tables, room_avg, room_revenue, delivery_orders, delivery_price, delivery_revenue, total_revenue, store_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [date, period, 'forecast', hall_tables||0, hall_avg||0, revs.hall_revenue, banquet_tables||0, banquet_avg||0, revs.banquet_revenue, room_tables||0, room_avg||0, revs.room_revenue, delivery_orders||0, delivery_price||0, revs.delivery_revenue, revs.total_revenue, store_id || req.storeId]
      );
      res.json(response(1, '保存成功', { id: result.insertId }));
    }
  } catch (err) {
    console.error('[Revenue] Error:', err.message);
    res.status(500).json(response(0, err.message));
  }
});

// PUT - 只处理预估营业额
router.put('/:id', async (req, res) => {
  try {
    const { hall_tables, hall_avg, banquet_tables, banquet_avg, room_tables, room_avg, delivery_orders, delivery_price } = req.body;
    const revs = calcRevenues({ hall_tables, hall_avg, banquet_tables, banquet_avg, room_tables, room_avg, delivery_orders, delivery_price });
    await pool.execute(
      `UPDATE revenue_detail SET hall_tables=?, hall_avg=?, hall_revenue=?, banquet_tables=?, banquet_avg=?, banquet_revenue=?, room_tables=?, room_avg=?, room_revenue=?, delivery_orders=?, delivery_price=?, delivery_revenue=?, total_revenue=? WHERE id=?`,
      [hall_tables||0, hall_avg||0, revs.hall_revenue, banquet_tables||0, banquet_avg||0, revs.banquet_revenue, room_tables||0, room_avg||0, revs.room_revenue, delivery_orders||0, delivery_price||0, revs.delivery_revenue, revs.total_revenue, req.params.id]
    );
    res.json(response(1, '更新成功'));
  } catch (err) {
    console.error('[Revenue] Error:', err.message);
    res.status(500).json(response(0, err.message));
  }
});

// DELETE
router.delete('/:id', async (req, res) => {
  try {
    await pool.execute('DELETE FROM revenue_detail WHERE id=?', [req.params.id]);
    res.json(response(1, '删除成功'));
  } catch (err) {
    console.error('[Revenue] Error:', err.message);
    res.status(500).json(response(0, err.message));
  }
});

module.exports = router;
