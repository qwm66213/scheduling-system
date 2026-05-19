const express = require('express');
const router = express.Router();
const { getDB, save } = require('../db');
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

function getStandard(key) {
  const db = getDB();
  const result = db.exec('SELECT rule_value FROM scheduling_rules WHERE rule_key = ?', [key]);
  if (!result[0] || !result[0].values[0]) return null;
  const val = result[0].values[0][0];
  try { return JSON.parse(val); } catch { return Number(val) || 0; }
}

// GET /api/daily-summary?start_date=&end_date=
router.get('/', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    if (!start_date || !end_date) {
      return res.status(400).json(response(0, 'start_date and end_date required'));
    }
    let sql = 'SELECT id, summary_date, actual_revenue, front_check_count, front_bonus, back_check_count, back_bonus, created_at FROM daily_summary WHERE summary_date >= ? AND summary_date <= ?';
    const params = [start_date, end_date];
    if (req.storeId) { sql += ' AND store_id = ?'; params.push(req.storeId); }
    sql += ' ORDER BY summary_date';
    const [rows] = await pool.execute(sql, params);
    const result = rows.map(r => ({
      id: r.id,
      date: r.summary_date instanceof Date ? r.summary_date.toISOString().slice(0, 10) : String(r.summary_date).slice(0, 10),
      actual_revenue: Number(r.actual_revenue),
      front_check_count: Number(r.front_check_count),
      front_bonus: Number(r.front_bonus),
      back_check_count: Number(r.back_check_count),
      back_bonus: Number(r.back_bonus)
    }));
    res.json(response(1, '获取成功', result));
  } catch (err) {
    console.error('[DailySummary] Error:', err.message);
    res.status(500).json(response(0, err.message));
  }
});

// POST /api/daily-summary/generate  { date: '2026-05-13' }
router.post('/generate', async (req, res) => {
  try {
    const { date } = req.body;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json(response(0, 'date format required: YYYY-MM-DD'));
    }

    // 1. 当日实收营业额 (actual版本 午+晚)
    const [revRows] = await pool.execute(
      'SELECT COALESCE(SUM(total_revenue), 0) AS total FROM revenue_detail WHERE revenue_date = ? AND version = ?',
      [date, 'actual']
    );
    const actualRevenue = Number(revRows[0].total) || 0;

    // 2. 当日前厅出勤√人次
    const [frontRows] = await pool.execute(
      'SELECT COUNT(*) AS total_times FROM pre_scheduling p JOIN employee_profile e ON p.employee_id = e.id WHERE p.schedule_date = ? AND p.status = ? AND e.business_line = ?',
      [date, 'check', '前厅']
    );
    const frontCheckTimes = frontRows[0].total_times || 0;
    const frontCheckCount = frontCheckTimes / 2;

    // 3. 当日后厨出勤√人次
    const [backRows] = await pool.execute(
      'SELECT COUNT(*) AS total_times FROM pre_scheduling p JOIN employee_profile e ON p.employee_id = e.id WHERE p.schedule_date = ? AND p.status = ? AND e.business_line != ?',
      [date, 'check', '前厅']
    );
    const backCheckTimes = backRows[0].total_times || 0;
    const backCheckCount = backCheckTimes / 2;

    // 4. 从SQLite读取标准人效
    const frontStandard = getStandard('front_standard') || { efficiency: 2800 };
    const backStandard = getStandard('back_standard') || { efficiency: 2200 };

    // 5. 计算奖金: (实收 - (人次/2)×标准人效) / (人次/2)
    const frontBonus = (frontCheckCount > 0 && actualRevenue > 0)
      ? Math.round((actualRevenue - frontCheckCount * frontStandard.efficiency) / frontCheckCount * 100) / 100
      : 0;
    const backBonus = (backCheckCount > 0 && actualRevenue > 0)
      ? Math.round((actualRevenue - backCheckCount * backStandard.efficiency) / backCheckCount * 100) / 100
      : 0;

    // 6. Upsert
    const [existing] = await pool.execute(
      'SELECT id FROM daily_summary WHERE summary_date = ?',
      [date]
    );

    if (existing.length > 0) {
      await pool.execute(
        'UPDATE daily_summary SET actual_revenue=?, front_check_count=?, front_bonus=?, back_check_count=?, back_bonus=? WHERE id=?',
        [actualRevenue, frontCheckCount, frontBonus, backCheckCount, backBonus, existing[0].id]
      );
    } else {
      await pool.execute(
        'INSERT INTO daily_summary (summary_date, actual_revenue, front_check_count, front_bonus, back_check_count, back_bonus) VALUES (?, ?, ?, ?, ?, ?)',
        [date, actualRevenue, frontCheckCount, frontBonus, backCheckCount, backBonus]
      );
    }

    res.json(response(1, '生成成功', { date, actual_revenue: actualRevenue, front_check_count: frontCheckCount, front_bonus: frontBonus, back_check_count: backCheckCount, back_bonus: backBonus }));
  } catch (err) {
    console.error('[DailySummary] Error:', err.message);
    res.status(500).json(response(0, err.message));
  }
});

module.exports = router;
