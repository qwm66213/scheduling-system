const pool = require('../db-mysql');

// 认证中间件：验证用户权限并注入 store_id
async function authMiddleware(req, res, next) {
  const userId = req.headers['x-user-id'];
  console.log('[Auth] userId from header:', userId);

  if (!userId) {
    return res.status(401).json({ error: '未登录' });
  }

  try {
    const [rows] = await pool.execute(
      'SELECT id, username, role, store_id FROM users WHERE id = ? AND is_active = 1',
      [userId]
    );

    if (rows.length === 0) {
      console.log('[Auth] User not found or disabled');
      return res.status(401).json({ error: '用户不存在或已禁用' });
    }

    const user = rows[0];
    req.user = user;
    console.log('[Auth] User:', user.username, 'role:', user.role);

    // 超级管理员：可以使用前端传递的 store_id，或默认查看金门店(store_id=1)
    // 系统管理员：强制使用自己的 store_id
    if (user.role === 'admin') {
      req.storeId = req.query.store_id || req.body?.store_id || 1;
    } else {
      req.storeId = user.store_id;
    }
    console.log('[Auth] Set storeId:', req.storeId);

    next();
  } catch (err) {
    console.error('[Auth] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
}

module.exports = authMiddleware;
