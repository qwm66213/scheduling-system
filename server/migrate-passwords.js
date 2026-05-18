/**
 * 数据库密码迁移脚本
 * 将明文密码转换为 bcrypt 加密密码
 *
 * 使用方法：node server/migrate-passwords.js
 */

const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function migrate() {
  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST || 'localhost',
    port: process.env.MYSQL_PORT || 3306,
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'root123',
    database: process.env.MYSQL_DATABASE || 'mydb',
    waitForConnections: true,
    connectionLimit: 10
  });

  console.log('开始迁移密码...');

  try {
    // 获取所有用户
    const [users] = await pool.execute('SELECT id, username, password FROM users');
    console.log(`找到 ${users.length} 个用户`);

    for (const user of users) {
      // 检查是否已经是 bcrypt 格式（以 $2a$ 或 $2b$ 开头）
      if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
        console.log(`用户 ${user.username} 密码已是加密格式，跳过`);
        continue;
      }

      // 加密密码
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(user.password, salt);

      // 更新数据库
      await pool.execute(
        'UPDATE users SET password = ? WHERE id = ?',
        [hashedPassword, user.id]
      );
      console.log(`用户 ${user.username} 密码已加密`);
    }

    console.log('密码迁移完成！');
  } catch (err) {
    console.error('迁移失败:', err.message);
  } finally {
    await pool.end();
  }
}

migrate();
