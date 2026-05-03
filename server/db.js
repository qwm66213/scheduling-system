const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'data', 'scheduling.db');

let db = null;

async function initDB() {
  const SQL = await initSqlJs();

  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  createTables();
  insertDefaultRules();
  insertSampleData();

  return db;
}

function createTables() {
  db.run(`
    CREATE TABLE IF NOT EXISTS revenue_forecasts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      period TEXT NOT NULL CHECK(period IN ('lunch', 'dinner')),
      hall_tables INTEGER DEFAULT 0,
      hall_avg INTEGER DEFAULT 200,
      hall_revenue INTEGER DEFAULT 0,
      banquet_tables INTEGER DEFAULT 0,
      banquet_avg INTEGER DEFAULT 300,
      banquet_revenue INTEGER DEFAULT 0,
      room_tables INTEGER DEFAULT 0,
      room_avg INTEGER DEFAULT 250,
      room_revenue INTEGER DEFAULT 0,
      delivery_orders INTEGER DEFAULT 0,
      delivery_price INTEGER DEFAULT 50,
      delivery_revenue INTEGER DEFAULT 0,
      total_revenue INTEGER DEFAULT 0,
      UNIQUE(date, period)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS staff (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      phone TEXT DEFAULT '',
      is_active INTEGER DEFAULT 1
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      period TEXT NOT NULL CHECK(period IN ('lunch', 'dinner', 'full')),
      staff_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      FOREIGN KEY (staff_id) REFERENCES staff(id),
      UNIQUE(date, period, staff_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS scheduling_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rule_key TEXT UNIQUE NOT NULL,
      rule_value TEXT NOT NULL,
      description TEXT DEFAULT ''
    )
  `);

  save();
}

function insertDefaultRules() {
  const count = db.exec("SELECT COUNT(*) as cnt FROM scheduling_rules");
  if (count[0] && count[0].values[0][0] > 0) return;

  const rules = [
    { key: 'waiter_tables', value: '4', desc: '每个服务员管桌数' },
    { key: 'wok_tables', value: '6', desc: '每个炒锅负责桌数' },
    { key: 'prep_tables', value: '8', desc: '每个配菜负责桌数' },
    { key: 'assistant_tables', value: '8', desc: '每个打荷负责桌数' },
    { key: 'steamer_tables', value: '15', desc: '每个蒸菜负责桌数' },
    { key: 'cold_tables', value: '15', desc: '每个凉菜负责桌数' },
    { key: 'dessert_tables', value: '15', desc: '每个点心负责桌数' },
    { key: 'xiangcai_tables', value: '15', desc: '每个湘菜负责桌数' },
    { key: 'dishwasher_tables', value: '15', desc: '每个洗碗负责桌数' },
    { key: 'delivery_per_person', value: '20', desc: '外卖每人处理单量' },
    { key: 'revenue_lunch_brackets', value: JSON.stringify([
      { min: 0, max: 8000, factor: 0.8, label: '8000以下' },
      { min: 8000, max: 15000, factor: 1.0, label: '8000-15000' },
      { min: 15000, max: 20000, factor: 1.2, label: '15000-20000' },
      { min: 20000, max: 999999, factor: 1.3, label: '20000以上' }
    ]), desc: '午市营业额区间与调整系数' },
    { key: 'revenue_dinner_brackets', value: JSON.stringify([
      { min: 0, max: 10000, factor: 0.8, label: '10000以下' },
      { min: 10000, max: 15000, factor: 1.0, label: '10000-15000' },
      { min: 15000, max: 20000, factor: 1.2, label: '15000-20000' },
      { min: 20000, max: 999999, factor: 1.3, label: '20000以上' }
    ]), desc: '晚市营业额区间与调整系数' },
    { key: 'min_consecutive_days', value: '1', desc: '最少连续工作天数' },
    { key: 'max_consecutive_days', value: '5', desc: '最多连续工作天数' },
    { key: 'daily_wage', value: '180', desc: '日薪标准（元）' }
  ];

  const stmt = db.prepare("INSERT INTO scheduling_rules (rule_key, rule_value, description) VALUES (?, ?, ?)");
  for (const r of rules) {
    stmt.run([r.key, r.value, r.desc]);
  }
  stmt.free();
  save();
}

