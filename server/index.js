const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDB } = require('./db');

const revenueRoutes = require('./routes/revenue');
const staffRoutes = require('./routes/staff');
const scheduleRoutes = require('./routes/schedule');
const dashboardRoutes = require('./routes/dashboard');
const settingsRoutes = require('./routes/settings');
const dailySummaryRoutes = require('./routes/dailySummary');
const personalSummaryRoutes = require('./routes/personalSummary');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.use('/api/revenue', revenueRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/daily-summary', dailySummaryRoutes);
app.use('/api/personal-summary', personalSummaryRoutes);
app.use('/api/auth', authRoutes);

// Serve frontend static files
const distPath = path.join(__dirname, '..', 'dist');
const publicPath = path.join(__dirname, '..', 'public');
app.use(express.static(publicPath));
app.use(express.static(distPath));
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

async function start() {
  await initDB();
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    scheduleDailySummary();
  });
}

function scheduleDailySummary() {
  // 启动时补生成昨天的数据
  generateYesterday();

  // 每分钟检查是否到了9点，触发前一天数据生成
  setInterval(() => {
    const now = new Date();
    if (now.getHours() === 9 && now.getMinutes() === 0) {
      generateYesterday();
    }
    // 9:30 发送企业微信通知
    if (now.getHours() === 9 && now.getMinutes() === 30) {
      sendDailyNotification();
    }
  }, 60000);
}

async function generateYesterday() {
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().slice(0, 10);
    const pool = require('./db-mysql');
    // 确保表存在
    await pool.execute(`CREATE TABLE IF NOT EXISTS daily_summary (
      id INT PRIMARY KEY AUTO_INCREMENT,
      summary_date DATE NOT NULL UNIQUE,
      actual_revenue DECIMAL(12,2) DEFAULT 0,
      front_check_count DECIMAL(6,1) DEFAULT 0,
      front_bonus DECIMAL(12,2) DEFAULT 0,
      back_check_count DECIMAL(6,1) DEFAULT 0,
      back_bonus DECIMAL(12,2) DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    await pool.execute(`CREATE TABLE IF NOT EXISTS personal_summary (
      id INT PRIMARY KEY AUTO_INCREMENT,
      summary_date DATE NOT NULL,
      employee_name VARCHAR(50) NOT NULL,
      front_check_count DECIMAL(6,1) DEFAULT 0,
      back_check_count DECIMAL(6,1) DEFAULT 0,
      bonus DECIMAL(12,2) DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_date (summary_date)
    )`);
    // 检查是否已存在
    const [rows] = await pool.execute('SELECT id FROM daily_summary WHERE summary_date = ?', [dateStr]);
    if (rows.length === 0) {
      const axios = require('axios');
      await axios.post(`http://localhost:${PORT}/api/daily-summary/generate`, { date: dateStr });
      await axios.post(`http://localhost:${PORT}/api/personal-summary/generate`, { date: dateStr });
      console.log(`[Summary] Generated daily+personal data for ${dateStr}`);
    }
  } catch (err) {
    console.error('[DailySummary] Generate failed:', err.message);
  }
}

const WEBHOOK_URL = 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=a065dffd-6817-4e2c-89c2-98d13b916f0f';

async function sendDailyNotification() {
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().slice(0, 10);
    const axios = require('axios');
    const pool = require('./db-mysql');

    // 1. 取总数据
    const [dsRows] = await pool.execute(
      'SELECT * FROM daily_summary WHERE summary_date = ?', [dateStr]
    );

    // 2. 取个人数据（只取出勤员工）
    const [psRows] = await pool.execute(
      'SELECT employee_name, front_check_count, back_check_count, bonus FROM personal_summary WHERE summary_date = ? AND (front_check_count > 0 OR back_check_count > 0) ORDER BY employee_name',
      [dateStr]
    );

    if (dsRows.length === 0) {
      console.log(`[Webhook] No daily_summary data for ${dateStr}, skip notification`);
      return;
    }

    const ds = dsRows[0];

    // 3. 构建消息 - 分前厅和后厨展示
    const frontStaff = psRows.filter(p => Number(p.front_check_count) > 0);
    const backStaff = psRows.filter(p => Number(p.back_check_count) > 0);

    let md = `## 📊 每日经营数据报表（${dateStr}）\n\n`;
    md += `### 总数据\n`;
    md += `> 实收营业额：**¥${Number(ds.actual_revenue).toLocaleString()}**\n`;
    md += `> 前厅出勤：**${Number(ds.front_check_count)}人**  奖金：**¥${Number(ds.front_bonus).toLocaleString()}**\n`;
    md += `> 后厨出勤：**${Number(ds.back_check_count)}人**  奖金：**¥${Number(ds.back_bonus).toLocaleString()}**\n`;

    if (frontStaff.length > 0) {
      md += `\n### 前厅出勤人员（${frontStaff.length}人）\n`;
      for (const p of frontStaff) {
        const bonusStr = Number(p.bonus) !== 0 ? `¥${Number(p.bonus).toLocaleString()}` : '-';
        md += `> ${p.employee_name}：出勤${p.front_check_count}人天  奖金：**${bonusStr}**\n`;
      }
    }

    if (backStaff.length > 0) {
      md += `\n### 后厨出勤人员（${backStaff.length}人）\n`;
      for (const p of backStaff) {
        const bonusStr = Number(p.bonus) !== 0 ? `¥${Number(p.bonus).toLocaleString()}` : '-';
        md += `> ${p.employee_name}：出勤${p.back_check_count}人天  奖金：**${bonusStr}**\n`;
      }
    }

    // 4. 发送企业微信 webhook
    await axios.post(WEBHOOK_URL, {
      msgtype: 'markdown',
      markdown: { content: md }
    });

    console.log(`[Webhook] Sent daily notification for ${dateStr}`);
  } catch (err) {
    console.error('[Webhook] Send failed:', err.message);
  }
}

start();
