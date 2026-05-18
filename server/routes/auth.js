const express = require('express');
const router = express.Router();
const pool = require('../db-mysql');
const { hashPassword, comparePassword, generateToken, validatePasswordStrength, refreshAccessToken, verifyToken } = require('../utils/auth');
const { loginRateLimit } = require('../middleware/loginRateLimit');
const { loginLogMiddleware, getLoginLogs } = require('../middleware/loginLog');
const authMiddleware = require('../middleware/auth');

/**
 * 统一响应格式
 * @param {number} status 1=成功, 0=失败
 * @param {string} errmsg 错误消息
 * @param {object} data 数据
 */
function response(status, errmsg, data = null) {
  const result = { status, errmsg };
  if (data !== null) {
    result.data = data;
  }
  return result;
}

// 验证 Token 是否有效
router.get('/verify-token', authMiddleware, async (req, res) => {
  try {
    // authMiddleware 已验证 Token 并注入 req.user
    res.json(response(1, 'Token有效', {
      user: {
        id: req.user.id,
        username: req.user.username,
        role: req.user.role,
        real_name: req.user.real_name,
        store_id: req.user.store_id
      }
    }));
  } catch (err) {
    console.error('[VerifyToken] Error:', err.message);
    res.status(500).json(response(0, '验证失败'));
  }
});

// Token 刷新
router.post('/refresh-token', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json(response(0, '缺少刷新令牌'));
    }

    // 验证 refreshToken
    const decoded = verifyToken(refreshToken);
    if (!decoded || decoded.type !== 'refresh') {
      return res.status(401).json(response(0, '刷新令牌无效或已过期'));
    }

    // 从数据库查询用户信息
    const [rows] = await pool.execute(
      'SELECT id, username, role, is_active FROM users WHERE id = ?',
      [decoded.id]
    );

    if (rows.length === 0) {
      return res.status(401).json(response(0, '用户不存在'));
    }

    const user = rows[0];

    if (user.is_active !== 1) {
      return res.status(403).json(response(0, '账号已被禁用'));
    }

    // 生成新的 Token
    const { accessToken, refreshToken: newRefreshToken } = generateToken({
      id: user.id,
      username: user.username,
      role: user.role
    });

    res.json(response(1, '刷新成功', {
      token: accessToken,
      refreshToken: newRefreshToken
    }));
  } catch (err) {
    console.error('[RefreshToken] Error:', err.message);
    res.status(500).json(response(0, '令牌刷新失败'));
  }
});

// 登录（添加频率限制和日志记录）
router.post('/login', loginRateLimit, loginLogMiddleware, async (req, res) => {
  try {
    const { username, password } = req.body;

    // 参数校验
    if (!username || !password) {
      return res.status(400).json(response(0, '用户名和密码不能为空'));
    }

    // 查询用户
    const [rows] = await pool.execute(
      'SELECT id, username, password, role, real_name, store_id, is_active FROM users WHERE username = ?',
      [username]
    );

    // 用户不存在
    if (rows.length === 0) {
      return res.status(401).json(response(0, '用户名或密码错误'));
    }

    const user = rows[0];

    // 账号已禁用
    if (user.is_active !== 1) {
      return res.status(403).json(response(0, '账号已被禁用，请联系管理员'));
    }

    // 验证密码
    const isValid = await comparePassword(password, user.password);
    if (!isValid) {
      return res.status(401).json(response(0, '用户名或密码错误'));
    }

    // 生成 Token
    const { accessToken, refreshToken } = generateToken({
      id: user.id,
      username: user.username,
      role: user.role
    });

    // 返回用户信息（不含密码）和 Token
    res.json(response(1, '登录成功', {
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        real_name: user.real_name,
        store_id: user.store_id
      },
      token: accessToken,
      refreshToken
    }));
  } catch (err) {
    console.error('[Login] Error:', err.message);
    res.status(500).json(response(0, '登录失败，请稍后重试'));
  }
});

// 获取用户列表（需要 admin 权限）
router.get('/users', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, username, real_name, role, store_id, is_active, created_at FROM users ORDER BY id'
    );
    res.json(response(1, '获取成功', rows));
  } catch (err) {
    console.error('[GetUsers] Error:', err.message);
    res.status(500).json(response(0, '获取用户列表失败'));
  }
});

