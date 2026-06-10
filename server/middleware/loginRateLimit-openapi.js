/**
 * 登录频率限制中间件（OpenAPI版本）
 * 防止暴力破解
 */

const { findRecordByTitle, createRecord, updateRecord } = require('../utils/openapi');

// 登录尝试表配置
const LOGIN_ATTEMPTS_TABLE_KEY = 'tb_b7440ebfcd35b';

// 配置参数
const MAX_ATTEMPTS = 5;           // 最大失败次数
const LOCK_TIME = 60 * 1000;       // 锁定时间：60秒
const WINDOW_TIME = 5 * 60 * 1000; // 统计窗口：5分钟

/**
 * 检查是否被锁定
 * @param {string} ip 客户端IP
 * @returns {Promise<boolean>}
 */
async function isLocked(ip) {
  try {
    const record = await findRecordByTitle(LOGIN_ATTEMPTS_TABLE_KEY, ip);
    if (!record) return false;

    const f = record.fields || {};
    const lockedUntil = f['锁定截止时间'];

    if (!lockedUntil) return false;

    // 检查锁定时间是否已过期
    const lockTime = new Date(lockedUntil);
    return lockTime > new Date();
  } catch (err) {
    console.error('[LoginRateLimit] isLocked check failed:', err.message);
    return false;
  }
}

/**
 * 获取剩余锁定时间（秒）
 * @param {string} ip 客户端IP
 * @returns {Promise<number>}
 */
async function getRemainingLockTime(ip) {
  try {
    const record = await findRecordByTitle(LOGIN_ATTEMPTS_TABLE_KEY, ip);
    if (!record) return 0;

    const f = record.fields || {};
    const lockedUntil = f['锁定截止时间'];

    if (!lockedUntil) return 0;

    const lockTime = new Date(lockedUntil);
    const now = new Date();
    const remaining = Math.ceil((lockTime - now) / 1000);

    return Math.max(0, remaining);
  } catch (err) {
    console.error('[LoginRateLimit] getRemainingLockTime failed:', err.message);
    return 0;
  }
}

/**
 * 记录登录失败
 * @param {string} ip 客户端IP
 */
async function recordFailedAttempt(ip) {
  try {
    const now = new Date();
    const record = await findRecordByTitle(LOGIN_ATTEMPTS_TABLE_KEY, ip);

    // 使用 ISO 格式存储时间，确保解析一致
    const timeStr = now.toISOString();

    if (!record) {
      // 新记录
      await createRecord(LOGIN_ATTEMPTS_TABLE_KEY, {
        '标题': ip,
        'IP地址': ip,
        '失败次数': 1,
        '首次尝试时间': timeStr,
        '锁定截止时间': ''
      });
    } else {
      // 更新记录
      const f = record.fields || {};
      const newCount = (f['失败次数'] || 0) + 1;

      // 检查是否在统计窗口内
      const firstAttemptTime = new Date(f['首次尝试时间']);

      if (now - firstAttemptTime > WINDOW_TIME) {
        // 超过窗口时间，重新计数
        await updateRecord(LOGIN_ATTEMPTS_TABLE_KEY, record.record_key, {
          '失败次数': 1,
          '首次尝试时间': now.toISOString(),
          '锁定截止时间': ''
        });
      } else {
        // 在窗口内，累加计数
        const lockedUntil = newCount >= MAX_ATTEMPTS
          ? new Date(now.getTime() + LOCK_TIME).toISOString()
          : '';

        await updateRecord(LOGIN_ATTEMPTS_TABLE_KEY, record.record_key, {
          '失败次数': newCount,
          '锁定截止时间': lockedUntil
        });
      }
    }
  } catch (err) {
    console.error('[LoginRateLimit] recordFailedAttempt failed:', err.message);
  }
}

/**
 * 清除失败记录（登录成功时调用）
 * @param {string} ip 客户端IP
 */
async function clearAttempts(ip) {
  try {
    const record = await findRecordByTitle(LOGIN_ATTEMPTS_TABLE_KEY, ip);
    if (record) {
      await updateRecord(LOGIN_ATTEMPTS_TABLE_KEY, record.record_key, {
        '失败次数': 0,
        '锁定截止时间': ''
      });
    }
  } catch (err) {
    console.error('[LoginRateLimit] clearAttempts failed:', err.message);
  }
}

/**
 * 登录频率限制中间件
 */
async function loginRateLimit(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';

  try {
    // 检查是否被锁定
    const locked = await isLocked(ip);
    if (locked) {
      const remaining = await getRemainingLockTime(ip);
      return res.status(429).json({
        status: 0,
        errmsg: `登录失败次数过多，请 ${remaining} 秒后重试`
      });
    }

    // 重写 res.json 方法，在响应后记录结果
    const originalJson = res.json.bind(res);
    res.json = async function(data) {
      try {
        if (data.status === 0 && data.errmsg?.includes('用户名或密码错误')) {
          await recordFailedAttempt(ip);
        } else if (data.status === 1 && data.data?.token) {
          await clearAttempts(ip);
        }
      } catch (err) {
        console.error('[LoginRateLimit] res.json hook failed:', err.message);
      }
      return originalJson(data);
    };

    next();
  } catch (err) {
    console.error('[LoginRateLimit] Middleware error:', err.message);
    next(); // 出错时放行
  }
}

module.exports = {
  loginRateLimit,
  isLocked,
  getRemainingLockTime,
  recordFailedAttempt,
  clearAttempts
};