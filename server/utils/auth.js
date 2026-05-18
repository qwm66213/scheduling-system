const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// JWT 配置
// 生产环境必须通过环境变量设置 JWT_SECRET，否则使用默认值（不安全）
const JWT_SECRET = process.env.JWT_SECRET || '930-system-dev-secret-key-2024';
const JWT_EXPIRES_IN = '24h'; // Token 24小时过期
const JWT_REFRESH_EXPIRES_IN = '7d'; // 刷新 Token 7天过期

if (!process.env.JWT_SECRET) {
  console.warn('[WARN] JWT_SECRET 未设置，使用默认密钥，生产环境请配置环境变量！');
}

/**
 * 验证密码复杂度
 * 要求：至少8位，包含大小写字母、数字、特殊符号中的至少三种
 * @param {string} password 密码
 * @returns {object} { valid: boolean, error: string }
 */
function validatePasswordStrength(password) {
  if (!password || password.length < 8) {
    return { valid: false, error: '密码长度不能少于8位' };
  }

  // 统计包含的字符类型
  let typeCount = 0;
  const types = {
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
  };

  if (types.lowercase) typeCount++;
  if (types.uppercase) typeCount++;
  if (types.number) typeCount++;
  if (types.special) typeCount++;

  if (typeCount < 3) {
    return { valid: false, error: '密码必须包含大写字母、小写字母、数字、特殊符号中的至少三种' };
  }

  return { valid: true, error: '' };
}

/**
 * 密码加密
 * @param {string} password 明文密码
 * @returns {Promise<string>} 加密后的密码
 */
async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

/**
 * 验证密码
 * @param {string} password 明文密码
 * @param {string} hashedPassword 加密后的密码
 * @returns {Promise<boolean>} 是否匹配
 */
async function comparePassword(password, hashedPassword) {
  return bcrypt.compare(password, hashedPassword);
}

/**
 * 生成 JWT Token
 * @param {object} payload 用户信息
 * @returns {object} { accessToken, refreshToken }
 */
function generateToken(payload) {
  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  const refreshToken = jwt.sign(
    { id: payload.id, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRES_IN }
  );
  return { accessToken, refreshToken };
}

/**
 * 验证 JWT Token
 * @param {string} token Token
 * @returns {object|null} 解析后的用户信息，失败返回 null
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

/**
 * 刷新 Access Token
 * @param {string} refreshToken 刷新 Token
 * @returns {object|null} 新的 { accessToken, refreshToken }，失败返回 null
 */
function refreshAccessToken(refreshToken) {
  try {
    const decoded = jwt.verify(refreshToken, JWT_SECRET);
    if (decoded.type !== 'refresh') {
      return null;
    }
    // 生成新的 Token
    return generateToken({
      id: decoded.id,
      username: decoded.username,
      role: decoded.role
    });
  } catch (err) {
    return null;
  }
}

module.exports = {
  validatePasswordStrength,
  hashPassword,
  comparePassword,
  generateToken,
  verifyToken,
  refreshAccessToken,
  JWT_SECRET,
  JWT_EXPIRES_IN,
  JWT_REFRESH_EXPIRES_IN
};