function insertSampleData() {
  const revCount = db.exec("SELECT COUNT(*) as cnt FROM revenue_forecasts");
  if (revCount[0] && revCount[0].values[0][0] > 0) return;

  const revenueData = [
    // 22日
    { date: '2026-04-22', period: 'lunch', hall_t: 23, hall_a: 200, banq_t: 0, banq_a: 300, room_t: 7, room_a: 250, del_o: 50, del_p: 50 },
    { date: '2026-04-22', period: 'dinner', hall_t: 23, hall_a: 220, banq_t: 0, banq_a: 320, room_t: 7, room_a: 280, del_o: 60, del_p: 55 },
    // 23日
    { date: '2026-04-23', period: 'lunch', hall_t: 12, hall_a: 240, banq_t: 0, banq_a: 300, room_t: 3, room_a: 260, del_o: 50, del_p: 50 },
    { date: '2026-04-23', period: 'dinner', hall_t: 15, hall_a: 260, banq_t: 0, banq_a: 320, room_t: 11, room_a: 280, del_o: 60, del_p: 55 },
    // 24日
    { date: '2026-04-24', period: 'lunch', hall_t: 16, hall_a: 240, banq_t: 0, banq_a: 300, room_t: 5, room_a: 260, del_o: 50, del_p: 50 },
    { date: '2026-04-24', period: 'dinner', hall_t: 19, hall_a: 260, banq_t: 0, banq_a: 320, room_t: 8, room_a: 280, del_o: 60, del_p: 55 },
    // 25日
    { date: '2026-04-25', period: 'lunch', hall_t: 19, hall_a: 240, banq_t: 3, banq_a: 300, room_t: 10, room_a: 260, del_o: 50, del_p: 50 },
    { date: '2026-04-25', period: 'dinner', hall_t: 19, hall_a: 260, banq_t: 3, banq_a: 320, room_t: 10, room_a: 280, del_o: 40, del_p: 55 },
    // 26日
    { date: '2026-04-26', period: 'lunch', hall_t: 25, hall_a: 240, banq_t: 0, banq_a: 300, room_t: 6, room_a: 260, del_o: 50, del_p: 50 },
    { date: '2026-04-26', period: 'dinner', hall_t: 28, hall_a: 260, banq_t: 0, banq_a: 320, room_t: 10, room_a: 280, del_o: 50, del_p: 55 },
    // 27日
    { date: '2026-04-27', period: 'lunch', hall_t: 18, hall_a: 240, banq_t: 0, banq_a: 300, room_t: 6, room_a: 260, del_o: 50, del_p: 50 },
    { date: '2026-04-27', period: 'dinner', hall_t: 19, hall_a: 260, banq_t: 0, banq_a: 320, room_t: 8, room_a: 280, del_o: 50, del_p: 55 },
  ];

  const revStmt = db.prepare(
    "INSERT OR REPLACE INTO revenue_forecasts (date, period, hall_tables, hall_avg, hall_revenue, banquet_tables, banquet_avg, banquet_revenue, room_tables, room_avg, room_revenue, delivery_orders, delivery_price, delivery_revenue, total_revenue) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  );
  for (const r of revenueData) {
    const hall_rev = r.hall_t * r.hall_a;
    const banq_rev = r.banq_t * r.banq_a;
    const room_rev = r.room_t * r.room_a;
    const del_rev = r.del_o * r.del_p;
    const total = hall_rev + banq_rev + room_rev + del_rev;
    revStmt.run([r.date, r.period, r.hall_t, r.hall_a, hall_rev, r.banq_t, r.banq_a, banq_rev, r.room_t, r.room_a, room_rev, r.del_o, r.del_p, del_rev, total]);
  }
  revStmt.free();
  save();
}

function save() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

function getDB() {
  return db;
}

module.exports = { initDB, getDB, save };
