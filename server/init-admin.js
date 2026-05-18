/**
 * 数据库初始化脚本
 * 创建超级管理员账号
 *
 * 使用方法：node server/init-admin.js
 */

const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

// 超级管理员账号配置
const ADMIN_CONFIG = {
  username: 'qianwenmiao',
  password: 'Qwm4086..',
  role: 'admin',
  real_name: '钱文苗'
};

async function initAdmin() {
  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST || 'localhost',
    port: process.env.MYSQL_PORT || 3306,
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'root123',
    database: process.env.MYSQL_DATABASE || 'mydb',
    waitForConnections: true,
    connectionLimit: 10
  });

  console.log('开始初始化超级管理员账号...');

  try {
    // 1. 确保 users 表存在
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        username VARCHAR(50) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role ENUM('admin', 'manager') NOT NULL,
        store_id INT,
        real_name VARCHAR(50),
        is_active TINYINT DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ users 表已就绪');

    // 2. 检查账号是否已存在
    const [existing] = await pool.execute(
      'SELECT id FROM users WHERE username = ?',
      [ADMIN_CONFIG.username]
    );

    if (existing.length > 0) {
      console.log(`✓ 超级管理员账号 "${ADMIN_CONFIG.username}" 已存在`);
      return;
    }

    // 3. 加密密码
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(ADMIN_CONFIG.password, salt);
    console.log('✓ 密码已加密');

    // 4. 创建账号
    await pool.execute(
      'INSERT INTO users (username, password, role, real_name, is_active) VALUES (?, ?, ?, ?, 1)',
      [ADMIN_CONFIG.username, hashedPassword, ADMIN_CONFIG.role, ADMIN_CONFIG.real_name]
    );
    console.log(`✓ 超级管理员账号 "${ADMIN_CONFIG.username}" 创建成功`);
    console.log('');
    console.log('========== 账号信息 ==========');
    console.log(`用户名: ${ADMIN_CONFIG.username}`);
    console.log(`密码: ${ADMIN_CONFIG.password}`);
    console.log(`角色: 超级管理员`);
    console.log('==============================');
    console.log('');
    console.log('⚠️  请登录后立即修改密码！');

  } catch (err) {
    console.error('初始化失败:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

initAdmin();
