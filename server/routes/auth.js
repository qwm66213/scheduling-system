const express = require('express');
const router = express.Router();
const {
  findUserByUsername,
  findUserByRecordKey,
  findAllUsers,
  createUser,
  updateUser,
  isUsernameExists,
  comparePassword,
  hashPassword
} = require('../utils/auth-openapi');
const { generateToken, validatePasswordStrength, verifyToken } = require('../utils/auth');
const { loginRateLimit } = require('../middleware/loginRateLimit-openapi');
const { loginLogMiddleware, getLoginLogs } = require('../middleware/loginLog-openapi');
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
        record_key: req.user.record_key,
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

    // 从 OpenAPI 查询用户信息
    const user = await findUserByRecordKey(decoded.record_key || decoded.id) || await findUserByUsername(decoded.id);

    if (!user) {
      return res.status(401).json(response(0, '用户不存在'));
    }

    if (!user.is_active) {
      return res.status(403).json(response(0, '账号已被禁用'));
    }

    // 生成新的 Token
    const { accessToken, refreshToken: newRefreshToken } = generateToken({
      id: user.id,
      record_key: user.record_key,
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

    // 从 OpenAPI 查询用户
    const user = await findUserByUsername(username);

    // 用户不存在
    if (!user) {
      return res.status(401).json(response(0, '用户名或密码错误'));
    }

    // 账号已禁用
    if (!user.is_active) {
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
      record_key: user.record_key,
      username: user.username,
      role: user.role
    });

    // 返回用户信息（不含密码）和 Token
    res.json(response(1, '登录成功', {
      user: {
        id: user.id,
        record_key: user.record_key,
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
    const users = await findAllUsers();
    res.json(response(1, '获取成功', users));
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
    const exists = await isUsernameExists(username);
    if (exists) {
      return res.status(400).json(response(0, '用户名已存在'));
    }

    // 创建用户
    const result = await createUser({
      username,
      password,
      role,
      store_id: role === 'admin' ? null : Number(store_id),
      real_name: real_name || username
    });

    if (result) {
      res.json(response(1, '创建成功', { id: result.record_key || result.id }));
    } else {
      res.status(500).json(response(0, '创建用户失败'));
    }
  } catch (err) {
    console.error('[CreateUser] Error:', err.message);
    res.status(500).json(response(0, '创建用户失败'));
  }
});

// 更新用户（需要 admin 权限）
router.put('/users/:id', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { role, password, is_active, store_id, real_name } = req.body;
    const userIdentifier = req.params.id;

    // 检查用户是否存在
    const user = await findUserByRecordKey(userIdentifier) || await findUserByUsername(userIdentifier);
    if (!user) {
      return res.status(404).json(response(0, '用户不存在'));
    }

    const updates = {};
    if (role) updates.role = role;
    if (password) {
      const pwdCheck = validatePasswordStrength(password);
      if (!pwdCheck.valid) {
        return res.status(400).json(response(0, pwdCheck.error));
      }
      updates.password = password;
    }
    if (is_active !== undefined) updates.is_active = is_active;
    if (store_id !== undefined) updates.store_id = store_id;
    if (real_name) updates.real_name = real_name;

    await updateUser(user.record_key, updates);
    res.json(response(1, '更新成功'));
  } catch (err) {
    console.error('[UpdateUser] Error:', err.message);
    res.status(500).json(response(0, '更新用户失败'));
  }
});

// 修改密码（需要登录）
router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const userRecordKey = req.user.record_key;
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

    // 从 OpenAPI 获取用户信息（包含密码哈希）
    const user = await findUserByRecordKey(userRecordKey);
    if (!user) {
      return res.status(404).json(response(0, '用户不存在'));
    }

    const isValid = await comparePassword(oldPassword, user.password);
    if (!isValid) {
      return res.status(400).json(response(0, '旧密码错误'));
    }

    // 更新密码
    await updateUser(userRecordKey, { password: newPassword });

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
