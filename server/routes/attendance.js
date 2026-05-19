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

function formatDate(d) {
  if (!d) return d;
  if (d instanceof Date) {
    const offset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - offset * 60000);
    return local.toISOString().slice(0, 10);
  }
  const s = String(d);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return s;
}

// GET 考勤记录 for a month
router.get('/', async (req, res) => {
  try {
    const { month } = req.query;
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json(response(0, 'month format required: YYYY-MM'));
    }

    const startDate = `${month}-01`;
    const [nextMonth] = await pool.execute(
      'SELECT DATE_FORMAT(DATE_ADD(?, INTERVAL 1 MONTH), "%Y-%m-01") AS nm',
      [startDate]
    );
    const endDate = nextMonth[0].nm;

    let sql = 'SELECT a.id, a.employee_id, a.schedule_date, a.period, a.status, a.secondment_store, e.name, e.position, e.business_line, e.employment_type, e.secondment_status ' +
      'FROM attendance_record a JOIN employee_profile e ON a.employee_id = e.id WHERE a.schedule_date >= ? AND a.schedule_date < ?';
    const params = [startDate, endDate];
    if (req.storeId) {
      sql += ' AND e.store_id = ?';
      params.push(req.storeId);
    }
    sql += ' ORDER BY a.schedule_date, a.period, e.id';
    const [rows] = await pool.execute(sql, params);

    const result = rows.map(r => ({
      id: r.id,
      employee_id: r.employee_id,
      date: formatDate(r.schedule_date),
      period: r.period,
      status: r.status,
      secondment_store: r.secondment_store || '',
      name: r.name,
      position: r.position,
      business_line: r.business_line,
      employment_type: r.employment_type,
      secondment_status: r.secondment_status
    }));

    res.json(response(1, '获取成功', result));
  } catch (err) {
    console.error('[Attendance] Error:', err.message);
    res.status(500).json(response(0, err.message));
  }
});

// POST batch save 考勤
router.post('/batch', async (req, res) => {
  try {
    const { records } = req.body;
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json(response(0, 'records array required'));
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      for (const r of records) {
        const { employee_id, date, period, status, secondment_store } = r;
        if (!employee_id || !date || !period) continue;

        const [existing] = await conn.execute(
          'SELECT id FROM attendance_record WHERE employee_id = ? AND schedule_date = ? AND period = ?',
          [employee_id, date, period]
        );

        if (existing.length > 0) {
          await conn.execute(
            'UPDATE attendance_record SET status = ?, secondment_store = ? WHERE id = ?',
            [status || '', secondment_store || null, existing[0].id]
          );
        } else {
          await conn.execute(
            'INSERT INTO attendance_record (employee_id, schedule_date, period, status, secondment_store) VALUES (?, ?, ?, ?, ?)',
            [employee_id, date, period, status || '', secondment_store || null]
          );
        }
      }

      await conn.commit();
      res.json(response(1, '保存成功'));
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('[Attendance] Error:', err.message);
    res.status(500).json(response(0, err.message));
  }
});

// PUT update single record
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, secondment_store } = req.body;

    await pool.execute(
      'UPDATE attendance_record SET status = ?, secondment_store = ? WHERE id = ?',
      [status || '', secondment_store || null, id]
    );

    res.json(response(1, '更新成功'));
  } catch (err) {
    console.error('[Attendance] Error:', err.message);
    res.status(500).json(response(0, err.message));
  }
});

// GET monthly 考勤 summary
router.get('/summary', async (req, res) => {
  try {
    const { month } = req.query;
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json(response(0, 'month format required: YYYY-MM'));
    }

    const startDate = `${month}-01`;
    const [nextMonth] = await pool.execute(
      'SELECT DATE_FORMAT(DATE_ADD(?, INTERVAL 1 MONTH), "%Y-%m-01") AS nm',
      [startDate]
    );
    const endDate = nextMonth[0].nm;

    // Get all active employees first
    let empSql = 'SELECT id, name, position, business_line, monthly_salary, daily_salary FROM employee_profile WHERE employment_status = "在职"';
    const empParams = [];
    if (req.storeId) {
      empSql += ' AND store_id = ?';
      empParams.push(req.storeId);
    }
    empSql += ' ORDER BY id';
    const [employees] = await pool.execute(empSql, empParams);

    // Get 考勤 records for the month
    const [rows] = await pool.execute(
      'SELECT a.employee_id, a.period, a.status ' +
      'FROM attendance_record a ' +
      'WHERE a.schedule_date >= ? AND a.schedule_date < ? AND a.status != ""',
      [startDate, endDate]
    );

    // Build 考勤 map by employee_id
    const attMap = {};
    for (const r of rows) {
      if (!attMap[r.employee_id]) {
        attMap[r.employee_id] = { check: 0, leave: 0, absent: 0, save: 0, annual: 0, second: 0 };
      }
      const half = r.period === 'am' || r.period === 'pm' ? 0.5 : 1;
      if (attMap[r.employee_id][r.status] !== undefined) {
        attMap[r.employee_id][r.status] += half;
      }
    }

    // Combine: every employee appears, 考勤 defaults to 0
    const result = employees.map(e => {
      const att = attMap[e.id] || { check: 0, leave: 0, absent: 0, save: 0, annual: 0, second: 0 };
      const salary_days = Math.max(0, att.check + att.annual + att.save + att.leave - att.absent * 2);
      const daily_salary = Number(e.daily_salary) || 0;
      return {
        employee_id: e.id,
        name: e.name,
        position: e.position,
        business_line: e.business_line,
        monthly_salary: Number(e.monthly_salary) || 0,
        daily_salary: daily_salary,
        check: att.check,
        leave: att.leave,
        absent: att.absent,
        save: att.save,
        annual: att.annual,
        second: att.second,
        salary_days,
        salary_pay: Math.round(daily_salary * salary_days * 100) / 100
      };
    });

    res.json(response(1, '获取成功', result));
  } catch (err) {
    console.error('[Attendance] Error:', err.message);
    res.status(500).json(response(0, err.message));
  }
});

module.exports = router;
