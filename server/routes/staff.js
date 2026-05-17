const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const authMiddleware = require('../middleware/auth');

const pool = mysql.createPool({
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: 'root123',
  database: 'mydb',
  waitForConnections: true,
  connectionLimit: 10
});

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const { position, employment_status } = req.query;
    let sql = 'SELECT * FROM employee_profile WHERE 1=1';
    const params = [];
    if (req.storeId) { sql += ' AND store_id = ?'; params.push(req.storeId); }
    if (position) { sql += ' AND position = ?'; params.push(position); }
    if (employment_status) { sql += ' AND employment_status = ?'; params.push(employment_status); }
    sql += ' ORDER BY id';
    const [rows] = await pool.execute(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, employment_status, business_line, position, monthly_salary, daily_salary, employment_type, secondment_status } = req.body;
    const [result] = await pool.execute(
      'INSERT INTO employee_profile (name, employment_status, business_line, position, monthly_salary, daily_salary, employment_type, secondment_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [name, employment_status || '在职', business_line || '', position || '', monthly_salary || 0, daily_salary || 0, employment_type || '全职', secondment_status || 0]
    );
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, employment_status, business_line, position, monthly_salary, daily_salary, employment_type, secondment_status } = req.body;
    await pool.execute(
      'UPDATE employee_profile SET name=?, employment_status=?, business_line=?, position=?, monthly_salary=?, daily_salary=?, employment_type=?, secondment_status=? WHERE id=?',
      [name, employment_status, business_line || '', position || '', monthly_salary || 0, daily_salary || 0, employment_type || '全职', secondment_status || 0, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.execute('DELETE FROM employee_profile WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
