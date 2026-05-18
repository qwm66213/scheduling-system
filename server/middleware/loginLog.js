/**
 * 登录日志中间件
 * 记录登录成功/失败日志
 */

const pool = require('../db-mysql');

/**
 * 初始化登录日志表
 */
async function initLoginLogsTable() {
  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS login_logs (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT,
        username VARCHAR(50),
        ip VARCHAR(45) NOT NULL,
        user_agent VARCHAR(500),
        status ENUM('success', 'failed') NOT NULL,
        fail_reason VARCHAR(100),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        INDEX idx_ip (ip),
        INDEX idx_created_at (created_at)
      )
    `);
  } catch (err) {
    console.error('[LoginLogs] Init table failed:', err.message);
  }
}

// 启动时初始化表
initLoginLogsTable();

/**
 * 记录登录日志
 */
async function logLoginAttempt(data) {
  try {
    await pool.execute(
      'INSERT INTO login_logs (user_id, username, ip, user_agent, status, fail_reason) VALUES (?, ?, ?, ?, ?, ?)',
      [data.userId, data.username, data.ip, data.userAgent, data.status, data.failReason || null]
    );
  } catch (err) {
    console.error('[LoginLogs] Log failed:', err.message);
  }
}

/**
 * 登录日志中间件
 */
function loginLogMiddleware(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
  const userAgent = req.headers['user-agent'] || '';
  const { username } = req.body || {};

  // 记录原始的 res.json 方法
  const originalJson = res.json.bind(res);

  // 重写 res.json 方法
  res.json = async function(data) {
    try {
      // 登录成功
      if (data.status === 1 && data.data?.token) {
        await logLoginAttempt({
          userId: data.data.user?.id,
          username: data.data.user?.username || username,
          ip,
          userAgent,
          status: 'success'
        });
      }
      // 登录失败
      else if (data.status === 0) {
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
      console.error('[LoginLogs] res.json hook failed:', err.message);
    }
    return originalJson(data);
  };

  next();
}

/**
 * 获取登录日志
 */
async function getLoginLogs(options = {}) {
  const { userId, ip, status, limit = 100, offset = 0 } = options;

  let sql = 'SELECT * FROM login_logs WHERE 1=1';
  const params = [];

  if (userId) {
    sql += ' AND user_id = ?';
    params.push(userId);
  }
  if (ip) {
    sql += ' AND ip = ?';
    params.push(ip);
  }
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const [rows] = await pool.execute(sql, params);
  return rows;
}

/**
 * 清理旧日志（保留最近90天）
 */
async function cleanOldLogs() {
  try {
    await pool.execute(
      'DELETE FROM login_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY)'
    );
  } catch (err) {
    console.error('[LoginLogs] Clean failed:', err.message);
  }
}

// 每天清理一次旧日志
setInterval(cleanOldLogs, 24 * 60 * 60 * 1000);

module.exports = {
  loginLogMiddleware,
  logLoginAttempt,
  getLoginLogs,
  initLoginLogsTable
};
