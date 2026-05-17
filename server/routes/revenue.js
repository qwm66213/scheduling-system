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
  timezone: '+08:00'
});

router.use(authMiddleware);

function formatDate(d) {
  if (!d) return d
  if (d instanceof Date) {
    const offset = d.getTimezoneOffset()
    const local = new Date(d.getTime() - offset * 60000)
    return local.toISOString().slice(0, 10)
  }
  const s = String(d)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  return s
}

function calcRevenues(r) {
  const hall_revenue = (r.hall_tables || 0) * (r.hall_avg || 0)
  const banquet_revenue = (r.banquet_tables || 0) * (r.banquet_avg || 0)
  const room_revenue = (r.room_tables || 0) * (r.room_avg || 0)
  const delivery_revenue = (r.delivery_orders || 0) * (r.delivery_price || 0)
  const total_revenue = hall_revenue + banquet_revenue + room_revenue + delivery_revenue
  return { hall_revenue, banquet_revenue, room_revenue, delivery_revenue, total_revenue }
}

const SELECT_FIELDS = 'id, revenue_date, meal_period, version, hall_tables, hall_avg, hall_revenue, banquet_tables, banquet_avg, banquet_revenue, room_tables, room_avg, room_revenue, delivery_orders, delivery_price, delivery_revenue, total_revenue, created_at, updated_at'

// GET
router.get('/', async (req, res) => {
  try {
    const { start_date, end_date, version } = req.query;
    let sql = `SELECT ${SELECT_FIELDS} FROM revenue_detail WHERE 1=1`;
    const params = [];
    if (req.storeId) { sql += ' AND store_id = ?'; params.push(req.storeId); }
    if (start_date) { sql += ' AND revenue_date >= ?'; params.push(start_date); }
    if (end_date) { sql += ' AND revenue_date <= ?'; params.push(end_date); }
    if (version) { sql += ' AND version = ?'; params.push(version); }
    sql += ' ORDER BY revenue_date, meal_period';
    const [rows] = await pool.execute(sql, params);
    const result = rows.map(r => ({
      id: r.id,
      date: formatDate(r.revenue_date),
      period: r.meal_period,
      version: r.version,
      hall_tables: r.hall_tables,
      hall_avg: Number(r.hall_avg),
      hall_revenue: Number(r.hall_revenue),
      banquet_tables: r.banquet_tables,
      banquet_avg: Number(r.banquet_avg),
      banquet_revenue: Number(r.banquet_revenue),
      room_tables: r.room_tables,
      room_avg: Number(r.room_avg),
      room_revenue: Number(r.room_revenue),
      delivery_orders: r.delivery_orders,
      delivery_price: Number(r.delivery_price),
      delivery_revenue: Number(r.delivery_revenue),
      total_revenue: Number(r.total_revenue),
      revenue_amount: Number(r.total_revenue)
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST
router.post('/', async (req, res) => {
  try {
    const { date, period, version } = req.body;
    const ver = version || 'forecast';

    if (ver === 'forecast') {
      const { hall_tables, hall_avg, banquet_tables, banquet_avg, room_tables, room_avg, delivery_orders, delivery_price } = req.body;
      const revs = calcRevenues({ hall_tables, hall_avg, banquet_tables, banquet_avg, room_tables, room_avg, delivery_orders, delivery_price });

      const [existing] = await pool.execute(
        'SELECT id FROM revenue_detail WHERE revenue_date = ? AND meal_period = ? AND version = ?',
        [date, period, ver]
      );

      if (existing.length > 0) {
        await pool.execute(
          `UPDATE revenue_detail SET hall_tables=?, hall_avg=?, hall_revenue=?, banquet_tables=?, banquet_avg=?, banquet_revenue=?, room_tables=?, room_avg=?, room_revenue=?, delivery_orders=?, delivery_price=?, delivery_revenue=?, total_revenue=? WHERE id=?`,
          [hall_tables||0, hall_avg||0, revs.hall_revenue, banquet_tables||0, banquet_avg||0, revs.banquet_revenue, room_tables||0, room_avg||0, revs.room_revenue, delivery_orders||0, delivery_price||0, revs.delivery_revenue, revs.total_revenue, existing[0].id]
        );
        res.json({ success: true, id: existing[0].id });
      } else {
        const [result] = await pool.execute(
          `INSERT INTO revenue_detail (revenue_date, meal_period, version, hall_tables, hall_avg, hall_revenue, banquet_tables, banquet_avg, banquet_revenue, room_tables, room_avg, room_revenue, delivery_orders, delivery_price, delivery_revenue, total_revenue) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [date, period, ver, hall_tables||0, hall_avg||0, revs.hall_revenue, banquet_tables||0, banquet_avg||0, revs.banquet_revenue, room_tables||0, room_avg||0, revs.room_revenue, delivery_orders||0, delivery_price||0, revs.delivery_revenue, revs.total_revenue]
        );
        res.json({ success: true, id: result.insertId });
      }
    } else {
      const revenue_amount = req.body.revenue_amount || 0;

      const [existing] = await pool.execute(
        'SELECT id FROM revenue_detail WHERE revenue_date = ? AND meal_period = ? AND version = ?',
        [date, period, ver]
      );

      if (existing.length > 0) {
        await pool.execute(
          'UPDATE revenue_detail SET total_revenue=? WHERE id=?',
          [revenue_amount, existing[0].id]
        );
        res.json({ success: true, id: existing[0].id });
      } else {
        const [result] = await pool.execute(
          'INSERT INTO revenue_detail (revenue_date, meal_period, version, total_revenue) VALUES (?, ?, ?, ?)',
          [date, period, ver, revenue_amount]
        );
        res.json({ success: true, id: result.insertId });
      }
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT
router.put('/:id', async (req, res) => {
  try {
    const { hall_tables, hall_avg, banquet_tables, banquet_avg, room_tables, room_avg, delivery_orders, delivery_price, revenue_amount } = req.body;

    if (hall_tables !== undefined) {
      const revs = calcRevenues({ hall_tables, hall_avg, banquet_tables, banquet_avg, room_tables, room_avg, delivery_orders, delivery_price });
      await pool.execute(
        `UPDATE revenue_detail SET hall_tables=?, hall_avg=?, hall_revenue=?, banquet_tables=?, banquet_avg=?, banquet_revenue=?, room_tables=?, room_avg=?, room_revenue=?, delivery_orders=?, delivery_price=?, delivery_revenue=?, total_revenue=? WHERE id=?`,
        [hall_tables||0, hall_avg||0, revs.hall_revenue, banquet_tables||0, banquet_avg||0, revs.banquet_revenue, room_tables||0, room_avg||0, revs.room_revenue, delivery_orders||0, delivery_price||0, revs.delivery_revenue, revs.total_revenue, req.params.id]
      );
    } else {
      await pool.execute(
        'UPDATE revenue_detail SET total_revenue=? WHERE id=?',
        [revenue_amount || 0, req.params.id]
      );
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE
router.delete('/:id', async (req, res) => {
  try {
    await pool.execute('DELETE FROM revenue_detail WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
