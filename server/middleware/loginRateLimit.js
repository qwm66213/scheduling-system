/**
 * 登录频率限制中间件（数据库持久化版本）
 * 防止暴力破解
 */

const pool = require('../db-mysql');

// 配置
const MAX_ATTEMPTS = 5;           // 最大失败次数
const LOCK_TIME = 15 * 60 * 1000;  // 锁定时间：15分钟
const WINDOW_TIME = 30 * 60 * 1000; // 统计窗口：30分钟

/**
 * 初始化登录限制表
 */
async function initLoginAttemptsTable() {
  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS login_attempts (
        id INT PRIMARY KEY AUTO_INCREMENT,
        ip VARCHAR(45) NOT NULL,
        attempt_count INT DEFAULT 0,
        first_attempt_at DATETIME,
        locked_until DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_ip (ip),
        INDEX idx_locked_until (locked_until)
      )
    `);
  } catch (err) {
    console.error('[LoginRateLimit] Init table failed:', err.message);
  }
}

// 启动时初始化表
initLoginAttemptsTable();

/**
 * 清理过期记录（每小时执行一次）
 */
setInterval(async () => {
  try {
    await pool.execute(
      'DELETE FROM login_attempts WHERE locked_until < NOW() OR (locked_until IS NULL AND first_attempt_at < DATE_SUB(NOW(), INTERVAL 30 MINUTE))'
    );
  } catch (err) {
    console.error('[LoginRateLimit] Cleanup failed:', err.message);
  }
}, 60 * 60 * 1000);

/**
 * 检查是否被锁定
 */
async function isLocked(ip) {
  try {
    const [rows] = await pool.execute(
      'SELECT locked_until FROM login_attempts WHERE ip = ? AND locked_until > NOW()',
      [ip]
    );
    return rows.length > 0;
  } catch (err) {
    console.error('[LoginRateLimit] isLocked check failed:', err.message);
    return false;
  }
}

/**
 * 获取剩余锁定时间（秒）
 */
async function getRemainingLockTime(ip) {
  try {
    const [rows] = await pool.execute(
      'SELECT TIMESTAMPDIFF(SECOND, NOW(), locked_until) AS remaining FROM login_attempts WHERE ip = ? AND locked_until > NOW()',
      [ip]
    );
    return rows.length > 0 ? Math.max(0, Math.ceil(rows[0].remaining)) : 0;
  } catch (err) {
    console.error('[LoginRateLimit] getRemainingLockTime failed:', err.message);
    return 0;
  }
}

/**
 * 记录登录失败
 */
async function recordFailedAttempt(ip) {
  try {
    const now = new Date();

    // 检查是否存在记录
    const [existing] = await pool.execute(
      'SELECT id, attempt_count FROM login_attempts WHERE ip = ?',
      [ip]
    );

    if (existing.length === 0) {
      // 新记录
      await pool.execute(
        'INSERT INTO login_attempts (ip, attempt_count, first_attempt_at) VALUES (?, 1, ?)',
        [ip, now]
      );
    } else {
      // 更新记录
      const newCount = existing[0].attempt_count + 1;
      const lockedUntil = newCount >= MAX_ATTEMPTS ? new Date(now.getTime() + LOCK_TIME) : null;

      await pool.execute(
        'UPDATE login_attempts SET attempt_count = ?, locked_until = ? WHERE ip = ?',
        [newCount, lockedUntil, ip]
      );
    }
  } catch (err) {
    console.error('[LoginRateLimit] recordFailedAttempt failed:', err.message);
  }
}

/**
 * 清除失败记录（登录成功时调用）
 */
async function clearAttempts(ip) {
  try {
    await pool.execute('DELETE FROM login_attempts WHERE ip = ?', [ip]);
  } catch (err) {
    console.error('[LoginRateLimit] clearAttempts failed:', err.message);
  }
}

/**
 * 登录频率限制中间件
 */
async function loginRateLimit(req, res, next) {
  // 获取客户端 IP
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

    // 记录原始的 res.json 方法
    const originalJson = res.json.bind(res);

    // 重写 res.json 方法
    res.json = async function(data) {
      try {
        // 如果是登录失败（status === 0）
        if (data.status === 0 && data.errmsg?.includes('用户名或密码错误')) {
          await recordFailedAttempt(ip);
        }
        // 如果是登录成功（status === 1）
        else if (data.status === 1 && data.data?.token) {
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
    next(); // 出错时放行，不影响正常登录
  }
}

module.exports = {
  loginRateLimit,
  isLocked,
  getRemainingLockTime,
  recordFailedAttempt,
  clearAttempts,
  initLoginAttemptsTable
};
