const express = require('express');
const router = express.Router();
const pool = require('../db-mysql');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

/**
 * 统一响应格式
 */
function response(status, errmsg, data = null) {
  const result = { status, errmsg };
  if (data !== null) {
    result.data = data;
  }
  return result;
}

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
    res.json(response(1, '获取成功', rows));
  } catch (err) {
    console.error('[Staff] Error:', err.message);
    res.status(500).json(response(0, err.message));
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, employment_status, business_line, position, monthly_salary, daily_salary, employment_type, secondment_status, store_id } = req.body;
    const [result] = await pool.execute(
      'INSERT INTO employee_profile (name, employment_status, business_line, position, monthly_salary, daily_salary, employment_type, secondment_status, store_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name, employment_status || '在职', business_line || '', position || '', monthly_salary || 0, daily_salary || 0, employment_type || '全职', secondment_status || 0, store_id || req.storeId]
    );
    res.json(response(1, '创建成功', { id: result.insertId }));
  } catch (err) {
    console.error('[Staff] Error:', err.message);
    res.status(500).json(response(0, err.message));
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, employment_status, business_line, position, monthly_salary, daily_salary, employment_type, secondment_status, store_id } = req.body;
    await pool.execute(
      'UPDATE employee_profile SET name=?, employment_status=?, business_line=?, position=?, monthly_salary=?, daily_salary=?, employment_type=?, secondment_status=?, store_id=? WHERE id=?',
      [name, employment_status, business_line || '', position || '', monthly_salary || 0, daily_salary || 0, employment_type || '全职', secondment_status || 0, store_id || req.storeId, req.params.id]
    );
    res.json(response(1, '更新成功'));
  } catch (err) {
    console.error('[Staff] Error:', err.message);
    res.status(500).json(response(0, err.message));
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.execute('DELETE FROM employee_profile WHERE id=?', [req.params.id]);
    res.json(response(1, '删除成功'));
  } catch (err) {
    console.error('[Staff] Error:', err.message);
    res.status(500).json(response(0, err.message));
  }
});

module.exports = router;
