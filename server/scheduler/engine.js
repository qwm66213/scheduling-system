/**
 * 排班算法核心引擎
 * 根据营业额预估数据 + 排班规则 → 生成人力需求 + 排班方案
 */

function getRuleValue(rules, key) {
  const rule = rules[key];
  if (!rule) return null;
  return rule.value;
}

function getRevenueFactor(revenue, brackets) {
  if (!Array.isArray(brackets)) return 1.0;
  for (const b of brackets) {
    if (revenue >= b.min && revenue < b.max) return b.factor;
  }
  return 1.0;
}

// 岗位分组
const FRONT_ROLES = ['店长', '领班', '服务员', '领位', '收银', '外卖打包', '保洁'];
const BACK_ROLES = ['厨师长', '炒锅', '配菜', '打荷', '蒸菜', '点心', '凉菜', '湘菜', '洗碗'];

// 固定岗位（不随营业额调整人数）
const FIXED_ROLES = ['店长', '领班', '领位', '收银'];

/**
 * 计算某日某时段的岗位人力需求
 */
function calculateDemand(revenueData, rules) {
  const hallTables = revenueData.hall_tables || 0;
  const banquetTables = revenueData.banquet_tables || 0;
  const roomTables = revenueData.room_tables || 0;
  const deliveryOrders = revenueData.delivery_orders || 0;
  const totalRevenue = revenueData.total_revenue || 0;
  const period = revenueData.period;

  const totalTables = hallTables + banquetTables + roomTables;

  const waiterTables = parseInt(getRuleValue(rules, 'waiter_tables')) || 4;
  const wokTables = parseInt(getRuleValue(rules, 'wok_tables')) || 6;
  const prepTables = parseInt(getRuleValue(rules, 'prep_tables')) || 8;
  const assistantTables = parseInt(getRuleValue(rules, 'assistant_tables')) || 8;
  const steamerTables = parseInt(getRuleValue(rules, 'steamer_tables')) || 15;
  const coldTables = parseInt(getRuleValue(rules, 'cold_tables')) || 15;
  const dishwasherTables = parseInt(getRuleValue(rules, 'dishwasher_tables')) || 15;
  const deliveryPerPerson = parseInt(getRuleValue(rules, 'delivery_per_person')) || 20;
  const dessertTables = parseInt(getRuleValue(rules, 'dessert_tables')) || 15;
  const xiangcaiTables = parseInt(getRuleValue(rules, 'xiangcai_tables')) || 15;

  // Step 1: base demand by tables/orders
  const baseDemand = {
    '店长': 1,
    '领班': 1,
    '服务员': Math.ceil(hallTables / waiterTables) + roomTables + banquetTables * 2,
    '领位': 1,
    '收银': 1,
    '外卖打包': deliveryOrders > 0 ? Math.ceil(deliveryOrders / deliveryPerPerson) : 0,
    '保洁': 1,
    '厨师长': 1,
    '炒锅': totalTables > 0 ? Math.ceil(totalTables / wokTables) : 0,
    '配菜': totalTables > 0 ? Math.ceil(totalTables / prepTables) : 0,
    '打荷': totalTables > 0 ? Math.ceil(totalTables / assistantTables) : 0,
    '蒸菜': totalTables > 0 ? Math.ceil(totalTables / steamerTables) : 0,
    '点心': totalTables > 0 ? Math.ceil(totalTables / dessertTables) : 0,
    '凉菜': totalTables > 0 ? Math.ceil(totalTables / coldTables) : 0,
    '湘菜': totalTables > 0 ? Math.ceil(totalTables / xiangcaiTables) : 0,
    '洗碗': totalTables > 0 ? Math.ceil(totalTables / dishwasherTables) : 0,
  };

  // Ensure minimum of 1 for kitchen roles if there are tables
  if (totalTables > 0) {
    for (const role of ['蒸菜', '凉菜', '点心', '湘菜']) {
      if (baseDemand[role] < 1) baseDemand[role] = 1;
    }
  }

  // Step 2: adjust by revenue bracket
  const bracketKey = period === 'lunch' ? 'revenue_lunch_brackets' : 'revenue_dinner_brackets';
  const brackets = getRuleValue(rules, bracketKey);
  const factor = getRevenueFactor(totalRevenue, brackets);

  const adjustedDemand = {};
  for (const [role, count] of Object.entries(baseDemand)) {
    if (FIXED_ROLES.includes(role)) {
      adjustedDemand[role] = count;
    } else {
      adjustedDemand[role] = Math.max(count, Math.round(count * factor));
    }
  }

  return adjustedDemand;
}

