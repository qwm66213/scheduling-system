const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const { getDB, save } = require('../db');
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

// Helper: Date -> local YYYY-MM-DD (avoid toISOString UTC shift)
function toDateStr(d) {
  if (!(d instanceof Date)) return String(d).slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Helper: read standard values from SQLite scheduling_rules
function getStandard(key) {
  const db = getDB();
  const result = db.exec('SELECT rule_value FROM scheduling_rules WHERE rule_key = ?', [key]);
  if (!result[0] || !result[0].values[0]) return null;
  const val = result[0].values[0][0];
  try { return JSON.parse(val); } catch { return Number(val) || 0; }
}

// GET /api/dashboard/summary?month=2026-05
router.get('/summary', async (req, res) => {
  try {
    const { month } = req.query;
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'month format required: YYYY-MM' });
    }

    const startDate = `${month}-01`;
    const [nextMonth] = await pool.execute(
      'SELECT DATE_FORMAT(DATE_ADD(?, INTERVAL 1 MONTH), "%Y-%m-01") AS nm',
      [startDate]
    );
    const endDate = nextMonth[0].nm;

    const storeFilter = req.storeId ? ' AND store_id = ?' : '';
    const storeParam = req.storeId ? [req.storeId] : [];

    // 1. Total revenue (actual version) & days with data
    const [revenueRows] = await pool.execute(
      `SELECT SUM(total_revenue) AS total FROM revenue_detail WHERE revenue_date >= ? AND revenue_date < ? AND version = ?${storeFilter}`,
      [startDate, endDate, 'actual', ...storeParam]
    );
    const totalRevenue = Number(revenueRows[0].total) || 0;

    const [dayRows] = await pool.execute(
      `SELECT COUNT(DISTINCT revenue_date) AS days FROM revenue_detail WHERE revenue_date >= ? AND revenue_date < ? AND version = ? AND total_revenue > 0${storeFilter}`,
      [startDate, endDate, 'actual', ...storeParam]
    );
    const dataDays = dayRows[0].days || 0;

    // 1.1 Daily revenue map (for front salary calculation)
    const [dailyRevenueRows] = await pool.execute(
      `SELECT revenue_date, SUM(total_revenue) AS day_total FROM revenue_detail WHERE revenue_date >= ? AND revenue_date < ? AND version = ?${storeFilter} GROUP BY revenue_date`,
      [startDate, endDate, 'actual', ...storeParam]
    );
    const dailyRevenueMap = {};
    for (const r of dailyRevenueRows) {
      const dateStr = toDateStr(r.revenue_date);
      dailyRevenueMap[dateStr] = Number(r.day_total) || 0;
    }

    // 1.2 Daily forecast revenue map (for revenue achieve rate)
    const [dailyForecastRows] = await pool.execute(
      `SELECT revenue_date, SUM(total_revenue) AS day_total FROM revenue_detail WHERE revenue_date >= ? AND revenue_date < ? AND version = ?${storeFilter} GROUP BY revenue_date`,
      [startDate, endDate, 'forecast', ...storeParam]
    );
    const dailyForecastMap = {};
    for (const r of dailyForecastRows) {
      const dateStr = toDateStr(r.revenue_date);
      dailyForecastMap[dateStr] = Number(r.day_total) || 0;
    }

    // 2. Staff count & salary by business_line
    let empSql = 'SELECT id, business_line, employment_type, monthly_salary, daily_salary FROM employee_profile WHERE employment_status = "在职"';
    const empParams = [];
    if (req.storeId) { empSql += ' AND store_id = ?'; empParams.push(req.storeId); }
    const [employees] = await pool.execute(empSql, empParams);

    const frontEmployees = employees.filter(e => e.business_line === '前厅');
    const backEmployees = employees.filter(e => e.business_line !== '前厅');

    // 3. Attendance salary from summary (for back staff only)
    let attSql = 'SELECT a.employee_id, a.attendance_date, a.period, a.status FROM attendance a WHERE a.attendance_date >= ? AND a.attendance_date < ? AND a.status != ""';
    const attParams = [startDate, endDate];
    if (req.storeId) { attSql += ' AND a.employee_id IN (SELECT id FROM employee_profile WHERE store_id = ?)'; attParams.push(req.storeId); }
    const [attRows] = await pool.execute(attSql, attParams);

    const attMap = {};
    for (const r of attRows) {
      if (!attMap[r.employee_id]) {
        attMap[r.employee_id] = { check: 0, leave: 0, absent: 0, save: 0, annual: 0, second: 0 };
      }
      const half = r.period === 'am' || r.period === 'pm' ? 0.5 : 1;
      if (attMap[r.employee_id][r.status] !== undefined) {
        attMap[r.employee_id][r.status] += half;
      }
    }

    // Build attendance by date for front & back daily calculations
    const attByDate = {};
    const attByDateBack = {};
    for (const r of attRows) {
      const emp = employees.find(e => e.id === r.employee_id);
      if (!emp) continue;
      const dateStr = toDateStr(r.attendance_date);
      const target = emp.business_line === '前厅' ? attByDate : attByDateBack;
      if (!target[dateStr]) target[dateStr] = {};
      if (!target[dateStr][r.employee_id]) target[dateStr][r.employee_id] = {};
      target[dateStr][r.employee_id][r.period] = r.status;
    }

    // Config values for front formula
    const frontExtra = getStandard('front_extra') || { hourly_hours: 0, secondment: 0 };

    // 生成整月所有日期
    const [monthDays] = await pool.execute(
      'SELECT DATE_FORMAT(DATE_ADD(?, INTERVAL seq DAY), "%Y-%m-%d") AS d ' +
      'FROM (SELECT 0 AS seq UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 ' +
      'UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9 ' +
      'UNION ALL SELECT 10 UNION ALL SELECT 11 UNION ALL SELECT 12 UNION ALL SELECT 13 UNION ALL SELECT 14 ' +
      'UNION ALL SELECT 15 UNION ALL SELECT 16 UNION ALL SELECT 17 UNION ALL SELECT 18 UNION ALL SELECT 19 ' +
      'UNION ALL SELECT 20 UNION ALL SELECT 21 UNION ALL SELECT 22 UNION ALL SELECT 23 UNION ALL SELECT 24 ' +
      'UNION ALL SELECT 25 UNION ALL SELECT 26 UNION ALL SELECT 27 UNION ALL SELECT 28 UNION ALL SELECT 29 ' +
      'UNION ALL SELECT 30) nums ' +
      'WHERE DATE_ADD(?, INTERVAL seq DAY) < ?',
      [startDate, startDate, endDate]
    );
    const allDates = monthDays.map(r => r.d);

    // 每天前厅人数 & 前厅净工资
    const dailyFrontStaff = [];
    let frontSalaryTotal = 0;

    for (const date of allDates) {
      const dayAtts = attByDate[date] || {};
      let dayCheckCount = 0;     // 出勤√总数
      let daySaveCount = 0;      // 存总数
      let daySecondCount = 0;    // 借总数
      let dayAnnualCount = 0;    // 年总数
      let dayHourlyTotalHours = 0;  // 小时工总时长（从考勤status读取数值）
      let daySalaryPeriods = 0;  // 出勤√、存、借、年的班次总数
      let daySalarySum = 0;      // 出勤√、存、借、年的日薪总数

      for (const [empId, periods] of Object.entries(dayAtts)) {
        const emp = frontEmployees.find(e => e.id === Number(empId));
        if (!emp) continue;

        const isHourly = emp.employment_type === '小时工';
        const empDailySalary = Number(emp.daily_salary) || 0;

        if (isHourly) {
          // 小时工：status存的是工时数值（如4、8、0.5）
          for (const [period, status] of Object.entries(periods)) {
            const hours = Number(status);
            if (hours > 0) dayHourlyTotalHours += hours;
          }
        } else {
          // 非小时工：统计出勤√、存、借、年班次及日薪
          for (const [period, status] of Object.entries(periods)) {
            if (status === 'check') { dayCheckCount++; daySalaryPeriods++; daySalarySum += empDailySalary; }
            if (status === 'save') { daySaveCount++; daySalaryPeriods++; daySalarySum += empDailySalary; }
            if (status === 'second') { daySecondCount++; daySalaryPeriods++; daySalarySum += empDailySalary; }
            if (status === 'annual') { dayAnnualCount++; daySalaryPeriods++; daySalarySum += empDailySalary; }
          }
        }
      }

      const hasData = Object.keys(dayAtts).length > 0;
      const hasRevenue = (dailyRevenueMap[date] || 0) > 0;

      // 前厅人数 = 出勤√总数÷2 + 小时工总时长÷8 + 前厅小时工工时(配置)÷8 + 前厅借调人数
      const dayStaff = hasData ? dayCheckCount / 2 + dayHourlyTotalHours / 8 + (frontExtra.hourly_hours || 0) / 8 + (frontExtra.secondment || 0) : 0;

      // 前厅净工资 = √存借年日薪总数÷2 + 小时工总时长*25 + 前厅小时工工时*26 + 前厅借调人数*200 + 有营业额?200:0
      const daySalary = hasData
        ? daySalarySum / 2
          + dayHourlyTotalHours * 25
          + (frontExtra.hourly_hours || 0) * 26
          + (frontExtra.secondment || 0) * 200
          + (hasRevenue ? 200 : 0)
        : 0;

      frontSalaryTotal += daySalary;

      // 当天实际营业额
      const dayRevenue = dailyRevenueMap[date] || 0;
      // 前厅净工资占比 = 当天净工资 ÷ 当天实际营业额
      const dayRatio = (hasData && dayRevenue > 0) ? Math.round(daySalary / dayRevenue * 1000) / 10 : 0;
      // 前厅人效 = 当天实际营业额 ÷ 前厅人数
      const dayEfficiency = (hasData && dayStaff > 0 && dayRevenue > 0) ? Math.round(dayRevenue / dayStaff) : 0;

      dailyFrontStaff.push({
        date,
        staff: Math.round(dayStaff * 100) / 100,
        salary: Math.round(daySalary * 100) / 100,
        ratio: dayRatio,
        efficiency: dayEfficiency
      });
    }

    // 月均前厅人数（只算有数据的日期）
    const staffWithData = dailyFrontStaff.filter(d => d.staff > 0);
    const frontStaffAvg = staffWithData.length > 0
      ? Math.round(staffWithData.reduce((a, b) => a + b.staff, 0) / staffWithData.length * 10) / 10 : 0;

    // 月均前厅净工资占比（只算有数据的日期）
    const ratioWithData = dailyFrontStaff.filter(d => d.ratio > 0);
    const frontRatioAvg = ratioWithData.length > 0
      ? Math.round(ratioWithData.reduce((a, b) => a + b.ratio, 0) / ratioWithData.length * 10) / 10 : 0;

    // 月均前厅人效（只算有数据的日期）
    const effWithData = dailyFrontStaff.filter(d => d.efficiency > 0);
    const frontEffAvg = effWithData.length > 0
      ? Math.round(effWithData.reduce((a, b) => a + b.efficiency, 0) / effWithData.length) : 0;

    const frontSalary = Math.round(frontSalaryTotal);

    // 每天后厨人数 & 后厨净工资
    const dailyBackStaff = [];
    let backSalaryTotal = 0;

    // Config values for back formula
    const backExtra = getStandard('back_extra') || { hourly_hours: 0, secondment: 0 };

    for (const date of allDates) {
      const dayAtts = attByDateBack[date] || {};
      let dayCheckCount = 0;
      let daySaveCount = 0;
      let daySecondCount = 0;
      let dayAnnualCount = 0;
      let dayHourlyTotalHours = 0;  // 小时工总时长（从考勤status读取数值）
      let daySalaryPeriods = 0;     // 出勤√、存、借、年的班次总数
      let daySalarySum = 0;         // 出勤√、存、借、年的日薪总数

      for (const [empId, periods] of Object.entries(dayAtts)) {
        const emp = backEmployees.find(e => e.id === Number(empId));
        if (!emp) continue;

        const isHourly = emp.employment_type === '小时工';
        const empDailySalary = Number(emp.daily_salary) || 0;

        if (isHourly) {
          for (const [period, status] of Object.entries(periods)) {
            const hours = Number(status);
            if (hours > 0) dayHourlyTotalHours += hours;
          }
        } else {
          for (const [period, status] of Object.entries(periods)) {
            if (status === 'check') { dayCheckCount++; daySalaryPeriods++; daySalarySum += empDailySalary; }
            if (status === 'save') { daySaveCount++; daySalaryPeriods++; daySalarySum += empDailySalary; }
            if (status === 'second') { daySecondCount++; daySalaryPeriods++; daySalarySum += empDailySalary; }
            if (status === 'annual') { dayAnnualCount++; daySalaryPeriods++; daySalarySum += empDailySalary; }
          }
        }
      }

      const hasData = Object.keys(dayAtts).length > 0;
      const hasRevenue = (dailyRevenueMap[date] || 0) > 0;

      // 后厨人数 = 出勤√总数÷2 + 小时工总时长÷8 + 后厨小时工工时(配置)÷8 + 后厨借调人数
      const dayStaff = hasData ? dayCheckCount / 2 + dayHourlyTotalHours / 8 + (backExtra.hourly_hours || 0) / 8 + (backExtra.secondment || 0) : 0;

      // 后厨净工资 = √存借年日薪总数÷2 + 小时工总时长*25 + 后厨小时工工时*26 + 后厨借调人数*200 + 有营业额?200:0
      const daySalary = hasData
        ? daySalarySum / 2
          + dayHourlyTotalHours * 25
          + (backExtra.hourly_hours || 0) * 26
          + (backExtra.secondment || 0) * 200
          + (hasRevenue ? 200 : 0)
        : 0;

      backSalaryTotal += daySalary;

      const dayRevenue = dailyRevenueMap[date] || 0;
      const dayRatio = (hasData && dayRevenue > 0) ? Math.round(daySalary / dayRevenue * 1000) / 10 : 0;
      const dayEfficiency = (hasData && dayStaff > 0 && dayRevenue > 0) ? Math.round(dayRevenue / dayStaff) : 0;

      dailyBackStaff.push({
        date,
        staff: Math.round(dayStaff * 100) / 100,
        salary: Math.round(daySalary * 100) / 100,
        ratio: dayRatio,
        efficiency: dayEfficiency
      });
    }

    // 月均后厨人数
    const backStaffWithData = dailyBackStaff.filter(d => d.staff > 0);
    const backStaffAvg = backStaffWithData.length > 0
      ? Math.round(backStaffWithData.reduce((a, b) => a + b.staff, 0) / backStaffWithData.length * 10) / 10 : 0;

    // 月均后厨净工资占比
    const backRatioWithData = dailyBackStaff.filter(d => d.ratio > 0);
    const backRatioAvg = backRatioWithData.length > 0
      ? Math.round(backRatioWithData.reduce((a, b) => a + b.ratio, 0) / backRatioWithData.length * 10) / 10 : 0;

    // 月均后厨人效
    const backEffWithData = dailyBackStaff.filter(d => d.efficiency > 0);
    const backEffAvg = backEffWithData.length > 0
      ? Math.round(backEffWithData.reduce((a, b) => a + b.efficiency, 0) / backEffWithData.length) : 0;

    const backSalary = Math.round(backSalaryTotal);

    // 每日总数数据 = 前厅 + 后厨逐日相加
    const dailyTotalStaff = [];
    for (let i = 0; i < allDates.length; i++) {
      const f = dailyFrontStaff[i];
      const b = dailyBackStaff[i];
      const dayStaff = Math.round((f.staff + b.staff) * 100) / 100;
      const daySalary = Math.round((f.salary + b.salary) * 100) / 100;
      const dayRevenue = dailyRevenueMap[allDates[i]] || 0;
      const dayForecast = dailyForecastMap[allDates[i]] || 0;
      const dayRatio = (dayStaff > 0 && dayRevenue > 0) ? Math.round(daySalary / dayRevenue * 1000) / 10 : 0;
      const dayEfficiency = (dayStaff > 0 && dayRevenue > 0) ? Math.round(dayRevenue / dayStaff) : 0;
      // 每日营业额达成率 = 实收÷预估×100
      const dayRevenueAchieve = (dayRevenue > 0 && dayForecast > 0) ? Math.round(dayRevenue / dayForecast * 1000) / 10 : 0;
      // 每日人效达成率 = 总人效÷1200×100
      const dayEffAchieve = dayEfficiency > 0 ? Math.round(dayEfficiency / 1200 * 1000) / 10 : 0;
      dailyTotalStaff.push({ date: allDates[i], staff: dayStaff, salary: daySalary, ratio: dayRatio, efficiency: dayEfficiency, revenueAchieve: dayRevenueAchieve, effAchieve: dayEffAchieve });
    }

    // 总数月均人数
    const totalStaffWithData = dailyTotalStaff.filter(d => d.staff > 0);
    const totalStaffAvg = totalStaffWithData.length > 0
      ? Math.round(totalStaffWithData.reduce((a, b) => a + b.staff, 0) / totalStaffWithData.length * 10) / 10 : 0;

    // 总数月均人效
    const totalEffWithData = dailyTotalStaff.filter(d => d.efficiency > 0);
    const totalEffAvg = totalEffWithData.length > 0
      ? Math.round(totalEffWithData.reduce((a, b) => a + b.efficiency, 0) / totalEffWithData.length) : 0;

    const totalCount = totalStaffAvg;
    const totalSalary = frontSalary + backSalary;

    // 4. Standard values from config
    const frontStandard = getStandard('front_standard') || { efficiency: 2800, salary: 69195, ratio: 8.0 };
    const backStandard = getStandard('back_standard') || { efficiency: 2200, salary: 108117, ratio: 12.5 };
    const totalStandard = getStandard('total_standard') || { efficiency: 1200, salary: 177312, ratio: 20.5 };
    const revenueTarget = getStandard('revenue_target') || 864936;
    const efficiencyStandard = getStandard('efficiency_standard') || { revenue: 100, efficiency: 100 };

    // 5. Dynamic staff standard: 月实际营业额 ÷ 标准人效 ÷ 有数据天数
    const frontStaffStd = (dataDays > 0 && frontStandard.efficiency > 0)
      ? Math.round(totalRevenue / frontStandard.efficiency / dataDays * 10) / 10 : 0;
    const backStaffStd = (dataDays > 0 && backStandard.efficiency > 0)
      ? Math.round(totalRevenue / backStandard.efficiency / dataDays * 10) / 10 : 0;
    const totalStaffStd = (dataDays > 0 && totalStandard.efficiency > 0)
      ? Math.round(totalRevenue / totalStandard.efficiency / dataDays * 10) / 10 : 0;

    // 5.1 前厅标准占比固定8.0%，前厅净工资标准=月总营业额×8.0%
    const frontRatioStd = 8.0;
    const frontSalaryStd = Math.round(totalRevenue * frontRatioStd / 100);

    // 后厨标准占比和净工资标准
    const backRatioStd = backStandard.ratio || 12.5;
    const backSalaryStd = Math.round(totalRevenue * backRatioStd / 100);

    // 6. Calculate ratios & efficiency
    const frontRatio = totalRevenue > 0 ? (frontSalary / totalRevenue * 100) : 0;
    const backRatio = totalRevenue > 0 ? (backSalary / totalRevenue * 100) : 0;
    const totalRatio = totalRevenue > 0 ? (totalSalary / totalRevenue * 100) : 0;
    const frontEfficiency = frontEffAvg;
    const backEfficiency = backEffAvg;
    const totalEfficiency = totalEffAvg;
    // 营业额达成率 = 每日(实收÷预估)取非零平均值
    const dailyRevenueAchieve = [];
    for (const date of allDates) {
      const actual = dailyRevenueMap[date] || 0;
      const forecast = dailyForecastMap[date] || 0;
      if (actual > 0 && forecast > 0) {
        dailyRevenueAchieve.push(actual / forecast * 100);
      }
    }
    const revenueAchieve = dailyRevenueAchieve.length > 0
      ? dailyRevenueAchieve.reduce((a, b) => a + b, 0) / dailyRevenueAchieve.length : 0;

    // 人效达成率 = 每日(总人效÷1200)取非零平均值
    const totalEfficiencyStd = 1200;
    const dailyEffAchieve = [];
    for (const d of dailyTotalStaff) {
      if (d.efficiency > 0) {
        dailyEffAchieve.push(d.efficiency / totalEfficiencyStd * 100);
      }
    }
    const effAchieve = dailyEffAchieve.length > 0
      ? dailyEffAchieve.reduce((a, b) => a + b, 0) / dailyEffAchieve.length : 0;

    res.json({
      totalRevenue,
      dataDays,
      front: {
        staff: frontStaffAvg,
        dailyStaff: dailyFrontStaff,
        staffStd: frontStaffStd,
        salaryStd: frontSalaryStd,
        salary: frontSalary,
        ratioStd: frontRatioStd,
        ratio: Math.round(frontRatio * 10) / 10,
        efficiency: frontEfficiency,
        standard: frontStandard
      },
      back: {
        staff: backStaffAvg,
        dailyStaff: dailyBackStaff,
        staffStd: backStaffStd,
        salaryStd: backSalaryStd,
        salary: backSalary,
        ratioStd: backRatioStd,
        ratio: Math.round(backRatio * 10) / 10,
        efficiency: backEfficiency,
        standard: backStandard
      },
      total: {
        staff: totalStaffAvg,
        dailyStaff: dailyTotalStaff,
        staffStd: totalStaffStd,
        salaryStd: frontSalaryStd + backSalaryStd,
        salary: Math.round(totalSalary),
        ratioStd: frontRatioStd + backRatioStd,
        ratio: Math.round(totalRatio * 10) / 10,
        efficiency: totalEfficiency,
        standard: totalStandard
      },
      revenueTarget,
      revenueAchieve: Math.round(revenueAchieve * 10) / 10,
      effAchieve: Math.round(effAchieve * 10) / 10,
      efficiencyStandard
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
