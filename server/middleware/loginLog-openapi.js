/**
 * 登录日志中间件（OpenAPI版本）
 */

const { createRecord, findRecords } = require('../utils/openapi');

// 登录日志表配置
const LOGIN_LOGS_TABLE_KEY = 'tb_97ed403b695f3';

/**
 * 记录登录日志
 * @param {object} data 日志数据
 */
async function logLoginAttempt(data) {
  try {
    // 生成唯一标题（时间戳 + 随机数）
    const title = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const fields = {
      '标题': title,
      '用户ID': data.userId ? String(data.userId) : '',
      '用户名': data.username || 'unknown',
      'IP地址': data.ip || 'unknown',
      '用户代理': data.userAgent || '',
      '状态': data.status,
      '失败原因': data.failReason || ''
    };

    await createRecord(LOGIN_LOGS_TABLE_KEY, fields);
  } catch (err) {
    console.error('[LoginLog] Log failed:', err.message);
  }
}

/**
 * 登录日志中间件
 */
function loginLogMiddleware(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
  const userAgent = req.headers['user-agent'] || '';
  const { username } = req.body || {};

  // 保存当前的 res.json（可能已被其他中间件重写为 async）
  const prevJson = res.json.bind(res);

  res.json = async function(data) {
    try {
      if (data.status === 1 && data.data?.token) {
        await logLoginAttempt({
          userId: data.data.user?.record_key || data.data.user?.id,
          username: data.data.user?.username || username,
          ip,
          userAgent,
          status: 'success'
        });
      } else if (data.status === 0) {
        await logLoginAttempt({
          userId: null,
          username: username || 'unknown',
          ip,
          userAgent,
          status: 'failed',
          failReason: data.errmsg || 'unknown'
        });
      }
    } catch (err) {
      console.error('[LoginLog] res.json hook failed:', err.message);
    }
    // await 以支持 prevJson 可能是 async 函数
    return await prevJson(data);
  };

  next();
}

/**
 * 获取登录日志
 * @param {object} options 查询选项
 * @returns {Promise<array>}
 */
async function getLoginLogs(options = {}) {
  const { userId, ip, status, limit = 100, offset = 0 } = options;

  const filters = [];
  if (userId) filters.push(`用户ID:eq:${userId}`);
  if (ip) filters.push(`IP地址:eq:${ip}`);
  if (status) filters.push(`状态:eq:${status}`);

  const records = await findRecords(LOGIN_LOGS_TABLE_KEY, filters, limit);

  return records.map(record => {
    const f = record.fields || {};
    return {
      id: record.record_key,
      record_key: record.record_key,
      user_id: f['用户ID'] || null,
      username: f['用户名'],
      ip: f['IP地址'],
      user_agent: f['用户代理'],
      status: f['状态'],
      fail_reason: f['失败原因'],
      created_at: f['创建时间']
    };
  });
}

module.exports = {
  loginLogMiddleware,
  logLoginAttempt,
  getLoginLogs
};