/**
 * 生成排班方案：将员工分配到各时段各岗位
 */
function generateSchedule(dates, revenueData, staffList, rules) {
  const maxConsecutive = parseInt(getRuleValue(rules, 'max_consecutive_days')) || 5;

  const staffByRole = {};
  for (const s of staffList) {
    if (!staffByRole[s.role]) staffByRole[s.role] = [];
    staffByRole[s.role].push(s);
  }

  const workLog = {};

  const schedule = [];

  for (const date of dates) {
    const dateStr = date;
    const lunchRevenue = revenueData.find(r => r.date === dateStr && r.period === 'lunch');
    const dinnerRevenue = revenueData.find(r => r.date === dateStr && r.period === 'dinner');

    if (!lunchRevenue && !dinnerRevenue) continue;

    const lunchDemand = lunchRevenue ? calculateDemand(lunchRevenue, rules) : {};
    const dinnerDemand = dinnerRevenue ? calculateDemand(dinnerRevenue, rules) : {};

    const allRoles = new Set([...Object.keys(lunchDemand), ...Object.keys(dinnerDemand)]);
    const mergedDemand = {};
    for (const role of allRoles) {
      mergedDemand[role] = Math.max(lunchDemand[role] || 0, dinnerDemand[role] || 0);
    }

    for (const [role, needed] of Object.entries(mergedDemand)) {
      const candidates = (staffByRole[role] || []).filter(s => {
        const worked = workLog[s.id] || [];
        if (worked.length >= maxConsecutive) {
          const idx = dates.indexOf(dateStr);
          const recentWorked = worked.filter(d => {
            const di = dates.indexOf(d);
            return di >= idx - maxConsecutive && di < idx;
          });
          if (recentWorked.length >= maxConsecutive) return false;
        }
        return true;
      });

      const assigned = candidates.slice(0, needed);
      for (const staff of assigned) {
        if (!workLog[staff.id]) workLog[staff.id] = [];
        workLog[staff.id].push(dateStr);

        const lunchNeed = lunchDemand[role] || 0;
        const dinnerNeed = dinnerDemand[role] || 0;
        let period;
        if (lunchNeed > 0 && dinnerNeed > 0) {
          period = 'full';
        } else if (lunchNeed > 0) {
          period = 'lunch';
        } else {
          period = 'dinner';
        }

        schedule.push({
          date: dateStr,
          period,
          staff_id: staff.id,
          staff_name: staff.name,
          role
        });
      }

      if (assigned.length < needed) {
        schedule.push({
          date: dateStr,
          period: 'full',
          staff_id: null,
          staff_name: '⚠️ 人手不足',
          role,
          shortage: needed - assigned.length
        });
      }
    }
  }

  return schedule;
}

/**
 * 计算人力成本
 */
function calculateCost(schedule, rules) {
  const dailyWage = parseFloat(getRuleValue(rules, 'daily_wage')) || 180;
  const costByDate = {};

  for (const s of schedule) {
    if (!s.staff_id) continue;
    if (!costByDate[s.date]) costByDate[s.date] = { lunch: 0, dinner: 0, full: 0, total: 0 };
    if (s.period === 'full') {
      costByDate[s.date].full++;
      costByDate[s.date].total += dailyWage;
    } else {
      costByDate[s.date][s.period]++;
      costByDate[s.date].total += dailyWage * 0.6;
    }
  }

  return costByDate;
}

module.exports = { calculateDemand, generateSchedule, calculateCost, FRONT_ROLES, BACK_ROLES };
