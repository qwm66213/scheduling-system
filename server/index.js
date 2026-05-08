const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDB } = require('./db');

const revenueRoutes = require('./routes/revenue');
const staffRoutes = require('./routes/staff');
const scheduleRoutes = require('./routes/schedule');
const configRoutes = require('./routes/config');
const dashboardRoutes = require('./routes/dashboard');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.use('/api/revenue', revenueRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/config', configRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Serve frontend static files
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

async function start() {
  await initDB();
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

start();
