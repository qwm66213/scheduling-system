const express = require('express');
const router = express.Router();
const { getDB, save } = require('../db');

function queryAll(sql, params = []) {
  const db = getDB();
  const result = db.exec(sql, params);
  if (!result[0]) return [];
  return result[0].values.map(row => {
    const obj = {};
    result[0].columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
}

router.get('/', (req, res) => {
  const rules = queryAll('SELECT * FROM scheduling_rules ORDER BY id');
  const result = {};
  for (const r of rules) {
    try {
      result[r.rule_key] = {
        value: JSON.parse(r.rule_value),
        description: r.description
      };
    } catch {
      result[r.rule_key] = {
        value: r.rule_value,
        description: r.description
      };
    }
  }
  res.json(result);
});

router.put('/:key', (req, res) => {
  const db = getDB();
  const { value } = req.body;
  const serialized = typeof value === 'object' ? JSON.stringify(value) : String(value);
  const stmt = db.prepare('UPDATE scheduling_rules SET rule_value=? WHERE rule_key=?');
  stmt.run([serialized, req.params.key]);
  stmt.free();
  save();
  res.json({ success: true });
});

router.post('/reset', (req, res) => {
  const db = getDB();
  db.run('DELETE FROM scheduling_rules');
  save();

  // Re-insert defaults
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
    { key: 'daily_wage', value: '180', desc: '日薪标准（元）' },
    { key: 'front_standard', value: JSON.stringify({ staff: 12, salary: 69195, ratio: 8.0, efficiency: 2800 }), desc: '前厅经营标准' },
    { key: 'back_standard', value: JSON.stringify({ staff: 15, salary: 108117, ratio: 12.5, efficiency: 2200 }), desc: '后厨经营标准' },
    { key: 'total_standard', value: JSON.stringify({ staff: 27, salary: 177312, ratio: 20.5, efficiency: 1200 }), desc: '总体经营标准' },
    { key: 'revenue_target', value: '864936', desc: '月营业额目标' },
    { key: 'efficiency_standard', value: JSON.stringify({ revenue: 100, efficiency: 100 }), desc: '达成率标准(%)' },
    { key: 'front_extra', value: JSON.stringify({ hourly_hours: 0, secondment: 0 }), desc: '前厅小时工工时与借调人数' },
    { key: 'back_extra', value: JSON.stringify({ hourly_hours: 0, secondment: 0 }), desc: '后厨小时工工时与借调人数' }
  ];
  const stmt = db.prepare("INSERT INTO scheduling_rules (rule_key, rule_value, description) VALUES (?, ?, ?)");
  for (const r of rules) { stmt.run([r.key, r.value, r.desc]); }
  stmt.free();
  save();
  res.json({ success: true });
});

module.exports = router;
