/**
 * 初始化超级管理员账号（OpenAPI版本）
 */

const { findUserByUsername, createUser } = require('./utils/auth-openapi');

const ADMIN_CONFIG = {
  username: 'qianwenmiao',
  password: 'Qwm4086..',
  role: 'admin',
  real_name: '钱文苗'
};

async function initAdmin() {
  console.log('开始初始化超级管理员账号...');

  try {
    // 检查账号是否已存在
    const exists = await findUserByUsername(ADMIN_CONFIG.username);

    if (exists) {
      console.log(`✓ 超级管理员账号 "${ADMIN_CONFIG.username}" 已存在`);
      return;
    }

    // 创建账号
    await createUser(ADMIN_CONFIG);

    console.log(`✓ 超级管理员账号 "${ADMIN_CONFIG.username}" 创建成功`);
    console.log('');
    console.log('========== 账号信息 ==========');
    console.log(`用户名: ${ADMIN_CONFIG.username}`);
    console.log(`密码: ${ADMIN_CONFIG.password}`);
    console.log('==============================');
    console.log('');
    console.log('⚠️  请登录后立即修改密码！');

  } catch (err) {
    console.error('初始化失败:', err.message);
    process.exit(1);
  }
}

initAdmin();
