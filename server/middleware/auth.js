const pool = require('../db-mysql');
const { verifyToken } = require('../utils/auth');

/**
 * 认证中间件：验证 JWT Token 并注入用户信息
 */
async function authMiddleware(req, res, next) {
  // 从 Authorization 头获取 Token
  const authHeader = req.headers['authorization'];
  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  // 兼容旧方式：从 x-user-id 头获取（仅用于过渡期）
  const legacyUserId = req.headers['x-user-id'];

  if (!token && !legacyUserId) {
    return res.status(401).json({ error: '未登录' });
  }

  try {
    let userId;

    if (token) {
      // JWT Token 验证
      const decoded = verifyToken(token);
      if (!decoded) {
        return res.status(401).json({ error: '登录已过期，请重新登录' });
      }
      userId = decoded.id;
    } else {
      // 兼容旧方式
      userId = legacyUserId;
    }

    // 查询用户信息
    const [rows] = await pool.execute(
      'SELECT id, username, role, store_id, real_name FROM users WHERE id = ? AND is_active = 1',
      [userId]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: '用户不存在或已禁用' });
    }

    const user = rows[0];
    req.user = user;
    console.log('[Auth] User:', user.username, 'role:', user.role);

    // 根据角色设置门店权限
    if (user.role === 'admin') {
      req.storeId = req.query.store_id || req.body?.store_id || 1;
    } else {
      req.storeId = user.store_id;
    }

    next();
  } catch (err) {
    console.error('[Auth] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
}

module.exports = authMiddleware;
