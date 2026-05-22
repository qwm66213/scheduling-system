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
const SCHEDULE_API = {
  token: 'emoo_1qTLvYd7MO6IUN0KUxrIPYJSDPUCZqS8ItVi3Abh',
  userId: '{{Emoo-User-Id}}',
  tableKey: 'tb_1ea7b2229e96f'
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

// 调用 OpenAPI 的通用方法（支持 POST 和 PUT）
function callOpenAPI(path, postData, method = 'POST') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'app.emoosearch.com',
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Bearer ${SCHEDULE_API.token}`,
        'Emoo-User-Id': SCHEDULE_API.userId
      }
    };

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
            console.error('[Schedule] API error:', json.code, json.message);
            resolve(null);
          }
        } catch (e) {
          console.error('[Schedule] Parse error:', e.message);
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

    const storeId = req.query.store_id || req.storeId;
    const storeName = STORE_ID_TO_NAME[storeId];
    console.log('[Schedule] storeId:', storeId, 'storeName:', storeName);

    if (!storeName) {
      return res.json(response(1, '获取成功', []));
    }

    // 调用 OpenAPI 查询预排班数据
    const postData = {
      table_key: SCHEDULE_API.tableKey,
      page_size: 100,
      current_page: 1,
      filters: [`所属门店:eq:${storeName}`],
      sort: 'created_at:DESC'
    };

    const data = await callOpenAPI('/open-api/v1/data/records/list', postData);
    console.log('[Schedule] OpenAPI response:', data ? `${data.results?.length || 0} records` : 'null');

    if (!data || !data.results) {
      return res.json(response(1, '获取成功', []));
    }

    // 过滤日期范围并转换字段
    const result = [];
    for (const item of data.results) {
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
          pm_status: ''
        };
      }
      if (r.period === 'am') {
        grouped[key].am_status = r.status;
        grouped[key].am_secondment_store = r.secondment_store || '';
      } else if (r.period === 'pm') {
        grouped[key].pm_status = r.status;
        grouped[key].pm_secondment_store = r.secondment_store || '';
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
        // 存在：保留原有状态，只更新传入的时段
        const existingFields = existing.fields || {};
        recordData.上午出勤状态 = r.am_status ? toApiStatus(r.am_status, r.am_secondment_store) : (existingFields.上午出勤状态 || '');
        recordData.下午出勤状态 = r.pm_status ? toApiStatus(r.pm_status, r.pm_secondment_store) : (existingFields.下午出勤状态 || '');
        recordData.上午借调门店 = r.am_secondment_store || (existingFields.上午借调门店 || '');
        recordData.下午借调门店 = r.pm_secondment_store || (existingFields.下午借调门店 || '');

        // 更新记录
        const result = await callOpenAPI('/open-api/v1/data/records', {
          table_key: SCHEDULE_API.tableKey,
          id: existing.id,
          record: recordData
        }, 'PUT');
        if (result) successCount++;
      } else {
        // 不存在：新增
        recordData.上午出勤状态 = r.am_status ? toApiStatus(r.am_status, r.am_secondment_store) : '';
        recordData.下午出勤状态 = r.pm_status ? toApiStatus(r.pm_status, r.pm_secondment_store) : '';
        recordData.上午借调门店 = r.am_secondment_store || '';
        recordData.下午借调门店 = r.pm_secondment_store || '';

        const result = await callOpenAPI('/open-api/v1/data/records', {
          table_key: SCHEDULE_API.tableKey,
          records: [recordData]
        }, 'POST');
        if (result) successCount++;
      }
    }

    if (successCount > 0) {
      res.json(response(1, `保存成功，共处理 ${successCount} 条记录`));
    } else {
      res.status(500).json(response(0, '保存失败'));
    }
  } catch (err) {
    console.error('[Schedule] Error:', err.message);
    res.status(500).json(response(0, err.message));
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
