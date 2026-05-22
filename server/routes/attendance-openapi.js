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
const ATTENDANCE_API = {
  token: 'emoo_1qTLvYd7MO6IUN0KUxrIPYJSDPUCZqS8ItVi3Abh',
  userId: '{{Emoo-User-Id}}',
  tableKey: 'tb_cf08506299b28'
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
        'Authorization': `Bearer ${ATTENDANCE_API.token}`,
        'Emoo-User-Id': ATTENDANCE_API.userId
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
            console.error('[Attendance] API error:', json.code, json.message);
            resolve(null);
          }
        } catch (e) {
          console.error('[Attendance] Parse error:', e.message);
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
    table_key: ATTENDANCE_API.tableKey,
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

// 分页查询所有考勤记录
async function fetchAllRecords(storeName) {
  const allResults = [];
  let currentPage = 1;
  const pageSize = 100;

  while (true) {
    const postData = {
      table_key: ATTENDANCE_API.tableKey,
      page_size: pageSize,
      current_page: currentPage,
      filters: [`所属门店:eq:${storeName}`],
      sort: 'created_at:DESC'
    };

    const data = await callOpenAPI('/open-api/v1/data/records/list', postData);

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

  return allResults;
}

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
  if (statusMap[status]) {
    return statusMap[status];
  }
  if (status && status.length === 1 && !statusMap[status]) {
    return 'second';
  }
  return status;
}

// 将前端状态转换为 OpenAPI 的状态
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

// GET 考勤记录（月度查询）
router.get('/', async (req, res) => {
  try {
    const { month } = req.query;
    console.log('[Attendance] Query params:', { month, store_id: req.query.store_id, reqStoreId: req.storeId });

    if (!month) {
      return res.status(400).json(response(0, 'month required'));
    }

    // 根据 month 计算 start_date 和 end_date
    const [year, m] = month.split('-').map(Number);
    const start_date = `${year}-${String(m).padStart(2, '0')}-01`;
    const lastDay = new Date(year, m, 0).getDate();
    const end_date = `${year}-${String(m).padStart(2, '0')}-${lastDay}`;

    const storeId = Number(req.query.store_id) || req.storeId;
    const storeName = STORE_ID_TO_NAME[storeId];
    console.log('[Attendance] storeId:', storeId, 'storeName:', storeName);

    // 必须有门店筛选才能查询（OpenAPI 要求）
    if (!storeName) {
      return res.json(response(1, '获取成功', []));
    }

    // 分页查询所有考勤数据
    const allResults = await fetchAllRecords(storeName);
    console.log('[Attendance] Total records:', allResults.length);

    // 过滤日期范围并转换字段
    const result = [];
    for (const item of allResults) {
      const f = item.fields || {};
      const date = f.日期 || '';
      if (date < start_date || date > end_date) continue;

      const baseRecord = {
        employee_id: f.员工编码 || '',
        date: date,
        name: f.姓名 || '',
        position: f.岗位 || '',
        business_line: f.工作名 || ''
      };

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
        if (f.上午出勤状态) {
          result.push({
            ...baseRecord,
            period: 'am',
            status: convertStatus(f.上午出勤状态),
            secondment_store: f.上午借调门店 || ''
          });
        }

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

    res.json(response(1, '获取成功', result));
  } catch (err) {
    console.error('[Attendance] Error:', err.message);
    res.status(500).json(response(0, err.message));
  }
});

// POST 批量保存考勤
router.post('/batch', async (req, res) => {
  try {
    const { records } = req.body;
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json(response(0, 'records array required'));
    }

    const storeId = records[0]?.store_id || req.storeId;
    const storeName = STORE_ID_TO_NAME[storeId] || '';
    console.log('[Attendance] Batch save, storeId:', storeId, 'storeName:', storeName);
    let successCount = 0;

    // 按 日期+员工编码 分组，合并上午和下午状态
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
          hours: 0,
          isHourly: r.status === 'hours'
        };
      }
      if (r.status === 'hours') {
        grouped[key].hours = r.hours || 0;
        grouped[key].isHourly = true;
      } else {
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

      const existing = await findExistingRecord(title);

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
        const updateFields = {};

        if (r.isHourly) {
          updateFields.小时工工时 = r.hours;
        } else {
          if (r.am_status) {
            updateFields.上午出勤状态 = toApiStatus(r.am_status, r.am_secondment_store);
            updateFields.上午借调门店 = r.am_secondment_store || '';
          }

          if (r.pm_status) {
            updateFields.下午出勤状态 = toApiStatus(r.pm_status, r.pm_secondment_store);
            updateFields.下午借调门店 = r.pm_secondment_store || '';
          }
        }

        const result = await callOpenAPI('/open-api/v1/data/records', {
          table_key: ATTENDANCE_API.tableKey,
          record_key: existing.record_key,
          fields: updateFields
        }, 'PUT');
        if (result) successCount++;
      } else {
        if (r.isHourly) {
          recordData.小时工工时 = r.hours;
          recordData.上午出勤状态 = '';
          recordData.下午出勤状态 = '';
          recordData.上午借调门店 = '';
          recordData.下午借调门店 = '';
        } else {
          recordData.小时工工时 = 0;
          recordData.上午出勤状态 = r.am_status ? toApiStatus(r.am_status, r.am_secondment_store) : '';
          recordData.下午出勤状态 = r.pm_status ? toApiStatus(r.pm_status, r.pm_secondment_store) : '';
          recordData.上午借调门店 = r.am_secondment_store || '';
          recordData.下午借调门店 = r.pm_secondment_store || '';
        }

        const result = await callOpenAPI('/open-api/v1/data/records', {
          table_key: ATTENDANCE_API.tableKey,
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
    console.error('[Attendance] Error:', err.message);
    res.status(500).json(response(0, '失败'));
  }
});

// GET 月度汇总（暂时返回空数据）
router.get('/summary', async (req, res) => {
  try {
    res.json(response(1, '获取成功', []));
  } catch (err) {
    console.error('[Attendance] Error:', err.message);
    res.status(500).json(response(0, err.message));
  }
});

module.exports = router;