// 创建用户（需要 admin 权限）
router.post('/users', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { username, password, role, store_id, real_name } = req.body;

    // 参数校验
    if (!username || !password) {
      return res.status(400).json(response(0, '账号和密码不能为空'));
    }

    // 用户名格式校验
    if (username.length < 2 || username.length > 20) {
      return res.status(400).json(response(0, '用户名长度应为2-20个字符'));
    }

    // 验证密码复杂度
    const pwdCheck = validatePasswordStrength(password);
    if (!pwdCheck.valid) {
      return res.status(400).json(response(0, pwdCheck.error));
    }

    // 角色校验
    if (!['admin', 'manager'].includes(role)) {
      return res.status(400).json(response(0, '角色类型无效'));
    }

    if (role === 'manager' && !store_id) {
      return res.status(400).json(response(0, '系统管理员必须绑定门店'));
    }

    // 检查用户名是否已存在
    const [existing] = await pool.execute(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );
    if (existing.length > 0) {
      return res.status(400).json(response(0, '用户名已存在'));
    }

    // 加密密码
    const hashedPassword = await hashPassword(password);
    const storeId = role === 'admin' ? null : Number(store_id);

    const [result] = await pool.execute(
      'INSERT INTO users (username, password, role, store_id, real_name, is_active) VALUES (?, ?, ?, ?, ?, 1)',
      [username, hashedPassword, role, storeId, real_name || username]
    );
    res.json(response(1, '创建成功', { id: result.insertId }));
  } catch (err) {
    console.error('[CreateUser] Error:', err.message);
    res.status(500).json(response(0, '创建用户失败'));
  }
});

// 更新用户（需要 admin 权限）
router.put('/users/:id', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { role, password, is_active, store_id } = req.body;
    const userId = req.params.id;

    // 检查用户是否存在
    const [existing] = await pool.execute('SELECT id FROM users WHERE id = ?', [userId]);
    if (existing.length === 0) {
      return res.status(404).json(response(0, '用户不存在'));
    }

    let sql = 'UPDATE users SET role = ?';
    const params = [role];

    if (password) {
      const pwdCheck = validatePasswordStrength(password);
      if (!pwdCheck.valid) {
        return res.status(400).json(response(0, pwdCheck.error));
      }
      const hashedPassword = await hashPassword(password);
      sql += ', password = ?';
      params.push(hashedPassword);
    }
    if (is_active !== undefined) {
      sql += ', is_active = ?';
      params.push(is_active);
    }
    if (store_id !== undefined) {
      sql += ', store_id = ?';
      params.push(store_id);
    }
    sql += ' WHERE id = ?';
    params.push(userId);

    await pool.execute(sql, params);
    res.json(response(1, '更新成功'));
  } catch (err) {
    console.error('[UpdateUser] Error:', err.message);
    res.status(500).json(response(0, '更新用户失败'));
  }
});

// 删除用户（需要 admin 权限）
router.delete('/users/:id', authMiddleware, requireAdmin, async (req, res) => {
  try {
    // 不允许删除自己
    if (Number(req.params.id) === req.user.id) {
      return res.status(400).json(response(0, '不能删除自己的账号'));
    }

    // 检查用户是否存在
    const [existing] = await pool.execute('SELECT id FROM users WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json(response(0, '用户不存在'));
    }

    await pool.execute('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json(response(1, '删除成功'));
  } catch (err) {
    console.error('[DeleteUser] Error:', err.message);
    res.status(500).json(response(0, '删除用户失败'));
  }
});

// 修改密码（需要登录）
router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { oldPassword, newPassword } = req.body;

    // 参数校验
    if (!oldPassword || !newPassword) {
      return res.status(400).json(response(0, '旧密码和新密码不能为空'));
    }

    // 验证新密码复杂度
    const pwdCheck = validatePasswordStrength(newPassword);
    if (!pwdCheck.valid) {
      return res.status(400).json(response(0, pwdCheck.error));
    }

    if (oldPassword === newPassword) {
      return res.status(400).json(response(0, '新密码不能与旧密码相同'));
    }

    // 验证旧密码
    const [rows] = await pool.execute(
      'SELECT password FROM users WHERE id = ?',
      [userId]
    );
    if (rows.length === 0) {
      return res.status(404).json(response(0, '用户不存在'));
    }

    const isValid = await comparePassword(oldPassword, rows[0].password);
    if (!isValid) {
      return res.status(400).json(response(0, '旧密码错误'));
    }

    // 更新密码
    const hashedPassword = await hashPassword(newPassword);
    await pool.execute(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedPassword, userId]
    );

    // 返回成功，提示需要重新登录
    res.json(response(1, '密码修改成功，请重新登录'));
  } catch (err) {
    console.error('[ChangePassword] Error:', err.message);
    res.status(500).json(response(0, '密码修改失败'));
  }
});

// 获取登录日志（需要 admin 权限）
router.get('/login-logs', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { userId, ip, status, limit, offset } = req.query;
    const logs = await getLoginLogs({
      userId: userId ? Number(userId) : undefined,
      ip,
      status,
      limit: limit ? Number(limit) : 100,
      offset: offset ? Number(offset) : 0
    });
    res.json(response(1, '获取成功', logs));
  } catch (err) {
    console.error('[GetLoginLogs] Error:', err.message);
    res.status(500).json(response(0, '获取登录日志失败'));
  }
});

/**
 * 权限检查中间件：要求 admin 角色
 */
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json(response(0, '权限不足，需要超级管理员权限'));
  }
  next();
}

module.exports = router;
