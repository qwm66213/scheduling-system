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
  url: 'https://app.emoosearch.com/open-api/v1/search',
  token: 'emoo_1qTLvYd7MO6IUN0KUxrIPYJSDPUCZqS8ItVi3Abh',
  userId: '{{Emoo-User-Id}}'
};

// 门店关键词映射
const STORE_KEYWORDS = {
  1: '金沙江',
  2: '凉城店',
  3: '国和店',
  4: '长江店',
  5: '长阳店',
  6: '殷高店',
  7: '宜川店',
  8: '中华店',
  9: '灵石店',
  10: '柳营店'
};

// 门店ID映射：我们的store_id -> 外部API门店ID
const STORE_ID_MAPPING = {
  1: 15,   // 金沙江
  2: 16,   // 凉城店
  3: 17,   // 国和店
  4: 18,   // 长江店
  5: 19,   // 长阳店
  6: 20,   // 殷高店
  7: 21,   // 宜川店
  8: 22,   // 中华店
  9: 23,   // 灵石店
  10: 24   // 柳营店
};

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

// 调用外部API获取实际营业额数据
function fetchExternalRevenue(keyword) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ page_size: 50, current_page: 1, keyword: keyword || '金石' });

    const options = {
      hostname: 'app.emoosearch.com',
      path: '/open-api/v1/search',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Bearer ${EXTERNAL_API.token}`,
        'Emoo-User-Id': EXTERNAL_API.userId
      }
    };

    const req = https.request(options, res => {
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => {
        try {
          // API返回的数据可能是GBK编码，尝试转换
          const buffer = Buffer.concat(chunks);
          // 先尝试UTF-8解析
          let body = buffer.toString('utf8');
          let json = JSON.parse(body);

          // 如果解析成功但数据有乱码，尝试GBK解码
          if (json.data?.results?.length > 0) {
            const firstContent = json.data.results[0]?.content;
            if (firstContent && firstContent['市别'] && !firstContent['市别'].includes('市')) {
              // 检测到乱码，使用GBK重新解码
              body = iconv.decode(buffer, 'gbk');
              json = JSON.parse(body);
            }
          }

          if (json.code === 200 && json.data?.results) {
            resolve(json.data.results);
          } else {
            resolve([]);
          }
        } catch (e) {
          // UTF-8解析失败，尝试GBK
          try {
            const buffer = Buffer.concat(chunks);
            const body = iconv.decode(buffer, 'gbk');
            const json = JSON.parse(body);
            if (json.code === 200 && json.data?.results) {
              resolve(json.data.results);
            } else {
              resolve([]);
            }
          } catch (e2) {
            resolve([]);
          }
        }
      });
    });

    req.on('error', e => reject(e));
    req.write(postData);
    req.end();
  });
}

// 解析外部API数据，提取午晚市营业额
function parseExternalData(results, startDate, endDate, storeId) {
  const data = [];

  // 获取外部API门店ID
  const externalStoreId = STORE_ID_MAPPING[storeId];
  if (!externalStoreId) return data; // 没有映射关系则返回空

  for (const item of results) {
    if (!item || !item.content) continue;

    const content = item.content;

    // 根据映射关系过滤门店
    if (content['门店ID'] !== String(externalStoreId) && content['门店ID'] !== externalStoreId) continue;

    const date = content['统计日期'];
    if (!date) continue;

    // 日期过滤
    if (startDate && date < startDate) continue;
    if (endDate && date > endDate) continue;

    // 从市别明细数组获取午市和晚市营业额
    const marketDetails = content['市别明细'] || [];
    for (let i = 0; i < marketDetails.length; i++) {
      const market = marketDetails[i];
      const revenue = market['营业额'] || 0;

      // 修复乱码并获取市别名称（API返回的字段是"市别"而不是"市别名称"）
      const marketNameRaw = market['市别'] || '';
      const marketName = fixGarbledText(marketNameRaw);

      // 根据市别名称判断：午市或晚市
      const period = marketName.includes('午') ? 'lunch' : (marketName.includes('晚') ? 'dinner' : (i === 0 ? 'lunch' : 'dinner'));

      data.push({
        date: date,
        period: period,
        total_revenue: Number(revenue.toFixed(2))
      });
    }
  }

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
    const { start_date, end_date, version } = req.query;
    console.log('[Revenue GET] version:', version, 'storeId:', req.storeId);

    // 实际营业额从外部API获取
    if (version === 'actual') {
      const storeId = req.storeId || 1;  // 默认金门店
      const keyword = STORE_KEYWORDS[storeId] || '金石';
      console.log('[Revenue] Fetching from external API, keyword:', keyword, 'storeId:', storeId);
      const results = await fetchExternalRevenue(keyword);
      const data = parseExternalData(results, start_date, end_date, storeId);
      console.log('[Revenue] External data count:', data.length);
      return res.json(response(1, '获取成功', data));
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
