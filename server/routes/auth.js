const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: 'root123',
  database: 'mydb',
  waitForConnections: true,
  connectionLimit: 10
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const [rows] = await pool.execute(
      'SELECT id, username, role, real_name, store_id FROM users WHERE username = ? AND password = ? AND is_active = 1',
      [username, password]
    );
    if (rows.length === 0) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }
    res.json({ user: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/users', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT id, username, real_name, role, store_id, is_active, created_at FROM users ORDER BY id');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/users', async (req, res) => {
  try {
    const { username, password, role, store_id, real_name } = req.body;

    // 验证必填字段
    if (!username || !password) {
      return res.status(400).json({ error: '账号和密码不能为空' });
    }
    if (role === 'manager' && !store_id) {
      return res.status(400).json({ error: '系统管理员必须绑定门店' });
    }

    const storeId = role === 'admin' ? null : Number(store_id);
    const [result] = await pool.execute(
      'INSERT INTO users (username, password, role, store_id, real_name, is_active) VALUES (?, ?, ?, ?, ?, 1)',
      [username, password, role, storeId, real_name || username]
    );
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/users/:id', async (req, res) => {
  try {
    const { role, password, is_active, store_id } = req.body;
    let sql = 'UPDATE users SET role = ?';
    const params = [role];
    if (password) {
      sql += ', password = ?';
      params.push(password);
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
    params.push(req.params.id);
    await pool.execute(sql, params);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    await pool.execute('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
