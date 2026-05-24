const { verifyToken } = require('../utils/auth');
const { findUserByRecordKey, findUserByUsername } = require('../utils/auth-openapi');

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
      userId = decoded.record_key || decoded.id; // 支持新旧两种ID格式
    } else {
      // 兼容旧方式
      userId = legacyUserId;
    }

    // 从 OpenAPI 查询用户信息
    const user = await findUserByRecordKey(userId) || await findUserByUsername(userId);

    if (!user) {
      return res.status(401).json({ error: '用户不存在或已禁用' });
    }

    if (!user.is_active) {
      return res.status(401).json({ error: '用户不存在或已禁用' });
    }

    req.user = user;
    console.log('[Auth] User:', user.username, 'role:', user.role);

    // 根据角色设置门店权限
    if (user.role === 'admin') {
      const storeIdParam = req.query.store_id || req.body?.store_id;
      // 空字符串、'all' 都表示全部门店，设置 req.storeId = null
      if (!storeIdParam || storeIdParam === 'all') {
        req.storeId = null;
      } else {
        req.storeId = Number(storeIdParam);
      }
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
