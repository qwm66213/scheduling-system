/**
 * OpenAPI 统一调用工具
 * 所有模块共享此工具，避免重复代码
 */

const http = require('http');

// OpenAPI 基础配置
const OPEN_API_BASE = {
  token: 'emoo_W7ExdLzLIff1VI8WEFHV8y3a_nb1mOGD6_ZrRroA',
  userId: '{{Emoo-User-Id}}',
  hostname: 'localhost'
};

/**
 * 调用 OpenAPI
 * @param {string} path API路径
 * @param {object} postData POST数据
 * @param {string} method POST或PUT
 * @returns {Promise<object|null>}
 */
function callOpenAPI(path, postData, method = 'POST') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: OPEN_API_BASE.hostname,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Bearer ${OPEN_API_BASE.token}`,
        'Emoo-User-Id': OPEN_API_BASE.userId
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
            console.error('[OpenAPI] API error:', json.code, json.message);
            resolve(null);
          }
        } catch (e) {
          console.error('[OpenAPI] Parse error:', e.message);
          resolve(null);
        }
      });
    });
    req.on('error', e => {
      console.error('[OpenAPI] Request error:', e.message);
      resolve(null);
    });
    req.write(JSON.stringify(postData));
    req.end();
  });
}

/**
 * 查询记录（按标题精确查询）
 * @param {string} tableKey 表key
 * @param {string} title 标题
 * @returns {Promise<object|null>}
 */
async function findRecordByTitle(tableKey, title) {
  const postData = {
    table_key: tableKey,
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

/**
 * 查询记录（按条件）
 * @param {string} tableKey 表key
 * @param {array} filters 过滤条件数组
 * @param {number} pageSize 分页大小
 * @returns {Promise<array>}
 */
async function findRecords(tableKey, filters = [], pageSize = 100) {
  const postData = {
    table_key: tableKey,
    page_size: pageSize,
    current_page: 1,
    filters: filters,
    sort: 'created_at:DESC'
  };
  const data = await callOpenAPI('/open-api/v1/data/records/list', postData);
  return data?.results || [];
}

/**
 * 创建记录
 * @param {string} tableKey 表key
 * @param {object} fields 字段数据
 * @returns {Promise<object|null>}
 */
async function createRecord(tableKey, fields) {
  if (!fields['标题']) {
    console.error('[OpenAPI] 创建记录失败：标题字段必须存在');
    return null;
  }

  const postData = {
    table_key: tableKey,
    records: [fields]
  };
  return callOpenAPI('/open-api/v1/data/records', postData, 'POST');
}

/**
 * 更新记录
 * @param {string} tableKey 表key
 * @param {string} recordKey 记录key
 * @param {object} fields 要更新的字段
 * @returns {Promise<object|null>}
 */
async function updateRecord(tableKey, recordKey, fields) {
  const postData = {
    table_key: tableKey,
    record_key: recordKey,
    fields: fields
  };
  return callOpenAPI('/open-api/v1/data/records', postData, 'PUT');
}

module.exports = {
  OPEN_API_BASE,
  callOpenAPI,
  findRecordByTitle,
  findRecords,
  createRecord,
  updateRecord
};