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
  connectionLimit: 10,
  timezone: '+08:00',
  dateStrings: true
});

router.use(authMiddleware);

// GET /api/personal-summary?start_date=&end_date=
router.get('/', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'start_date and end_date required' });
    }
    let sql = 'SELECT ps.id, ps.summary_date, ps.employee_name, ps.front_check_count, ps.back_check_count, ps.bonus, e.business_line, e.position ' +
      'FROM personal_summary ps LEFT JOIN employee_profile e ON ps.employee_name = e.name WHERE ps.summary_date >= ? AND ps.summary_date <= ?';
    const params = [start_date, end_date];
    if (req.storeId) { sql += ' AND ps.store_id = ?'; params.push(req.storeId); }
    sql += ' ORDER BY ps.summary_date, e.business_line, e.id';
    const [rows] = await pool.execute(sql, params);
    const result = rows.map(r => ({
      id: r.id,
      date: r.summary_date instanceof Date ? r.summary_date.toISOString().slice(0, 10) : String(r.summary_date).slice(0, 10),
      employee_name: r.employee_name,
      business_line: r.business_line || '',
      position: r.position || '',
      front_check_count: Number(r.front_check_count),
      back_check_count: Number(r.back_check_count),
      bonus: Number(r.bonus)
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/personal-summary/generate  { date: '2026-05-13' }
router.post('/generate', async (req, res) => {
  try {
    const { date } = req.body;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'date format required: YYYY-MM-DD' });
    }

    // 1. 从 daily_summary 取当日 front_bonus 和 back_bonus
    const [dsRows] = await pool.execute(
      'SELECT front_bonus, back_bonus FROM daily_summary WHERE summary_date = ?',
      [date]
    );
    const frontBonus = dsRows.length > 0 ? Number(dsRows[0].front_bonus) : 0;
    const backBonus = dsRows.length > 0 ? Number(dsRows[0].back_bonus) : 0;

    // 2. 查所有在职员工
    const [employees] = await pool.execute(
      'SELECT id, name, business_line FROM employee_profile WHERE employment_status = "在职" ORDER BY id'
    );

    // 3. 查当日考勤
    const [attRows] = await pool.execute(
      'SELECT a.employee_id, a.period, a.status FROM attendance a WHERE a.attendance_date = ? AND a.status = "check"',
      [date]
    );

    // 按员工统计当日出勤√的人次
    const empCheckMap = {};
    for (const a of attRows) {
      if (!empCheckMap[a.employee_id]) empCheckMap[a.employee_id] = 0;
      empCheckMap[a.employee_id] += 1; // 每个am/pm算1人次
    }

    // 4. 先删除当日旧数据
    await pool.execute('DELETE FROM personal_summary WHERE summary_date = ?', [date]);

    // 5. 为每个员工生成记录
    for (const emp of employees) {
      const checkTimes = empCheckMap[emp.id] || 0; // 人次
      const isFront = emp.business_line === '前厅';
      const frontCheck = isFront ? checkTimes / 2 : 0;  // 前厅人天
      const backCheck = isFront ? 0 : checkTimes / 2;    // 后厨人天
      // 奖金 = 该业务线奖金 × 该员工出勤人次 / 该业务线总出勤人次
      let bonus = 0;
      if (isFront && frontBonus !== 0 && checkTimes > 0) {
        const frontTotalTimes = employees
          .filter(e => e.business_line === '前厅')
          .reduce((sum, e) => sum + (empCheckMap[e.id] || 0), 0);
        bonus = frontTotalTimes > 0 ? Math.round(frontBonus * checkTimes / frontTotalTimes * 100) / 100 : 0;
      } else if (!isFront && backBonus !== 0 && checkTimes > 0) {
        const backTotalTimes = employees
          .filter(e => e.business_line !== '前厅')
          .reduce((sum, e) => sum + (empCheckMap[e.id] || 0), 0);
        bonus = backTotalTimes > 0 ? Math.round(backBonus * checkTimes / backTotalTimes * 100) / 100 : 0;
      }

      await pool.execute(
        'INSERT INTO personal_summary (summary_date, employee_name, front_check_count, back_check_count, bonus) VALUES (?, ?, ?, ?, ?)',
        [date, emp.name, frontCheck, backCheck, bonus]
      );
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
